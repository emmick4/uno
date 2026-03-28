import type { ServerWebSocket } from 'bun'
import type {
  ClientMessage,
  ServerMessage,
  LobbyStatePayload,
  GameState,
  GameSettings,
  LobbyPlayer,
  CardColor,
  CardEffect,
} from '@uno/shared'
import { DEFAULT_GAME_SETTINGS } from '@uno/shared'
import { getGamemode } from '@uno/gamemodes'
import {
  createGameState,
  playCard,
  playMultipleCards,
  drawCard,
  passTurn,
  callUno,
  playOutOfTurn,
  handleTurnTimeout,
  serializeForPlayer,
} from './engine/game-engine'

export interface ConnectionData {
  playerId: string
  nickname: string
  isHost: boolean
  roomCode: string
}

// ─── Timeout Constants ────────────────────────────────────
const IDLE_TIMEOUT_MS = 30 * 60_000       // 30 min no messages → close room
const MAX_GAME_DURATION_MS = 2 * 60 * 60_000 // 2 hr hard cap per game
const LOBBY_TIMEOUT_MS = 15 * 60_000      // 15 min lobby without starting → close
const REAP_INTERVAL_MS = 60_000           // check every 60s

interface RoomState {
  phase: 'lobby' | 'playing' | 'finished'
  hostId: string
  players: LobbyPlayer[]
  settings: GameSettings
  connections: Set<ServerWebSocket<ConnectionData>>
  gameState: GameState | null
  turnTimer: ReturnType<typeof setTimeout> | null
  lastActivityAt: number
  createdAt: number
}

