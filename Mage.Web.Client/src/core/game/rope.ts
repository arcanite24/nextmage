/**
 * The rope: a player's priority clock, drawn when little time is left. The server only reports the time left with
 * each update, so between updates the client counts down from the moment that report arrived.
 */

/** The rope appears for the last this many seconds. */
export const ROPE_SECONDS = 30;

/** Seconds left now, given the server's report and when (local clock, ms) it arrived. */
export function ropeSecondsLeft(reportedSecs: number, receivedAtMs: number, nowMs: number): number {
  return Math.max(0, reportedSecs - Math.max(0, nowMs - receivedAtMs) / 1000);
}

/** Whether the rope shows: the player's clock is running and is into its last stretch. */
export function ropeVisible(timerActive: boolean | undefined, hasPriority: boolean | undefined, secondsLeft: number): boolean {
  return !!timerActive && !!hasPriority && secondsLeft > 0 && secondsLeft < ROPE_SECONDS;
}
