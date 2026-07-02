import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraftAutosaveDeck } from './DraftDeckAutosaveService.js';
test('builds a durable local deck snapshot for completed draft picks', () => {
    const snapshot = buildDraftAutosaveDeck({
        id: 'live-draft-deck',
        name: 'Draft Picks',
        format: 'Limited',
        description: 'Original note.',
        cards: [
            { amount: 2, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
            { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
        ],
        sideboard: [
            { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
        ],
    }, '00000000-0000-0000-0000-000000000793', Date.UTC(2026, 5, 26, 7, 8, 9));
    assert.equal(snapshot.id, undefined);
    assert.equal(snapshot.name, 'Draft Picks Autosave 2026-06-26 07:08:09 UTC');
    assert.equal(snapshot.format, 'Limited');
    assert.equal(snapshot.createdAt, Date.UTC(2026, 5, 26, 7, 8, 9));
    assert.equal(snapshot.updatedAt, Date.UTC(2026, 5, 26, 7, 8, 9));
    assert.equal(snapshot.description, 'Autosaved from completed draft 00000000. 3 picked cards preserved from the live draft activity. Original note.');
    assert.deepEqual(snapshot.cards, [
        { amount: 2, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
    ]);
    assert.deepEqual(snapshot.sideboard, [
        { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
    ]);
});
