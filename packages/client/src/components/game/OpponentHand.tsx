import { CardBack } from './CardComponent'

interface OpponentHandProps {
  nickname: string
  cardCount: number
  isCurrentTurn: boolean
  hasCalledUno: boolean
  isConnected: boolean
  isEliminated: boolean
  finishPosition: number | null
  onCallUno?: () => void
}

export function OpponentHand({
  nickname,
  cardCount,
  isCurrentTurn,
  hasCalledUno,
  isConnected,
  isEliminated,
  finishPosition,
  onCallUno,
}: OpponentHandProps) {
  return (
    <div className={`flex flex-col items-center gap-1 ${isEliminated ? 'opacity-40' : ''}`}>
      {/* Nickname */}
      <div
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isCurrentTurn
            ? 'bg-yellow-400/20 text-yellow-400 animate-pulse'
            : isConnected
              ? 'text-gray-300'
              : 'text-gray-600'
        }`}
      >
        {nickname}
        {finishPosition && <span className="ml-1">#{finishPosition}</span>}
      </div>

      {/* Card fan */}
      <div className="flex" style={{ marginLeft: Math.min(cardCount, 10) * 4 }}>
        {Array.from({ length: Math.min(cardCount, 10) }).map((_, i) => (
          <div
            key={i}
            className="transition-transform"
            style={{
              marginLeft: i === 0 ? 0 : -8,
              transform: `rotate(${(i - Math.min(cardCount, 10) / 2) * 3}deg)`,
            }}
          >
            <CardBack size="sm" />
          </div>
        ))}
      </div>

      {/* Card count + UNO status */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">{cardCount} cards</span>
        {cardCount === 1 && !hasCalledUno && onCallUno && (
          <button
            onClick={onCallUno}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-[10px] font-bold animate-bounce"
          >
            CATCH!
          </button>
        )}
        {hasCalledUno && (
          <span className="text-red-400 font-bold text-[10px]">UNO!</span>
        )}
      </div>
    </div>
  )
}
