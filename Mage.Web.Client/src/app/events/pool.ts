import type { CardView, SimpleCardView } from '../../protocol/generated/views';
import type { DeckCardInfo } from '../../types/models';
import { entryKey, groupOf } from '../decks/deckModel';

/** Server card summaries carry the card name too (see the bridge's JSON codec). */
export type PoolCard = SimpleCardView & { name?: string };

export function poolEntry(card: PoolCard): DeckCardInfo {
  return { cardName: card.name ?? '', setCode: card.expansionSetCode ?? '', cardNumber: card.cardNumber ?? '', amount: 1 };
}

export function poolKey(card: PoolCard): string {
  return entryKey(poolEntry(card));
}

/** What a card face needs to draw, from a summary plus looked-up details when available. */
export function faceOf(card: PoolCard, info: ReadonlyMap<string, CardView>): CardView {
  return { ...(info.get(poolKey(card)) ?? {}), ...card, name: card.name };
}

/** Cards in columns by mana value (lands in their own column at the end), like a draft deck on the table. */
export function curveColumns(cards: PoolCard[], info: ReadonlyMap<string, CardView>): { label: string; cards: PoolCard[] }[] {
  const columns: PoolCard[][] = Array.from({ length: 9 }, () => []);
  for (const card of cards) {
    const details = info.get(poolKey(card));
    if (details && groupOf(details) === 'lands') columns[8].push(card);
    else columns[Math.min(7, details?.manaValue ?? 0)].push(card);
  }
  return columns
    .map((column, index) => ({ label: index === 8 ? 'Lands' : index === 7 ? '7+' : String(index), cards: column }))
    .filter((column) => column.cards.length > 0);
}
