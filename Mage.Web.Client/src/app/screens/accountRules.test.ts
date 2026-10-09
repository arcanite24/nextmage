import { describe, expect, test } from 'vitest';
import { checkPassword } from './accountRules';

describe('checkPassword', () => {
  test('follows the server rule', () => {
    expect(checkPassword('abc1', 8, 'ana')).toBe('short');
    expect(checkPassword('abcdefgh', 8, 'ana')).toBe('mix');
    expect(checkPassword('12345678', 8, 'ana')).toBe('mix');
    expect(checkPassword('ana12345', 8, 'ana12345')).toBe('name');
    expect(checkPassword('tablE7top', 8, 'ana')).toBeNull();
  });
});
