/**
 * The server's summary of a finished match (MatchView): players as "Alice [quit] , Bob" and the result as
 * "Alice [2-1], Bob [1-2]" (wins, draws when there were any, losses).
 */
export interface MatchScore {
  name: string;
  wins: number;
  losses: number;
}

export function matchPlayers(players: string | null | undefined): string[] {
  return (players ?? '').split(',').map((name) => name.replace(/\s*\[\w+\]\s*/g, '').trim()).filter(Boolean);
}

export function matchScores(result: string | null | undefined): MatchScore[] {
  const scores: MatchScore[] = [];
  for (const match of (result ?? '').matchAll(/([^,[]+?)\s*\[(\d+)-(?:\d+-)?(\d+)\]/g)) {
    scores.push({ name: match[1].trim(), wins: Number(match[2]), losses: Number(match[3]) });
  }
  return scores;
}

/** Who won the match: the one player with the most game wins; null for a tie or no games. */
export function matchWinner(result: string | null | undefined): string | null {
  const scores = matchScores(result);
  const best = Math.max(0, ...scores.map((score) => score.wins));
  const leaders = scores.filter((score) => score.wins === best);
  return best > 0 && leaders.length === 1 ? leaders[0].name : null;
}
