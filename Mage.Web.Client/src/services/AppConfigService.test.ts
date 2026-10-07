import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AppConfigService,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_CREATE_TABLE_PRESET,
  DEFAULT_CREATE_TABLE_PRESETS,
  DEFAULT_CREATE_TOURNAMENT_PRESET,
  DEFAULT_CREATE_TOURNAMENT_PRESETS,
  DEFAULT_DECK_EDITOR_CONFIG,
  DEFAULT_DECK_FILE_HISTORY,
  DEFAULT_DECK_GENERATOR_SETTINGS,
  DEFAULT_DECK_SEARCH_SETTINGS,
  DEFAULT_KEYBINDS,
  DEFAULT_LOBBY_CONFIG,
  DEFAULT_LOBBY_FILTERS,
  DEFAULT_PANEL_LAYOUT_CONFIG,
  MAX_IGNORED_USERS,
  clientSettingsToUserData,
  normalizeClientSettings,
  normalizeCreateTablePreset,
  normalizeCreateTournamentPreset,
  normalizeDeckEditorConfig,
  normalizeDeckFileHistory,
  normalizeDeckGeneratorSettings,
  normalizeDeckSearchSettings,
  normalizeLobbyConfig,
  normalizePanelLayoutConfig,
} from './AppConfigService.js';
import type { StorageAdapter } from './AppConfigService.js';

test('maps client settings to the Java connectSetUserData payload defaults', () => {
  assert.deepEqual(clientSettingsToUserData(DEFAULT_CLIENT_SETTINGS), {
    groupId: 0,
    avatarId: 51,
    allowRequestShowHandCards: true,
    confirmEmptyManaPool: true,
    userSkipPrioritySteps: {
      yourTurn: {
        upkeep: false,
        draw: false,
        main1: true,
        beforeCombat: false,
        endOfCombat: false,
        main2: true,
        endOfTurn: false,
      },
      opponentTurn: {
        upkeep: false,
        draw: false,
        main1: false,
        beforeCombat: false,
        endOfCombat: false,
        main2: false,
        endOfTurn: false,
      },
      stopOnDeclareAttackers: true,
      stopOnDeclareBlockersWithZeroPermanents: false,
      stopOnDeclareBlockersWithAnyPermanents: true,
      stopOnAllMainPhases: true,
      stopOnAllEndPhases: true,
      stopOnStackNewObjects: true,
    },
    flagName: 'world',
    askMoveToGraveOrder: false,
    manaPoolAutomatic: true,
    manaPoolAutomaticRestricted: true,
    passPriorityCast: true,
    passPriorityActivation: true,
    autoOrderTrigger: true,
    autoTargetLevel: 1,
    useSameSettingsForReplacementEffects: true,
    useFirstManaAbility: false,
  });
});

