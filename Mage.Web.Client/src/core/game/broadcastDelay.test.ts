import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { delayLabel, DelayedRelay, DelayQueue, isBroadcastDelay } from './broadcastDelay';

describe('DelayQueue', () => {
  it('passes items straight through with no delay', () => {
    const queue = new DelayQueue<string>();
    expect(queue.push('a', 1000)).toEqual(['a']);
    expect(queue.size).toBe(0);
  });

  it('holds items for the delay and releases them in arrival order', () => {
    const queue = new DelayQueue<string>(30_000);
    expect(queue.push('a', 0)).toEqual([]);
    expect(queue.push('b', 5_000)).toEqual([]);
    expect(queue.nextDueIn(10_000)).toBe(20_000);
    expect(queue.take(29_999)).toEqual([]);
    expect(queue.take(30_000)).toEqual(['a']);
    expect(queue.take(34_000)).toEqual([]);
    expect(queue.take(40_000)).toEqual(['b']);
    expect(queue.nextDueIn(40_000)).toBeNull();
  });

  it('catches up completely when the delay is turned off', () => {
    const queue = new DelayQueue<string>(60_000);
    queue.push('a', 0);
    queue.push('b', 1_000);
    expect(queue.setDelay(0, 2_000)).toEqual(['a', 'b']);
    expect(queue.push('c', 2_500)).toEqual(['c']);
  });

  it('re-times held items when the delay changes', () => {
    const queue = new DelayQueue<string>(120_000);
    queue.push('a', 0);
    queue.push('b', 40_000);
    // a shorter delay: what is now older than it comes out, the rest waits its new time
    expect(queue.setDelay(30_000, 50_000)).toEqual(['a']);
    expect(queue.nextDueIn(50_000)).toBe(20_000);
    // a longer one holds the rest back further
    expect(queue.setDelay(60_000, 60_000)).toEqual([]);
    expect(queue.take(100_000)).toEqual(['b']);
  });
});

describe('DelayedRelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delivers each item when it falls due', () => {
    const seen: number[] = [];
    const relay = new DelayedRelay<number>((item) => seen.push(item), 30_000);
    relay.push(1);
    vi.advanceTimersByTime(10_000);
    relay.push(2);
    expect(relay.pending).toBe(2);
    vi.advanceTimersByTime(19_999);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([1]);
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual([1, 2]);
    expect(relay.pending).toBe(0);
  });

  it('releases everything held at once when the delay is turned off', () => {
    const seen: number[] = [];
    const relay = new DelayedRelay<number>((item) => seen.push(item), 60_000);
    relay.push(1);
    relay.push(2);
    relay.setDelay(0);
    expect(seen).toEqual([1, 2]);
    relay.push(3);
    expect(seen).toEqual([1, 2, 3]);
    // no stray timer delivers anything twice
    vi.advanceTimersByTime(120_000);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('drops what it holds when disposed', () => {
    const seen: number[] = [];
    const relay = new DelayedRelay<number>((item) => seen.push(item), 30_000);
    relay.push(1);
    relay.dispose();
    vi.advanceTimersByTime(60_000);
    expect(seen).toEqual([]);
  });
});

describe('labels', () => {
  it('names the delays', () => {
    expect([0, 30, 60, 120].map(delayLabel)).toEqual(['Off', '30 s', '1 min', '2 min']);
    expect(isBroadcastDelay(60)).toBe(true);
    expect(isBroadcastDelay(45)).toBe(false);
  });
});
