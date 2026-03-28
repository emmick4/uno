import { useState, useCallback } from 'react'
import type { Card, CardColor } from '@uno/shared'
import { CardComponent } from './CardComponent'
import { ColorPicker } from './ColorPicker'
import { useGameStore } from '../../stores/game-store'

interface PlayerHandProps {
  cards: Card[]
  isMyTurn: boolean
  topDiscard: Card
  currentColor: CardColor
  pendingDrawCount: number
  hasDrawnThisTurn: boolean
  onPlayCard: (cardId: string, chosenColor?: CardColor) => void
  onDrawCard: () => void
  onPass: () => void
}

function canPlayCard(
  card: Card,
  topDiscard: Card,
  currentColor: CardColor,
  pendingDrawCount: number,
  houseRules: { stackableDraws: boolean },
): boolean {
  // If there's a pending draw and stacking is enabled, only draw cards can be played
  if (pendingDrawCount > 0) {
    if (!houseRules.stackableDraws) return false
    if (card.value === 'draw2' && topDiscard.value === 'draw2') return true
    if (card.value === 'wild-draw4') return true
    if (card.value === 'draw3' && topDiscard.value === 'draw3') return true
    return false
  }

  if (card.color === 'wild') return true
  if (card.color === currentColor) return true
  if (card.value === topDiscard.value) return true
  return false
}

export function PlayerHand({
  cards,
  isMyTurn,
  topDiscard,
  currentColor,
  pendingDrawCount,
  hasDrawnThisTurn,
  onPlayCard,
  onDrawCard,
  onPass,
}: PlayerHandProps) {
  const [colorPickerCard, setColorPickerCard] = useState<string | null>(null)
  const houseRules = useGameStore((s) => s.game?.houseRules)

  const handleCardClick = useCallback(
    (card: Card) => {
      if (!isMyTurn) return

      // If it's a wild card, show color picker
      if (card.color === 'wild') {
        setColorPickerCard(card.id)
        return
      }

      onPlayCard(card.id)
    },
    [isMyTurn, onPlayCard],
  )

  const handleColorPick = useCallback(
    (color: CardColor) => {
      if (colorPickerCard) {
        onPlayCard(colorPickerCard, color)
        setColorPickerCard(null)
      }
    },
    [colorPickerCard, onPlayCard],
  )

  const handleDraw = useCallback(() => {
    onDrawCard()
  }, [onDrawCard])

  const handlePass = useCallback(() => {
    onPass()
  }, [onPass])

  // Sort cards by color then value for display
  const sortedCards = [...cards].sort((a, b) => {
    const colorOrder = ['red', 'yellow', 'green', 'blue', 'wild']
    const ci = colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color)
    if (ci !== 0) return ci
    return a.value.localeCompare(b.value)
  })

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Action buttons */}
      {isMyTurn && (
        <div className="flex gap-2">
          {!hasDrawnThisTurn && (
            <button
              onClick={handleDraw}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              {pendingDrawCount > 0 ? `Draw ${pendingDrawCount}` : 'Draw Card'}
            </button>
          )}
          {hasDrawnThisTurn && (
            <button
              onClick={handlePass}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm font-medium transition-colors"
            >
              Pass
            </button>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="flex gap-1 flex-wrap justify-center max-w-[900px]">
        {sortedCards.map((card) => {
          const playable =
            isMyTurn &&
            canPlayCard(card, topDiscard, currentColor, pendingDrawCount, {
              stackableDraws: houseRules?.stackableDraws ?? false,
            })

          return (
            <CardComponent
              key={card.id}
              card={card}
              onClick={playable ? () => handleCardClick(card) : undefined}
              isPlayable={playable}
              size="md"
            />
          )
        })}
      </div>

      {/* Color picker modal */}
      {colorPickerCard && (
        <ColorPicker
          onPick={handleColorPick}
          onCancel={() => setColorPickerCard(null)}
        />
      )}
    </div>
  )
}
