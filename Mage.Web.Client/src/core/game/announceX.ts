import type { GameView, PermanentView } from '../../protocol/generated/views';
import { POOL_MANA } from './payment';

const BASIC_LANDS = new Set(['PLAINS', 'ISLAND', 'SWAMP', 'MOUNTAIN', 'FOREST', 'WASTES']);
const COUNTS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/** Mana one untapped permanent can make, read from its "{T}: Add ..." rules (the biggest of its choices). */
function manaFrom(permanent: PermanentView): number {
  if (permanent.tapped) return 0;
  const types = permanent.cardTypes ?? [];
  // a creature that just arrived can't tap
  if (types.includes('CREATURE') && permanent.summoningSickness) return 0;
  const rules = (permanent.rules ?? []).join(' ').replace(/<[^>]*>/g, '');
  let most = 0;
  for (const [, clause] of rules.matchAll(/\{T\}[^:.]*: Add ([^.]*)/gi)) {
    const symbols = /^((?:\{[^}]+\})+)/.exec(clause)?.[1].match(/\{/g)?.length ?? 0;
    const words = COUNTS[/^(\w+) mana/i.exec(clause)?.[1].toLowerCase() ?? ''] ?? 0;
    most = Math.max(most, symbols, words);
  }
  if (most === 0 && types.includes('LAND') && (permanent.subTypes ?? []).some((type) => BASIC_LANDS.has(type))) most = 1;
  return most;
}

/** About how much mana a player could make right now: floating mana plus what their untapped permanents tap for. */
export function manaAvailable(view: GameView | null | undefined, playerId: string | null): number {
  const player = (view?.players ?? []).find((candidate) => candidate.playerId === playerId);
  if (!player) return 0;
  const floating = POOL_MANA.reduce((sum, { key }) => sum + (player.manaPool?.[key] ?? 0), 0);
  return Object.values(player.battlefield ?? {}).reduce((sum, permanent) => sum + manaFrom(permanent), floating);
}

/**
 * A sensible top for "Announce the value for {X}": the server's own limit when it sets one, else the mana the player
 * could pay for X, after the rest of the spell's cost (the spell waits on the stack, its mana value counting X as 0).
 * Null when the question isn't about X.
 */
export function xLimit(prompt: { text: string; max: number; min: number }, view: GameView | null | undefined, playerId: string | null): number | null {
  if (!/\{X\}/.test(prompt.text)) return null;
  if (prompt.max < 1000) return prompt.max;
  const source = /\(source: ([^)[]+?)\s*(?:\[[0-9a-f]+\])?\)/i.exec(prompt.text)?.[1];
  const spell = source ? Object.values(view?.stack ?? {}).find((item) => item.name === source && item.controllerId === playerId) : undefined;
  return Math.max(prompt.min, manaAvailable(view, playerId) - (spell?.manaValue ?? 0));
}
