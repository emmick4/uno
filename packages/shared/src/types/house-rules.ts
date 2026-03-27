import type { CardDefinition } from './card'

/** All house rules — universal ones that apply across gamemodes */
export interface HouseRules {
  stackableDraws: boolean
  reverseSkipsIn1v1: boolean
  reverseAppliesEffects: boolean
  stackableSkips: boolean
  skipsApplyEffects: boolean
  winnerGoesFirst: boolean
  numberOfDecks: 1 | 2 | 3
  drawsSkipTurn: boolean
  drawUntilCanPlay: boolean
  playDrawnCardImmediately: boolean
  playMultipleSameNumber: boolean
  mustPlayIfAble: boolean
  unoMissPenalty: number
  unoCallRequired: boolean
  continueAfterWinner: boolean
  /** Extensible — gamemode-specific rules keyed by id */
  [key: string]: boolean | number
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
  stackableDraws: false,
  reverseSkipsIn1v1: false,
  reverseAppliesEffects: false,
  stackableSkips: false,
  skipsApplyEffects: false,
  winnerGoesFirst: false,
  numberOfDecks: 1,
  drawsSkipTurn: false,
  drawUntilCanPlay: false,
  playDrawnCardImmediately: false,
  playMultipleSameNumber: false,
  mustPlayIfAble: false,
  unoMissPenalty: 2,
  unoCallRequired: false,
  continueAfterWinner: false,
}

/** Definition of a house rule for UI rendering and deck building */
export interface HouseRuleDefinition {
  id: string
  label: string
  description: string
  type: 'boolean' | 'number'
  default: boolean | number
  min?: number
  max?: number
  /** If this rule adds cards to the deck when enabled */
  additionalCards?: CardDefinition[]
  /** Which gamemodes this rule applies to — undefined means universal */
  gamemodes?: string[]
}

/** All available house rule definitions (universal) */
export const UNIVERSAL_HOUSE_RULES: HouseRuleDefinition[] = [
  {
    id: 'stackableDraws',
    label: 'Stackable Draws',
    description: 'Chain draw cards to pass the penalty to the next player',
    type: 'boolean',
    default: false,
  },
  {
    id: 'reverseSkipsIn1v1',
    label: 'Reverse Skips in 1v1',
    description: 'Reverse acts as a skip when only 2 players remain',
    type: 'boolean',
    default: false,
  },
  {
    id: 'reverseAppliesEffects',
    label: 'Reverse Applies Effects',
    description: 'Reverse cards also apply a draw penalty',
    type: 'boolean',
    default: false,
  },
  {
    id: 'stackableSkips',
    label: 'Stackable Skips',
    description: 'Chain skip cards to skip multiple players',
    type: 'boolean',
    default: false,
  },
  {
    id: 'skipsApplyEffects',
    label: 'Skips Apply Effects',
    description: 'Skip cards also apply additional effects',
    type: 'boolean',
    default: false,
  },
  {
    id: 'winnerGoesFirst',
    label: 'Winner Goes First',
    description: 'The winner of the previous game goes first in the next',
    type: 'boolean',
    default: false,
  },
  {
    id: 'numberOfDecks',
    label: 'Number of Decks',
    description: 'How many decks to shuffle together',
    type: 'number',
    default: 1,
    min: 1,
    max: 3,
  },
  {
    id: 'drawsSkipTurn',
    label: 'Draws Skip Turn',
    description: "Drawing a card ends your turn — you can't play the drawn card",
    type: 'boolean',
    default: false,
  },
  {
    id: 'drawUntilCanPlay',
    label: 'Draw Until You Can Play',
    description: 'Keep drawing until you get a playable card',
    type: 'boolean',
    default: false,
  },
  {
    id: 'playDrawnCardImmediately',
    label: 'Play Drawn Card Immediately',
    description: 'If the card you draw is playable, you must play it',
    type: 'boolean',
    default: false,
  },
  {
    id: 'playMultipleSameNumber',
    label: 'Play Multiple Same Number',
    description: 'Play all cards of the same number at once',
    type: 'boolean',
    default: false,
  },
  {
    id: 'mustPlayIfAble',
    label: 'Must Play If Able',
    description: 'You must play a card if you have a valid one',
    type: 'boolean',
    default: false,
  },
  {
    id: 'unoMissPenalty',
    label: 'UNO Miss Penalty',
    description: 'Cards to draw when caught not calling UNO',
    type: 'number',
    default: 2,
    min: 1,
    max: 6,
  },
  {
    id: 'unoCallRequired',
    label: 'UNO Call Required',
    description: 'Players must call UNO when they have one card left',
    type: 'boolean',
    default: false,
  },
  {
    id: 'continueAfterWinner',
    label: 'Play for Places',
    description: 'Game continues after first winner to determine 2nd, 3rd, etc.',
    type: 'boolean',
    default: false,
  },
]
