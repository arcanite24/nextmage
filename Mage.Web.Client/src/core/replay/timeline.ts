import type { CardView, ChatMessage, GameView } from '../../protocol/generated/views';
import type { ReplayEvent } from '../../protocol/options';

export type { ReplayEvent };

export interface ReplayFrame {
  at: number;
  view: GameView;
  myHand: Record<string, CardView> | null;
  /** how many log lines had been written when this snapshot was taken */
  logCount: number;
}

export interface ReplayTimeline {
  frames: ReplayFrame[];
  logs: ChatMessage[];
  /** events read so far (for paging) */
  read: number;
}

export const EMPTY_TIMELINE: ReplayTimeline = { frames: [], logs: [], read: 0 };

/** The timeline with a page of events added. */
export function appendEvents(timeline: ReplayTimeline, events: readonly ReplayEvent[]): ReplayTimeline {
  if (events.length === 0) return timeline;
  const frames = [...timeline.frames];
  const logs = [...timeline.logs];
  for (const event of events) {
    if (event.log) logs.push(event.log);
    if (event.view) frames.push({ at: event.t ?? frames[frames.length - 1]?.at ?? 0, view: event.view, myHand: event.myHand ?? null, logCount: logs.length });
  }
  return { frames, logs, read: timeline.read + events.length };
}

/** The log as it stood at a frame. */
export function logsAt(timeline: ReplayTimeline, index: number): ChatMessage[] {
  const frame = timeline.frames[index];
  return frame ? timeline.logs.slice(0, frame.logCount) : [];
}

export const MIN_STEP_MS = 250;
export const MAX_STEP_MS = 2500;

/**
 * How long playback stays on a frame: the real time until the next one, kept between a glance and a beat so fast
 * sequences stay readable and long thinks don't stall the replay.
 */
export function frameDelay(timeline: ReplayTimeline, index: number, speed: number): number {
  const frame = timeline.frames[index];
  const next = timeline.frames[index + 1];
  const real = frame && next ? next.at - frame.at : MAX_STEP_MS;
  return Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, real)) / Math.max(0.25, speed);
}

/** Frames where a new turn begins, with the turn number and whose it is. */
export function turnStarts(timeline: ReplayTimeline): { index: number; turn: number; player: string | null }[] {
  const starts: { index: number; turn: number; player: string | null }[] = [];
  let turn = -1;
  timeline.frames.forEach((frame, index) => {
    const current = frame.view.turn ?? 0;
    if (current !== turn) {
      turn = current;
      starts.push({ index, turn: current, player: frame.view.activePlayerName ?? null });
    }
  });
  return starts;
}

/** The frame to jump to for the previous (-1) or next (+1) turn from `index`. */
export function turnJump(timeline: ReplayTimeline, index: number, direction: -1 | 1): number {
  const starts = turnStarts(timeline).map((start) => start.index);
  if (direction > 0) return starts.find((start) => start > index) ?? Math.max(0, timeline.frames.length - 1);
  // back: to the start of this turn, or of the one before when already at its start
  const earlier = starts.filter((start) => start < index);
  return earlier.length > 0 ? earlier[earlier.length - 1] : 0;
}

/** The snapshot to show for a frame, from the chosen seat: the viewer's own hand only from their own seat. */
export function viewAt(frame: ReplayFrame, ownSeat: boolean): GameView {
  if (!ownSeat || !frame.myHand) return frame.view;
  return { ...frame.view, myHand: frame.myHand };
}

/** The winner's name from a recorded result ("Player Bob is the winner"); null for a draw or an unfinished game. */
export function replayWinner(result: string | null | undefined): string | null {
  return /^Player (.+) is the winner$/.exec(result ?? '')?.[1] ?? null;
}

/** A recorded result as a short line: "Bob won", "Draw", "Not finished". */
export function describeResult(result: string | null | undefined): string {
  const winner = replayWinner(result);
  if (winner) return `${winner} won`;
  if (/draw/i.test(result ?? '')) return 'Draw';
  return result ? result : 'Not finished';
}
