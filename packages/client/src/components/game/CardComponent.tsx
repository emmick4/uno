import { motion } from 'framer-motion'
import type { Card } from '@uno/shared'

interface CardComponentProps {
  card: Card
  onClick?: () => void
  isPlayable?: boolean
  size?: 'sm' | 'md' | 'lg'
  faceDown?: boolean
  layoutId?: string
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  red: { bg: 'bg-red-600', border: 'border-red-400', text: 'text-white' },
  blue: { bg: 'bg-blue-600', border: 'border-blue-400', text: 'text-white' },
  green: { bg: 'bg-green-600', border: 'border-green-400', text: 'text-white' },
  yellow: { bg: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-black' },
  wild: { bg: 'bg-gray-900', border: 'border-purple-500', text: 'text-white' },
}

const VALUE_DISPLAY: Record<string, string> = {
  skip: '\u{1F6AB}',
  reverse: '\u{1F504}',
  draw2: '+2',
  draw3: '+3',
  wild: 'W',
  'wild-draw4': '+4',
  invisibility: '\u{1F441}',
  howler: '\u{1F4E2}',
}

const SIZE_CLASSES = {
  sm: 'w-12 h-[72px] text-sm rounded',
  md: 'w-16 h-24 text-base rounded-lg',
  lg: 'w-20 h-[120px] text-lg rounded-xl',
}

export function CardComponent({
  card,
  onClick,
  isPlayable = false,
  size = 'md',
  faceDown = false,
  layoutId,
}: CardComponentProps) {
  if (faceDown) {
    return <CardBack size={size} />
  }

  const colors = COLOR_MAP[card.color] || COLOR_MAP.wild
  const display = VALUE_DISPLAY[card.value] || card.value

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${isPlayable ? 'cursor-pointer' : ''}
        ${!isPlayable && onClick ? 'cursor-not-allowed' : ''}
        ${!onClick ? 'cursor-default' : ''}
      `}
    >
      <motion.div
        layoutId={layoutId}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0, y: -50 }}
        whileHover={isPlayable ? { y: -12, scale: 1.05 } : undefined}
        whileTap={isPlayable ? { scale: 0.95 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`
          ${SIZE_CLASSES[size]} ${colors.bg} border-2 ${colors.border} ${colors.text}
          flex flex-col items-center justify-center font-bold
          select-none
          ${isPlayable ? 'shadow-lg hover:shadow-white/20' : ''}
          ${!isPlayable && onClick ? 'opacity-60' : ''}
        `}
      >
        <span className="text-[10px] self-start ml-1">{display}</span>
        <span className={size === 'sm' ? 'text-lg' : 'text-2xl'}>{display}</span>
        <span className="text-[10px] self-end mr-1 rotate-180">{display}</span>
      </motion.div>
    </button>
  )
}

/** Card back component */
export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} bg-gray-700 border-2 border-gray-500 flex items-center justify-center`}
    >
      <div className="w-3/4 h-3/4 rounded border border-gray-600 bg-gradient-to-br from-red-700 via-yellow-600 to-blue-700 flex items-center justify-center">
        <span className="text-white font-black text-xs tracking-tighter">UNO</span>
      </div>
    </div>
  )
}
