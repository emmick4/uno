import type {
  Card,
  CardColor,
  CardEffect,
  ClientGameState,
  ClientPlayerState,
  GameState,
  HouseRules,
  PlayerState,
  GamemodePlugin,
} from '@uno/shared'
import { INITIAL_HAND_SIZE, UNO_CALL_WINDOW_MS } from '@uno/shared'
import { shuffle, drawCards } from './deck-manager'

/** Create initial game state from lobby settings */
export function createGameState(
  roomCode: string,
  players: Array<{ id: string; nickname: string; isHost: boolean }>,
  gamemode: GamemodePlugin,
  houseRules: HouseRules,
  turnTimeLimit: number,
  previousWinnerId?: string,
): GameState {
  const numDecks = (houseRules.numberOfDecks as 1 | 2 | 3) || 1
  let deck = shuffle(gamemode.buildDeck(numDecks))

  // Add cards from house rules that inject additional cards
  // (handled via additionalCards on HouseRuleDefinition — future expansion)

  const handSize = gamemode.initialHandSize || INITIAL_HAND_SIZE
  const playerStates: PlayerState[] = []

  // Deal cards to each player
  for (const p of players) {
    const { drawn, drawPile } = drawCards(handSize, deck, [])
    deck = drawPile
    playerStates.push({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      isConnected: true,
      hand: drawn,
      handCount: drawn.length,
      hasCalledUno: false,
      turnSkipped: false,
      isEliminated: false,
      finishPosition: null,
    })
  }

  // Flip first discard card — skip wilds, put them back and draw again
  let topDiscard: Card
  while (true) {
    const result = drawCards(1, deck, [])
    deck = result.drawPile
    topDiscard = result.drawn[0]
    if (topDiscard.color !== 'wild') break
    // Put wild back and reshuffle
    deck = shuffle([...deck, topDiscard])
  }

  // Determine starting player
  let startingPlayer = Math.floor(Math.random() * playerStates.length)
  if (houseRules.winnerGoesFirst && previousWinnerId) {
    const winnerIdx = playerStates.findIndex((p) => p.id === previousWinnerId)
    if (winnerIdx !== -1) startingPlayer = winnerIdx
  }

  const state: GameState = {
    roomCode,
    phase: 'playing',
    gamemode: gamemode.id,
    players: playerStates,
    currentPlayerIndex: startingPlayer,
    direction: 1,
    turnStartedAt: Date.now(),
    turnTimeLimit,
    drawPile: deck,
    drawPileCount: deck.length,
    discardPile: [topDiscard],
    currentColor: topDiscard.color as CardColor,
    pendingDrawCount: 0,
    pendingSkipCount: 0,
    unoCallWindow: null,
    houseRules,
    standings: [],
    rematchVotes: [],
  }

  // Apply first discard card effects
  applyFirstDiscardEffect(state, topDiscard, gamemode)

  return state
}

/** Apply the effect of the first discard card */
function applyFirstDiscardEffect(
  state: GameState,
  card: Card,
  gamemode: GamemodePlugin,
): void {
  const effects = gamemode.resolveCardEffect(card, state, state.houseRules)
  for (const effect of effects) {
    switch (effect.type) {
      case 'skip': {
        // Skip the first player
        advanceTurn(state)
        break
      }
      case 'reverse': {
        state.direction = -1 as 1 | -1
        if (state.players.length === 2) {
          // In 2-player, reverse acts as skip
          advanceTurn(state)
        }
        break
      }
      case 'draw': {
        // First player draws
        const player = state.players[state.currentPlayerIndex]
        const result = drawCards(effect.count, state.drawPile, state.discardPile)
        player.hand.push(...result.drawn)
        player.handCount = player.hand.length
        state.drawPile = result.drawPile
        state.discardPile = result.discardPile
        state.drawPileCount = state.drawPile.length
        break
      }
    }
  }
  state.turnStartedAt = Date.now()
}

