import { describe, expect, test } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { nextTip, tipsFor } from './coach';

const land = { id: 'l1', cardTypes: ['LAND'] } as const;
const bear = { id: 'c1', cardTypes: ['CREATURE'] } as const;

function view(patch: Partial<GameView> = {}): GameView {
  return {
    myPlayerId: 'me',
    activePlayerId: 'me',
    step: 'PRECOMBAT_MAIN',
    myHand: { l1: { ...land, cardTypes: ['LAND'] }, c1: { ...bear, cardTypes: ['CREATURE'] } },
    canPlayObjects: { objects: { l1: {}, c1: {} } },
    players: [{ playerId: 'me', battlefield: {} }, { playerId: 'ai', battlefield: {} }],
    ...patch,
  } as GameView;
}

describe('coach tips', () => {
  test('a main phase with a land and a spell in hand teaches both, land first', () => {
    expect(tipsFor({ view: view(), mode: 'priority', awaiting: false })).toEqual(['playLand', 'castSpell']);
  });

  test('decisions with their own screens get their own tip', () => {
    expect(tipsFor({ view: view(), mode: 'mulligan', awaiting: false })).toEqual(['mulligan']);
    expect(tipsFor({ view: view(), mode: 'declareAttackers', awaiting: false })).toEqual(['attack']);
    expect(tipsFor({ view: view(), mode: 'declareBlockers', awaiting: false })).toEqual(['block']);
    expect(tipsFor({ view: view(), mode: 'payMana', awaiting: false })).toEqual(['payMana']);
  });

  test("the opponent's turn is explained once you are waiting on it", () => {
    expect(tipsFor({ view: view({ activePlayerId: 'ai' }), mode: 'waiting', awaiting: false })).toEqual(['theirTurn']);
    expect(tipsFor({ view: view(), mode: 'waiting', awaiting: false })).toEqual([]);
  });

  test('a creature that can attack points at combat', () => {
    const ready = view({
      canPlayObjects: { objects: {} },
      players: [{ playerId: 'me', battlefield: { b: { id: 'b', cardTypes: ['CREATURE'], tapped: false, summoningSickness: false } } }],
    } as Partial<GameView>);
    expect(tipsFor({ view: ready, mode: 'priority', awaiting: false })).toEqual(['toCombat']);
  });

  test('a spell on the stack on their turn invites a response', () => {
    const theirs = view({ activePlayerId: 'ai', step: 'PRECOMBAT_MAIN', stack: { s: { id: 's' } } } as Partial<GameView>);
    expect(tipsFor({ view: theirs, mode: 'priority', awaiting: false })).toEqual(['respond']);
  });

  test('nothing while an answer is on its way', () => {
    expect(tipsFor({ view: view(), mode: 'priority', awaiting: true })).toEqual([]);
  });

  test('each tip shows once', () => {
    expect(nextTip({ view: view(), mode: 'priority', awaiting: false }, new Set(['playLand']))).toBe('castSpell');
    expect(nextTip({ view: view(), mode: 'priority', awaiting: false }, new Set(['playLand', 'castSpell']))).toBeNull();
  });
});
