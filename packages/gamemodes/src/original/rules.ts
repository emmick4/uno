import type { Card, CardColor, CardEffect, GameState, HouseRules } from '@uno/shared'

/** Check if a card can be played on the current discard */
export function canPlay(
  card: Card,
  topDiscard: Card,
  currentColor: CardColor,
  _gameState: GameState,
): boolean {
  // Wilds can always be played
  if (card.color === 'wild') return true

  // Match current color (which may differ from top discard if a wild was played)
  if (card.color === currentColor) return true

  // Match value (number or action)
  if (card.value === topDiscard.value) return true

  return false
}

/** Resolve the effects of playing a card */
export function resolveCardEffect(
  card: Card,
  gameState: GameState,
  _houseRules: HouseRules,
): CardEffect[] {
  const effects: CardEffect[] = []
  const nextPlayerIndex =
    (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) %
    gameState.players.length
  const nextPlayer = gameState.players[nextPlayerIndex]

  switch (card.value) {
    case 'skip':
      effects.push({ type: 'skip', target: nextPlayer.id })
      break

    case 'reverse':
      effects.push({ type: 'reverse' })
      break

    case 'draw2':
      effects.push({ type: 'draw', target: nextPlayer.id, count: 2 })
      break

    case 'wild':
      // Color is set via chosenColor in the message — handled by engine
      break

    case 'wild-draw4':
      effects.push({ type: 'draw', target: nextPlayer.id, count: 4 })
      break
  }

  return effects
}

/** Check if a card can be stacked on a pending draw/skip chain */
export function canStack(card: Card, pendingStack: Card[]): boolean {
  if (pendingStack.length === 0) return false
  const lastCard = pendingStack[pendingStack.length - 1]

  // Draw 2 can stack on Draw 2
  if (card.value === 'draw2' && lastCard.value === 'draw2') return true

  // Wild Draw 4 can stack on Wild Draw 4
  if (card.value === 'wild-draw4' && lastCard.value === 'wild-draw4') return true

  // Wild Draw 4 can also stack on Draw 2 (escalation)
  if (card.value === 'wild-draw4' && lastCard.value === 'draw2') return true

  return false
}

/** Original Uno has no out-of-turn plays */
export function canPlayOutOfTurn(
  _card: Card,
  _trigger: Card | null,
  _gameState: GameState,
): boolean {
  return false
}
