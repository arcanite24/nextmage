import { describe, expect, test } from 'vitest';
import type { CardView } from '../../protocol/generated/views';
import { binderCards, binderPages, collectionNames, newInBinder } from './binderModel';

const card = (name: string, cardNumber: string, rarity = 'COMMON'): CardView => ({ name, cardNumber, expansionSetCode: 'THS', rarity } as CardView);

describe('binder', () => {
  test('one pocket per name in collector-number order, basics left out', () => {
    const cards = binderCards([card('Omenspeaker', '57'), card('Anthousa', '149', 'RARE'), card('Plains', '230'), card('Akroan Crusader', '111'), card('Omenspeaker', '9a')]);
    expect(cards.map((item) => `${item.cardNumber} ${item.name}`)).toEqual(['9a Omenspeaker', '111 Akroan Crusader', '149 Anthousa']);
    expect(cards[2].rarity).toBe('rare');
  });

  test('cuts cards into pages of nine', () => {
    const pages = binderPages(Array.from({ length: 20 }, (_, i) => i));
    expect(pages.map((page) => page.length)).toEqual([9, 9, 2]);
    expect(binderPages([])).toEqual([]);
  });

  test('new cards shine after the first look, never on it', () => {
    const names = collectionNames([{ name: 'Anthousa', count: 1 }, { name: 'Omenspeaker', count: 0 }]);
    expect(names).toEqual(['anthousa']);
    expect(newInBinder(null, names).fresh.size).toBe(0);
    expect([...newInBinder(['anthousa'], ['anthousa', 'akroan crusader']).fresh]).toEqual(['akroan crusader']);
  });
});
