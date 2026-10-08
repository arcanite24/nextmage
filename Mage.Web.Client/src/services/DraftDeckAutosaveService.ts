import type { DeckCardLists } from '../types/index.js';

export function buildDraftAutosaveDeck(
  deck: DeckCardLists,
  draftId: string | null | undefined,
  now = Date.now(),
): DeckCardLists {
  const sourceLabel = draftId ? draftId.slice(0, 8) : 'unknown';
  const pickedCount = deck.cards.reduce((sum, card) => sum + card.amount, 0);
  const savedAt = new Date(now).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');

  return {
    ...deck,
    id: undefined,
    name: `${deck.name || 'Draft Picks'} Autosave ${savedAt}`,
    description: [
      `Autosaved from completed draft ${sourceLabel}.`,
      `${pickedCount} picked card${pickedCount === 1 ? '' : 's'} preserved from the live draft activity.`,
      deck.description,
    ].filter(Boolean).join(' '),
    format: deck.format || 'Limited',
    createdAt: now,
    updatedAt: now,
  };
}
