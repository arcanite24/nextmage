import type { CardView, GameView, PlayerView, SimpleCardView } from '../../protocol/generated/views';

export interface SpectatorHand {
  cards: CardView[];
  /** show the cards' backs: the hand is unknown, or hidden for the broadcast */
  faceDown: boolean;
}

/**
 * The hand of the player whose seat a watcher (or a replay) looks from. A watcher sees a hand only when its player
 * allowed it (the server then lists it in `watchedHands`, by player name); a replay may carry the recorded player's
 * hand. Anything else, or any hand at all with `hideHands` on, shows as card backs, one per card held.
 */
export function spectatorHand(view: GameView | null | undefined, seat: PlayerView | null | undefined, hideHands: boolean): SpectatorHand | null {
  if (!view || !seat) return null;
  const known = knownHand(view, seat);
  if (known && known.length > 0) return { cards: known, faceDown: hideHands };
  const count = seat.handCount ?? 0;
  if (count <= 0) return null;
  const cards = Array.from({ length: count }, (_, index): CardView => ({ id: `${seat.playerId ?? ''}:hand:${index}` }));
  return { cards, faceDown: true };
}

function knownHand(view: GameView, seat: PlayerView): CardView[] | null {
  const watched = seat.name ? view.watchedHands?.[seat.name] : undefined;
  if (watched) {
    // the server sends whole card views here, though the protocol only promises the picture's reference
    return Object.values(watched).map((card: SimpleCardView & { name?: string }) => ({
      id: card.id,
      name: card.name,
      expansionSetCode: card.expansionSetCode,
      cardNumber: card.cardNumber,
      usesVariousArt: card.usesVariousArt,
    }));
  }
  // a replay of one's own game, seen from one's own seat, carries the hand that was held (a watcher's view has none)
  const held = Object.values(view.myHand ?? {});
  if (held.length > 0 && (!view.myPlayerId || view.myPlayerId === seat.playerId)) return held;
  return null;
}