/** Play a card from a player's hand */
export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  chosenColor: CardColor | undefined,
  gamemode: GamemodePlugin,
): { success: boolean; error?: string; effects: CardEffect[] } {
  const playerIndex = state.players.findIndex((p) => p.id === playerId)
  if (playerIndex === -1) return { success: false, error: 'Player not found', effects: [] }
  if (playerIndex !== state.currentPlayerIndex) {
    return { success: false, error: 'Not your turn', effects: [] }
  }

  const player = state.players[playerIndex]
  const cardIndex = player.hand.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return { success: false, error: 'Card not in hand', effects: [] }

  const card = player.hand[cardIndex]
  const topDiscard = state.discardPile[state.discardPile.length - 1]

  // If there's a pending draw, player must either stack or draw
  if (state.pendingDrawCount > 0) {
    if (state.houseRules.stackableDraws && gamemode.canStack(card, state.discardPile.slice(-5))) {
      // Stacking — allowed, continue below
    } else {
      return { success: false, error: 'You must draw cards or stack', effects: [] }
    }
  }

  // Validate the play
  if (!gamemode.canPlay(card, topDiscard, state.currentColor, state)) {
    return { success: false, error: 'Cannot play this card', effects: [] }
  }

  // Remove card from hand
  player.hand.splice(cardIndex, 1)
  player.handCount = player.hand.length

  // Add to discard pile
  state.discardPile.push(card)

  // Set color (for wilds, use chosen color)
  if (card.color === 'wild' && chosenColor) {
    state.currentColor = chosenColor
  } else {
    state.currentColor = card.color
  }

  // Resolve effects
  const effects = gamemode.resolveCardEffect(card, state, state.houseRules)
  applyEffects(state, effects)

  // Check for UNO call window
  if (player.handCount === 1) {
    state.unoCallWindow = {
      playerId: player.id,
      calledUno: false,
      windowExpiresAt: Date.now() + UNO_CALL_WINDOW_MS,
    }
  } else {
    if (state.unoCallWindow?.playerId === player.id) {
      state.unoCallWindow = null
    }
  }

  // Check win condition
  if (player.handCount === 0) {
    return handlePlayerWin(state, player, effects)
  }

  // Advance turn
  advanceTurn(state)
  state.turnStartedAt = Date.now()

  return { success: true, effects }
}

/** Play multiple cards of the same number at once (house rule) */
export function playMultipleCards(
  state: GameState,
  playerId: string,
  cardIds: string[],
  gamemode: GamemodePlugin,
): { success: boolean; error?: string; effects: CardEffect[] } {
  if (!state.houseRules.playMultipleSameNumber) {
    return { success: false, error: 'House rule not enabled', effects: [] }
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId)
  if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) {
    return { success: false, error: 'Not your turn', effects: [] }
  }

  const player = state.players[playerIndex]
  const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)).filter(Boolean) as Card[]

  if (cards.length !== cardIds.length) {
    return { success: false, error: 'Cards not in hand', effects: [] }
  }

  // All cards must have the same value
  const value = cards[0].value
  if (!cards.every((c) => c.value === value)) {
    return { success: false, error: 'All cards must have the same number', effects: [] }
  }

  // First card must be playable
  const topDiscard = state.discardPile[state.discardPile.length - 1]
  if (!gamemode.canPlay(cards[0], topDiscard, state.currentColor, state)) {
    return { success: false, error: 'Cannot play this card', effects: [] }
  }

  // Remove all cards from hand, add to discard
  for (const card of cards) {
    const idx = player.hand.findIndex((c) => c.id === card.id)
    if (idx !== -1) player.hand.splice(idx, 1)
    state.discardPile.push(card)
  }
  player.handCount = player.hand.length

  // Set color from last played card
  const lastCard = cards[cards.length - 1]
  state.currentColor = lastCard.color === 'wild' ? state.currentColor : lastCard.color

  // Resolve effects for the last card played
  const effects = gamemode.resolveCardEffect(lastCard, state, state.houseRules)
  applyEffects(state, effects)

  if (player.handCount === 1) {
    state.unoCallWindow = {
      playerId: player.id,
      calledUno: false,
      windowExpiresAt: Date.now() + UNO_CALL_WINDOW_MS,
    }
  }

  if (player.handCount === 0) {
    return handlePlayerWin(state, player, effects)
  }

  advanceTurn(state)
  state.turnStartedAt = Date.now()
  return { success: true, effects }
}

