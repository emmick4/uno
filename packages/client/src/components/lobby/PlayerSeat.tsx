import type { LobbyPlayer } from '@uno/shared'

interface PlayerSeatProps {
  player: LobbyPlayer | null
  seatIndex: number
  isMe: boolean
  isHost: boolean
}

export function PlayerSeat({ player, isMe, isHost }: PlayerSeatProps) {
  if (!player) {
    return (
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-gray-800" />
      </div>
    )
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
      <div className="text-xs text-center max-w-[80px] truncate">
        {player.nickname}
        {isMe && <span className="text-yellow-400"> (you)</span>}
      </div>
      {isHost && (
        <div className="text-[10px] text-yellow-500 uppercase tracking-wider">Host</div>
      )}
    </div>
  )
}
