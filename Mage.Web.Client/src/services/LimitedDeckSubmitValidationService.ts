import type { DeckCardLists } from '../types/index.js';

export const LIMITED_MAIN_DECK_MINIMUM = 40;

export interface LimitedDeckSubmitValidationContext {
  kind: 'construction' | 'sideboard';
  limitedSideboard?: boolean;
  minMainDeckSize?: number;
}

export function countLimitedMainDeckCards(deck: DeckCardLists | null | undefined): number {
  return (deck?.cards ?? []).reduce((sum, card) => sum + Math.max(0, Number(card.amount) || 0), 0);
}

export function getLimitedDeckSubmitValidationError(
  deck: DeckCardLists | null | undefined,
  context: LimitedDeckSubmitValidationContext,
): string | null {
  const isLimitedSubmit = context.kind === 'construction' || context.limitedSideboard === true;
  if (!isLimitedSubmit) return null;

  const minimum = context.minMainDeckSize ?? LIMITED_MAIN_DECK_MINIMUM;
  const mainCount = countLimitedMainDeckCards(deck);
  if (mainCount >= minimum) return null;

  return `Limited deck needs at least ${minimum} main-deck cards before submit (${mainCount}/${minimum}).`;
}
