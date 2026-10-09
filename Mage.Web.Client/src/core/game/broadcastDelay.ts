/**
 * Broadcast delay for watchers: what arrives from the server is held back and shown a fixed time later, so a
 * stream of the watched game can't be used to ghost the players (the stream is what its viewers see).
 */

/** The delays on offer, in seconds (0: off). */
export const BROADCAST_DELAYS = [0, 30, 60, 120] as const;
export type BroadcastDelay = (typeof BROADCAST_DELAYS)[number];

export function isBroadcastDelay(value: unknown): value is BroadcastDelay {
  return BROADCAST_DELAYS.includes(value as BroadcastDelay);
}

/** "Off", "30 s", "1 min", "2 min". */
export function delayLabel(seconds: number): string {
  if (seconds <= 0) return 'Off';
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

/**
 * Items in arrival order, each due its arrival time plus the delay. Pure: the caller passes the time in.
 * Changing the delay re-times what is still held; turning it off releases everything at once.
 */
export class DelayQueue<T> {
  private items: { at: number; item: T }[] = [];

  constructor(private delayMs = 0) {}

  get delay(): number {
    return this.delayMs;
  }

  get size(): number {
    return this.items.length;
  }

  /** Queues an item that arrived at `now`; returns whatever is due (the item itself, with no delay). */
  push(item: T, now: number): T[] {
    this.items.push({ at: now, item });
    return this.take(now);
  }

  /** Returns the items now due, oldest first, and forgets them. */
  take(now: number): T[] {
    let due = 0;
    while (due < this.items.length && this.items[due].at + this.delayMs <= now) due++;
    if (due === 0) return [];
    return this.items.splice(0, due).map((entry) => entry.item);
  }

  /** Changes the delay; returns what that makes due (a shorter delay catches up, off catches up completely). */
  setDelay(delayMs: number, now: number): T[] {
    this.delayMs = Math.max(0, delayMs);
    return this.take(now);
  }

  /** Milliseconds until the oldest held item is due, or null when nothing is held. */
  nextDueIn(now: number): number | null {
    const first = this.items[0];
    return first ? Math.max(0, first.at + this.delayMs - now) : null;
  }

  clear(): void {
    this.items = [];
  }
}

export interface RelayClock {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realClock: RelayClock = {
  now: () => Date.now(),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** A DelayQueue on a timer: each item is handed to `deliver` when it falls due. */
export class DelayedRelay<T> {
  private readonly queue: DelayQueue<T>;
  private timer: unknown = null;

  constructor(private readonly deliver: (item: T) => void, delayMs = 0, private readonly clock: RelayClock = realClock) {
    this.queue = new DelayQueue<T>(delayMs);
  }

  get delay(): number {
    return this.queue.delay;
  }

  /** items received and not shown yet */
  get pending(): number {
    return this.queue.size;
  }

  push(item: T): void {
    this.release(this.queue.push(item, this.clock.now()));
  }

  setDelay(delayMs: number): void {
    this.release(this.queue.setDelay(delayMs, this.clock.now()));
  }

  dispose(): void {
    this.stop();
    this.queue.clear();
  }

  private stop(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private release(items: T[]): void {
    items.forEach((item) => this.deliver(item));
    this.stop();
    const wait = this.queue.nextDueIn(this.clock.now());
    if (wait === null) return;
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this.release(this.queue.take(this.clock.now()));
    }, wait);
  }
}
