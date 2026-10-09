// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { attention, pendingAttention } from './attention';

function setAway(away: boolean) {
  vi.spyOn(document, 'hasFocus').mockReturnValue(!away);
}

afterEach(() => {
  vi.restoreAllMocks();
  window.dispatchEvent(new Event('focus'));
});

describe('attention', () => {
  test('counts in the tab title while the player is away, and clears when they come back', () => {
    document.title = 'Playmat';
    setAway(true);
    attention('Your move', 'Bob attacks', { tag: 'game:1' });
    attention('Draft pick', 'Pack 1, pick 2', { tag: 'draft' });
    expect(document.title).toBe('(2) Playmat');
    expect(pendingAttention()).toBe(2);

    setAway(false);
    window.dispatchEvent(new Event('focus'));
    expect(document.title).toBe('Playmat');
  });

  test('stays quiet while the player is looking', () => {
    document.title = 'Playmat';
    setAway(false);
    attention('Your move', '', { tag: 'game:1' });
    expect(document.title).toBe('Playmat');
  });
});
