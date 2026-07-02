import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DeckLandsService,
  createEmptyBasicLandCounts,
  defaultAddLandsDeckSize,
  type BasicLandCounts,
} from './DeckLandsService.js';
import { Rarity, type BasicLandSetInfo, type CardSearchCriteria, type DeckCardLists, type ObjectColor, type SearchCardView } from '../types/index.js';

function color(overrides: Partial<ObjectColor> = {}): ObjectColor {
  return {
    white: false,
    blue: false,
    black: false,
    red: false,
    green: false,
    ...overrides,
  };
}

function makeCard(
  name: string,
  manaCostLeftStr: string[] = [],
  setCode = 'M15',
  cardNumber = '1',
  overrides: Partial<SearchCardView> = {},
): SearchCardView {
  return {
    id: `${setCode}-${cardNumber}-${name}`,
    name,
    displayName: name,
    rules: [],
    power: '',
    toughness: '',
    loyalty: '',
    defense: '',
    cardTypes: name.match(/Plains|Island|Swamp|Mountain|Forest/) ? ['LAND'] : [],
    subTypes: [],
    superTypes: [],
    expansionSetCode: setCode,
    cardNumber,
    imageFileName: '',
    imageNumber: 0,
    color: color(),
    frameColor: color(),
    manaValue: manaCostLeftStr.length,
    rarity: name.match(/Plains|Island|Swamp|Mountain|Forest/) ? Rarity.LAND : Rarity.COMMON,
    isSplitCard: false,
    isDoubleFacedCard: false,
    manaCostLeftStr,
    manaCostRightStr: [],
    ...overrides,
  };
}

function makeDeck(cards: DeckCardLists['cards'], format = 'Constructed - Standard'): DeckCardLists {
  return {
    name: 'Lands Deck',
    format,
    cards,
    sideboard: [],
  };
}

function makeBasicLandSet(
  setCode: string,
  name: string,
  releaseDate: number,
  overrides: Partial<BasicLandSetInfo> = {},
): BasicLandSetInfo {
  return {
    setCode,
    name,
    blockName: null,
    releaseDate,
    hasBasicLands: true,
    hasSnowBasics: false,
    ...overrides,
  };
}

function makeService(cards: SearchCardView[]): DeckLandsService {
  return new DeckLandsService({
    searchCards: async ({ nameContains, setCodes }: CardSearchCriteria) => cards.filter(card => (
      card.name === nameContains
      && (!setCodes?.length || setCodes.includes(card.expansionSetCode))
    )),
  });
}

test('suggests lands with the same sequential ratio math as the Java utility', async () => {
  const service = makeService([
    makeCard('Lightning Bolt', ['{R}']),
    makeCard('Llanowar Elves', ['{G}']),
  ]);
  const report = await service.suggestBasicLands(makeDeck([
    { amount: 10, cardName: 'Lightning Bolt' },
    { amount: 5, cardName: 'Llanowar Elves' },
  ]), 40);

  assert.deepEqual(report, {
    plains: 0,
    island: 0,
    swamp: 0,
    mountain: 17,
    forest: 8,
  });
});

test('suggests an even five-color fallback when mana metadata is unavailable', async () => {
  const service = makeService([]);
  const report = await service.suggestBasicLands(makeDeck([
    { amount: 35, cardName: 'Unknown Spell' },
  ]), 40);

  assert.deepEqual(report, {
    plains: 1,
    island: 1,
    swamp: 1,
    mountain: 1,
    forest: 1,
  });
});

test('adds resolved basic land printings to the selected zone and merges existing copies', async () => {
  const service = makeService([
    makeCard('Mountain', [], 'M15', '265'),
    makeCard('Forest', [], 'M15', '271'),
  ]);
  const counts: BasicLandCounts = {
    ...createEmptyBasicLandCounts(),
    mountain: 3,
    forest: 2,
  };
  const result = await service.addBasicLands(makeDeck([
    { amount: 1, cardName: 'Mountain', setCode: 'M15', cardNumber: '265' },
  ]), counts, 'main');

  assert.deepEqual(result.unresolvedCardNames, []);
  assert.equal(result.deck.cards.find(card => card.cardName === 'Mountain')?.amount, 4);
  assert.equal(result.deck.cards.find(card => card.cardName === 'Forest')?.amount, 2);
});

test('lists basic-land set options from server search and prioritizes deck sets', async () => {
  const cards = [
    makeCard('Forest', [], 'BFZ', '270', { imageFileName: 'forest-full-art.jpg' }),
    makeCard('Mountain', [], 'M15', '265'),
    makeCard('Forest', [], 'M15', '271'),
    makeCard('Snow-Covered Forest', [], 'ICE', '383', { superTypes: ['SNOW'] }),
  ];
  const service = new DeckLandsService({
    searchCards: async ({ nameContains }: CardSearchCriteria) => cards.filter(card => (
      card.name.toLowerCase().includes((nameContains ?? '').toLowerCase())
    )),
  });

  const options = await service.listBasicLandSetOptions(makeDeck([
    { amount: 1, cardName: 'Mountain', setCode: 'M15', cardNumber: '265' },
  ]), { allowSnowBasics: true });

  assert.equal(options[0].setCode, 'M15');
  assert.equal(options[0].isDeckSet, true);
  assert.deepEqual(options[0].landNames, ['Forest', 'Mountain']);
  assert.equal(options.find(option => option.setCode === 'BFZ')?.hasFullArtPrintings, true);
  assert.equal(options.find(option => option.setCode === 'ICE')?.hasSnowBasics, true);
});

