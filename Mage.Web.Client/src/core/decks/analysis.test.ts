import { describe, expect, it } from 'vitest';
import { cardsSeen, costPips, deckStats, drawOdds, expandDeck, landTarget, shuffle, suggestLands, type AnalysisCard, type AnalysisEntry } from './analysis';

const CARDS: Record<string, AnalysisCard> = {
  'Lightning Bolt': { cardTypes: ['INSTANT'], manaValue: 1, manaCostLeftStr: ['{R}'] },
  Counterspell: { cardTypes: ['INSTANT'], manaValue: 2, manaCostLeftStr: ['{U}', '{U}'] },
  'Boros Charm': { cardTypes: ['INSTANT'], manaValue: 2, manaCostLeftStr: ['{R}', '{W}'] },
  'Kitchen Finks': { cardTypes: ['CREATURE'], manaValue: 3, manaCostLeftStr: ['{1}', '{G/W}', '{G/W}'] },
  'Steam Vents': { cardTypes: ['LAND'], manaValue: 0 },
  'Dryad Arbor': { cardTypes: ['LAND', 'CREATURE'], manaValue: 0 },
};
const infoOf = (entry: AnalysisEntry) => CARDS[entry.cardName];

describe('costPips', () => {
  it('counts colored symbols, hybrid as half each', () => {
    expect(costPips(CARDS.Counterspell)).toMatchObject({ U: 2, R: 0 });
    expect(costPips(CARDS['Kitchen Finks'])).toMatchObject({ G: 1, W: 1 });
  });
});

describe('suggestLands', () => {
  it('fills a 60-card deck to 24 lands by color share', () => {
    const entries = [
      { cardName: 'Lightning Bolt', amount: 12 },
      { cardName: 'Counterspell', amount: 12 },
      { cardName: 'Steam Vents', amount: 4 },
    ];
    // 12 red symbols, 24 blue: 20 basics split one to two
    expect(suggestLands(entries, infoOf, 60)).toEqual({ target: 24, current: 4, add: { Island: 13, Mountain: 7 } });
  });

  it('keeps to the allowed colors and stops at the target', () => {
    const entries = [{ cardName: 'Boros Charm', amount: 10 }];
    expect(suggestLands(entries, infoOf, 40, ['R']).add).toEqual({ Mountain: 17 });
    expect(suggestLands([{ cardName: 'Mountain', amount: 30 }], infoOf, 60).add).toEqual({});
  });

  it('uses the usual land counts', () => {
    expect([landTarget(40), landTarget(60), landTarget(100)]).toEqual([17, 24, 37]);
  });
});

describe('deckStats', () => {
  it('counts types, lands and the average mana value', () => {
    const stats = deckStats([
      { cardName: 'Lightning Bolt', amount: 4 },
      { cardName: 'Kitchen Finks', amount: 4 },
      { cardName: 'Dryad Arbor', amount: 1 },
      { cardName: 'Mountain', amount: 10 },
    ], infoOf);
    expect(stats).toMatchObject({ cards: 19, lands: 11, nonlands: 8, averageValue: 2 });
    expect(stats.types).toEqual([{ label: 'Creatures', count: 5 }, { label: 'Instants', count: 4 }, { label: 'Lands', count: 10 }]);
    expect(stats.pips.R).toBe(4);
  });
});

describe('draw odds', () => {
  it('matches the hypergeometric distribution', () => {
    // four copies in 60, opening seven: about 40%
    expect(drawOdds(4, 60, 7)).toBeCloseTo(0.3995, 3);
    expect(drawOdds(4, 60, 60)).toBe(1);
    expect(drawOdds(0, 60, 7)).toBe(0);
    expect(drawOdds(4, 60, 10, 2)).toBeLessThan(drawOdds(4, 60, 10, 1));
  });

  it('counts cards seen by a turn', () => {
    expect(cardsSeen(1, true)).toBe(7);
    expect(cardsSeen(1, false)).toBe(8);
    expect(cardsSeen(3, true)).toBe(9);
  });
});

describe('sample hands', () => {
  it('expands and shuffles the whole deck', () => {
    const library = expandDeck([{ cardName: 'A', amount: 2 }, { cardName: 'B', amount: 1 }]);
    expect(library.map((card) => card.cardName)).toEqual(['A', 'A', 'B']);
    const shuffled = shuffle(library, () => 0);
    expect(shuffled.map((card) => card.cardName).sort()).toEqual(['A', 'A', 'B']);
  });
});
