import type { Card, CardColor, CardDefinition } from './card'
import type { GameState } from './game'
import type { HouseRuleDefinition, HouseRules } from './house-rules'

/** Every gamemode plugin implements this interface */
export interface GamemodePlugin {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Short description for the carousel */
  description: string
  /** Path to card back image asset */
  cardBackImage: string

  /** Build a fresh deck (respecting number-of-decks house rule) */
  buildDeck(numDecks: number): Card[]

  /** Validate whether a card can be played on the current discard */
  canPlay(
    card: Card,
    topDiscard: Card,
    currentColor: CardColor,
    gameState: GameState,
  ): boolean

  /** Resolve the effect of a played card */
  resolveCardEffect(card: Card, gameState: GameState, houseRules: HouseRules): CardEffect[]

  /** Check if a stackable response is valid (e.g., Draw 2 on Draw 2) */
  canStack(card: Card, pendingStack: Card[]): boolean

  /** Can this card be played out of turn? (e.g., Invisibility) */
  canPlayOutOfTurn(card: Card, trigger: Card | null, gameState: GameState): boolean

  /** Gamemode-specific house rules */
  gamemodeHouseRules: HouseRuleDefinition[]

  /** Initial hand size (default 7) */
  initialHandSize: number

  /** All card definitions for this gamemode (used by house rules that add cards) */
  cardDefinitions: CardDefinition[]
}

/** Returned by resolveCardEffect to describe what happens */
export type CardEffect =
  | { type: 'skip'; target: string }
  | { type: 'reverse' }
  | { type: 'draw'; target: string; count: number }
  | { type: 'setColor'; color: CardColor }
  | { type: 'viewHand'; viewer: string; target: string }
  | { type: 'block' }
  | { type: 'switchHands'; initiator: string; target: string }
  | { type: 'custom'; key: string; data: unknown }
