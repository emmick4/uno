import type { GamemodePlugin } from '@uno/shared'
import { cardDefinitions, buildDeck } from './deck'
import { canPlay, resolveCardEffect, canStack, canPlayOutOfTurn } from './rules'

export const harryPotterGamemode: GamemodePlugin = {
  id: 'harry-potter',
  name: 'Harry Potter Uno',
  description:
    'Wizarding World edition — Invisibility blocks anything, Howler reveals hands, and Draw 3 raises the stakes.',
  cardBackImage: '/assets/cards/harry-potter/back.png',

  buildDeck,
  canPlay,
  resolveCardEffect,
  canStack,
  canPlayOutOfTurn,

  gamemodeHouseRules: [],
  initialHandSize: 7,
  cardDefinitions,
}
