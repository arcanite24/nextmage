import { useEffect } from 'react';
import { create } from 'zustand';
import type { CardView } from '../../protocol/generated/views';
import type { DeckCardInfo } from '../../types/models';
import { api } from '../connection';
import { entryKey, printingOf } from './deckModel';

/**
 * Card details (types, mana value, colors, rules) for deck entries, looked up in batches and kept for the session.
 * Search results seed it, so cards added from the collection never need a lookup.
 */
interface CardInfoState {
  info: ReadonlyMap<string, CardView>;
  /** keys looked up and not found */
  missing: ReadonlySet<string>;
  remember(cards: CardView[]): void;
  request(entries: DeckCardInfo[]): void;
}

const BATCH = 200;
const inFlight = new Set<string>();

export const useCardInfoStore = create<CardInfoState>((set, get) => ({
  info: new Map(),
  missing: new Set(),

  remember(cards) {
    const next = new Map(get().info);
    let changed = false;
    for (const card of cards) {
      const key = entryKey(printingOf(card));
      if (!next.has(key)) {
        next.set(key, card);
        changed = true;
      }
    }
    if (changed) set({ info: next });
  },

  request(entries) {
    const { info, missing } = get();
    const wanted = new Map<string, DeckCardInfo>();
    for (const entry of entries) {
      const key = entryKey(entry);
      if (!info.has(key) && !missing.has(key) && !inFlight.has(key)) wanted.set(key, entry);
    }
    if (wanted.size === 0) return;
    const keys = [...wanted.keys()];
    keys.forEach((key) => inFlight.add(key));
    for (let start = 0; start < keys.length; start += BATCH) {
      const slice = keys.slice(start, start + BATCH);
      const query = slice.map((key) => {
        const entry = wanted.get(key)!;
        return { cardName: entry.cardName, setCode: entry.setCode ?? '', cardNumber: entry.cardNumber ?? '', amount: entry.amount };
      });
      api.lookupCards(query)
        .then((cards) => {
          const nextInfo = new Map(get().info);
          const nextMissing = new Set(get().missing);
          slice.forEach((key, index) => {
            const card = cards[index];
            if (card) nextInfo.set(key, card);
            else nextMissing.add(key);
          });
          set({ info: nextInfo, missing: nextMissing });
        })
        .catch(() => undefined)
        .finally(() => slice.forEach((key) => inFlight.delete(key)));
    }
  },
}));

/** Details for these entries; entries still loading are absent from the map. */
export function useCardInfo(entries: DeckCardInfo[]): ReadonlyMap<string, CardView> {
  const info = useCardInfoStore((state) => state.info);
  const request = useCardInfoStore((state) => state.request);
  useEffect(() => request(entries), [entries, request]);
  return info;
}
