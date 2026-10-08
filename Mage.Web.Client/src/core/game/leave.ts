import type { GameEndView } from '../../protocol/generated/views';
import type { GameSessionMode } from './gameSession';
import { matchProgress } from './matchProgress';

/** What the server must hear when the player closes a game, so it stops treating them as present. */
export type LeaveRequest =
  | { method: 'gameWatchStop'; gameId: string }
  | { method: 'replayStop'; gameId: string }
  | { method: 'matchQuit'; gameId: string }
  | { method: 'roomLeaveTableOrTournament'; roomId: string; tableId: string };

export interface LeaveContext {
  gameId: string;
  mode: GameSessionMode;
  /** the game has ended (GAME_OVER) */
  gameOver: boolean;
  endInfo: GameEndView | null;
  /** the table the game was started from (START_GAME), if known */
  tableId: string | null;
  /** set when the game belongs to a tournament: the event, not this table, owns the player's seat */
  parentTableId: string | null;
  roomId: string | null;
}

/** True once one side has won enough games: the table is finished and nothing is left to quit. */
export function matchIsOver(endInfo: GameEndView | null): boolean {
  if (!endInfo?.winsNeeded) return false;
  // a single game is over with the game
  return matchProgress(endInfo)?.over ?? true;
}

/**
 * The request (if any) that leaving a game sends.
 * - watching: stop watching, or the server keeps streaming the game to us;
 * - a game in progress: quit the match (the server concedes the game and the rest of the match);
 * - between games of a match that isn't over: the game is gone on the server, so leave the table, which quits the
 *   match. Event games are left alone: the event screen is where the player goes, and the event decides what's next.
 */
export function leaveRequest(context: LeaveContext): LeaveRequest | null {
  const { gameId, mode } = context;
  if (mode === 'watch') return { method: 'gameWatchStop', gameId };
  if (mode === 'replay') return { method: 'replayStop', gameId };
  if (!context.gameOver) return { method: 'matchQuit', gameId };
  if (context.parentTableId || matchIsOver(context.endInfo)) return null;
  if (!context.roomId || !context.tableId) return null;
  return { method: 'roomLeaveTableOrTournament', roomId: context.roomId, tableId: context.tableId };
}
