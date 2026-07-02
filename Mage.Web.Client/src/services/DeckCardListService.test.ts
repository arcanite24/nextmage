import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDeckCardCopies,
  addSearchCardToDeck,
  decrementDeckCard,
  moveDeckCard,
  setDeckCardAmount,
} from './DeckCardListService.js';
import { Rarity, type DeckCardInfo, type DeckCardLists, type SearchCardView } from '../types/index.js';

function makeDeck(cards: DeckCardInfo[] = [], sideboard: DeckCardInfo[] = []): DeckCardLists {
  return {
    name: 'Interaction Deck',
    cards,
    sideboard,
  };
}

function makeSearchCard(name: string, setCode = 'M11', cardNumber = '149'): SearchCardView {
  return {
    id: `${setCode}-${cardNumber}-${name}`,
    name,
    displayName: name,
    rules: [],
    power: '',
    toughness: '',
    loyalty: '',
    defense: '',
    cardTypes: [],
    subTypes: [],
    superTypes: [],
    expansionSetCode: setCode,
    cardNumber,
    imageFileName: '',
    imageNumber: 0,
    color: { white: false, blue: false, black: false, red: true, green: false },
    frameColor: { white: false, blue: false, black: false, red: true, green: false },
    manaValue: 1,
    rarity: Rarity.COMMON,
    isSplitCard: false,
    isDoubleFacedCard: false,
  };
}

test('adds search cards to the requested deck zone without mutating the source deck', () => {
  const deck = makeDeck();
  const nextDeck = addSearchCardToDeck(deck, makeSearchCard('Lightning Bolt'), 'main');

  assert.equal(deck.cards.length, 0);
  assert.equal(nextDeck.cards.length, 1);
  assert.equal(nextDeck.cards[0].cardName, 'Lightning Bolt');
  assert.equal(nextDeck.cards[0].amount, 1);
});

test('adds requested deck card copy amounts to the selected zone', () => {
  const deck = makeDeck();
  const nextDeck = addDeckCardCopies(deck, { amount: 3, cardName: 'Mountain' }, 'side', 3);

  assert.equal(deck.sideboard.length, 0);
  assert.deepEqual(nextDeck.sideboard, [{ amount: 3, cardName: 'Mountain' }]);
});

test('sets exact card amount and removes cards when set to zero', () => {
  const deck = makeDeck([
    { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    { amount: 2, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
  ]);

  const withExactAmount = setDeckCardAmount(deck, deck.cards[0], 'main', 7);
  const withoutCard = setDeckCardAmount(withExactAmount, deck.cards[1], 'main', 0);

  assert.deepEqual(withExactAmount.cards.map(card => card.amount), [7, 2]);
  assert.deepEqual(withoutCard.cards.map(card => card.cardName), ['Lightning Bolt']);
  assert.equal(deck.cards[0].amount, 4);
});

test('decrements a single card copy without dropping other printings', () => {
  const deck = makeDeck([
    { amount: 2, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    { amount: 3, cardName: 'Lightning Bolt', setCode: 'SLD', cardNumber: '666' },
  ]);
  const nextDeck = decrementDeckCard(deck, deck.cards[0], 'main');

  assert.equal(nextDeck.cards[0].amount, 1);
  assert.equal(nextDeck.cards[1].amount, 3);
});

test('moves one copy between main deck and sideboard and merges matching destination copies', () => {
  const deck = makeDeck([
    { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
  ], [
    { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
  ]);
  const nextDeck = moveDeckCard(deck, deck.cards[0], 'main', 'side');

  assert.equal(nextDeck.cards[0].amount, 3);
  assert.equal(nextDeck.sideboard[0].amount, 2);
});

test('falls back to card name matching when set metadata is missing', () => {
  const deck = makeDeck([
    { amount: 1, cardName: 'Counterspell' },
  ]);
  const nextDeck = setDeckCardAmount(deck, { amount: 1, cardName: 'Counterspell', setCode: null, cardNumber: null }, 'main', 3);

  assert.equal(nextDeck.cards[0].amount, 3);
});
