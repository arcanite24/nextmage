import type { PermanentView } from '../../protocol/generated/views';

/**
 * Automatic mana payment, decided on the client: the server asks for mana one source at a time and has no
 * auto-tap for human players. Sources that make one color, or a few colors from plain "Add {W} or {U}" abilities
 * and basic land types (shocklands, guildgates, triomes), are tapped only while the whole remaining cost can still be
 * covered; anything that needs a real choice (any color, life or damage riders) is left to the player.
 */

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

export interface ManaSource {
  id: string;
  /** the kinds of mana one activation can add, one of them per activation; null when auto-pay can't decide for it */
  colors: ManaColor[] | null;
  isLand: boolean;
}

export interface ManaCostParts {
  generic: number;
  colored: Partial<Record<ManaColor, number>>;
}

/** A source to tap, and the mana it should make: when the server can't tell which (both colors are still owed), it asks, and `ask` says to answer with `color`. */
export interface ManaTap {
  id: string;
  color: ManaColor;
  ask: boolean;
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

/**
 * What a permanent's mana abilities can add, read from its rules text and basic land types: the kinds in a fixed
 * order; null when a choice is beyond auto-pay (any color, a cost or rider such as life or damage, colorless next to
 * colors); undefined when there's no mana ability to read.
 */
export function manaOf(permanent: Pick<PermanentView, 'rules' | 'subTypes' | 'cardTypes'>): ManaColor[] | null | undefined {
  const rules = (permanent.rules ?? []).map((rule) => rule.replace(/<[^>]*>/g, ''));
  const kinds = new Set<ManaColor>();
  for (const rule of rules) {
    for (const match of rule.matchAll(/Add ([^.]*)\.?(.*)/gi)) {
      const [, clause, rest] = match;
      if (/any color|any type|of any/i.test(clause)) return null;
      const symbols = [...clause.matchAll(/\{([WUBRGC])\}/g)].map((symbol) => symbol[1] as ManaColor);
      // a choice of colors with a rider ("deals 1 damage to you") costs more than mana
      if (new Set(symbols).size > 1 && /\S/.test(rest.replace(/\)$/, ''))) return null;
      for (const symbol of symbols) kinds.add(symbol);
    }
    // a cost besides tapping ("{T}, Pay 1 life: Add {B}")
    if (/^[^:]*(life|sacrifice|discard|counter)[^:]*:\s*Add/i.test(rule)) return null;
  }
  for (const type of permanent.subTypes ?? []) {
    const color = BASIC_TYPES[type];
    if (color) kinds.add(color);
  }
  if (kinds.size === 0) return undefined; // no mana ability we can read
  if (kinds.size > 1 && kinds.has('C')) return null;
  return COLORS.filter((color) => kinds.has(color));
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

const total = (cost: ManaCostParts) => cost.generic + Object.values(cost.colored).reduce((sum, value) => sum + (value ?? 0), 0);

/** Whether `sources` can still pay `cost`: every colored symbol gets a source that makes it, and enough are left for the rest. */
export function canPay(cost: ManaCostParts, sources: ManaSource[]): boolean {
  const usable = sources.filter((source) => source.colors !== null);
  if (usable.length < total(cost)) return false;
  const symbols = COLORS.flatMap((color) => Array<ManaColor>(cost.colored[color] ?? 0).fill(color));
  // bipartite matching of colored symbols to sources (augmenting paths; costs are a handful of symbols)
  const owner = new Map<ManaSource, number>();
  const assign = (symbol: number, seen: Set<ManaSource>): boolean => {
    for (const source of usable) {
      if (seen.has(source) || !source.colors!.includes(symbols[symbol])) continue;
      seen.add(source);
      const held = owner.get(source);
      if (held === undefined || assign(held, seen)) {
        owner.set(source, symbol);
        return true;
      }
    }
    return false;
  };
  return symbols.every((_, symbol) => assign(symbol, new Set()));
}

/** What the server makes a source add towards `cost` on its own: its one color, the one owed color it makes, 'generic' when it makes none that's owed, or 'ask'. */
function serverPick(source: ManaSource, cost: ManaCostParts): ManaColor | 'generic' | 'ask' {
  const colors = source.colors!;
  if (colors.length === 1) return colors[0];
  const owed = colors.filter((color) => (cost.colored[color] ?? 0) > 0);
  if (owed.length === 1) return owed[0];
  return owed.length === 0 ? 'generic' : 'ask';
}

/** The cost after `color` is paid: a colored symbol of that color if one is owed, otherwise generic; null when the mana would be wasted. */
function afterPaying(cost: ManaCostParts, color: ManaColor | 'generic'): ManaCostParts | null {
  if (color !== 'generic' && (cost.colored[color] ?? 0) > 0) return { ...cost, colored: { ...cost.colored, [color]: cost.colored[color]! - 1 } };
  return cost.generic > 0 ? { ...cost, generic: cost.generic - 1 } : null;
}

/**
 * The next source to tap for this cost, or null when the payment isn't clear enough to make for the player. A tap is
 * only made if the rest of the cost can still be covered afterwards. Colored symbols are covered first by sources of
 * just that color, then by multicolor sources the server will point at the owed color itself; generic mana then uses
 * lands before creatures, single colors before multicolor sources, colorless before colors, and of the colors the ones
 * with sources to spare beyond what `keep` (the rest of the hand, see handNeeds) wants untapped, colors nothing needs
 * before needed ones, and the most plentiful first. Multicolor sources that would make the server ask come last.
 */
export function nextTap(cost: ManaCostParts, sources: ManaSource[], keep: Partial<Record<ManaColor, number>> = {}): ManaTap | null {
  const usable = sources.filter((source) => source.colors !== null);
  if (!canPay(cost, usable)) return null;
  const single = usable.filter((source) => source.colors!.length === 1);
  const multi = usable.filter((source) => source.colors!.length > 1);
  const landsFirst = (a: ManaSource, b: ManaSource) => Number(b.isLand) - Number(a.isLand);
  const left = (color: ManaColor) => single.filter((source) => source.colors![0] === color).length;
  // colorless first; then colors with sources to spare, and of those the ones nothing in hand needs
  const rank = (source: ManaSource) => {
    const color = source.colors![0];
    const needed = keep[color] ?? 0;
    return color === 'C' ? 9 : 2 * Number(left(color) > needed) + Number(!needed);
  };

  const tries = (source: ManaSource, color: ManaColor | 'generic', ask: boolean): ManaTap | null => {
    const after = afterPaying(cost, color);
    if (!after || !canPay(after, usable.filter((other) => other !== source))) return null;
    return { id: source.id, color: color === 'generic' ? source.colors![0] : color, ask };
  };
  const first = (candidates: ManaSource[], color: (source: ManaSource) => ManaColor | 'generic', ask = false) => {
    for (const source of candidates) {
      const tap = tries(source, color(source), ask);
      if (tap) return tap;
    }
    return null;
  };
  const owedColors = COLORS.filter((color) => (cost.colored[color] ?? 0) > 0);
  for (const color of owedColors) {
    const tap = first(single.filter((source) => source.colors![0] === color).sort(landsFirst), () => color);
    if (tap) return tap;
  }
  for (const color of owedColors) {
    const tap = first(multi.filter((source) => serverPick(source, cost) === color).sort(landsFirst), () => color);
    if (tap) return tap;
  }
  if (cost.generic > 0) {
    const spare = single.filter((source) => !owedColors.includes(source.colors![0]));
    const tap =
      first(spare.sort((a, b) => landsFirst(a, b) || rank(b) - rank(a) || left(b.colors![0]) - left(a.colors![0])), () => 'generic') ??
      first(multi.filter((source) => serverPick(source, cost) === 'generic').sort(landsFirst), () => 'generic');
    if (tap) return tap;
  }
  for (const source of multi.filter((candidate) => serverPick(candidate, cost) === 'ask').sort(landsFirst)) {
    for (const color of source.colors!.filter((candidate) => owedColors.includes(candidate))) {
      const tap = tries(source, color, true);
      if (tap) return tap;
    }
  }
  return null;
}

/** The ability to answer the server's "which mana ability" question with, when it names exactly one that adds `color`. */
export function abilityFor(choices: { id: string; text: string }[], color: ManaColor): string | null {
  const matching = choices.filter((choice) => {
    const added = [...(choice.text.match(/Add ([^.]*)/i)?.[1] ?? '').matchAll(/\{([WUBRGC])\}/g)].map((symbol) => symbol[1]);
    return added.length > 0 && added.every((symbol) => symbol === color);
  });
  return matching.length === 1 ? matching[0].id : null;
}
