import { AnimatePresence, motion } from 'framer-motion'
import type { Card, CardColor } from '@uno/shared'
import { CardComponent } from './CardComponent'

interface DiscardPileProps {
  topCard: Card
  currentColor: CardColor
}

const COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  wild: '#a855f7',
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
          className="rounded-xl"
          style={{ boxShadow: `0 0 0 4px ${COLOR_HEX[currentColor] || '#6b7280'}` }}
        >
          <CardComponent card={topCard} size="lg" />
        </motion.div>
      </AnimatePresence>
      <div className="text-xs text-gray-500 uppercase tracking-wider">Discard</div>
    </div>
  )
}
