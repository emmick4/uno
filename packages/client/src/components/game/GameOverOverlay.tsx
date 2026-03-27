import { motion } from 'framer-motion'
import type { ClientPlayerState } from '@uno/shared'

interface GameOverOverlayProps {
  standings: string[]
  players: ClientPlayerState[]
  onRematch: () => void
  onLeave: () => void
  rematchVotes: number
  totalPlayers: number
}

export function GameOverOverlay({
  standings,
  players,
  onRematch,
  onLeave,
  rematchVotes,
  totalPlayers,
}: GameOverOverlayProps) {
  const getPlayer = (id: string) => players.find((p) => p.id === id)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
    >
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
      >
        <h2 className="text-3xl font-bold text-center mb-6">Game Over!</h2>

        <div className="space-y-3 mb-8">
          {standings.map((playerId, i) => {
            const player = getPlayer(playerId)
            const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}']
            return (
              <div
                key={playerId}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  i === 0 ? 'bg-yellow-600/20 border border-yellow-600/50' : 'bg-gray-700/50'
                }`}
              >
                <span className="text-2xl">{medals[i] || `${i + 1}.`}</span>
                <span className="font-semibold flex-1">{player?.nickname || 'Unknown'}</span>
              </div>
            )
          })}

          {/* Show remaining players who didn't finish */}
          {players
            .filter((p) => !standings.includes(p.id))
            .map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-700/30 text-gray-500">
                <span className="text-2xl">-</span>
                <span className="flex-1">{p.nickname}</span>
                <span className="text-xs">{p.handCount} cards left</span>
              </div>
            ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onLeave}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
          >
            Leave
          </button>
          <button
            onClick={onRematch}
            className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
          >
            Rematch ({rematchVotes}/{totalPlayers})
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
