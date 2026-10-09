import { useEffect, useMemo, useState } from 'react';
import type { DeckCardLists } from '../../core/decks/types';
import type { CareerProfile } from '../../protocol/generated/views';
import { useT } from '../i18n';
import { useSession } from '../stores/session';
import { ensureCareerDeck } from './careerDeck';
import { useCareerCollection, useCareerStarters } from './careerData';
import { DECK_MIN, mainDeckSize, ownedByName, shortfalls } from './careerModel';

/** The Career deck on this browser, whether it can be played, and the starter cover it shows as. */
export function useCareerDeck(profile: CareerProfile | undefined) {
  const t = useT();
  const user = useSession((state) => state.userName);
  const starter = profile?.starter;
  const collection = useCareerCollection(!!profile);
  const starters = useCareerStarters(!!profile);
  const owned = useMemo(() => ownedByName(collection.data ?? []), [collection.data]);
  const [deck, setDeck] = useState<DeckCardLists | null>(null);
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void ensureCareerDeck(user, starter).then((loaded) => !cancelled && setDeck(loaded));
    return () => {
      cancelled = true;
    };
  }, [user, starter, profile]);
  const size = deck ? mainDeckSize(deck) : 0;
  const missing = useMemo(() => (deck && collection.data ? shortfalls(deck, owned) : []), [deck, owned, collection.data]);
  const problem = !deck ? null
    : size < DECK_MIN ? t('career.deck.notReady', { min: DECK_MIN, count: size })
      : missing.length > 0 ? t('career.deck.missing', { count: missing.length }) : null;
  const opened = starters.data?.find((candidate) => candidate.id === starter);
  return { deck, size, problem, cover: opened?.cover ?? null, colors: opened?.colors, cardCount: collection.data?.reduce((sum, card) => sum + (card.count ?? 0), 0) ?? 0 };
}
