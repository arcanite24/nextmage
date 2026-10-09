import type { GameEndView } from '../../protocol/generated/views';
import { matchProgress } from './matchProgress';

export type GameResult = 'won' | 'lost' | 'draw';

/**
 * How the game ended for this player: from the end-of-game info when the server sent it, otherwise from the
 * server's last message ("Player Bob is the winner", "AI Opponent won the match!"). Null when it can't be told.
 */
export function gameResult(message: string | null | undefined, endInfo: GameEndView | null | undefined, myName: string | null): GameResult | null {
  if (endInfo) {
    if (endInfo.won) return 'won';
    return /\bdraw\b/i.test(endInfo.gameInfo ?? '') ? 'draw' : 'lost';
  }
  const text = message ?? '';
  if (/\bdraw\b/i.test(text)) return 'draw';
  if (/\byou (?:won|win)\b/i.test(text)) return 'won';
  if (/\byou (?:lost|lose)\b/i.test(text)) return 'lost';
  const winner = /^(?:player\s+)?(.+?)\s+(?:is the winner|won the (?:game|match))/i.exec(text.trim())?.[1];
  if (!winner || !myName) return null;
  return winner.toLowerCase() === myName.toLowerCase() ? 'won' : 'lost';
}

/** How a match of several games ended for this player, once it is over; null while it goes on or for single games. */
export function matchResult(endInfo: GameEndView | null | undefined): GameResult | null {
  const progress = matchProgress(endInfo);
  if (!progress?.over) return null;
  // the server names the winner even when the match ended early (a player quit)
  const info = endInfo?.matchInfo ?? '';
  if (/^you won the match/i.test(info)) return 'won';
  if (/won the match/i.test(info)) return 'lost';
  if (progress.wins >= progress.winsNeeded) return 'won';
  if (progress.losses >= progress.winsNeeded) return 'lost';
  return progress.wins === progress.losses ? 'draw' : progress.wins > progress.losses ? 'won' : 'lost';
}
