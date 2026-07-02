import type { DeckCardInfo, DeckCardLists, SkipPrioritySteps, UserData, UserSkipPrioritySteps } from '../types/index.js';
import {
  LOBBY_TABLE_COLUMN_KEYS,
  type LobbyRowSort,
  type LobbyRowSortKey,
} from './LobbyTableRowsService.js';
import { normalizeServerUrl } from './ConnectionProfileService.js';

export type BattlefieldGrouping = 'separate' | 'nonlands' | 'creature-land-other';
export type MatchSeatOrientation = 'table' | 'reverse' | 'active-first';
export type CardImageFallbackMode = 'card-back' | 'text-card';

export interface ClientSettings {
  animationsEnabled: boolean;
  animationSpeed: number;
  preloadMatchImages: boolean;
  autoTapManaPayment: boolean;
  manaPoolAutomaticRestricted: boolean;
  useFirstManaAbility: boolean;
  avatarId: number;
  flagName: string;
  allowRequestShowHandCards: boolean;
  confirmEmptyManaPool: boolean;
  askMoveToGraveOrder: boolean;
  passPriorityCast: boolean;
  passPriorityActivation: boolean;
  autoOrderTrigger: boolean;
  autoTargetLevel: number;
  useSameSettingsForReplacementEffects: boolean;
  battlefieldGrouping: BattlefieldGrouping;
  matchSeatOrientation: MatchSeatOrientation;
  alwaysShowPlayerNames: boolean;
  showCardReminderText: boolean;
  showCardSetInfo: boolean;
  showCardHints: boolean;
  cardImageFallbackMode: CardImageFallbackMode;
  imageCacheMaxAgeDays: number;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const SETTINGS_KEY = 'mage.client.settings.v1';
const LOBBY_CONFIG_KEY = 'mage.client.lobby.v1';
const CREATE_TABLE_PRESETS_KEY = 'mage.client.createTablePresets.v1';
const DECK_EDITOR_CONFIG_KEY = 'mage.client.deckEditor.v1';
const DECK_GENERATOR_SETTINGS_KEY = 'mage.client.deckGenerator.v1';
const DECK_FILE_HISTORY_KEY = 'mage.client.deckFileHistory.v1';
const IGNORED_USERS_KEY = 'mage.client.ignoredUsers.v1';

export const MAX_IGNORED_USERS = 500;

export interface LobbyFiltersConfig {
  showWaiting: boolean;
  showStarting: boolean;
  showDueling: boolean;
  showFinished: boolean;
  gameType: string | null;
  deckType: string | null;
  showPassworded: boolean;
  showUnrated: boolean;
  searchText: string;
}

export interface LobbyTableLayoutConfig {
  columnOrder: LobbyRowSortKey[];
  columnWidths: Record<LobbyRowSortKey, number>;
  sort: LobbyRowSort;
}

export interface LobbyConfig {
  filters: LobbyFiltersConfig;
  selectedTableId: string | null;
  tableLayout: LobbyTableLayoutConfig;
}

export interface PartialLobbyConfig {
  filters?: Partial<LobbyFiltersConfig>;
  selectedTableId?: unknown;
  tableLayout?: Partial<LobbyTableLayoutConfig>;
}

export type CreateTablePresetSlot = 'lastUsed' | 'config1' | 'config2';
export type CreateTableLoadPresetSlot = CreateTablePresetSlot | 'default';

export interface CreateTablePresetConfig {
  name: string;
  gameType: string;
  deckType: string;
  winsNeeded: number;
  freeMulligans: number;
  timeLimit: string;
  bufferTime: string;
  mulliganType: string;
  password: string;
  skillLevel: string;
  spectatorsAllowed: boolean;
  rollbackTurnsAllowed: boolean;
  planeChase: boolean;
  emblemCardsEnabled: boolean;
  perPlayerEmblemDeck: DeckCardLists | null;
  startingPlayerEmblemDeck: DeckCardLists | null;
  customStartLifeEnabled: boolean;
  customStartLife: number;
  customStartHandSizeEnabled: boolean;
  customStartHandSize: number;
  rated: boolean;
  quitRatio: number;
  minimumRating: number;
  edhPowerLevel: number;
  range: string;
  attackOption: string;
  numberOfPlayers: number;
  playerTypes: string[];
  aiSeats: CreateTableAiSeatPresetConfig[];
  savedAt: number;
}

export interface CreateTableAiSeatPresetConfig {
  name: string;
  skill: number;
  deck: DeckCardLists | null;
}

export interface CreateTablePresetsConfig {
  lastUsed: CreateTablePresetConfig | null;
  config1: CreateTablePresetConfig | null;
  config2: CreateTablePresetConfig | null;
}

export type PartialCreateTablePresetConfig = Partial<CreateTablePresetConfig>;
export type PartialCreateTablePresetsConfig = Partial<Record<CreateTablePresetSlot, unknown>>;

export type DeckEditorModeKey = 'normal' | 'limited' | 'sideboard' | 'draft';
export type DeckCollectionViewMode = 'grid' | 'list';
export type DeckCollectionSortKey = 'name' | 'cardType' | 'manaValue' | 'color' | 'rarity' | 'cardNumber';
export type DeckListSortKey = 'custom' | 'name' | 'amount' | 'set';
export type DeckSortDirection = 'asc' | 'desc';
export type DeckSearchColorMode = 'any' | 'include' | 'exact';
export type DeckSearchManaOperator = 'eq' | 'lte' | 'gte';
export type DeckGeneratorColorKey = 'white' | 'blue' | 'black' | 'red' | 'green';
export type DeckGeneratorCmcProfile = 'Low' | 'Default' | 'High';
export type DeckGeneratorDeckSize = 40 | 60 | 100;

export interface DeckSearchColors {
  white: boolean;
  blue: boolean;
  black: boolean;
  red: boolean;
  green: boolean;
  colorless: boolean;
}

export interface DeckSearchSettings {
  searchText: string;
  nameContains: string;
  rulesContains: string;
  searchNames: boolean;
  searchTypes: boolean;
  searchRules: boolean;
  colors: DeckSearchColors;
  excludedColors: DeckSearchColors;
  colorMatch: DeckSearchColorMode;
  types: string[];
  excludedTypes: string[];
  rarities: string[];
  excludedRarities: string[];
  setCodes: string[];
  format: string;
  useDeckFormat: boolean;
  pennyDreadful: boolean;
  manaValue: number | null;
  manaValueOperator: DeckSearchManaOperator;
  uniqueNames: boolean;
  piles: boolean;
}

export interface DeckEditorModeConfig {
  collectionView: DeckCollectionViewMode;
  collectionSortBy: DeckCollectionSortKey;
  collectionSortDirection: DeckSortDirection;
  deckSortBy: DeckListSortKey;
  deckSortDirection: DeckSortDirection;
  deckPanelWidth: number;
  showSideboard: boolean;
  search: DeckSearchSettings;
}

export interface DeckEditorConfig {
  activeMode: DeckEditorModeKey;
  modes: Record<DeckEditorModeKey, DeckEditorModeConfig>;
}

export interface DeckGeneratorSettings {
  colors: DeckGeneratorColorKey[];
  randomColor: boolean;
  format: string;
  deckSize: DeckGeneratorDeckSize;
  singleton: boolean;
  includeArtifacts: boolean;
  includeNonBasicLands: boolean;
  includeColorless: boolean;
  commander: boolean;
  advanced: boolean;
  creaturePercentage: number;
  nonCreaturePercentage: number;
  landPercentage: number;
  cmcProfile: DeckGeneratorCmcProfile;
}

export interface DeckFileHistoryEntry {
  fileName: string;
  deckName: string;
  updatedAt: number;
}

export interface DeckFileHistoryConfig {
  lastImport: DeckFileHistoryEntry | null;
  lastExport: DeckFileHistoryEntry | null;
}

export type PartialDeckSearchSettings = Partial<Omit<DeckSearchSettings, 'colors' | 'excludedColors'>> & {
  colors?: Partial<DeckSearchColors>;
  excludedColors?: Partial<DeckSearchColors>;
};

export type PartialDeckEditorModeConfig = Partial<Omit<DeckEditorModeConfig, 'search'>> & {
  search?: PartialDeckSearchSettings;
};

export type PartialDeckEditorConfig = Partial<{
  activeMode: unknown;
  modes: Partial<Record<DeckEditorModeKey, PartialDeckEditorModeConfig>>;
}>;

export type PartialDeckGeneratorSettings = Partial<Record<keyof DeckGeneratorSettings, unknown>>;
export type PartialDeckFileHistoryConfig = Partial<Record<keyof DeckFileHistoryConfig, unknown>>;
export type PartialDeckFileHistoryEntry = Partial<Record<keyof DeckFileHistoryEntry, unknown>>;

export interface IgnoredUsersConfig {
  byServer: Record<string, string[]>;
}

export const DEFAULT_SKIP_PRIORITY_STEPS: SkipPrioritySteps = {
  upkeep: false,
  draw: false,
  main1: true,
  beforeCombat: false,
  endOfCombat: false,
  main2: true,
  endOfTurn: false,
};

export const DEFAULT_USER_SKIP_PRIORITY_STEPS: UserSkipPrioritySteps = {
  yourTurn: DEFAULT_SKIP_PRIORITY_STEPS,
  opponentTurn: { ...DEFAULT_SKIP_PRIORITY_STEPS, main1: false, main2: false },
  stopOnDeclareAttackers: true,
  stopOnDeclareBlockersWithZeroPermanents: false,
  stopOnDeclareBlockersWithAnyPermanents: true,
  stopOnAllMainPhases: true,
  stopOnAllEndPhases: true,
  stopOnStackNewObjects: true,
};

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
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

export const DEFAULT_LOBBY_FILTERS: LobbyFiltersConfig = {
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

export const DEFAULT_LOBBY_COLUMN_WIDTHS: Record<LobbyRowSortKey, number> = {
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

export const DEFAULT_LOBBY_CONFIG: LobbyConfig = {
  filters: DEFAULT_LOBBY_FILTERS,
  selectedTableId: null,
  tableLayout: {
    columnOrder: [...LOBBY_TABLE_COLUMN_KEYS],
    columnWidths: DEFAULT_LOBBY_COLUMN_WIDTHS,
    sort: { key: 'created', direction: 'desc' },
  },
};

export const DEFAULT_CREATE_TABLE_PRESETS: CreateTablePresetsConfig = {
  lastUsed: null,
  config1: null,
  config2: null,
};

export const DECK_EDITOR_MODE_KEYS: readonly DeckEditorModeKey[] = ['normal', 'limited', 'sideboard', 'draft'] as const;

export const DEFAULT_DECK_SEARCH_COLORS: DeckSearchColors = {
  white: false,
  blue: false,
  black: false,
  red: false,
  green: false,
  colorless: false,
};

export const DEFAULT_DECK_SEARCH_SETTINGS: DeckSearchSettings = {
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

export const DEFAULT_DECK_EDITOR_MODE_CONFIG: DeckEditorModeConfig = {
  collectionView: 'grid',
  collectionSortBy: 'name',
  collectionSortDirection: 'asc',
  deckSortBy: 'custom',
  deckSortDirection: 'asc',
  deckPanelWidth: 320,
  showSideboard: true,
  search: DEFAULT_DECK_SEARCH_SETTINGS,
};

export const DEFAULT_DECK_EDITOR_CONFIG: DeckEditorConfig = {
  activeMode: 'normal',
  modes: {
    normal: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
    limited: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
    sideboard: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
    draft: { ...DEFAULT_DECK_EDITOR_MODE_CONFIG },
  },
};

export const DEFAULT_DECK_GENERATOR_SETTINGS: DeckGeneratorSettings = {
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

export const DEFAULT_DECK_FILE_HISTORY: DeckFileHistoryConfig = {
  lastImport: null,
  lastExport: null,
};

export const DEFAULT_CREATE_TABLE_PRESET: CreateTablePresetConfig = {
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

const browserStorage: StorageAdapter = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

export class AppConfigService {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter = browserStorage) {
    this.storage = storage;
  }

  loadSettings(): ClientSettings {
    if (!this.canUseStorage()) {
      return DEFAULT_CLIENT_SETTINGS;
    }

    try {
      const raw = this.storage.getItem(SETTINGS_KEY);
      if (!raw) return DEFAULT_CLIENT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<ClientSettings>;
      return this.normalizeSettings(parsed);
    } catch (error) {
      console.warn('[AppConfig] Failed to load settings, using defaults', error);
      return DEFAULT_CLIENT_SETTINGS;
    }
  }

  saveSettings(settings: ClientSettings): void {
    if (!this.canUseStorage()) return;
    this.storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeClientSettings(settings)));
  }

  resetSettings(): ClientSettings {
    if (this.canUseStorage()) {
      this.storage.removeItem(SETTINGS_KEY);
    }
    return DEFAULT_CLIENT_SETTINGS;
  }

  loadLobbyConfig(): LobbyConfig {
    if (!this.canUseStorage()) {
      return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
    }

    try {
      const raw = this.storage.getItem(LOBBY_CONFIG_KEY);
      if (!raw) return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
      const parsed = JSON.parse(raw) as Partial<LobbyConfig>;
      return normalizeLobbyConfig(parsed);
    } catch (error) {
      console.warn('[AppConfig] Failed to load lobby config, using defaults', error);
      return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
    }
  }

  saveLobbyConfig(config: PartialLobbyConfig): void {
    if (!this.canUseStorage()) return;
    this.storage.setItem(LOBBY_CONFIG_KEY, JSON.stringify(normalizeLobbyConfig(config)));
  }

  resetLobbyConfig(): LobbyConfig {
    if (this.canUseStorage()) {
      this.storage.removeItem(LOBBY_CONFIG_KEY);
    }
    return cloneLobbyConfig(DEFAULT_LOBBY_CONFIG);
  }

  loadCreateTablePresets(): CreateTablePresetsConfig {
    if (!this.canUseStorage()) {
      return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
    }

    try {
      const raw = this.storage.getItem(CREATE_TABLE_PRESETS_KEY);
      if (!raw) return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
      const parsed = JSON.parse(raw) as PartialCreateTablePresetsConfig;
      return normalizeCreateTablePresets(parsed);
    } catch (error) {
      console.warn('[AppConfig] Failed to load create table presets, using defaults', error);
      return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
    }
  }

  saveCreateTablePreset(slot: CreateTablePresetSlot, preset: PartialCreateTablePresetConfig): CreateTablePresetsConfig {
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

  resetCreateTablePresets(): CreateTablePresetsConfig {
    if (this.canUseStorage()) {
      this.storage.removeItem(CREATE_TABLE_PRESETS_KEY);
    }
    return cloneCreateTablePresets(DEFAULT_CREATE_TABLE_PRESETS);
  }

  loadDeckEditorConfig(): DeckEditorConfig {
    if (!this.canUseStorage()) {
      return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
    }

    try {
      const raw = this.storage.getItem(DECK_EDITOR_CONFIG_KEY);
      if (!raw) return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
      return normalizeDeckEditorConfig(JSON.parse(raw) as PartialDeckEditorConfig);
    } catch (error) {
      console.warn('[AppConfig] Failed to load deck editor config, using defaults', error);
      return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
    }
  }

  saveDeckEditorConfig(config: PartialDeckEditorConfig): DeckEditorConfig {
    const normalized = normalizeDeckEditorConfig(config);

    if (this.canUseStorage()) {
      this.storage.setItem(DECK_EDITOR_CONFIG_KEY, JSON.stringify(normalized));
    }

    return cloneDeckEditorConfig(normalized);
  }

  resetDeckEditorConfig(): DeckEditorConfig {
    if (this.canUseStorage()) {
      this.storage.removeItem(DECK_EDITOR_CONFIG_KEY);
    }
    return cloneDeckEditorConfig(DEFAULT_DECK_EDITOR_CONFIG);
  }

  loadDeckGeneratorSettings(): DeckGeneratorSettings {
    if (!this.canUseStorage()) {
      return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
    }

    try {
      const raw = this.storage.getItem(DECK_GENERATOR_SETTINGS_KEY);
      if (!raw) return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
      return normalizeDeckGeneratorSettings(JSON.parse(raw) as PartialDeckGeneratorSettings);
    } catch (error) {
      console.warn('[AppConfig] Failed to load deck generator settings, using defaults', error);
      return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
    }
  }

  saveDeckGeneratorSettings(settings: PartialDeckGeneratorSettings): DeckGeneratorSettings {
    const normalized = normalizeDeckGeneratorSettings(settings);

    if (this.canUseStorage()) {
      this.storage.setItem(DECK_GENERATOR_SETTINGS_KEY, JSON.stringify(normalized));
    }

    return cloneDeckGeneratorSettings(normalized);
  }

  resetDeckGeneratorSettings(): DeckGeneratorSettings {
    if (this.canUseStorage()) {
      this.storage.removeItem(DECK_GENERATOR_SETTINGS_KEY);
    }
    return cloneDeckGeneratorSettings(DEFAULT_DECK_GENERATOR_SETTINGS);
  }

  loadDeckFileHistory(): DeckFileHistoryConfig {
    if (!this.canUseStorage()) {
      return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
    }

    try {
      const raw = this.storage.getItem(DECK_FILE_HISTORY_KEY);
      if (!raw) return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
      return normalizeDeckFileHistory(JSON.parse(raw) as PartialDeckFileHistoryConfig);
    } catch (error) {
      console.warn('[AppConfig] Failed to load deck file history, using defaults', error);
      return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
    }
  }

  saveDeckFileHistory(history: PartialDeckFileHistoryConfig): DeckFileHistoryConfig {
    const normalized = normalizeDeckFileHistory(history);

    if (this.canUseStorage()) {
      this.storage.setItem(DECK_FILE_HISTORY_KEY, JSON.stringify(normalized));
    }

    return cloneDeckFileHistory(normalized);
  }

  rememberDeckImportFile(fileName: string, deckName: string): DeckFileHistoryConfig {
    return this.saveDeckFileHistory({
      ...this.loadDeckFileHistory(),
      lastImport: {
        fileName,
        deckName,
        updatedAt: Date.now(),
      },
    });
  }

  rememberDeckExportFile(fileName: string, deckName: string): DeckFileHistoryConfig {
    return this.saveDeckFileHistory({
      ...this.loadDeckFileHistory(),
      lastExport: {
        fileName,
        deckName,
        updatedAt: Date.now(),
      },
    });
  }

  resetDeckFileHistory(): DeckFileHistoryConfig {
    if (this.canUseStorage()) {
      this.storage.removeItem(DECK_FILE_HISTORY_KEY);
    }
    return cloneDeckFileHistory(DEFAULT_DECK_FILE_HISTORY);
  }

  loadIgnoredUsers(serverUrl: string): string[] {
    const config = this.loadIgnoredUsersConfig();
    return [...(config.byServer[ignoredUsersServerKey(serverUrl)] ?? [])];
  }

  saveIgnoredUsers(serverUrl: string, users: unknown[]): string[] {
    const config = this.loadIgnoredUsersConfig();
    const serverKey = ignoredUsersServerKey(serverUrl);
    const normalizedUsers = normalizeIgnoredUserList(users);

    if (normalizedUsers.length > 0) {
      config.byServer[serverKey] = normalizedUsers;
    } else {
      delete config.byServer[serverKey];
    }

    if (this.canUseStorage()) {
      this.storage.setItem(IGNORED_USERS_KEY, JSON.stringify(config));
    }

    return [...normalizedUsers];
  }

  addIgnoredUser(serverUrl: string, userName: string): string[] {
    return this.saveIgnoredUsers(serverUrl, [
      ...this.loadIgnoredUsers(serverUrl),
      userName,
    ]);
  }

  removeIgnoredUser(serverUrl: string, userName: string): string[] {
    const targetKey = ignoredUserIdentity(userName);
    const nextUsers = this.loadIgnoredUsers(serverUrl).filter(user => ignoredUserIdentity(user) !== targetKey);
    return this.saveIgnoredUsers(serverUrl, nextUsers);
  }

  isUserIgnored(serverUrl: string, userName: string): boolean {
    const targetKey = ignoredUserIdentity(userName);
    if (!targetKey) return false;
    return this.loadIgnoredUsers(serverUrl).some(user => ignoredUserIdentity(user) === targetKey);
  }

  private normalizeSettings(settings: Partial<ClientSettings>): ClientSettings {
    return normalizeClientSettings(settings);
  }

  private loadIgnoredUsersConfig(): IgnoredUsersConfig {
    if (!this.canUseStorage()) {
      return { byServer: {} };
    }

    try {
      const raw = this.storage.getItem(IGNORED_USERS_KEY);
      if (!raw) return { byServer: {} };
      return normalizeIgnoredUsersConfig(JSON.parse(raw));
    } catch (error) {
      console.warn('[AppConfig] Failed to load ignored users, using empty list', error);
      return { byServer: {} };
    }
  }

  private canUseStorage(): boolean {
    return typeof window !== 'undefined' || this.storage !== browserStorage;
  }
}

export function normalizeClientSettings(settings: Partial<ClientSettings>): ClientSettings {
  const groupingValues: BattlefieldGrouping[] = ['separate', 'nonlands', 'creature-land-other'];
  const battlefieldGrouping = groupingValues.includes(settings.battlefieldGrouping as BattlefieldGrouping)
    ? settings.battlefieldGrouping as BattlefieldGrouping
    : DEFAULT_CLIENT_SETTINGS.battlefieldGrouping;
  const seatOrientationValues: MatchSeatOrientation[] = ['table', 'reverse', 'active-first'];
  const matchSeatOrientation = seatOrientationValues.includes(settings.matchSeatOrientation as MatchSeatOrientation)
    ? settings.matchSeatOrientation as MatchSeatOrientation
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
    cardImageFallbackMode: normalizeEnumString(
      settings.cardImageFallbackMode,
      CARD_IMAGE_FALLBACK_MODE_VALUES,
      DEFAULT_CLIENT_SETTINGS.cardImageFallbackMode
    ) as CardImageFallbackMode,
    animationSpeed: clampNumber(settings.animationSpeed, 0.5, 2, DEFAULT_CLIENT_SETTINGS.animationSpeed),
    imageCacheMaxAgeDays: clampNumber(
      settings.imageCacheMaxAgeDays,
      1,
      365,
      DEFAULT_CLIENT_SETTINGS.imageCacheMaxAgeDays
    ),
    avatarId: Math.round(clampNumber(settings.avatarId, 1, 9999, DEFAULT_CLIENT_SETTINGS.avatarId)),
    flagName: normalizeFlagName(settings.flagName),
    autoTargetLevel: Math.round(clampNumber(settings.autoTargetLevel, 0, 2, DEFAULT_CLIENT_SETTINGS.autoTargetLevel)),
  };
}

export function clientSettingsToUserData(settings: ClientSettings): UserData {
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

function cloneUserSkipPrioritySteps(steps: UserSkipPrioritySteps): UserSkipPrioritySteps {
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

function normalizeFlagName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CLIENT_SETTINGS.flagName;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return DEFAULT_CLIENT_SETTINGS.flagName;
  return trimmed.replace(/\.png$/i, '');
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeLobbyConfig(config: PartialLobbyConfig): LobbyConfig {
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

export function normalizeLobbyFilters(filters: Partial<LobbyFiltersConfig> | undefined): LobbyFiltersConfig {
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

export function normalizeLobbyTableLayout(layout: Partial<LobbyTableLayoutConfig> | undefined): LobbyTableLayoutConfig {
  const columnOrder = normalizeColumnOrder(layout?.columnOrder);
  const columnWidths = normalizeColumnWidths(layout?.columnWidths);
  const sort = normalizeLobbySort(layout?.sort);

  return {
    columnOrder,
    columnWidths,
    sort,
  };
}

export function normalizeCreateTablePresets(config: PartialCreateTablePresetsConfig | undefined): CreateTablePresetsConfig {
  return {
    lastUsed: normalizeNullableCreateTablePreset(config?.lastUsed),
    config1: normalizeNullableCreateTablePreset(config?.config1),
    config2: normalizeNullableCreateTablePreset(config?.config2),
  };
}

export function normalizeCreateTablePreset(preset: PartialCreateTablePresetConfig | undefined): CreateTablePresetConfig {
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

export function normalizeDeckEditorConfig(config: PartialDeckEditorConfig | undefined): DeckEditorConfig {
  const activeMode = normalizeEnumString(config?.activeMode, DECK_EDITOR_MODE_KEYS, DEFAULT_DECK_EDITOR_CONFIG.activeMode) as DeckEditorModeKey;
  const modes = {} as Record<DeckEditorModeKey, DeckEditorModeConfig>;
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

export function normalizeDeckGeneratorSettings(settings: PartialDeckGeneratorSettings | undefined): DeckGeneratorSettings {
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
    cmcProfile: normalizeEnumString(settings?.cmcProfile, DECK_GENERATOR_CMC_VALUES, DEFAULT_DECK_GENERATOR_SETTINGS.cmcProfile) as DeckGeneratorCmcProfile,
  };
}

export function normalizeDeckFileHistory(history: PartialDeckFileHistoryConfig | undefined): DeckFileHistoryConfig {
  return {
    lastImport: normalizeDeckFileHistoryEntry(history?.lastImport),
    lastExport: normalizeDeckFileHistoryEntry(history?.lastExport),
  };
}

function normalizeDeckEditorModeConfig(
  config: PartialDeckEditorModeConfig | undefined,
  fallback: DeckEditorModeConfig,
): DeckEditorModeConfig {
  return {
    collectionView: normalizeEnumString(config?.collectionView, DECK_COLLECTION_VIEW_VALUES, fallback.collectionView) as DeckCollectionViewMode,
    collectionSortBy: normalizeEnumString(config?.collectionSortBy, DECK_COLLECTION_SORT_VALUES, fallback.collectionSortBy) as DeckCollectionSortKey,
    collectionSortDirection: normalizeSortDirection(config?.collectionSortDirection, fallback.collectionSortDirection),
    deckSortBy: normalizeEnumString(config?.deckSortBy, DECK_LIST_SORT_VALUES, fallback.deckSortBy) as DeckListSortKey,
    deckSortDirection: normalizeSortDirection(config?.deckSortDirection, fallback.deckSortDirection),
    deckPanelWidth: Math.round(clampNumber(config?.deckPanelWidth, 280, 520, fallback.deckPanelWidth)),
    showSideboard: normalizeBoolean(config?.showSideboard, fallback.showSideboard),
    search: normalizeDeckSearchSettings(config?.search, fallback.search),
  };
}

function normalizeDeckFileHistoryEntry(value: unknown): DeckFileHistoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as PartialDeckFileHistoryEntry;
  const fileName = normalizeBoundedString(entry.fileName, '', 180);
  const deckName = normalizeBoundedString(entry.deckName, '', 180);
  if (!fileName && !deckName) return null;

  return {
    fileName,
    deckName,
    updatedAt: Math.round(clampNumber(entry.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0)),
  };
}

export function normalizeDeckSearchSettings(
  settings: PartialDeckSearchSettings | undefined,
  fallback: DeckSearchSettings = DEFAULT_DECK_SEARCH_SETTINGS,
): DeckSearchSettings {
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
    colorMatch: normalizeEnumString(settings?.colorMatch, DECK_SEARCH_COLOR_MATCH_VALUES, fallback.colorMatch) as DeckSearchColorMode,
    types: normalizeStringList(settings?.types, CARD_TYPE_FILTER_VALUES, 12),
    excludedTypes: normalizeStringList(settings?.excludedTypes, CARD_TYPE_FILTER_VALUES, 12),
    rarities: normalizeStringList(settings?.rarities, RARITY_FILTER_VALUES, 8),
    excludedRarities: normalizeStringList(settings?.excludedRarities, RARITY_FILTER_VALUES, 8),
    setCodes: normalizeSetCodes(settings?.setCodes),
    format: normalizeBoundedString(settings?.format, fallback.format, 120),
    useDeckFormat: normalizeBoolean(settings?.useDeckFormat, fallback.useDeckFormat),
    pennyDreadful: normalizeBoolean(settings?.pennyDreadful, fallback.pennyDreadful),
    manaValue: normalizeNullableInteger(settings?.manaValue, 0, 20),
    manaValueOperator: normalizeEnumString(settings?.manaValueOperator, DECK_SEARCH_MANA_OPERATOR_VALUES, fallback.manaValueOperator) as DeckSearchManaOperator,
    uniqueNames: normalizeBoolean(settings?.uniqueNames, fallback.uniqueNames),
    piles: normalizeBoolean(settings?.piles, fallback.piles),
  };
}

function normalizeColumnOrder(value: unknown): LobbyRowSortKey[] {
  if (!Array.isArray(value)) return [...LOBBY_TABLE_COLUMN_KEYS];

  const knownKeys = new Set<LobbyRowSortKey>(LOBBY_TABLE_COLUMN_KEYS);
  const nextOrder = value.filter((key): key is LobbyRowSortKey =>
    typeof key === 'string' && knownKeys.has(key as LobbyRowSortKey)
  );
  const uniqueOrder = [...new Set(nextOrder)];
  const missingKeys = LOBBY_TABLE_COLUMN_KEYS.filter(key => !uniqueOrder.includes(key));

  return [...uniqueOrder, ...missingKeys];
}

function normalizeColumnWidths(value: unknown): Record<LobbyRowSortKey, number> {
  const widths = { ...DEFAULT_LOBBY_COLUMN_WIDTHS };
  if (!value || typeof value !== 'object') return widths;
  const candidate = value as Partial<Record<LobbyRowSortKey, unknown>>;

  for (const key of LOBBY_TABLE_COLUMN_KEYS) {
    widths[key] = Math.round(clampNumber(candidate[key], 52, 360, DEFAULT_LOBBY_COLUMN_WIDTHS[key]));
  }

  return widths;
}

function normalizeLobbySort(value: unknown): LobbyRowSort {
  if (!value || typeof value !== 'object') return DEFAULT_LOBBY_CONFIG.tableLayout.sort;
  const sort = value as Partial<LobbyRowSort>;
  const key = typeof sort.key === 'string' && LOBBY_TABLE_COLUMN_KEYS.includes(sort.key as LobbyRowSortKey)
    ? sort.key as LobbyRowSortKey
    : DEFAULT_LOBBY_CONFIG.tableLayout.sort.key;
  const direction = sort.direction === 'asc' || sort.direction === 'desc'
    ? sort.direction
    : DEFAULT_LOBBY_CONFIG.tableLayout.sort.direction;

  return { key, direction };
}

function cloneLobbyConfig(config: LobbyConfig): LobbyConfig {
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

function cloneCreateTablePresets(config: CreateTablePresetsConfig): CreateTablePresetsConfig {
  return {
    lastUsed: cloneCreateTablePreset(config.lastUsed),
    config1: cloneCreateTablePreset(config.config1),
    config2: cloneCreateTablePreset(config.config2),
  };
}

function cloneCreateTablePreset(preset: CreateTablePresetConfig | null): CreateTablePresetConfig | null {
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

function cloneDeckEditorConfig(config: DeckEditorConfig): DeckEditorConfig {
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

function cloneDeckEditorModeConfig(config: DeckEditorModeConfig): DeckEditorModeConfig {
  return {
    ...config,
    search: cloneDeckSearchSettings(config.search),
  };
}

function cloneDeckSearchSettings(settings: DeckSearchSettings): DeckSearchSettings {
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

function cloneDeckGeneratorSettings(settings: DeckGeneratorSettings): DeckGeneratorSettings {
  return {
    ...settings,
    colors: [...settings.colors],
  };
}

function cloneDeckFileHistory(history: DeckFileHistoryConfig): DeckFileHistoryConfig {
  return {
    lastImport: history.lastImport ? { ...history.lastImport } : null,
    lastExport: history.lastExport ? { ...history.lastExport } : null,
  };
}

function normalizeNullableCreateTablePreset(value: unknown): CreateTablePresetConfig | null {
  if (!value || typeof value !== 'object') return null;
  return normalizeCreateTablePreset(value as PartialCreateTablePresetConfig);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeSearchText(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_LOBBY_FILTERS.searchText;
  return value.slice(0, 160);
}

function normalizeIgnoredUsersConfig(value: unknown): IgnoredUsersConfig {
  if (!value || typeof value !== 'object') return { byServer: {} };
  const byServer = (value as { byServer?: unknown }).byServer;
  if (!byServer || typeof byServer !== 'object') return { byServer: {} };

  const normalizedByServer: Record<string, string[]> = {};
  for (const [serverUrl, users] of Object.entries(byServer as Record<string, unknown>)) {
    const serverKey = ignoredUsersServerKey(serverUrl);
    const normalizedUsers = normalizeIgnoredUserList(users);
    if (normalizedUsers.length > 0) {
      normalizedByServer[serverKey] = normalizedUsers;
    }
  }

  return { byServer: normalizedByServer };
}

function normalizeIgnoredUserList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalizedUsers: string[] = [];
  for (const user of value) {
    if (typeof user !== 'string') continue;
    const normalizedUser = user.trim().slice(0, 80);
    const key = ignoredUserIdentity(normalizedUser);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalizedUsers.push(normalizedUser);
    if (normalizedUsers.length >= MAX_IGNORED_USERS) break;
  }

  return normalizedUsers;
}

function ignoredUsersServerKey(serverUrl: string): string {
  return normalizeServerUrl(serverUrl);
}

function ignoredUserIdentity(userName: string): string {
  return userName.trim().toLowerCase();
}

function normalizeBoundedString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizeEnumString(value: unknown, allowedValues: readonly string[], fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return allowedValues.includes(value) ? value : fallback;
}

function normalizeSortDirection(value: unknown, fallback: DeckSortDirection): DeckSortDirection {
  return value === 'asc' || value === 'desc' ? value : fallback;
}

function normalizeDeckSearchColors(value: unknown): DeckSearchColors {
  const colors = { ...DEFAULT_DECK_SEARCH_COLORS };
  if (!value || typeof value !== 'object') return colors;
  const record = value as Partial<Record<keyof DeckSearchColors, unknown>>;

  for (const color of DECK_SEARCH_COLOR_VALUES) {
    colors[color] = normalizeBoolean(record[color], DEFAULT_DECK_SEARCH_COLORS[color]);
  }

  return colors;
}

function normalizeStringList(value: unknown, allowedValues: readonly string[], maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(allowedValues);
  const normalizedValues = value
    .filter((item): item is string => typeof item === 'string' && allowed.has(item))
    .slice(0, maxItems);
  return [...new Set(normalizedValues)];
}

function normalizeSetCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalizedValues = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toUpperCase())
    .filter(item => /^[A-Z0-9]{2,8}$/.test(item))
    .slice(0, 12);
  return [...new Set(normalizedValues)];
}

function normalizeNullableInteger(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(clampNumber(value, min, max, min));
}

function normalizeDeckGeneratorColors(value: unknown): DeckGeneratorColorKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_DECK_GENERATOR_SETTINGS.colors];
  const knownColors = new Set<DeckGeneratorColorKey>(DECK_GENERATOR_COLOR_VALUES);
  const colors = value
    .filter((color): color is DeckGeneratorColorKey => typeof color === 'string' && knownColors.has(color as DeckGeneratorColorKey));
  const uniqueColors = [...new Set(colors)];
  return uniqueColors.length > 0 ? uniqueColors : [...DEFAULT_DECK_GENERATOR_SETTINGS.colors];
}

function normalizeDeckGeneratorDeckSize(value: unknown): DeckGeneratorDeckSize {
  return DECK_GENERATOR_DECK_SIZE_VALUES.includes(value as DeckGeneratorDeckSize)
    ? value as DeckGeneratorDeckSize
    : DEFAULT_DECK_GENERATOR_SETTINGS.deckSize;
}

function normalizeCreateTablePlayerTypes(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const playerTypes = value
    .filter((playerType): playerType is string => typeof playerType === 'string' && Boolean(playerType.trim()))
    .map(playerType => playerType.trim().slice(0, 80))
    .slice(0, 10);
  return playerTypes.length > 0 ? playerTypes : [...fallback];
}

function normalizeCreateTableAiSeats(value: unknown, fallback: CreateTableAiSeatPresetConfig[]): CreateTableAiSeatPresetConfig[] {
  if (!Array.isArray(value)) return fallback.map(cloneCreateTableAiSeat);

  return value
    .map((item, index) => normalizeCreateTableAiSeat(item, index))
    .filter((item): item is CreateTableAiSeatPresetConfig => item !== null)
    .slice(0, 10);
}

function cloneCreateTableAiSeat(seat: CreateTableAiSeatPresetConfig): CreateTableAiSeatPresetConfig {
  return {
    name: seat.name,
    skill: seat.skill,
    deck: cloneDeckCardLists(seat.deck),
  };
}

function normalizeCreateTableAiSeat(value: unknown, index: number): CreateTableAiSeatPresetConfig | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const fallbackName = `Computer ${index + 1}`;

  return {
    name: normalizeBoundedString(record.name, fallbackName, 80) || fallbackName,
    skill: Math.round(clampNumber(record.skill, 1, 10, 2)),
    deck: normalizeDeckCardLists(record.deck),
  };
}

function normalizeDeckCardLists(value: unknown): DeckCardLists | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const cards = normalizeDeckCards(record.cards, 500);
  const sideboard = normalizeDeckCards(record.sideboard, 200);
  if (cards.length === 0 && sideboard.length === 0) return null;

  const deck: DeckCardLists = {
    name: normalizeBoundedString(record.name, 'AI Deck', 120),
    cards,
    sideboard,
  };

  const format = normalizeNullableString(record.format);
  if (format) deck.format = format.slice(0, 160);

  return deck;
}

function normalizeDeckCards(value: unknown, maxCards: number): DeckCardInfo[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeDeckCard)
    .filter((card): card is DeckCardInfo => card !== null)
    .slice(0, maxCards);
}

function normalizeDeckCard(value: unknown): DeckCardInfo | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const cardName = normalizeBoundedString(record.cardName, '', 160);
  if (!cardName) return null;

  return {
    amount: Math.round(clampNumber(record.amount, 1, 999, 1)),
    cardName,
    setCode: normalizeNullableString(record.setCode)?.slice(0, 32) ?? null,
    cardNumber: normalizeNullableString(record.cardNumber)?.slice(0, 32) ?? null,
  };
}

function cloneDeckCardLists(deck: DeckCardLists | null): DeckCardLists | null {
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
] as const;

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
] as const;

const MULLIGAN_TYPE_VALUES = [
  'GAME_DEFAULT',
  'VANCOUVER',
  'PARIS',
  'LONDON',
  'SMOOTHED_LONDON',
  'CANADIAN_HIGHLANDER',
] as const;

const SKILL_LEVEL_VALUES = ['BEGINNER', 'CASUAL', 'SERIOUS'] as const;
const RANGE_VALUES = ['ONE', 'TWO', 'ALL'] as const;
const ATTACK_OPTION_VALUES = ['MULTIPLE', 'LEFT', 'RIGHT'] as const;
const CARD_IMAGE_FALLBACK_MODE_VALUES = ['card-back', 'text-card'] as const;
const DECK_COLLECTION_VIEW_VALUES = ['grid', 'list'] as const;
const DECK_COLLECTION_SORT_VALUES = ['name', 'cardType', 'manaValue', 'color', 'rarity', 'cardNumber'] as const;
const DECK_LIST_SORT_VALUES = ['custom', 'name', 'amount', 'set'] as const;
const DECK_SEARCH_COLOR_VALUES = ['white', 'blue', 'black', 'red', 'green', 'colorless'] as const;
const DECK_SEARCH_COLOR_MATCH_VALUES = ['any', 'include', 'exact'] as const;
const DECK_SEARCH_MANA_OPERATOR_VALUES = ['eq', 'lte', 'gte'] as const;
const CARD_TYPE_FILTER_VALUES = ['ARTIFACT', 'CREATURE', 'ENCHANTMENT', 'INSTANT', 'LAND', 'PLANESWALKER', 'SORCERY', 'TRIBAL', 'CONSPIRACY', 'DUNGEON', 'BATTLE'] as const;
const RARITY_FILTER_VALUES = ['LAND', 'COMMON', 'UNCOMMON', 'RARE', 'MYTHIC', 'SPECIAL', 'BONUS'] as const;
const DECK_GENERATOR_COLOR_VALUES = ['white', 'blue', 'black', 'red', 'green'] as const;
const DECK_GENERATOR_CMC_VALUES = ['Low', 'Default', 'High'] as const;
const DECK_GENERATOR_DECK_SIZE_VALUES = [40, 60, 100] as const;

export const appConfigService = new AppConfigService();
