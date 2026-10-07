import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DeckAnalyticsService } from './DeckAnalyticsService.js';
import { Rarity, type CardSearchCriteria, type CardType, type DeckCardLists, type ObjectColor, type SearchCardView } from '../types/index.js';

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
  cardTypes: CardType[],
  manaValue: number,
  cardColor: ObjectColor = color(),
  setCode = 'M11',
  cardNumber = '149',
  manaCostLeftStr: string[] = [],
  subTypes: string[] = [],
  rules: string[] = [],
): SearchCardView {
  return {
    id: `${setCode}-${cardNumber}-${name}`,
    name,
    displayName: name,
    rules,
    power: '',
    toughness: '',
    loyalty: '',
    defense: '',
    cardTypes,
    subTypes,
    superTypes: [],
    expansionSetCode: setCode,
    cardNumber,
    imageFileName: '',
    imageNumber: 0,
    color: cardColor,
    frameColor: cardColor,
    manaValue,
    manaCostLeftStr,
    manaCostRightStr: [],
    rarity: Rarity.COMMON,
    isSplitCard: false,
    isDoubleFacedCard: false,
  };
}

function makeDeck(cards: DeckCardLists['cards'], sideboard: DeckCardLists['sideboard'] = [], format = 'Constructed - Standard'): DeckCardLists {
  return {
    name: 'Analytics Deck',
    format,
    cards,
    sideboard,
  };
}

function makeService(cards: SearchCardView[]): DeckAnalyticsService {
  return new DeckAnalyticsService({
    searchCards: async ({ nameContains }: CardSearchCriteria) => cards.filter(card => card.name === nameContains),
  });
}

function getCount(reportBuckets: Array<{ key: string; count: number }>, key: string): number {
  return reportBuckets.find(bucket => bucket.key === key)?.count ?? 0;
}

