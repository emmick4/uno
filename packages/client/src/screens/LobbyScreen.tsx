import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router'
import { useGameSocket } from '../hooks/useGameSocket'
import { useGameStore } from '../stores/game-store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PlayerSeat } from '../components/lobby/PlayerSeat'
import { SettingsPanel } from '../components/lobby/SettingsPanel'
import { MAX_PLAYERS } from '@uno/shared'

const TABLE_RX = 50 // horizontal radius (%)
const TABLE_RY = 47 // vertical radius (%)
const CHAIR_OFFSET = 8 // how far chairs sit outside the table edge (%)

/** Seat positions around the table, evenly spaced for the given player count */
function getSeatPositions(count: number): Array<{ x: number; y: number; angle: number }> {
  const positions: Array<{ x: number; y: number; angle: number }> = []
  for (let i = 0; i < count; i++) {
    // Start from bottom center, go clockwise
    const theta = (Math.PI / 2) + (2 * Math.PI * i) / count
    // Place chairs outside the table edge
    const x = 50 + (TABLE_RX + CHAIR_OFFSET) * Math.cos(theta)
    const y = 50 + (TABLE_RY + CHAIR_OFFSET) * Math.sin(theta)
    // Normal to the ellipse surface — this is the direction perpendicular to the table edge
    const normalAngle = Math.atan2(TABLE_RX * Math.sin(theta), TABLE_RY * Math.cos(theta))
    // Chair rotation: faces the table edge (seat toward table, back outward)
    const rotation = (normalAngle * 180 / Math.PI) + 90
    positions.push({ x, y, angle: rotation })
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

  const [rememberHouseRules, setRememberHouseRules] = useLocalStorage('uno-remember-house-rules', false)

  // If host, send initial gamemode + any saved house rules
  useEffect(() => {
    if (!connected || !isHost) return
    const gamemode = localStorage.getItem('uno-gamemode') || 'original'
    const savedRaw = rememberHouseRules ? localStorage.getItem(`uno-house-rules-${gamemode}`) : null
    const savedHouseRules = savedRaw ? JSON.parse(savedRaw) : null
    send({
      type: 'updateSettings',
      settings: savedHouseRules ? { gamemode, houseRules: savedHouseRules } : { gamemode },
    })
  }, [connected, isHost, send, rememberHouseRules])

  const players = lobby?.players || []
  const settings = lobby?.settings
  const seatPositions = getSeatPositions(players.length || 1)
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
          className="text-5xl tracking-[0.5em] bg-gray-800 px-8 py-4 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors"
          style={{ fontFamily: 'UnoHandwritten, sans-serif' }}
        >
          {roomCode}
        </div>
        <div className="text-xs text-gray-600 mt-2">
          {codeCopied ? <span className="text-green-400">Link copied!</span> : 'Click to copy invite link'}
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* Card table with seats */}
        <div className="relative w-[700px] h-[420px]">
          <img
            src="/assets/card-table.svg"
            alt=""
            className="absolute inset-[20px] w-[calc(100%-40px)] h-[calc(100%-40px)] object-contain z-10 pointer-events-none"
          />

          {players.map((player, i) => {
            const pos = seatPositions[i]
            if (!pos) return null
            return (
              <div
                key={player.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-0"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <img
                  src="/assets/chair.svg"
                  alt=""
                  className="w-16 h-12 pointer-events-none"
                  style={{ transform: `rotate(${pos.angle}deg)` }}
                />
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <PlayerSeat
                    player={player}
                    seatIndex={i}
                    isMe={player.id === myPlayerId}
                    isHost={player.isHost || false}
                    onUpdateNickname={(nickname) => send({ type: 'updateNickname', nickname })}
                  />
                </div>
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
          onUpdateSettings={(s) => {
            if (rememberHouseRules && s.houseRules) {
              const gamemode = settings?.gamemode || localStorage.getItem('uno-gamemode') || 'original'
              localStorage.setItem(`uno-house-rules-${gamemode}`, JSON.stringify(s.houseRules))
            }
            send({ type: 'updateSettings', settings: s })
          }}
          rememberHouseRules={rememberHouseRules}
          onToggleRememberHouseRules={() => setRememberHouseRules((v) => !v)}
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
