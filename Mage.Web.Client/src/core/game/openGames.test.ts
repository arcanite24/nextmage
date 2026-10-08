import { describe, expect, it } from 'vitest';
import { forgetGame, forgetOwner, gamesToRestore, OPEN_GAME_MAX_AGE_MS, ownerKey, rememberGame, type OpenGameRecord } from './openGames';

const alice = ownerKey('ws://host:17172', 'Alice');
const bob = ownerKey('ws://host:17172', 'Bob');

function game(gameId: string, openedAt: number, mode: OpenGameRecord['mode'] = 'play'): OpenGameRecord {
  return { gameId, playerId: mode === 'play' ? 'p1' : null, mode, tableId: 't1', parentTableId: null, openedAt };
}

describe('open games book', () => {
  it('keeps games per server and player', () => {
    let book = rememberGame({}, alice, game('g1', 100));
    book = rememberGame(book, bob, game('g2', 100));
    expect(gamesToRestore(book, alice, 200).map((g) => g.gameId)).toEqual(['g1']);
    expect(gamesToRestore(book, bob, 200).map((g) => g.gameId)).toEqual(['g2']);
    // names are matched like the server does: case does not make another player
    expect(ownerKey('ws://host:17172', 'alice')).toBe(alice);
  });

  it('replaces a game opened again and forgets games that are left', () => {
    let book = rememberGame({}, alice, game('g1', 100));
    book = rememberGame(book, alice, game('g2', 150, 'watch'));
    book = rememberGame(book, alice, { ...game('g1', 300) });
    expect(gamesToRestore(book, alice, 400).map((g) => [g.gameId, g.openedAt])).toEqual([['g2', 150], ['g1', 300]]);
    book = forgetGame(book, alice, 'g2');
    expect(gamesToRestore(book, alice, 400).map((g) => g.gameId)).toEqual(['g1']);
    book = forgetGame(book, alice, 'g1');
    expect(book).toEqual({});
    expect(forgetGame(book, alice, 'nope')).toBe(book);
  });

  it('restores oldest first so the newest game ends up on screen, and skips stale ones', () => {
    let book = rememberGame({}, alice, game('new', 5000));
    book = rememberGame(book, alice, game('old', 1000));
    book = rememberGame(book, alice, game('ancient', 0));
    const now = 1000 + OPEN_GAME_MAX_AGE_MS;
    expect(gamesToRestore(book, alice, now).map((g) => g.gameId)).toEqual(['old', 'new']);
  });

  it('keeps a handful of games at most, and forgets everything on a full sign out', () => {
    let book = {};
    for (let i = 0; i < 12; i++) book = rememberGame(book, alice, game(`g${i}`, i));
    expect(gamesToRestore(book, alice, 20).map((g) => g.gameId)).toEqual(['g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11']);
    expect(forgetOwner(book, alice)).toEqual({});
  });

  it('ignores damaged entries', () => {
    const book = { [alice]: [game('g1', 10), { gameId: 'x', mode: 'replay', openedAt: 10 } as never, null as never] };
    expect(gamesToRestore(book, alice, 20).map((g) => g.gameId)).toEqual(['g1']);
  });
});
