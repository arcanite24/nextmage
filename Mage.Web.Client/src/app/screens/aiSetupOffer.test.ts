import { describe, expect, it } from 'vitest';
import { offeredAiTypes, seatableAiType } from './aiSetup';

describe('AI types a server offers', () => {
  it('lists every type until the server has said, then only the ones it has', () => {
    expect(offeredAiTypes(undefined).map((item) => item.value)).toEqual(['COMPUTER_MAD', 'COMPUTER_MONTE_CARLO']);
    expect(offeredAiTypes(['HUMAN', 'COMPUTER_MAD']).map((item) => item.value)).toEqual(['COMPUTER_MAD']);
  });

  it('seats the standard AI when the chosen one is not offered', () => {
    expect(seatableAiType('COMPUTER_MONTE_CARLO', ['HUMAN', 'COMPUTER_MAD'])).toBe('COMPUTER_MAD');
    expect(seatableAiType('COMPUTER_MONTE_CARLO', undefined)).toBe('COMPUTER_MONTE_CARLO');
    expect(seatableAiType('COMPUTER_MONTE_CARLO', ['COMPUTER_MONTE_CARLO'])).toBe('COMPUTER_MONTE_CARLO');
  });
});