test('reports main and sideboard counts plus format target gaps', async () => {
  const service = makeService([
    makeCard('Lightning Bolt', ['INSTANT'], 1, color({ red: true })),
    makeCard('Monastery Swiftspear', ['CREATURE'], 1, color({ red: true })),
    makeCard('Mountain', ['LAND'], 0),
  ]);
  const report = await service.analyzeDeck(makeDeck([
    { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    { amount: 2, cardName: 'Monastery Swiftspear', setCode: 'KTK', cardNumber: '118' },
    { amount: 24, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
  ], [
    { amount: 3, cardName: 'Shock', setCode: 'M21', cardNumber: '159' },
  ]));

  assert.equal(report.totals.mainCount, 30);
  assert.equal(report.totals.sideboardCount, 3);
  assert.equal(report.totals.totalCount, 33);
  assert.equal(report.totals.uniqueTotalCount, 4);
  assert.equal(report.formatTarget.shortName, 'Standard');
  assert.equal(report.formatTarget.remainingMain, 30);
  assert.equal(report.formatTarget.sideboardOver, 0);
});

test('builds type counts, colors, and nonland mana curve from metadata', async () => {
  const service = makeService([
    makeCard('Lightning Bolt', ['INSTANT'], 1, color({ red: true }), 'M11', '149', ['{R}']),
    makeCard('Monastery Swiftspear', ['CREATURE'], 1, color({ red: true }), 'KTK', '118', ['{R}']),
    makeCard('Mountain', ['LAND'], 0, color(), 'M11', '244', [], ['Mountain'], ['{T}: Add {R}.']),
    makeCard('Mishra\'s Bauble', ['ARTIFACT'], 0),
    makeCard('Elder Gargaroth', ['CREATURE'], 5, color({ green: true }), 'M21', '179', ['{3}', '{G}', '{G}']),
    makeCard('Llanowar Elves', ['CREATURE'], 1, color({ green: true }), 'M12', '182', ['{G}'], ['Elf', 'Druid'], ['{T}: Add {G}.']),
  ]);
  const report = await service.analyzeDeck(makeDeck([
    { amount: 4, cardName: 'Lightning Bolt' },
    { amount: 2, cardName: 'Monastery Swiftspear' },
    { amount: 24, cardName: 'Mountain' },
    { amount: 4, cardName: 'Mishra\'s Bauble' },
    { amount: 1, cardName: 'Elder Gargaroth' },
    { amount: 4, cardName: 'Llanowar Elves' },
  ]));

  assert.equal(report.metadataStatus, 'complete');
  assert.equal(getCount(report.typeCounts, 'instant'), 4);
  assert.equal(getCount(report.typeCounts, 'creature'), 7);
  assert.equal(getCount(report.typeCounts, 'artifact'), 4);
  assert.equal(getCount(report.typeCounts, 'land'), 24);
  assert.deepEqual(report.typeCounts.find(bucket => bucket.key === 'creature')?.cardNames, [
    'Monastery Swiftspear',
    'Elder Gargaroth',
    'Llanowar Elves',
  ]);
  assert.deepEqual(report.typeCounts.find(bucket => bucket.key === 'instant')?.cardNames, ['Lightning Bolt']);
  assert.equal(getCount(report.colors, 'red'), 6);
  assert.equal(getCount(report.colors, 'green'), 5);
  assert.equal(getCount(report.colors, 'colorless'), 28);
  assert.deepEqual(report.colors.find(bucket => bucket.key === 'red')?.cardNames, [
    'Lightning Bolt',
    'Monastery Swiftspear',
  ]);
  assert.deepEqual(report.colors.find(bucket => bucket.key === 'green')?.cardNames, [
    'Elder Gargaroth',
    'Llanowar Elves',
  ]);
  assert.deepEqual(report.colors.find(bucket => bucket.key === 'colorless')?.cardNames, [
    'Mountain',
    'Mishra\'s Bauble',
  ]);
  assert.equal(getCount(report.manaCurve, '0'), 4);
  assert.equal(getCount(report.manaCurve, '1'), 10);
  assert.equal(getCount(report.manaCurve, '5'), 1);
  assert.deepEqual(report.manaCurve.find(bucket => bucket.key === '1')?.cardNames, [
    'Lightning Bolt',
    'Monastery Swiftspear',
    'Llanowar Elves',
  ]);
  assert.deepEqual(report.manaCurve.find(bucket => bucket.key === '5')?.cardNames, ['Elder Gargaroth']);
  assert.equal(getCount(report.manaPips, 'red'), 6);
  assert.equal(getCount(report.manaPips, 'green'), 6);
  assert.equal(getCount(report.manaPips, 'colorless'), 3);
  assert.deepEqual(report.manaPips.find(bucket => bucket.key === 'red')?.cardNames, [
    'Lightning Bolt',
    'Monastery Swiftspear',
  ]);
  assert.deepEqual(report.manaPips.find(bucket => bucket.key === 'green')?.cardNames, [
    'Elder Gargaroth',
    'Llanowar Elves',
  ]);
  assert.deepEqual(report.manaPips.find(bucket => bucket.key === 'colorless')?.cardNames, ['Elder Gargaroth']);
  assert.equal(getCount(report.landSources, 'mountain'), 24);
  assert.equal(getCount(report.manaSources, 'red'), 24);
  assert.equal(getCount(report.manaSources, 'green'), 4);
  assert.deepEqual(report.landSources.find(bucket => bucket.key === 'mountain')?.cardNames, ['Mountain']);
  assert.deepEqual(report.manaSources.find(bucket => bucket.key === 'green')?.cardNames, ['Llanowar Elves']);
  const valueOnePips = report.manaDistribution.find(bucket => bucket.key === '1')?.pips ?? [];
  const valueFivePips = report.manaDistribution.find(bucket => bucket.key === '5')?.pips ?? [];
  assert.equal(getCount(valueOnePips, 'red'), 6);
  assert.equal(getCount(valueOnePips, 'green'), 4);
  assert.equal(report.manaDistribution.find(bucket => bucket.key === '1')?.total, 10);
  assert.deepEqual(report.manaDistribution.find(bucket => bucket.key === '1')?.cardNames, [
    'Lightning Bolt',
    'Monastery Swiftspear',
    'Llanowar Elves',
  ]);
  assert.equal(getCount(valueFivePips, 'green'), 2);
  assert.equal(getCount(valueFivePips, 'colorless'), 3);
  assert.equal(report.manaDistribution.find(bucket => bucket.key === '5')?.total, 5);
  assert.deepEqual(report.manaDistribution.find(bucket => bucket.key === '5')?.cardNames, ['Elder Gargaroth']);
  assert.equal(report.nonLandCount, 15);
  assert.equal(report.averageManaValue, 1);
});

test('uses commander targets when the deck format is commander', async () => {
  const service = makeService([
    makeCard('Sol Ring', ['ARTIFACT'], 1),
  ]);
  const report = await service.analyzeDeck(makeDeck([
    { amount: 1, cardName: 'Sol Ring' },
  ], [
    { amount: 1, cardName: 'Sol Ring' },
  ], 'Constructed - Commander'));

  assert.equal(report.formatTarget.minMain, 100);
  assert.equal(report.formatTarget.maxSideboard, 0);
  assert.equal(report.formatTarget.remainingMain, 99);
  assert.equal(report.formatTarget.sideboardOver, 1);
});

test('uses limited targets for draft and sealed construction analytics', async () => {
  const service = makeService([
    makeCard('Lightning Bolt', ['INSTANT'], 1, color({ red: true })),
    makeCard('Naturalize', ['INSTANT'], 2, color({ green: true })),
  ]);
  const report = await service.analyzeDeck(makeDeck([
    { amount: 1, cardName: 'Lightning Bolt' },
    { amount: 1, cardName: 'Naturalize' },
  ], [
    { amount: 20, cardName: 'Naturalize' },
  ], 'Limited'));

  assert.equal(report.formatTarget.deckType, 'Limited');
  assert.equal(report.formatTarget.shortName, 'Limited');
  assert.equal(report.formatTarget.minMain, 40);
  assert.equal(report.formatTarget.remainingMain, 38);
  assert.equal(report.formatTarget.sideboardOver, 0);
});

test('counts mana sources only from rules that add mana like the Java analyzer', async () => {
  const service = makeService([
    makeCard('Mountain', ['LAND'], 0, color(), 'M11', '244', [], ['Mountain'], ['{T}: Add {R}.']),
    makeCard('Shivan Dragon', ['CREATURE'], 6, color({ red: true }), 'M11', '153', ['{4}', '{R}', '{R}'], ['Dragon'], ['Flying', '{R}: Shivan Dragon gets +1/+0 until end of turn.']),
    makeCard('Mana Rock', ['ARTIFACT'], 2, color(), 'TST', '1', ['{2}'], [], ['{T}: Add {C}. Spend this mana only to cast artifact spells.']),
  ]);
  const report = await service.analyzeDeck(makeDeck([
    { amount: 3, cardName: 'Mountain' },
    { amount: 2, cardName: 'Shivan Dragon' },
    { amount: 1, cardName: 'Mana Rock' },
  ]));

  assert.equal(getCount(report.manaSources, 'red'), 3);
  assert.equal(getCount(report.manaSources, 'colorless'), 1);
  assert.deepEqual(report.manaSources.find(bucket => bucket.key === 'red')?.cardNames, ['Mountain']);
  assert.deepEqual(report.manaSources.find(bucket => bucket.key === 'colorless')?.cardNames, ['Mana Rock']);
});

test('keeps mana distribution at exact mana values like the Java analyzer bar chart', async () => {
  const service = makeService([
    makeCard('Seven Drop', ['CREATURE'], 7, color({ white: true }), 'TST', '7', ['{5}', '{W}', '{W}']),
    makeCard('Eight Drop', ['CREATURE'], 8, color({ blue: true }), 'TST', '8', ['{6}', '{U}', '{U}']),
  ]);
  const report = await service.analyzeDeck(makeDeck([
    { amount: 1, cardName: 'Seven Drop' },
    { amount: 1, cardName: 'Eight Drop' },
  ]));

  assert.equal(getCount(report.manaCurve, '7+'), 2);
  assert.equal(report.manaDistribution.some(bucket => bucket.key === '7+'), false);
  assert.deepEqual(report.manaDistribution.map(bucket => bucket.key), ['7', '8']);
  assert.equal(report.manaDistribution.find(bucket => bucket.key === '7')?.total, 7);
  assert.equal(report.manaDistribution.find(bucket => bucket.key === '8')?.total, 8);
  assert.equal(getCount(report.manaDistribution.find(bucket => bucket.key === '7')?.pips ?? [], 'white'), 2);
  assert.equal(getCount(report.manaDistribution.find(bucket => bucket.key === '8')?.pips ?? [], 'blue'), 2);
});

test('keeps count analytics available when metadata lookup fails', async () => {
  const service = new DeckAnalyticsService({
    searchCards: async () => {
      throw new Error('WebSocket is not connected');
    },
  });
  const report = await service.analyzeDeck(makeDeck([
    { amount: 60, cardName: 'Mountain' },
  ]));

  assert.equal(report.totals.mainCount, 60);
  assert.equal(report.metadataStatus, 'unavailable');
  assert.deepEqual(report.unresolvedCardNames, ['Mountain']);
  assert.equal(getCount(report.typeCounts, 'land'), 0);
  assert.equal(getCount(report.manaPips, 'red'), 0);
  assert.equal(getCount(report.landSources, 'mountain'), 0);
  assert.equal(report.manaDistribution.every(bucket => bucket.total === 0), true);
});

test('checks sideboard metadata without mixing sideboard cards into main-deck charts', async () => {
  const service = makeService([
    makeCard('Lightning Bolt', ['INSTANT'], 1, color({ red: true }), 'M11', '149', ['{R}']),
    makeCard('Island', ['LAND'], 0, color(), 'M11', '235', [], ['Island'], ['{T}: Add {U}.']),
  ]);
  const report = await service.analyzeDeck(makeDeck([
    { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
  ], [
    { amount: 2, cardName: 'Island', setCode: 'M11', cardNumber: '235' },
    { amount: 1, cardName: 'Sideboard Ghost', setCode: 'TST', cardNumber: '999' },
  ]));

  assert.equal(report.metadataStatus, 'partial');
  assert.deepEqual(report.unresolvedCardNames, ['Sideboard Ghost']);
  assert.equal(getCount(report.typeCounts, 'instant'), 4);
  assert.equal(getCount(report.typeCounts, 'land'), 0);
  assert.equal(getCount(report.manaSources, 'blue'), 0);
  assert.equal(getCount(report.landSources, 'island'), 0);
  assert.equal(report.nonLandCount, 4);
  assert.equal(report.averageManaValue, 1);
});
