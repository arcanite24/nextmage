import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendDeckCardLists,
  formatCandidate,
  parseAlternateSearch,
  type DeckImportReplacement,
} from './DeckImportWorkflowService.js';
import type { CardUnresolvedReportItem, ResolvedCard } from './CardResolverService.js';

const unresolvedLightningBolt: CardUnresolvedReportItem = {
  key: 'lightning bolt||',
  cardName: 'Lightning Bolt',
  setCode: null,
  cardNumber: null,
  amount: 4,
  zones: [{ zone: 'main', amount: 4 }],
  candidates: [],
  reason: 'not-found',
};

test('parses import-fixer alternate searches by supported user input shapes', () => {
  assert.deepEqual(parseAlternateSearch(unresolvedLightningBolt, '[M11:149] Lightning Bolt'), {
    amount: 4,
    cardName: 'Lightning Bolt',
    setCode: 'M11',
    cardNumber: '149',
  });

  assert.deepEqual(parseAlternateSearch(unresolvedLightningBolt, 'Lightning Bolt (M11) 149'), {
    amount: 4,
    cardName: 'Lightning Bolt',
    setCode: 'M11',
    cardNumber: '149',
  });

  assert.deepEqual(parseAlternateSearch(unresolvedLightningBolt, 'M11 149'), {
    amount: 4,
    cardName: 'Lightning Bolt',
    setCode: 'M11',
    cardNumber: '149',
  });

  assert.deepEqual(parseAlternateSearch(unresolvedLightningBolt, 'Llanowar Elves'), {
    amount: 4,
    cardName: 'Llanowar Elves',
    setCode: null,
    cardNumber: null,
  });
});

test('appends imported cards without duplicating identical main and sideboard printings', () => {
  const merged = appendDeckCardLists(
    {
      name: 'Existing',
      format: 'Constructed - Modern',
      cards: [
        { amount: 2, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
      ],
      sideboard: [
        { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
      ],
    },
    {
      name: 'Import',
      cards: [
        { amount: 2, cardName: 'Lightning Bolt', setCode: 'm11', cardNumber: '149' },
        { amount: 4, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
      ],
      sideboard: [
        { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
      ],
    },
  );

  assert.deepEqual(merged.cards, [
    { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    { amount: 4, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
  ]);
  assert.deepEqual(merged.sideboard, [
    { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
  ]);
  assert.equal(merged.name, 'Existing');
  assert.equal(merged.format, 'Constructed - Modern');
});

test('formats selected import replacements for user-facing selectors', () => {
  const replacement: ResolvedCard = { name: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' };
  const applied: DeckImportReplacement = { item: unresolvedLightningBolt, replacement };

  assert.equal(formatCandidate(applied.replacement), 'Lightning Bolt [M11:149]');
});
