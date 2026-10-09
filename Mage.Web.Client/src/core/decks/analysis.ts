/**
 * Deck numbers for the builder: land suggestions, type and color breakdowns, draw odds and sample hands.
 * Pure functions over deck entries and the card details looked up for them.
 */

export interface AnalysisEntry {
  cardName: string;
  amount: number;
}

/** The card details analysis reads (a subset of CardView). */
export interface AnalysisCard {
  cardTypes?: string[];
  superTypes?: string[];
  manaValue?: number;
  manaCostLeftStr?: string[];
  manaCostRightStr?: string[];
  rules?: string[];
}

export type ManaLetter = 'W' | 'U' | 'B' | 'R' | 'G';

export const MANA_LETTERS: readonly ManaLetter[] = ['W', 'U', 'B', 'R', 'G'];

export const BASIC_FOR: Record<ManaLetter, string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };

const BASIC_LAND_NAMES = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']);

export function isLand(card: AnalysisCard | undefined): boolean {
  return !!card && (card.cardTypes ?? []).includes('LAND');
}

/** Colored mana symbols in a card's cost: hybrid symbols count half for each color. */
export function costPips(card: AnalysisCard | undefined): Record<ManaLetter, number> {
  const pips: Record<ManaLetter, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (!card) return pips;
  const symbols = [...(card.manaCostLeftStr ?? []), ...(card.manaCostRightStr ?? [])].join('').match(/\{[^}]+\}/g) ?? [];
  for (const symbol of symbols) {
    const colors = MANA_LETTERS.filter((letter) => symbol.toUpperCase().includes(letter));
    for (const letter of colors) pips[letter] += 1 / colors.length;
  }
  return pips;
}

/** How many lands a deck of this size usually plays: 17 of 40, 24 of 60, 37 of 100 (command zone included). */
export function landTarget(deckSize: number): number {
  if (deckSize <= 40) return Math.round(deckSize * 0.425);
  if (deckSize <= 60) return Math.round(deckSize * 0.4);
  return Math.round(deckSize * 0.37);
}

export interface LandSuggestion {
  /** lands the deck should end up with */
  target: number;
  /** lands it has now (basics and others) */
  current: number;
  /** basics to add, by name; empty when the deck already has enough lands */
  add: Record<string, number>;
}

/**
 * Basic lands that bring the deck up to the usual land count, split by the colored symbols of its spells.
 * `allowed` limits the colors (a commander's identity); a deck with no colored symbols gets Wastes only if allowed is
 * empty, else nothing.
 */
export function suggestLands(
  entries: readonly AnalysisEntry[],
  infoOf: (entry: AnalysisEntry) => AnalysisCard | undefined,
  deckSize: number,
  allowed: readonly ManaLetter[] = MANA_LETTERS,
): LandSuggestion {
  const target = landTarget(deckSize);
  let current = 0;
  const pips: Record<ManaLetter, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const entry of entries) {
    const card = infoOf(entry);
    if (isLand(card) || BASIC_LAND_NAMES.has(entry.cardName)) {
      current += entry.amount;
      continue;
    }
    const cardPips = costPips(card);
    for (const letter of MANA_LETTERS) pips[letter] += cardPips[letter] * entry.amount;
  }
  const missing = Math.max(0, target - current);
  const colors = MANA_LETTERS.filter((letter) => allowed.includes(letter) && pips[letter] > 0);
  const add: Record<string, number> = {};
  if (missing === 0 || colors.length === 0) return { target, current, add };
  const total = colors.reduce((sum, letter) => sum + pips[letter], 0);
  // largest remainder: every color with symbols gets its share, the counts add up exactly
  const shares = colors.map((letter) => ({ letter, exact: (pips[letter] / total) * missing }));
  const counts = shares.map((share) => ({ letter: share.letter, count: Math.floor(share.exact), rest: share.exact % 1 }));
  let left = missing - counts.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...counts].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    item.count += 1;
    left -= 1;
  }
  for (const item of counts) if (item.count > 0) add[BASIC_FOR[item.letter]] = item.count;
  return { target, current, add };
}

export interface DeckStats {
  cards: number;
  lands: number;
  nonlands: number;
  /** average mana value of nonland cards */
  averageValue: number;
  /** cards by type line group: creatures, instants, sorceries... (a card counts once, under its first type) */
  types: { label: string; count: number }[];
  /** colored symbols in the deck's costs */
  pips: Record<ManaLetter, number>;
}

const TYPE_ORDER: [string, string][] = [
  ['CREATURE', 'Creatures'],
  ['PLANESWALKER', 'Planeswalkers'],
  ['BATTLE', 'Battles'],
  ['INSTANT', 'Instants'],
  ['SORCERY', 'Sorceries'],
  ['ARTIFACT', 'Artifacts'],
  ['ENCHANTMENT', 'Enchantments'],
  ['LAND', 'Lands'],
];

export function deckStats(entries: readonly AnalysisEntry[], infoOf: (entry: AnalysisEntry) => AnalysisCard | undefined): DeckStats {
  let cards = 0;
  let lands = 0;
  let valueSum = 0;
  const typeCounts = new Map<string, number>();
  const pips: Record<ManaLetter, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const entry of entries) {
    const card = infoOf(entry);
    cards += entry.amount;
    const types = card?.cardTypes ?? [];
    // a creature land is a land for the mana count and a creature for the type count
    const label = TYPE_ORDER.find(([type]) => types.includes(type) && !(type === 'LAND' && types.includes('CREATURE')))?.[1]
      ?? (BASIC_LAND_NAMES.has(entry.cardName) ? 'Lands' : 'Other');
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + entry.amount);
    if (isLand(card) || BASIC_LAND_NAMES.has(entry.cardName)) {
      lands += entry.amount;
      continue;
    }
    valueSum += (card?.manaValue ?? 0) * entry.amount;
    const cardPips = costPips(card);
    for (const letter of MANA_LETTERS) pips[letter] += cardPips[letter] * entry.amount;
  }
  const nonlands = cards - lands;
  const order = [...TYPE_ORDER.map(([, label]) => label), 'Other'];
  return {
    cards,
    lands,
    nonlands,
    averageValue: nonlands > 0 ? valueSum / nonlands : 0,
    types: order.filter((label) => typeCounts.has(label)).map((label) => ({ label, count: typeCounts.get(label)! })),
    pips,
  };
}

/** Ways to choose k of n. */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) result = (result * (n - i + 1)) / i;
  return result;
}

/**
 * Chance to have drawn at least `wanted` of `copies` cards after seeing `seen` cards of a `deckSize`-card library
 * (hypergeometric distribution).
 */
export function drawOdds(copies: number, deckSize: number, seen: number, wanted = 1): number {
  if (deckSize <= 0 || copies <= 0) return 0;
  const draws = Math.min(seen, deckSize);
  const total = choose(deckSize, draws);
  let missing = 0;
  for (let k = 0; k < wanted; k++) missing += choose(copies, k) * choose(deckSize - copies, draws - k);
  return Math.max(0, Math.min(1, 1 - missing / total));
}

/** Cards seen by your turn `turn`: the opening seven, plus a draw each turn (on the draw from turn 1). */
export function cardsSeen(turn: number, onThePlay: boolean): number {
  return 7 + Math.max(0, onThePlay ? turn - 1 : turn);
}

/** Every physical card of the deck, in list order (cards × amount). */
export function expandDeck<T extends AnalysisEntry>(entries: readonly T[]): T[] {
  return entries.flatMap((entry) => Array.from({ length: entry.amount }, () => entry));
}

/** A shuffled copy (Fisher-Yates); `random` returns [0, 1). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
