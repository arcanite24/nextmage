import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DECK_GENERATOR_SETTINGS, type DeckGeneratorSettings } from './AppConfigService.js';
import { DeckGeneratorService } from './DeckGeneratorService.js';
import { Rarity, type CardSearchCriteria, type CardType, type ExpansionSetInfo, type ObjectColor, type SearchCardView, type SuperType } from '../types/index.js';

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
  overrides: Partial<SearchCardView> = {},
): SearchCardView {
  const setCode = overrides.expansionSetCode ?? 'TST';
  const cardNumber = overrides.cardNumber ?? String(name.length);

  return {
    id: `${setCode}-${cardNumber}-${name}`,
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
    expansionSetCode: setCode,
    cardNumber,
    imageFileName: '',
    imageNumber: 0,
    color: color(),
    frameColor: color(),
    manaValue: 2,
    rarity: cardTypes.includes('LAND') ? Rarity.LAND : Rarity.COMMON,
    isSplitCard: false,
    isDoubleFacedCard: false,
    manaCostLeftStr: [],
    manaCostRightStr: [],
    ...overrides,
  };
}

function makeSettings(overrides: Partial<DeckGeneratorSettings> = {}): DeckGeneratorSettings {
  return {
    ...DEFAULT_DECK_GENERATOR_SETTINGS,
    colors: ['green'],
    deckSize: 40,
    advanced: true,
    creaturePercentage: 10,
    nonCreaturePercentage: 10,
    landPercentage: 80,
    ...overrides,
  };
}

function makeService(
  cards: SearchCardView[],
  random = 0.42,
  now: number | undefined = new Date(2026, 5, 24, 13, 4, 5, 67).getTime(),
  options: {
    deckTypes?: string[];
    expansionSets?: ExpansionSetInfo[];
    seenCriteria?: CardSearchCriteria[];
  } = {},
): DeckGeneratorService {
  const currentNow = now ?? new Date(2026, 5, 24, 13, 4, 5, 67).getTime();
  return new DeckGeneratorService({
    random: () => random,
    now: () => currentNow,
    listDeckTypes: async () => options.deckTypes ?? ['Constructed - Standard'],
    listExpansionSets: async () => options.expansionSets ?? [],
    searchCards: async (criteria: CardSearchCriteria) => {
      options.seenCriteria?.push(criteria);
      let results = cards;

      if (criteria.nameContains) {
        const expected = criteria.nameContains.toLowerCase();
        results = results.filter(card => card.name.toLowerCase().includes(expected));
      }

      if (criteria.types?.length) {
        results = results.filter(card => criteria.types!.every(type => card.cardTypes.includes(type)));
      }

      if (criteria.notTypes?.length) {
        results = results.filter(card => criteria.notTypes!.every(type => !card.cardTypes.includes(type)));
      }

      if (criteria.setCodes?.length) {
        results = results.filter(card => criteria.setCodes!.includes(card.expansionSetCode));
      }

      return results.slice(0, criteria.count ?? 100);
    },
  });
}

function countCards(cards: Array<{ amount: number }>): number {
  return cards.reduce((sum, card) => sum + card.amount, 0);
}

function expansionSet(setCode: string, name = setCode): ExpansionSetInfo {
  return {
    setCode,
    name,
    releaseDate: 0,
    hasBasicLands: true,
  };
}

