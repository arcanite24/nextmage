import { afterEach, describe, expect, it } from 'vitest';
import { clearErrors, installGlobalErrorHandlers, recentErrors, reportError, RING_SIZE, setReporter, type ErrorReport } from './reporter';

function collect(): ErrorReport[] {
  const seen: ErrorReport[] = [];
  setReporter((report) => seen.push(report));
  return seen;
}

afterEach(() => {
  setReporter(null);
  clearErrors();
});

describe('reporter', () => {
  it('reports errors, strings and other values to the plugged reporter', () => {
    const seen = collect();
    reportError(new Error('boom'), 'react', { screen: 'game' });
    reportError('plain');
    reportError({ code: 7 });
    expect(seen.map((report) => report.message)).toEqual(['boom', 'plain', '{"code":7}']);
    expect(seen[0]).toMatchObject({ source: 'react', context: { screen: 'game' } });
    expect(seen[0].stack).toContain('boom');
    expect(seen[1].source).toBe('manual');
  });

  it('keeps only the last errors', () => {
    setReporter(() => undefined);
    for (let index = 0; index < RING_SIZE + 5; index += 1) reportError(`e${index}`);
    const recent = recentErrors();
    expect(recent).toHaveLength(RING_SIZE);
    expect(recent[0].message).toBe('e5');
    expect(recent.at(-1)?.message).toBe(`e${RING_SIZE + 4}`);
  });

  it('survives a reporter that throws', () => {
    setReporter(() => {
      throw new Error('reporter down');
    });
    expect(() => reportError('still recorded')).not.toThrow();
    expect(recentErrors()[0].message).toBe('still recorded');
  });

  it('reports uncaught errors and unhandled rejections until uninstalled', () => {
    const seen = collect();
    const target = new EventTarget();
    const uninstall = installGlobalErrorHandlers(target);
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('uncaught') }));
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'rejected' }));
    uninstall();
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('ignored') }));
    expect(seen.map((report) => [report.source, report.message])).toEqual([
      ['error', 'uncaught'],
      ['unhandledrejection', 'rejected'],
    ]);
  });
});
