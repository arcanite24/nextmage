import type { CareerCampaign, CareerOpponent } from '../../protocol/generated/views';
import { readJson, writeJson } from '../stores/persist';

/**
 * What the Career hub works out from the server's views: who to face next, and which unlocks are new since the
 * player last looked (each gets its moment once).
 */

/**
 * The opponent the hub offers next: the first unbeaten one in the lowest open tier; once every open opponent has
 * been beaten, the one in the highest open tier beaten least.
 */
export function nextOpponent(opponents: readonly CareerOpponent[]): CareerOpponent | null {
  const open = opponents.filter((opponent) => opponent.unlocked);
  if (open.length === 0) return null;
  const unbeaten = open.filter((opponent) => (opponent.wins ?? 0) === 0);
  if (unbeaten.length > 0) return [...unbeaten].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))[0];
  const top = Math.max(...open.map((opponent) => opponent.tier ?? 0));
  return [...open.filter((opponent) => (opponent.tier ?? 0) === top)].sort((a, b) => (a.wins ?? 0) - (b.wins ?? 0))[0];
}

/** Opponents beaten at least once, of all of them. */
export function beatenCount(opponents: readonly CareerOpponent[]): number {
  return opponents.filter((opponent) => (opponent.wins ?? 0) > 0).length;
}

/** Every unlock the hub announces, as ids: open tiers above the first, and open campaign chapters after the first. */
export function unlockFacts(opponents: readonly CareerOpponent[], campaigns: readonly CareerCampaign[]): string[] {
  const facts = new Set<string>();
  for (const opponent of opponents) {
    if (opponent.unlocked && (opponent.tier ?? 1) > 1) facts.add(`tier:${opponent.tier}`);
  }
  for (const campaign of campaigns) {
    (campaign.chapters ?? []).forEach((chapter, index) => {
      const open = (chapter.nodes ?? []).some((node) => node.state !== 'locked');
      if (open && index > 0) facts.add(`chapter:${campaign.id}:${chapter.id}`);
    });
  }
  return [...facts].sort();
}

const SEEN_KEY = 'playmat.career.seen';

/** The unlocks this browser already announced, per account; null the first time (nothing is announced then). */
export function readSeen(user: string): string[] | null {
  const all = readJson<Record<string, string[]>>(SEEN_KEY, {});
  return all[user.toLowerCase()] ?? null;
}

export function writeSeen(user: string, facts: readonly string[]): void {
  const all = readJson<Record<string, string[]>>(SEEN_KEY, {});
  writeJson(SEEN_KEY, { ...all, [user.toLowerCase()]: [...new Set(facts)].sort() });
}

/**
 * The unlocks to announce now, and what counts as seen afterwards. The first look only records what is already
 * open: a Career that existed before these moments doesn't replay them all.
 */
export function freshUnlocks(seen: readonly string[] | null, facts: readonly string[]): { fresh: string[]; seen: string[] } {
  if (seen === null) return { fresh: [], seen: [...facts] };
  const known = new Set(seen);
  const fresh = facts.filter((fact) => !known.has(fact));
  return { fresh, seen: [...new Set([...seen, ...facts])].sort() };
}
