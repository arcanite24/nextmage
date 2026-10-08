import { create } from 'zustand';
import { api, events } from '../connection';
import { GameSession, type GameSessionMode } from '../../core/game/gameSession';
import { leaveRequest, type LeaveRequest } from '../../core/game/leave';
import { stripMarkup } from '../../core/game/prompt';
import { useSession } from './session';
import { notify } from './toasts';

/** where a game was started from (START_GAME), for leaving its table between games */
interface GameTable {
  tableId: string | null;
  parentTableId: string | null;
}

function send(request: LeaveRequest): Promise<unknown> {
  switch (request.method) {
    case 'gameWatchStop': return api.gameWatchStop(request.gameId);
    case 'replayStop': return api.replayStop(request.gameId);
    case 'matchQuit': return api.matchQuit(request.gameId);
    case 'roomLeaveTableOrTournament': return api.roomLeaveTableOrTournament(request.roomId, request.tableId);
  }
}

/**
 * Games the player is in or watching. The server starts games (START_GAME, WATCHGAME);
 * the registry creates their sessions, joins them and tells the router where to go.
 */
interface GamesState {
  sessions: Record<string, GameSession>;
  /** the game the server most recently opened for us */
  latestGameId: string | null;
  tables: Record<string, GameTable>;
  open(gameId: string, playerId: string | null, mode: GameSessionMode, table?: GameTable): GameSession;
  /** Leave a game: tells the server (stop watching, quit the match...) and drops the local session. */
  close(gameId: string): void;
  /** Drops the local session only (the server has moved on, e.g. to the next game of the match). */
  forget(gameId: string): void;
}

export const useGames = create<GamesState>((set, get) => ({
  sessions: {},
  latestGameId: null,
  tables: {},

  open(gameId, playerId, mode, table) {
    const existing = get().sessions[gameId];
    if (existing) return existing;
    const session = new GameSession(api, events, { gameId, playerId, mode });
    set((state) => ({
      sessions: { ...state.sessions, [gameId]: session },
      tables: table ? { ...state.tables, [gameId]: table } : state.tables,
      latestGameId: gameId,
    }));
    return session;
  },

  close(gameId) {
    const session = get().sessions[gameId];
    if (session) {
      const { mode, gameOver, endInfo } = session.getState();
      const table = get().tables[gameId];
      const request = leaveRequest({
        gameId,
        mode,
        gameOver: !!gameOver,
        endInfo,
        tableId: table?.tableId ?? null,
        parentTableId: table?.parentTableId ?? null,
        roomId: useSession.getState().roomId,
      });
      // best effort: the player is leaving either way, and the server also cleans up when the session ends
      if (request) send(request).catch(() => undefined);
    }
    get().forget(gameId);
  },

  forget(gameId) {
    get().sessions[gameId]?.dispose();
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[gameId];
      const tables = { ...state.tables };
      delete tables[gameId];
      return { sessions, tables, latestGameId: state.latestGameId === gameId ? null : state.latestGameId };
    });
  },
}));

events.on('START_GAME', (message) => {
  const gameId = message?.gameId;
  if (!gameId) return;
  // the next game of a match replaces the finished one at the same table, once the player has moved on to it
  const { sessions, tables } = useGames.getState();
  const finished = Object.entries(sessions)
    .filter(([previousId, session]) => previousId !== gameId && !!session.getState().gameOver
      && !!message.currentTableId && tables[previousId]?.tableId === message.currentTableId)
    .map(([previousId]) => previousId);
  if (finished.length > 0) setTimeout(() => finished.forEach((previousId) => useGames.getState().forget(previousId)), 2000);
  useGames.getState().open(gameId, message.playerId ?? null, 'play', {
    tableId: message.currentTableId ?? null,
    parentTableId: message.parentTableId ?? null,
  });
  api.gameJoin(gameId).catch((error) => notify('Could not join the game', String(error?.message ?? error), 'error'));
});

// errors also reach the game log, but a log line is easy to miss when an action silently fails
events.on('GAME_ERROR', (message, event) => {
  if (event.objectId && !useGames.getState().sessions[event.objectId]) return;
  const text = stripMarkup(message);
  if (text) notify('Game error', text, 'error');
});

events.on('WATCHGAME', (message) => {
  const gameId = message?.gameId;
  if (!gameId) return;
  useGames.getState().open(gameId, null, 'watch');
});
