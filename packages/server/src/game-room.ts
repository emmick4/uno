import type * as Party from 'partykit/server'
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
import { setTurnAlarm, cancelTurnAlarm } from './engine/turn-timer'

interface ConnectionState {
  playerId: string
  nickname: string
  isHost: boolean
}

interface RoomState {
  phase: 'lobby' | 'playing' | 'finished'
  hostId: string
  players: LobbyPlayer[]
  settings: GameSettings
}

export default class GameRoom implements Party.Server {
  roomState: RoomState
  gameState: GameState | null = null

  constructor(readonly room: Party.Room) {
    this.roomState = {
      phase: 'lobby',
      hostId: '',
      players: [],
      settings: { ...DEFAULT_GAME_SETTINGS },
    }
  }

  onConnect(conn: Party.Connection) {
    if (this.roomState.phase === 'lobby') {
      this.sendTo(conn, {
        type: 'lobbyState',
        state: this.getLobbyPayload(),
      })
    } else if (this.gameState) {
      // Reconnecting to an in-progress game
      const state = conn.state as ConnectionState | undefined
      if (state) {
        const player = this.gameState.players.find((p) => p.id === state.playerId)
        if (player) {
          player.isConnected = true
          this.sendTo(conn, {
            type: 'gameState',
            state: serializeForPlayer(this.gameState, state.playerId),
          })
        }
      }
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(message)
    } catch {
      this.sendTo(sender, { type: 'error', code: 'INVALID_JSON', message: 'Invalid message' })
      return
    }

    const connState = sender.state as ConnectionState | undefined

    switch (msg.type) {
      // ─── Lobby ───
      case 'join':
        this.handleJoin(sender, msg.nickname)
        break
      case 'updateSettings':
        this.handleUpdateSettings(sender, msg.settings)
        break
      case 'startGame':
        this.handleStartGame(sender)
        break
      case 'kick':
        this.handleKick(sender, msg.playerId)
        break

      // ─── Game ───
      case 'playCard':
        if (connState) this.handlePlayCard(sender, connState.playerId, msg.cardId, msg.chosenColor)
        break
      case 'playMultiple':
        if (connState) this.handlePlayMultiple(sender, connState.playerId, msg.cardIds)
        break
      case 'drawCard':
        if (connState) this.handleDrawCard(sender, connState.playerId)
        break
      case 'pass':
        if (connState) this.handlePass(sender, connState.playerId)
        break
      case 'callUno':
        if (connState) this.handleCallUno(sender, connState.playerId, msg.targetPlayerId)
        break
      case 'playOutOfTurn':
        if (connState) this.handlePlayOutOfTurn(sender, connState.playerId, msg.cardId)
        break

      // ─── Chat ───
      case 'chat':
        if (connState) this.handleChat(connState, msg.text)
        break

      // ─── General ───
      case 'rematch':
        if (connState) this.handleRematch(connState.playerId)
        break
      case 'leave':
        this.handleLeave(sender)
        break
    }
  }

  onClose(conn: Party.Connection) {
    const state = conn.state as ConnectionState | undefined
    if (!state) return

    if (this.roomState.phase === 'lobby') {
      const player = this.roomState.players.find((p) => p.id === state.playerId)
      if (player) {
        player.isConnected = false
        this.broadcastLobbyState()
        this.broadcast({ type: 'playerLeft', playerId: state.playerId })
      }
    } else if (this.gameState) {
      const player = this.gameState.players.find((p) => p.id === state.playerId)
      if (player) {
        player.isConnected = false
        this.broadcastGameState()
      }
    }
  }

  async onAlarm() {
    // Turn timeout
    if (!this.gameState || this.gameState.phase !== 'playing') return

    const gamemode = getGamemode(this.gameState.gamemode)
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex]
    const result = handleTurnTimeout(this.gameState, gamemode)

    // Notify about the timeout draw
    this.broadcast({
      type: 'cardDrawn',
      playerId: currentPlayer.id,
      count: result.drawnCards.length,
    })

    this.broadcastGameState()

