import { motion } from 'framer-motion'
import type { Card } from '@uno/shared'
import { CardComponent } from './CardComponent'
import { useGameStore } from '../../stores/game-store'

export function HandRevealOverlay() {
  const revealedHand = useGameStore((s) => s.revealedHand)
  const clearRevealedHand = useGameStore((s) => s.clearRevealedHand)
  const players = useGameStore((s) => s.game?.players)

  if (!revealedHand) return null

  const targetPlayer = players?.find((p) => p.id === revealedHand.targetId)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={clearRevealedHand}
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-gray-800 rounded-2xl p-6 max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-center mb-1">Howler!</h3>
        <p className="text-gray-400 text-sm text-center mb-4">
          {targetPlayer?.nickname || 'Player'}&apos;s hand:
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          {revealedHand.cards.map((card: Card) => (
            <CardComponent key={card.id} card={card} size="md" />
          ))}
        </div>
        <button
          onClick={clearRevealedHand}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}
