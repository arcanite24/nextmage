import { LOBBY_TABLE_COLUMN_KEYS, } from './LobbyTableRowsService.js';
import { normalizeServerUrl } from './ConnectionProfileService.js';
const SETTINGS_KEY = 'mage.client.settings.v1';
const LOBBY_CONFIG_KEY = 'mage.client.lobby.v1';
const CREATE_TABLE_PRESETS_KEY = 'mage.client.createTablePresets.v1';
const DECK_EDITOR_CONFIG_KEY = 'mage.client.deckEditor.v1';
const DECK_GENERATOR_SETTINGS_KEY = 'mage.client.deckGenerator.v1';
const DECK_FILE_HISTORY_KEY = 'mage.client.deckFileHistory.v1';
const IGNORED_USERS_KEY = 'mage.client.ignoredUsers.v1';
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
export const DEFAULT_CLIENT_SETTINGS = {
    animationsEnabled: true,
    animationSpeed: 1,
    preloadMatchImages: false,
    autoTapManaPayment: true,
    manaPoolAutomaticRestricted: true,
    useFirstManaAbility: false,
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
    matchSeatOrientation: 'table',
    alwaysShowPlayerNames: true,
    showCardReminderText: true,
    showCardSetInfo: true,
    showCardHints: true,
    cardImageFallbackMode: 'card-back',
    imageCacheMaxAgeDays: 30,
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
export const DECK_EDITOR_MODE_KEYS = ['normal', 'limited', 'sideboard', 'draft'];
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
            return DEFAULT_CLIENT_SETTINGS;
        }
        try {
            const raw = this.storage.getItem(SETTINGS_KEY);
            if (!raw)
                return DEFAULT_CLIENT_SETTINGS;
            const parsed = JSON.parse(raw);
            return this.normalizeSettings(parsed);
        }
        catch (error) {
            console.warn('[AppConfig] Failed to load settings, using defaults', error);
            return DEFAULT_CLIENT_SETTINGS;
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
        return DEFAULT_CLIENT_SETTINGS;
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
        battlefieldGrouping,
        matchSeatOrientation,
        alwaysShowPlayerNames: normalizeBoolean(settings.alwaysShowPlayerNames, DEFAULT_CLIENT_SETTINGS.alwaysShowPlayerNames),
        showCardReminderText: normalizeBoolean(settings.showCardReminderText, DEFAULT_CLIENT_SETTINGS.showCardReminderText),
        showCardSetInfo: normalizeBoolean(settings.showCardSetInfo, DEFAULT_CLIENT_SETTINGS.showCardSetInfo),
        showCardHints: normalizeBoolean(settings.showCardHints, DEFAULT_CLIENT_SETTINGS.showCardHints),
        cardImageFallbackMode: normalizeEnumString(settings.cardImageFallbackMode, CARD_IMAGE_FALLBACK_MODE_VALUES, DEFAULT_CLIENT_SETTINGS.cardImageFallbackMode),
        animationSpeed: clampNumber(settings.animationSpeed, 0.5, 2, DEFAULT_CLIENT_SETTINGS.animationSpeed),
        imageCacheMaxAgeDays: clampNumber(settings.imageCacheMaxAgeDays, 1, 365, DEFAULT_CLIENT_SETTINGS.imageCacheMaxAgeDays),
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
        userSkipPrioritySteps: cloneUserSkipPrioritySteps(DEFAULT_USER_SKIP_PRIORITY_STEPS),
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
function normalizeEnumString(value, allowedValues, fallback) {
    if (typeof value !== 'string')
        return fallback;
    return allowedValues.includes(value) ? value : fallback;
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
