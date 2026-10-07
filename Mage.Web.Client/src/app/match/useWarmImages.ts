import { useEffect, useRef } from 'react';
import type { CardImageRef } from '../../core/images/imageLinks';
import type { CardView, GameView } from '../../protocol/generated/views';
import { warmCards } from '../ui/imageCache';

function refKey(card: CardImageRef): string {
  return `${card.expansionSetCode ?? card.setCode ?? ''}:${card.cardNumber ?? ''}:${card.name ?? ''}`;
}

/** Every card the view shows or could show next (board, hands, piles, stack and the sources of abilities). */
function cardsIn(view: GameView): CardView[] {
  const cards: CardView[] = [...Object.values(view.myHand ?? {})];
  for (const item of Object.values(view.stack ?? {})) {
    cards.push(item);
    const source = (item as CardView & { sourceCard?: CardView }).sourceCard;
    if (source) cards.push(source);
  }
  for (const player of view.players ?? []) {
    cards.push(...Object.values(player.battlefield ?? {}), ...Object.values(player.graveyard ?? {}), ...Object.values(player.exile ?? {}));
    if (player.topCard) cards.push(player.topCard);
  }
  return cards;
}

/**
 * Keeps the pictures of every card in play downloaded and decoded at board and zoom size, so hovering a card or
 * moving it between zones never waits on the network. New cards are warmed as they appear.
 */
export function useWarmImages(view: GameView | null) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!view) return;
    const fresh = cardsIn(view).filter((card) => {
      if (card.isAbility && !card.expansionSetCode) return false;
      const key = refKey(card);
      if (seen.current.has(key)) return false;
      seen.current.add(key);
      return true;
    });
    if (fresh.length > 0) warmCards(fresh);
  }, [view]);
}