test('uses repository basic-land set names and release ordering when available', async () => {
  const cards = [
    makeCard('Forest', [], 'BFZ', '270', { imageFileName: 'forest-full-art.jpg' }),
    makeCard('Mountain', [], 'M15', '265'),
    makeCard('Forest', [], 'M15', '271'),
  ];
  const service = new DeckLandsService({
    searchCards: async ({ nameContains }: CardSearchCriteria) => cards.filter(card => (
      card.name.toLowerCase().includes((nameContains ?? '').toLowerCase())
    )),
    listBasicLandSets: async () => [
      makeBasicLandSet('M15', 'Magic 2015', 1_405_641_600_000),
      makeBasicLandSet('BFZ', 'Battle for Zendikar', 1_443_129_600_000),
      makeBasicLandSet('UGL', 'Unglued', 904_608_000_000),
    ],
  });

  const options = await service.listBasicLandSetOptions(makeDeck([]));

  assert.deepEqual(options.map(option => option.setCode), ['BFZ', 'M15', 'UGL']);
  assert.equal(options[0].label, 'Battle for Zendikar (BFZ)');
  assert.equal(options[0].hasFullArtPrintings, true);
  assert.deepEqual(options[0].landNames, ['Forest']);
  assert.deepEqual(options[2].landNames, []);
});

test('keeps deck set options first before repository release ordering', async () => {
  const service = new DeckLandsService({
    searchCards: async () => [],
    listBasicLandSets: async () => [
      makeBasicLandSet('BFZ', 'Battle for Zendikar', 1_443_129_600_000),
      makeBasicLandSet('M15', 'Magic 2015', 1_405_641_600_000),
      makeBasicLandSet('UGL', 'Unglued', 904_608_000_000),
    ],
  });

  const options = await service.listBasicLandSetOptions(makeDeck([
    { amount: 1, cardName: 'Lightning Bolt', setCode: 'M15', cardNumber: '149' },
  ]));

  assert.deepEqual(options.map(option => option.setCode), ['M15', 'BFZ', 'UGL']);
  assert.equal(options[0].isDeckSet, true);
});

test('filters repository snow-basic sets outside free-building mode', async () => {
  const service = new DeckLandsService({
    searchCards: async () => [],
    listBasicLandSets: async () => [
      makeBasicLandSet('M15', 'Magic 2015', 1_405_641_600_000),
      makeBasicLandSet('ICE', 'Ice Age', 803_520_000_000, { hasSnowBasics: true }),
    ],
  });

  const limitedOptions = await service.listBasicLandSetOptions(makeDeck([]), { allowSnowBasics: false });
  assert.deepEqual(limitedOptions.map(option => option.setCode), ['M15']);

  const freeBuildOptions = await service.listBasicLandSetOptions(makeDeck([]), { allowSnowBasics: true });
  assert.deepEqual(freeBuildOptions.map(option => option.setCode), ['M15', 'ICE']);
  assert.equal(freeBuildOptions.find(option => option.setCode === 'ICE')?.hasSnowBasics, true);
});

test('falls back to search-derived basic-land set options when repository sets are unavailable', async () => {
  const cards = [
    makeCard('Forest', [], 'BFZ', '270', { imageFileName: 'forest-full-art.jpg' }),
    makeCard('Forest', [], 'M15', '271'),
  ];
  const service = new DeckLandsService({
    searchCards: async ({ nameContains }: CardSearchCriteria) => cards.filter(card => (
      card.name.toLowerCase().includes((nameContains ?? '').toLowerCase())
    )),
    listBasicLandSets: async () => {
      throw new Error('older server');
    },
  });

  const options = await service.listBasicLandSetOptions(makeDeck([]));

  assert.deepEqual(options.map(option => option.setCode), ['BFZ', 'M15']);
  assert.equal(options[0].label, 'BFZ (1/5)');
  assert.equal(options[0].hasFullArtPrintings, true);
});

test('hides snow-only basic-land set options outside free-building mode', async () => {
  const cards = [
    makeCard('Forest', [], 'M15', '271'),
    makeCard('Snow-Covered Forest', [], 'ICE', '383', { superTypes: ['SNOW'] }),
  ];
  const service = new DeckLandsService({
    searchCards: async ({ nameContains }: CardSearchCriteria) => cards.filter(card => (
      card.name.toLowerCase().includes((nameContains ?? '').toLowerCase())
    )),
  });

  const options = await service.listBasicLandSetOptions(makeDeck([]), { allowSnowBasics: false });

  assert.deepEqual(options.map(option => option.setCode), ['M15']);
});

