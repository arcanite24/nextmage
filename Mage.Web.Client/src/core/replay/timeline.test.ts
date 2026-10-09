import { describe, expect, it } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { appendEvents, describeResult, EMPTY_TIMELINE, frameDelay, logsAt, MAX_STEP_MS, MIN_STEP_MS, replayWinner, turnJump, turnStarts, viewAt } from './timeline';

const view = (turn: number, activePlayerName = 'Alice'): GameView => ({ turn, activePlayerName });

describe('replay timeline', () => {
  const timeline = appendEvents(EMPTY_TIMELINE, [
    { t: 0, view: view(1) },
    { t: 100, log: { message: 'Alice plays Forest' } },
    { t: 200, view: view(1), myHand: { a: { id: 'a', name: 'Bear' } } },
    { t: 5000, log: { message: 'TURN 2 for Bob' } },
    { t: 5100, view: view(2, 'Bob') },
    { t: 5200, view: view(2, 'Bob') },
    { t: 9000, view: view(3) },
  ]);

  it('collects frames and the log lines before each', () => {
    expect(timeline.frames).toHaveLength(5);
    expect(timeline.read).toBe(7);
    expect(logsAt(timeline, 0)).toEqual([]);
    expect(logsAt(timeline, 1).map((line) => line.message)).toEqual(['Alice plays Forest']);
    expect(logsAt(timeline, 2)).toHaveLength(2);
  });

  it('pages in more events', () => {
    const more = appendEvents(timeline, [{ t: 9500, log: { message: 'Bob concedes' } }, { t: 9600, view: view(3) }]);
    expect(more.frames).toHaveLength(6);
    expect(logsAt(more, 5)).toHaveLength(3);
    expect(more.read).toBe(9);
  });

  it('keeps playback between a glance and a beat', () => {
    expect(frameDelay(timeline, 2, 1)).toBe(MIN_STEP_MS);
    expect(frameDelay(timeline, 1, 1)).toBe(MAX_STEP_MS);
    expect(frameDelay(timeline, 3, 2)).toBe(MAX_STEP_MS / 2);
  });

  it('finds turns and jumps between them', () => {
    expect(turnStarts(timeline)).toEqual([
      { index: 0, turn: 1, player: 'Alice' },
      { index: 2, turn: 2, player: 'Bob' },
      { index: 4, turn: 3, player: 'Alice' },
    ]);
    expect(turnJump(timeline, 0, 1)).toBe(2);
    expect(turnJump(timeline, 3, 1)).toBe(4);
    expect(turnJump(timeline, 3, -1)).toBe(2);
    expect(turnJump(timeline, 2, -1)).toBe(0);
    expect(turnJump(timeline, 4, 1)).toBe(4);
  });

  it("shows the viewer's hand only from their own seat", () => {
    const frame = timeline.frames[1];
    expect(viewAt(frame, true).myHand).toEqual({ a: { id: 'a', name: 'Bear' } });
    expect(viewAt(frame, false).myHand).toBeUndefined();
  });
});

describe('replay results', () => {
  it('reads the winner from the server line', () => {
    expect(replayWinner('Player Bob is the winner')).toBe('Bob');
    expect(replayWinner('Game is a draw')).toBeNull();
    expect(describeResult('Player Bob is the winner')).toBe('Bob won');
    expect(describeResult('Game is a draw')).toBe('Draw');
    expect(describeResult(undefined)).toBe('Not finished');
  });
});
