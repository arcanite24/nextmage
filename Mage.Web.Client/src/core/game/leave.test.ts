import { describe, expect, it } from 'vitest';
import { leaveRequest, matchIsOver, type LeaveContext } from './leave';

const base: LeaveContext = {
  gameId: 'g1',
  mode: 'play',
  gameOver: false,
  endInfo: null,
  tableId: 't1',
  parentTableId: null,
  roomId: 'r1',
};

describe('matchIsOver', () => {
  it('is over once either side reaches the wins needed', () => {
    expect(matchIsOver({ wins: 2, loses: 0, winsNeeded: 2 })).toBe(true);
    expect(matchIsOver({ wins: 1, loses: 2, winsNeeded: 2 })).toBe(true);
    expect(matchIsOver({ wins: 1, loses: 0, winsNeeded: 2 })).toBe(false);
  });

  it('is unknown (not over) without end info', () => {
    expect(matchIsOver(null)).toBe(false);
    expect(matchIsOver({})).toBe(false);
  });
});

describe('leaveRequest', () => {
  it('stops watching a watched game, over or not', () => {
    expect(leaveRequest({ ...base, mode: 'watch' })).toEqual({ method: 'gameWatchStop', gameId: 'g1' });
    expect(leaveRequest({ ...base, mode: 'watch', gameOver: true })).toEqual({ method: 'gameWatchStop', gameId: 'g1' });
  });

  it('stops a replay', () => {
    expect(leaveRequest({ ...base, mode: 'replay' })).toEqual({ method: 'replayStop', gameId: 'g1' });
  });

  it('quits the match when leaving a game in progress', () => {
    expect(leaveRequest(base)).toEqual({ method: 'matchQuit', gameId: 'g1' });
    expect(leaveRequest({ ...base, parentTableId: 'event' })).toEqual({ method: 'matchQuit', gameId: 'g1' });
  });

  it('leaves the table between games of an unfinished match', () => {
    const endInfo = { wins: 1, loses: 0, winsNeeded: 2 };
    expect(leaveRequest({ ...base, gameOver: true, endInfo })).toEqual({ method: 'roomLeaveTableOrTournament', roomId: 'r1', tableId: 't1' });
  });

  it('sends nothing once the match is over', () => {
    expect(leaveRequest({ ...base, gameOver: true, endInfo: { wins: 1, loses: 0, winsNeeded: 1 } })).toBeNull();
  });

  it('leaves event games to the event between games', () => {
    expect(leaveRequest({ ...base, gameOver: true, endInfo: { wins: 0, loses: 1, winsNeeded: 2 }, parentTableId: 'event' })).toBeNull();
  });

  it('sends nothing between games when the table is unknown', () => {
    expect(leaveRequest({ ...base, gameOver: true, tableId: null })).toBeNull();
  });
});
