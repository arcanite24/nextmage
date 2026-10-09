import { describe, expect, it, vi } from 'vitest';
import { createFakeConnection } from '../test/fakeConnection';

vi.mock('./connection', () => createFakeConnection());

const { fillingTableOf } = await import('./queries');

describe('fillingTableOf', () => {
  const seat = (playerName: string) => ({ playerName });
  it('is true while a table we sit at waits for players or for its host to start', () => {
    expect(fillingTableOf([{ tableState: 'WAITING', seats: [seat('alice'), seat('')] }], 'alice')).toBe(true);
    expect(fillingTableOf([{ tableState: 'READY_TO_START', seats: [seat('alice'), seat('bob')] }], 'bob')).toBe(true);
  });
  it('is false for other tables and running games', () => {
    expect(fillingTableOf(undefined, 'alice')).toBe(false);
    expect(fillingTableOf([{ tableState: 'WAITING', seats: [seat('carol')] }], 'alice')).toBe(false);
    expect(fillingTableOf([{ tableState: 'DUELING', seats: [seat('alice')] }], 'alice')).toBe(false);
  });
});
