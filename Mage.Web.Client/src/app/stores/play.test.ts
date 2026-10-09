// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { goldfishDeck } from './play';

describe('goldfishDeck', () => {
  test('is only lands, so the goldfish never casts anything', () => {
    const deck = goldfishDeck(false);
    expect(deck.cards).toEqual([{ cardName: 'Plains', amount: 60 }]);
    expect(deck.sideboard).toEqual([]);
  });

  test('has a commander for a commander game, with a hundred cards in all', () => {
    const deck = goldfishDeck(true);
    const total = [...deck.cards, ...deck.sideboard].reduce((sum, card) => sum + card.amount, 0);
    expect(total).toBe(100);
    expect(deck.sideboard).toHaveLength(1);
  });
});
