import type { CardColor } from '@uno/shared'

interface ColorPickerProps {
  onPick: (color: CardColor) => void
  onCancel: () => void
}

const COLORS: Array<{ color: CardColor; bg: string; label: string }> = [
  { color: 'red', bg: 'bg-red-600 hover:bg-red-500', label: 'Red' },
  { color: 'blue', bg: 'bg-blue-600 hover:bg-blue-500', label: 'Blue' },
  { color: 'green', bg: 'bg-green-600 hover:bg-green-500', label: 'Green' },
  { color: 'yellow', bg: 'bg-yellow-500 hover:bg-yellow-400', label: 'Yellow' },
]

export function ColorPicker({ onPick, onCancel }: ColorPickerProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center font-semibold mb-4">Choose a color</h3>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map(({ color, bg, label }) => (
            <button
              key={color}
              onClick={() => onPick(color)}
              className={`${bg} w-24 h-24 rounded-xl font-bold text-lg transition-all hover:scale-105`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full py-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
