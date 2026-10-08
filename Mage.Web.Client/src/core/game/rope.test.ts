import { describe, expect, test } from 'vitest';
import { ropeSecondsLeft, ropeVisible } from './rope';

describe('the rope', () => {
  test('counts down from the last report between server updates', () => {
    expect(ropeSecondsLeft(20, 1_000, 1_000)).toBe(20);
    expect(ropeSecondsLeft(20, 1_000, 3_500)).toBe(17.5);
    expect(ropeSecondsLeft(2, 0, 10_000)).toBe(0);
    // a clock that went backwards never adds time
    expect(ropeSecondsLeft(5, 2_000, 1_000)).toBe(5);
  });

  test('shows only while the clock runs and in its last stretch', () => {
    expect(ropeVisible(true, true, 12)).toBe(true);
    expect(ropeVisible(true, true, 45)).toBe(false);
    expect(ropeVisible(true, true, 0)).toBe(false);
    expect(ropeVisible(false, true, 12)).toBe(false);
    expect(ropeVisible(true, false, 12)).toBe(false);
  });
});
