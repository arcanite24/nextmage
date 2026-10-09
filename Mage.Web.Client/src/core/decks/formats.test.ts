import { describe, expect, it } from 'vitest';
import { canCommand, commanderIdentity, formatMenu, formatRules, gameTypesFor, isCommanderFormat, parseIdentity, withinIdentity } from './formats';

const SERVER_GAME_TYPES = [
  'Two Player Duel', 'Free For All', 'Commander Two Player Duel', 'Commander Free For All', 'Tiny Leaders Two Player Duel',
  'Canadian Highlander Two Player Duel', 'Brawl Two Player Duel', 'Brawl Free For All', 'Momir Basic Two Player Duel',
];

describe('formatRules', () => {
  it('knows the command zone formats', () => {
    expect(formatRules('Variant Magic - Commander')).toMatchObject({ family: 'commander', singleton: true, deckSize: 100, commandZone: { min: 1, max: 2 } });
    expect(formatRules('Variant Magic - Brawl')).toMatchObject({ deckSize: 60, singleton: true });
    expect(formatRules('Variant Magic - Oathbreaker').commandZone).toMatchObject({ min: 2, max: 4 });
    expect(formatRules('Variant Magic - Tiny Leaders')).toMatchObject({ deckSize: 50, commandZone: { max: 1 } });
    expect(isCommanderFormat('Constructed - Modern')).toBe(false);
  });

  it('reads constructed and highlander formats from their names', () => {
    expect(formatRules('Constructed - Modern')).toMatchObject({ label: 'Modern', family: 'constructed', singleton: false, minDeck: 60 });
    expect(formatRules('Block Constructed - Theros').label).toBe('Theros');
    expect(formatRules('Constructed - Canadian Highlander')).toMatchObject({ family: 'highlander', singleton: true, deckSize: 100, commandZone: null });
    expect(formatRules(undefined).deckType).toBe('Constructed - Freeform');
  });
});

describe('formatMenu', () => {
  it('groups formats and leaves out Limited and Momir', () => {
    const menu = formatMenu(['Constructed - Modern', 'Variant Magic - Commander', 'Variant Magic - Momir Basic', 'Limited', 'Constructed - Canadian Highlander', 'Block Constructed - Theros']);
    expect(menu).toEqual([
      { label: 'Constructed', types: ['Constructed - Modern'] },
      { label: 'Commander', types: ['Variant Magic - Commander'] },
      { label: 'Singleton', types: ['Constructed - Canadian Highlander'] },
      { label: 'Block', types: ['Block Constructed - Theros'] },
    ]);
  });
});

describe('gameTypesFor', () => {
  it('offers the commander game types for commander decks', () => {
    expect(gameTypesFor('Variant Magic - Commander', SERVER_GAME_TYPES)).toEqual(['Commander Two Player Duel', 'Commander Free For All']);
    expect(gameTypesFor('Variant Magic - Tiny Leaders', SERVER_GAME_TYPES)).toEqual(['Tiny Leaders Two Player Duel']);
  });

  it('offers the plain game types for constructed decks', () => {
    expect(gameTypesFor('Constructed - Modern', SERVER_GAME_TYPES)).toEqual(['Two Player Duel', 'Free For All']);
    expect(gameTypesFor('Constructed - Canadian Highlander', SERVER_GAME_TYPES)[0]).toBe('Canadian Highlander Two Player Duel');
  });
});

describe('color identity', () => {
  it('parses the server form', () => {
    expect(parseIdentity('{G}{W}')).toEqual(['W', 'G']);
    expect(parseIdentity('{C}')).toEqual([]);
    expect(commanderIdentity([{ originalColorIdentity: '{U}' }, { originalColorIdentity: '{R}' }])).toEqual(['U', 'R']);
  });

  it('checks a card against the commander', () => {
    expect(withinIdentity({ originalColorIdentity: '{U}{R}' }, ['U', 'R', 'G'])).toBe(true);
    expect(withinIdentity({ originalColorIdentity: '{B}' }, ['U', 'R'])).toBe(false);
    expect(withinIdentity({ originalColorIdentity: '{C}' }, [])).toBe(true);
  });
});

describe('canCommand', () => {
  const legend = { superTypes: ['LEGENDARY'], cardTypes: ['CREATURE'], rules: [] };
  const walker = { superTypes: ['LEGENDARY'], cardTypes: ['PLANESWALKER'], rules: [] };
  it('accepts legendary creatures and cards that say so', () => {
    expect(canCommand(legend, 'Variant Magic - Commander')).toBe(true);
    expect(canCommand(walker, 'Variant Magic - Commander')).toBe(false);
    expect(canCommand({ ...walker, rules: ['Teferi can be your commander.'] }, 'Variant Magic - Commander')).toBe(true);
    expect(canCommand(walker, 'Variant Magic - Brawl')).toBe(true);
    expect(canCommand({ cardTypes: ['INSTANT'] }, 'Variant Magic - Oathbreaker')).toBe(true);
    expect(canCommand({ cardTypes: ['CREATURE'] }, 'Variant Magic - Commander')).toBe(false);
  });
});
