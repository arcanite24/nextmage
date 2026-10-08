import { describe, expect, it } from 'vitest';
import type { GameEndView } from '../../protocol/generated/views';
import { matchProgress } from './matchProgress';

function end(wins: number, theirWins: number, games: number, extra: Partial<GameEndView> = {}): GameEndView {
  return {
    winsNeeded: 2,
    wins,
    loses: 0,
    clientPlayer: { playerId: 'me', wins },
    players: [{ playerId: 'me', wins }, { playerId: 'them', wins: theirWins }],
    matchView: { games: Array.from({ length: games }, (_, i) => `g${i}`) },
    ...extra,
  };
}

describe('matchProgress', () => {
  it('is null for single games', () => {
    expect(matchProgress(null)).toBeNull();
    expect(matchProgress({ winsNeeded: 1, wins: 1 })).toBeNull();
  });

  it('scores a best of three between games', () => {
    expect(matchProgress(end(1, 0, 1))).toEqual({ gameNumber: 1, bestOf: 3, wins: 1, losses: 0, winsNeeded: 2, over: false });
    expect(matchProgress(end(1, 1, 2))).toMatchObject({ gameNumber: 2, over: false });
  });

  it('takes the losses from the opponents, since the server leaves them at 0', () => {
    expect(matchProgress(end(0, 2, 2))).toMatchObject({ wins: 0, losses: 2, over: true });
    expect(matchProgress(end(2, 1, 3))).toMatchObject({ gameNumber: 3, over: true });
  });

  it('is over when the match has ended otherwise (a player quit)', () => {
    expect(matchProgress(end(0, 0, 1, { matchView: { games: ['g0'], endTime: 1 } }))).toMatchObject({ over: true });
  });
});
