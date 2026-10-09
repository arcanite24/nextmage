import { describe, expect, test, vi } from 'vitest';
import { serverReporter } from './serverReporter';

describe('serverReporter', () => {
  test('sends errors without the query string, once a minute per message', async () => {
    const send = vi.fn(() => Promise.resolve(true));
    let now = 1_000;
    const report = serverReporter(send, { path: () => '/game/1?token=secret#x', appVersion: '1.2', now: () => now });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    report({ time: 0, source: 'error', message: 'boom', stack: 'at x', context: { gameId: 'g1' } });
    report({ time: 0, source: 'error', message: 'boom' });
    now += 61_000;
    report({ time: 0, source: 'error', message: 'boom' });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]).toEqual([expect.objectContaining({
      message: 'boom', stack: 'at x', source: 'error', path: '/game/1', appVersion: '1.2', context: '{"gameId":"g1"}',
    })]);
  });

  test('a failed send is ignored', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const report = serverReporter(() => Promise.reject(new Error('offline')), { path: () => '/' });
    expect(() => report({ time: 0, source: 'manual', message: 'x' })).not.toThrow();
  });
});
