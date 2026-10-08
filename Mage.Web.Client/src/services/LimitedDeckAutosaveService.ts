import type { DeckCardLists } from '../types/index.js';

export type LimitedDeckAutosaveKind = 'construction' | 'sideboard';

export interface LimitedDeckAutosaveOptions {
  kind: LimitedDeckAutosaveKind;
  activityId?: string | null;
  title?: string | null;
  limitedSideboard?: boolean;
  now?: number;
}

function countCards(deck: DeckCardLists): number {
  return deck.cards.reduce((sum, card) => sum + card.amount, 0)
    + deck.sideboard.reduce((sum, card) => sum + card.amount, 0);
}

function autosaveTimestamp(now: number): string {
  return new Date(now).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function sourceLabel(activityId: string | null | undefined): string {
  return activityId?.trim() ? activityId.trim().slice(0, 8) : 'unknown';
}

export function shouldAutosaveLimitedDeck(deck: DeckCardLists | null | undefined): deck is DeckCardLists {
  return Boolean(deck && countCards(deck) > 0);
}

export function limitedDeckAutosaveName(options: LimitedDeckAutosaveOptions): string {
  const source = sourceLabel(options.activityId);
  if (options.kind === 'sideboard' || options.limitedSideboard) {
    return `Limited Sideboard Autosave ${source}`;
  }
  return `Limited Construction Autosave ${source}`;
}

export function buildLimitedDeckAutosaveDeck(
  deck: DeckCardLists,
  options: LimitedDeckAutosaveOptions,
): DeckCardLists {
  const now = options.now ?? Date.now();
  const source = sourceLabel(options.activityId);
  const totalCount = countCards(deck);
  const kindLabel = options.kind === 'sideboard' || options.limitedSideboard
    ? 'limited sideboarding'
    : 'limited construction';

  return {
    ...deck,
    id: undefined,
    name: limitedDeckAutosaveName(options),
    description: [
      `Autosaved from ${kindLabel} ${source} at ${autosaveTimestamp(now)}.`,
      `${totalCount} card${totalCount === 1 ? '' : 's'} preserved from the live limited deck activity.`,
      deck.description,
    ].filter(Boolean).join(' '),
    format: deck.format || 'Limited',
    createdAt: deck.createdAt ?? now,
    updatedAt: now,
  };
}
