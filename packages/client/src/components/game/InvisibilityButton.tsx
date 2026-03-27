import { useGameStore } from '../../stores/game-store'
import type { Card } from '@uno/shared'

interface InvisibilityButtonProps {
  onPlayOutOfTurn: (cardId: string) => void
}

export function InvisibilityButton({ onPlayOutOfTurn }: InvisibilityButtonProps) {
  const game = useGameStore((s) => s.game)
  const myPlayerId = useGameStore((s) => s.myPlayerId)

  if (!game || game.gamemode !== 'harry-potter') return null

  // Only show if it's NOT my turn and I have an Invisibility card
  const isMyTurn = game.players[game.currentPlayerIndex]?.id === myPlayerId
  if (isMyTurn) return null

  const invisibilityCards = game.myHand.filter((c: Card) => c.value === 'invisibility')
  if (invisibilityCards.length === 0) return null

  // Only show if there's something to block (pending effects or a card was just played)
  if (game.pendingDrawCount === 0 && game.pendingSkipCount === 0) return null

  return (
    <button
      onClick={() => onPlayOutOfTurn(invisibilityCards[0].id)}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold animate-pulse shadow-lg shadow-purple-600/50 transition-colors"
    >
      Play Invisibility!
    </button>
  )
}
