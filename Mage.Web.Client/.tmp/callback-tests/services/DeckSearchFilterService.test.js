import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCardSearchFilters, buildCardSearchCriteria, createSearchResultPiles, describeCardSearchRefinements, resolvePennyDreadfulSearchFormat, sortSearchResults, } from './DeckSearchFilterService.js';
import { DEFAULT_DECK_SEARCH_SETTINGS } from './AppConfigService.js';
import { Rarity } from '../types/index.js';
function color(overrides = {}) {
    return {
        white: false,
        blue: false,
        black: false,
        red: false,
        green: false,
        ...overrides,
    };
}
function makeCard(name, cardTypes, overrides = {}) {
    return {
        id: `${overrides.expansionSetCode ?? 'TST'}-${overrides.cardNumber ?? name.length}-${name}`,
        name,
        displayName: name,
        rules: [],
        power: '',
        toughness: '',
        loyalty: '',
        defense: '',
        cardTypes,
        subTypes: [],
        superTypes: [],
        expansionSetCode: 'TST',
        cardNumber: String(name.length),
        imageFileName: '',
        imageNumber: 0,
        color: color(),
        frameColor: color(),
        manaValue: 2,
        rarity: Rarity.COMMON,
        isSplitCard: false,
        isDoubleFacedCard: false,
        manaCostLeftStr: [],
        manaCostRightStr: [],
        ...overrides,
    };
}
function makeFilters(overrides = {}) {
    return {
        ...DEFAULT_DECK_SEARCH_SETTINGS,
        colors: { ...DEFAULT_DECK_SEARCH_SETTINGS.colors },
        excludedColors: { ...DEFAULT_DECK_SEARCH_SETTINGS.excludedColors },
        types: [],
        excludedTypes: [],
        rarities: [],
        excludedRarities: [],
        setCodes: [],
        ...overrides,
    };
}
test('builds server search criteria from persisted filter settings', () => {
    const criteria = buildCardSearchCriteria(makeFilters({
        searchText: 'bolt',
        nameContains: 'bolt',
        rulesContains: 'damage',
        searchNames: true,
        searchTypes: false,
        searchRules: false,
        colors: { ...DEFAULT_DECK_SEARCH_SETTINGS.colors, red: true, colorless: true },
        excludedColors: { ...DEFAULT_DECK_SEARCH_SETTINGS.excludedColors, blue: true },
        types: ['INSTANT'],
        excludedTypes: ['CREATURE'],
        rarities: ['COMMON'],
        excludedRarities: ['RARE'],
        setCodes: ['M11', 'DMU'],
        manaValue: 1,
        manaValueOperator: 'eq',
        useDeckFormat: false,
        format: 'Constructed - Pauper',
    }), {
        deckFormat: 'Constructed - Modern',
        sortBy: 'name',
    });
    assert.deepEqual(criteria, {
        count: 200,
        sortBy: 'name',
        nameContains: 'bolt',
        format: 'Constructed - Pauper',
        setCodes: ['M11', 'DMU'],
        types: ['INSTANT'],
        notTypes: ['CREATURE'],
        rarities: ['COMMON'],
        excludedRarities: ['RARE'],
        manaValue: 1,
        webColors: ['red', 'colorless'],
        colorMatch: 'any',
        webExcludedColors: ['blue'],
        white: false,
        blue: false,
        black: false,
        red: true,
        green: false,
        colorless: true,
    });
});
test('sends server refinements for non-equality mana value and exact color modes', () => {
    const criteria = buildCardSearchCriteria(makeFilters({
        colors: { ...DEFAULT_DECK_SEARCH_SETTINGS.colors, red: true, green: true },
        colorMatch: 'exact',
        excludedColors: { ...DEFAULT_DECK_SEARCH_SETTINGS.excludedColors, white: true },
        excludedRarities: ['MYTHIC'],
        manaValue: 3,
        manaValueOperator: 'lte',
    }), {
        sortBy: 'manaValue',
    });
    assert.equal(criteria.manaValue, 3);
    assert.equal(criteria.manaValueOperator, 'lte');
    assert.deepEqual(criteria.webColors, ['red', 'green']);
    assert.equal(criteria.colorMatch, 'exact');
    assert.deepEqual(criteria.webExcludedColors, ['white']);
    assert.deepEqual(criteria.excludedRarities, ['MYTHIC']);
    assert.equal(criteria.white, false);
    assert.equal(criteria.blue, false);
    assert.equal(criteria.black, false);
    assert.equal(criteria.red, true);
    assert.equal(criteria.green, true);
    assert.equal(criteria.colorless, false);
});
test('describes card-search refinement provenance for server-backed and fallback filters', () => {
    const report = describeCardSearchRefinements(makeFilters({
        searchText: '"draw a card"',
        searchNames: true,
        searchTypes: true,
        searchRules: true,
        colors: { ...DEFAULT_DECK_SEARCH_SETTINGS.colors, red: true, green: true },
        colorMatch: 'exact',
        excludedColors: { ...DEFAULT_DECK_SEARCH_SETTINGS.excludedColors, white: true },
        types: ['INSTANT'],
        excludedTypes: ['CREATURE'],
        rarities: ['COMMON'],
        excludedRarities: ['MYTHIC'],
        setCodes: ['M11'],
        manaValue: 3,
        manaValueOperator: 'lte',
        pennyDreadful: true,
        uniqueNames: true,
        piles: true,
    }), {
        deckTypes: ['Variant Magic - Penny Dreadful Commander'],
        deckFormat: 'Constructed - Modern',
        sortBy: 'cardType',
    });
    assert.deepEqual(report.serverBacked.map(entry => entry.key), [
        'pennyDreadful',
        'setCodes',
        'types',
        'excludedTypes',
        'rarities',
    ]);
    assert.deepEqual(report.clientFallbacks.map(entry => entry.key), [
        'multiScopeText',
        'excludedRarities',
        'colors',
        'excludedColors',
        'manaValue',
        'uniqueNames',
    ]);
    assert.deepEqual(report.clientPresentation.map(entry => entry.key), [
        'sort',
        'piles',
    ]);
});
test('describes unique names and non-name sorts as accepted client presentation refinements', () => {
    const report = describeCardSearchRefinements(makeFilters({
        nameContains: 'bolt',
        searchText: 'bolt',
        searchNames: true,
        searchTypes: false,
        searchRules: false,
        uniqueNames: true,
    }), {
        sortBy: 'rarity',
    });
    assert.deepEqual(report.serverBacked.map(entry => entry.key), ['name']);
    assert.deepEqual(report.clientFallbacks.map(entry => entry.key), []);
    assert.deepEqual(report.clientPresentation.map(entry => entry.key), ['uniqueNames', 'sort']);
    assert.match(report.clientPresentation.find(entry => entry.key === 'uniqueNames')?.reason ?? '', /Java grid presentation/);
});
test('keeps Card Type sort local so older server search criteria remain valid', () => {
    const criteria = buildCardSearchCriteria(makeFilters(), {
        sortBy: 'cardType',
    });
    assert.equal(criteria.sortBy, 'name');
});
test('uses broad server criteria for Java-style multi-scope text searches', () => {
    const criteria = buildCardSearchCriteria(makeFilters({
        searchText: '"draw a card"',
        searchNames: true,
        searchTypes: true,
        searchRules: true,
    }), {
        deckFormat: 'Constructed - Modern',
        sortBy: 'name',
    });
    assert.equal(criteria.nameContains, undefined);
    assert.equal(criteria.rules, undefined);
    assert.equal(criteria.searchText, '"draw a card"');
    assert.equal(criteria.searchNames, true);
    assert.equal(criteria.searchTypes, true);
    assert.equal(criteria.searchRules, true);
    assert.equal(criteria.uniqueNames, false);
    assert.equal(criteria.count, 1000);
    assert.equal(buildCardSearchCriteria(makeFilters({
        searchText: 'legendary',
        searchNames: false,
        searchTypes: false,
        searchRules: true,
    }), {
        sortBy: 'name',
    }).rules, 'legendary');
});
test('resolves Penny Dreadful search format from server deck types', () => {
    assert.equal(resolvePennyDreadfulSearchFormat([
        'Constructed - Standard',
        'Penny Dreadful Commander',
        'Variant Magic - Penny Dreadful Commander',
    ]), 'Variant Magic - Penny Dreadful Commander');
    assert.equal(resolvePennyDreadfulSearchFormat([
        'Constructed - Standard',
        'Penny Dreadful Commander',
    ]), 'Penny Dreadful Commander');
    assert.equal(resolvePennyDreadfulSearchFormat([
        'Variant Magic - Penny Dreadful Commander',
    ]), 'Variant Magic - Penny Dreadful Commander');
    assert.equal(resolvePennyDreadfulSearchFormat([
        'Experimental Penny Dreadful Commander League',
    ]), 'Experimental Penny Dreadful Commander League');
    assert.equal(resolvePennyDreadfulSearchFormat([]), 'Variant Magic - Penny Dreadful Commander');
});
test('uses authoritative Penny Dreadful format when the Penny filter is enabled', () => {
    const criteria = buildCardSearchCriteria(makeFilters({
        pennyDreadful: true,
    }), {
        deckTypes: ['Constructed - Standard', 'Penny Dreadful Commander', 'Variant Magic - Penny Dreadful Commander'],
        deckFormat: 'Constructed - Modern',
        sortBy: 'name',
    });
    assert.equal(criteria.format, 'Variant Magic - Penny Dreadful Commander');
});
test('applies exact color, exclusion, rules, set, and mana range filters locally', () => {
    const results = applyCardSearchFilters([
        makeCard('Lightning Bolt', ['INSTANT'], {
            color: color({ red: true }),
            rules: ['Lightning Bolt deals 3 damage to any target.'],
            expansionSetCode: 'M11',
            manaValue: 1,
            rarity: Rarity.COMMON,
        }),
        makeCard('Fire Ice', ['INSTANT'], {
            color: color({ red: true, blue: true }),
            rules: ['Split card'],
            expansionSetCode: 'DMR',
            manaValue: 2,
            rarity: Rarity.UNCOMMON,
        }),
        makeCard('Goblin Guide', ['CREATURE'], {
            color: color({ red: true }),
            rules: ['Haste'],
            expansionSetCode: 'ZEN',
            manaValue: 1,
            rarity: Rarity.RARE,
        }),
    ], makeFilters({
        rulesContains: 'damage',
        colors: { ...DEFAULT_DECK_SEARCH_SETTINGS.colors, red: true },
        colorMatch: 'exact',
        types: ['INSTANT'],
        excludedTypes: ['CREATURE'],
        excludedRarities: ['RARE'],
        setCodes: ['M11'],
        manaValue: 1,
        manaValueOperator: 'lte',
    }));
    assert.deepEqual(results.map(card => card.name), ['Lightning Bolt']);
});
test('matches Java-style search text scopes with quoted tokens and type text', () => {
    const results = applyCardSearchFilters([
        makeCard('Elvish Visionary', ['CREATURE'], {
            rules: ['When Elvish Visionary enters, draw a card.'],
            subTypes: ['Elf', 'Shaman'],
        }),
        makeCard('Legendary Spell', ['SORCERY'], {
            rules: ['Draw a card.'],
            superTypes: ['LEGENDARY'],
        }),
        makeCard('Card Draw Trick', ['INSTANT'], {
            rules: ['Draw two cards.'],
            subTypes: ['Arcane'],
        }),
    ], makeFilters({
        searchText: '"draw a card"',
        searchNames: false,
        searchTypes: false,
        searchRules: true,
    }));
    assert.deepEqual(results.map(card => card.name), ['Elvish Visionary', 'Legendary Spell']);
    const typeResults = applyCardSearchFilters([
        makeCard('Wild Growth', ['ENCHANTMENT'], { subTypes: ['Aura'] }),
        makeCard('Legendary Spell', ['SORCERY'], { superTypes: ['LEGENDARY'] }),
    ], makeFilters({
        searchText: 'legendary',
        searchNames: false,
        searchTypes: true,
        searchRules: false,
    }));
    assert.deepEqual(typeResults.map(card => card.name), ['Legendary Spell']);
    const cardTypeResults = applyCardSearchFilters([
        makeCard('Lightning Bolt', ['INSTANT']),
        makeCard('Llanowar Elves', ['CREATURE']),
    ], makeFilters({
        searchText: 'instant',
        searchNames: false,
        searchTypes: true,
        searchRules: false,
    }));
    assert.deepEqual(cardTypeResults.map(card => card.name), ['Lightning Bolt']);
});
test('matches mana symbol text through the rules scope like the deck grid search tooltip promises', () => {
    const results = applyCardSearchFilters([
        makeCard('Llanowar Elves', ['CREATURE'], {
            manaCostLeftStr: ['{G}'],
        }),
        makeCard('Opt', ['INSTANT'], {
            manaCostLeftStr: ['{U}'],
        }),
    ], makeFilters({
        searchText: '{G}',
        searchNames: false,
        searchTypes: false,
        searchRules: true,
    }));
    assert.deepEqual(results.map(card => card.name), ['Llanowar Elves']);
    const disabledResults = applyCardSearchFilters([
        makeCard('Llanowar Elves', ['CREATURE'], {
            manaCostLeftStr: ['{G}'],
        }),
    ], makeFilters({
        searchText: '{G}',
        searchNames: true,
        searchTypes: true,
        searchRules: false,
    }));
    assert.deepEqual(disabledResults.map(card => card.name), []);
});
test('deduplicates alternate printings when unique names is enabled', () => {
    const results = applyCardSearchFilters([
        makeCard('Opt', ['INSTANT'], { expansionSetCode: 'XLN', cardNumber: '65' }),
        makeCard('Opt', ['INSTANT'], { expansionSetCode: 'DOM', cardNumber: '60' }),
        makeCard('Consider', ['INSTANT'], { expansionSetCode: 'MID', cardNumber: '44' }),
    ], makeFilters({
        uniqueNames: true,
    }));
    assert.deepEqual(results.map(card => `${card.name}:${card.expansionSetCode}`), ['Opt:XLN', 'Consider:MID']);
});
test('matches Java unique mode by raw card name instead of display label normalization', () => {
    const results = applyCardSearchFilters([
        makeCard('Fire', ['INSTANT'], {
            displayName: 'Fire // Ice',
            expansionSetCode: 'APC',
            cardNumber: '128a',
        }),
        makeCard('Fire', ['INSTANT'], {
            displayName: 'Fire',
            expansionSetCode: 'DMR',
            cardNumber: '124',
        }),
        makeCard('fire', ['INSTANT'], {
            displayName: 'Fire',
            expansionSetCode: 'TST',
            cardNumber: '1',
        }),
        makeCard('', ['INSTANT'], {
            displayName: 'Nameless display fallback',
            expansionSetCode: 'TST',
            cardNumber: '2',
        }),
    ], makeFilters({
        uniqueNames: true,
    }));
    assert.deepEqual(results.map(card => `${card.name || '<empty>'}:${card.expansionSetCode}`), [
        'Fire:APC',
        'fire:TST',
    ]);
});
test('sorts card search results by rarity, color, card type, card number, and mana value', () => {
    const cards = [
        makeCard('Rare Red', ['CREATURE'], { rarity: Rarity.RARE, color: color({ red: true }), manaValue: 4, expansionSetCode: 'M11', cardNumber: '149' }),
        makeCard('Common Green', ['CREATURE'], { rarity: Rarity.COMMON, color: color({ green: true }), manaValue: 1, expansionSetCode: 'DMU', cardNumber: '281' }),
        makeCard('Uncommon Blue', ['CREATURE'], { rarity: Rarity.UNCOMMON, color: color({ blue: true }), manaValue: 2, expansionSetCode: 'APC', cardNumber: '128a' }),
        makeCard('Common Black', ['CREATURE'], { rarity: Rarity.COMMON, color: color({ black: true }), manaValue: 3, expansionSetCode: 'M13', cardNumber: '170' }),
        makeCard('Common Aura', ['ENCHANTMENT'], { rarity: Rarity.COMMON, color: color({ white: true }), manaValue: 2, expansionSetCode: 'TST', cardNumber: '' }),
    ];
    assert.deepEqual(sortSearchResults(cards, { sortBy: 'rarity', sortDirection: 'asc' }).map(card => card.name), [
        'Common Aura',
        'Common Black',
        'Common Green',
        'Uncommon Blue',
        'Rare Red',
    ]);
    assert.deepEqual(sortSearchResults(cards, { sortBy: 'manaValue', sortDirection: 'desc' }).map(card => card.name), [
        'Rare Red',
        'Common Black',
        'Uncommon Blue',
        'Common Aura',
        'Common Green',
    ]);
    assert.deepEqual(sortSearchResults(cards, { sortBy: 'color', sortDirection: 'asc' }).map(card => card.name), [
        'Common Black',
        'Uncommon Blue',
        'Common Green',
        'Rare Red',
        'Common Aura',
    ]);
    assert.deepEqual(sortSearchResults(cards, { sortBy: 'cardType', sortDirection: 'asc' }).map(card => card.name), [
        'Common Black',
        'Common Green',
        'Rare Red',
        'Uncommon Blue',
        'Common Aura',
    ]);
    assert.deepEqual(sortSearchResults(cards, { sortBy: 'cardNumber', sortDirection: 'asc' }).map(card => `${card.name}:${card.expansionSetCode}:${card.cardNumber || '<empty>'}`), [
        'Uncommon Blue:APC:128a',
        'Rare Red:M11:149',
        'Common Black:M13:170',
        'Common Green:DMU:281',
        'Common Aura:TST:<empty>',
    ]);
});
test('builds Java-style piles from the active collection sort category', () => {
    const cards = [
        makeCard('Forest', ['LAND'], { expansionSetCode: 'DMU', cardNumber: '281', manaValue: 0, color: color() }),
        makeCard('Llanowar Elves', ['CREATURE'], { expansionSetCode: 'M11', cardNumber: '184', manaValue: 1, color: color({ green: true }) }),
        makeCard('Elvish Visionary', ['CREATURE'], { expansionSetCode: 'M13', cardNumber: '170', manaValue: 2, color: color({ green: true }) }),
        makeCard('Lightning Bolt', ['INSTANT'], { expansionSetCode: 'M11', cardNumber: '149', manaValue: 1, color: color({ red: true }) }),
    ];
    assert.deepEqual(createSearchResultPiles(cards, { sortBy: 'manaValue', sortDirection: 'asc' }).map(pile => ({
        label: pile.label,
        cards: pile.cards.map(card => card.name),
    })), [
        { label: 'CMC: 0', cards: ['Forest'] },
        { label: 'CMC: 1', cards: ['Lightning Bolt', 'Llanowar Elves'] },
        { label: 'CMC: 2', cards: ['Elvish Visionary'] },
    ]);
    assert.deepEqual(createSearchResultPiles(cards, { sortBy: 'color', sortDirection: 'asc' }).map(pile => pile.label), [
        '{C}',
        '{G}',
        '{R}',
    ]);
    assert.deepEqual(createSearchResultPiles(cards, { sortBy: 'cardType', sortDirection: 'asc' }).map(pile => ({
        label: pile.label,
        cards: pile.cards.map(card => card.name),
    })), [
        { label: 'CREATURE', cards: ['Elvish Visionary', 'Llanowar Elves'] },
        { label: 'INSTANT', cards: ['Lightning Bolt'] },
        { label: 'LAND', cards: ['Forest'] },
    ]);
    const blueBlackPiles = createSearchResultPiles([
        makeCard('Plains', ['LAND'], { color: color() }),
        makeCard('Merfolk Looter', ['CREATURE'], { color: color({ blue: true }) }),
        makeCard('Doom Blade', ['INSTANT'], { color: color({ black: true }) }),
        makeCard('Savannah Lions', ['CREATURE'], { color: color({ white: true }) }),
    ], { sortBy: 'color', sortDirection: 'asc' });
    assert.deepEqual(blueBlackPiles.map(pile => pile.label), ['{C}', '{B}', '{U}', '{W}']);
    assert.deepEqual(createSearchResultPiles(cards, { sortBy: 'cardNumber', sortDirection: 'asc' }).map(pile => ({
        label: pile.label,
        cards: pile.cards.map(card => card.name),
    })), [
        { label: 'No. 149', cards: ['Lightning Bolt'] },
        { label: 'No. 170', cards: ['Elvish Visionary'] },
        { label: 'No. 184', cards: ['Llanowar Elves'] },
        { label: 'No. 281', cards: ['Forest'] },
    ]);
});
