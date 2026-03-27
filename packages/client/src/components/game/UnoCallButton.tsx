interface UnoCallButtonProps {
  onCallUno: () => void
  show: boolean
}

export function UnoCallButton({ onCallUno, show }: UnoCallButtonProps) {
  if (!show) return null

  return (
    <button
      onClick={onCallUno}
      className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-full font-black text-xl tracking-wider animate-bounce shadow-lg shadow-red-600/50 transition-colors"
    >
      UNO!
    </button>
  )
}
