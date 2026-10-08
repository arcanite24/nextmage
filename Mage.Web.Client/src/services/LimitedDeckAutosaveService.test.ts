import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildLimitedDeckAutosaveDeck,
  limitedDeckAutosaveName,
  shouldAutosaveLimitedDeck,
} from './LimitedDeckAutosaveService.js';

test('builds a stable autosave snapshot for limited construction deck edits', () => {
  const snapshot = buildLimitedDeckAutosaveDeck(
    {
      id: 'live-construction-deck',
      name: 'Server Construction',
      format: '',
      description: 'Server shell.',
      cards: [
        { amount: 22, cardName: 'Mountain', setCode: 'M11', cardNumber: '243' },
      ],
      sideboard: [
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
      ],
      createdAt: Date.UTC(2026, 6, 1, 1, 2, 3),
    },
    {
      kind: 'construction',
      activityId: '00000000-0000-0000-0000-000000000793',
      now: Date.UTC(2026, 6, 6, 7, 8, 9),
    },
  );

  assert.equal(snapshot.id, undefined);
  assert.equal(snapshot.name, 'Limited Construction Autosave 00000000');
  assert.equal(snapshot.format, 'Limited');
  assert.equal(snapshot.createdAt, Date.UTC(2026, 6, 1, 1, 2, 3));
  assert.equal(snapshot.updatedAt, Date.UTC(2026, 6, 6, 7, 8, 9));
  assert.equal(snapshot.description, 'Autosaved from limited construction 00000000 at 2026-07-06 07:08:09 UTC. 23 cards preserved from the live limited deck activity. Server shell.');
  assert.deepEqual(snapshot.cards, [
    { amount: 22, cardName: 'Mountain', setCode: 'M11', cardNumber: '243' },
  ]);
  assert.deepEqual(snapshot.sideboard, [
    { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
  ]);
});

test('builds a stable autosave snapshot for limited sideboarding deck edits', () => {
  assert.equal(limitedDeckAutosaveName({
    kind: 'sideboard',
    activityId: 'sideboard-table-id',
    limitedSideboard: true,
  }), 'Limited Sideboard Autosave sideboar');

  const snapshot = buildLimitedDeckAutosaveDeck(
    {
      name: 'Limited Sideboard',
      format: 'Limited',
      cards: [
        { amount: 1, cardName: 'Forest', setCode: 'M11', cardNumber: '246' },
      ],
      sideboard: [],
    },
    {
      kind: 'sideboard',
      activityId: 'sideboard-table-id',
      limitedSideboard: true,
      now: Date.UTC(2026, 6, 6, 8, 9, 10),
    },
  );

  assert.equal(snapshot.name, 'Limited Sideboard Autosave sideboar');
  assert.equal(snapshot.description, 'Autosaved from limited sideboarding sideboar at 2026-07-06 08:09:10 UTC. 1 card preserved from the live limited deck activity.');
  assert.equal(snapshot.format, 'Limited');
});

test('only autosaves limited decks once there are cards to preserve', () => {
  assert.equal(shouldAutosaveLimitedDeck(null), false);
  assert.equal(shouldAutosaveLimitedDeck({ name: 'Empty', cards: [], sideboard: [] }), false);
  assert.equal(shouldAutosaveLimitedDeck({
    name: 'Sideboard only',
    cards: [],
    sideboard: [
      { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
    ],
  }), true);
});