/** Draw a card for the current player */
export function drawCard(
  state: GameState,
  playerId: string,
  gamemode: GamemodePlugin,
): { success: boolean; error?: string; drawnCards: Card[]; canPlay: boolean } {
  const playerIndex = state.players.findIndex((p) => p.id === playerId)
  if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) {
    return { success: false, error: 'Not your turn', drawnCards: [], canPlay: false }
  }

  const player = state.players[playerIndex]

  // mustPlayIfAble: prevent drawing if the player has a playable card
  if (state.houseRules.mustPlayIfAble && state.pendingDrawCount === 0) {
    const topDiscard = state.discardPile[state.discardPile.length - 1]
    const hasPlayable = player.hand.some((c) =>
      gamemode.canPlay(c, topDiscard, state.currentColor, state),
    )
    if (hasPlayable) {
      return { success: false, error: 'You must play a card if able', drawnCards: [], canPlay: false }
    }
  }

  // If there's a pending draw count (from stacking), draw that many
  const drawCount = state.pendingDrawCount > 0 ? state.pendingDrawCount : 1
  state.pendingDrawCount = 0

  const allDrawn: Card[] = []

  if (state.houseRules.drawUntilCanPlay && drawCount === 1) {
    // Keep drawing until we find a playable card
    let found = false
    for (let i = 0; i < 50; i++) { // safety limit
      const result = drawCards(1, state.drawPile, state.discardPile)
      if (result.drawn.length === 0) break
      state.drawPile = result.drawPile
      state.discardPile = result.discardPile
      allDrawn.push(...result.drawn)
      const topDiscard = state.discardPile[state.discardPile.length - 1]
      if (gamemode.canPlay(result.drawn[0], topDiscard, state.currentColor, state)) {
        found = true
        break
      }
    }

    player.hand.push(...allDrawn)
    player.handCount = player.hand.length
    state.drawPileCount = state.drawPile.length

    if (state.houseRules.playDrawnCardImmediately && found) {
      // The last drawn card can be played — but we let the client decide
      return { success: true, drawnCards: allDrawn, canPlay: true }
    }

    // Turn ends after drawing
    if (state.houseRules.drawsSkipTurn || drawCount > 1) {
      advanceTurn(state)
      state.turnStartedAt = Date.now()
    }

    return { success: true, drawnCards: allDrawn, canPlay: false }
  }

  // Standard draw
  const result = drawCards(drawCount, state.drawPile, state.discardPile)
  state.drawPile = result.drawPile
  state.discardPile = result.discardPile
  allDrawn.push(...result.drawn)

  player.hand.push(...allDrawn)
  player.handCount = player.hand.length
  state.drawPileCount = state.drawPile.length

  // Check if drawn card is playable (only for single draw)
  let canPlayDrawn = false
  if (drawCount === 1 && allDrawn.length === 1) {
    const topDiscard = state.discardPile[state.discardPile.length - 1]
    canPlayDrawn = gamemode.canPlay(allDrawn[0], topDiscard, state.currentColor, state)
  }

  // If draws skip turn, or this was a penalty draw, advance
  if (state.houseRules.drawsSkipTurn || drawCount > 1) {
    advanceTurn(state)
    state.turnStartedAt = Date.now()
    return { success: true, drawnCards: allDrawn, canPlay: false }
  }

  // Clear UNO window for this player if they drew
  if (state.unoCallWindow?.playerId === player.id) {
    state.unoCallWindow = null
  }

  return { success: true, drawnCards: allDrawn, canPlay: canPlayDrawn }
}

/** Pass turn (after drawing, decline to play) */
export function passTurn(
  state: GameState,
  playerId: string,
): { success: boolean; error?: string } {
  const playerIndex = state.players.findIndex((p) => p.id === playerId)
  if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) {
    return { success: false, error: 'Not your turn' }
  }

  advanceTurn(state)
  state.turnStartedAt = Date.now()
  return { success: true }
}

/** Handle UNO call — either self-call or catching another player */
export function callUno(
  state: GameState,
  callerId: string,
  targetPlayerId?: string,
): { success: boolean; penalty: boolean; penaltyPlayerId?: string; error?: string } {
  if (!state.unoCallWindow) {
    return { success: false, penalty: false, error: 'No UNO call window active' }
  }

  const window = state.unoCallWindow

  if (targetPlayerId) {
    // Catching another player
    if (targetPlayerId !== window.playerId) {
      return { success: false, penalty: false, error: 'That player is not at UNO' }
    }
    if (window.calledUno) {
      return { success: false, penalty: false, error: 'Player already called UNO' }
    }
    if (Date.now() > window.windowExpiresAt) {
      state.unoCallWindow = null
      return { success: false, penalty: false, error: 'UNO call window expired' }
    }

    // Penalty! Target player draws
    const penaltyCount = state.houseRules.unoMissPenalty || 2
    const target = state.players.find((p) => p.id === targetPlayerId)
    if (!target) return { success: false, penalty: false, error: 'Player not found' }

    const result = drawCards(penaltyCount, state.drawPile, state.discardPile)
    target.hand.push(...result.drawn)
    target.handCount = target.hand.length
    state.drawPile = result.drawPile
    state.discardPile = result.discardPile
    state.drawPileCount = state.drawPile.length
    state.unoCallWindow = null

    return { success: true, penalty: true, penaltyPlayerId: targetPlayerId }
  } else {
    // Self-call
    if (callerId !== window.playerId) {
      return { success: false, penalty: false, error: 'You are not at UNO' }
    }
    window.calledUno = true
    state.players.find((p) => p.id === callerId)!.hasCalledUno = true
    return { success: true, penalty: false }
  }
}

