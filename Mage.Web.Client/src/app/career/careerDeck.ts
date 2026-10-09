import type { DeckCardLists } from '../../core/decks/types';
import { readJson, writeJson } from '../stores/persist';

/**
 * The Career deck: one deck per account, kept in this browser apart from the deck library (free-play decks may hold
 * any card; this one only cards the account owns). The server checks it again when a match starts.
 */
const FORMAT = 'Constructed - Freeform';

function key(user: string): string {
  return `playmat.career.deck.${user.toLowerCase()}`;
}

export function loadCareerDeck(user: string): DeckCardLists | null {
  const deck = readJson<DeckCardLists | null>(key(user), null);
  return deck && Array.isArray(deck.cards) && Array.isArray(deck.sideboard) ? deck : null;
}

export function saveCareerDeck(user: string, deck: DeckCardLists): void {
  writeJson(key(user), { ...deck, id: 'career', format: FORMAT, updatedAt: Date.now() });
}

/** The starter deck a Career opened with (the same files free play offers as starters). */
export async function fetchStarterDeck(starterId: string, name?: string): Promise<DeckCardLists> {
  const response = await fetch(`/starter-decks/${encodeURIComponent(starterId)}.dck`);
  const text = response.ok ? await response.text() : '';
  if (!text || /^\s*</.test(text)) throw new Error(`The starter deck ${starterId} can't be loaded.`);
  const { DeckSerializer } = await import('../../core/decks/DeckSerializer');
  const deck = DeckSerializer.importDeck(text);
  return { ...deck, id: 'career', name: name ?? deck.name ?? 'Career deck', format: FORMAT };
}

/** The account's Career deck; the first time on this browser, the starter it opened with. */
export async function ensureCareerDeck(user: string, starterId: string | undefined, name?: string): Promise<DeckCardLists> {
  const saved = loadCareerDeck(user);
  if (saved) return saved;
  const deck = starterId
    ? await fetchStarterDeck(starterId, name).catch(() => null)
    : null;
  const fresh = deck ?? { id: 'career', name: name ?? 'Career deck', format: FORMAT, cards: [], sideboard: [] };
  saveCareerDeck(user, fresh);
  return fresh;
}
