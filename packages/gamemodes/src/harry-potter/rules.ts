import type { Card, CardColor, CardEffect, GameState, HouseRules } from '@uno/shared'

/** Check if a card can be played on the current discard */
export function canPlay(
  card: Card,
  topDiscard: Card,
  currentColor: CardColor,
  _gameState: GameState,
): boolean {
  // Wilds can always be played (includes invisibility)
  if (card.color === 'wild') return true

  // Match current color
  if (card.color === currentColor) return true

  // Match value
  if (card.value === topDiscard.value) return true

  // Howler can be played on matching color (already covered above)
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

    case 'draw3':
      effects.push({ type: 'draw', target: nextPlayer.id, count: 3 })
      break

    case 'wild':
      // Color chosen by player — handled by engine
      break

    case 'wild-draw4':
      effects.push({ type: 'draw', target: nextPlayer.id, count: 4 })
      break

    case 'invisibility':
      // Blocks the current pending effect
      effects.push({ type: 'block' })
      break

    case 'howler':
      // The player who played it chooses a target to view
      // For now, auto-target the next player. A proper UI would let them pick.
      effects.push({
        type: 'viewHand',
        viewer: gameState.players[gameState.currentPlayerIndex].id,
        target: nextPlayer.id,
      })
      break
  }

  return effects
}

/** Check if a card can be stacked on a pending draw/skip chain */
export function canStack(card: Card, pendingStack: Card[]): boolean {
  if (pendingStack.length === 0) return false
  const lastCard = pendingStack[pendingStack.length - 1]

  // Draw 3 stacks on Draw 3
  if (card.value === 'draw3' && lastCard.value === 'draw3') return true

  // Wild Draw 4 stacks on Draw 3 (escalation)
  if (card.value === 'wild-draw4' && (lastCard.value === 'draw3' || lastCard.value === 'wild-draw4')) return true

  // Invisibility can "stack" to cancel the draw chain
  if (card.value === 'invisibility') return true

  return false
}

/**
 * Invisibility card can be played out of turn to block any card effect.
 * This is the key HP-specific mechanic.
 */
export function canPlayOutOfTurn(
  card: Card,
  _trigger: Card | null,
  _gameState: GameState,
): boolean {
  return card.value === 'invisibility'
}
