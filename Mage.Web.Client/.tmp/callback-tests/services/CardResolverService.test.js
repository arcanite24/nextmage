import assert from 'node:assert/strict';
import test from 'node:test';
import { CardResolverService } from './CardResolverService.js';
import { Rarity } from '../types/index.js';
class MemoryStorage {
    values = new Map();
    getItem(key) {
        return this.values.get(key) ?? null;
    }
    setItem(key, value) {
        this.values.set(key, value);
    }
    removeItem(key) {
        this.values.delete(key);
    }
}
function makeSearchCard(name, setCode, cardNumber, extra = {}) {
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
        color: { white: false, blue: false, black: false, red: false, green: false },
        frameColor: { white: false, blue: false, black: false, red: false, green: false },
        manaValue: 0,
        rarity: Rarity.COMMON,
        isSplitCard: false,
        isDoubleFacedCard: false,
        ...extra,
    };
}
test('resolves name-only imported cards and reports automatic server fixes', async () => {
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async () => [
            makeSearchCard('Lightning Bolt', 'M11', '149'),
            makeSearchCard('Llanowar Elves', 'M12', '182'),
        ],
    });
    const result = await service.resolveDeckWithReport({
        name: 'Import',
        cards: [{ amount: 4, cardName: 'Lightning Bolt', setCode: null, cardNumber: null }],
        sideboard: [],
    });
    assert.deepEqual(result.unresolved, []);
    assert.equal(result.resolved.length, 1);
    assert.equal(result.resolved[0].source, 'server');
    assert.deepEqual(result.deck.cards[0], {
        amount: 4,
        cardName: 'Lightning Bolt',
        setCode: 'M11',
        cardNumber: '149',
    });
});
test('keeps weak matches unresolved while exposing alternate candidates', async () => {
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async () => [
            makeSearchCard('Lightning Bolt', 'M11', '149'),
        ],
    });
    const result = await service.resolveDeckWithReport({
        name: 'Import',
        cards: [{ amount: 1, cardName: 'Lightning B', setCode: null, cardNumber: null }],
        sideboard: [],
    });
    assert.equal(result.resolved.length, 0);
    assert.equal(result.unresolved.length, 1);
    assert.equal(result.unresolved[0].reason, 'ambiguous');
    assert.deepEqual(result.unresolved[0].candidates, [
        { name: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]);
    assert.equal(result.deck.cards[0].setCode, null);
});
test('remembers manual import fixes and applies them before server lookup', async () => {
    let lookupCount = 0;
    const storage = new MemoryStorage();
    const service = new CardResolverService({
        storage,
        searchCards: async () => {
            lookupCount += 1;
            return [];
        },
    });
    const replacement = { name: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' };
    service.rememberFix({ cardName: 'Bolt', setCode: null, cardNumber: null }, replacement);
    const result = await service.resolveDeckWithReport({
        name: 'Import',
        cards: [{ amount: 2, cardName: 'Bolt', setCode: null, cardNumber: null }],
        sideboard: [],
    });
    assert.equal(lookupCount, 0);
    assert.equal(result.resolved[0].source, 'remembered');
    assert.deepEqual(result.deck.cards[0], {
        amount: 2,
        cardName: 'Lightning Bolt',
        setCode: 'M11',
        cardNumber: '149',
    });
});
test('searches alternates with set aliases and collector numbers', async () => {
    const seenCriteria = [];
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async (criteria) => {
            seenCriteria.push(criteria);
            return criteria.setCodes?.includes('DOM')
                ? [makeSearchCard('Llanowar Elves', 'DOM', '168')]
                : [];
        },
    });
    const candidates = await service.searchAlternates({
        cardName: 'Llanowar Elves',
        setCode: 'DAR',
        cardNumber: '168',
    });
    assert.deepEqual(candidates, [
        { name: 'Llanowar Elves', setCode: 'DOM', cardNumber: '168' },
    ]);
    assert.ok(seenCriteria.some(criteria => criteria.setCodes?.includes('DOM') &&
        criteria.minCardNumber === 168 &&
        criteria.maxCardNumber === 168));
});
test('verifies complete imported cards and fixes stale DCK collector numbers', async () => {
    const seenCriteria = [];
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async (criteria) => {
            seenCriteria.push(criteria);
            return criteria.nameContains === 'Lightning Bolt' && criteria.setCodes?.includes('M11')
                ? [makeSearchCard('Lightning Bolt', 'M11', '149')]
                : [];
        },
    });
    const result = await service.resolveDeckWithReport({
        name: 'Import',
        cards: [{ amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '999' }],
        sideboard: [],
    });
    assert.equal(result.unresolved.length, 0);
    assert.equal(result.resolved.length, 1);
    assert.deepEqual(result.deck.cards[0], {
        amount: 1,
        cardName: 'Lightning Bolt',
        setCode: 'M11',
        cardNumber: '149',
    });
    assert.ok(seenCriteria.some(criteria => criteria.setCodes?.includes('M11') &&
        criteria.minCardNumber === 999 &&
        criteria.maxCardNumber === 999));
});
test('resolves imports with embedded collector and promo set metadata in the card name', async () => {
    const seenCriteria = [];
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async (criteria) => {
            seenCriteria.push(criteria);
            if (criteria.setCodes?.includes('PRM'))
                return [];
            if (criteria.nameContains !== 'Burst Lightning')
                return [];
            return [
                makeSearchCard('Burst Lightning', 'ZEN', '119'),
                makeSearchCard('Burst Lightning', 'MM2', '109'),
                makeSearchCard('Burst Lightning', 'C21', '162'),
                makeSearchCard('Burst Lightning', 'A25', '123'),
                makeSearchCard('Burst Lightning', 'PDCI', '199'),
            ];
        },
    });
    const result = await service.resolveDeckWithReport({
        name: 'Import',
        cards: [{ amount: 4, cardName: 'Burst Lightning <199> [PRM]', setCode: null, cardNumber: null }],
        sideboard: [],
    });
    assert.equal(result.unresolved.length, 0);
    assert.equal(result.resolved.length, 1);
    assert.equal(result.resolved[0].cardName, 'Burst Lightning');
    assert.equal(result.resolved[0].setCode, 'PRM');
    assert.equal(result.resolved[0].cardNumber, '199');
    assert.deepEqual(result.deck.cards[0], {
        amount: 4,
        cardName: 'Burst Lightning',
        setCode: 'PDCI',
        cardNumber: '199',
    });
    assert.ok(seenCriteria.some(criteria => criteria.nameContains === 'Burst Lightning'));
});
test('fixes stale DCK card names from trusted set and collector data', async () => {
    const seenCriteria = [];
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async (criteria) => {
            seenCriteria.push(criteria);
            return criteria.setCodes?.includes('M11') &&
                criteria.minCardNumber === 149 &&
                criteria.maxCardNumber === 149
                ? [makeSearchCard('Lightning Bolt', 'M11', '149')]
                : [];
        },
    });
    const result = await service.resolveDeckWithReport({
        name: 'Import',
        cards: [{ amount: 1, cardName: 'Old Bolt Name', setCode: 'M11', cardNumber: '149' }],
        sideboard: [],
    });
    assert.equal(result.unresolved.length, 0);
    assert.equal(result.resolved.length, 1);
    assert.deepEqual(result.deck.cards[0], {
        amount: 1,
        cardName: 'Lightning Bolt',
        setCode: 'M11',
        cardNumber: '149',
    });
    assert.ok(seenCriteria.some(criteria => !criteria.nameContains &&
        criteria.setCodes?.includes('M11') &&
        criteria.minCardNumber === 149 &&
        criteria.maxCardNumber === 149));
});
test('matches nonnumeric collector numbers through set-scoped search', async () => {
    const seenCriteria = [];
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async (criteria) => {
            seenCriteria.push(criteria);
            return criteria.setCodes?.includes('SLD') && !criteria.nameContains
                ? [
                    makeSearchCard('Counterspell', 'SLD', 'A-001'),
                    makeSearchCard('Lightning Bolt', 'SLD', 'A-149'),
                ]
                : [];
        },
    });
    const result = await service.resolveDeckWithReport({
        name: 'Import',
        cards: [{ amount: 1, cardName: 'Old Promo Bolt', setCode: 'SLD', cardNumber: 'A-149' }],
        sideboard: [],
    });
    assert.equal(result.unresolved.length, 0);
    assert.equal(result.resolved.length, 1);
    assert.deepEqual(result.deck.cards[0], {
        amount: 1,
        cardName: 'Lightning Bolt',
        setCode: 'SLD',
        cardNumber: 'A-149',
    });
    assert.ok(seenCriteria.some(criteria => !criteria.nameContains &&
        criteria.setCodes?.includes('SLD') &&
        criteria.minCardNumber === undefined &&
        criteria.maxCardNumber === undefined &&
        criteria.count === 500));
});
test('does not report already canonical complete imported cards', async () => {
    const service = new CardResolverService({
        storage: new MemoryStorage(),
        searchCards: async () => [
            makeSearchCard('Lightning Bolt', 'M11', '149'),
        ],
    });
    const deck = {
        name: 'Import',
        cards: [{ amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' }],
        sideboard: [],
    };
    const result = await service.resolveDeckWithReport(deck);
    assert.equal(result.unresolved.length, 0);
    assert.equal(result.resolved.length, 0);
    assert.deepEqual(result.deck, deck);
});