test('resolves Add Lands printings from the requested set code', async () => {
  const seenCriteria: CardSearchCriteria[] = [];
  const service = new DeckLandsService({
    searchCards: async (criteria) => {
      seenCriteria.push(criteria);
      return [
        makeCard('Mountain', [], 'M11', '244'),
        makeCard('Mountain', [], 'M15', '265'),
      ].filter(card => (
        card.name === criteria.nameContains
        && (!criteria.setCodes?.length || criteria.setCodes.includes(card.expansionSetCode))
      ));
    },
  });
  const counts: BasicLandCounts = {
    ...createEmptyBasicLandCounts(),
    mountain: 2,
  };
  const result = await service.addBasicLands(makeDeck([]), counts, 'main', { setCode: ' m15 ' });

  assert.deepEqual(seenCriteria[0].setCodes, ['M15']);
  assert.deepEqual(result.unresolvedCardNames, []);
  assert.deepEqual(result.deck.cards, [
    { amount: 2, cardName: 'Mountain', setCode: 'M15', cardNumber: '265' },
  ]);
});

test('resolves snow-covered basics only when snow basics are allowed', async () => {
  const service = new DeckLandsService({
    searchCards: async ({ nameContains, setCodes }: CardSearchCriteria) => [
      makeCard('Snow-Covered Forest', [], 'ICE', '383', { superTypes: ['SNOW'] }),
    ].filter(card => (
      card.name.toLowerCase().includes((nameContains ?? '').toLowerCase())
      && (!setCodes?.length || setCodes.includes(card.expansionSetCode))
    )),
  });
  const counts: BasicLandCounts = {
    ...createEmptyBasicLandCounts(),
    forest: 1,
  };

  const limitedResult = await service.addBasicLands(makeDeck([]), counts, 'main', { setCode: 'ICE' });
  assert.deepEqual(limitedResult.unresolvedCardNames, ['Forest']);
  assert.deepEqual(limitedResult.deck.cards, [{ cardName: 'Forest', amount: 1 }]);

  const freeBuildResult = await service.addBasicLands(makeDeck([]), counts, 'main', {
    setCode: 'ICE',
    allowSnowBasics: true,
  });
  assert.deepEqual(freeBuildResult.unresolvedCardNames, []);
  assert.deepEqual(freeBuildResult.deck.cards, [
    { amount: 1, cardName: 'Snow-Covered Forest', setCode: 'ICE', cardNumber: '383' },
  ]);
});

test('filters Add Lands resolution to full-art basic printings when requested', async () => {
  const service = makeService([
    makeCard('Forest', [], 'M15', '271', { imageFileName: 'forest-normal.jpg' }),
    makeCard('Forest', [], 'BFZ', '270', { imageFileName: 'forest-full-art.jpg' }),
  ]);
  const counts: BasicLandCounts = {
    ...createEmptyBasicLandCounts(),
    forest: 1,
  };
  const result = await service.addBasicLands(makeDeck([]), counts, 'main', { fullArtOnly: true });

  assert.deepEqual(result.unresolvedCardNames, []);
  assert.deepEqual(result.deck.cards, [
    { amount: 1, cardName: 'Forest', setCode: 'BFZ', cardNumber: '270' },
  ]);
});

test('reports unresolved Add Lands names when full-art filtering has no matching printing', async () => {
  const service = makeService([
    makeCard('Plains', [], 'M15', '250', { imageFileName: 'plains-normal.jpg' }),
  ]);
  const counts: BasicLandCounts = {
    ...createEmptyBasicLandCounts(),
    plains: 1,
  };
  const result = await service.addBasicLands(makeDeck([]), counts, 'side', { fullArtOnly: true });

  assert.deepEqual(result.unresolvedCardNames, ['Plains']);
  assert.deepEqual(result.deck.sideboard, [{ cardName: 'Plains', amount: 1 }]);
});

test('falls back to name-only lands when server search is unavailable', async () => {
  const service = new DeckLandsService({
    searchCards: async () => {
      throw new Error('WebSocket is not connected');
    },
  });
  const counts: BasicLandCounts = {
    ...createEmptyBasicLandCounts(),
    plains: 2,
  };
  const result = await service.addBasicLands(makeDeck([]), counts, 'side');

  assert.deepEqual(result.unresolvedCardNames, ['Plains']);
  assert.deepEqual(result.deck.sideboard, [{ cardName: 'Plains', amount: 2 }]);
});

test('defaults Add Lands target size from the deck format', () => {
  assert.equal(defaultAddLandsDeckSize(makeDeck([], 'Constructed - Commander')), 100);
  assert.equal(defaultAddLandsDeckSize(makeDeck([], 'Constructed - Modern')), 60);
  assert.equal(defaultAddLandsDeckSize(makeDeck([], 'Limited')), 40);
  assert.equal(defaultAddLandsDeckSize(makeDeck([], 'Constructed - Pauper'), { limited: true }), 40);
  assert.equal(defaultAddLandsDeckSize(makeDeck([
    { amount: 45, cardName: 'Lightning Bolt' },
  ], 'Constructed - Pauper'), { limited: true }), 45);
});