test('generates a commander singleton deck with commander in sideboard and basics filling the deck', async () => {
  const cards = [
    makeCard('Rhys the Redeemed', ['CREATURE'], { superTypes: ['LEGENDARY'], color: color({ green: true }), manaValue: 1 }),
    makeCard('Llanowar Elves', ['CREATURE'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Elvish Visionary', ['CREATURE'], { color: color({ green: true }), manaValue: 2 }),
    makeCard('Reclamation Sage', ['CREATURE'], { color: color({ green: true }), manaValue: 3 }),
    makeCard('Naturalize', ['INSTANT'], { color: color({ green: true }), manaValue: 2 }),
    makeCard('Giant Growth', ['INSTANT'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Explore', ['SORCERY'], { color: color({ green: true }), manaValue: 2 }),
    makeCard('Overrun', ['SORCERY'], { color: color({ green: true }), manaValue: 5 }),
    makeCard('Sol Ring', ['ARTIFACT'], { color: color(), manaValue: 1 }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards);
  const result = await service.generateDeck(makeSettings({
    commander: true,
    singleton: true,
    includeArtifacts: false,
    includeColorless: false,
  }));

  assert.equal(result.deck.sideboard.length, 1);
  assert.equal(result.deck.name, 'Generated-Deck-24-06-2026-01-04-05-067');
  assert.equal(result.deck.description, 'Generated from Constructed - Standard (40 cards, green)');
  assert.equal(result.deck.createdAt, new Date(2026, 5, 24, 13, 4, 5, 67).getTime());
  assert.equal(result.deck.updatedAt, result.deck.createdAt);
  assert.equal(result.deck.sideboard[0].cardName, 'Rhys the Redeemed');
  assert.equal(countCards(result.deck.cards), 39);
  assert.equal(result.deck.sideboard[0].cardName, 'Rhys the Redeemed');
  assert.equal(result.deck.cards.some(card => card.cardName === 'Sol Ring'), false);
  assert.equal(result.deck.cards.find(card => card.cardName === 'Forest')?.amount, 32);
  assert.deepEqual(result.warnings, []);
});

test('chooses commanders that cover every selected color like the Java generator', async () => {
  const cards = [
    makeCard('Rhys the Redeemed', ['CREATURE'], {
      superTypes: ['LEGENDARY'],
      color: color({ green: true }),
      manaValue: 1,
    }),
    makeCard('Radha, Coalition Warlord', ['CREATURE'], {
      superTypes: ['LEGENDARY'],
      color: color({ red: true, green: true }),
      manaCostLeftStr: ['{R}', '{G}'],
      manaValue: 2,
    }),
    makeCard('Kird Ape', ['CREATURE'], { color: color({ red: true, green: true }), manaValue: 1 }),
    makeCard('Lightning Bolt', ['INSTANT'], { color: color({ red: true }), manaValue: 1 }),
    makeCard('Giant Growth', ['INSTANT'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Mountain', ['LAND'], { superTypes: ['BASIC'], cardNumber: '269' }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['red', 'green'],
    commander: true,
    singleton: true,
    includeColorless: false,
    creaturePercentage: 10,
    nonCreaturePercentage: 10,
    landPercentage: 80,
  }));

  assert.equal(result.deck.sideboard[0]?.cardName, 'Radha, Coalition Warlord');
  assert.equal(result.deck.sideboard.some(card => card.cardName === 'Rhys the Redeemed'), false);
});

test('retries commander selection when the first commander cannot fit the selected curve', async () => {
  const cards = [
    makeCard('End-Raze Forerunners Commander', ['CREATURE'], {
      superTypes: ['LEGENDARY'],
      color: color({ green: true }),
      manaValue: 8,
    }),
    makeCard('Rishkar, Peema Renegade', ['CREATURE'], {
      superTypes: ['LEGENDARY'],
      color: color({ green: true }),
      manaValue: 3,
    }),
    makeCard('Llanowar Elves', ['CREATURE'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Elvish Visionary', ['CREATURE'], { color: color({ green: true }), manaValue: 2 }),
    makeCard('Naturalize', ['INSTANT'], { color: color({ green: true }), manaValue: 2 }),
    makeCard('Giant Growth', ['INSTANT'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards, 0.99);
  const result = await service.generateDeck(makeSettings({
    colors: ['green'],
    commander: true,
    singleton: true,
    includeColorless: false,
    creaturePercentage: 10,
    nonCreaturePercentage: 10,
    landPercentage: 80,
    cmcProfile: 'Low',
  }));

  assert.equal(result.deck.sideboard[0]?.cardName, 'Rishkar, Peema Renegade');
  assert.equal(result.deck.cards.some(card => card.cardName === 'End-Raze Forerunners Commander'), false);
});

test('builds generator search scopes from authoritative server deck types and expansion sets', async () => {
  const cards = [
    makeCard('Llanowar Elves', ['CREATURE'], {
      color: color({ green: true }),
      expansionSetCode: 'MOM',
      manaCostLeftStr: ['{G}'],
      manaValue: 1,
    }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], expansionSetCode: 'MOM', cardNumber: '271' }),
  ];
  const seenFormatCriteria: CardSearchCriteria[] = [];
  const formatService = makeService(cards, 0, undefined, {
    deckTypes: ['Constructed - Standard'],
    expansionSets: [expansionSet('MOM')],
    seenCriteria: seenFormatCriteria,
  });

  await formatService.generateDeck(makeSettings({ format: 'constructed - standard' }));
  assert.equal(seenFormatCriteria[0].format, 'Constructed - Standard');
  assert.equal(seenFormatCriteria[0].setCodes, undefined);

  const seenSetCriteria: CardSearchCriteria[] = [];
  const setService = makeService(cards, 0, undefined, {
    deckTypes: ['Constructed - Standard'],
    expansionSets: [expansionSet('MOM')],
    seenCriteria: seenSetCriteria,
  });

  await setService.generateDeck(makeSettings({ format: 'mom' }));
  assert.deepEqual(seenSetCriteria[0].setCodes, ['MOM']);
  assert.equal(seenSetCriteria[0].format, undefined);

  const seenUnknownCriteria: CardSearchCriteria[] = [];
  const unknownService = makeService(cards, 0, undefined, {
    deckTypes: ['Constructed - Standard'],
    expansionSets: [expansionSet('MOM')],
    seenCriteria: seenUnknownCriteria,
  });

  await unknownService.generateDeck(makeSettings({ format: 'ABC' }));
  assert.equal(seenUnknownCriteria[0].format, 'ABC');
  assert.equal(seenUnknownCriteria[0].setCodes, undefined);
});

test('uses non-basic lands only when enabled and respects singleton copy limits', async () => {
  const cards = [
    makeCard('Kird Ape', ['CREATURE'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Lightning Bolt', ['INSTANT'], { color: color({ red: true }), manaValue: 1 }),
    makeCard('Stomping Ground', ['LAND'], {
      color: color(),
      superTypes: [],
      cardNumber: '257',
      rules: ['{T}: Add {R}.', '{T}: Add {G}.'],
    }),
    makeCard('Sacred Foundry', ['LAND'], {
      color: color(),
      superTypes: [],
      cardNumber: '254',
      rules: ['{T}: Add {R}.', '{T}: Add {W}.'],
    }),
    makeCard('Mountain', ['LAND'], { superTypes: ['BASIC'], cardNumber: '269' }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['red', 'green'],
    singleton: true,
    includeNonBasicLands: true,
    includeColorless: true,
    creaturePercentage: 5,
    nonCreaturePercentage: 5,
    landPercentage: 90,
  }));

  assert.equal(result.deck.cards.find(card => card.cardName === 'Stomping Ground')?.amount, 1);
  assert.equal(result.deck.cards.some(card => card.cardName === 'Sacred Foundry'), false);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Mountain')?.amount ?? 0) > 0);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Forest')?.amount ?? 0) > 0);
});

test('balances basic lands from spell mana symbols after counting non-basic land production', async () => {
  const cards = [
    makeCard('Goblin Guide', ['CREATURE'], {
      color: color({ red: true }),
      manaCostLeftStr: ['{R}'],
      manaValue: 1,
    }),
    makeCard('Kird Ape', ['CREATURE'], {
      color: color({ red: true }),
      manaCostLeftStr: ['{R}'],
      manaValue: 1,
    }),
    makeCard('Lightning Bolt', ['INSTANT'], {
      color: color({ red: true }),
      manaCostLeftStr: ['{R}'],
      manaValue: 1,
    }),
    makeCard('Lava Spike', ['SORCERY'], {
      color: color({ red: true }),
      manaCostLeftStr: ['{R}'],
      manaValue: 1,
    }),
    makeCard('Giant Growth', ['INSTANT'], {
      color: color({ green: true }),
      manaCostLeftStr: ['{G}'],
      manaValue: 1,
    }),
    makeCard('Stomping Ground', ['LAND'], {
      color: color(),
      superTypes: [],
      cardNumber: '257',
      rules: ['{T}: Add {R}.', '{T}: Add {G}.'],
    }),
    makeCard('Mountain', ['LAND'], { superTypes: ['BASIC'], cardNumber: '269' }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['red', 'green'],
    includeNonBasicLands: true,
    includeColorless: true,
    creaturePercentage: 10,
    nonCreaturePercentage: 10,
    landPercentage: 80,
  }));
  const mountains = result.deck.cards.find(card => card.cardName === 'Mountain')?.amount ?? 0;
  const forests = result.deck.cards.find(card => card.cardName === 'Forest')?.amount ?? 0;

  assert.equal(result.deck.cards.find(card => card.cardName === 'Stomping Ground')?.amount, 4);
  assert.ok(mountains > forests, `expected more Mountains than Forests, got ${mountains}/${forests}`);
});

test('skips non-basic lands for monocolor generated decks like the Java generator', async () => {
  const cards = [
    makeCard('Llanowar Elves', ['CREATURE'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Giant Growth', ['INSTANT'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Temple Garden', ['LAND'], {
      color: color(),
      superTypes: [],
      cardNumber: '258',
      rules: ['{T}: Add {G}.', '{T}: Add {W}.'],
    }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['green'],
    includeNonBasicLands: true,
    includeColorless: true,
    creaturePercentage: 5,
    nonCreaturePercentage: 5,
    landPercentage: 90,
  }));

  assert.equal(result.deck.cards.some(card => card.cardName === 'Temple Garden'), false);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Forest')?.amount ?? 0) > 0);
});

test('rejects spells with off-color mana symbols in costs and rules text', async () => {
  const cards = [
    makeCard('Savannah Lions', ['CREATURE'], {
      color: color({ white: true }),
      manaCostLeftStr: ['{W}'],
      manaValue: 1,
    }),
    makeCard('Mesa Unicorn', ['CREATURE'], {
      color: color({ white: true }),
      manaCostLeftStr: ['{1}', '{W}'],
      manaValue: 2,
    }),
    makeCard('Serra Angel', ['CREATURE'], {
      color: color({ white: true }),
      manaCostLeftStr: ['{3}', '{W}', '{W}'],
      rules: ['Flying, vigilance'],
      manaValue: 5,
    }),
    makeCard('Azorius Hybrid', ['CREATURE'], {
      color: color({ white: true }),
      manaCostLeftStr: ['{W/U}'],
      manaValue: 1,
    }),
    makeCard('White Firebreather', ['CREATURE'], {
      color: color({ white: true }),
      manaCostLeftStr: ['{W}'],
      rules: ['{R}: White Firebreather gets +1/+0 until end of turn.'],
      manaValue: 1,
    }),
    makeCard('Disenchant', ['INSTANT'], {
      color: color({ white: true }),
      manaCostLeftStr: ['{1}', '{W}'],
      manaValue: 2,
    }),
    makeCard('Raise the Alarm', ['INSTANT'], {
      color: color({ white: true }),
      manaCostLeftStr: ['{1}', '{W}'],
      manaValue: 2,
    }),
    makeCard('Plains', ['LAND'], { superTypes: ['BASIC'], cardNumber: '250' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['white'],
    includeColorless: false,
    creaturePercentage: 20,
    nonCreaturePercentage: 20,
    landPercentage: 60,
  }));

  assert.equal(result.deck.cards.some(card => card.cardName === 'Azorius Hybrid'), false);
  assert.equal(result.deck.cards.some(card => card.cardName === 'White Firebreather'), false);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Savannah Lions')?.amount ?? 0) > 0);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Serra Angel')?.amount ?? 0) > 0);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Disenchant')?.amount ?? 0) > 0);
});

test('fills repeated non-singleton copies up to the normal copy limit', async () => {
  const cards = [
    makeCard('Llanowar Elves', ['CREATURE'], { color: color({ green: true }), manaValue: 1 }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['green'],
    creaturePercentage: 38,
    nonCreaturePercentage: 0,
    landPercentage: 62,
    cmcProfile: 'Low',
  }));

  assert.equal(result.deck.cards.find(card => card.cardName === 'Llanowar Elves')?.amount, 4);
  assert.equal(countCards(result.deck.cards), 28);
});

