import { useState, useRef, useEffect } from 'react'
import type { LobbyPlayer } from '@uno/shared'

interface PlayerSeatProps {
  player: LobbyPlayer | null
  seatIndex: number
  isMe: boolean
  isHost: boolean
  onUpdateNickname?: (nickname: string) => void
}

export function PlayerSeat({ player, isMe, isHost, onUpdateNickname }: PlayerSeatProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (!player) {
    return (
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-gray-800" />
      </div>
    )
  }

  const startEditing = () => {
    if (!isMe || !onUpdateNickname) return
    setDraft(player.nickname)
    setEditing(true)
  }

  const commitEdit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== player.nickname) {
      onUpdateNickname!(trimmed)
      localStorage.setItem('uno-nickname', trimmed)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center text-xl font-bold ${
          isMe
            ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400'
            : player.isConnected
              ? 'border-green-500 bg-green-500/20 text-green-500'
              : 'border-gray-600 bg-gray-600/20 text-gray-600'
        }`}
      >
        {player.nickname.charAt(0).toUpperCase()}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 20))}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="text-xs text-center w-[80px] bg-gray-700 border border-yellow-400 rounded px-1 py-0.5 outline-none"
          maxLength={20}
        />
      ) : (
        <div
          className={`text-xs text-center max-w-[80px] truncate ${isMe ? 'cursor-pointer hover:underline' : ''}`}
          onClick={startEditing}
        >
          {player.nickname}
          {isMe && <span className="text-yellow-400"> (you)</span>}
        </div>
      )}
      {isHost && (
        <div className="text-[10px] text-yellow-500 uppercase tracking-wider">Host</div>
      )}
    </div>
  )
}
