import type { DeckView } from '../../protocol/generated/views';
import { poolEntry, poolKey, type PoolCard } from './pool';

/** Deck building for events: what the deck starts as, and the lists sent to the server. */

export const BASICS = [
  { name: 'Plains', symbol: 'w', color: 'white' },
  { name: 'Island', symbol: 'u', color: 'blue' },
  { name: 'Swamp', symbol: 'b', color: 'black' },
  { name: 'Mountain', symbol: 'r', color: 'red' },
  { name: 'Forest', symbol: 'g', color: 'green' },
] as const;

export type BasicName = (typeof BASICS)[number]['name'];

export function isBasic(card: PoolCard | undefined): boolean {
  return !!card?.name && BASICS.some((basic) => basic.name === card.name);
}

export function countBasics(cards: PoolCard[]): Record<BasicName, number> {
  const counts = { Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 } as Record<BasicName, number>;
  for (const card of cards) if (isBasic(card)) counts[card.name as BasicName]++;
  return counts;
}

/**
 * The cards that start in the deck: everything the deck had. Limited counts its basic lands separately (any number
 * can be added), so they start as counters instead; a constructed deck keeps its own basics like any other card.
 */
export function initialMain(deck: Pick<DeckView, 'cards'>, limited: boolean): Set<string> {
  const cards = deck.cards ?? {};
  return new Set(Object.keys(cards).filter((id) => !limited || !isBasic(cards[id] as PoolCard)));
}

/** The deck as the server expects it: chosen cards in the main deck, the rest of the pool in the sideboard. */
export function toDeckLists(pool: PoolCard[], main: ReadonlySet<string>, basics: Record<BasicName, number> | null) {
  const count = (cards: PoolCard[]) => {
    const map = new Map<string, { cardName: string; setCode: string; cardNumber: string; amount: number }>();
    for (const card of cards) {
      const entry = poolEntry(card);
      const key = poolKey(card);
      const existing = map.get(key);
      if (existing) existing.amount++;
      else map.set(key, { cardName: entry.cardName, setCode: entry.setCode ?? '', cardNumber: entry.cardNumber ?? '', amount: 1 });
    }
    return [...map.values()];
  };
  const cards = count(pool.filter((card) => main.has(card.id!)));
  const sideboard = count(pool.filter((card) => !main.has(card.id!) && !(basics && isBasic(card))));
  if (basics) {
    for (const basic of BASICS) {
      if (basics[basic.name] > 0) cards.push({ cardName: basic.name, setCode: '', cardNumber: '', amount: basics[basic.name] });
    }
  }
  return { name: 'Event deck', cards, sideboard };
}
