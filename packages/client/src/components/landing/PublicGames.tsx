import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'

interface PublicGame {
  roomCode: string
  hostNickname: string
  gamemode: string
  playerCount: number
  maxPlayers: number
}

const WS_HOST = import.meta.env.VITE_WS_HOST || 'localhost:1999'

export function PublicGames() {
  const [games, setGames] = useState<PublicGame[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const fetchGames = async () => {
    setLoading(true)
    try {
      const protocol = WS_HOST.includes('localhost') ? 'http' : 'https'
      const res = await fetch(`${protocol}://${WS_HOST}/api/public-games`)
      const data = await res.json()
      setGames(data.games || [])
    } catch {
      setGames([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGames()
    const interval = setInterval(fetchGames, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleJoin = (roomCode: string) => {
    const nickname = localStorage.getItem('uno-nickname')
    if (!nickname) return
    navigate(`/lobby/${roomCode}`)
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Public Games
        </h3>
        <button
          onClick={fetchGames}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <div className="space-y-2">
        {games.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">
            {loading ? 'Looking for public games...' : 'No public games available'}
          </p>
        )}
        {games.map((game) => (
          <div
            key={game.roomCode}
            className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700"
          >
            <div>
              <div className="text-sm font-medium">
                {game.hostNickname}&apos;s game
              </div>
              <div className="text-xs text-gray-500">
                {game.gamemode.replace('-', ' ')} &middot; {game.playerCount}/{game.maxPlayers} players
              </div>
            </div>
            <button
              onClick={() => handleJoin(game.roomCode)}
              disabled={game.playerCount >= game.maxPlayers}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
            >
              {game.playerCount >= game.maxPlayers ? 'Full' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
