import type { HouseRules } from './house-rules'

export interface LobbyState {
  roomCode: string
  hostId: string
  players: LobbyPlayer[]
  settings: GameSettings
}

export interface LobbyPlayer {
  id: string
  nickname: string
  isHost: boolean
  isConnected: boolean
  seatIndex: number
}

export interface GameSettings {
  gamemode: string
  isPublic: boolean
  turnTimeLimit: number
  maxPlayers: number
  houseRules: HouseRules
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  gamemode: 'original',
  isPublic: true,
  turnTimeLimit: 30,
  maxPlayers: 10,
  houseRules: {
    stackableDraws: false,
    reverseSkipsIn1v1: false,
    reverseAppliesEffects: false,
    stackableSkips: false,
    skipsApplyEffects: false,
    winnerGoesFirst: false,
    numberOfDecks: 1,
    drawsSkipTurn: false,
    drawUntilCanPlay: false,
    playDrawnCardImmediately: false,
    playMultipleSameNumber: false,
    mustPlayIfAble: false,
    unoMissPenalty: 2,
    unoCallRequired: false,
    continueAfterWinner: false,
  },
}