/** Play a card out of turn (e.g., Invisibility in HP mode) */
export function playOutOfTurn(
  state: GameState,
  playerId: string,
  cardId: string,
  gamemode: GamemodePlugin,
): { success: boolean; error?: string; effects: CardEffect[] } {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return { success: false, error: 'Player not found', effects: [] }

  const cardIndex = player.hand.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return { success: false, error: 'Card not in hand', effects: [] }

  const card = player.hand[cardIndex]
  const trigger = state.discardPile[state.discardPile.length - 1]

  if (!gamemode.canPlayOutOfTurn(card, trigger, state)) {
    return { success: false, error: 'Cannot play this card out of turn', effects: [] }
  }

  // Remove from hand
  player.hand.splice(cardIndex, 1)
  player.handCount = player.hand.length

  // Resolve effects
  const effects = gamemode.resolveCardEffect(card, state, state.houseRules)
  applyEffects(state, effects)

  // Check UNO / win
  if (player.handCount === 1) {
    state.unoCallWindow = {
      playerId: player.id,
      calledUno: false,
      windowExpiresAt: Date.now() + UNO_CALL_WINDOW_MS,
    }
  }

  if (player.handCount === 0) {
    return handlePlayerWin(state, player, effects)
  }

  return { success: true, effects }
}

/** Handle turn timeout — auto-draw or auto-pass */
export function handleTurnTimeout(
  state: GameState,
  gamemode: GamemodePlugin,
): { drawnCards: Card[] } {
  const player = state.players[state.currentPlayerIndex]

  // If pending draws, force draw
  if (state.pendingDrawCount > 0) {
    const result = drawCard(state, player.id, gamemode)
    return { drawnCards: result.drawnCards }
  }

  // Auto-draw one card, then pass
  const result = drawCards(1, state.drawPile, state.discardPile)
  player.hand.push(...result.drawn)
  player.handCount = player.hand.length
  state.drawPile = result.drawPile
  state.discardPile = result.discardPile
  state.drawPileCount = state.drawPile.length

  advanceTurn(state)
  state.turnStartedAt = Date.now()

  return { drawnCards: result.drawn }
}

// ─── Helpers ───────────────────────────────────────────────

function applyEffects(state: GameState, effects: CardEffect[]): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'skip': {
        if (state.houseRules.stackableSkips) {
          state.pendingSkipCount++
        } else {
          // Mark the next player will be skipped (handled in advanceTurn)
          state.pendingSkipCount = 1
        }
        break
      }
      case 'reverse': {
        state.direction = (state.direction * -1) as 1 | -1
        // In 2-player, reverse acts as skip
        if (state.players.length === 2 || state.houseRules.reverseSkipsIn1v1) {
          if (getActivePlayers(state).length === 2) {
            state.pendingSkipCount = 1
          }
        }
        // reverseAppliesEffects: reverse also forces next player to draw
        if (state.houseRules.reverseAppliesEffects) {
          const nextIdx =
            (state.currentPlayerIndex + state.direction + state.players.length) %
            state.players.length
          const nextPlayer = state.players[nextIdx]
          if (nextPlayer && !nextPlayer.isEliminated) {
            if (state.houseRules.stackableDraws) {
              state.pendingDrawCount += 3
            } else {
              const result = drawCards(3, state.drawPile, state.discardPile)
              nextPlayer.hand.push(...result.drawn)
              nextPlayer.handCount = nextPlayer.hand.length
              state.drawPile = result.drawPile
              state.discardPile = result.discardPile
              state.drawPileCount = state.drawPile.length
            }
          }
        }
        break
      }
      case 'draw': {
        if (state.houseRules.stackableDraws) {
          state.pendingDrawCount += effect.count
        } else {
          // Immediate draw for target
          const target = state.players.find((p) => p.id === effect.target)
          if (target) {
            const result = drawCards(effect.count, state.drawPile, state.discardPile)
            target.hand.push(...result.drawn)
            target.handCount = target.hand.length
            state.drawPile = result.drawPile
            state.discardPile = result.discardPile
            state.drawPileCount = state.drawPile.length
          }
          state.pendingSkipCount = 1 // Draw cards also skip
        }
        break
      }
      case 'setColor': {
        state.currentColor = effect.color
        break
      }
      case 'block': {
        // Cancel pending effects
        state.pendingDrawCount = 0
        state.pendingSkipCount = 0
        break
      }
      case 'viewHand': {
        // Handled at the message layer — server sends hand to viewer
        break
      }
      case 'switchHands': {
        const initiator = state.players.find((p) => p.id === effect.initiator)
        const target = state.players.find((p) => p.id === effect.target)
        if (initiator && target) {
          const tempHand = initiator.hand
          initiator.hand = target.hand
          target.hand = tempHand
          initiator.handCount = initiator.hand.length
          target.handCount = target.hand.length
        }
        break
      }
    }
  }
}

