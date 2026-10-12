import { describe, expect, it, vi } from 'vitest';
import { createFakeConnection } from '../test/fakeConnection';

vi.mock('./connection', () => createFakeConnection());

const { fillingTableOf, slotsFull } = await import('./queries');

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

describe('slotsFull', () => {
  it('is true once every game slot is busy or a game already waits', () => {
    expect(slotsFull({ running: 3, waiting: 0, max: 3 })).toBe(true);
    expect(slotsFull({ running: 2, waiting: 1, max: 3 })).toBe(true);
    expect(slotsFull({ running: 2, waiting: 0, max: 3 })).toBe(false);
  });
  it('is false when the server does not say', () => {
    expect(slotsFull(null)).toBe(false);
    expect(slotsFull({ running: 0, waiting: 0, max: 0 })).toBe(false);
  });
});
