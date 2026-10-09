import type { PermanentView } from '../../protocol/generated/views';

/**
 * Automatic mana payment, decided on the client: the server asks for mana one source at a time and has no
 * auto-tap for human players. The plan only taps sources whose mana is unambiguous (one color, or colorless), and
 * only when the whole remaining cost can be covered that way; anything else is left to the player.
 */

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

export interface ManaSource {
  id: string;
  /** what one activation adds: a single color; null when it can add several kinds (a choice the player makes) */
  produces: ManaColor | null;
  isLand: boolean;
}

export interface ManaCostParts {
  generic: number;
  colored: Partial<Record<ManaColor, number>>;
}

const COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const BASIC_TYPES: Record<string, ManaColor> = { PLAINS: 'W', ISLAND: 'U', SWAMP: 'B', MOUNTAIN: 'R', FOREST: 'G' };

/** The unpaid cost in a payment prompt ("Pay {2}{G}{G}"), or null when it has symbols auto-pay won't decide (X, hybrid, Phyrexian, snow). */
export function parseCost(text: string): ManaCostParts | null {
  const symbols = [...text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1].toUpperCase());
  if (symbols.length === 0) return null;
  const cost: ManaCostParts = { generic: 0, colored: {} };
  for (const symbol of symbols) {
    if (/^\d+$/.test(symbol)) cost.generic += Number(symbol);
    else if ((COLORS as string[]).includes(symbol)) cost.colored[symbol as ManaColor] = (cost.colored[symbol as ManaColor] ?? 0) + 1;
    else return null;
  }
  return cost;
}

/** What a permanent's mana ability adds, read from its rules text and basic land types. */
export function manaOf(permanent: Pick<PermanentView, 'rules' | 'subTypes' | 'cardTypes'>): ManaColor | null | undefined {
  const rules = (permanent.rules ?? []).join(' ').replace(/<[^>]*>/g, '');
  const adds = [...rules.matchAll(/Add ([^.]*)/gi)].map((match) => match[1]);
  const kinds = new Set<ManaColor>();
  for (const clause of adds) {
    if (/any color|any type|of any/i.test(clause)) return null;
    for (const symbol of clause.matchAll(/\{([WUBRGC])\}/g)) kinds.add(symbol[1] as ManaColor);
  }
  for (const type of permanent.subTypes ?? []) {
    const color = BASIC_TYPES[type];
    if (color) kinds.add(color);
  }
  if (kinds.size === 0) return undefined; // no mana ability we can read
  return kinds.size === 1 ? [...kinds][0] : null;
}

/**
 * How many untapped sources of each color to keep for the rest of the hand: for each color, the most of it one card
 * asks for, among the cards still castable with the `spare` sources this payment leaves (cost text as "{1}{G}").
 */
export function handNeeds(costs: string[], spare: number): Partial<Record<ManaColor, number>> {
  const needs: Partial<Record<ManaColor, number>> = {};
  for (const text of costs) {
    const cost = parseCost(text);
    if (!cost) continue;
    const colored = Object.values(cost.colored).reduce((sum, value) => sum + (value ?? 0), 0);
    if (colored === 0 || cost.generic + colored > spare) continue;
    for (const color of COLORS) {
      const wanted = cost.colored[color] ?? 0;
      if (wanted > (needs[color] ?? 0)) needs[color] = wanted;
    }
  }
  return needs;
}

/**
 * The next source to tap for this cost, or null when the payment isn't clear enough to make for the player.
 * Colored symbols are covered first by sources of that color; generic mana then uses lands before creatures,
 * colorless before colors, and of the colors the ones with sources to spare beyond what `keep` (the rest of the
 * hand, see handNeeds) wants untapped, colors nothing needs before needed ones, and the most plentiful first.
 */
export function nextSource(cost: ManaCostParts, sources: ManaSource[], keep: Partial<Record<ManaColor, number>> = {}): string | null {
  const usable = sources.filter((source) => source.produces !== null);
  const remaining = [...usable];
  const take = (pick: (source: ManaSource) => boolean, prefer: (a: ManaSource, b: ManaSource) => number) => {
    const candidates = remaining.filter(pick).sort(prefer);
    const chosen = candidates[0];
    if (!chosen) return null;
    remaining.splice(remaining.indexOf(chosen), 1);
    return chosen;
  };
  const landsFirst = (a: ManaSource, b: ManaSource) => Number(b.isLand) - Number(a.isLand);
  const left = (color: ManaSource['produces']) => remaining.filter((source) => source.produces === color).length;
  // colorless first; then colors with sources to spare, and of those the ones nothing in hand needs
  const rank = ({ produces }: ManaSource) => {
    const needed = keep[produces!] ?? 0;
    return produces === 'C' ? 9 : 2 * Number(left(produces) > needed) + Number(!needed);
  };

  const plan: ManaSource[] = [];
  for (const color of COLORS) {
    for (let i = 0; i < (cost.colored[color] ?? 0); i++) {
      const source = take((candidate) => candidate.produces === color, landsFirst);
      if (!source) return null;
      plan.push(source);
    }
  }
  // generic: spend what the rest of the cost and the hand don't need, colorless first
  for (let i = 0; i < cost.generic; i++) {
    const source = take(() => true, (a, b) => landsFirst(a, b) || rank(b) - rank(a) || left(b.produces) - left(a.produces));
    if (!source) return null;
    plan.push(source);
  }
  return plan[0]?.id ?? null;
}
