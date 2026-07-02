import assert from 'node:assert/strict';
import test from 'node:test';
import { DECK_LEGALITY_FORMATS, DeckLegalityService, serverDeckTypeForValidation } from './DeckLegalityService.js';
import { Rarity } from '../types/index.js';
const standard = {
    deckType: 'Constructed - Standard',
    shortName: 'Standard',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
};
const pauper = {
    deckType: 'Constructed - Pauper',
    shortName: 'Pauper',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    pauperRarity: true,
};
test('keeps the desktop legality label order for server-backed formats', () => {
    assert.deepEqual(DECK_LEGALITY_FORMATS.map(format => format.deckType), [
        'Constructed - Standard',
        'Constructed - Pioneer',
        'Constructed - Modern',
        'Constructed - Legacy',
        'Constructed - Vintage',
        'Constructed - Pauper',
        'Constructed - Historic',
        'Commander',
        'Oathbreaker',
        'Brawl',
        'Constructed - Frontier',
        'Constructed - Historical Type 2',
        'Penny Dreadful Commander',
        'European Highlander',
        'Canadian Highlander',
    ]);
});
test('maps display legality formats to Java deck validator names for server calls', () => {
    assert.equal(serverDeckTypeForValidation(DECK_LEGALITY_FORMATS.find(format => format.deckType === 'Commander')), 'Variant Magic - Commander');
    assert.equal(serverDeckTypeForValidation(DECK_LEGALITY_FORMATS.find(format => format.deckType === 'Oathbreaker')), 'Variant Magic - Oathbreaker');
    assert.equal(serverDeckTypeForValidation(DECK_LEGALITY_FORMATS.find(format => format.deckType === 'Brawl')), 'Variant Magic - Brawl');
    assert.equal(serverDeckTypeForValidation(DECK_LEGALITY_FORMATS.find(format => format.deckType === 'Penny Dreadful Commander')), 'Variant Magic - Penny Dreadful Commander');
    assert.equal(serverDeckTypeForValidation(DECK_LEGALITY_FORMATS.find(format => format.deckType === 'European Highlander')), 'Constructed - European Highlander');
    assert.equal(serverDeckTypeForValidation(DECK_LEGALITY_FORMATS.find(format => format.deckType === 'Canadian Highlander')), 'Constructed - Canadian Highlander');
    assert.equal(serverDeckTypeForValidation(standard), 'Constructed - Standard');
});
function makeCard(name, rarity = Rarity.COMMON, setCode = 'M11', cardNumber = '149') {
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
        rarity,
        isSplitCard: false,
        isDoubleFacedCard: false,
    };
}
function makeDeck(cards, sideboard = []) {
    return {
        name: 'Test Deck',
        cards,
        sideboard,
    };
}
function makeService(searchCards) {
    return new DeckLegalityService({ searchCards });
}
function makeExactLookupService(rarity = Rarity.COMMON) {
    return makeService(async ({ nameContains }) => {
        if (nameContains === 'Mountain') {
            return [makeCard('Mountain', rarity, 'M11', '244')];
        }
        return [makeCard(nameContains || 'Unknown', rarity)];
    });
}
test('marks deck-size-only constructed issues as partly legal', async () => {
    const service = makeExactLookupService();
    const report = await service.validateDeck(makeDeck([
        { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]), [standard]);
    assert.equal(report.results[0].status, 'partly-legal');
    assert.equal(report.results[0].validationSource, 'browser');
    assert.equal(report.results[0].issues[0].type, 'DECK_SIZE');
    assert.deepEqual(report.results[0].selectableCardNames, []);
});
test('flags too many non-basic copies as selectable card issues', async () => {
    const service = makeExactLookupService();
    const report = await service.validateDeck(makeDeck([
        { amount: 5, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 55, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]), [standard]);
    assert.equal(report.results[0].status, 'not-legal');
    assert.deepEqual(report.results[0].selectableCardNames, ['Lightning Bolt']);
    assert.match(report.results[0].issues.map(issue => issue.message).join('\n'), /Too many: 5/);
});
test('uses authoritative server validation errors when available', async () => {
    let searchCalls = 0;
    const service = new DeckLegalityService({
        searchCards: async () => {
            searchCalls += 1;
            return [];
        },
        validateDeck: async (deckType, deck) => {
            assert.equal(deckType, standard.deckType);
            assert.equal(deck.cards[0].cardName, 'Lightning Bolt');
            return {
                deckType,
                name: 'Standard',
                shortName: 'Standard',
                valid: false,
                partlyValid: false,
                errors: [
                    {
                        type: 'BANNED',
                        group: 'Lightning Bolt',
                        message: 'Banned: Lightning Bolt',
                        cardName: 'Lightning Bolt',
                    },
                    {
                        type: 'PRIMARY',
                        group: 'Deck',
                        message: 'Primary format error',
                        cardName: null,
                    },
                ],
            };
        },
    });
    const report = await service.validateDeck(makeDeck([
        { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]), [standard]);
    assert.equal(searchCalls, 0);
    assert.equal(report.results[0].status, 'not-legal');
    assert.equal(report.results[0].validationSource, 'server');
    assert.deepEqual(report.results[0].issues.map(issue => issue.type), ['PRIMARY', 'BANNED']);
    assert.deepEqual(report.results[0].selectableCardNames, ['Lightning Bolt']);
});
test('sorts authoritative server validation errors like the desktop legality tooltip', async () => {
    const service = new DeckLegalityService({
        searchCards: async () => [],
        validateDeck: async (deckType) => ({
            deckType,
            name: 'Standard',
            shortName: 'Standard',
            valid: false,
            partlyValid: false,
            errors: [
                { type: 'OTHER', group: 'Mountain', message: 'Too many: 5', cardName: 'Mountain' },
                { type: 'WRONG_SET', group: 'Lightning Bolt', message: 'Invalid set: M11', cardName: 'Lightning Bolt' },
                { type: 'PRIMARY', group: 'Deck', message: 'Missing commander', cardName: null },
                { type: 'DECK_SIZE', group: 'Deck', message: 'Must contain at least 60 cards', cardName: null },
                { type: 'BANNED', group: 'Ancestral Recall', message: 'Banned: Ancestral Recall', cardName: 'Ancestral Recall' },
            ],
        }),
    });
    const report = await service.validateDeck(makeDeck([
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]), [standard]);
    assert.deepEqual(report.results[0].issues.map(issue => `${issue.type}:${issue.group}`), [
        'PRIMARY:Deck',
        'DECK_SIZE:Deck',
        'BANNED:Ancestral Recall',
        'WRONG_SET:Lightning Bolt',
        'OTHER:Mountain',
    ]);
});
test('maps authoritative EDH power metadata from server validation', async () => {
    const service = new DeckLegalityService({
        searchCards: async () => [],
        validateDeck: async (deckType) => {
            assert.equal(deckType, 'Variant Magic - Commander');
            return {
                deckType,
                name: 'Commander',
                shortName: 'Commander',
                valid: true,
                partlyValid: true,
                errors: [],
                edhPowerLevel: 7,
                edhPowerCards: ['Sol Ring', 'Demonic Tutor'],
                edhPowerDetails: ['+3 from Sol Ring', '+4 from Demonic Tutor'],
                commanderBrackets: [{
                        level: 1,
                        name: 'Bracket 1',
                        shortName: 'B1',
                        valid: false,
                        badCards: ['Demonic Tutor'],
                        groups: [{
                                name: 'Game Changers',
                                count: 1,
                                max: 0,
                                cards: ['Demonic Tutor'],
                            }],
                    }],
            };
        },
    });
    const report = await service.validateDeck(makeDeck([
        { amount: 1, cardName: 'Sol Ring', setCode: 'CMM', cardNumber: '400' },
        { amount: 1, cardName: 'Demonic Tutor', setCode: 'CMM', cardNumber: '150' },
    ]), [{
            deckType: 'Commander',
            shortName: 'Commander',
            minMain: 100,
            maxSideboard: 0,
            maxCopies: 1,
        }]);
    assert.equal(report.results[0].edhPowerLevel, 7);
    assert.deepEqual(report.results[0].edhPowerCards, ['Sol Ring', 'Demonic Tutor']);
    assert.deepEqual(report.results[0].edhPowerDetails, ['+3 from Sol Ring', '+4 from Demonic Tutor']);
    assert.equal(report.results[0].commanderBrackets?.[0].level, 1);
    assert.deepEqual(report.results[0].commanderBrackets?.[0].badCards, ['Demonic Tutor']);
});
test('falls back to client validation when server validation is unavailable', async () => {
    const service = new DeckLegalityService({
        searchCards: async ({ nameContains }) => [makeCard(nameContains || 'Unknown')],
        validateDeck: async () => {
            throw new Error('Unknown method: deckValidate');
        },
    });
    const report = await service.validateDeck(makeDeck([
        { amount: 5, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 55, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]), [standard]);
    assert.equal(report.results[0].status, 'not-legal');
    assert.equal(report.results[0].validationSource, 'browser');
    assert.match(report.results[0].issues.map(issue => issue.message).join('\n'), /Too many: 5/);
});
test('falls back to client validation when server validation does not answer promptly', async () => {
    const service = new DeckLegalityService({
        searchCards: async ({ nameContains }) => {
            if (nameContains === 'Mountain') {
                return [makeCard('Mountain', Rarity.COMMON, 'M11', '244')];
            }
            return [makeCard(nameContains || 'Unknown')];
        },
        validateDeck: async () => new Promise(() => undefined),
        serverValidationTimeoutMs: 1,
    });
    const report = await service.validateDeck(makeDeck([
        { amount: 5, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 55, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]), [standard]);
    assert.equal(report.results[0].status, 'not-legal');
    assert.equal(report.results[0].validationSource, 'browser');
    assert.deepEqual(report.results[0].selectableCardNames, ['Lightning Bolt']);
    assert.match(report.results[0].issues.map(issue => issue.message).join('\n'), /Too many: 5/);
});
test('allows any number of basic lands when checking duplicate counts', async () => {
    const service = makeExactLookupService();
    const report = await service.validateDeck(makeDeck([
        { amount: 60, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]), [standard]);
    assert.equal(report.results[0].status, 'legal');
    assert.equal(report.results[0].issues.length, 0);
});
test('flags Pauper rarity when no common printing exists', async () => {
    const service = makeExactLookupService(Rarity.RARE);
    const report = await service.validateDeck(makeDeck([
        { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 56, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]), [pauper]);
    assert.equal(report.results[0].status, 'not-legal');
    assert.deepEqual(report.results[0].selectableCardNames, ['Lightning Bolt', 'Mountain']);
    assert.match(report.results[0].issues.map(issue => issue.message).join('\n'), /Invalid rarity/);
});
test('sorts browser fallback legality issues like the Java DeckValidator', async () => {
    const service = new DeckLegalityService({
        validateDeck: async () => {
            throw new Error('Unknown method: deckValidate');
        },
        searchCards: async ({ nameContains, format }) => {
            if (format)
                return [];
            if (nameContains === 'Mountain') {
                return [makeCard('Mountain', Rarity.RARE, 'M11', '244')];
            }
            return [makeCard(nameContains || 'Unknown', Rarity.RARE)];
        },
    });
    const report = await service.validateDeck(makeDeck([
        { amount: 5, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 1, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]), [pauper]);
    assert.deepEqual(report.results[0].issues.map(issue => `${issue.type}:${issue.group}:${issue.message}`), [
        'DECK_SIZE:Deck:Must contain at least 60 cards: has only 6 cards',
        'WRONG_SET:Lightning Bolt:Invalid set: M11',
        'WRONG_SET:Mountain:Invalid set: M11',
        'OTHER:Lightning Bolt:Invalid rarity: no common printing found',
        'OTHER:Lightning Bolt:Too many: 5',
        'OTHER:Mountain:Invalid rarity: no common printing found',
    ]);
    assert.deepEqual(report.results[0].selectableCardNames, ['Lightning Bolt', 'Mountain']);
});
test('reports unknown status when server-backed validation cannot run', async () => {
    const service = makeService(async () => {
        throw new Error('WebSocket is not connected');
    });
    const report = await service.validateDeck(makeDeck([
        { amount: 60, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]), [standard]);
    assert.equal(report.results[0].status, 'unknown');
    assert.equal(report.results[0].issues[0].group, 'Validation');
    assert.match(report.results[0].issues[0].message, /WebSocket is not connected/);
});
