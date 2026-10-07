import { describe, expect, it } from 'vitest';
import { isStackAbility } from './cards';

describe('isStackAbility', () => {
  it('recognises abilities as the server sends them (no isAbility flag)', () => {
    expect(isStackAbility({ name: 'Ability', sourceCard: { name: 'Augmenting Automaton' } } as never)).toBe(true);
    expect(isStackAbility({ name: 'Ability', mageObjectType: 'ABILITY_STACK_FROM_CARD' })).toBe(true);
  });
  it('treats spells as spells', () => {
    expect(isStackAbility({ name: 'Lightning Bolt', mageObjectType: 'SPELL' } as never)).toBe(false);
  });
});
