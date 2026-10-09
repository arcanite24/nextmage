import { describe, expect, it } from 'vitest';
import { cleanText } from './text';

describe('cleanText', () => {
  it('drops object ids', () => {
    expect(cleanText('Choose spell or ability to play Evolving Wilds [a16]')).toBe('Choose spell or ability to play Evolving Wilds');
    expect(cleanText('Announce the value for {X} (source: Fireball [2ec])')).toBe('Announce the value for {X} (source: Fireball)');
  });

  it('drops the space before punctuation', () => {
    expect(cleanText('Pay Kicker {4} ?')).toBe('Pay Kicker {4}?');
    expect(cleanText('Draw a card , then discard .')).toBe('Draw a card, then discard.');
    expect(cleanText('Choose a number from 0 to .5')).toBe('Choose a number from 0 to .5');
  });
});
