import { describe, expect, test } from 'vitest';
import { describeAge, formatBytes, formatDuration } from './adminFormat';

describe('admin formatting', () => {
  test('bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(4096)).toBe('4.0 KB');
    expect(formatBytes(300 * 1024)).toBe('300 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
  test('durations and ages', () => {
    expect(formatDuration(5 * 60_000)).toBe('5 min');
    expect(formatDuration(125 * 60_000)).toBe('2 h 5 min');
    expect(formatDuration(50 * 3_600_000)).toBe('2 days 2 h');
    expect(describeAge(1000, 20_000)).toBe('just now');
    expect(describeAge(0, 20_000)).toBe('');
  });
});
