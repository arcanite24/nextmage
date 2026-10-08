import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { DeckCardLists } from '../../types/models';
import { api } from '../connection';
import { toWire } from './deckModel';

/** Server validation for the format, a moment after the deck stops changing. */
export function useValidation(deck: DeckCardLists, format: string) {
  const [settled, setSettled] = useState(deck);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(deck), 600);
    return () => clearTimeout(timer);
  }, [deck]);
  const wire = useMemo(() => toWire(settled), [settled]);
  return useQuery({
    queryKey: ['deckValidate', format, wire],
    queryFn: () => api.deckValidate(format, wire),
    enabled: settled.cards.length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}