class RoomManager {
  rooms = new Map<string, RoomState>()
  private reapTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.reapTimer = setInterval(() => this.reapStaleRooms(), REAP_INTERVAL_MS)
  }

  private reapStaleRooms() {
    const now = Date.now()
    for (const [roomCode, room] of this.rooms) {
      let reason: string | null = null

      if (now - room.lastActivityAt > IDLE_TIMEOUT_MS) {
        reason = 'idle timeout'
      } else if (room.phase === 'lobby' && now - room.createdAt > LOBBY_TIMEOUT_MS) {
        reason = 'lobby timeout'
      } else if (room.phase === 'playing' && room.gameState && now - room.createdAt > MAX_GAME_DURATION_MS) {
        reason = 'max game duration'
      }

      if (reason) {
        console.log(`Reaping room ${roomCode}: ${reason}`)
        this.closeRoom(roomCode, room)
      }
    }
  }

  private closeRoom(roomCode: string, room: RoomState) {
    if (room.turnTimer) clearTimeout(room.turnTimer)
    this.broadcast(room, { type: 'error', code: 'ROOM_CLOSED', message: 'Room closed due to inactivity' })
    for (const conn of room.connections) {
      try { conn.close() } catch {}
    }
    this.rooms.delete(roomCode)
  }

  getOrCreateRoom(roomCode: string): RoomState {
    let room = this.rooms.get(roomCode)
    if (!room) {
      const now = Date.now()
      room = {
        phase: 'lobby',
        hostId: '',
        players: [],
        settings: { ...DEFAULT_GAME_SETTINGS },
        connections: new Set(),
        gameState: null,
        turnTimer: null,
        lastActivityAt: now,
        createdAt: now,
      }
      this.rooms.set(roomCode, room)
    }
    return room
  }

  handleConnect(ws: ServerWebSocket<ConnectionData>) {
    const { roomCode } = ws.data
    const room = this.getOrCreateRoom(roomCode)
    room.connections.add(ws)

    if (room.phase === 'lobby') {
      this.sendTo(ws, { type: 'lobbyState', state: this.getLobbyPayload(roomCode, room) })
    } else if (room.gameState) {
      const player = room.gameState.players.find((p) => p.id === ws.data.playerId)
      if (player) {
        player.isConnected = true
        this.sendTo(ws, {
          type: 'gameState',
          state: serializeForPlayer(room.gameState, ws.data.playerId),
        })
      }
    }
  }

  handleMessage(ws: ServerWebSocket<ConnectionData>, message: string) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(message)
    } catch {
      this.sendTo(ws, { type: 'error', code: 'INVALID_JSON', message: 'Invalid message' })
      return
    }

    const { roomCode } = ws.data
    const room = this.rooms.get(roomCode)
    if (!room) {
      this.sendTo(ws, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Room not found' })
      return
    }

    room.lastActivityAt = Date.now()

    switch (msg.type) {
      case 'join':
        this.handleJoin(ws, room, roomCode, msg.nickname, msg.playerId)
        break
      case 'updateNickname':
        this.handleUpdateNickname(ws, room, msg.nickname)
        break
      case 'updateSettings':
        this.handleUpdateSettings(ws, room, msg.settings)
        break
      case 'startGame':
        this.handleStartGame(ws, room, roomCode)
        break
      case 'kick':
        this.handleKick(ws, room, msg.playerId)
        break
      case 'playCard':
        this.handlePlayCard(ws, room, msg.cardId, msg.chosenColor)
        break
      case 'playMultiple':
        this.handlePlayMultiple(ws, room, msg.cardIds)
        break
      case 'drawCard':
        this.handleDrawCard(ws, room)
        break
      case 'pass':
        this.handlePass(ws, room)
        break
      case 'callUno':
        this.handleCallUno(ws, room, msg.targetPlayerId)
        break
      case 'playOutOfTurn':
        this.handlePlayOutOfTurn(ws, room, msg.cardId)
        break
      case 'chat':
        this.handleChat(ws, room, msg.text)
        break
      case 'rematch':
        this.handleRematch(ws, room, roomCode)
        break
      case 'leave':
        this.handleLeave(ws, room)
        break
    }
  }

  handleClose(ws: ServerWebSocket<ConnectionData>) {
    const { roomCode, playerId } = ws.data
    const room = this.rooms.get(roomCode)
    if (!room) return

    room.connections.delete(ws)

    if (room.phase === 'lobby') {
      const player = room.players.find((p) => p.id === playerId)
      if (player) {
        player.isConnected = false
        this.broadcastLobbyState(roomCode, room)
        this.broadcast(room, { type: 'playerLeft', playerId })
      }
    } else if (room.gameState) {
      const player = room.gameState.players.find((p) => p.id === playerId)
      if (player) {
        player.isConnected = false
        this.broadcastGameState(room)
      }
    }

    // Clean up empty rooms after a delay
    if (room.connections.size === 0) {
      setTimeout(() => {
        const r = this.rooms.get(roomCode)
        if (r && r.connections.size === 0) {
          if (r.turnTimer) clearTimeout(r.turnTimer)
          this.rooms.delete(roomCode)
        }
      }, 60_000)
    }
  }

  // ─── Lobby Handlers ──────────────────────────────────────

  private handleJoin(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    roomCode: string,
    nickname: string,
    existingPlayerId?: string,
  ) {
    // Reconnect: if the client sends a playerId, try to reclaim that seat
    if (existingPlayerId) {
      const existing = room.players.find((p) => p.id === existingPlayerId)
      if (existing) {
        // Reclaim the seat — close any stale connection for this player
        for (const conn of room.connections) {
          if (conn !== ws && conn.data.playerId === existingPlayerId) {
            room.connections.delete(conn)
            try { conn.close() } catch {}
          }
        }

        existing.isConnected = true
        existing.nickname = nickname.slice(0, 20) || existing.nickname
        ws.data.playerId = existing.id
        ws.data.nickname = existing.nickname
        ws.data.isHost = existing.isHost

        this.sendTo(ws, { type: 'welcome', playerId: existing.id })
        this.broadcastLobbyState(roomCode, room)

        // If in-game, also send game state
        if (room.gameState) {
          const gamePlayer = room.gameState.players.find((p) => p.id === existing.id)
          if (gamePlayer) {
            gamePlayer.isConnected = true
            this.sendTo(ws, {
              type: 'gameState',
              state: serializeForPlayer(room.gameState, existing.id),
            })
          }
        }
        return
      }
      // If playerId not found in room, fall through to create new player
    }

    if (ws.data.playerId) return // already joined on this connection

    const playerId = crypto.randomUUID()
    const isHost = room.players.length === 0

    if (room.players.length >= room.settings.maxPlayers) {
      this.sendTo(ws, { type: 'error', code: 'ROOM_FULL', message: 'Room is full' })
      return
    }

    const takenSeats = new Set(room.players.map((p) => p.seatIndex))
    let seatIndex = 0
    while (takenSeats.has(seatIndex)) seatIndex++

    const player: LobbyPlayer = {
      id: playerId,
      nickname: nickname.slice(0, 20) || 'Player',
      isHost,
      isConnected: true,
      seatIndex,
    }

    ws.data.playerId = playerId
    ws.data.nickname = player.nickname
    ws.data.isHost = isHost

    if (isHost) room.hostId = playerId

    room.players.push(player)
    this.sendTo(ws, { type: 'welcome', playerId })
    this.broadcastLobbyState(roomCode, room)
    this.broadcast(room, { type: 'playerJoined', player })
  }

  private handleUpdateNickname(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    nickname: string,
  ) {
    const sanitized = nickname.slice(0, 20).trim() || 'Player'
    const player = room.players.find((p) => p.id === ws.data.playerId)
    if (!player) return

    player.nickname = sanitized
    ws.data.nickname = sanitized
    this.broadcastLobbyState(ws.data.roomCode, room)
  }

  private handleUpdateSettings(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    settings: Partial<GameSettings>,
  ) {
    if (!ws.data.isHost) {
      this.sendTo(ws, { type: 'error', code: 'NOT_HOST', message: 'Only the host can change settings' })
      return
    }

    const wasPublic = room.settings.isPublic
    room.settings = { ...room.settings, ...settings }
    if (settings.houseRules) {
      room.settings.houseRules = { ...room.settings.houseRules, ...settings.houseRules }
    }

    this.broadcastLobbyState(ws.data.roomCode, room)
  }

  private handleStartGame(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    roomCode: string,
  ) {
    if (!ws.data.isHost) {
      this.sendTo(ws, { type: 'error', code: 'NOT_HOST', message: 'Only the host can start the game' })
      return
    }

    const connectedPlayers = room.players.filter((p) => p.isConnected)
    if (connectedPlayers.length < 2) {
      this.sendTo(ws, { type: 'error', code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 connected players' })
      return
    }

    if (room.phase !== 'lobby') {
      this.sendTo(ws, { type: 'error', code: 'WRONG_PHASE', message: 'Game already started' })
      return
    }

    const gamemode = getGamemode(room.settings.gamemode)

    room.gameState = createGameState(
      roomCode,
      connectedPlayers.map((p) => ({ id: p.id, nickname: p.nickname, isHost: p.isHost })),
      gamemode,
      room.settings.houseRules,
      room.settings.turnTimeLimit,
    )

    room.phase = 'playing'
    this.broadcast(room, { type: 'gameStarted' })
    this.broadcastGameState(room)

    if (room.gameState.turnTimeLimit > 0) {
      this.setTurnTimer(room)
    }
  }

  private handleKick(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    targetId: string,
  ) {
    if (!ws.data.isHost) {
      this.sendTo(ws, { type: 'error', code: 'NOT_HOST', message: 'Only the host can kick players' })
      return
    }

    room.players = room.players.filter((p) => p.id !== targetId)
    this.broadcast(room, { type: 'playerLeft', playerId: targetId })
    this.broadcastLobbyState(ws.data.roomCode, room)
  }

  // ─── Game Handlers ───────────────────────────────────────

  private handlePlayCard(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    cardId: string,
    chosenColor?: CardColor,
  ) {
    if (!room.gameState || room.gameState.phase !== 'playing') {
      this.sendTo(ws, { type: 'error', code: 'WRONG_PHASE', message: 'Game not in progress' })
      return
    }

    const gamemode = getGamemode(room.gameState.gamemode)
    const result = playCard(room.gameState, ws.data.playerId, cardId, chosenColor, gamemode)

    if (!result.success) {
      this.sendTo(ws, { type: 'error', code: 'INVALID_PLAY', message: result.error || 'Invalid play' })
      return
    }

    const card = room.gameState.discardPile[room.gameState.discardPile.length - 1]
    const nextPlayer = room.gameState.players[room.gameState.currentPlayerIndex]

    this.broadcast(room, { type: 'cardPlayed', playerId: ws.data.playerId, card, nextPlayerId: nextPlayer.id })
    this.broadcastEffectEvents(room, result.effects)
    this.broadcastGameState(room)
    this.resetTurnTimer(room)
  }

  private handlePlayMultiple(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    cardIds: string[],
  ) {
    if (!room.gameState || room.gameState.phase !== 'playing') return

    const gamemode = getGamemode(room.gameState.gamemode)
    const result = playMultipleCards(room.gameState, ws.data.playerId, cardIds, gamemode)

    if (!result.success) {
      this.sendTo(ws, { type: 'error', code: 'INVALID_PLAY', message: result.error || 'Invalid play' })
      return
    }

    this.broadcastEffectEvents(room, result.effects)
    this.broadcastGameState(room)
    this.resetTurnTimer(room)
  }

  private handleDrawCard(ws: ServerWebSocket<ConnectionData>, room: RoomState) {
    if (!room.gameState || room.gameState.phase !== 'playing') return

    const gamemode = getGamemode(room.gameState.gamemode)
    const result = drawCard(room.gameState, ws.data.playerId, gamemode)

    if (!result.success) {
      this.sendTo(ws, { type: 'error', code: 'CANNOT_DRAW', message: result.error || 'Cannot draw' })
      return
    }

    this.sendTo(ws, { type: 'cardDrawn', playerId: ws.data.playerId, count: result.drawnCards.length, cards: result.drawnCards })
    this.broadcastExcept(room, ws, { type: 'cardDrawn', playerId: ws.data.playerId, count: result.drawnCards.length })
    this.broadcastGameState(room)
    this.resetTurnTimer(room)
  }

  private handlePass(ws: ServerWebSocket<ConnectionData>, room: RoomState) {
    if (!room.gameState || room.gameState.phase !== 'playing') return

    const result = passTurn(room.gameState, ws.data.playerId)
    if (!result.success) {
      this.sendTo(ws, { type: 'error', code: 'CANNOT_PASS', message: result.error || 'Cannot pass' })
      return
    }

    this.broadcastGameState(room)
    this.resetTurnTimer(room)
  }

  private handleCallUno(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    targetPlayerId?: string,
  ) {
    if (!room.gameState || room.gameState.phase !== 'playing') return

    const result = callUno(room.gameState, ws.data.playerId, targetPlayerId)
    if (!result.success) {
      this.sendTo(ws, { type: 'error', code: 'UNO_FAILED', message: result.error || 'UNO call failed' })
      return
    }

    this.broadcast(room, { type: 'unoCall', callerId: ws.data.playerId, targetId: targetPlayerId, penalty: result.penalty })
    this.broadcastGameState(room)
  }

  private handlePlayOutOfTurn(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    cardId: string,
  ) {
    if (!room.gameState || room.gameState.phase !== 'playing') return

    const gamemode = getGamemode(room.gameState.gamemode)
    const result = playOutOfTurn(room.gameState, ws.data.playerId, cardId, gamemode)

    if (!result.success) {
      this.sendTo(ws, { type: 'error', code: 'INVALID_PLAY', message: result.error || 'Cannot play out of turn' })
      return
    }

    this.broadcastEffectEvents(room, result.effects)
    this.broadcastGameState(room)
  }

  private handleChat(ws: ServerWebSocket<ConnectionData>, room: RoomState, text: string) {
    const sanitized = text.slice(0, 200).trim()
    if (!sanitized) return

    this.broadcast(room, {
      type: 'chatMessage',
      playerId: ws.data.playerId,
      nickname: ws.data.nickname,
      text: sanitized,
      timestamp: Date.now(),
    })
  }

  private handleRematch(
    ws: ServerWebSocket<ConnectionData>,
    room: RoomState,
    roomCode: string,
  ) {
    if (!room.gameState || room.gameState.phase !== 'finished') return

    if (!room.gameState.rematchVotes.includes(ws.data.playerId)) {
      room.gameState.rematchVotes.push(ws.data.playerId)
    }

    const connectedCount = room.gameState.players.filter((p) => p.isConnected).length
    if (room.gameState.rematchVotes.length >= connectedCount) {
      room.phase = 'lobby'
      room.gameState = null
      if (room.turnTimer) clearTimeout(room.turnTimer)
      room.turnTimer = null
      this.broadcastLobbyState(roomCode, room)
    } else {
      this.broadcastGameState(room)
    }
  }

  private handleLeave(ws: ServerWebSocket<ConnectionData>, room: RoomState) {
    const { playerId, isHost, roomCode } = ws.data

    if (room.phase === 'lobby') {
      room.players = room.players.filter((p) => p.id !== playerId)
      this.broadcast(room, { type: 'playerLeft', playerId })

      if (isHost && room.players.length > 0) {
        room.players[0].isHost = true
        room.hostId = room.players[0].id
        // Update the new host's connection data
        for (const conn of room.connections) {
          if (conn.data.playerId === room.players[0].id) {
            conn.data.isHost = true
          }
        }
      }

      this.broadcastLobbyState(roomCode, room)
    } else if (room.gameState) {
      const player = room.gameState.players.find((p) => p.id === playerId)
      if (player) {
        player.isConnected = false
        player.isEliminated = true
      }
      this.broadcastGameState(room)
    }
  }

  // ─── Turn Timer ──────────────────────────────────────────

  private setTurnTimer(room: RoomState) {
    if (!room.gameState || room.gameState.turnTimeLimit <= 0) return

    room.turnTimer = setTimeout(() => {
      try {
        if (!room.gameState || room.gameState.phase !== 'playing') return

        const gamemode = getGamemode(room.gameState.gamemode)
        const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex]
        const result = handleTurnTimeout(room.gameState, gamemode)

        this.broadcast(room, { type: 'cardDrawn', playerId: currentPlayer.id, count: result.drawnCards.length })
        this.broadcastGameState(room)
      } catch (err) {
        console.error('Turn timer error:', err)
      } finally {
        if (room.gameState?.phase === 'playing') {
          this.setTurnTimer(room)
        }
      }
    }, room.gameState.turnTimeLimit * 1000)
  }

  private resetTurnTimer(room: RoomState) {
    if (room.turnTimer) clearTimeout(room.turnTimer)
    room.turnTimer = null
    if (room.gameState?.phase === 'playing') {
      this.setTurnTimer(room)
    }
  }

  // ─── Broadcast Helpers ───────────────────────────────────

  private getLobbyPayload(roomCode: string, room: RoomState): LobbyStatePayload {
    return {
      roomCode,
      hostId: room.hostId,
      players: room.players,
      settings: room.settings,
    }
  }

  private broadcastLobbyState(roomCode: string, room: RoomState) {
    this.broadcast(room, { type: 'lobbyState', state: this.getLobbyPayload(roomCode, room) })
  }

  private broadcastGameState(room: RoomState) {
    if (!room.gameState) return

    for (const conn of room.connections) {
      if (conn.data.playerId) {
        this.sendTo(conn, {
          type: 'gameState',
          state: serializeForPlayer(room.gameState, conn.data.playerId),
        })
      }
    }

    if (room.gameState.phase === 'finished') {
      if (room.turnTimer) clearTimeout(room.turnTimer)
      room.turnTimer = null
      this.broadcast(room, {
        type: 'gameOver',
        winnerId: room.gameState.standings[0],
        standings: room.gameState.standings,
      })
    }
  }

  private broadcastEffectEvents(room: RoomState, effects: CardEffect[]) {
    for (const effect of effects) {
      switch (effect.type) {
        case 'reverse':
          this.broadcast(room, { type: 'directionReversed' })
          break
        case 'skip':
          this.broadcast(room, { type: 'playerSkipped', playerId: effect.target })
          break
        case 'setColor':
          this.broadcast(room, { type: 'colorChanged', color: effect.color })
          break
        case 'viewHand': {
          if (room.gameState) {
            const target = room.gameState.players.find((p) => p.id === effect.target)
            for (const conn of room.connections) {
              if (conn.data.playerId === effect.viewer && target) {
                this.sendTo(conn, { type: 'handRevealed', targetId: effect.target, cards: target.hand })
              }
            }
          }
          break
        }
      }
    }
  }

  private broadcast(room: RoomState, msg: ServerMessage) {
    const json = JSON.stringify(msg)
    for (const conn of room.connections) {
      conn.send(json)
    }
  }

  private broadcastExcept(
    room: RoomState,
    exclude: ServerWebSocket<ConnectionData>,
    msg: ServerMessage,
  ) {
    const json = JSON.stringify(msg)
    for (const conn of room.connections) {
      if (conn !== exclude) conn.send(json)
    }
  }

  private sendTo(ws: ServerWebSocket<ConnectionData>, msg: ServerMessage) {
    ws.send(JSON.stringify(msg))
  }
}

export const roomManager = new RoomManager()
