import type { GamemodePlugin } from '@uno/shared'
import { cardDefinitions, buildDeck } from './deck'
import { canPlay, resolveCardEffect, canStack, canPlayOutOfTurn } from './rules'

export const originalGamemode: GamemodePlugin = {
  id: 'original',
  name: 'Original Uno',
  description: 'The classic card game — match colors and numbers, be the first to empty your hand.',
  cardBackImage: '/assets/cards/original/back.png',

  buildDeck,
  canPlay,
  resolveCardEffect,
  canStack,
  canPlayOutOfTurn,

  gamemodeHouseRules: [],
  initialHandSize: 7,
  cardDefinitions: cardDefinitions,
}
