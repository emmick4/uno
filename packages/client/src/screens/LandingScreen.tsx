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
      <img src="/assets/uno-title.svg" alt="UNO!" className="h-24" />

      {/* Gamemode Carousel */}
      <div className="flex gap-6 my-8">
        {gamemodes.map((gm) => (
          <button
            key={gm.id}
            onClick={() => gm.available && setSelectedGamemode(gm.id)}
            className={`w-48 h-72 cursor-pointer transition-all duration-200 hover:scale-105 ${
              selectedGamemode === gm.id ? 'scale-105' : ''
            } ${!gm.available ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <img
              src={gm.card}
              alt={gm.name}
              className="w-full h-full"
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
        <div className="relative">
          <input
            type="text"
            placeholder=""
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="w-full px-4 py-3 bg-transparent border-b border-gray-600 text-white text-center text-lg focus:outline-none focus:border-white"
            style={{ fontFamily: 'UnoHandwritten, sans-serif' }}
          />
          {!nickname && (
            <img
              src="/assets/nickname.svg"
              alt="Nickname"
              className="absolute inset-0 m-auto h-6 pointer-events-none"
            />
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={!nickname.trim()}
          className="disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 cursor-pointer"
        >
          <img src="/assets/create-game.svg" alt="Create Game" className="w-full h-14 rounded-lg" />
        </button>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder=""
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={5}
              className="w-full px-4 py-3 bg-transparent border-b border-gray-600 text-white text-center uppercase tracking-widest focus:outline-none focus:border-white"
              style={{ fontFamily: 'UnoHandwritten, sans-serif' }}
            />
            {!joinCode && (
              <img
                src="/assets/room-code.svg"
                alt="Room code"
                className="absolute inset-0 m-auto h-7 pointer-events-none"
              />
            )}
          </div>
          <button
            onClick={handleJoin}
            disabled={!nickname.trim() || !joinCode.trim()}
            className="px-4 py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 cursor-pointer"
          >
            <img src="/assets/join.svg" alt="Join" className="h-7" />
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
