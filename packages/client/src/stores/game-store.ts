import { create } from 'zustand'
import type { Card, ClientGameState, LobbyStatePayload, ServerMessage } from '@uno/shared'

interface GameStore {
  // Connection
  connected: boolean
  myPlayerId: string | null

  // Lobby state
  lobby: LobbyStatePayload | null

  // Game state
  game: ClientGameState | null
  gameStarted: boolean

  // Chat
  chatMessages: Array<{ playerId: string; nickname: string; text: string; timestamp: number }>

  // Revealed hand (from Howler card)
  revealedHand: { targetId: string; cards: Card[] } | null

  // Actions
  setConnected: (connected: boolean) => void
  setMyPlayerId: (id: string) => void
  handleServerMessage: (msg: ServerMessage) => void
  clearRevealedHand: () => void
  reset: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  myPlayerId: null,
  lobby: null,
  game: null,
  gameStarted: false,
  chatMessages: [],
  revealedHand: null,

  setConnected: (connected) => set({ connected }),
  setMyPlayerId: (id) => set({ myPlayerId: id }),
  clearRevealedHand: () => set({ revealedHand: null }),

  handleServerMessage: (msg) => {
    switch (msg.type) {
      case 'welcome':
        set({ myPlayerId: msg.playerId })
        break
      case 'lobbyState':
        // If we get lobbyState after a game, it's a rematch — clear game state
        set((state) => ({
          lobby: msg.state,
          game: state.game?.phase === 'finished' ? null : state.game,
          gameStarted: false,
          chatMessages: [],
          revealedHand: null,
        }))
        break
      case 'gameState':
        set({ game: msg.state })
        break
      case 'gameStarted':
        set({ gameStarted: true })
        break
      case 'chatMessage':
        set((state) => ({
          chatMessages: [
            ...state.chatMessages.slice(-99),
            {
              playerId: msg.playerId,
              nickname: msg.nickname,
              text: msg.text,
              timestamp: msg.timestamp,
            },
          ],
        }))
        break
      case 'handRevealed':
        set({ revealedHand: { targetId: msg.targetId, cards: msg.cards } })
        break
      case 'error':
        console.error(`Server error [${msg.code}]: ${msg.message}`)
        break
    }
  },

  reset: () =>
    set({
      connected: false,
      myPlayerId: null,
      lobby: null,
      game: null,
      gameStarted: false,
      chatMessages: [],
      revealedHand: null,
    }),
}))
