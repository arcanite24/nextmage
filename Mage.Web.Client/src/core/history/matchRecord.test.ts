import { describe, expect, it } from 'vitest';
import { matchPlayers, matchScores, matchWinner } from './matchRecord';

describe('match record', () => {
  it('reads the players, without quit marks', () => {
    expect(matchPlayers('Alice [quit] , Bob')).toEqual(['Alice', 'Bob']);
    expect(matchPlayers('')).toEqual([]);
  });

  it('reads the scores, with or without draws', () => {
    expect(matchScores('Alice [2-1], Bob [1-2]')).toEqual([{ name: 'Alice', wins: 2, losses: 1 }, { name: 'Bob', wins: 1, losses: 2 }]);
    expect(matchScores('Alice [1-1-0], Bob [0-1-1]')).toEqual([{ name: 'Alice', wins: 1, losses: 0 }, { name: 'Bob', wins: 0, losses: 1 }]);
  });

  it('names the winner only when one player leads', () => {
    expect(matchWinner('Alice [2-1], Bob [1-2]')).toBe('Alice');
    expect(matchWinner('Alice [1-1], Bob [1-1]')).toBeNull();
    expect(matchWinner('Alice [0-0], Bob [0-0]')).toBeNull();
    expect(matchWinner('')).toBeNull();
  });
});
