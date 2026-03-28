import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router'
import { useGameSocket } from '../hooks/useGameSocket'
import { useGameStore } from '../stores/game-store'
import { PlayerSeat } from '../components/lobby/PlayerSeat'
import { SettingsPanel } from '../components/lobby/SettingsPanel'
import { MAX_PLAYERS } from '@uno/shared'

/** Seat positions around an oval (in %, relative to container) */
function getSeatPositions(count: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < count; i++) {
    // Start from bottom center, go clockwise
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / count
    const x = 50 + 45 * Math.cos(angle)
    const y = 50 + 42 * Math.sin(angle)
    positions.push({ x, y })
  }
  return positions
}

export function LobbyScreen() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isHost = searchParams.get('host') === '1'
  const { send } = useGameSocket(roomCode)
  const lobby = useGameStore((s) => s.lobby)
  const connected = useGameStore((s) => s.connected)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const gameStarted = useGameStore((s) => s.gameStarted)

  // Navigate to game screen when game starts
  useEffect(() => {
    if (gameStarted && roomCode) {
      navigate(`/game/${roomCode}`)
    }
  }, [gameStarted, roomCode, navigate])

  // Send join message when connected
  useEffect(() => {
    if (!connected) return
    const nickname = localStorage.getItem('uno-nickname') || 'Player'
    const storedPlayerId = sessionStorage.getItem(`uno-player-${roomCode}`) || undefined
    send({ type: 'join', nickname, playerId: storedPlayerId })
  }, [connected, send])

  // If host, send initial gamemode setting
  useEffect(() => {
    if (!connected || !isHost) return
    const gamemode = localStorage.getItem('uno-gamemode') || 'original'
    send({ type: 'updateSettings', settings: { gamemode } })
  }, [connected, isHost, send])

  const players = lobby?.players || []
  const settings = lobby?.settings
  const seatPositions = getSeatPositions(settings?.maxPlayers || MAX_PLAYERS)
  const amHost = lobby?.hostId === myPlayerId

  const handleStart = () => {
    send({ type: 'startGame' })
  }

  const [codeCopied, setCodeCopied] = useState(false)

  const handleCopyLink = () => {
    const url = `${window.location.origin}/lobby/${roomCode}`
    navigator.clipboard.writeText(url).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  const handleLeave = () => {
    send({ type: 'leave' })
    useGameStore.getState().reset()
    navigate('/')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      {/* Connection status */}
      {!connected && (
        <div className="text-yellow-400 text-sm animate-pulse">Connecting...</div>
      )}

      {/* Room code */}
      <div className="text-center">
        <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Room Code</div>
        <div
          onClick={handleCopyLink}
          className="text-5xl font-mono tracking-[0.5em] bg-gray-800 px-8 py-4 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors"
        >
          {roomCode}
        </div>
        <div className="text-xs text-gray-600 mt-2">
          {codeCopied ? <span className="text-green-400">Link copied!</span> : 'Click to copy invite link'}
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* Oval table with seats */}
        <div className="relative w-[700px] h-[420px]">
          <div className="absolute inset-[40px] bg-green-900/30 rounded-[50%] border-2 border-green-700/50" />

          {seatPositions.map((pos, i) => {
            const player = players.find((p) => p.seatIndex === i)
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <PlayerSeat
                  player={player || null}
                  seatIndex={i}
                  isMe={player?.id === myPlayerId}
                  isHost={player?.isHost || false}
                  onUpdateNickname={(nickname) => send({ type: 'updateNickname', nickname })}
                />
              </div>
            )
          })}

          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-gray-500 text-sm">
              {players.length} / {settings?.maxPlayers || MAX_PLAYERS} players
            </div>
          </div>
        </div>

        {/* Settings panel */}
        <SettingsPanel
          settings={settings || null}
          isHost={amHost}
          onUpdateSettings={(s) => send({ type: 'updateSettings', settings: s })}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleLeave}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
        >
          Leave
        </button>
        {amHost && (
          <button
            onClick={handleStart}
            disabled={players.length < 2}
            className="px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
          >
            Start Game
          </button>
        )}
        {!amHost && (
          <div className="px-8 py-3 text-gray-500 text-lg">
            Waiting for host to start...
          </div>
        )}
      </div>
    </div>
  )
}
