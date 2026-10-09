import { describe, expect, test } from 'vitest';
import { planSync } from './deckSync';

describe('planSync', () => {
  test('newer side wins for decks both have', () => {
    const plan = planSync(
      [{ id: 'a', updatedAt: 200 }, { id: 'b', updatedAt: 100 }, { id: 'c', updatedAt: 50 }],
      {},
      [{ id: 'a', updatedAt: 100, deleted: false }, { id: 'b', updatedAt: 300, deleted: false }, { id: 'c', updatedAt: 50, deleted: false }],
    );
    expect(plan.upload).toEqual(['a']);
    expect(plan.download).toEqual(['b']);
    expect(plan.deleteLocal).toEqual([]);
  });

  test('decks only one side has go to the other', () => {
    const plan = planSync([{ id: 'mine', updatedAt: 1 }], {}, [{ id: 'theirs', updatedAt: 1, deleted: false }]);
    expect(plan.upload).toEqual(['mine']);
    expect(plan.download).toEqual(['theirs']);
  });

  test('a deck deleted elsewhere goes here too, unless it changed here since', () => {
    const plan = planSync(
      [{ id: 'old', updatedAt: 100 }, { id: 'revived', updatedAt: 500 }],
      {},
      [{ id: 'old', updatedAt: 200, deleted: true }, { id: 'revived', updatedAt: 200, deleted: true }],
    );
    expect(plan.deleteLocal).toEqual(['old']);
    expect(plan.upload).toEqual(['revived']);
  });

  test('a deck deleted here is deleted on the server, unless the server has a newer change', () => {
    const plan = planSync(
      [],
      { gone: 300, changedElsewhere: 100 },
      [{ id: 'gone', updatedAt: 200, deleted: false }, { id: 'changedElsewhere', updatedAt: 200, deleted: false }],
    );
    expect(plan.deleteRemote).toEqual([{ id: 'gone', at: 300 }]);
    expect(plan.download).toEqual(['changedElsewhere']);
    expect(plan.dropTombstones.sort()).toEqual(['changedElsewhere', 'gone']);
  });

  test('tombstones the server already knows about are dropped', () => {
    const plan = planSync([], { a: 100, b: 100 }, [{ id: 'a', updatedAt: 100, deleted: true }]);
    expect(plan.deleteRemote).toEqual([]);
    expect(plan.dropTombstones.sort()).toEqual(['a', 'b']);
  });

  test("another account's decks in this browser are not uploaded", () => {
    const plan = planSync([{ id: 'ana', updatedAt: 1 }, { id: 'bob', updatedAt: 1 }], {}, [], new Set(['bob']));
    expect(plan.upload).toEqual(['ana']);
  });
});
