import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import type { EventBus } from '../rpc/EventBus';
import { GameSession } from './gameSession';

type Handler = (data: unknown, event: { objectId: string | null }) => void;

/** A bus the test drives by hand: emit(method, data) delivers to the session. */
function fakeBus() {
  const handlers = new Map<string, Handler[]>();
  const bus = {
    on(method: string, handler: Handler) {
      handlers.set(method, [...(handlers.get(method) ?? []), handler]);
      return () => undefined;
    },
  } as unknown as EventBus;
  const emit = (method: string, data: unknown) => handlers.get(method)?.forEach((handler) => handler(data, { objectId: 'g1' }));
  return { bus, emit };
}

const playable = { canPlayObjects: { objects: { land: { basicPlayAbilities: [{}] } } } } as unknown as Partial<GameView>;
const base: GameView = { myPlayerId: 'me', turn: 4, step: 'PRECOMBAT_MAIN' };

describe('GameSession', () => {
  it('keeps the playables of an open priority prompt when an update arrives without them', () => {
    const { bus, emit } = fakeBus();
    const session = new GameSession({} as never, bus, { gameId: 'g1', playerId: 'me', mode: 'play' });
    emit('GAME_SELECT', { message: 'Play spells and abilities', gameView: { ...base, ...playable } });
    expect(session.getState().interaction.clickable.has('land')).toBe(true);

    // the server built this update while priority was elsewhere: no playable list
    emit('GAME_UPDATE', { ...base, turn: 4 });
    expect(Object.keys(session.getState().view?.canPlayObjects?.objects ?? {})).toEqual(['land']);
    expect(session.getState().interaction.clickable.has('land')).toBe(true);
  });

  it('takes a new prompt view as is, even with nothing playable', () => {
    const { bus, emit } = fakeBus();
    const session = new GameSession({} as never, bus, { gameId: 'g1', playerId: 'me', mode: 'play' });
    emit('GAME_SELECT', { message: 'Play spells and abilities', gameView: { ...base, ...playable } });
    emit('GAME_SELECT', { message: 'Play spells and abilities', gameView: { ...base, step: 'POSTCOMBAT_MAIN' } });
    expect(session.getState().view?.canPlayObjects).toBeUndefined();
  });
});

function fakeApi() {
  const calls: string[] = [];
  const api = {
    sendPlayerBoolean: vi.fn(async () => { calls.push('boolean'); return true; }),
    gameResync: vi.fn(async () => { calls.push('resync'); return true; }),
    sendPlayerAction: vi.fn(async () => { calls.push('action'); return true; }),
  };
  return { api, calls };
}

describe('GameSession reply timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function started() {
    const { bus, emit } = fakeBus();
    const { api, calls } = fakeApi();
    const session = new GameSession(api as never, bus, { gameId: 'g1', playerId: 'me', mode: 'play' }, { replyTimeoutMs: 1000 });
    emit('GAME_SELECT', { message: 'Play spells and abilities', gameView: base });
    return { session, emit, api, calls };
  }

  it('opens input again when the server says nothing after an answer', async () => {
    const { session } = started();
    await session.respond({ type: 'boolean', value: false });
    expect(session.getState()).toMatchObject({ awaitingServer: true, stalled: false });
    vi.advanceTimersByTime(999);
    expect(session.getState().stalled).toBe(false);
    vi.advanceTimersByTime(1);
    expect(session.getState()).toMatchObject({ awaitingServer: false, stalled: true });
  });

  it('keeps waiting while the server is busy with the game', async () => {
    const { session, emit } = started();
    await session.respond({ type: 'boolean', value: false });
    vi.advanceTimersByTime(800);
    emit('GAME_UPDATE', { ...base, step: 'BEGIN_COMBAT' });
    vi.advanceTimersByTime(800);
    expect(session.getState()).toMatchObject({ awaitingServer: true, stalled: false });
    vi.advanceTimersByTime(200);
    expect(session.getState().stalled).toBe(true);
  });

  it('a new question ends the wait and the stall', async () => {
    const { session, emit } = started();
    await session.respond({ type: 'boolean', value: false });
    vi.advanceTimersByTime(1000);
    emit('GAME_SELECT', { message: 'Play spells and abilities', gameView: base });
    expect(session.getState()).toMatchObject({ awaitingServer: false, stalled: false });
    vi.advanceTimersByTime(5000);
    expect(session.getState().stalled).toBe(false);
  });

  it('player actions never wait for a reply', async () => {
    const { session } = started();
    await session.respond({ type: 'action', action: 'HOLD_PRIORITY' });
    vi.advanceTimersByTime(5000);
    expect(session.getState()).toMatchObject({ awaitingServer: false, stalled: false });
  });

  it('can send the last answer again or ask for the open question', async () => {
    const { session, calls } = started();
    await session.respond({ type: 'boolean', value: false });
    vi.advanceTimersByTime(1000);
    await session.resend();
    expect(calls).toEqual(['boolean', 'boolean']);
    expect(session.getState()).toMatchObject({ awaitingServer: true, stalled: false });
    vi.advanceTimersByTime(1000);
    expect(await session.resync()).toBe(true);
    expect(calls).toEqual(['boolean', 'boolean', 'resync']);
    expect(session.getState()).toMatchObject({ awaitingServer: false, stalled: false });
  });
});
