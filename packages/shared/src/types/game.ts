import type { Card, CardColor } from './card'
import type { HouseRules } from './house-rules'

export type GamePhase = 'lobby' | 'playing' | 'finished'

/** Full server-side game state */
export interface GameState {
  roomCode: string
  phase: GamePhase
  gamemode: string

  players: PlayerState[]

  currentPlayerIndex: number
  direction: 1 | -1
  turnStartedAt: number
  turnTimeLimit: number

  drawPile: Card[]
  drawPileCount: number
  discardPile: Card[]
  currentColor: CardColor

  pendingDrawCount: number
  pendingSkipCount: number

  unoCallWindow: {
    playerId: string
    calledUno: boolean
    windowExpiresAt: number
  } | null

  /** True if the current player has already drawn this turn */
  hasDrawnThisTurn: boolean

  houseRules: HouseRules
  standings: string[]
  rematchVotes: string[]
}

export interface PlayerState {
  id: string
  nickname: string
  isHost: boolean
  isConnected: boolean
  hand: Card[]
  handCount: number
  hasCalledUno: boolean
  turnSkipped: boolean
  isEliminated: boolean
  finishPosition: number | null
}

/** Sent to a specific client — their personalized view */
export interface ClientGameState {
  roomCode: string
  phase: GamePhase
  gamemode: string
  myPlayerId: string
  myHand: Card[]

  players: ClientPlayerState[]
  currentPlayerIndex: number
  direction: 1 | -1
  turnStartedAt: number
  turnTimeLimit: number

  drawPileCount: number
  topDiscard: Card
  currentColor: CardColor

  pendingDrawCount: number
  pendingSkipCount: number

  unoCallWindow: { playerId: string; calledUno: boolean } | null
  hasDrawnThisTurn: boolean
  houseRules: HouseRules
  standings: string[]
  rematchVotes: string[]
}

export interface ClientPlayerState {
  id: string
  nickname: string
  isHost: boolean
  isConnected: boolean
  handCount: number
  hasCalledUno: boolean
  turnSkipped: boolean
  isEliminated: boolean
  finishPosition: number | null
}
