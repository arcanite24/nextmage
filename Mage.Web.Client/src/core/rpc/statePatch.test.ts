import { describe, expect, test, vi } from 'vitest';
import { GameStateCache, PatchError, applyStatePatch } from './statePatch';
import fixture from './__fixtures__/gameStatePatches.json';

/** Key order counts: compare as text. */
const text = (value: unknown) => JSON.stringify(value);

describe('applyStatePatch', () => {
  test('sets, removes and adds object keys', () => {
    const base = { a: 1, b: { c: 2, d: 3 }, e: 'x' };
    const next = applyStatePatch(base, { a: [5], b: { d: [] }, f: [null] });
    expect(text(next)).toBe(text({ a: 5, b: { c: 2 }, e: 'x', f: null }));
    expect(base).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 'x' });
  });

  test('reorders object keys when told to', () => {
    const base = { a: 1, b: { x: 1 }, c: 3 };
    const next = applyStatePatch(base, ['o', { c: 0, z: [null], b: { x: [2] } }]) as Record<string, unknown>;
    expect(text(next)).toBe(text({ c: 3, z: null, b: { x: 2 } }));
    expect(() => applyStatePatch({}, ['o', { a: 0 }])).toThrow(PatchError);
    expect(() => applyStatePatch([], ['o', {}])).toThrow(PatchError);
  });

  test('null is a value, the empty array a removal', () => {
    expect(applyStatePatch({ a: 1, b: 2 }, { a: [null] })).toEqual({ a: null, b: 2 });
    expect(applyStatePatch({ a: null, b: 2 }, { a: [] })).toEqual({ b: 2 });
    expect(applyStatePatch({ a: 1 }, { a: [[]] })).toEqual({ a: [] });
  });

  test('patches arrays element by element, growing or cutting them', () => {
    expect(applyStatePatch([1, 2, 3], [4, { 1: [9], 3: [4] }])).toEqual([1, 9, 3, 4]);
    expect(applyStatePatch([1, 2, 3], [1, {}])).toEqual([1]);
    expect(applyStatePatch([{ a: 1 }, { b: 2 }], [2, { 1: { b: [3] } }])).toEqual([{ a: 1 }, { b: 3 }]);
    expect(applyStatePatch([1, 2], [[7, 8, 9]])).toEqual([7, 8, 9]);
  });

  test('keeps unchanged parts as they are', () => {
    const base = { players: [{ life: 20, hand: { x: { name: 'Forest' } } }, { life: 20 }], turn: 3 };
    const next = applyStatePatch(base, { players: [2, { 1: { life: [17] } }] }) as typeof base;
    expect(next.players[0]).toBe(base.players[0]);
    expect(next.players[1]).toEqual({ life: 17 });
  });

  test('rejects patches that do not fit', () => {
    expect(() => applyStatePatch([1], { a: [1] })).toThrow(PatchError);
    expect(() => applyStatePatch({ a: 1 }, [2, {}])).toThrow(PatchError);
    expect(() => applyStatePatch([1], [3, { 1: [2] }])).toThrow(PatchError);
    expect(() => applyStatePatch({}, { a: { b: [1] } })).toThrow(PatchError);
    expect(() => applyStatePatch({}, 5)).toThrow(PatchError);
  });

  test('a __proto__ key stays data', () => {
    const next = applyStatePatch({}, JSON.parse('{"__proto__":[{"polluted":true}]}')) as Record<string, unknown>;
    expect(Object.keys(next)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  // real game views from a live game, with the patches the server made for them (Java StateDiffTest checks the
  // same file, so client and server agree on the format)
  test('rebuilds real game views from the server patches', () => {
    const { views, patches } = fixture as { views: unknown[]; patches: unknown[] };
    expect(views.length).toBeGreaterThan(2);
    for (let i = 1; i < views.length; i++) {
      expect(text(applyStatePatch(views[i - 1], patches[i - 1]))).toBe(text(views[i]));
      expect(text(patches[i - 1]).length).toBeLessThan(text(views[i]).length / 2);
    }
  });
});

describe('GameStateCache', () => {
  const view = (life: number) => ({ turn: 1, players: [{ life }, { life: 20 }] });

  test('passes complete states through and rebuilds patched ones', () => {
    const cache = new GameStateCache(() => Promise.resolve(true));
    expect(cache.receive('GAME_UPDATE', 'g', view(20), { seq: 1 })).toEqual({ data: view(20) });
    expect(cache.receive('GAME_UPDATE', 'g', null, { seq: 2, base: 1, patch: { players: [2, { 0: { life: [18] } }] } }))
      .toEqual({ data: view(18) });
    // a question holds the view in gameView
    const question = cache.receive('GAME_ASK', 'g', { message: 'Attack?' }, { seq: 3, base: 2, patch: { turn: [2] } });
    expect(question).toEqual({ data: { message: 'Attack?', gameView: { ...view(18), turn: 2 } } });
    // events without a state are untouched
    expect(cache.receive('CHATMESSAGE', 'c', { text: 'hi' }, null)).toEqual({ data: { text: 'hi' } });
  });

  test('a patch on a lost state asks for the whole state once and drops patches until it comes', async () => {
    const requestResync = vi.fn(() => Promise.resolve(true));
    const cache = new GameStateCache(requestResync);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    cache.receive('GAME_UPDATE', 'g', view(20), { seq: 1 });

    expect(cache.receive('GAME_UPDATE', 'g', null, { seq: 3, base: 2, patch: {} })).toBeUndefined();
    expect(cache.receive('GAME_UPDATE', 'g', null, { seq: 4, base: 3, patch: {} })).toBeUndefined();
    expect(requestResync).toHaveBeenCalledTimes(1);
    expect(requestResync).toHaveBeenCalledWith('g');

    // the server's answer: the complete state, then patches on it
    expect(cache.receive('GAME_UPDATE', 'g', view(15), { seq: 5 })).toEqual({ data: view(15) });
    expect(cache.receive('GAME_UPDATE', 'g', null, { seq: 6, base: 5, patch: { turn: [2] } })).toEqual({ data: { ...view(15), turn: 2 } });
    warn.mockRestore();
  });

  test('a patch that does not apply asks for the whole state too', () => {
    const requestResync = vi.fn(() => Promise.resolve(true));
    const cache = new GameStateCache(requestResync);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    cache.receive('GAME_UPDATE', 'g', view(20), { seq: 1 });
    expect(cache.receive('GAME_UPDATE', 'g', null, { seq: 2, base: 1, patch: { players: { 0: [1] } } })).toBeUndefined();
    expect(requestResync).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('when the server has nothing to resend, the next state is awaited as usual', async () => {
    const requestResync = vi.fn(() => Promise.resolve(false));
    const cache = new GameStateCache(requestResync);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(cache.receive('GAME_UPDATE', 'g', null, { seq: 2, base: 1, patch: {} })).toBeUndefined();
    await vi.waitFor(() => expect(requestResync).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();
    // not stuck dropping: a later patch on a lost base asks again
    expect(cache.receive('GAME_UPDATE', 'g', null, { seq: 3, base: 2, patch: {} })).toBeUndefined();
    expect(requestResync).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  test('forgets a game when it is over', () => {
    const cache = new GameStateCache(() => Promise.resolve(true));
    cache.receive('GAME_UPDATE', 'g', view(20), { seq: 1 });
    cache.receive('REPLAY_UPDATE', 'r', view(20), { seq: 2 });
    expect(cache.size()).toBe(2);
    cache.receive('GAME_OVER', 'g', { message: 'You won' }, null);
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
