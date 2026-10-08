import { describe, expect, it } from 'vitest';
import { legalityLine } from './legality';

describe('legalityLine', () => {
  it('says deck and sideboard sizes to the player', () => {
    expect(legalityLine('Deck', 'Must contain at least 60 cards: has only 58 cards', 'Constructed - Modern')).toBe('Your deck has 58 cards. Modern needs 60.');
    expect(legalityLine('Sideboard', 'Must contain no more than 15 cards : has 17 cards', 'Constructed - Modern')).toBe('Your sideboard has 17. The limit is 15.');
    expect(legalityLine('Deck', 'Must contain 100 cards: has 98 cards', 'Variant Magic - Commander')).toBe('Your deck has 98 cards. Commander needs exactly 100.');
  });

  it('names banned cards and keeps anything else readable', () => {
    expect(legalityLine('Grief', 'Banned', 'Constructed - Modern')).toBe('Grief is banned in Modern.');
    expect(legalityLine('Fire // Ice', 'Invalid color identity  (includes {R})', 'Variant Magic - Commander')).toBe('Fire // Ice: Invalid color identity (includes {R})');
  });
});
