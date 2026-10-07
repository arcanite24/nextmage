import { create } from 'zustand';
import { api, events } from '../connection';
import { GameSession, type GameSessionMode } from '../../core/game/gameSession';
import { notify } from './toasts';

/**
 * Games the player is in or watching. The server starts games (START_GAME, WATCHGAME);
 * the registry creates their sessions, joins them and tells the router where to go.
 */
interface GamesState {
  sessions: Record<string, GameSession>;
  /** the game the server most recently opened for us */
  latestGameId: string | null;
  open(gameId: string, playerId: string | null, mode: GameSessionMode): GameSession;
  close(gameId: string): void;
}

export const useGames = create<GamesState>((set, get) => ({
  sessions: {},
  latestGameId: null,

  open(gameId, playerId, mode) {
    const existing = get().sessions[gameId];
    if (existing) return existing;
    const session = new GameSession(api, events, { gameId, playerId, mode });
    set((state) => ({ sessions: { ...state.sessions, [gameId]: session }, latestGameId: gameId }));
    return session;
  },

  close(gameId) {
    const session = get().sessions[gameId];
    session?.dispose();
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[gameId];
      return { sessions, latestGameId: state.latestGameId === gameId ? null : state.latestGameId };
    });
  },
}));

events.on('START_GAME', (message) => {
  const gameId = message?.gameId;
  if (!gameId) return;
  useGames.getState().open(gameId, message.playerId ?? null, 'play');
  api.gameJoin(gameId).catch((error) => notify('Could not join the game', String(error?.message ?? error), 'error'));
});

events.on('WATCHGAME', (message) => {
  const gameId = message?.gameId;
  if (!gameId) return;
  useGames.getState().open(gameId, null, 'watch');
});
