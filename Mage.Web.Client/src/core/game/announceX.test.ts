import { describe, expect, test } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { manaAvailable, xLimit } from './announceX';

describe('announcing X', () => {
  const land = (id: string, subTypes: string[], extra = {}) => ({ id, cardTypes: ['LAND'], subTypes, rules: [], ...extra });
  const view = {
    players: [{
      playerId: 'me',
      manaPool: { red: 1 },
      battlefield: {
        f: land('f', ['FOREST']),
        i: land('i', ['ISLAND'], { tapped: true }),
        m: land('m', ['MOUNTAIN']),
        sol: { id: 'sol', cardTypes: ['ARTIFACT'], rules: ['{T}: Add {C}{C}.'] },
        elf: { id: 'elf', cardTypes: ['CREATURE'], rules: ['{T}: Add {G}.'], summoningSickness: true },
        treasure: { id: 'treasure', cardTypes: ['ARTIFACT'], rules: ['{T}, Sacrifice this artifact: Add one mana of any color.'] },
      },
    }],
    stack: { s: { id: 's', name: 'Fireball', controllerId: 'me', manaValue: 1 } },
  } as unknown as GameView;

  test('counts floating mana and what untapped permanents tap for', () => {
    // pool 1 + Forest + Mountain + Sol Ring 2 + Treasure 1 (the tapped Island and the new Elf don't count)
    expect(manaAvailable(view, 'me')).toBe(6);
    expect(manaAvailable(view, 'bob')).toBe(0);
  });

  test("tops X at the mana left after the rest of the spell's cost", () => {
    expect(xLimit({ text: 'Announce the value for {X} (source: Fireball [2ec])', min: 0, max: 2147483647 }, view, 'me')).toBe(5);
    expect(xLimit({ text: 'Announce the value for {X} (source: Fireball [2ec])', min: 0, max: 3 }, view, 'me')).toBe(3);
    expect(xLimit({ text: 'How many?', min: 0, max: 2147483647 }, view, 'me')).toBeNull();
  });
});
