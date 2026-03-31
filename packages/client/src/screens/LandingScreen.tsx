import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from '@uno/shared'
import { PublicGames } from '../components/landing/PublicGames'

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return code
}

export function LandingScreen() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('uno-nickname') || '',
  )
  const [selectedGamemode, setSelectedGamemode] = useState('original')

  const handleCreate = () => {
    if (!nickname.trim()) return
    localStorage.setItem('uno-nickname', nickname)
    localStorage.setItem('uno-gamemode', selectedGamemode)
    const roomCode = generateRoomCode()
    navigate(`/lobby/${roomCode}?host=1`)
  }

  const handleJoin = () => {
    if (!nickname.trim() || !joinCode.trim()) return
    localStorage.setItem('uno-nickname', nickname)
    navigate(`/lobby/${joinCode.toUpperCase()}`)
  }

  const gamemodes = [
    { id: 'original', name: 'Original', card: '/assets/cards/landing-original.svg', available: true },
    { id: 'harry-potter', name: 'Harry Potter', card: '/assets/cards/landing-harrypotter.svg', available: true },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1 className="text-6xl font-bold tracking-tight">
        <span className="text-red-500">U</span>
        <span className="text-yellow-400">N</span>
        <span className="text-green-500">O</span>
      </h1>
      <p className="text-lg text-gray-400">Online Multiplayer Card Game</p>

      {/* Gamemode Carousel */}
      <div className="flex gap-6 my-8">
        {gamemodes.map((gm) => (
          <button
            key={gm.id}
            onClick={() => gm.available && setSelectedGamemode(gm.id)}
            className={`w-48 h-72 cursor-pointer transition-all duration-200 ${
              selectedGamemode === gm.id ? 'scale-105 hover:scale-110' : 'hover:scale-105'
            } ${!gm.available ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <img
              src={gm.card}
              alt={gm.name}
              className="w-full h-full object-contain"
            />
            {!gm.available && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-gray-400">
                Coming Soon
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Nickname + Actions */}
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <input
          type="text"
          placeholder="Your nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-center text-lg focus:outline-none focus:border-white"
        />

        <button
          onClick={handleCreate}
          disabled={!nickname.trim()}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
        >
          Create Game
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={5}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-center uppercase tracking-widest focus:outline-none focus:border-white"
          />
          <button
            onClick={handleJoin}
            disabled={!nickname.trim() || !joinCode.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            Join
          </button>
        </div>
      </div>

      {/* Public Games */}
      <PublicGames />

      {/* How to Play */}
      <details className="w-full max-w-2xl mt-8">
        <summary className="cursor-pointer text-gray-400 hover:text-white transition-colors text-lg font-semibold">
          How to Play
        </summary>
        <div className="mt-4 p-6 bg-gray-800/50 rounded-xl text-gray-300 space-y-3">
          <p>
            <strong>Goal:</strong> Be the first player to get rid of all your cards.
          </p>
          <p>
            <strong>Setup:</strong> Each player receives 7 cards. The remaining deck is placed in
            the middle and a single card is flipped to start the discard pile. If the first card is
            an action card, its effect applies to the first player.
          </p>
          <p>
            <strong>Gameplay:</strong> On your turn, play a card that matches the color or number
            of the top discard card. You can also play a Wild card on any color. If you can&#39;t
            play, draw one card — if it&#39;s playable, you may play it immediately.
          </p>
          <p>
            <strong>UNO!</strong> When you have one card left, call UNO! If you forget and
            another player catches you, you draw penalty cards. You don&#39;t have to call UNO to
            win — the game ends the moment a player plays their last card.
          </p>
        </div>
      </details>
    </div>
  )
}
