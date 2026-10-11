import { describe, expect, test } from 'vitest';
import { CLASSIC_BACK, cardBackImage, cardBackOf } from './cardBack';

describe('cardBackOf', () => {
  test('a Career sleeve back wins while painted art is on', () => {
    expect(cardBackOf('/career-art/sleeve/gold.webp', { paintedArt: true, back: 'classic' })).toBe('/career-art/sleeve/gold.webp');
  });

  test('the chosen back otherwise', () => {
    expect(cardBackOf(null, { paintedArt: true, back: 'orrery' })).toBe('/card-back/orrery.webp');
    expect(cardBackOf(null, { paintedArt: true, back: 'classic' })).toBe(CLASSIC_BACK);
  });

  test('painted art off: the classic back still shows, a painted one falls back to the weave', () => {
    expect(cardBackOf('/career-art/sleeve/gold.webp', { paintedArt: false, back: 'classic' })).toBe(CLASSIC_BACK);
    expect(cardBackOf(null, { paintedArt: false, back: 'lantern' })).toBeNull();
  });

  test('an unknown saved id shows the default design', () => {
    expect(cardBackImage('gone' as never)).toBe('/card-back/stitch-hand.webp');
  });
});
