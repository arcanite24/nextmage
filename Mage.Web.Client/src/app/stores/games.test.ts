// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeConnection, type FakeConnection } from '../../test/fakeConnection';

/** Just enough of GameSession for the registry: its constructor arguments, state and disposal. */
class FakeGameSession {
  state: { mode: string; gameOver: unknown; endInfo: unknown };
  dispose = vi.fn();
  constructor(_api: unknown, _events: unknown, readonly options: { gameId: string; playerId: string | null; mode: string }) {
    this.state = { mode: options.mode, gameOver: null, endInfo: null };
  }
  getState() {
    return this.state;
  }
}

async function load() {
  vi.resetModules();
  vi.doMock('../connection', () => createFakeConnection());
  vi.doMock('../../core/game/gameSession', () => ({ GameSession: FakeGameSession }));
  const { useGames } = await import('./games');
  const { useSession } = await import('./session');
  const fake = (await import('../connection')) as unknown as FakeConnection;
  return { useGames, useSession, fake };
}

function session(useGames: Awaited<ReturnType<typeof load>>['useGames'], gameId: string) {
  return useGames.getState().sessions[gameId] as unknown as FakeGameSession;
}

const startGame = (fake: FakeConnection, data: Record<string, unknown>) =>
  fake.rpc.emit({ method: 'START_GAME', messageId: 1, objectId: null, data } as never);

beforeEach(() => {
  localStorage.clear();
});

describe('games store', () => {
  test('START_GAME opens a play session, remembers its table and joins the game', async () => {
    const { useGames, fake } = await load();
    startGame(fake, { gameId: 'g1', playerId: 'p1', currentTableId: 't1', parentTableId: null });
    expect(useGames.getState().latestGameId).toBe('g1');
    expect(session(useGames, 'g1').options).toEqual({ gameId: 'g1', playerId: 'p1', mode: 'play' });
    expect(useGames.getState().tables.g1).toEqual({ tableId: 't1', parentTableId: null });
    expect(fake.api.gameJoin).toHaveBeenCalledWith('g1');
  });

  test('WATCHGAME opens a watch session; opening twice reuses the session', async () => {
    const { useGames, fake } = await load();
    fake.rpc.emit({ method: 'WATCHGAME', messageId: 1, objectId: null, data: { gameId: 'g2' } } as never);
    const first = useGames.getState().sessions.g2;
    expect(first).toBeDefined();
    expect(useGames.getState().open('g2', null, 'watch')).toBe(first);
  });

  test('closing a game in progress quits the match and drops the session', async () => {
    const { useGames, fake } = await load();
    useGames.getState().open('g1', 'p1', 'play', { tableId: 't1', parentTableId: null });
    const game = session(useGames, 'g1');
    useGames.getState().close('g1');
    expect(fake.api.matchQuit).toHaveBeenCalledWith('g1');
    expect(game.dispose).toHaveBeenCalled();
    expect(useGames.getState()).toMatchObject({ sessions: {}, tables: {}, latestGameId: null });
  });

  test('closing a watched game stops watching', async () => {
    const { useGames, fake } = await load();
    useGames.getState().open('g1', null, 'watch');
    useGames.getState().close('g1');
    expect(fake.api.gameWatchStop).toHaveBeenCalledWith('g1');
    expect(fake.api.matchQuit).not.toHaveBeenCalled();
  });

  test('between games of a match, closing leaves the table in the main room', async () => {
    const { useGames, useSession, fake } = await load();
    useSession.setState({ roomId: 'room-1' });
    useGames.getState().open('g1', 'p1', 'play', { tableId: 't1', parentTableId: null });
    session(useGames, 'g1').state.gameOver = true;
    session(useGames, 'g1').state.endInfo = { wins: 1, loses: 0, winsNeeded: 2 };
    useGames.getState().close('g1');
    expect(fake.api.roomLeaveTableOrTournament).toHaveBeenCalledWith('room-1', 't1');
  });

  test('a finished match or an event game sends nothing when closed', async () => {
    const { useGames, useSession, fake } = await load();
    useSession.setState({ roomId: 'room-1' });
    useGames.getState().open('g1', 'p1', 'play', { tableId: 't1', parentTableId: null });
    session(useGames, 'g1').state.gameOver = true;
    session(useGames, 'g1').state.endInfo = { wins: 2, loses: 0, winsNeeded: 2 };
    useGames.getState().open('g2', 'p1', 'play', { tableId: 't2', parentTableId: 'tournament' });
    session(useGames, 'g2').state.gameOver = true;
    useGames.getState().close('g1');
    useGames.getState().close('g2');
    expect(fake.api.roomLeaveTableOrTournament).not.toHaveBeenCalled();
    expect(fake.api.matchQuit).not.toHaveBeenCalled();
  });

  test('closing keeps the latest game pointer on other games, and a failed request is ignored', async () => {
    const { useGames, fake } = await load();
    useGames.getState().open('g1', 'p1', 'play');
    useGames.getState().open('g2', 'p1', 'play');
    fake.api.matchQuit.mockRejectedValueOnce(new Error('gone'));
    useGames.getState().close('g1');
    await Promise.resolve();
    expect(useGames.getState().latestGameId).toBe('g2');
    expect(Object.keys(useGames.getState().sessions)).toEqual(['g2']);
    // closing an unknown game is harmless
    useGames.getState().close('nope');
    expect(Object.keys(useGames.getState().sessions)).toEqual(['g2']);
  });
});
