import type { Card, CardColor } from './card'
import type { ClientGameState, ClientPlayerState } from './game'
import type { GameSettings, LobbyPlayer } from './lobby'

// ─── Client → Server ─────────────────────────────────────────

export type ClientMessage =
  // Lobby
  | { type: 'join'; nickname: string; playerId?: string }
  | { type: 'updateNickname'; nickname: string }
  | { type: 'updateSettings'; settings: Partial<GameSettings> }
  | { type: 'startGame' }
  | { type: 'kick'; playerId: string }
  // Game
  | { type: 'playCard'; cardId: string; chosenColor?: CardColor }
  | { type: 'playMultiple'; cardIds: string[] }
  | { type: 'drawCard' }
  | { type: 'pass' }
  | { type: 'callUno'; targetPlayerId?: string }
  | { type: 'playOutOfTurn'; cardId: string }
  // Chat
  | { type: 'chat'; text: string }
  // General
  | { type: 'rematch' }
  | { type: 'leave' }

// ─── Server → Client ─────────────────────────────────────────

export type ServerMessage =
  // State sync
  | { type: 'lobbyState'; state: LobbyStatePayload }
  | { type: 'gameState'; state: ClientGameState }
  | { type: 'gameUpdate'; update: GameUpdatePayload }
  // Events (for animations/sounds)
  | { type: 'cardPlayed'; playerId: string; card: Card; nextPlayerId: string }
  | { type: 'cardDrawn'; playerId: string; count: number; cards?: Card[] }
  | { type: 'unoCall'; callerId: string; targetId?: string; penalty: boolean }
  | { type: 'turnStarted'; playerId: string; timeLimit: number }
  | { type: 'directionReversed' }
  | { type: 'playerSkipped'; playerId: string }
  | { type: 'colorChanged'; color: CardColor }
  | { type: 'handRevealed'; targetId: string; cards: Card[] }
  // Lifecycle
  | { type: 'welcome'; playerId: string }
  | { type: 'playerJoined'; player: LobbyPlayer }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'gameStarted' }
  | { type: 'gameOver'; winnerId: string; standings: string[] }
  | { type: 'error'; code: string; message: string }
  // Chat
  | { type: 'chatMessage'; playerId: string; nickname: string; text: string; timestamp: number }

export interface LobbyStatePayload {
  roomCode: string
  hostId: string
  players: LobbyPlayer[]
  settings: GameSettings
}

export interface GameUpdatePayload {
  currentPlayerIndex?: number
  direction?: 1 | -1
  turnStartedAt?: number
  drawPileCount?: number
  topDiscard?: Card
  currentColor?: CardColor
  pendingDrawCount?: number
  pendingSkipCount?: number
  unoCallWindow?: { playerId: string; calledUno: boolean } | null
  players?: Partial<ClientPlayerState>[]
  myHand?: Card[]
  standings?: string[]
  rematchVotes?: string[]
}
