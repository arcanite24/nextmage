import { describe, expect, it } from 'vitest';
import type { GameView, PlayerView } from '../../protocol/generated/views';
import { spectatorHand } from './spectatorHand';

const alice: PlayerView = { playerId: 'a', name: 'Alice', handCount: 2 };
const shown = { c1: { id: 'c1', expansionSetCode: 'M21', cardNumber: '1' }, c2: { id: 'c2', expansionSetCode: 'M21', cardNumber: '2' } };

describe('spectatorHand', () => {
  it('shows a hand its player lets the watcher see, face up unless hands are hidden', () => {
    const view: GameView = { players: [alice], watchedHands: { Alice: shown } };
    const open = spectatorHand(view, alice, false);
    expect(open?.faceDown).toBe(false);
    expect(open?.cards.map((card) => [card.id, card.expansionSetCode, card.cardNumber])).toEqual([['c1', 'M21', '1'], ['c2', 'M21', '2']]);
    expect(spectatorHand({ watchedHands: { Alice: { c3: { id: 'c3', name: 'Fog' } as never } } }, alice, false)?.cards[0].name).toBe('Fog');
    expect(spectatorHand(view, alice, true)?.faceDown).toBe(true);
  });

  it('shows one back per card when the hand is not known', () => {
    const hand = spectatorHand({ players: [alice] }, alice, false);
    expect(hand).toEqual({ faceDown: true, cards: [{ id: 'a:hand:0' }, { id: 'a:hand:1' }] });
    expect(spectatorHand({ players: [{ ...alice, handCount: 0 }] }, { ...alice, handCount: 0 }, false)).toBeNull();
  });

  it("shows the hand a replay recorded, and hides it on request", () => {
    const view: GameView = { myHand: { c1: { id: 'c1', name: 'Shock' } }, players: [alice] };
    expect(spectatorHand(view, alice, false)?.cards[0].name).toBe('Shock');
    expect(spectatorHand(view, alice, true)?.faceDown).toBe(true);
    // a view that names its player keeps that hand to that seat
    const named: GameView = { ...view, myPlayerId: 'a' };
    expect(spectatorHand(named, { playerId: 'b', name: 'Bob', handCount: 1 }, false)?.cards).toEqual([{ id: 'b:hand:0' }]);
  });
});
