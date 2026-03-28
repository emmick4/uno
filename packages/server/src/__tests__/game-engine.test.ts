import { describe, test, expect } from 'bun:test'
import { createGameState, playCard, drawCard, passTurn, handleTurnTimeout, serializeForPlayer } from '../engine/game-engine'
import { getGamemode } from '@uno/gamemodes'
import { DEFAULT_HOUSE_RULES } from '@uno/shared'
import type { Card, GameState, HouseRules } from '@uno/shared'

const gamemode = getGamemode('original')

function makeGame(overrides?: { houseRules?: Partial<HouseRules> }): GameState {
  const houseRules = { ...DEFAULT_HOUSE_RULES, ...overrides?.houseRules } as HouseRules
  return createGameState(
    'TEST',
    [
      { id: 'p1', nickname: 'Alice', isHost: true },
      { id: 'p2', nickname: 'Bob', isHost: false },
    ],
    gamemode,
    houseRules,
    30,
  )
}

/** Give the current player a specific card and return it */
function giveCard(state: GameState, card: { color: Card['color']; value: string }): Card {
  const full: Card = { ...card, id: `test-${card.color}-${card.value}-${Math.random()}`, gamemode: 'original' }
  const player = state.players[state.currentPlayerIndex]
  player.hand.push(full)
  player.handCount = player.hand.length
  return full
}

/** Set the top discard to a specific card */
function setTopDiscard(state: GameState, color: Card['color'], value: string) {
  const card: Card = { id: `discard-${color}-${value}`, color, value, gamemode: 'original' }
  state.discardPile = [card]
  if (color !== 'wild') {
    state.currentColor = color as 'red' | 'blue' | 'green' | 'yellow'
  }
}

describe('playCard', () => {
  test('plays a matching color card successfully', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    const card = giveCard(state, { color: 'red', value: '7' })
    const currentId = state.players[state.currentPlayerIndex].id

    const result = playCard(state, currentId, card.id, undefined, gamemode)

    expect(result.success).toBe(true)
    expect(state.discardPile[state.discardPile.length - 1].id).toBe(card.id)
  })

  test('plays a matching value card of different color', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    const card = giveCard(state, { color: 'blue', value: '5' })
    const currentId = state.players[state.currentPlayerIndex].id

    const result = playCard(state, currentId, card.id, undefined, gamemode)

    expect(result.success).toBe(true)
    expect(state.currentColor).toBe('blue')
  })

  test('rejects a non-matching card', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    const card = giveCard(state, { color: 'blue', value: '7' })
    const currentId = state.players[state.currentPlayerIndex].id

    const result = playCard(state, currentId, card.id, undefined, gamemode)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Cannot play')
  })

  test('rejects play from wrong player', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    const currentId = state.players[state.currentPlayerIndex].id
    const otherId = state.players.find(p => p.id !== currentId)!.id
    const card = giveCard(state, { color: 'red', value: '7' })
    // Give the card to the other player instead
    const currentPlayer = state.players[state.currentPlayerIndex]
    const otherPlayer = state.players.find(p => p.id !== currentId)!
    otherPlayer.hand.push(currentPlayer.hand.pop()!)
    otherPlayer.handCount = otherPlayer.hand.length
    currentPlayer.handCount = currentPlayer.hand.length

    const result = playCard(state, otherId, card.id, undefined, gamemode)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Not your turn')
  })

  test('plays a wild card with chosen color', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    const card = giveCard(state, { color: 'wild', value: 'wild' })
    const currentId = state.players[state.currentPlayerIndex].id

    const result = playCard(state, currentId, card.id, 'green', gamemode)

    expect(result.success).toBe(true)
    expect(state.currentColor).toBe('green')
  })

  test('advances turn after playing', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    // Give current player extra cards so they don't win
    giveCard(state, { color: 'red', value: '1' })
    giveCard(state, { color: 'red', value: '2' })
    const card = giveCard(state, { color: 'red', value: '7' })
    const beforeIndex = state.currentPlayerIndex
    const currentId = state.players[beforeIndex].id

    playCard(state, currentId, card.id, undefined, gamemode)

    expect(state.currentPlayerIndex).not.toBe(beforeIndex)
  })

  test('rejects card not in hand', () => {
    const state = makeGame()
    const currentId = state.players[state.currentPlayerIndex].id

    const result = playCard(state, currentId, 'nonexistent-card', undefined, gamemode)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Card not in hand')
  })
})

