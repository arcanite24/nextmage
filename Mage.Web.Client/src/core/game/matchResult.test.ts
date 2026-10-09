import { describe, expect, it } from 'vitest';
import type { GameEndView } from '../../protocol/generated/views';
import { gameResult, matchResult } from './matchResult';

describe('gameResult', () => {
  it('trusts the end-of-game info', () => {
    expect(gameResult('whatever', { won: true }, 'alice')).toBe('won');
    expect(gameResult('whatever', { won: false, gameInfo: 'You lost the game on turn 5.' }, 'alice')).toBe('lost');
    expect(gameResult('whatever', { won: false, gameInfo: 'Game is a draw on Turn 9.' }, 'alice')).toBe('draw');
  });

  it("reads the server's message when there is no end-of-game info", () => {
    expect(gameResult('Player bashalice is the winner', null, 'bashalice')).toBe('won');
    expect(gameResult('Player bashalice is the winner', null, 'bashbob')).toBe('lost');
    expect(gameResult('AI Opponent won the match!', null, 'bashbob')).toBe('lost');
    expect(gameResult('The game is a draw', null, 'bashbob')).toBe('draw');
    expect(gameResult('Game over', null, 'bashbob')).toBeNull();
  });
});

describe('matchResult', () => {
  const players = (mine: number, theirs: number) => [{ playerId: 'me', wins: mine }, { playerId: 'bob', wins: theirs }];
  it('is the match score once the match is over', () => {
    expect(matchResult({ winsNeeded: 2, wins: 2, clientPlayer: { playerId: 'me' }, players: players(2, 0) })).toBe('won');
    expect(matchResult({ winsNeeded: 2, wins: 1, clientPlayer: { playerId: 'me' }, players: players(1, 2) })).toBe('lost');
  });

  it('takes the named winner when the match ended early', () => {
    const early = { winsNeeded: 2, wins: 1, clientPlayer: { playerId: 'me' }, players: players(1, 0), matchView: { endTime: 1 }, matchInfo: 'You won the match!' };
    expect(matchResult(early as GameEndView)).toBe('won');
  });

  it('says nothing while the match goes on, or for a single game', () => {
    expect(matchResult({ winsNeeded: 2, wins: 1, clientPlayer: { playerId: 'me' }, players: players(1, 0) })).toBeNull();
    expect(matchResult({ winsNeeded: 1, wins: 1 })).toBeNull();
  });
});
