import { describe, expect, test } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { offBoardTargets } from './offBoardTargets';

const view = {
  players: [
    {
      playerId: 'me',
      graveyard: { v1: { id: 'v1', name: 'Smuggler\'s Copter' }, c1: { id: 'c1', name: 'Shock' } },
      exile: {},
      battlefield: { p1: { id: 'p1', name: 'Greasefang, Okiba Boss' } },
    },
    { playerId: 'them', graveyard: { o1: { id: 'o1', name: 'Fire Elemental' } } },
  ],
  exiles: [{ x1: { id: 'x1', name: 'Llanowar Elves' } }],
} as unknown as GameView;

describe('offBoardTargets', () => {
  test('a choice among graveyard cards lists those cards', () => {
    expect(offBoardTargets(view, ['v1'])?.map((card) => card.name)).toEqual(['Smuggler\'s Copter']);
    expect(offBoardTargets(view, ['v1', 'o1', 'x1'])?.map((card) => card.id)).toEqual(['v1', 'o1', 'x1']);
  });

  test('a choice that includes anything on the board or a player stays on the board', () => {
    expect(offBoardTargets(view, ['v1', 'p1'])).toBeNull();
    expect(offBoardTargets(view, ['v1', 'them'])).toBeNull();
    expect(offBoardTargets(view, [])).toBeNull();
    expect(offBoardTargets(null, ['v1'])).toBeNull();
  });
});