test('normalizes persisted profile settings before building user data', () => {
  const settings = normalizeClientSettings({
    avatarId: 100000,
    flagName: 'MX.png',
    autoTargetLevel: 99,
    imageCacheMaxAgeDays: -5,
    battlefieldGrouping: 'invalid-grouping' as any,
    battlefieldCardSize: 400,
    matchSeatOrientation: 'sideways' as any,
    alwaysShowPlayerNames: false,
    displayLifeOnAvatar: false,
    cardImageFallbackMode: 'text-card' as any,
    chatProfanityFilterLevel: 2,
    skipPrioritySteps: {
      yourTurn: {
        draw: true,
      },
      stopOnAllEndPhases: false,
    } as any,
    tooltipDelayMs: -100,
    handCardSize: 999,
    dialogFontSize: 3,
    chatFontSize: 40,
    masterVolume: 200,
    effectsVolume: -1,
    cardRenderingMode: 'text-only',
    clientTheme: 'java-light',
    battlefieldBackgroundMode: 'custom',
    customBattlefieldBackground: '  https://example.test/battlefield.jpg  ',
    keybinds: {
      confirm: {
        key: 'Enter',
        eventType: 'keyup',
        ctrlOrMeta: true,
        altKey: false,
        shiftKey: true,
        enabled: true,
      },
      toggleMacro: {
        key: '',
        eventType: 'keyup',
        ctrlOrMeta: true,
        altKey: true,
        shiftKey: true,
        enabled: false,
      },
    } as any,
    restoreSessionOnReconnect: false,
  });
  const userData = clientSettingsToUserData(settings);

  assert.equal(settings.avatarId, 9999);
  assert.equal(settings.flagName, 'mx');
  assert.equal(settings.autoTargetLevel, 2);
  assert.equal(settings.imageCacheMaxAgeDays, 1);
  assert.equal(settings.battlefieldGrouping, DEFAULT_CLIENT_SETTINGS.battlefieldGrouping);
  assert.equal(settings.battlefieldCardSize, 99);
  assert.equal(normalizeClientSettings({ battlefieldCardSize: 2 }).battlefieldCardSize, 7);
  assert.equal(settings.matchSeatOrientation, DEFAULT_CLIENT_SETTINGS.matchSeatOrientation);
  assert.equal(settings.alwaysShowPlayerNames, false);
  assert.equal(settings.displayLifeOnAvatar, false);
  assert.equal(settings.cardImageFallbackMode, 'text-card');
  assert.equal(settings.chatProfanityFilterLevel, 2);
  assert.equal(settings.skipPrioritySteps.yourTurn.draw, true);
  assert.equal(settings.skipPrioritySteps.yourTurn.main1, true);
  assert.equal(settings.skipPrioritySteps.opponentTurn.draw, false);
  assert.equal(settings.skipPrioritySteps.stopOnAllEndPhases, false);
  assert.equal(settings.tooltipDelayMs, 0);
  assert.equal(settings.handCardSize, 160);
  assert.equal(settings.dialogFontSize, 10);
  assert.equal(settings.chatFontSize, 28);
  assert.equal(settings.masterVolume, 100);
  assert.equal(settings.effectsVolume, 0);
  assert.equal(settings.cardRenderingMode, 'text-only');
  assert.equal(settings.clientTheme, 'java-light');
  assert.equal(settings.battlefieldBackgroundMode, 'custom');
  assert.equal(settings.customBattlefieldBackground, 'https://example.test/battlefield.jpg');
  assert.deepEqual(settings.keybinds.confirm, {
    key: 'Enter',
    eventType: 'keyup',
    ctrlOrMeta: true,
    altKey: false,
    shiftKey: true,
    enabled: true,
  });
  assert.deepEqual(settings.keybinds.toggleMacro, {
    ...DEFAULT_KEYBINDS.toggleMacro,
    eventType: 'keyup',
    ctrlOrMeta: true,
    altKey: true,
    shiftKey: true,
    enabled: false,
  });
  assert.equal(settings.restoreSessionOnReconnect, false);
  assert.equal(
    normalizeClientSettings({ chatProfanityFilterLevel: 9 as any }).chatProfanityFilterLevel,
    DEFAULT_CLIENT_SETTINGS.chatProfanityFilterLevel
  );
  assert.equal(
    normalizeClientSettings({ cardImageFallbackMode: 'binder-page' as any }).cardImageFallbackMode,
    DEFAULT_CLIENT_SETTINGS.cardImageFallbackMode
  );
  assert.equal(userData.avatarId, 9999);
  assert.equal(userData.flagName, 'mx');
  assert.equal(userData.autoTargetLevel, 2);
  assert.equal(userData.userSkipPrioritySteps.yourTurn.draw, true);
  assert.equal(userData.userSkipPrioritySteps.stopOnAllEndPhases, false);
});

test('loads and resets cloned default client settings', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  const loaded = service.loadSettings();
  const reset = service.resetSettings();

  assert.deepEqual(loaded, DEFAULT_CLIENT_SETTINGS);
  assert.deepEqual(reset, DEFAULT_CLIENT_SETTINGS);
  assert.notEqual(loaded, DEFAULT_CLIENT_SETTINGS);
  assert.notEqual(loaded.keybinds, DEFAULT_CLIENT_SETTINGS.keybinds);
  assert.notEqual(loaded.skipPrioritySteps, DEFAULT_CLIENT_SETTINGS.skipPrioritySteps);
});

test('normalizes lobby config with durable filters, selected table, sort, and column layout', () => {
  const config = normalizeLobbyConfig({
    filters: {
      showWaiting: false,
      showFinished: true,
      gameType: ' Commander Free For All ',
      deckType: '',
      searchText: 'a'.repeat(200),
    },
    selectedTableId: 'table-1',
    tableLayout: {
      columnOrder: ['name', 'deckType', 'name', 'unknown' as any],
      columnWidths: {
        name: 9999,
        deckType: 20,
      } as any,
      sort: {
        key: 'name',
        direction: 'asc',
      },
    },
  });

  assert.equal(config.filters.showWaiting, false);
  assert.equal(config.filters.showFinished, true);
  assert.equal(config.filters.showStarting, DEFAULT_LOBBY_FILTERS.showStarting);
  assert.equal(config.filters.gameType, 'Commander Free For All');
  assert.equal(config.filters.deckType, null);
  assert.equal(config.filters.searchText.length, 160);
  assert.equal(config.selectedTableId, 'table-1');
  assert.deepEqual(config.tableLayout.columnOrder.slice(0, 2), ['name', 'deckType']);
  assert.equal(config.tableLayout.columnWidths.name, 360);
  assert.equal(config.tableLayout.columnWidths.deckType, 52);
  assert.deepEqual(config.tableLayout.sort, { key: 'name', direction: 'asc' });
});