function advanceTurn(state: GameState): void {
  const active = getActivePlayers(state)
  if (active.length <= 1) return

  // unoCallRequired: auto-penalize if player at UNO didn't call
  if (state.houseRules.unoCallRequired && state.unoCallWindow) {
    const window = state.unoCallWindow
    if (!window.calledUno && Date.now() <= window.windowExpiresAt) {
      const target = state.players.find((p) => p.id === window.playerId)
      if (target) {
        const penaltyCount = (state.houseRules.unoMissPenalty as number) || 2
        const result = drawCards(penaltyCount, state.drawPile, state.discardPile)
        target.hand.push(...result.drawn)
        target.handCount = target.hand.length
        state.drawPile = result.drawPile
        state.discardPile = result.discardPile
        state.drawPileCount = state.drawPile.length
      }
    }
    state.unoCallWindow = null
  }

  // Apply pending skips
  let skips = state.pendingSkipCount || 0
  state.pendingSkipCount = 0

  do {
    state.currentPlayerIndex =
      (state.currentPlayerIndex + state.direction + state.players.length) % state.players.length

    // Skip eliminated players
    const current = state.players[state.currentPlayerIndex]
    if (current.isEliminated) continue

    if (skips > 0) {
      current.turnSkipped = true
      // skipsApplyEffects: skipped player draws a card
      if (state.houseRules.skipsApplyEffects) {
        const result = drawCards(1, state.drawPile, state.discardPile)
        current.hand.push(...result.drawn)
        current.handCount = current.hand.length
        state.drawPile = result.drawPile
        state.discardPile = result.discardPile
        state.drawPileCount = state.drawPile.length
      }
      skips--
      continue
    }

    break
  } while (true)

  // Reset turnSkipped for next player
  state.players[state.currentPlayerIndex].turnSkipped = false

  // Reset UNO call state for current player
  state.players[state.currentPlayerIndex].hasCalledUno = false
}

function getActivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.isEliminated)
}

function handlePlayerWin(
  state: GameState,
  player: PlayerState,
  effects: CardEffect[],
): { success: boolean; effects: CardEffect[] } {
  state.standings.push(player.id)

  if (state.houseRules.continueAfterWinner) {
    player.isEliminated = true
    player.finishPosition = state.standings.length

    const remaining = getActivePlayers(state)
    if (remaining.length <= 1) {
      // Last player standing
      if (remaining.length === 1) {
        remaining[0].finishPosition = state.standings.length + 1
        state.standings.push(remaining[0].id)
      }
      state.phase = 'finished'
    } else {
      advanceTurn(state)
      state.turnStartedAt = Date.now()
    }
  } else {
    player.finishPosition = 1
    state.phase = 'finished'
  }

  return { success: true, effects }
}

/** Serialize game state for a specific player (hide other players' hands) */
export function serializeForPlayer(state: GameState, playerId: string): ClientGameState {
  const myPlayer = state.players.find((p) => p.id === playerId)

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    gamemode: state.gamemode,
    myPlayerId: playerId,
    myHand: myPlayer?.hand || [],
    players: state.players.map(
      (p): ClientPlayerState => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isConnected: p.isConnected,
        handCount: p.handCount,
        hasCalledUno: p.hasCalledUno,
        turnSkipped: p.turnSkipped,
        isEliminated: p.isEliminated,
        finishPosition: p.finishPosition,
      }),
    ),
    currentPlayerIndex: state.currentPlayerIndex,
    direction: state.direction,
    turnStartedAt: state.turnStartedAt,
    turnTimeLimit: state.turnTimeLimit,
    drawPileCount: state.drawPileCount,
    topDiscard: state.discardPile[state.discardPile.length - 1],
    currentColor: state.currentColor,
    pendingDrawCount: state.pendingDrawCount,
    pendingSkipCount: state.pendingSkipCount,
    unoCallWindow: state.unoCallWindow
      ? { playerId: state.unoCallWindow.playerId, calledUno: state.unoCallWindow.calledUno }
      : null,
    houseRules: state.houseRules,
    standings: state.standings,
    rematchVotes: state.rematchVotes,
  }
}
