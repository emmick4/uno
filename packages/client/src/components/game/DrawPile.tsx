import { CardBack } from './CardComponent'

interface DrawPileProps {
  count: number
  onClick: () => void
  isMyTurn: boolean
}

export function DrawPile({ count, onClick, isMyTurn }: DrawPileProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        disabled={!isMyTurn}
        className={`relative transition-transform ${
          isMyTurn ? 'hover:scale-105 cursor-pointer' : 'cursor-default'
        }`}
      >
        <CardBack size="lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-black/60 px-2 py-1 rounded text-xs font-mono">{count}</span>
        </div>
      </button>
      <div className="text-xs text-gray-500 uppercase tracking-wider">Draw</div>
    </div>
  )
}
