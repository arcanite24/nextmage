import { describe, expect, it } from 'vitest';
import { flagChoices, flagCode, flagGlyph, sigilOf } from './identity';

describe('identity', () => {
  it('reads the server flag file name', () => {
    expect(flagCode('de.png')).toBe('de');
    expect(flagCode('')).toBe('world');
    expect(flagCode(undefined)).toBe('world');
  });

  it('draws country flags with regional indicators', () => {
    expect(flagGlyph('de')).toBe('🇩🇪');
    expect(flagGlyph('world')).toBe('🌐');
    expect(flagGlyph('genderfluid')).toBe('🌐');
  });

  it('maps avatar ids to sigils, with the initial for the default', () => {
    expect(sigilOf(12)).toBe('🐉');
    expect(sigilOf(10)).toBeNull();
    expect(sigilOf(51)).toBeNull();
  });

  it('lists specials first and countries by name', () => {
    const choices = flagChoices();
    expect(choices[0].code).toBe('world');
    expect(choices.some((choice) => choice.code === 'jp')).toBe(true);
    expect(new Set(choices.map((choice) => choice.code)).size).toBe(choices.length);
  });
});