test('fills undersized curve buckets from one-copy reserve spells like the Java generator', async () => {
  const cards = [
    makeCard('Colossal Dreadmaw', ['CREATURE'], {
      color: color({ green: true }),
      manaCostLeftStr: ['{4}', '{G}', '{G}'],
      manaValue: 6,
    }),
    makeCard('Forest', ['LAND'], { superTypes: ['BASIC'], cardNumber: '271' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['green'],
    singleton: true,
    includeColorless: false,
    creaturePercentage: 10,
    nonCreaturePercentage: 0,
    landPercentage: 90,
    cmcProfile: 'Low',
  }));

  assert.equal(result.deck.cards.find(card => card.cardName === 'Colossal Dreadmaw')?.amount, 1);
  assert.equal(countCards(result.deck.cards), 37);
  assert.deepEqual(result.warnings, [
    'No cards matched one of the generator pools.',
    'Generated 37/40 main-deck cards because the available pool was too small.',
  ]);
});

test('returns a thin generated deck instead of hanging when live server searches time out', async () => {
  const service = new DeckGeneratorService({
    random: () => 0,
    now: () => new Date(2026, 5, 24, 13, 4, 5, 67).getTime(),
    listDeckTypes: async () => new Promise(() => undefined),
    listExpansionSets: async () => new Promise(() => undefined),
    searchCards: async () => new Promise(() => undefined),
    searchTimeoutMs: 1,
  });

  const result = await service.generateDeck(makeSettings({
    colors: ['green'],
    creaturePercentage: 10,
    nonCreaturePercentage: 10,
    landPercentage: 80,
  }));

  assert.equal(result.deck.name, 'Generated-Deck-24-06-2026-01-04-05-067');
  assert.equal(countCards(result.deck.cards), 32);
  assert.equal(result.deck.cards.find(card => card.cardName === 'Forest')?.amount, 32);
  assert.ok(result.warnings.includes('Creature pool search timed out; generated deck may be incomplete.'));
  assert.ok(result.warnings.includes('Non-creature pool search timed out; generated deck may be incomplete.'));
  assert.ok(result.warnings.includes('Forest basic land search timed out; generated deck may be incomplete.'));
  assert.ok(result.warnings.includes('Generated 32/40 main-deck cards because the available pool was too small.'));
});

test('adds one random missing color when random color is enabled', async () => {
  const cards = [
    makeCard('Elite Vanguard', ['CREATURE'], { color: color({ white: true }), manaValue: 1 }),
    makeCard('Lightning Bolt', ['INSTANT'], { color: color({ red: true }), manaValue: 1 }),
    makeCard('Plains', ['LAND'], { superTypes: ['BASIC'], cardNumber: '250' }),
    makeCard('Mountain', ['LAND'], { superTypes: ['BASIC'], cardNumber: '269' }),
  ];
  const service = makeService(cards, 0);
  const result = await service.generateDeck(makeSettings({
    colors: ['red'],
    randomColor: true,
    includeColorless: true,
    creaturePercentage: 5,
    nonCreaturePercentage: 5,
    landPercentage: 90,
  }));

  assert.deepEqual(result.selectedColors, ['red', 'white']);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Plains')?.amount ?? 0) > 0);
  assert.ok((result.deck.cards.find(card => card.cardName === 'Mountain')?.amount ?? 0) > 0);
});
