import { describe, expect, test } from 'vitest';
import { clothOf, clothStyle, DEFAULT_CLOTH, MAT_CLOTHS } from './playmats';

describe('playmat cloths', () => {
  test('the default cloth is the app mat', () => {
    expect(DEFAULT_CLOTH.id).toBe('green');
    expect(clothOf('nope')).toBe(DEFAULT_CLOTH);
    expect(clothOf(null)).toBe(DEFAULT_CLOTH);
  });

  test('every cloth sets all seven shades and the dye', () => {
    for (const cloth of MAT_CLOTHS) {
      const style = clothStyle(cloth) as Record<string, string>;
      expect(Object.keys(style).sort()).toEqual(['--mat-400', '--mat-500', '--mat-600', '--mat-700', '--mat-800', '--mat-900', '--mat-950', '--print-dye']);
    }
  });

  test('ids are unique', () => {
    expect(new Set(MAT_CLOTHS.map((cloth) => cloth.id)).size).toBe(MAT_CLOTHS.length);
  });
});