test('persists lobby config through the app config service storage adapter', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  service.saveLobbyConfig({
    filters: {
      ...DEFAULT_LOBBY_FILTERS,
      showFinished: true,
      deckType: 'Constructed - Pauper',
    },
    selectedTableId: 'persisted-table',
    tableLayout: {
      ...DEFAULT_LOBBY_CONFIG.tableLayout,
      columnOrder: ['name', 'action', ...DEFAULT_LOBBY_CONFIG.tableLayout.columnOrder],
      columnWidths: {
        ...DEFAULT_LOBBY_CONFIG.tableLayout.columnWidths,
        name: 240,
      },
      sort: { key: 'deckType', direction: 'desc' },
    },
  });

  const loaded = service.loadLobbyConfig();
  assert.equal(loaded.filters.showFinished, true);
  assert.equal(loaded.filters.deckType, 'Constructed - Pauper');
  assert.equal(loaded.selectedTableId, 'persisted-table');
  assert.deepEqual(loaded.tableLayout.columnOrder.slice(0, 2), ['name', 'action']);
  assert.equal(loaded.tableLayout.columnWidths.name, 240);
  assert.deepEqual(loaded.tableLayout.sort, { key: 'deckType', direction: 'desc' });

  assert.deepEqual(service.resetLobbyConfig(), DEFAULT_LOBBY_CONFIG);
  assert.deepEqual(service.loadLobbyConfig(), DEFAULT_LOBBY_CONFIG);
});

