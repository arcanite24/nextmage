import type { GameEndView } from '../../protocol/generated/views';

/** Where a match of several games stands after a game ends. */
export interface MatchProgress {
  /** the game that just ended, from 1 */
  gameNumber: number;
  /** best of N */
  bestOf: number;
  wins: number;
  /** the best opponent's wins */
  losses: number;
  winsNeeded: number;
  /** a side has won the match (or it was ended otherwise): no next game */
  over: boolean;
}

/**
 * The match's score from the end-of-game info, or null for single games. The server doesn't fill `loses`, so the
 * opponents' wins come from the players' own counts.
 */
export function matchProgress(endInfo: GameEndView | null | undefined): MatchProgress | null {
  const winsNeeded = endInfo?.winsNeeded ?? 0;
  if (!endInfo || winsNeeded <= 1) return null;
  const me = endInfo.clientPlayer?.playerId;
  const wins = endInfo.wins ?? endInfo.clientPlayer?.wins ?? 0;
  const opponentWins = (endInfo.players ?? [])
    .filter((player) => !me || player.playerId !== me)
    .map((player) => player.wins ?? 0);
  const losses = Math.max(endInfo.loses ?? 0, ...opponentWins);
  const played = endInfo.matchView?.games?.length ?? 0;
  return {
    gameNumber: Math.max(played, wins + losses, 1),
    bestOf: winsNeeded * 2 - 1,
    wins,
    losses,
    winsNeeded,
    over: wins >= winsNeeded || losses >= winsNeeded || !!endInfo.matchView?.endTime,
  };
}
