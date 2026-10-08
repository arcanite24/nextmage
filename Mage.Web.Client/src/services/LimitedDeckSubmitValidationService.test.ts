import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  countLimitedMainDeckCards,
  getLimitedDeckSubmitValidationError,
} from './LimitedDeckSubmitValidationService.js';
import type { DeckCardLists } from '../types/index.js';

function makeDeck(mainCount: number, sideboardCount = 0): DeckCardLists {
  return {
    name: 'Limited Validation Deck',
    format: 'Limited',
    cards: mainCount > 0 ? [{ amount: mainCount, cardName: 'Mountain' }] : [],
    sideboard: sideboardCount > 0 ? [{ amount: sideboardCount, cardName: 'Lightning Bolt' }] : [],
  };
}

test('counts only main-deck cards for limited submit readiness', () => {
  assert.equal(countLimitedMainDeckCards(makeDeck(23, 17)), 23);
  assert.equal(countLimitedMainDeckCards(makeDeck(0, 40)), 0);
  assert.equal(countLimitedMainDeckCards(null), 0);
});

test('requires forty main-deck cards for construction submits', () => {
  assert.equal(
    getLimitedDeckSubmitValidationError(makeDeck(39, 60), { kind: 'construction' }),
    'Limited deck needs at least 40 main-deck cards before submit (39/40).',
  );
  assert.equal(getLimitedDeckSubmitValidationError(makeDeck(40), { kind: 'construction' }), null);
});

test('requires forty main-deck cards for limited sideboard submits only', () => {
  assert.equal(
    getLimitedDeckSubmitValidationError(makeDeck(12), { kind: 'sideboard', limitedSideboard: true }),
    'Limited deck needs at least 40 main-deck cards before submit (12/40).',
  );
  assert.equal(getLimitedDeckSubmitValidationError(makeDeck(12), { kind: 'sideboard', limitedSideboard: false }), null);
});
