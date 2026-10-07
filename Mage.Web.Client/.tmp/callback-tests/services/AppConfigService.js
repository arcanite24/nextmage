import { LOBBY_TABLE_COLUMN_KEYS, } from './LobbyTableRowsService.js';
import { normalizeServerUrl } from './ConnectionProfileService.js';
export const BATTLEFIELD_CARD_SIZE_MIN = 7;
export const BATTLEFIELD_CARD_SIZE_MAX = 99;
export const BATTLEFIELD_CARD_SIZE_DEFAULT = 14;
export const CARD_SIZE_MIN = 8;
export const CARD_SIZE_MAX = 160;
export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 28;
const SETTINGS_KEY = 'mage.client.settings.v1';
const LOBBY_CONFIG_KEY = 'mage.client.lobby.v1';
const CREATE_TABLE_PRESETS_KEY = 'mage.client.createTablePresets.v1';
const CREATE_TOURNAMENT_PRESETS_KEY = 'mage.client.createTournamentPresets.v1';
const DECK_EDITOR_CONFIG_KEY = 'mage.client.deckEditor.v1';
const DECK_GENERATOR_SETTINGS_KEY = 'mage.client.deckGenerator.v1';
const DECK_FILE_HISTORY_KEY = 'mage.client.deckFileHistory.v1';
const IGNORED_USERS_KEY = 'mage.client.ignoredUsers.v1';
const PANEL_LAYOUT_CONFIG_KEY = 'mage.client.panelLayout.v1';
export const MAX_IGNORED_USERS = 500;
export const DEFAULT_SKIP_PRIORITY_STEPS = {
    upkeep: false,
    draw: false,
    main1: true,
    beforeCombat: false,
    endOfCombat: false,
    main2: true,
    endOfTurn: false,
};
export const DEFAULT_USER_SKIP_PRIORITY_STEPS = {
    yourTurn: DEFAULT_SKIP_PRIORITY_STEPS,
    opponentTurn: { ...DEFAULT_SKIP_PRIORITY_STEPS, main1: false, main2: false },
    stopOnDeclareAttackers: true,
    stopOnDeclareBlockersWithZeroPermanents: false,
    stopOnDeclareBlockersWithAnyPermanents: true,
    stopOnAllMainPhases: true,
    stopOnAllEndPhases: true,
    stopOnStackNewObjects: true,
};
export const KEYBIND_ACTION_IDS = [
    'confirm',
    'cancelSkip',
    'nextTurn',
    'endStep',
    'skipStep',
    'mainStep',
    'yourTurn',
    'skipStack',
    'priorEndStep',
    'switchChat',
    'toggleMacro',
    'holdFirstMana',
    'debugMode',
];
export const DEFAULT_KEYBINDS = {
    confirm: { key: 'F2', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    cancelSkip: { key: 'F3', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    nextTurn: { key: 'F4', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    endStep: { key: 'F5', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    skipStep: { key: 'F6', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    mainStep: { key: 'F7', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    yourTurn: { key: 'F9', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    skipStack: { key: 'F10', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    priorEndStep: { key: 'F11', eventType: 'keydown', ctrlOrMeta: false, altKey: false, shiftKey: false, enabled: true },
    switchChat: { key: 'Enter', eventType: 'keydown', ctrlOrMeta: true, altKey: false, shiftKey: false, enabled: true },
    toggleMacro: { key: 'm', eventType: 'keydown', ctrlOrMeta: true, altKey: false, shiftKey: false, enabled: true },
    holdFirstMana: { key: '1', eventType: 'keydown', ctrlOrMeta: false, altKey: true, shiftKey: false, enabled: true },
    debugMode: { key: 'd', eventType: 'keydown', ctrlOrMeta: true, altKey: false, shiftKey: false, enabled: true },
};
export const DEFAULT_CLIENT_SETTINGS = {
    animationsEnabled: true,
    animationSpeed: 1,
    preloadMatchImages: false,
    autoTapManaPayment: true,
    manaPoolAutomaticRestricted: true,
    useFirstManaAbility: false,
    skipPrioritySteps: DEFAULT_USER_SKIP_PRIORITY_STEPS,
    avatarId: 51,
    flagName: 'world',
    allowRequestShowHandCards: true,
    confirmEmptyManaPool: true,
    askMoveToGraveOrder: false,
    passPriorityCast: true,
    passPriorityActivation: true,
    autoOrderTrigger: true,
    autoTargetLevel: 1,
    useSameSettingsForReplacementEffects: true,
    battlefieldGrouping: 'separate',
    battlefieldCardSize: BATTLEFIELD_CARD_SIZE_DEFAULT,
    matchSeatOrientation: 'table',
    alwaysShowPlayerNames: true,
    displayLifeOnAvatar: true,
    showCardReminderText: true,
    showCardSetInfo: true,
    showCardHints: true,
    tooltipDelayMs: 300,
    showCardNames: true,
    showCardImageSource: false,
    handCardSize: 104,
    editorCardSize: 96,
    otherZoneCardSize: 86,
    dialogFontSize: 14,
    chatFontSize: 14,
    playerPanelSize: 100,
    tooltipSize: 360,
    cardRenderingMode: 'image',
    showAbilityIcons: true,
    showPlayableIcons: true,
    showAbilityTextOverlay: false,
    showSetSymbol: true,
    cardImageFallbackMode: 'card-back',
    preferredImageLanguage: 'en',
    preloadVisibleCardImages: true,
    imageCacheMaxAgeDays: 30,
    imageCacheMaxSizeMb: 100,
    clientTheme: 'arena',
    customLoginBackground: '',
    battlefieldBackgroundMode: 'default',
    customBattlefieldBackground: '',
    gameSoundsEnabled: true,
    draftSoundsEnabled: true,
    skipButtonSoundsEnabled: true,
    otherSoundsEnabled: true,
    matchMusicEnabled: false,
    browserAudioUnlocked: false,
    masterVolume: 80,
    effectsVolume: 80,
    musicVolume: 50,
    reducedAudioMode: false,
    keybinds: DEFAULT_KEYBINDS,
    reconnectRecoveryEnabled: true,
    restoreSessionOnReconnect: true,
    showConnectionStatusMessages: true,
    debugModeEnabled: false,
    debugCaptureEnabled: false,
    persistPanelLayout: true,
    chatProfanityFilterLevel: 0,
};
export const DEFAULT_LOBBY_FILTERS = {
    showWaiting: true,
    showStarting: true,
    showDueling: true,
    showFinished: false,
    gameType: null,
    deckType: null,
    showPassworded: true,
    showUnrated: true,
    searchText: '',
};
export const DEFAULT_LOBBY_COLUMN_WIDTHS = {
    kind: 70,
    deckType: 180,
    name: 200,
    seats: 72,
    ownerPlayers: 160,
    gameType: 170,
    info: 150,
    status: 130,
    password: 90,
    created: 150,
    skill: 70,
    rated: 76,
    quitRatio: 78,
    minimumRating: 90,
    action: 96,
};
export const DEFAULT_LOBBY_CONFIG = {
    filters: DEFAULT_LOBBY_FILTERS,
    selectedTableId: null,
    tableLayout: {
        columnOrder: [...LOBBY_TABLE_COLUMN_KEYS],
        columnWidths: DEFAULT_LOBBY_COLUMN_WIDTHS,
        sort: { key: 'created', direction: 'desc' },
    },
};
export const DEFAULT_CREATE_TABLE_PRESETS = {
    lastUsed: null,
    config1: null,
    config2: null,
};
export const DEFAULT_CREATE_TOURNAMENT_PRESETS = {
    lastUsed: null,
    config1: null,
    config2: null,
};
export const DECK_EDITOR_MODE_KEYS = ['normal', 'limited', 'sideboard', 'draft'];
export const PANEL_LAYOUT_ACTIVITY_KINDS = ['replay', 'tournament', 'draft', 'sideboard', 'construction'];
export const DEFAULT_DECK_SEARCH_COLORS = {
    white: false,
    blue: false,
    black: false,
    red: false,
    green: false,
    colorless: false,
};
export const DEFAULT_DECK_SEARCH_SETTINGS = {
    searchText: '',
    nameContains: '',
    rulesContains: '',
    searchNames: true,
    searchTypes: true,
    searchRules: true,
    colors: { ...DEFAULT_DECK_SEARCH_COLORS },
    excludedColors: { ...DEFAULT_DECK_SEARCH_COLORS },
    colorMatch: 'any',
    types: [],
    excludedTypes: [],
    rarities: [],
    excludedRarities: [],
    setCodes: [],
    format: '',
    useDeckFormat: true,
    pennyDreadful: false,
    manaValue: null,
    manaValueOperator: 'eq',
    uniqueNames: false,
    piles: false,
};
export const DEFAULT_DECK_EDITOR_MODE_CONFIG = {
    collectionView: 'grid',
    collectionSortBy: 'name',
    collectionSortDirection: 'asc',
    deckSortBy: 'custom',
    deckSortDirection: 'asc',
    deckPanelWidth: 320,
    showSideboard: true,
    search: DEFAULT_DECK_SEARCH_SETTINGS,
};
export const DEFAULT_DECK_EDITOR_CONFIG = {
    activeMode: 'normal',
    modes: {
        normal: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
        limited: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
        sideboard: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
        draft: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
    },
};
export const DEFAULT_PANEL_LAYOUT_CONFIG = {
    game: {
        sidebarOpen: false,
    },
    activities: {
        replay: { commandPanelCollapsed: false, chatCollapsed: false },
        tournament: { commandPanelCollapsed: false, chatCollapsed: false },
        draft: { commandPanelCollapsed: false, chatCollapsed: false },
        sideboard: { commandPanelCollapsed: false, chatCollapsed: false },
        construction: { commandPanelCollapsed: false, chatCollapsed: false },
    },
};
export const DEFAULT_DECK_GENERATOR_SETTINGS = {
    colors: ['blue'],
    randomColor: false,
    format: 'Constructed - Standard',
    deckSize: 60,
    singleton: false,
    includeArtifacts: false,
    includeNonBasicLands: false,
    includeColorless: false,
    commander: false,
    advanced: false,
    creaturePercentage: 38,
    nonCreaturePercentage: 21,
    landPercentage: 41,
    cmcProfile: 'Default',
};
export const DEFAULT_DECK_FILE_HISTORY = {
    lastImport: null,
    lastExport: null,
};
export const DEFAULT_CREATE_TABLE_PRESET = {
    name: '',
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Standard',
    winsNeeded: 2,
    freeMulligans: 0,
    timeLimit: 'MIN__25',
    bufferTime: 'NONE',
    mulliganType: 'GAME_DEFAULT',
    password: '',
    skillLevel: 'CASUAL',
    spectatorsAllowed: true,
    rollbackTurnsAllowed: true,
    planeChase: false,
    emblemCardsEnabled: false,
    perPlayerEmblemDeck: null,
    startingPlayerEmblemDeck: null,
    customStartLifeEnabled: false,
    customStartLife: 20,
    customStartHandSizeEnabled: false,
    customStartHandSize: 7,
    rated: false,
    quitRatio: 100,
    minimumRating: 0,
    edhPowerLevel: 0,
    range: 'ALL',
    attackOption: 'MULTIPLE',
    numberOfPlayers: 2,
    playerTypes: ['Human', 'Human'],
    aiSeats: [],
    savedAt: 0,
};
export const DEFAULT_CREATE_TOURNAMENT_PRESET = {
    name: 'Tournament',
    tournamentType: 'Sealed Elimination',
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Standard',
    winsNeeded: 2,
    numberRounds: 3,
    numberOfPlayers: 2,
    singleMultiplayerGame: false,
    timeLimit: 'MIN__25',
    bufferTime: 'NONE',
    constructionTimeMinutes: 10,
    draftTiming: 'REGULAR',
    draftCubeName: '',
    setCodes: [],
    randomSetCodes: [],
    cubeFromDeck: null,
    jumpstartPacks: '',
    password: '',
    skillLevel: 'CASUAL',
    spectatorsAllowed: true,
    rollbackTurnsAllowed: true,
    rated: false,
    quitRatio: 100,
    minimumRating: 0,
    playerTypes: ['Human', 'Human'],
    playerSkills: [2, 2],
    savedAt: 0,
};
const browserStorage = {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
};
export class AppConfigService {
    storage;
    constructor(storage = browserStorage) {
        this.storage = storage;
    }
    loadSettings() {
        if (!this.canUseStorage()) {
            return normalizeClientSettings({});
        }
        try {
            const raw = this.storage.getItem(SETTINGS_KEY);
            if (!raw)
                return normalizeClientSettings({});
            const parsed = JSON.parse(raw);
            return this.normalizeSettings(parsed);
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load settings, using defaults', error);
            return normalizeClientSettings({});
        }
    }
    saveSettings(settings) {
        if (!this.canUseStorage())
            return;
        this.storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeClientSettings(settings)));
    }
    resetSettings() {
        if (this.canUseStorage()) {
            this.storage.removeItem(SETTINGS_KEY);
        }
        return normalizeClientSettings({});
    }
    loadLobbyConfig() {
        if (!this.canUseStorage()) {
            return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
        }
        try {
            const raw = this.storage.getItem(LOBBY_CONFIG_KEY);
            if (!raw)
                return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
            const parsed = JSON.parse(raw);
            return normalizeLobbyConfig(parsed);
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load lobby config, using defaults', error);
            return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
        }
    }
    saveLobbyConfig(config) {
        if (!this.canUseStorage())
            return;
        this.storage.setItem(LOBBY_CONFIG_KEY, JSON.stringify(normalizeLobbyConfig(config)));
    }
    resetLobbyConfig() {
        if (this.canUseStorage()) {
            this.storage.removeItem(LOBBY_CONFIG_KEY);
        }
        return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
    }
    loadCreateTablePresets() {
        if (!this.canUseStorage()) {
            return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
        }
        try {
            const raw = this.storage.getItem(CREATE_TABLE_PRESETS_KEY);
            if (!raw)
                return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
            const parsed = JSON.parse(raw);
            return normalizeCreateTablePresets(parsed);
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load create table presets, using defaults', error);
            return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
        }
    }
    saveCreateTablePreset(slot, preset) {
        const presets = this.loadCreateTablePresets();
        presets[slot] = normalizeCreateTablePreset({
            ...preset,
            savedAt: Date.now(),
        });
        if (this.canUseStorage()) {
            this.storage.setItem(CREATE_TABLE_PRESETS_KEY, JSON.stringify(presets));
        }
        return cloneCreateTablePresets(presets);
    }
    resetCreateTablePresets() {
        if (this.canUseStorage()) {
            this.storage.removeItem(CREATE_TABLE_PRESETS_KEY);
        }
        return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
    }
    loadCreateTournamentPresets() {
        if (!this.canUseStorage()) {
            return cloneCreateTournamentPresets(DEFAULT_CREATE_TOURNAMENT_PRESETS);
        }
        try {
            const raw = this.storage.getItem(CREATE_TOURNAMENT_PRESETS_KEY);
            if (!raw)
                return cloneCreateTournamentPresets(DEFAULT_CREATE_TOURNAMENT_PRESETS);
            const parsed = JSON.parse(raw);
            return normalizeCreateTournamentPresets(parsed);
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load create tournament presets, using defaults', error);
            return cloneCreateTournamentPresets(DEFAULT_CREATE_TOURNAMENT_PRESETS);
        }
    }
    saveCreateTournamentPreset(slot, preset) {
        const presets = this.loadCreateTournamentPresets();
        presets[slot] = normalizeCreateTournamentPreset({
            ...preset,
            savedAt: Date.now(),
        });
        if (this.canUseStorage()) {
            this.storage.setItem(CREATE_TOURNAMENT_PRESETS_KEY, JSON.stringify(presets));
        }
        return cloneCreateTournamentPresets(presets);
    }
    resetCreateTournamentPresets() {
        if (this.canUseStorage()) {
            this.storage.removeItem(CREATE_TOURNAMENT_PRESETS_KEY);
        }
        return cloneCreateTournamentPresets(DEFAULT_CREATE_TOURNAMENT_PRESETS);
    }
    loadDeckEditorConfig() {
        if (!this.canUseStorage()) {
            return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
        }
        try {
            const raw = this.storage.getItem(DECK_EDITOR_CONFIG_KEY);
            if (!raw)
                return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
            return normalizeDeckEditorConfig(JSON.parse(raw));
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load deck editor config, using defaults', error);
            return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
        }
    }
    saveDeckEditorConfig(config) {
        const normalized = normalizeDeckEditorConfig(config);
        if (this.canUseStorage()) {
            this.storage.setItem(DECK_EDITOR_CONFIG_KEY, JSON.stringify(normalized));
        }
        return cloneDeckEditorConfig(normalized);
    }
    resetDeckEditorConfig() {
        if (this.canUseStorage()) {
            this.storage.removeItem(DECK_EDITOR_CONFIG_KEY);
        }
        return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
    }
    loadPanelLayoutConfig() {
        if (!this.canUseStorage()) {
            return clonePanelLayoutConfig(DEFAULT_PANEL_LAYOUT_CONFIG);
        }
        try {
            const raw = this.storage.getItem(PANEL_LAYOUT_CONFIG_KEY);
            if (!raw)
                return clonePanelLayoutConfig(DEFAULT_PANEL_LAYOUT_CONFIG);
            return normalizePanelLayoutConfig(JSON.parse(raw));
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load panel layout config, using defaults', error);
            return clonePanelLayoutConfig(DEFAULT_PANEL_LAYOUT_CONFIG);
        }
    }
    savePanelLayoutConfig(config) {
        const normalized = normalizePanelLayoutConfig(config);
        if (this.canUseStorage()) {
            this.storage.setItem(PANEL_LAYOUT_CONFIG_KEY, JSON.stringify(normalized));
        }
        return clonePanelLayoutConfig(normalized);
    }
    resetPanelLayoutConfig() {
        if (this.canUseStorage()) {
            this.storage.removeItem(PANEL_LAYOUT_CONFIG_KEY);
        }
        return clonePanelLayoutConfig(DEFAULT_PANEL_LAYOUT_CONFIG);
    }
    loadDeckGeneratorSettings() {
        if (!this.canUseStorage()) {
            return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
        }
        try {
            const raw = this.storage.getItem(DECK_GENERATOR_SETTINGS_KEY);
            if (!raw)
                return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
            return normalizeDeckGeneratorSettings(JSON.parse(raw));
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load deck generator settings, using defaults', error);
            return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
        }
    }
    saveDeckGeneratorSettings(settings) {
        const normalized = normalizeDeckGeneratorSettings(settings);
        if (this.canUseStorage()) {
            this.storage.setItem(DECK_GENERATOR_SETTINGS_KEY, JSON.stringify(normalized));
        }
        return cloneDeckGeneratorSettings(normalized);
    }
    resetDeckGeneratorSettings() {
        if (this.canUseStorage()) {
            this.storage.removeItem(DECK_GENERATOR_SETTINGS_KEY);
        }
        return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
    }
    loadDeckFileHistory() {
        if (!this.canUseStorage()) {
            return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
        }
        try {
            const raw = this.storage.getItem(DECK_FILE_HISTORY_KEY);
            if (!raw)
                return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
            return normalizeDeckFileHistory(JSON.parse(raw));
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load deck file history, using defaults', error);
            return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
        }
    }
    saveDeckFileHistory(history) {
        const normalized = normalizeDeckFileHistory(history);
        if (this.canUseStorage()) {
            this.storage.setItem(DECK_FILE_HISTORY_KEY, JSON.stringify(normalized));
        }
        return cloneDeckFileHistory(normalized);
    }
    rememberDeckImportFile(fileName, deckName) {
        return this.saveDeckFileHistory({
            ...this.loadDeckFileHistory(),
            lastImport: {
                fileName,
                deckName,
                updatedAt: Date.now(),
            },
        });
    }
    rememberDeckExportFile(fileName, deckName) {
        return this.saveDeckFileHistory({
            ...this.loadDeckFileHistory(),
            lastExport: {
                fileName,
                deckName,
                updatedAt: Date.now(),
            },
        });
    }
    resetDeckFileHistory() {
        if (this.canUseStorage()) {
            this.storage.removeItem(DECK_FILE_HISTORY_KEY);
        }
        return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
    }
    loadIgnoredUsers(serverUrl) {
        const config = this.loadIgnoredUsersConfig();
        return [...(config.byServer[ignoredUsersServerKey(serverUrl)] ?? [])];
    }
    saveIgnoredUsers(serverUrl, users) {
        const config = this.loadIgnoredUsersConfig();
        const serverKey = ignoredUsersServerKey(serverUrl);
        const normalizedUsers = normalizeIgnoredUserList(users);
        if (normalizedUsers.length > 0) {
            config.byServer[serverKey] = normalizedUsers;
        }
        else {
            delete config.byServer[serverKey];
        }
        if (this.canUseStorage()) {
            this.storage.setItem(IGNORED_USERS_KEY, JSON.stringify(config));
        }
        return [...normalizedUsers];
    }
    addIgnoredUser(serverUrl, userName) {
        return this.saveIgnoredUsers(serverUrl, [
            ...this.loadIgnoredUsers(serverUrl),
            userName,
        ]);
    }
    removeIgnoredUser(serverUrl, userName) {
        const targetKey = ignoredUserIdentity(userName);
        const nextUsers = this.loadIgnoredUsers(serverUrl).filter(user => ignoredUserIdentity(user) !== targetKey);
        return this.saveIgnoredUsers(serverUrl, nextUsers);
    }
    isUserIgnored(serverUrl, userName) {
        const targetKey = ignoredUserIdentity(userName);
        if (!targetKey)
            return false;
        return this.loadIgnoredUsers(serverUrl).some(user => ignoredUserIdentity(user) === targetKey);
    }
    normalizeSettings(settings) {
        return normalizeClientSettings(settings);
    }
    loadIgnoredUsersConfig() {
        if (!this.canUseStorage()) {
            return { byServer: {} };
        }
        try {
            const raw = this.storage.getItem(IGNORED_USERS_KEY);
            if (!raw)
                return { byServer: {} };
            return normalizeIgnoredUsersConfig(JSON.parse(raw));
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load ignored users, using empty list', error);
            return { byServer: {} };
        }
    }
    canUseStorage() {
        return typeof window !== 'undefined' || this.storage !== browserStorage;
    }
}
export function normalizeClientSettings(settings) {
    const groupingValues = ['separate', 'nonlands', 'creature-land-other'];
    const battlefieldGrouping = groupingValues.includes(settings.battlefieldGrouping)
        ? settings.battlefieldGrouping
        : DEFAULT_CLIENT_SETTINGS.battlefieldGrouping;
    const seatOrientationValues = ['table', 'reverse', 'active-first'];
    const matchSeatOrientation = seatOrientationValues.includes(settings.matchSeatOrientation)
        ? settings.matchSeatOrientation
        : DEFAULT_CLIENT_SETTINGS.matchSeatOrientation;
    return {
        ...DEFAULT_CLIENT_SETTINGS,
        ...settings,
        skipPrioritySteps: normalizeUserSkipPrioritySteps(settings.skipPrioritySteps),
        battlefieldGrouping,
        matchSeatOrientation,
        animationsEnabled: normalizeBoolean(settings.animationsEnabled, DEFAULT_CLIENT_SETTINGS.animationsEnabled),
        preloadMatchImages: normalizeBoolean(settings.preloadMatchImages, DEFAULT_CLIENT_SETTINGS.preloadMatchImages),
        autoTapManaPayment: normalizeBoolean(settings.autoTapManaPayment, DEFAULT_CLIENT_SETTINGS.autoTapManaPayment),
        manaPoolAutomaticRestricted: normalizeBoolean(settings.manaPoolAutomaticRestricted, DEFAULT_CLIENT_SETTINGS.manaPoolAutomaticRestricted),
        useFirstManaAbility: normalizeBoolean(settings.useFirstManaAbility, DEFAULT_CLIENT_SETTINGS.useFirstManaAbility),
        allowRequestShowHandCards: normalizeBoolean(settings.allowRequestShowHandCards, DEFAULT_CLIENT_SETTINGS.allowRequestShowHandCards),
        confirmEmptyManaPool: normalizeBoolean(settings.confirmEmptyManaPool, DEFAULT_CLIENT_SETTINGS.confirmEmptyManaPool),
        askMoveToGraveOrder: normalizeBoolean(settings.askMoveToGraveOrder, DEFAULT_CLIENT_SETTINGS.askMoveToGraveOrder),
        passPriorityCast: normalizeBoolean(settings.passPriorityCast, DEFAULT_CLIENT_SETTINGS.passPriorityCast),
        passPriorityActivation: normalizeBoolean(settings.passPriorityActivation, DEFAULT_CLIENT_SETTINGS.passPriorityActivation),
        autoOrderTrigger: normalizeBoolean(settings.autoOrderTrigger, DEFAULT_CLIENT_SETTINGS.autoOrderTrigger),
        useSameSettingsForReplacementEffects: normalizeBoolean(settings.useSameSettingsForReplacementEffects, DEFAULT_CLIENT_SETTINGS.useSameSettingsForReplacementEffects),
        alwaysShowPlayerNames: normalizeBoolean(settings.alwaysShowPlayerNames, DEFAULT_CLIENT_SETTINGS.alwaysShowPlayerNames),
        displayLifeOnAvatar: normalizeBoolean(settings.displayLifeOnAvatar, DEFAULT_CLIENT_SETTINGS.displayLifeOnAvatar),
        showCardReminderText: normalizeBoolean(settings.showCardReminderText, DEFAULT_CLIENT_SETTINGS.showCardReminderText),
        showCardSetInfo: normalizeBoolean(settings.showCardSetInfo, DEFAULT_CLIENT_SETTINGS.showCardSetInfo),
        showCardHints: normalizeBoolean(settings.showCardHints, DEFAULT_CLIENT_SETTINGS.showCardHints),
        showCardNames: normalizeBoolean(settings.showCardNames, DEFAULT_CLIENT_SETTINGS.showCardNames),
        showCardImageSource: normalizeBoolean(settings.showCardImageSource, DEFAULT_CLIENT_SETTINGS.showCardImageSource),
        showAbilityIcons: normalizeBoolean(settings.showAbilityIcons, DEFAULT_CLIENT_SETTINGS.showAbilityIcons),
        showPlayableIcons: normalizeBoolean(settings.showPlayableIcons, DEFAULT_CLIENT_SETTINGS.showPlayableIcons),
        showAbilityTextOverlay: normalizeBoolean(settings.showAbilityTextOverlay, DEFAULT_CLIENT_SETTINGS.showAbilityTextOverlay),
        showSetSymbol: normalizeBoolean(settings.showSetSymbol, DEFAULT_CLIENT_SETTINGS.showSetSymbol),
        preloadVisibleCardImages: normalizeBoolean(settings.preloadVisibleCardImages, DEFAULT_CLIENT_SETTINGS.preloadVisibleCardImages),
        cardImageFallbackMode: normalizeEnumString(settings.cardImageFallbackMode, CARD_IMAGE_FALLBACK_MODE_VALUES, DEFAULT_CLIENT_SETTINGS.cardImageFallbackMode),
        preferredImageLanguage: normalizeImageLanguage(settings.preferredImageLanguage),
        cardRenderingMode: normalizeEnumString(settings.cardRenderingMode, CARD_RENDERING_MODE_VALUES, DEFAULT_CLIENT_SETTINGS.cardRenderingMode),
        battlefieldCardSize: Math.round(clampNumber(settings.battlefieldCardSize, BATTLEFIELD_CARD_SIZE_MIN, BATTLEFIELD_CARD_SIZE_MAX, DEFAULT_CLIENT_SETTINGS.battlefieldCardSize)),
        tooltipDelayMs: Math.round(clampNumber(settings.tooltipDelayMs, 0, 3000, DEFAULT_CLIENT_SETTINGS.tooltipDelayMs)),
        handCardSize: Math.round(clampNumber(settings.handCardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, DEFAULT_CLIENT_SETTINGS.handCardSize)),
        editorCardSize: Math.round(clampNumber(settings.editorCardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, DEFAULT_CLIENT_SETTINGS.editorCardSize)),
        otherZoneCardSize: Math.round(clampNumber(settings.otherZoneCardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, DEFAULT_CLIENT_SETTINGS.otherZoneCardSize)),
        dialogFontSize: Math.round(clampNumber(settings.dialogFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, DEFAULT_CLIENT_SETTINGS.dialogFontSize)),
        chatFontSize: Math.round(clampNumber(settings.chatFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, DEFAULT_CLIENT_SETTINGS.chatFontSize)),
        playerPanelSize: Math.round(clampNumber(settings.playerPanelSize, 70, 140, DEFAULT_CLIENT_SETTINGS.playerPanelSize)),
        tooltipSize: Math.round(clampNumber(settings.tooltipSize, 220, 560, DEFAULT_CLIENT_SETTINGS.tooltipSize)),
        animationSpeed: clampNumber(settings.animationSpeed, 0.5, 2, DEFAULT_CLIENT_SETTINGS.animationSpeed),
        imageCacheMaxAgeDays: clampNumber(settings.imageCacheMaxAgeDays, 1, 365, DEFAULT_CLIENT_SETTINGS.imageCacheMaxAgeDays),
        imageCacheMaxSizeMb: Math.round(clampNumber(settings.imageCacheMaxSizeMb, 25, 1000, DEFAULT_CLIENT_SETTINGS.imageCacheMaxSizeMb)),
        clientTheme: normalizeEnumString(settings.clientTheme, CLIENT_THEME_VALUES, DEFAULT_CLIENT_SETTINGS.clientTheme),
        customLoginBackground: normalizeBackgroundValue(settings.customLoginBackground),
        battlefieldBackgroundMode: normalizeEnumString(settings.battlefieldBackgroundMode, BATTLEFIELD_BACKGROUND_MODE_VALUES, DEFAULT_CLIENT_SETTINGS.battlefieldBackgroundMode),
        customBattlefieldBackground: normalizeBackgroundValue(settings.customBattlefieldBackground),
        gameSoundsEnabled: normalizeBoolean(settings.gameSoundsEnabled, DEFAULT_CLIENT_SETTINGS.gameSoundsEnabled),
        draftSoundsEnabled: normalizeBoolean(settings.draftSoundsEnabled, DEFAULT_CLIENT_SETTINGS.draftSoundsEnabled),
        skipButtonSoundsEnabled: normalizeBoolean(settings.skipButtonSoundsEnabled, DEFAULT_CLIENT_SETTINGS.skipButtonSoundsEnabled),
        otherSoundsEnabled: normalizeBoolean(settings.otherSoundsEnabled, DEFAULT_CLIENT_SETTINGS.otherSoundsEnabled),
        matchMusicEnabled: normalizeBoolean(settings.matchMusicEnabled, DEFAULT_CLIENT_SETTINGS.matchMusicEnabled),
        browserAudioUnlocked: normalizeBoolean(settings.browserAudioUnlocked, DEFAULT_CLIENT_SETTINGS.browserAudioUnlocked),
        masterVolume: Math.round(clampNumber(settings.masterVolume, 0, 100, DEFAULT_CLIENT_SETTINGS.masterVolume)),
        effectsVolume: Math.round(clampNumber(settings.effectsVolume, 0, 100, DEFAULT_CLIENT_SETTINGS.effectsVolume)),
        musicVolume: Math.round(clampNumber(settings.musicVolume, 0, 100, DEFAULT_CLIENT_SETTINGS.musicVolume)),
        reducedAudioMode: normalizeBoolean(settings.reducedAudioMode, DEFAULT_CLIENT_SETTINGS.reducedAudioMode),
        keybinds: normalizeKeybinds(settings.keybinds),
        reconnectRecoveryEnabled: normalizeBoolean(settings.reconnectRecoveryEnabled, DEFAULT_CLIENT_SETTINGS.reconnectRecoveryEnabled),
        restoreSessionOnReconnect: normalizeBoolean(settings.restoreSessionOnReconnect, DEFAULT_CLIENT_SETTINGS.restoreSessionOnReconnect),
        showConnectionStatusMessages: normalizeBoolean(settings.showConnectionStatusMessages, DEFAULT_CLIENT_SETTINGS.showConnectionStatusMessages),
        debugModeEnabled: normalizeBoolean(settings.debugModeEnabled, DEFAULT_CLIENT_SETTINGS.debugModeEnabled),
        debugCaptureEnabled: normalizeBoolean(settings.debugCaptureEnabled, DEFAULT_CLIENT_SETTINGS.debugCaptureEnabled),
        persistPanelLayout: normalizeBoolean(settings.persistPanelLayout, DEFAULT_CLIENT_SETTINGS.persistPanelLayout),
        chatProfanityFilterLevel: normalizeProfanityFilterLevel(settings.chatProfanityFilterLevel, DEFAULT_CLIENT_SETTINGS.chatProfanityFilterLevel),
        avatarId: Math.round(clampNumber(settings.avatarId, 1, 9999, DEFAULT_CLIENT_SETTINGS.avatarId)),
        flagName: normalizeFlagName(settings.flagName),
        autoTargetLevel: Math.round(clampNumber(settings.autoTargetLevel, 0, 2, DEFAULT_CLIENT_SETTINGS.autoTargetLevel)),
    };
}
export function clientSettingsToUserData(settings) {
    const normalized = normalizeClientSettings(settings);
    return {
        groupId: 0,
        avatarId: normalized.avatarId,
        allowRequestShowHandCards: normalized.allowRequestShowHandCards,
        confirmEmptyManaPool: normalized.confirmEmptyManaPool,
        userSkipPrioritySteps: cloneUserSkipPrioritySteps(normalized.skipPrioritySteps),
        flagName: normalized.flagName,
        askMoveToGraveOrder: normalized.askMoveToGraveOrder,
        manaPoolAutomatic: normalized.autoTapManaPayment,
        manaPoolAutomaticRestricted: normalized.manaPoolAutomaticRestricted,
        passPriorityCast: normalized.passPriorityCast,
        passPriorityActivation: normalized.passPriorityActivation,
        autoOrderTrigger: normalized.autoOrderTrigger,
        autoTargetLevel: normalized.autoTargetLevel,
        useSameSettingsForReplacementEffects: normalized.useSameSettingsForReplacementEffects,
        useFirstManaAbility: normalized.useFirstManaAbility,
    };
}
function cloneUserSkipPrioritySteps(steps) {
    return {
        yourTurn: { ...steps.yourTurn },
        opponentTurn: { ...steps.opponentTurn },
        stopOnDeclareAttackers: steps.stopOnDeclareAttackers,
        stopOnDeclareBlockersWithZeroPermanents: steps.stopOnDeclareBlockersWithZeroPermanents,
        stopOnDeclareBlockersWithAnyPermanents: steps.stopOnDeclareBlockersWithAnyPermanents,
        stopOnAllMainPhases: steps.stopOnAllMainPhases,
        stopOnAllEndPhases: steps.stopOnAllEndPhases,
        stopOnStackNewObjects: steps.stopOnStackNewObjects,
    };
}
function normalizeFlagName(value) {
    if (typeof value !== 'string')
        return DEFAULT_CLIENT_SETTINGS.flagName;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed)
        return DEFAULT_CLIENT_SETTINGS.flagName;
    return trimmed.replace(/\.png$/i, '');
}
function clampNumber(value, min, max, fallback) {
    if (typeof value !== 'number' || Number.isNaN(value))
        return fallback;
    return Math.min(max, Math.max(min, value));
}
export function normalizeLobbyConfig(config) {
    const filters = normalizeLobbyFilters(config.filters);
    const tableLayout = normalizeLobbyTableLayout(config.tableLayout);
    const selectedTableId = typeof config.selectedTableId === 'string' && config.selectedTableId.trim()
        ? config.selectedTableId
        : null;
    return {
        filters,
        selectedTableId,
        tableLayout,
    };
}
export function normalizeLobbyFilters(filters) {
    return {
        ...DEFAULT_LOBBY_FILTERS,
        ...filters,
        showWaiting: normalizeBoolean(filters?.showWaiting, DEFAULT_LOBBY_FILTERS.showWaiting),
        showStarting: normalizeBoolean(filters?.showStarting, DEFAULT_LOBBY_FILTERS.showStarting),
        showDueling: normalizeBoolean(filters?.showDueling, DEFAULT_LOBBY_FILTERS.showDueling),
        showFinished: normalizeBoolean(filters?.showFinished, DEFAULT_LOBBY_FILTERS.showFinished),
        gameType: normalizeNullableString(filters?.gameType),
        deckType: normalizeNullableString(filters?.deckType),
        showPassworded: normalizeBoolean(filters?.showPassworded, DEFAULT_LOBBY_FILTERS.showPassworded),
        showUnrated: normalizeBoolean(filters?.showUnrated, DEFAULT_LOBBY_FILTERS.showUnrated),
        searchText: normalizeSearchText(filters?.searchText),
    };
}
export function normalizeLobbyTableLayout(layout) {
    const columnOrder = normalizeColumnOrder(layout?.columnOrder);
    const columnWidths = normalizeColumnWidths(layout?.columnWidths);
    const sort = normalizeLobbySort(layout?.sort);
    return {
        columnOrder,
        columnWidths,
        sort,
    };
}
export function normalizeCreateTablePresets(config) {
    return {
        lastUsed: normalizeNullableCreateTablePreset(config?.lastUsed),
        config1: normalizeNullableCreateTablePreset(config?.config1),
        config2: normalizeNullableCreateTablePreset(config?.config2),
    };
}
export function normalizeCreateTablePreset(preset) {
    const fallback = DEFAULT_CREATE_TABLE_PRESET;
    return {
        name: normalizeBoundedString(preset?.name, fallback.name, 80),
        gameType: normalizeBoundedString(preset?.gameType, fallback.gameType, 120),
        deckType: normalizeBoundedString(preset?.deckType, fallback.deckType, 160),
        winsNeeded: Math.round(clampNumber(preset?.winsNeeded, 1, 5, fallback.winsNeeded)),
        freeMulligans: Math.round(clampNumber(preset?.freeMulligans, 0, 5, fallback.freeMulligans)),
        timeLimit: normalizeEnumString(preset?.timeLimit, MATCH_TIME_LIMIT_VALUES, fallback.timeLimit),
        bufferTime: normalizeEnumString(preset?.bufferTime, MATCH_BUFFER_TIME_VALUES, fallback.bufferTime),
        mulliganType: normalizeEnumString(preset?.mulliganType, MULLIGAN_TYPE_VALUES, fallback.mulliganType),
        password: normalizeBoundedString(preset?.password, fallback.password, 80),
        skillLevel: normalizeEnumString(preset?.skillLevel, SKILL_LEVEL_VALUES, fallback.skillLevel),
        spectatorsAllowed: normalizeBoolean(preset?.spectatorsAllowed, fallback.spectatorsAllowed),
        rollbackTurnsAllowed: normalizeBoolean(preset?.rollbackTurnsAllowed, fallback.rollbackTurnsAllowed),
        planeChase: normalizeBoolean(preset?.planeChase, fallback.planeChase),
        emblemCardsEnabled: normalizeBoolean(preset?.emblemCardsEnabled, fallback.emblemCardsEnabled),
        perPlayerEmblemDeck: normalizeDeckCardLists(preset?.perPlayerEmblemDeck),
        startingPlayerEmblemDeck: normalizeDeckCardLists(preset?.startingPlayerEmblemDeck),
        customStartLifeEnabled: normalizeBoolean(preset?.customStartLifeEnabled, fallback.customStartLifeEnabled),
        customStartLife: Math.round(clampNumber(preset?.customStartLife, 1, 100, fallback.customStartLife)),
        customStartHandSizeEnabled: normalizeBoolean(preset?.customStartHandSizeEnabled, fallback.customStartHandSizeEnabled),
        customStartHandSize: Math.round(clampNumber(preset?.customStartHandSize, 0, 20, fallback.customStartHandSize)),
        rated: normalizeBoolean(preset?.rated, fallback.rated),
        quitRatio: Math.round(clampNumber(preset?.quitRatio, 0, 100, fallback.quitRatio)),
        minimumRating: Math.round(clampNumber(preset?.minimumRating, 0, 3000, fallback.minimumRating)),
        edhPowerLevel: Math.round(clampNumber(preset?.edhPowerLevel, 0, 100, fallback.edhPowerLevel)),
        range: normalizeEnumString(preset?.range, RANGE_VALUES, fallback.range),
        attackOption: normalizeEnumString(preset?.attackOption, ATTACK_OPTION_VALUES, fallback.attackOption),
        numberOfPlayers: Math.round(clampNumber(preset?.numberOfPlayers, 1, 10, fallback.numberOfPlayers)),
        playerTypes: normalizeCreateTablePlayerTypes(preset?.playerTypes, fallback.playerTypes),
        aiSeats: normalizeCreateTableAiSeats(preset?.aiSeats, fallback.aiSeats),
        savedAt: Math.round(clampNumber(preset?.savedAt, 0, Number.MAX_SAFE_INTEGER, fallback.savedAt)),
    };
}
export function normalizeCreateTournamentPresets(config) {
    return {
        lastUsed: normalizeNullableCreateTournamentPreset(config?.lastUsed),
        config1: normalizeNullableCreateTournamentPreset(config?.config1),
        config2: normalizeNullableCreateTournamentPreset(config?.config2),
    };
}
export function normalizeCreateTournamentPreset(preset) {
    const fallback = DEFAULT_CREATE_TOURNAMENT_PRESET;
    return {
        name: normalizeBoundedString(preset?.name, fallback.name, 80),
        tournamentType: normalizeBoundedString(preset?.tournamentType, fallback.tournamentType, 160),
        gameType: normalizeBoundedString(preset?.gameType, fallback.gameType, 120),
        deckType: normalizeBoundedString(preset?.deckType, fallback.deckType, 160),
        winsNeeded: Math.round(clampNumber(preset?.winsNeeded, 1, 5, fallback.winsNeeded)),
        numberRounds: Math.round(clampNumber(preset?.numberRounds, 1, 12, fallback.numberRounds)),
        numberOfPlayers: Math.round(clampNumber(preset?.numberOfPlayers, 1, 64, fallback.numberOfPlayers)),
        singleMultiplayerGame: normalizeBoolean(preset?.singleMultiplayerGame, fallback.singleMultiplayerGame),
        timeLimit: normalizeEnumString(preset?.timeLimit, MATCH_TIME_LIMIT_VALUES, fallback.timeLimit),
        bufferTime: normalizeEnumString(preset?.bufferTime, MATCH_BUFFER_TIME_VALUES, fallback.bufferTime),
        constructionTimeMinutes: Math.round(clampNumber(preset?.constructionTimeMinutes, 1, 120, fallback.constructionTimeMinutes)),
        draftTiming: normalizeEnumString(preset?.draftTiming, DRAFT_TIMING_VALUES, fallback.draftTiming),
        draftCubeName: normalizeBoundedString(preset?.draftCubeName, fallback.draftCubeName, 160),
        setCodes: normalizeFreeSetCodes(preset?.setCodes, 36),
        randomSetCodes: normalizeFreeSetCodes(preset?.randomSetCodes, 120),
        cubeFromDeck: normalizeDeckCardLists(preset?.cubeFromDeck),
        jumpstartPacks: normalizeBoundedString(preset?.jumpstartPacks, fallback.jumpstartPacks, 300000),
        password: normalizeBoundedString(preset?.password, fallback.password, 80),
        skillLevel: normalizeEnumString(preset?.skillLevel, SKILL_LEVEL_VALUES, fallback.skillLevel),
        spectatorsAllowed: normalizeBoolean(preset?.spectatorsAllowed, fallback.spectatorsAllowed),
        rollbackTurnsAllowed: normalizeBoolean(preset?.rollbackTurnsAllowed, fallback.rollbackTurnsAllowed),
        rated: normalizeBoolean(preset?.rated, fallback.rated),
        quitRatio: Math.round(clampNumber(preset?.quitRatio, 0, 100, fallback.quitRatio)),
        minimumRating: Math.round(clampNumber(preset?.minimumRating, 0, 3000, fallback.minimumRating)),
        playerTypes: normalizeCreateTablePlayerTypes(preset?.playerTypes, fallback.playerTypes),
        playerSkills: normalizeCreateTournamentPlayerSkills(preset?.playerSkills, fallback.playerSkills),
        savedAt: Math.round(clampNumber(preset?.savedAt, 0, Number.MAX_SAFE_INTEGER, fallback.savedAt)),
    };
}
export function normalizeDeckEditorConfig(config) {
    const activeMode = normalizeEnumString(config?.activeMode, DECK_EDITOR_MODE_KEYS, DEFAULT_DECK_EDITOR_CONFIG.activeMode);
    const modes = {};
    const candidateModes = config?.modes && typeof config.modes === 'object'
        ? config.modes
        : {};
    for (const mode of DECK_EDITOR_MODE_KEYS) {
        modes[mode] = normalizeDeckEditorModeConfig(candidateModes[mode], DEFAULT_DECK_EDITOR_CONFIG.modes[mode]);
    }
    return {
        activeMode,
        modes,
    };
}
export function normalizePanelLayoutConfig(config) {
    const activities = {};
    const candidateActivities = config?.activities && typeof config.activities === 'object'
        ? config.activities
        : {};
    for (const kind of PANEL_LAYOUT_ACTIVITY_KINDS) {
        activities[kind] = normalizePanelLayoutActivityConfig(candidateActivities[kind], DEFAULT_PANEL_LAYOUT_CONFIG.activities[kind]);
    }
    return {
        game: {
            sidebarOpen: normalizeBoolean(config?.game?.sidebarOpen, DEFAULT_PANEL_LAYOUT_CONFIG.game.sidebarOpen),
        },
        activities,
    };
}
export function normalizeDeckGeneratorSettings(settings) {
    const commander = normalizeBoolean(settings?.commander, DEFAULT_DECK_GENERATOR_SETTINGS.commander);
    return {
        colors: normalizeDeckGeneratorColors(settings?.colors),
        randomColor: normalizeBoolean(settings?.randomColor, DEFAULT_DECK_GENERATOR_SETTINGS.randomColor),
        format: normalizeBoundedString(settings?.format, DEFAULT_DECK_GENERATOR_SETTINGS.format, 160),
        deckSize: normalizeDeckGeneratorDeckSize(settings?.deckSize),
        singleton: commander || normalizeBoolean(settings?.singleton, DEFAULT_DECK_GENERATOR_SETTINGS.singleton),
        includeArtifacts: normalizeBoolean(settings?.includeArtifacts, DEFAULT_DECK_GENERATOR_SETTINGS.includeArtifacts),
        includeNonBasicLands: normalizeBoolean(settings?.includeNonBasicLands, DEFAULT_DECK_GENERATOR_SETTINGS.includeNonBasicLands),
        includeColorless: normalizeBoolean(settings?.includeColorless, DEFAULT_DECK_GENERATOR_SETTINGS.includeColorless),
        commander,
        advanced: normalizeBoolean(settings?.advanced, DEFAULT_DECK_GENERATOR_SETTINGS.advanced),
        creaturePercentage: Math.round(clampNumber(settings?.creaturePercentage, 0, 100, DEFAULT_DECK_GENERATOR_SETTINGS.creaturePercentage)),
        nonCreaturePercentage: Math.round(clampNumber(settings?.nonCreaturePercentage, 0, 100, DEFAULT_DECK_GENERATOR_SETTINGS.nonCreaturePercentage)),
        landPercentage: Math.round(clampNumber(settings?.landPercentage, 0, 100, DEFAULT_DECK_GENERATOR_SETTINGS.landPercentage)),
        cmcProfile: normalizeEnumString(settings?.cmcProfile, DECK_GENERATOR_CMC_VALUES, DEFAULT_DECK_GENERATOR_SETTINGS.cmcProfile),
    };
}
export function normalizeDeckFileHistory(history) {
    return {
        lastImport: normalizeDeckFileHistoryEntry(history?.lastImport),
        lastExport: normalizeDeckFileHistoryEntry(history?.lastExport),
    };
}
function normalizeDeckEditorModeConfig(config, fallback) {
    return {
        collectionView: normalizeEnumString(config?.collectionView, DECK_COLLECTION_VIEW_VALUES, fallback.collectionView),
        collectionSortBy: normalizeEnumString(config?.collectionSortBy, DECK_COLLECTION_SORT_VALUES, fallback.collectionSortBy),
        collectionSortDirection: normalizeSortDirection(config?.collectionSortDirection, fallback.collectionSortDirection),
        deckSortBy: normalizeEnumString(config?.deckSortBy, DECK_LIST_SORT_VALUES, fallback.deckSortBy),
        deckSortDirection: normalizeSortDirection(config?.deckSortDirection, fallback.deckSortDirection),
        deckPanelWidth: Math.round(clampNumber(config?.deckPanelWidth, 280, 520, fallback.deckPanelWidth)),
        showSideboard: normalizeBoolean(config?.showSideboard, fallback.showSideboard),
        search: normalizeDeckSearchSettings(config?.search, fallback.search),
    };
}
function normalizePanelLayoutActivityConfig(config, fallback) {
    return {
        commandPanelCollapsed: normalizeBoolean(config?.commandPanelCollapsed, fallback.commandPanelCollapsed),
        chatCollapsed: normalizeBoolean(config?.chatCollapsed, fallback.chatCollapsed),
    };
}
function normalizeDeckFileHistoryEntry(value) {
    if (!value || typeof value !== 'object')
        return null;
    const entry = value;
    const fileName = normalizeBoundedString(entry.fileName, '', 180);
    const deckName = normalizeBoundedString(entry.deckName, '', 180);
    if (!fileName && !deckName)
        return null;
    return {
        fileName,
        deckName,
        updatedAt: Math.round(clampNumber(entry.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0)),
    };
}
export function normalizeDeckSearchSettings(settings, fallback = DEFAULT_DECK_SEARCH_SETTINGS) {
    const legacySearchText = normalizeBoundedString(settings?.nameContains, fallback.nameContains, 120);
    const searchText = normalizeBoundedString(settings?.searchText, legacySearchText || fallback.searchText, 120);
    const legacyRulesText = normalizeBoundedString(settings?.rulesContains, fallback.rulesContains, 240);
    return {
        searchText,
        nameContains: searchText,
        rulesContains: legacyRulesText,
        searchNames: normalizeBoolean(settings?.searchNames, fallback.searchNames),
        searchTypes: normalizeBoolean(settings?.searchTypes, fallback.searchTypes),
        searchRules: normalizeBoolean(settings?.searchRules, fallback.searchRules),
        colors: normalizeDeckSearchColors(settings?.colors),
        excludedColors: normalizeDeckSearchColors(settings?.excludedColors),
        colorMatch: normalizeEnumString(settings?.colorMatch, DECK_SEARCH_COLOR_MATCH_VALUES, fallback.colorMatch),
        types: normalizeStringList(settings?.types, CARD_TYPE_FILTER_VALUES, 12),
        excludedTypes: normalizeStringList(settings?.excludedTypes, CARD_TYPE_FILTER_VALUES, 12),
        rarities: normalizeStringList(settings?.rarities, RARITY_FILTER_VALUES, 8),
        excludedRarities: normalizeStringList(settings?.excludedRarities, RARITY_FILTER_VALUES, 8),
        setCodes: normalizeSetCodes(settings?.setCodes),
        format: normalizeBoundedString(settings?.format, fallback.format, 120),
        useDeckFormat: normalizeBoolean(settings?.useDeckFormat, fallback.useDeckFormat),
        pennyDreadful: normalizeBoolean(settings?.pennyDreadful, fallback.pennyDreadful),
        manaValue: normalizeNullableInteger(settings?.manaValue, 0, 20),
        manaValueOperator: normalizeEnumString(settings?.manaValueOperator, DECK_SEARCH_MANA_OPERATOR_VALUES, fallback.manaValueOperator),
        uniqueNames: normalizeBoolean(settings?.uniqueNames, fallback.uniqueNames),
        piles: normalizeBoolean(settings?.piles, fallback.piles),
    };
}
function normalizeColumnOrder(value) {
    if (!Array.isArray(value))
        return [...LOBBY_TABLE_COLUMN_KEYS];
    const knownKeys = new Set(LOBBY_TABLE_COLUMN_KEYS);
    const nextOrder = value.filter((key) => typeof key === 'string' && knownKeys.has(key));
    const uniqueOrder = [...new Set(nextOrder)];
    const missingKeys = LOBBY_TABLE_COLUMN_KEYS.filter(key => !uniqueOrder.includes(key));
    return [...uniqueOrder, ...missingKeys];
}
function normalizeColumnWidths(value) {
    const widths = { ...DEFAULT_LOBBY_COLUMN_WIDTHS };
    if (!value || typeof value !== 'object')
        return widths;
    const candidate = value;
    for (const key of LOBBY_TABLE_COLUMN_KEYS) {
        widths[key] = Math.round(clampNumber(candidate[key], 52, 360, DEFAULT_LOBBY_COLUMN_WIDTHS[key]));
    }
    return widths;
}
function normalizeLobbySort(value) {
    if (!value || typeof value !== 'object')
        return DEFAULT_LOBBY_CONFIG.tableLayout.sort;
    const sort = value;
    const key = typeof sort.key === 'string' && LOBBY_TABLE_COLUMN_KEYS.includes(sort.key)
        ? sort.key
        : DEFAULT_LOBBY_CONFIG.tableLayout.sort.key;
    const direction = sort.direction === 'asc' || sort.direction === 'desc'
        ? sort.direction
        : DEFAULT_LOBBY_CONFIG.tableLayout.sort.direction;
    return { key, direction };
}
function cloneLobbyConfig(config) {
    return {
        filters: { ...config.filters },
        selectedTableId: config.selectedTableId,
        tableLayout: {
            columnOrder: [...config.tableLayout.columnOrder],
            columnWidths: { ...config.tableLayout.columnWidths },
            sort: { ...config.tableLayout.sort },
        },
    };
}
function cloneCreateTablePresets(config) {
    return {
        lastUsed: cloneCreateTablePreset(config.lastUsed),
        config1: cloneCreateTablePreset(config.config1),
        config2: cloneCreateTablePreset(config.config2),
    };
}
function cloneCreateTournamentPresets(config) {
    return {
        lastUsed: cloneCreateTournamentPreset(config.lastUsed),
        config1: cloneCreateTournamentPreset(config.config1),
        config2: cloneCreateTournamentPreset(config.config2),
    };
}
function cloneCreateTablePreset(preset) {
    return preset
        ? {
            ...preset,
            perPlayerEmblemDeck: cloneDeckCardLists(preset.perPlayerEmblemDeck),
            startingPlayerEmblemDeck: cloneDeckCardLists(preset.startingPlayerEmblemDeck),
            playerTypes: [...preset.playerTypes],
            aiSeats: preset.aiSeats.map(cloneCreateTableAiSeat),
        }
        : null;
}
function cloneCreateTournamentPreset(preset) {
    return preset
        ? {
            ...preset,
            setCodes: [...preset.setCodes],
            randomSetCodes: [...preset.randomSetCodes],
            cubeFromDeck: cloneDeckCardLists(preset.cubeFromDeck),
            playerTypes: [...preset.playerTypes],
            playerSkills: [...preset.playerSkills],
        }
        : null;
}
function cloneDeckEditorConfig(config) {
    return {
        activeMode: config.activeMode,
        modes: {
            normal: cloneDeckEditorModeConfig(config.modes.normal),
            limited: cloneDeckEditorModeConfig(config.modes.limited),
            sideboard: cloneDeckEditorModeConfig(config.modes.sideboard),
            draft: cloneDeckEditorModeConfig(config.modes.draft),
        },
    };
}
function cloneDeckEditorModeConfig(config) {
    return {
        ...config,
        search: cloneDeckSearchSettings(config.search),
    };
}
function clonePanelLayoutConfig(config) {
    return {
        game: { ...config.game },
        activities: Object.fromEntries(PANEL_LAYOUT_ACTIVITY_KINDS.map(kind => [kind, { ...config.activities[kind] }])),
    };
}
function cloneDeckSearchSettings(settings) {
    return {
        ...settings,
        colors: { ...settings.colors },
        excludedColors: { ...settings.excludedColors },
        types: [...settings.types],
        excludedTypes: [...settings.excludedTypes],
        rarities: [...settings.rarities],
        excludedRarities: [...settings.excludedRarities],
        setCodes: [...settings.setCodes],
    };
}
function cloneDeckGeneratorSettings(settings) {
    return {
        ...settings,
        colors: [...settings.colors],
    };
}
function cloneDeckFileHistory(history) {
    return {
        lastImport: history.lastImport ? { ...history.lastImport } : null,
        lastExport: history.lastExport ? { ...history.lastExport } : null,
    };
}
function normalizeNullableCreateTablePreset(value) {
    if (!value || typeof value !== 'object')
        return null;
    return normalizeCreateTablePreset(value);
}
function normalizeNullableCreateTournamentPreset(value) {
    if (!value || typeof value !== 'object')
        return null;
    return normalizeCreateTournamentPreset(value);
}
function normalizeBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function normalizeNullableString(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed || null;
}
function normalizeSearchText(value) {
    if (typeof value !== 'string')
        return DEFAULT_LOBBY_FILTERS.searchText;
    return value.slice(0, 160);
}
function normalizeIgnoredUsersConfig(value) {
    if (!value || typeof value !== 'object')
        return { byServer: {} };
    const byServer = value.byServer;
    if (!byServer || typeof byServer !== 'object')
        return { byServer: {} };
    const normalizedByServer = {};
    for (const [serverUrl, users] of Object.entries(byServer)) {
        const serverKey = ignoredUsersServerKey(serverUrl);
        const normalizedUsers = normalizeIgnoredUserList(users);
        if (normalizedUsers.length > 0) {
            normalizedByServer[serverKey] = normalizedUsers;
        }
    }
    return { byServer: normalizedByServer };
}
function normalizeIgnoredUserList(value) {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    const normalizedUsers = [];
    for (const user of value) {
        if (typeof user !== 'string')
            continue;
        const normalizedUser = user.trim().slice(0, 80);
        const key = ignoredUserIdentity(normalizedUser);
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        normalizedUsers.push(normalizedUser);
        if (normalizedUsers.length >= MAX_IGNORED_USERS)
            break;
    }
    return normalizedUsers;
}
function ignoredUsersServerKey(serverUrl) {
    return normalizeServerUrl(serverUrl);
}
function ignoredUserIdentity(userName) {
    return userName.trim().toLowerCase();
}
function normalizeBoundedString(value, fallback, maxLength) {
    if (typeof value !== 'string')
        return fallback;
    return value.trim().slice(0, maxLength);
}
function normalizeImageLanguage(value) {
    if (typeof value !== 'string')
        return DEFAULT_CLIENT_SETTINGS.preferredImageLanguage;
    const normalized = value.trim().toLowerCase().replace(/[^a-z-]/g, '').slice(0, 8);
    return normalized || DEFAULT_CLIENT_SETTINGS.preferredImageLanguage;
}
function normalizeEnumString(value, allowedValues, fallback) {
    if (typeof value !== 'string')
        return fallback;
    return allowedValues.includes(value) ? value : fallback;
}
function normalizeProfanityFilterLevel(value, fallback) {
    return value === 0 || value === 1 || value === 2 ? value : fallback;
}
function normalizeUserSkipPrioritySteps(value) {
    if (!value || typeof value !== 'object') {
        return cloneUserSkipPrioritySteps(DEFAULT_USER_SKIP_PRIORITY_STEPS);
    }
    const steps = value;
    return {
        yourTurn: normalizeSkipPrioritySteps(steps.yourTurn, DEFAULT_USER_SKIP_PRIORITY_STEPS.yourTurn),
        opponentTurn: normalizeSkipPrioritySteps(steps.opponentTurn, DEFAULT_USER_SKIP_PRIORITY_STEPS.opponentTurn),
        stopOnDeclareAttackers: normalizeBoolean(steps.stopOnDeclareAttackers, DEFAULT_USER_SKIP_PRIORITY_STEPS.stopOnDeclareAttackers),
        stopOnDeclareBlockersWithZeroPermanents: normalizeBoolean(steps.stopOnDeclareBlockersWithZeroPermanents, DEFAULT_USER_SKIP_PRIORITY_STEPS.stopOnDeclareBlockersWithZeroPermanents),
        stopOnDeclareBlockersWithAnyPermanents: normalizeBoolean(steps.stopOnDeclareBlockersWithAnyPermanents, DEFAULT_USER_SKIP_PRIORITY_STEPS.stopOnDeclareBlockersWithAnyPermanents),
        stopOnAllMainPhases: normalizeBoolean(steps.stopOnAllMainPhases, DEFAULT_USER_SKIP_PRIORITY_STEPS.stopOnAllMainPhases),
        stopOnAllEndPhases: normalizeBoolean(steps.stopOnAllEndPhases, DEFAULT_USER_SKIP_PRIORITY_STEPS.stopOnAllEndPhases),
        stopOnStackNewObjects: normalizeBoolean(steps.stopOnStackNewObjects, DEFAULT_USER_SKIP_PRIORITY_STEPS.stopOnStackNewObjects),
    };
}
function normalizeSkipPrioritySteps(value, fallback) {
    if (!value || typeof value !== 'object')
        return { ...fallback };
    const steps = value;
    return {
        upkeep: normalizeBoolean(steps.upkeep, fallback.upkeep),
        draw: normalizeBoolean(steps.draw, fallback.draw),
        main1: normalizeBoolean(steps.main1, fallback.main1),
        beforeCombat: normalizeBoolean(steps.beforeCombat, fallback.beforeCombat),
        endOfCombat: normalizeBoolean(steps.endOfCombat, fallback.endOfCombat),
        main2: normalizeBoolean(steps.main2, fallback.main2),
        endOfTurn: normalizeBoolean(steps.endOfTurn, fallback.endOfTurn),
    };
}
function normalizeKeybinds(value) {
    const result = cloneKeybinds(DEFAULT_KEYBINDS);
    if (!value || typeof value !== 'object')
        return result;
    const keybinds = value;
    for (const actionId of KEYBIND_ACTION_IDS) {
        const candidate = keybinds[actionId];
        if (!candidate || typeof candidate !== 'object')
            continue;
        result[actionId] = normalizeKeybindConfig(candidate, DEFAULT_KEYBINDS[actionId]);
    }
    return result;
}
function normalizeKeybindConfig(value, fallback) {
    return {
        key: normalizeBoundedString(value.key, fallback.key, 24) || fallback.key,
        eventType: normalizeEnumString(value.eventType, KEYBIND_EVENT_TYPE_VALUES, fallback.eventType),
        ctrlOrMeta: normalizeBoolean(value.ctrlOrMeta, fallback.ctrlOrMeta),
        altKey: normalizeBoolean(value.altKey, fallback.altKey),
        shiftKey: normalizeBoolean(value.shiftKey, fallback.shiftKey),
        enabled: normalizeBoolean(value.enabled, fallback.enabled),
    };
}
function cloneKeybinds(keybinds) {
    return Object.fromEntries(KEYBIND_ACTION_IDS.map(actionId => [actionId, { ...keybinds[actionId] }]));
}
function normalizeBackgroundValue(value) {
    if (typeof value !== 'string')
        return '';
    const trimmed = value.trim();
    if (!trimmed)
        return '';
    if (/^(https?:|data:image\/)/i.test(trimmed))
        return trimmed.slice(0, 1200);
    return '';
}
function normalizeSortDirection(value, fallback) {
    return value === 'asc' || value === 'desc' ? value : fallback;
}
function normalizeDeckSearchColors(value) {
    const colors = { ...DEFAULT_DECK_SEARCH_COLORS };
    if (!value || typeof value !== 'object')
        return colors;
    const record = value;
    for (const color of DECK_SEARCH_COLOR_VALUES) {
        colors[color] = normalizeBoolean(record[color], DEFAULT_DECK_SEARCH_COLORS[color]);
    }
    return colors;
}
function normalizeStringList(value, allowedValues, maxItems) {
    if (!Array.isArray(value))
        return [];
    const allowed = new Set(allowedValues);
    const normalizedValues = value
        .filter((item) => typeof item === 'string' && allowed.has(item))
        .slice(0, maxItems);
    return [...new Set(normalizedValues)];
}
function normalizeSetCodes(value) {
    if (!Array.isArray(value))
        return [];
    const normalizedValues = value
        .filter((item) => typeof item === 'string')
        .map(item => item.trim().toUpperCase())
        .filter(item => /^[A-Z0-9]{2,8}$/.test(item))
        .slice(0, 12);
    return [...new Set(normalizedValues)];
}
function normalizeFreeSetCodes(value, maxItems) {
    if (!Array.isArray(value))
        return [];
    const normalizedValues = value
        .filter((item) => typeof item === 'string')
        .map(item => item.trim().toUpperCase())
        .filter(item => /^[A-Z0-9]{2,12}$/.test(item))
        .slice(0, maxItems);
    return [...new Set(normalizedValues)];
}
function normalizeNullableInteger(value, min, max) {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value !== 'number' || Number.isNaN(value))
        return null;
    return Math.round(clampNumber(value, min, max, min));
}
function normalizeDeckGeneratorColors(value) {
    if (!Array.isArray(value))
        return [...DEFAULT_DECK_GENERATOR_SETTINGS.colors];
    const knownColors = new Set(DECK_GENERATOR_COLOR_VALUES);
    const colors = value
        .filter((color) => typeof color === 'string' && knownColors.has(color));
    const uniqueColors = [...new Set(colors)];
    return uniqueColors.length > 0 ? uniqueColors : [...DEFAULT_DECK_GENERATOR_SETTINGS.colors];
}
function normalizeDeckGeneratorDeckSize(value) {
    return DECK_GENERATOR_DECK_SIZE_VALUES.includes(value)
        ? value
        : DEFAULT_DECK_GENERATOR_SETTINGS.deckSize;
}
function normalizeCreateTablePlayerTypes(value, fallback) {
    if (!Array.isArray(value))
        return [...fallback];
    const playerTypes = value
        .filter((playerType) => typeof playerType === 'string' && Boolean(playerType.trim()))
        .map(playerType => playerType.trim().slice(0, 80))
        .slice(0, 10);
    return playerTypes.length > 0 ? playerTypes : [...fallback];
}
function normalizeCreateTournamentPlayerSkills(value, fallback) {
    if (!Array.isArray(value))
        return [...fallback];
    const playerSkills = value
        .filter((skill) => typeof skill === 'number' && Number.isFinite(skill))
        .map(skill => Math.round(clampNumber(skill, 1, 10, 2)))
        .slice(0, 64);
    return playerSkills.length > 0 ? playerSkills : [...fallback];
}
function normalizeCreateTableAiSeats(value, fallback) {
    if (!Array.isArray(value))
        return fallback.map(cloneCreateTableAiSeat);
    return value
        .map((item, index) => normalizeCreateTableAiSeat(item, index))
        .filter((item) => item !== null)
        .slice(0, 10);
}
function cloneCreateTableAiSeat(seat) {
    return {
        name: seat.name,
        skill: seat.skill,
        deck: cloneDeckCardLists(seat.deck),
    };
}
function normalizeCreateTableAiSeat(value, index) {
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    const fallbackName = `Computer ${index + 1}`;
    return {
        name: normalizeBoundedString(record.name, fallbackName, 80) || fallbackName,
        skill: Math.round(clampNumber(record.skill, 1, 10, 2)),
        deck: normalizeDeckCardLists(record.deck),
    };
}
function normalizeDeckCardLists(value) {
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    const cards = normalizeDeckCards(record.cards, 500);
    const sideboard = normalizeDeckCards(record.sideboard, 200);
    if (cards.length === 0 && sideboard.length === 0)
        return null;
    const deck = {
        name: normalizeBoundedString(record.name, 'AI Deck', 120),
        cards,
        sideboard,
    };
    const format = normalizeNullableString(record.format);
    if (format)
        deck.format = format.slice(0, 160);
    return deck;
}
function normalizeDeckCards(value, maxCards) {
    if (!Array.isArray(value))
        return [];
    return value
        .map(normalizeDeckCard)
        .filter((card) => card !== null)
        .slice(0, maxCards);
}
function normalizeDeckCard(value) {
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    const cardName = normalizeBoundedString(record.cardName, '', 160);
    if (!cardName)
        return null;
    return {
        amount: Math.round(clampNumber(record.amount, 1, 999, 1)),
        cardName,
        setCode: normalizeNullableString(record.setCode)?.slice(0, 32) ?? null,
        cardNumber: normalizeNullableString(record.cardNumber)?.slice(0, 32) ?? null,
    };
}
function cloneDeckCardLists(deck) {
    return deck ? normalizeDeckCardLists(deck) : null;
}
const MATCH_TIME_LIMIT_VALUES = [
    'NONE',
    'MIN___5',
    'MIN__10',
    'MIN__15',
    'MIN__20',
    'MIN__25',
    'MIN__30',
    'MIN__35',
    'MIN__40',
    'MIN__45',
    'MIN__50',
    'MIN__55',
    'MIN__60',
    'MIN__90',
    'MIN_120',
];
const MATCH_BUFFER_TIME_VALUES = [
    'NONE',
    'SEC__01',
    'SEC__02',
    'SEC__03',
    'SEC__05',
    'SEC__10',
    'SEC__15',
    'SEC__20',
    'SEC__25',
    'SEC__30',
];
const DRAFT_TIMING_VALUES = ['BEGINNER', 'REGULAR', 'PROFESSIONAL', 'NONE'];
const MULLIGAN_TYPE_VALUES = [
    'GAME_DEFAULT',
    'VANCOUVER',
    'PARIS',
    'LONDON',
    'SMOOTHED_LONDON',
    'CANADIAN_HIGHLANDER',
];
const SKILL_LEVEL_VALUES = ['BEGINNER', 'CASUAL', 'SERIOUS'];
const RANGE_VALUES = ['ONE', 'TWO', 'ALL'];
const ATTACK_OPTION_VALUES = ['MULTIPLE', 'LEFT', 'RIGHT'];
const CARD_IMAGE_FALLBACK_MODE_VALUES = ['card-back', 'text-card'];
const CARD_RENDERING_MODE_VALUES = ['image', 'hybrid', 'text-only'];
const CLIENT_THEME_VALUES = ['arena', 'java-dark', 'java-light'];
const BATTLEFIELD_BACKGROUND_MODE_VALUES = ['default', 'custom', 'random'];
const KEYBIND_EVENT_TYPE_VALUES = ['keydown', 'keyup'];
const DECK_COLLECTION_VIEW_VALUES = ['grid', 'list'];
const DECK_COLLECTION_SORT_VALUES = ['name', 'cardType', 'manaValue', 'color', 'rarity', 'cardNumber'];
const DECK_LIST_SORT_VALUES = ['custom', 'name', 'amount', 'set'];
const DECK_SEARCH_COLOR_VALUES = ['white', 'blue', 'black', 'red', 'green', 'colorless'];
const DECK_SEARCH_COLOR_MATCH_VALUES = ['any', 'include', 'exact'];
const DECK_SEARCH_MANA_OPERATOR_VALUES = ['eq', 'lte', 'gte'];
const CARD_TYPE_FILTER_VALUES = ['ARTIFACT', 'CREATURE', 'ENCHANTMENT', 'INSTANT', 'LAND', 'PLANESWALKER', 'SORCERY', 'TRIBAL', 'CONSPIRACY', 'DUNGEON', 'BATTLE'];
const RARITY_FILTER_VALUES = ['LAND', 'COMMON', 'UNCOMMON', 'RARE', 'MYTHIC', 'SPECIAL', 'BONUS'];
const DECK_GENERATOR_COLOR_VALUES = ['white', 'blue', 'black', 'red', 'green'];
const DECK_GENERATOR_CMC_VALUES = ['Low', 'Default', 'High'];
const DECK_GENERATOR_DECK_SIZE_VALUES = [40, 60, 100];
export const appConfigService = new AppConfigService();