test('normalizes create table presets with Java dialog bounds and enum values', () => {
  const preset = normalizeCreateTablePreset({
    name: '  Commander Night  ',
    gameType: 'Commander Free For All',
    deckType: 'Variant Magic - Commander',
    winsNeeded: 99,
    freeMulligans: -3,
    timeLimit: 'MIN__60',
    bufferTime: 'INVALID',
    mulliganType: 'SMOOTHED_LONDON',
    password: '  secret  ',
    skillLevel: 'SERIOUS',
    spectatorsAllowed: false,
    rollbackTurnsAllowed: false,
    planeChase: true,
    emblemCardsEnabled: true,
    perPlayerEmblemDeck: {
      name: '  Everyone Starts With This  ',
      cards: [
        { amount: 2, cardName: 'Howling Mine', setCode: '10E', cardNumber: '324' },
      ],
      sideboard: [
        { amount: 1, cardName: 'Black Lotus', setCode: 'VMA', cardNumber: '4' },
      ],
    },
    startingPlayerEmblemDeck: {
      name: '  Opener Bonus  ',
      cards: [
        { amount: 1, cardName: 'Exploration', setCode: 'USG', cardNumber: '250' },
      ],
      sideboard: [],
    },
    customStartLifeEnabled: true,
    customStartLife: 250,
    customStartHandSizeEnabled: true,
    customStartHandSize: -1,
    rated: true,
    quitRatio: 101,
    minimumRating: 4000,
    edhPowerLevel: -20,
    range: 'TWO',
    attackOption: 'RIGHT',
    numberOfPlayers: 99,
    playerTypes: ['Human', 'Computer - mad', ''],
    aiSeats: [
      {
        name: '  Sparky  ',
        skill: 42,
        deck: {
          name: '  Bolt Deck  ',
          format: 'Constructed - Pauper',
          cards: [
            { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
            { amount: -1, cardName: '', setCode: 'M11', cardNumber: '244' },
          ],
          sideboard: [
            { amount: 9999, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
          ],
        },
      },
    ],
    savedAt: 123,
  });

  assert.equal(preset.name, 'Commander Night');
  assert.equal(preset.winsNeeded, 5);
  assert.equal(preset.freeMulligans, 0);
  assert.equal(preset.timeLimit, 'MIN__60');
  assert.equal(preset.bufferTime, DEFAULT_CREATE_TABLE_PRESET.bufferTime);
  assert.equal(preset.mulliganType, 'SMOOTHED_LONDON');
  assert.equal(preset.password, 'secret');
  assert.equal(preset.skillLevel, 'SERIOUS');
  assert.equal(preset.spectatorsAllowed, false);
  assert.equal(preset.rollbackTurnsAllowed, false);
  assert.equal(preset.planeChase, true);
  assert.equal(preset.emblemCardsEnabled, true);
  assert.equal(preset.perPlayerEmblemDeck?.name, 'Everyone Starts With This');
  assert.equal(preset.perPlayerEmblemDeck?.cards[0].cardName, 'Howling Mine');
  assert.equal(preset.perPlayerEmblemDeck?.sideboard[0].cardName, 'Black Lotus');
  assert.equal(preset.startingPlayerEmblemDeck?.name, 'Opener Bonus');
  assert.equal(preset.customStartLife, 100);
  assert.equal(preset.customStartHandSize, 0);
  assert.equal(preset.rated, true);
  assert.equal(preset.quitRatio, 100);
  assert.equal(preset.minimumRating, 3000);
  assert.equal(preset.edhPowerLevel, 0);
  assert.equal(preset.range, 'TWO');
  assert.equal(preset.attackOption, 'RIGHT');
  assert.equal(preset.numberOfPlayers, 10);
  assert.deepEqual(preset.playerTypes, ['Human', 'Computer - mad']);
  assert.equal(preset.aiSeats[0].name, 'Sparky');
  assert.equal(preset.aiSeats[0].skill, 10);
  assert.equal(preset.aiSeats[0].deck?.name, 'Bolt Deck');
  assert.equal(preset.aiSeats[0].deck?.cards.length, 1);
  assert.equal(preset.aiSeats[0].deck?.sideboard[0].amount, 999);
  assert.equal(preset.savedAt, 123);
});

test('persists create table presets in last used and named config slots', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  const config1 = service.saveCreateTablePreset('config1', {
    ...DEFAULT_CREATE_TABLE_PRESET,
    name: 'Config One',
    deckType: 'Constructed - Pauper',
    emblemCardsEnabled: true,
    perPlayerEmblemDeck: {
      name: 'Table Emblems',
      cards: [{ amount: 1, cardName: 'Fervor', setCode: 'M13', cardNumber: '133' }],
      sideboard: [],
    },
    playerTypes: ['Human', 'Computer - mad'],
    aiSeats: [
      {
        name: 'Config AI',
        skill: 4,
        deck: {
          name: 'Config AI Deck',
          cards: [{ amount: 60, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' }],
          sideboard: [],
        },
      },
    ],
    savedAt: 1,
  });

  assert.equal(config1.config1?.name, 'Config One');
  assert.equal(config1.config1?.deckType, 'Constructed - Pauper');
  assert.equal(config1.config1?.emblemCardsEnabled, true);
  assert.equal(config1.config1?.perPlayerEmblemDeck?.cards[0].cardName, 'Fervor');
  assert.deepEqual(config1.config1?.playerTypes, ['Human', 'Computer - mad']);
  assert.equal(config1.config1?.aiSeats[0].name, 'Config AI');
  assert.equal(config1.config1?.aiSeats[0].deck?.cards[0].cardName, 'Mountain');
  assert.equal(config1.lastUsed, null);

  service.saveCreateTablePreset('lastUsed', {
    ...DEFAULT_CREATE_TABLE_PRESET,
    name: 'Last Used',
    winsNeeded: 3,
  });

  const loaded = service.loadCreateTablePresets();
  assert.equal(loaded.config1?.name, 'Config One');
  assert.equal(loaded.lastUsed?.name, 'Last Used');
  assert.equal(loaded.lastUsed?.winsNeeded, 3);
  assert.equal(loaded.config2, null);

  const reset = service.resetCreateTablePresets();
  assert.deepEqual(reset, DEFAULT_CREATE_TABLE_PRESETS);
  assert.deepEqual(service.loadCreateTablePresets(), DEFAULT_CREATE_TABLE_PRESETS);
});

test('normalizes create tournament presets with limited setup and player data', () => {
  const preset = normalizeCreateTournamentPreset({
    name: '  Friday Limited  ',
    tournamentType: 'Booster Draft Swiss',
    gameType: 'Two Player Duel',
    deckType: 'Limited',
    winsNeeded: 99,
    numberRounds: -5,
    numberOfPlayers: 99,
    singleMultiplayerGame: true,
    timeLimit: 'MIN__60',
    bufferTime: 'SEC__10',
    constructionTimeMinutes: 999,
    draftTiming: 'PROFESSIONAL',
    draftCubeName: '  Modern Cube  ',
    setCodes: [' m11 ', 'zen', 'not valid!' ],
    randomSetCodes: ['m11', 'zen', 'm11'],
    cubeFromDeck: {
      name: '  Cube  ',
      cards: [{ amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' }],
      sideboard: [],
    },
    jumpstartPacks: '  # Pack\n1 JMP 236 Ghoulcaller Gisa  ',
    password: '  secret  ',
    skillLevel: 'SERIOUS',
    spectatorsAllowed: false,
    rollbackTurnsAllowed: false,
    rated: true,
    quitRatio: 101,
    minimumRating: 4000,
    playerTypes: ['Human', 'Computer - mad', ''],
    playerSkills: [0, 4.4, 99],
    savedAt: 123,
  });

  assert.equal(preset.name, 'Friday Limited');
  assert.equal(preset.winsNeeded, 5);
  assert.equal(preset.numberRounds, 1);
  assert.equal(preset.numberOfPlayers, 64);
  assert.equal(preset.singleMultiplayerGame, true);
  assert.equal(preset.timeLimit, 'MIN__60');
  assert.equal(preset.bufferTime, 'SEC__10');
  assert.equal(preset.constructionTimeMinutes, 120);
  assert.equal(preset.draftTiming, 'PROFESSIONAL');
  assert.equal(preset.draftCubeName, 'Modern Cube');
  assert.deepEqual(preset.setCodes, ['M11', 'ZEN']);
  assert.deepEqual(preset.randomSetCodes, ['M11', 'ZEN']);
  assert.equal(preset.cubeFromDeck?.name, 'Cube');
  assert.equal(preset.jumpstartPacks, '# Pack\n1 JMP 236 Ghoulcaller Gisa');
  assert.equal(preset.password, 'secret');
  assert.equal(preset.skillLevel, 'SERIOUS');
  assert.equal(preset.spectatorsAllowed, false);
  assert.equal(preset.rollbackTurnsAllowed, false);
  assert.equal(preset.rated, true);
  assert.equal(preset.quitRatio, 100);
  assert.equal(preset.minimumRating, 3000);
  assert.deepEqual(preset.playerTypes, ['Human', 'Computer - mad']);
  assert.deepEqual(preset.playerSkills, [1, 4, 10]);
  assert.equal(preset.savedAt, 123);

  const fallback = normalizeCreateTournamentPreset({
    timeLimit: 'BOGUS',
    draftTiming: 'BOGUS',
    playerTypes: [],
    playerSkills: [],
  } as any);
  assert.equal(fallback.timeLimit, DEFAULT_CREATE_TOURNAMENT_PRESET.timeLimit);
  assert.equal(fallback.draftTiming, DEFAULT_CREATE_TOURNAMENT_PRESET.draftTiming);
  assert.deepEqual(fallback.playerTypes, DEFAULT_CREATE_TOURNAMENT_PRESET.playerTypes);
  assert.deepEqual(fallback.playerSkills, DEFAULT_CREATE_TOURNAMENT_PRESET.playerSkills);
});

test('persists create tournament presets in last used and named config slots', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  const config1 = service.saveCreateTournamentPreset('config1', {
    ...DEFAULT_CREATE_TOURNAMENT_PRESET,
    name: 'Draft Config',
    tournamentType: 'Booster Draft Swiss',
    draftCubeName: 'Cube From Deck',
    cubeFromDeck: {
      name: 'Local Cube',
      cards: [{ amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' }],
      sideboard: [],
    },
    playerTypes: ['Human', 'Computer - mad'],
    playerSkills: [2, 6],
    savedAt: 1,
  });

  assert.equal(config1.config1?.name, 'Draft Config');
  assert.equal(config1.config1?.draftCubeName, 'Cube From Deck');
  assert.equal(config1.config1?.cubeFromDeck?.cards[0].cardName, 'Lightning Bolt');
  assert.deepEqual(config1.config1?.playerSkills, [2, 6]);
  assert.equal(config1.lastUsed, null);

  service.saveCreateTournamentPreset('lastUsed', {
    ...DEFAULT_CREATE_TOURNAMENT_PRESET,
    name: 'Last Tournament',
    numberRounds: 4,
  });

  const loaded = service.loadCreateTournamentPresets();
  assert.equal(loaded.config1?.name, 'Draft Config');
  assert.equal(loaded.lastUsed?.name, 'Last Tournament');
  assert.equal(loaded.lastUsed?.numberRounds, 4);
  assert.equal(loaded.config2, null);

  const reset = service.resetCreateTournamentPresets();
  assert.deepEqual(reset, DEFAULT_CREATE_TOURNAMENT_PRESETS);
  assert.deepEqual(service.loadCreateTournamentPresets(), DEFAULT_CREATE_TOURNAMENT_PRESETS);
});

test('normalizes deck editor layout and sort settings by editor mode', () => {
  const config = normalizeDeckEditorConfig({
    activeMode: 'draft',
    modes: {
      normal: {
        collectionView: 'list',
        collectionSortBy: 'cardType',
        collectionSortDirection: 'desc',
        deckSortBy: 'amount',
        deckSortDirection: 'desc',
        deckPanelWidth: 9999,
        showSideboard: false,
        search: {
          searchText: 'bolt',
          nameContains: 'bolt',
          rulesContains: 'damage',
          searchNames: true,
          searchTypes: false,
          searchRules: true,
          colors: { red: true, colorless: true },
          excludedColors: { blue: true },
          colorMatch: 'exact',
          types: ['INSTANT', 'NOPE' as any],
          excludedTypes: ['CREATURE'],
          rarities: ['COMMON'],
          excludedRarities: ['MYTHIC'],
          setCodes: [' m11 ', 'bad-code-too-long'],
          format: 'Constructed - Pauper',
          useDeckFormat: false,
          pennyDreadful: true,
          manaValue: 99,
          manaValueOperator: 'gte',
          uniqueNames: true,
          piles: true,
        },
      },
      draft: {
        collectionView: 'bad-view' as any,
        collectionSortBy: 'cardNumber',
        collectionSortDirection: 'sideways' as any,
        deckSortBy: 'set',
        deckPanelWidth: 100,
      },
    },
  });

  assert.equal(config.activeMode, 'draft');
  assert.equal(config.modes.normal.collectionView, 'list');
  assert.equal(config.modes.normal.collectionSortBy, 'cardType');
  assert.equal(config.modes.normal.collectionSortDirection, 'desc');
  assert.equal(config.modes.normal.deckSortBy, 'amount');
  assert.equal(config.modes.normal.deckSortDirection, 'desc');
  assert.equal(config.modes.normal.deckPanelWidth, 520);
  assert.equal(config.modes.normal.showSideboard, false);
  assert.equal(config.modes.normal.search.searchText, 'bolt');
  assert.equal(config.modes.normal.search.nameContains, 'bolt');
  assert.equal(config.modes.normal.search.rulesContains, 'damage');
  assert.equal(config.modes.normal.search.searchNames, true);
  assert.equal(config.modes.normal.search.searchTypes, false);
  assert.equal(config.modes.normal.search.searchRules, true);
  assert.equal(config.modes.normal.search.colors.red, true);
  assert.equal(config.modes.normal.search.colors.colorless, true);
  assert.equal(config.modes.normal.search.excludedColors.blue, true);
  assert.equal(config.modes.normal.search.colorMatch, 'exact');
  assert.deepEqual(config.modes.normal.search.types, ['INSTANT']);
  assert.deepEqual(config.modes.normal.search.excludedTypes, ['CREATURE']);
  assert.deepEqual(config.modes.normal.search.rarities, ['COMMON']);
  assert.deepEqual(config.modes.normal.search.excludedRarities, ['MYTHIC']);
  assert.deepEqual(config.modes.normal.search.setCodes, ['M11']);
  assert.equal(config.modes.normal.search.format, 'Constructed - Pauper');
  assert.equal(config.modes.normal.search.useDeckFormat, false);
  assert.equal(config.modes.normal.search.pennyDreadful, true);
  assert.equal(config.modes.normal.search.manaValue, 20);
  assert.equal(config.modes.normal.search.manaValueOperator, 'gte');
  assert.equal(config.modes.normal.search.uniqueNames, true);
  assert.equal(config.modes.normal.search.piles, true);
  assert.equal(config.modes.draft.collectionView, DEFAULT_DECK_EDITOR_CONFIG.modes.draft.collectionView);
  assert.equal(config.modes.draft.collectionSortBy, 'cardNumber');
  assert.equal(config.modes.draft.collectionSortDirection, DEFAULT_DECK_EDITOR_CONFIG.modes.draft.collectionSortDirection);
  assert.equal(config.modes.draft.deckSortBy, 'set');
  assert.equal(config.modes.draft.deckPanelWidth, 280);
  assert.deepEqual(config.modes.limited, DEFAULT_DECK_EDITOR_CONFIG.modes.limited);
});

test('normalizes deck search settings independently for persisted editor modes', () => {
  const settings = normalizeDeckSearchSettings({
    searchText: 'x'.repeat(200),
    nameContains: 'legacy',
    rulesContains: 'draw a card',
    searchNames: false,
    searchTypes: true,
    searchRules: false,
    colors: {
      white: true,
      blue: 'yes' as any,
    },
    excludedColors: {
      black: true,
      colorless: true,
    },
    colorMatch: 'include',
    types: ['CREATURE', 'CREATURE', 'LAND'],
    excludedTypes: ['BAD' as any, 'ARTIFACT'],
    rarities: ['COMMON', 'NOPE' as any],
    excludedRarities: ['RARE'],
    setCodes: ['mom', 'MOM', 'mat'],
    format: 'f'.repeat(200),
    useDeckFormat: false,
    pennyDreadful: true,
    manaValue: -5,
    manaValueOperator: 'lte',
    uniqueNames: true,
    piles: true,
  });

  assert.equal(settings.searchText.length, 120);
  assert.equal(settings.nameContains.length, 120);
  assert.equal(settings.rulesContains, 'draw a card');
  assert.equal(settings.searchNames, false);
  assert.equal(settings.searchTypes, true);
  assert.equal(settings.searchRules, false);
  assert.equal(settings.colors.white, true);
  assert.equal(settings.colors.blue, false);
  assert.equal(settings.excludedColors.black, true);
  assert.equal(settings.excludedColors.colorless, true);
  assert.equal(settings.colorMatch, 'include');
  assert.deepEqual(settings.types, ['CREATURE', 'LAND']);
  assert.deepEqual(settings.excludedTypes, ['ARTIFACT']);
  assert.deepEqual(settings.rarities, ['COMMON']);
  assert.deepEqual(settings.excludedRarities, ['RARE']);
  assert.deepEqual(settings.setCodes, ['MOM', 'MAT']);
  assert.equal(settings.format.length, 120);
  assert.equal(settings.useDeckFormat, false);
  assert.equal(settings.pennyDreadful, true);
  assert.equal(settings.manaValue, 0);
  assert.equal(settings.manaValueOperator, 'lte');
  assert.equal(settings.uniqueNames, true);
  assert.equal(settings.piles, true);
  assert.deepEqual(normalizeDeckSearchSettings(undefined), DEFAULT_DECK_SEARCH_SETTINGS);
});

test('persists deck editor config through the app config service storage adapter', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  const saved = service.saveDeckEditorConfig({
    activeMode: 'sideboard',
    modes: {
      sideboard: {
        ...DEFAULT_DECK_EDITOR_CONFIG.modes.sideboard,
        collectionView: 'list',
        collectionSortBy: 'rarity',
        collectionSortDirection: 'desc',
        deckSortBy: 'name',
        deckPanelWidth: 420,
        showSideboard: false,
      },
    },
  });

  assert.equal(saved.activeMode, 'sideboard');
  assert.equal(saved.modes.sideboard.collectionView, 'list');
  assert.equal(saved.modes.sideboard.collectionSortBy, 'rarity');
  assert.equal(saved.modes.sideboard.deckPanelWidth, 420);
  assert.equal(saved.modes.sideboard.showSideboard, false);

  const loaded = service.loadDeckEditorConfig();
  assert.deepEqual(loaded, saved);
  assert.deepEqual(service.resetDeckEditorConfig(), DEFAULT_DECK_EDITOR_CONFIG);
  assert.deepEqual(service.loadDeckEditorConfig(), DEFAULT_DECK_EDITOR_CONFIG);
});

test('normalizes panel layout config for game and activity panels', () => {
  const config = normalizePanelLayoutConfig({
    game: {
      sidebarOpen: true,
    },
    activities: {
      tournament: {
        commandPanelCollapsed: true,
        chatCollapsed: true,
      },
      draft: {
        commandPanelCollapsed: 'yes' as any,
        chatCollapsed: false,
      },
      replay: {
        commandPanelCollapsed: false,
      },
    },
  });

  assert.equal(config.game.sidebarOpen, true);
  assert.deepEqual(config.activities.tournament, {
    commandPanelCollapsed: true,
    chatCollapsed: true,
  });
  assert.deepEqual(config.activities.draft, {
    commandPanelCollapsed: DEFAULT_PANEL_LAYOUT_CONFIG.activities.draft.commandPanelCollapsed,
    chatCollapsed: false,
  });
  assert.deepEqual(config.activities.sideboard, DEFAULT_PANEL_LAYOUT_CONFIG.activities.sideboard);
  assert.notEqual(config.activities.tournament, DEFAULT_PANEL_LAYOUT_CONFIG.activities.tournament);
});

test('persists panel layout config through the app config service storage adapter', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  const saved = service.savePanelLayoutConfig({
    game: {
      sidebarOpen: true,
    },
    activities: {
      tournament: {
        commandPanelCollapsed: true,
      },
      construction: {
        chatCollapsed: true,
      },
    },
  });

  assert.equal(saved.game.sidebarOpen, true);
  assert.equal(saved.activities.tournament.commandPanelCollapsed, true);
  assert.equal(saved.activities.tournament.chatCollapsed, false);
  assert.equal(saved.activities.construction.commandPanelCollapsed, false);
  assert.equal(saved.activities.construction.chatCollapsed, true);
  assert.deepEqual(service.loadPanelLayoutConfig(), saved);
  assert.deepEqual(service.resetPanelLayoutConfig(), DEFAULT_PANEL_LAYOUT_CONFIG);
  assert.deepEqual(service.loadPanelLayoutConfig(), DEFAULT_PANEL_LAYOUT_CONFIG);
});

test('normalizes deck file history for browser-equivalent import and export context', () => {
  const config = normalizeDeckFileHistory({
    lastImport: {
      fileName: ` ${'imported'.repeat(40)}.dck `,
      deckName: '  Imported Deck  ',
      updatedAt: -5,
    },
    lastExport: {
      fileName: 'exported.dck',
      deckName: 'Exported Deck',
      updatedAt: Number.MAX_SAFE_INTEGER + 1000,
    },
  });

  assert.equal(config.lastImport?.fileName.length, 180);
  assert.equal(config.lastImport?.deckName, 'Imported Deck');
  assert.equal(config.lastImport?.updatedAt, 0);
  assert.equal(config.lastExport?.fileName, 'exported.dck');
  assert.equal(config.lastExport?.deckName, 'Exported Deck');
  assert.equal(config.lastExport?.updatedAt, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(normalizeDeckFileHistory({ lastImport: {} }), DEFAULT_DECK_FILE_HISTORY);
});

test('persists deck file history through the app config service storage adapter', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  service.rememberDeckImportFile('first-import.dck', 'First Import');
  service.rememberDeckExportFile('first-export.dck', 'First Export');

  const history = service.loadDeckFileHistory();
  assert.ok((history.lastImport?.updatedAt ?? 0) > 0);
  assert.ok((history.lastExport?.updatedAt ?? 0) > 0);
  assert.deepEqual(history, {
    lastImport: {
      fileName: 'first-import.dck',
      deckName: 'First Import',
      updatedAt: history.lastImport?.updatedAt,
    },
    lastExport: {
      fileName: 'first-export.dck',
      deckName: 'First Export',
      updatedAt: history.lastExport?.updatedAt,
    },
  });

  assert.deepEqual(service.resetDeckFileHistory(), DEFAULT_DECK_FILE_HISTORY);
  assert.deepEqual(service.loadDeckFileHistory(), DEFAULT_DECK_FILE_HISTORY);
});

test('normalizes deck generator settings with Java dialog bounds', () => {
  const settings = normalizeDeckGeneratorSettings({
    colors: ['red', 'red', 'bad', 'green'],
    randomColor: true,
    format: '  MOM  ',
    deckSize: 999,
    singleton: false,
    includeArtifacts: true,
    includeNonBasicLands: true,
    includeColorless: true,
    commander: true,
    advanced: true,
    creaturePercentage: 250,
    nonCreaturePercentage: -40,
    landPercentage: 41.4,
    cmcProfile: 'High',
  });

  assert.deepEqual(settings.colors, ['red', 'green']);
  assert.equal(settings.randomColor, true);
  assert.equal(settings.format, 'MOM');
  assert.equal(settings.deckSize, DEFAULT_DECK_GENERATOR_SETTINGS.deckSize);
  assert.equal(settings.singleton, true);
  assert.equal(settings.includeArtifacts, true);
  assert.equal(settings.includeNonBasicLands, true);
  assert.equal(settings.includeColorless, true);
  assert.equal(settings.commander, true);
  assert.equal(settings.advanced, true);
  assert.equal(settings.creaturePercentage, 100);
  assert.equal(settings.nonCreaturePercentage, 0);
  assert.equal(settings.landPercentage, 41);
  assert.equal(settings.cmcProfile, 'High');
});

test('persists deck generator settings through the app config service storage adapter', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  const saved = service.saveDeckGeneratorSettings({
    colors: ['black'],
    format: 'Constructed - Pauper',
    deckSize: 40,
    singleton: true,
    includeArtifacts: true,
    advanced: true,
    creaturePercentage: 45,
    nonCreaturePercentage: 20,
    landPercentage: 35,
    cmcProfile: 'Low',
  });

  assert.deepEqual(saved.colors, ['black']);
  assert.equal(saved.format, 'Constructed - Pauper');
  assert.equal(saved.deckSize, 40);
  assert.equal(saved.singleton, true);
  assert.equal(saved.includeArtifacts, true);
  assert.equal(saved.advanced, true);
  assert.equal(saved.creaturePercentage, 45);
  assert.equal(saved.nonCreaturePercentage, 20);
  assert.equal(saved.landPercentage, 35);
  assert.equal(saved.cmcProfile, 'Low');
  assert.deepEqual(service.loadDeckGeneratorSettings(), saved);
  assert.deepEqual(service.resetDeckGeneratorSettings(), DEFAULT_DECK_GENERATOR_SETTINGS);
  assert.deepEqual(service.loadDeckGeneratorSettings(), DEFAULT_DECK_GENERATOR_SETTINGS);
});

test('persists ignored users per normalized server with case-insensitive de-duplication', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  service.addIgnoredUser('localhost:17172', ' Alice ');
  service.addIgnoredUser('ws://localhost:17172/', 'alice');
  service.addIgnoredUser('ws://127.0.0.1:17172', 'Bob');

  assert.deepEqual(service.loadIgnoredUsers('ws://localhost:17172'), ['Alice']);
  assert.deepEqual(service.loadIgnoredUsers('127.0.0.1:17172'), ['Bob']);
  assert.equal(service.isUserIgnored('ws://localhost:17172', 'ALICE'), true);
  assert.equal(service.isUserIgnored('ws://localhost:17172', 'Bob'), false);

  service.removeIgnoredUser('ws://localhost:17172', 'aLiCe');
  assert.deepEqual(service.loadIgnoredUsers('localhost:17172'), []);
});

test('caps ignored users at the Java client limit', () => {
  const storage = new MemoryStorage();
  const service = new AppConfigService(storage);

  const saved = service.saveIgnoredUsers(
    'ws://localhost:17172',
    Array.from({ length: MAX_IGNORED_USERS + 5 }, (_, index) => `User${index}`),
  );

  assert.equal(saved.length, MAX_IGNORED_USERS);
  assert.equal(service.loadIgnoredUsers('localhost:17172').length, MAX_IGNORED_USERS);
});

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}
