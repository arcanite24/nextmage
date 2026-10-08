import { describe, expect, it } from 'vitest';
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