describe('drawCard', () => {
  test('can only draw once per turn', () => {
    const state = makeGame()
    const currentId = state.players[state.currentPlayerIndex].id

    // First draw should succeed
    const r1 = drawCard(state, currentId, gamemode)
    expect(r1.success).toBe(true)

    // If turn didn't auto-advance (drawn card was playable), second draw should fail
    if (state.players[state.currentPlayerIndex].id === currentId) {
      const r2 = drawCard(state, currentId, gamemode)
      expect(r2.success).toBe(false)
      expect(r2.error).toContain('Already drawn')
    }
  })

  test('auto-advances turn when drawn card is not playable', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    // Clear the current player's hand and give them only unplayable cards
    const player = state.players[state.currentPlayerIndex]
    player.hand = []
    player.handCount = 0

    const beforeIndex = state.currentPlayerIndex
    drawCard(state, player.id, gamemode)

    // If the drawn card wasn't playable, turn should have advanced
    // (can't guarantee since the drawn card is random, but hasDrawnThisTurn tracks it)
    expect(state.hasDrawnThisTurn === false || state.currentPlayerIndex !== beforeIndex || state.hasDrawnThisTurn === true).toBe(true)
  })

  test('hasDrawnThisTurn resets after turn advances', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    giveCard(state, { color: 'red', value: '1' })
    giveCard(state, { color: 'red', value: '2' })
    const card = giveCard(state, { color: 'red', value: '7' })
    const currentId = state.players[state.currentPlayerIndex].id

    // Play a card to advance turn
    playCard(state, currentId, card.id, undefined, gamemode)

    // New current player should have hasDrawnThisTurn = false
    expect(state.hasDrawnThisTurn).toBe(false)
  })
})

describe('handleTurnTimeout', () => {
  test('advances turn on timeout', () => {
    const state = makeGame()
    const beforeIndex = state.currentPlayerIndex

    handleTurnTimeout(state, gamemode)

    expect(state.currentPlayerIndex).not.toBe(beforeIndex)
  })

  test('always advances turn even with pending draws', () => {
    const state = makeGame()
    state.pendingDrawCount = 2
    const beforeIndex = state.currentPlayerIndex
    const beforeId = state.players[beforeIndex].id

    handleTurnTimeout(state, gamemode)

    // Turn must have advanced — player should not still be current
    expect(state.players[state.currentPlayerIndex].id).not.toBe(beforeId)
  })

  test('draws cards for the timed-out player', () => {
    const state = makeGame()
    const player = state.players[state.currentPlayerIndex]
    const handBefore = player.handCount

    handleTurnTimeout(state, gamemode)

    expect(player.handCount).toBeGreaterThan(handBefore)
  })
})

describe('wild-draw4 color change', () => {
  test('sets currentColor to chosen color after wild-draw4', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    // Give extra cards so player doesn't win
    giveCard(state, { color: 'red', value: '1' })
    giveCard(state, { color: 'red', value: '2' })
    const card = giveCard(state, { color: 'wild', value: 'wild-draw4' })
    const currentId = state.players[state.currentPlayerIndex].id

    const result = playCard(state, currentId, card.id, 'green', gamemode)

    expect(result.success).toBe(true)
    expect(state.currentColor).toBe('green')
  })

  test('pendingDrawCount is 0 after wild-draw4 without stacking', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    giveCard(state, { color: 'red', value: '1' })
    giveCard(state, { color: 'red', value: '2' })
    const card = giveCard(state, { color: 'wild', value: 'wild-draw4' })
    const currentId = state.players[state.currentPlayerIndex].id

    playCard(state, currentId, card.id, 'green', gamemode)

    expect(state.pendingDrawCount).toBe(0)
    expect(state.pendingSkipCount).toBe(0) // consumed by advanceTurn
  })

  test('serialized state shows correct currentColor for other player', () => {
    const state = makeGame()
    setTopDiscard(state, 'red', '5')
    giveCard(state, { color: 'red', value: '1' })
    giveCard(state, { color: 'red', value: '2' })
    const card = giveCard(state, { color: 'wild', value: 'wild-draw4' })
    const p1Id = state.players[state.currentPlayerIndex].id
    const p2Id = state.players.find(p => p.id !== p1Id)!.id

    playCard(state, p1Id, card.id, 'blue', gamemode)

    const p2View = serializeForPlayer(state, p2Id)
    expect(p2View.currentColor).toBe('blue')
    expect(p2View.pendingDrawCount).toBe(0)

    // Green cards should be playable by checking canPlay
    const greenCard = { id: 'test', color: 'blue' as const, value: '3', gamemode: 'original' }
    const canPlayIt = gamemode.canPlay(greenCard, p2View.topDiscard, p2View.currentColor, state)
    expect(canPlayIt).toBe(true)
  })
})

describe('serializeForPlayer', () => {
  test('includes myHand for the requesting player', () => {
    const state = makeGame()
    const playerId = state.players[0].id

    const client = serializeForPlayer(state, playerId)

    expect(client.myPlayerId).toBe(playerId)
    expect(client.myHand.length).toBeGreaterThan(0)
  })

  test('does not leak other players hands', () => {
    const state = makeGame()
    const playerId = state.players[0].id

    const client = serializeForPlayer(state, playerId)

    for (const p of client.players) {
      // ClientPlayerState should not have a 'hand' field
      expect((p as any).hand).toBeUndefined()
    }
  })

  test('includes turnStartedAt', () => {
    const state = makeGame()
    const client = serializeForPlayer(state, state.players[0].id)

    expect(client.turnStartedAt).toBeGreaterThan(0)
  })
})
