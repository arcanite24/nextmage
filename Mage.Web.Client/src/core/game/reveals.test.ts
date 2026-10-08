import { describe, expect, test } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { cleanRevealTitle, revealGroups, revealLabel, revealSeat } from './reveals';

const view: GameView = {
  myPlayerId: 'me',
  players: [
    { playerId: 'me', graveyard: { g1: { id: 'g1', name: 'Opt', expansionSetCode: 'DOM', cardNumber: '60' } } },
    { playerId: 'them' },
  ],
  revealed: [
    { name: 'Duress [1a2] [3]', cards: { h1: { id: 'h1', name: 'Shock', ownerId: 'them' }, h2: { id: 'h2', name: 'Forest', ownerId: 'them' } } },
    { name: 'Empty', cards: {} },
  ],
  lookedAt: [
    { name: 'Opt [9f0]', cards: { l1: { id: 'l1', expansionSetCode: 'M21', cardNumber: '12' }, g1: { id: 'g1' } } },
  ],
};

describe('revealed and looked-at cards', () => {
  test('titles lose object ids and zone counters', () => {
    expect(cleanRevealTitle('Duress [1a2] [3]')).toBe('Duress');
    expect(cleanRevealTitle("<font color='red'>Thoughtseize</font> [abc] reveals")).toBe('Thoughtseize reveals');
    expect(cleanRevealTitle(undefined)).toBe('');
  });

  test('groups carry their cards, owner and a stable key; empty reveals are skipped', () => {
    const groups = revealGroups(view);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: 'revealed', title: 'Duress', ownerId: 'them' });
    expect(groups[0].cards.map((card) => card.name)).toEqual(['Shock', 'Forest']);
    expect(revealGroups(view)[0].key).toBe(groups[0].key);
    expect(revealLabel(groups[0])).toBe('Revealed: Duress');
  });

  test('looked-at cards use the full card when the game shows it elsewhere, else their printing', () => {
    const looked = revealGroups(view)[1];
    expect(looked.kind).toBe('lookedAt');
    expect(revealLabel(looked)).toBe('Looked at: Opt');
    expect(looked.cards[0]).toEqual({ id: 'l1', expansionSetCode: 'M21', cardNumber: '12', usesVariousArt: undefined });
    expect(looked.cards[1].name).toBe('Opt');
  });

  test('a group sits at its owner\'s seat, or the viewer\'s', () => {
    const [revealed, looked] = revealGroups(view);
    const seats = new Set(['me', 'them']);
    expect(revealSeat(revealed, seats, 'me')).toBe('them');
    expect(revealSeat(looked, seats, 'me')).toBe('me');
    expect(revealGroups(null)).toEqual([]);
  });
});