    if (this.gameState.phase === 'playing') {
      setTurnAlarm(this.room, this.gameState.turnTimeLimit * 1000)
    }
  }

  // ─── Lobby Handlers ──────────────────────────────────────

  private handleJoin(conn: Party.Connection, nickname: string) {
    // Check if this is a reconnect
    const existingState = conn.state as ConnectionState | undefined
    if (existingState?.playerId) {
      // Already joined — just resync
      return
    }

    const playerId = crypto.randomUUID()
    const isHost = this.roomState.players.length === 0

    if (this.roomState.players.length >= this.roomState.settings.maxPlayers) {
      this.sendTo(conn, { type: 'error', code: 'ROOM_FULL', message: 'Room is full' })
      return
    }

    const takenSeats = new Set(this.roomState.players.map((p) => p.seatIndex))
    let seatIndex = 0
    while (takenSeats.has(seatIndex)) seatIndex++

    const player: LobbyPlayer = {
      id: playerId,
      nickname: nickname.slice(0, 20) || 'Player',
      isHost,
      isConnected: true,
      seatIndex,
    }

    const connState: ConnectionState = {
      playerId,
      nickname: player.nickname,
      isHost,
    }
    conn.setState(connState)

    if (isHost) {
      this.roomState.hostId = playerId
    }

    this.roomState.players.push(player)
    this.sendTo(conn, { type: 'welcome', playerId })
    this.broadcastLobbyState()
    this.broadcast({ type: 'playerJoined', player })
    this.notifyMatchmaking(isHost ? 'register' : 'update')
  }

  private handleUpdateSettings(conn: Party.Connection, settings: Partial<GameSettings>) {
    const state = conn.state as ConnectionState | undefined
    if (!state?.isHost) {
      this.sendTo(conn, { type: 'error', code: 'NOT_HOST', message: 'Only the host can change settings' })
      return
    }

    const wasPublic = this.roomState.settings.isPublic
    this.roomState.settings = { ...this.roomState.settings, ...settings }
    if (settings.houseRules) {
      this.roomState.settings.houseRules = {
        ...this.roomState.settings.houseRules,
        ...settings.houseRules,
      }
    }

    this.broadcastLobbyState()

    // Notify matchmaking if public status changed
    if (this.roomState.settings.isPublic && !wasPublic) {
      this.notifyMatchmaking('register')
    } else if (!this.roomState.settings.isPublic && wasPublic) {
      this.notifyMatchmaking('remove')
    } else if (this.roomState.settings.isPublic) {
      this.notifyMatchmaking('update')
    }
  }

  private handleStartGame(conn: Party.Connection) {
    const state = conn.state as ConnectionState | undefined
    if (!state?.isHost) {
      this.sendTo(conn, { type: 'error', code: 'NOT_HOST', message: 'Only the host can start the game' })
      return
    }

    const connectedPlayers = this.roomState.players.filter((p) => p.isConnected)
    if (connectedPlayers.length < 2) {
      this.sendTo(conn, { type: 'error', code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 connected players' })
      return
    }

    if (this.roomState.phase !== 'lobby') {
      this.sendTo(conn, { type: 'error', code: 'WRONG_PHASE', message: 'Game already started' })
      return
    }

    const gamemode = getGamemode(this.roomState.settings.gamemode)

    this.gameState = createGameState(
      this.room.id,
      connectedPlayers.map((p) => ({ id: p.id, nickname: p.nickname, isHost: p.isHost })),
      gamemode,
      this.roomState.settings.houseRules,
      this.roomState.settings.turnTimeLimit,
    )

    this.roomState.phase = 'playing'
    this.broadcast({ type: 'gameStarted' })
    this.broadcastGameState()
    this.notifyMatchmaking('remove')

    // Start turn timer
    if (this.gameState.turnTimeLimit > 0) {
      setTurnAlarm(this.room, this.gameState.turnTimeLimit * 1000)
    }
  }

  private handleKick(conn: Party.Connection, targetId: string) {
    const state = conn.state as ConnectionState | undefined
    if (!state?.isHost) {
      this.sendTo(conn, { type: 'error', code: 'NOT_HOST', message: 'Only the host can kick players' })
      return
    }

    this.roomState.players = this.roomState.players.filter((p) => p.id !== targetId)
    this.broadcast({ type: 'playerLeft', playerId: targetId })
    this.broadcastLobbyState()
  }

  // ─── Game Handlers ───────────────────────────────────────

  private handlePlayCard(
    conn: Party.Connection,
    playerId: string,
    cardId: string,
    chosenColor?: CardColor,
  ) {
    if (!this.gameState || this.gameState.phase !== 'playing') {
      this.sendTo(conn, { type: 'error', code: 'WRONG_PHASE', message: 'Game not in progress' })
      return
    }

    const gamemode = getGamemode(this.gameState.gamemode)
    const result = playCard(this.gameState, playerId, cardId, chosenColor, gamemode)

    if (!result.success) {
      this.sendTo(conn, { type: 'error', code: 'INVALID_PLAY', message: result.error || 'Invalid play' })
      return
    }

    const card = this.gameState.discardPile[this.gameState.discardPile.length - 1]
    const nextPlayer = this.gameState.players[this.gameState.currentPlayerIndex]

    this.broadcast({
      type: 'cardPlayed',
      playerId,
      card,
      nextPlayerId: nextPlayer.id,
    })

    this.broadcastEffectEvents(result.effects)
    this.broadcastGameState()
    this.resetTurnTimer()
  }

  private handlePlayMultiple(conn: Party.Connection, playerId: string, cardIds: string[]) {
    if (!this.gameState || this.gameState.phase !== 'playing') {
      this.sendTo(conn, { type: 'error', code: 'WRONG_PHASE', message: 'Game not in progress' })
      return
    }

    const gamemode = getGamemode(this.gameState.gamemode)
    const result = playMultipleCards(this.gameState, playerId, cardIds, gamemode)

    if (!result.success) {
      this.sendTo(conn, { type: 'error', code: 'INVALID_PLAY', message: result.error || 'Invalid play' })
      return
    }

    this.broadcastEffectEvents(result.effects)
    this.broadcastGameState()
    this.resetTurnTimer()
  }

  private handleDrawCard(conn: Party.Connection, playerId: string) {
    if (!this.gameState || this.gameState.phase !== 'playing') {
      this.sendTo(conn, { type: 'error', code: 'WRONG_PHASE', message: 'Game not in progress' })
      return
    }

    const gamemode = getGamemode(this.gameState.gamemode)
    const result = drawCard(this.gameState, playerId, gamemode)

    if (!result.success) {
      this.sendTo(conn, { type: 'error', code: 'CANNOT_DRAW', message: result.error || 'Cannot draw' })
      return
    }

    // Send drawn cards only to the player who drew
    this.sendTo(conn, {
      type: 'cardDrawn',
      playerId,
      count: result.drawnCards.length,
      cards: result.drawnCards,
    })

    // Notify others (without card data)
    this.broadcastExcept(conn, {
      type: 'cardDrawn',
      playerId,
      count: result.drawnCards.length,
    })

    this.broadcastGameState()
    this.resetTurnTimer()
  }

  private handlePass(conn: Party.Connection, playerId: string) {
    if (!this.gameState || this.gameState.phase !== 'playing') return

    const result = passTurn(this.gameState, playerId)
    if (!result.success) {
      this.sendTo(conn, { type: 'error', code: 'CANNOT_PASS', message: result.error || 'Cannot pass' })
      return
    }

    this.broadcastGameState()
    this.resetTurnTimer()
  }

  private handleCallUno(conn: Party.Connection, callerId: string, targetPlayerId?: string) {
    if (!this.gameState || this.gameState.phase !== 'playing') return

    const result = callUno(this.gameState, callerId, targetPlayerId)
    if (!result.success) {
      this.sendTo(conn, { type: 'error', code: 'UNO_FAILED', message: result.error || 'UNO call failed' })
      return
    }

    this.broadcast({
      type: 'unoCall',
      callerId,
      targetId: targetPlayerId,
      penalty: result.penalty,
    })

    this.broadcastGameState()
  }

  private handlePlayOutOfTurn(conn: Party.Connection, playerId: string, cardId: string) {
    if (!this.gameState || this.gameState.phase !== 'playing') return

    const gamemode = getGamemode(this.gameState.gamemode)
    const result = playOutOfTurn(this.gameState, playerId, cardId, gamemode)

    if (!result.success) {
      this.sendTo(conn, { type: 'error', code: 'INVALID_PLAY', message: result.error || 'Cannot play out of turn' })
      return
    }

    this.broadcastEffectEvents(result.effects)
    this.broadcastGameState()
  }

  // ─── Chat ────────────────────────────────────────────────

  private handleChat(sender: ConnectionState, text: string) {
    const sanitized = text.slice(0, 200).trim()
    if (!sanitized) return

    this.broadcast({
      type: 'chatMessage',
      playerId: sender.playerId,
      nickname: sender.nickname,
      text: sanitized,
      timestamp: Date.now(),
    })
  }

  // ─── Rematch ─────────────────────────────────────────────

  private handleRematch(playerId: string) {
    if (!this.gameState || this.gameState.phase !== 'finished') return

    if (!this.gameState.rematchVotes.includes(playerId)) {
      this.gameState.rematchVotes.push(playerId)
    }

    const connectedCount = this.gameState.players.filter((p) => p.isConnected).length
    if (this.gameState.rematchVotes.length >= connectedCount) {
      // Everyone voted — restart
      this.roomState.phase = 'lobby'
      this.gameState = null
      cancelTurnAlarm(this.room)
      this.broadcastLobbyState()
    } else {
      this.broadcastGameState()
    }
  }

  // ─── Leave ───────────────────────────────────────────────

  private handleLeave(conn: Party.Connection) {
    const state = conn.state as ConnectionState | undefined
    if (!state) return

    if (this.roomState.phase === 'lobby') {
      this.roomState.players = this.roomState.players.filter((p) => p.id !== state.playerId)
      this.broadcast({ type: 'playerLeft', playerId: state.playerId })

      if (state.isHost && this.roomState.players.length > 0) {
        this.roomState.players[0].isHost = true
        this.roomState.hostId = this.roomState.players[0].id
      }

      this.broadcastLobbyState()
    } else if (this.gameState) {
      const player = this.gameState.players.find((p) => p.id === state.playerId)
      if (player) {
        player.isConnected = false
        player.isEliminated = true
      }
      this.broadcastGameState()
    }
  }

  // ─── Broadcast Helpers ───────────────────────────────────

  private getLobbyPayload(): LobbyStatePayload {
    return {
      roomCode: this.room.id,
      hostId: this.roomState.hostId,
      players: this.roomState.players,
      settings: this.roomState.settings,
    }
  }

  private broadcastLobbyState() {
    this.broadcast({ type: 'lobbyState', state: this.getLobbyPayload() })
  }

  private broadcastGameState() {
    if (!this.gameState) return

    // Send personalized state to each connection
    for (const conn of this.room.getConnections()) {
      const state = conn.state as ConnectionState | undefined
      if (state) {
        this.sendTo(conn, {
          type: 'gameState',
          state: serializeForPlayer(this.gameState, state.playerId),
        })
      }
    }

    // Check if game is over
    if (this.gameState.phase === 'finished') {
      cancelTurnAlarm(this.room)
      this.broadcast({
        type: 'gameOver',
        winnerId: this.gameState.standings[0],
        standings: this.gameState.standings,
      })
    }
  }

  private broadcastEffectEvents(effects: CardEffect[]) {
    for (const effect of effects) {
      switch (effect.type) {
        case 'reverse':
          this.broadcast({ type: 'directionReversed' })
          break
        case 'skip':
          this.broadcast({ type: 'playerSkipped', playerId: effect.target })
          break
        case 'setColor':
          this.broadcast({ type: 'colorChanged', color: effect.color })
          break
        case 'viewHand': {
          // Only send to the viewer
          const viewerConn = this.findConnection(effect.viewer)
          if (viewerConn && this.gameState) {
            const target = this.gameState.players.find((p) => p.id === effect.target)
            if (target) {
              this.sendTo(viewerConn, {
                type: 'handRevealed',
                targetId: effect.target,
                cards: target.hand,
              })
            }
          }
          break
        }
      }
    }
  }

  private resetTurnTimer() {
    if (!this.gameState) return
    cancelTurnAlarm(this.room)
    if (this.gameState.phase === 'playing' && this.gameState.turnTimeLimit > 0) {
      setTurnAlarm(this.room, this.gameState.turnTimeLimit * 1000)
    }
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg))
  }

  private broadcastExcept(exclude: Party.Connection, msg: ServerMessage) {
    const json = JSON.stringify(msg)
    for (const conn of this.room.getConnections()) {
      if (conn.id !== exclude.id) {
        conn.send(json)
      }
    }
  }

  private sendTo(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg))
  }

  private findConnection(playerId: string): Party.Connection | null {
    for (const conn of this.room.getConnections()) {
      const state = conn.state as ConnectionState | undefined
      if (state?.playerId === playerId) return conn
    }
    return null
  }

  // ─── Matchmaking ─────────────────────────────────────────

  private async notifyMatchmaking(
    action: 'register' | 'update' | 'remove',
  ) {
    if (!this.roomState.settings.isPublic && action !== 'remove') return

    try {
      const matchmaking = this.room.context.parties.matchmaking
      const mmRoom = matchmaking.get('public')

      switch (action) {
        case 'register': {
          const host = this.roomState.players.find((p) => p.isHost)
          await mmRoom.fetch({
            method: 'POST',
            body: JSON.stringify({
              type: 'registerGame',
              game: {
                roomCode: this.room.id,
                hostNickname: host?.nickname || 'Unknown',
                gamemode: this.roomState.settings.gamemode,
                playerCount: this.roomState.players.filter((p) => p.isConnected).length,
                maxPlayers: this.roomState.settings.maxPlayers,
                createdAt: Date.now(),
              },
            }),
          })
          break
        }
        case 'update': {
          await mmRoom.fetch({
            method: 'POST',
            body: JSON.stringify({
              type: 'updateGame',
              roomCode: this.room.id,
              updates: {
                playerCount: this.roomState.players.filter((p) => p.isConnected).length,
              },
            }),
          })
          break
        }
        case 'remove': {
          await mmRoom.fetch({
            method: 'POST',
            body: JSON.stringify({
              type: 'removeGame',
              roomCode: this.room.id,
            }),
          })
          break
        }
      }
    } catch {
      // Matchmaking notifications are best-effort
    }
  }
}
