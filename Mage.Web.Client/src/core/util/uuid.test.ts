import { describe, expect, it } from 'vitest';
import { newId } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('uses crypto.randomUUID when the page is a secure context', () => {
    expect(newId()).toMatch(V4);
  });

  it('builds a v4 UUID without randomUUID (plain HTTP on the LAN)', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const id = newId();
      expect(id).toMatch(V4);
      expect(newId()).not.toBe(id);
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
    expect(typeof crypto.randomUUID).toBe('function');
  });
});
