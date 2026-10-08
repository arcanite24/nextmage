import { describe, expect, test } from 'vitest';
import { DeckSerializer } from './DeckSerializer';
import { copyName, deckFileName, exportArena, exportDck, exportDeckAs, exportMtgo } from './exportFormats';
import type { DeckCardLists } from './types';

const DECK: DeckCardLists = {
  name: 'Burn: the "best" deck',
  cards: [
    { amount: 4, cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' },
    { amount: 2, cardName: 'Lightning Bolt', setCode: '2XM', cardNumber: '129' },
    { amount: 20, cardName: 'Mountain', setCode: null, cardNumber: null },
    { amount: 0, cardName: 'Shock', setCode: 'M19', cardNumber: '156' },
  ],
  sideboard: [{ amount: 3, cardName: 'Smash to Smithereens', setCode: 'ORI', cardNumber: '163' }],
};

describe('deck export formats', () => {
  test('Arena keeps printings in Deck and Sideboard sections', () => {
    expect(exportArena(DECK)).toBe([
      'Deck',
      '4 Lightning Bolt (M10) 146',
      '2 Lightning Bolt (2XM) 129',
      '20 Mountain',
      '',
      'Sideboard',
      '3 Smash to Smithereens (ORI) 163',
      '',
    ].join('\n'));
  });

  test('MTGO merges printings and puts the sideboard after a blank line', () => {
    expect(exportMtgo(DECK)).toBe('6 Lightning Bolt\n20 Mountain\n\n3 Smash to Smithereens\n');
    expect(exportMtgo({ ...DECK, sideboard: [] })).toBe('6 Lightning Bolt\n20 Mountain\n');
  });

  test('XMage .dck names the deck and marks the sideboard', () => {
    expect(exportDck(DECK)).toBe([
      'NAME:Burn: the "best" deck',
      '4 [M10:146] Lightning Bolt',
      '2 [2XM:129] Lightning Bolt',
      '20 [UNK:0] Mountain',
      'SB: 3 [ORI:163] Smash to Smithereens',
      '',
    ].join('\n'));
  });

  test('every format reads back into the same cards', () => {
    for (const format of ['arena', 'mtgo', 'dck'] as const) {
      const back = DeckSerializer.importDeck(exportDeckAs(DECK, format));
      const total = (cards: DeckCardLists['cards']) => cards.reduce((sum, card) => sum + card.amount, 0);
      expect(total(back.cards), format).toBe(26);
      expect(total(back.sideboard), format).toBe(3);
    }
    const dck = DeckSerializer.importDeck(exportDck(DECK));
    expect(dck.name).toBe('Burn: the "best" deck');
    const arena = DeckSerializer.importDeck(exportArena(DECK));
    expect(arena.cards[0]).toMatchObject({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' });
  });

  test('file names drop characters file systems refuse', () => {
    expect(deckFileName(DECK, 'dck')).toBe('Burn the best deck.dck');
    expect(deckFileName({ ...DECK, name: '  ..  ' }, 'mtgo')).toBe('deck.txt');
    expect(deckFileName({ ...DECK, name: 'a/b\\c' }, 'arena')).toBe('a b c.txt');
  });

  test('copy names never clash', () => {
    expect(copyName('Burn', [])).toBe('Burn (copy)');
    expect(copyName('Burn', ['Burn (copy)'])).toBe('Burn (copy 2)');
    expect(copyName('Burn (copy)', ['Burn (copy)', 'Burn (copy 2)'])).toBe('Burn (copy 3)');
    expect(copyName('', [])).toBe('Untitled deck (copy)');
  });
});
