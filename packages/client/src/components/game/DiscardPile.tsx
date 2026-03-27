import { AnimatePresence, motion } from 'framer-motion'
import type { Card, CardColor } from '@uno/shared'
import { CardComponent } from './CardComponent'

interface DiscardPileProps {
  topCard: Card
  currentColor: CardColor
}

const COLOR_RING: Record<string, string> = {
  red: 'ring-red-500',
  blue: 'ring-blue-500',
  green: 'ring-green-500',
  yellow: 'ring-yellow-500',
  wild: 'ring-purple-500',
}

export function DiscardPile({ topCard, currentColor }: DiscardPileProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={topCard.id}
          initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={`ring-4 ${COLOR_RING[currentColor] || 'ring-gray-500'} rounded-xl transition-shadow`}
        >
          <CardComponent card={topCard} size="lg" />
        </motion.div>
      </AnimatePresence>
      <div className="text-xs text-gray-500 uppercase tracking-wider">Discard</div>
    </div>
  )
}
