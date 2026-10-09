import type { TimingOption, TournamentTypeView } from '../../protocol/generated/views';
import type { WebLimitedOptions } from '../../protocol/options';

/**
 * Turns the host dialog's choices into the server's tournament type and limited options, the way the desktop client's
 * new tournament dialog does.
 */

export type EventKind = 'draft' | 'sealed' | 'jumpstart' | 'constructed';

/** where the packs come from */
export type PackSource = 'set' | 'cube' | 'random' | 'reshuffled' | 'richMan' | 'richManCube' | 'custom';

/** the server's cube that drafts a list the host uploads; its name in the cube list carries a note after this */
export const CUBE_FROM_DECK = 'Cube From Deck';

export function isCubeFromDeck(cubeName: string): boolean {
  return cubeName.startsWith(CUBE_FROM_DECK);
}

/** the most packs the server uses from a pool of sets (more are dropped at random) */
export function maxPoolSets(source: PackSource, players: number): number {
  return source === 'richMan' ? 36 : 3 * (players + 1);
}

export const PACK_SOURCES: Record<'draft' | 'sealed' | 'jumpstart', { value: PackSource; label: string; detail: string }[]> = {
  draft: [
    { value: 'set', label: 'One set', detail: 'Three packs of the set you pick.' },
    { value: 'cube', label: 'Cube', detail: 'Packs from a cube list.' },
    { value: 'random', label: 'Random sets', detail: 'Each pack from a random set in your pool.' },
    { value: 'reshuffled', label: 'Reshuffled', detail: 'Packs made from all the cards of your pool, mixed.' },
    { value: 'richMan', label: 'Rich man', detail: 'A fresh pack every pick, from your pool.' },
    { value: 'richManCube', label: 'Rich man cube', detail: 'A fresh cube pack every pick.' },
  ],
  sealed: [
    { value: 'set', label: 'One set', detail: 'Six packs of the set you pick.' },
    { value: 'cube', label: 'Cube', detail: 'Six packs from a cube list.' },
  ],
  jumpstart: [
    { value: 'set', label: 'Official packs', detail: 'Two themed half-decks each, from the Jumpstart sets.' },
    { value: 'custom', label: 'Your own packs', detail: 'Half-decks from a file you upload. Single elimination.' },
  ],
};

/** the server's pick timers (DraftOptions.TimingOption); its NONE is a placeholder, not "no timer" */
export const TIMINGS: { value: TimingOption; label: string }[] = [
  { value: 'BEGINNER', label: 'Relaxed (150 s for the first pick)' },
  { value: 'REGULAR', label: 'Regular (113 s for the first pick)' },
  { value: 'PROFESSIONAL', label: 'Fast (75 s for the first pick)' },
];

export interface EventChoice {
  kind: EventKind;
  swiss: boolean;
  source: PackSource;
  players: number;
  /** the set for 'set' drafts and sealed */
  setCode: string;
  /** the set pool for random, reshuffled and rich man drafts */
  pool: string[];
  cubeName: string;
  /** the cube's card list when cubeName is CUBE_FROM_DECK */
  cubeFromDeck?: unknown;
  /** custom jumpstart packs file */
  jumpstartPacks?: string;
  /** minutes to build a deck */
  constructionMinutes: number;
  timing: TimingOption;
  /** shuffles the pool; Math.random by default */
  random?: () => number;
}

export interface EventPlan {
  tournamentType: string;
  limitedOptions: WebLimitedOptions;
}

export function tournamentTypeName(kind: EventKind, swiss: boolean, source: PackSource): string {
  const structure = swiss ? 'Swiss' : 'Elimination';
  if (kind === 'constructed') return `Constructed ${structure}`;
  if (kind === 'jumpstart') return source === 'custom' ? 'Jumpstart Elimination (Custom)' : `Jumpstart ${structure}`;
  const base = kind === 'draft' ? `Booster Draft ${structure}` : `Sealed ${structure}`;
  const suffix: Record<PackSource, string> = {
    set: '', cube: ' (Cube)', random: ' (Random)', reshuffled: ' (Reshuffled)', richMan: ' (Rich Man)', richManCube: ' (Rich Man Cube)', custom: '',
  };
  return base + suffix[source];
}

/** The dialog's player choices: as many as the chosen event type takes, within 2 to 8. */
export function playerCounts(kind: EventKind, swiss: boolean, source: PackSource, types: TournamentTypeView[]): number[] {
  const type = types.find((candidate) => candidate.name === tournamentTypeName(kind, swiss, source));
  const min = Math.max(2, type?.minPlayers || 2);
  const max = Math.min(8, type?.maxPlayers || 8);
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index);
}

/** The players asked for, or the nearest count the event takes. */
export function fitPlayers(wanted: number, counts: number[]): number {
  return counts.length ? Math.min(counts[counts.length - 1], Math.max(counts[0], wanted)) : wanted;
}

/** How many rounds single elimination takes: each round halves the field (byes round it up) until one is left. */
export function eliminationRounds(players: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, players))));
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/** The plan, or the reason the choice can't be hosted on this server. */
export function planEvent(choice: EventChoice, types: TournamentTypeView[]): EventPlan | string {
  const tournamentType = tournamentTypeName(choice.kind, choice.swiss, choice.source);
  const type = types.find((candidate) => candidate.name === tournamentType);
  if (!type) return `This server doesn't run ${tournamentType} events.`;
  if (type.minPlayers && choice.players < type.minPlayers) return `${tournamentType} needs at least ${type.minPlayers} players.`;
  if (type.maxPlayers && choice.players > type.maxPlayers) return `${tournamentType} takes at most ${type.maxPlayers} players.`;
  if (!type.limited) return { tournamentType, limitedOptions: { constructionTime: 0, numberBoosters: 0 } };

  const limitedOptions: WebLimitedOptions = {
    constructionTime: choice.constructionMinutes * 60,
    numberBoosters: type.numBoosters ?? 0,
    isRandom: !!type.random,
    isReshuffled: !!type.reshuffled,
    isRichMan: !!type.richMan,
    isJumpstart: !!type.jumpstart,
    sets: [],
  };
  if (type.draft) limitedOptions.timing = choice.timing;

  if (type.cubeBooster) {
    if (!choice.cubeName) return 'Pick a cube.';
    limitedOptions.draftCubeName = choice.cubeName;
    if (isCubeFromDeck(choice.cubeName)) {
      if (!choice.cubeFromDeck) return 'Pick the deck that holds your cube list.';
      limitedOptions.cubeFromDeck = choice.cubeFromDeck;
    }
  } else if (type.jumpstart) {
    if (choice.source === 'custom') {
      if (!choice.jumpstartPacks?.trim()) return 'Upload your jumpstart packs file.';
      limitedOptions.jumpstartPacks = choice.jumpstartPacks;
    }
  } else if (type.random || type.richMan || type.reshuffled) {
    if (choice.pool.length === 0) return 'Pick the sets for the pool.';
    limitedOptions.sets = type.reshuffled
      ? [...choice.pool]
      : shuffled(choice.pool, choice.random ?? Math.random).slice(0, maxPoolSets(choice.source, choice.players));
  } else {
    if (!choice.setCode) return 'Pick a set.';
    limitedOptions.sets = Array.from({ length: type.numBoosters ?? 0 }, () => choice.setCode);
  }
  return { tournamentType, limitedOptions };
}
