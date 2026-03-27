/** Every card in the game has a unique instance ID */
export interface Card {
  /** Unique instance ID (e.g., "red-7-0", "wild-draw4-2") */
  id: string
  /** Card color — "wild" for colorless cards */
  color: CardColor
  /** Card value — number or action name, defined by the gamemode */
  value: string
  /** Which gamemode defines this card */
  gamemode: string
}

export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild'

/** A card definition used to build decks (no instance ID yet) */
export interface CardDefinition {
  color: CardColor
  value: string
  /** How many copies of this card per deck */
  count: number
}

/** Card as seen by opponents — just the back */
export interface HiddenCard {
  id: string
}
