import { describe, expect, test } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { dueTip, myTurnNumber, triggered } from './lessons';

function view(patch: Partial<GameView> = {}): GameView {
  return {
    myPlayerId: 'me',
    activePlayerId: 'me',
    turn: 3,
    step: 'PRECOMBAT_MAIN',
    players: [
      { playerId: 'me', life: 20, battlefield: {}, graveyard: {} },
      { playerId: 'ai', life: 20, battlefield: { p: { id: 'p', name: 'Guttersnipe' } }, graveyard: {} },
    ],
    stack: {},
    ...patch,
  } as GameView;
}

const at = (patch: Partial<GameView> = {}, mode: Parameters<typeof triggered>[1]['mode'] = 'priority') => ({ view: view(patch), mode, awaiting: false });

describe('school tips', () => {
  test('the moments with their own screens', () => {
    expect(triggered('mulligan', at({}, 'mulligan'))).toBe(true);
    expect(triggered('attack', at({}, 'declareAttackers'))).toBe(true);
    expect(triggered('block', at({}, 'declareBlockers'))).toBe(true);
    expect(triggered('block', at({}, 'declareAttackers'))).toBe(false);
    expect(triggered('start', at({}, 'waiting'))).toBe(false);
    expect(triggered('start', at())).toBe(true);
  });

  test('your turn counts only your turns, whoever started', () => {
    expect(myTurnNumber(view({ turn: 1 }))).toBe(1);
    expect(myTurnNumber(view({ turn: 2 }))).toBe(1);
    expect(myTurnNumber(view({ turn: 3 }))).toBe(2);
    expect(myTurnNumber(view({ activePlayerId: 'ai' }))).toBeNull();
    expect(triggered('turn:2', at())).toBe(true);
    expect(triggered('turn:3', at())).toBe(false);
  });

  test('cards by name, on the stack or in play, either side', () => {
    expect(triggered('play:Guttersnipe', at())).toBe(true);
    expect(triggered('cast:Lightning Bolt', at({ stack: { s: { id: 's', name: 'Lightning Bolt', controllerId: 'me' } } }))).toBe(true);
    expect(triggered('cast:Counterspell', at())).toBe(false);
  });

  test("an opponent's spell only when you can answer it", () => {
    const stack = { s: { id: 's', name: 'Divination', controllerId: 'ai' } };
    expect(triggered('opponentSpell', at({ stack }))).toBe(true);
    expect(triggered('opponentSpell', at({ stack }, 'waiting'))).toBe(false);
    expect(triggered('opponentSpell', at({ stack: { s: { ...stack.s, controllerId: 'me' } } }))).toBe(false);
  });

  test('life and graveyard thresholds', () => {
    const low = view().players!.map((player) => (player.playerId === 'me' ? { ...player, life: 9, graveyard: { a: {}, b: {} } } : { ...player, life: 4 }));
    expect(triggered('life:10', at({ players: low }))).toBe(true);
    expect(triggered('life:8', at({ players: low }))).toBe(false);
    expect(triggered('opponentLife:5', at({ players: low }))).toBe(true);
    expect(triggered('graveyard:2', at({ players: low }))).toBe(true);
    expect(triggered('graveyard:3', at({ players: low }))).toBe(false);
  });

  test('each tip once, the first due one first, and nothing while an answer is on its way', () => {
    const tips = [{ on: 'attack' }, { on: 'start' }, { on: 'nonsense' }];
    expect(dueTip(tips, at(), new Set())).toBe(1);
    expect(dueTip(tips, at({}, 'declareAttackers'), new Set())).toBe(0);
    expect(dueTip(tips, at({}, 'declareAttackers'), new Set([0, 1]))).toBeNull();
    expect(dueTip(tips, { view: view(), mode: 'priority', awaiting: true }, new Set())).toBeNull();
  });
});
