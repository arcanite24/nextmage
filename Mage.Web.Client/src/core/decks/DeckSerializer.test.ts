import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DeckSerializer } from './DeckSerializer.js';

test('imports Cockatrice cod XML decks with main, sideboard, clamped counts, and deck name', () => {
  const deck = DeckSerializer.importDeck(`
    <?xml version="1.0" encoding="UTF-8"?>
    <cockatrice_deck version="1">
      <deckname>Browser Cockatrice</deckname>
      <zone name="main">
        <card number="4" name="Lightning Bolt"/>
        <card number="0" name="Giant Growth"/>
        <card number="101" name="Llanowar Elves"/>
      </zone>
      <zone name="side">
        <card number="2" name="Naturalize"/>
        <card name="Forest"/>
      </zone>
    </cockatrice_deck>
  `);

  assert.equal(deck.name, 'Browser Cockatrice');
  assert.deepEqual(deck.cards, [
    { amount: 4, cardName: 'Lightning Bolt', setCode: null, cardNumber: null },
    { amount: 1, cardName: 'Giant Growth', setCode: null, cardNumber: null },
    { amount: 100, cardName: 'Llanowar Elves', setCode: null, cardNumber: null },
  ]);
  assert.deepEqual(deck.sideboard, [
    { amount: 2, cardName: 'Naturalize', setCode: null, cardNumber: null },
    { amount: 1, cardName: 'Forest', setCode: null, cardNumber: null },
  ]);
});

test('imports OCTGN o8d XML decks with main, sideboard, clamped counts, and entity decoding', () => {
  const deck = DeckSerializer.importDeck(`
    <?xml version="1.0" encoding="UTF-8"?>
    <deck>
      <section name="Main">
        <card qty="2">Lightning Bolt</card>
        <card qty="0">Giant Growth</card>
        <card qty="101">Llanowar Elves</card>
      </section>
      <section name="Sideboard">
        <card qty="2">Naturalize</card>
        <card>Fire &amp; Ice</card>
      </section>
    </deck>
  `);

  assert.equal(deck.name, 'Imported Deck');
  assert.deepEqual(deck.cards, [
    { amount: 2, cardName: 'Lightning Bolt', setCode: null, cardNumber: null },
    { amount: 1, cardName: 'Giant Growth', setCode: null, cardNumber: null },
    { amount: 100, cardName: 'Llanowar Elves', setCode: null, cardNumber: null },
  ]);
  assert.deepEqual(deck.sideboard, [
    { amount: 2, cardName: 'Naturalize', setCode: null, cardNumber: null },
    { amount: 1, cardName: 'Fire & Ice', setCode: null, cardNumber: null },
  ]);
});

test('imports MTGJSON decks with main, sideboard, commander, set fallback, and clamped counts', () => {
  const deck = DeckSerializer.importDeck(JSON.stringify({
    data: {
      code: 'M11',
      name: 'Browser MTGJSON',
      mainBoard: [
        { count: 2, name: 'Lightning Bolt', setCode: 'M11', number: '149' },
        { count: 0, name: 'Giant Growth' },
        { count: 101, name: 'Llanowar Elves', setCode: 'M12', number: '182' },
      ],
      sideBoard: [
        { count: 2, name: 'Naturalize', number: '190' },
      ],
      commander: [
        { count: 1, name: 'Rhys the Redeemed', setCode: 'SHM', number: '237' },
      ],
    },
  }));

  assert.equal(deck.name, 'Browser MTGJSON');
  assert.deepEqual(deck.cards, [
    { amount: 2, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    { amount: 1, cardName: 'Giant Growth', setCode: null, cardNumber: null },
    { amount: 100, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
  ]);
  assert.deepEqual(deck.sideboard, [
    { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
    { amount: 1, cardName: 'Rhys the Redeemed', setCode: 'SHM', cardNumber: '237' },
  ]);
});

test('imports XMage draft logs from selected pick lines with the current set code', () => {
  const deck = DeckSerializer.importDeck(`
    Event #: 8a74113b-27e5-4a29-85be-4b83f622af00
    Players:
        VisualMage

    ------ M11 ------

    Pack 1 pick 1:
        Giant Growth
    --> Lightning Bolt

    Pack 1 pick 2:
    --> Naturalize
        Mountain

    ------ M12 ------

    Pack 2 pick 1:
    --> Llanowar Elves
  `);

  assert.equal(deck.name, 'Imported Draft Log');
  assert.deepEqual(deck.cards, [
    { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: null },
    { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: null },
    { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: null },
  ]);
  assert.deepEqual(deck.sideboard, []);
});

test('exports picked cards as an XMage draft log that imports back through the browser parser', () => {
  const content = DeckSerializer.exportDraftLog({
    name: 'Browser Draft Picks',
    cards: [
      { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
      { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
      { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
    ],
    sideboard: [
      { amount: 1, cardName: 'Forest', setCode: 'M11', cardNumber: '246' },
    ],
  }, {
    draftId: '8a74113b-27e5-4a29-85be-4b83f622af00',
    exportedAt: '2026-07-06T12:00:00.000Z',
    players: ['VisualMage', 'Remote Mage'],
  });

  assert.match(content, /Event #: 8a74113b-27e5-4a29-85be-4b83f622af00/);
  assert.match(content, /Exported: 2026-07-06T12:00:00\.000Z/);
  assert.match(content, /Players:\n {4}VisualMage\n {4}Remote Mage/);
  assert.match(content, /------ M11 ------\n\nPack 1 pick 1:\n--> Lightning Bolt/);
  assert.match(content, /Pack 1 pick 2:\n--> Naturalize\n\nPack 1 pick 3:\n--> Naturalize/);
  assert.match(content, /------ M12 ------\n\nPack 2 pick 1:\n--> Llanowar Elves/);
  assert.doesNotMatch(content, /Forest/);

  const imported = DeckSerializer.importDeck(content);
  assert.equal(imported.name, 'Imported Draft Log');
  assert.deepEqual(imported.cards, [
    { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: null },
    { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: null },
    { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: null },
    { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: null },
  ]);
  assert.deepEqual(imported.sideboard, []);
});
