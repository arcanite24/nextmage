import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalDeckStorage } from './DeckStorageService.js';
class MemoryStorage {
    data = new Map();
    getItem(key) {
        return this.data.get(key) ?? null;
    }
    setItem(key, value) {
        this.data.set(key, value);
    }
    removeItem(key) {
        this.data.delete(key);
    }
    clear() {
        this.data.clear();
    }
}
const originalLocalStorage = globalThis.localStorage;
function installMemoryStorage() {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: storage,
    });
    return storage;
}
test.afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
    });
});
function makeDeck(overrides = {}) {
    return {
        name: 'Metadata Deck',
        description: 'Sideboard notes and deck plan.',
        format: 'Constructed - Modern',
        cards: [
            { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        ],
        sideboard: [
            { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
        ],
        ...overrides,
    };
}
test('preserves deck description in saved deck data and manager summaries', async () => {
    installMemoryStorage();
    const storage = new LocalDeckStorage();
    const id = await storage.saveDeck(makeDeck());
    const loadedDeck = await storage.loadDeck(id);
    const summaries = await storage.listDecks();
    assert.equal(loadedDeck?.description, 'Sideboard notes and deck plan.');
    assert.equal(summaries[0].description, 'Sideboard notes and deck plan.');
    assert.equal(summaries[0].sideboardCount, 2);
});
test('applies legacy metadata description when loading old text deck data', async () => {
    const memoryStorage = installMemoryStorage();
    const storage = new LocalDeckStorage();
    const id = 'legacy-deck';
    memoryStorage.setItem('mage_deck_' + id, '4 Lightning Bolt\n\n2 Naturalize');
    memoryStorage.setItem('mage_decks_meta', JSON.stringify([{
            id,
            name: 'Legacy Deck',
            description: 'Imported from old local storage.',
            updatedAt: 123,
        }]));
    const loadedDeck = await storage.loadDeck(id);
    const summaries = await storage.listDecks();
    assert.equal(loadedDeck?.name, 'Legacy Deck');
    assert.equal(loadedDeck?.description, 'Imported from old local storage.');
    assert.equal(summaries[0].description, 'Imported from old local storage.');
});
test('saves explicit deck copies without overwriting an existing same-name deck', async () => {
    installMemoryStorage();
    const storage = new LocalDeckStorage();
    const firstId = await storage.saveDeck(makeDeck({ name: 'Copy Target' }));
    const copyId = await storage.saveDeck(makeDeck({
        id: undefined,
        name: 'Copy Target',
        description: 'Save As copy.',
        cards: [
            { amount: 1, cardName: 'Llanowar Elves', setCode: 'M11', cardNumber: '184' },
        ],
        sideboard: [],
    }), { forceNew: true });
    const original = await storage.loadDeck(firstId);
    const copy = await storage.loadDeck(copyId);
    const summaries = await storage.listDecks();
    assert.notEqual(copyId, firstId);
    assert.equal(original?.description, 'Sideboard notes and deck plan.');
    assert.equal(copy?.description, 'Save As copy.');
    assert.equal(summaries.length, 2);
    assert.deepEqual(new Set(summaries.map(deck => deck.id)), new Set([firstId, copyId]));
});
