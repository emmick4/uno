import { useState, useEffect } from 'react'

interface TurnTimerProps {
  turnStartedAt: number
  turnTimeLimit: number
  isMyTurn: boolean
}

export function TurnTimer({ turnStartedAt, turnTimeLimit, isMyTurn }: TurnTimerProps) {
  const [remaining, setRemaining] = useState(turnTimeLimit)

  useEffect(() => {
    if (turnTimeLimit <= 0) return

    const interval = setInterval(() => {
      const elapsed = (Date.now() - turnStartedAt) / 1000
      setRemaining(Math.max(0, turnTimeLimit - elapsed))
    }, 100)

    return () => clearInterval(interval)
  }, [turnStartedAt, turnTimeLimit])

  if (turnTimeLimit <= 0) return null

  const pct = (remaining / turnTimeLimit) * 100
  const isLow = remaining < 10
  const isCritical = remaining < 5

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`text-2xl font-mono font-bold tabular-nums ${
          isCritical
            ? 'text-red-500 animate-pulse'
            : isLow
              ? 'text-yellow-400'
              : isMyTurn
                ? 'text-white'
                : 'text-gray-500'
        }`}
      >
        {Math.ceil(remaining)}s
      </div>
      <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 rounded-full ${
            isCritical ? 'bg-red-500' : isLow ? 'bg-yellow-400' : 'bg-green-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
