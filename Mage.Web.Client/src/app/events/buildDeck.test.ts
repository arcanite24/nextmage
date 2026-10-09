import { describe, expect, it } from 'vitest';
import { countBasics, initialMain, toDeckLists } from './buildDeck';
import type { PoolCard } from './pool';

let next = 0;
const card = (name: string): PoolCard => ({ id: `id-${next++}`, name, expansionSetCode: 'M10', cardNumber: name });
const many = (name: string, amount: number) => Array.from({ length: amount }, () => card(name));
const byId = (cards: PoolCard[]) => Object.fromEntries(cards.map((entry) => [entry.id!, entry]));
const total = (list: { amount: number }[]) => list.reduce((sum, entry) => sum + entry.amount, 0);

describe('sideboarding a constructed deck', () => {
  // 38 spells and 22 basics in the deck, 5 cards in the sideboard
  const main = [...many('Hill Giant', 38), ...many('Forest', 8), ...many('Island', 8), ...many('Mountain', 6)];
  const side = many('Naturalize', 5);
  const deck = { cards: byId(main), sideboard: byId(side) };
  const pool = [...main, ...side];

  it('starts with the whole deck, basic lands included, and the sideboard in the pool', () => {
    const chosen = initialMain(deck, false);
    expect(chosen.size).toBe(60);
    const wire = toDeckLists(pool, chosen, null);
    expect(total(wire.cards)).toBe(60);
    expect(wire.cards.find((entry) => entry.cardName === 'Forest')?.amount).toBe(8);
    expect(total(wire.sideboard)).toBe(5);
  });

  it('drops nothing the player did not move', () => {
    const chosen = initialMain(deck, false);
    chosen.delete(main[0].id!);
    chosen.add(side[0].id!);
    const wire = toDeckLists(pool, chosen, null);
    expect(total(wire.cards)).toBe(60);
    expect(total(wire.cards) + total(wire.sideboard)).toBe(65);
  });
});

describe('building a limited deck', () => {
  it('keeps the basics as counters, outside the pool', () => {
    const spells = many('Grizzly Bears', 23);
    const lands = many('Forest', 17);
    const deck = { cards: byId([...spells, ...lands]) };
    const chosen = initialMain(deck, true);
    expect(chosen.size).toBe(23);
    const basics = countBasics(lands);
    expect(basics.Forest).toBe(17);
    const wire = toDeckLists([...spells, ...lands], chosen, basics);
    expect(total(wire.cards)).toBe(40);
    expect(wire.sideboard).toEqual([]);
  });
});
