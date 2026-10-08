/**
 * Deck Store
 * 
 * Zustand store for deck management and editing state.
 */

import { create } from 'zustand';
import { DeckCardLists, DeckCardInfo, SearchCardView } from '../types';
import {
    appConfigService,
    DEFAULT_DECK_EDITOR_MODE_CONFIG,
    DEFAULT_DECK_SEARCH_SETTINGS,
    type DeckCollectionSortKey,
    type DeckEditorConfig,
    type DeckEditorModeConfig,
    type DeckEditorModeKey,
    type DeckListSortKey,
    type DeckSearchColors,
    type DeckSearchSettings,
    type DeckSortDirection,
} from '../services/AppConfigService';
import {
    applyCardSearchFilters,
    buildCardSearchCriteria,
    sortSearchResults,
} from '../services/DeckSearchFilterService';
import {
    addDeckCardCopies,
    addSearchCardToDeck,
    decrementDeckCard,
    moveDeckCard as moveDeckCardBetweenZones,
    setDeckCardAmount as setDeckCardCopies,
} from '../services/DeckCardListService';
import { appendDeckCardLists } from '../services/DeckImportWorkflowService';
import { deckStorage, DeckSummary } from '../core/decks/DeckStorageService';
import { wsService } from '../services/WebSocketService';

export interface DeckColors {
    white: boolean;
    blue: boolean;
    black: boolean;
    red: boolean;
    green: boolean;
}

export type DeckFilterColors = DeckSearchColors;

export interface CardFilters extends DeckSearchSettings {
    sortBy: DeckCollectionSortKey;
    sortDirection: DeckSortDirection;
}

export interface DeckState {
    // Deck Manager State
    decks: DeckSummary[];
    selectedDeckId: string | null;
    isLoadingDecks: boolean;

    // Deck Editor State
    currentDeck: DeckCardLists | null;
    isEditing: boolean;
    isDirty: boolean;

    // Card Search State
    rawSearchResults: SearchCardView[];
    searchResults: SearchCardView[];
    isSearching: boolean;
    filters: CardFilters;
    editorMode: DeckEditorModeKey;
    editorConfig: DeckEditorConfig;

    // Actions - Deck Manager
    loadDecks: () => Promise<void>;
    selectDeck: (id: string | null) => void;
    createNewDeck: () => void;
    deleteDeck: (id: string) => Promise<void>;
    cloneDeck: (id: string) => Promise<string | null>;

    // Actions - Deck Editor
    loadDeck: (id: string) => Promise<boolean>;
    saveDeck: () => Promise<string | null>;
    saveDeckAs: (name: string) => Promise<string | null>;
    closeDeck: () => void;
    replaceCurrentDeck: (deck: DeckCardLists) => void;
    appendDeck: (deck: DeckCardLists) => void;
    markCurrentDeckClean: () => void;
    setDeckName: (name: string) => void;
    setDeckDescription: (description: string) => void;
    setDeckFormat: (format: string) => void;

    // Actions - Card Management
    addCard: (card: SearchCardView, zone: 'main' | 'side') => void;
    addDeckCards: (cards: DeckCardInfo[], zone: 'main' | 'side') => void;
    removeCard: (card: DeckCardInfo, zone: 'main' | 'side') => void;
    setCardAmount: (card: DeckCardInfo, zone: 'main' | 'side', amount: number) => void;
    moveCard: (card: DeckCardInfo, fromZone: 'main' | 'side', toZone: 'main' | 'side') => void;

    // Actions - Filters & Search
    setFilters: (filters: Partial<CardFilters>) => void;
    resetFilters: () => void;
    searchCards: () => Promise<void>;
    setEditorMode: (mode: DeckEditorModeKey) => void;
    updateEditorModeConfig: (patch: Partial<DeckEditorModeConfig>, mode?: DeckEditorModeKey) => void;
    resetEditorModeConfig: (mode?: DeckEditorModeKey) => void;
    resetEditorConfig: () => void;
}

const initialEditorConfig = appConfigService.loadDeckEditorConfig();

export function createDefaultFilters(modeConfig: DeckEditorModeConfig): CardFilters {
    return {
        ...cloneSearchSettings(modeConfig.search),
        sortBy: modeConfig.collectionSortBy,
        sortDirection: modeConfig.collectionSortDirection,
    };
}

const defaultFilters: CardFilters = createDefaultFilters(initialEditorConfig.modes[initialEditorConfig.activeMode]);

function applyAndSortSearchResults(results: SearchCardView[], filters: CardFilters): SearchCardView[] {
    return sortSearchResults(applyCardSearchFilters(results, filters), filters);
}

function syncFiltersWithModeConfig(filters: CardFilters, modeConfig: DeckEditorModeConfig): CardFilters {
    return {
        ...cloneSearchSettings(modeConfig.search),
        sortBy: modeConfig.collectionSortBy,
        sortDirection: modeConfig.collectionSortDirection,
    };
}

function cloneSearchSettings(settings: DeckSearchSettings): DeckSearchSettings {
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

function filtersToSearchSettings(filters: CardFilters): DeckSearchSettings {
    const searchSettings: DeckSearchSettings & Partial<Pick<CardFilters, 'sortBy' | 'sortDirection'>> = { ...filters };
    delete searchSettings.sortBy;
    delete searchSettings.sortDirection;
    return cloneSearchSettings(searchSettings);
}

/**
 * Calculate deck colors from card list
 */
function calculateDeckColors(): DeckColors {
    // Note: We don't have color info in DeckCardInfo, so this would need
    // to be enhanced with card data lookup. For now, return empty.
    // In a full implementation, we'd cache card color data.
    return {
        white: false,
        blue: false,
        black: false,
        red: false,
        green: false,
    };
}

/**
 * Get a cover card for the deck (first creature or first card)
 */
function getCoverCard(cards: DeckCardInfo[]): { setCode: string; cardNumber: string; name?: string } | undefined {
    if (cards.length === 0) return undefined;

    // Just use the first card for now
    const firstCard = cards[0];
    if (!firstCard.setCode || !firstCard.cardNumber) return undefined;

    return {
        setCode: firstCard.setCode,
        cardNumber: firstCard.cardNumber,
        name: firstCard.cardName,
    };
}

export const useDeckStore = create<DeckState>((set, get) => ({
    // Initial State
    decks: [],
    selectedDeckId: null,
    isLoadingDecks: false,

    currentDeck: null,
    isEditing: false,
    isDirty: false,

    rawSearchResults: [],
    searchResults: [],
    isSearching: false,
    filters: { ...defaultFilters },
    editorMode: initialEditorConfig.activeMode,
    editorConfig: initialEditorConfig,

    // Deck Manager Actions
    loadDecks: async () => {
        set({ isLoadingDecks: true });
        try {
            const decks = await deckStorage.listDecks();
            set({ decks, isLoadingDecks: false });
        } catch (error) {
            console.error('[DeckStore] Failed to load decks:', error);
            set({ isLoadingDecks: false });
        }
    },

    selectDeck: (id) => {
        set({ selectedDeckId: id });
    },

    createNewDeck: () => {
        const newDeck: DeckCardLists = {
            id: undefined,
            name: 'New Deck',
            description: '',
            format: 'Constructed - Standard',
            cards: [],
            sideboard: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        set({
            currentDeck: newDeck,
            isEditing: true,
            isDirty: true,
        });
    },

    deleteDeck: async (id) => {
        try {
            await deckStorage.deleteDeck(id);
            const { decks, selectedDeckId } = get();
            set({
                decks: decks.filter(d => d.id !== id),
                selectedDeckId: selectedDeckId === id ? null : selectedDeckId,
            });
        } catch (error) {
            console.error('[DeckStore] Failed to delete deck:', error);
        }
    },

    cloneDeck: async (id) => {
        try {
            const deck = await deckStorage.loadDeck(id);
            if (!deck) return null;

            const clonedDeck: DeckCardLists = {
                ...deck,
                id: undefined,
                name: `${deck.name || 'Deck'} (Copy)`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const newId = await deckStorage.saveDeck(clonedDeck, { forceNew: true });
            await get().loadDecks();
            set({ selectedDeckId: newId });
            return newId;
        } catch (error) {
            console.error('[DeckStore] Failed to clone deck:', error);
            return null;
        }
    },

    // Deck Editor Actions
    loadDeck: async (id) => {
        try {
            const deck = await deckStorage.loadDeck(id);
            if (deck) {
                deck.id = id;
                set({
                    currentDeck: deck,
                    isEditing: true,
                    isDirty: false,
                    selectedDeckId: id,
                });
                return true;
            }
        } catch (error) {
            console.error('[DeckStore] Failed to load deck:', error);
        }
        return false;
    },

    saveDeck: async () => {
        const { currentDeck } = get();
        if (!currentDeck) return null;

        try {
            // Update metadata before saving
            const deckToSave: DeckCardLists = {
                ...currentDeck,
                coverCard: getCoverCard(currentDeck.cards),
                colors: calculateDeckColors(),
                updatedAt: Date.now(),
            };

            const id = await deckStorage.saveDeck(deckToSave);

            set({
                currentDeck: { ...deckToSave, id },
                isDirty: false,
            });

            // Refresh the deck list
            await get().loadDecks();

            return id;
        } catch (error) {
            console.error('[DeckStore] Failed to save deck:', error);
            return null;
        }
    },

    saveDeckAs: async (name) => {
        const { currentDeck } = get();
        const trimmedName = name.trim();
        if (!currentDeck || !trimmedName) return null;

        try {
            const now = Date.now();
            const deckToSave: DeckCardLists = {
                ...currentDeck,
                id: undefined,
                name: trimmedName,
                coverCard: getCoverCard(currentDeck.cards),
                colors: calculateDeckColors(),
                createdAt: now,
                updatedAt: now,
            };

            const id = await deckStorage.saveDeck(deckToSave, { forceNew: true });

            set({
                currentDeck: { ...deckToSave, id },
                selectedDeckId: id,
                isDirty: false,
            });

            await get().loadDecks();
            return id;
        } catch (error) {
            console.error('[DeckStore] Failed to save deck copy:', error);
            return null;
        }
    },

    closeDeck: () => {
        set({
            currentDeck: null,
            isEditing: false,
            isDirty: false,
            searchResults: [],
        });
    },

    replaceCurrentDeck: (deck) => {
        const currentDeck = get().currentDeck;
        const now = Date.now();
        set({
            currentDeck: {
                ...deck,
                id: currentDeck?.id ?? deck.id,
                description: deck.description ?? currentDeck?.description,
                format: deck.format || currentDeck?.format || 'Constructed - Standard',
                createdAt: currentDeck?.createdAt ?? deck.createdAt ?? now,
                updatedAt: now,
            },
            isEditing: true,
            isDirty: true,
        });
    },

    appendDeck: (deck) => {
        const currentDeck = get().currentDeck ?? {
            name: 'New Deck',
            description: '',
            format: 'Constructed - Standard',
            cards: [],
            sideboard: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        set({
            currentDeck: appendDeckCardLists(currentDeck, deck),
            isEditing: true,
            isDirty: true,
        });
    },

    markCurrentDeckClean: () => {
        set({ isDirty: false });
    },

    setDeckName: (name) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: { ...currentDeck, name },
            isDirty: true,
        });
    },

    setDeckDescription: (description) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: { ...currentDeck, description },
            isDirty: true,
        });
    },

    setDeckFormat: (format) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: { ...currentDeck, format },
            isDirty: true,
        });
    },

    // Card Management Actions
    addCard: (card, zone) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: addSearchCardToDeck(currentDeck, card, zone),
            isDirty: true,
        });
    },

    addDeckCards: (cards, zone) => {
        const { currentDeck } = get();
        if (!currentDeck || cards.length === 0) return;

        const nextDeck = cards.reduce(
            (deck, card) => addDeckCardCopies(deck, card, zone, card.amount),
            currentDeck,
        );

        set({
            currentDeck: nextDeck,
            isDirty: true,
        });
    },

    removeCard: (card, zone) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: decrementDeckCard(currentDeck, card, zone),
            isDirty: true,
        });
    },

    setCardAmount: (card, zone, amount) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: setDeckCardCopies(currentDeck, card, zone, amount),
            isDirty: true,
        });
    },

    moveCard: (card, fromZone, toZone) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: moveDeckCardBetweenZones(currentDeck, card, fromZone, toZone),
            isDirty: true,
        });
    },

    // Filters & Search Actions
    setFilters: (newFilters) => {
        set((state) => {
            const filters = { ...state.filters, ...newFilters };
            const editorConfig = appConfigService.saveDeckEditorConfig({
                ...state.editorConfig,
                modes: {
                    ...state.editorConfig.modes,
                    [state.editorMode]: {
                        ...state.editorConfig.modes[state.editorMode],
                        search: filtersToSearchSettings(filters),
                    },
                },
            });

            return {
                editorConfig,
                filters,
                searchResults: applyAndSortSearchResults(state.rawSearchResults, filters),
            };
        });
    },

    resetFilters: () => {
        const { editorConfig, editorMode } = get();
        const nextEditorConfig = appConfigService.saveDeckEditorConfig({
            ...editorConfig,
            modes: {
                ...editorConfig.modes,
                [editorMode]: {
                    ...editorConfig.modes[editorMode],
                    search: DEFAULT_DECK_SEARCH_SETTINGS,
                },
            },
        });
        const filters = createDefaultFilters(nextEditorConfig.modes[editorMode]);
        set({
            editorConfig: nextEditorConfig,
            filters,
            searchResults: applyAndSortSearchResults(get().rawSearchResults, filters),
        });
    },

    searchCards: async () => {
        const { filters, currentDeck } = get();
        set({ isSearching: true });

        try {
            const criteria = buildCardSearchCriteria(filters, {
                count: 200,
                sortBy: filters.sortBy,
                deckFormat: currentDeck?.format,
            });

            const results = await wsService.searchCards(criteria);
            set({ rawSearchResults: results, searchResults: applyAndSortSearchResults(results, filters), isSearching: false });
        } catch (error) {
            console.error('[DeckStore] Search failed:', error);
            set({ rawSearchResults: [], searchResults: [], isSearching: false });
        }
    },

    setEditorMode: (mode) => {
        const current = get();
        const editorConfig = appConfigService.saveDeckEditorConfig({
            ...current.editorConfig,
            activeMode: mode,
        });
        const filters = syncFiltersWithModeConfig(current.filters, editorConfig.modes[mode]);

        set({
            editorMode: editorConfig.activeMode,
            editorConfig,
            filters,
            searchResults: applyAndSortSearchResults(current.rawSearchResults, filters),
        });
    },

    updateEditorModeConfig: (patch, mode) => {
        const current = get();
        const targetMode = mode ?? current.editorMode;
        const editorConfig = appConfigService.saveDeckEditorConfig({
            ...current.editorConfig,
            modes: {
                ...current.editorConfig.modes,
                [targetMode]: {
                    ...current.editorConfig.modes[targetMode],
                    ...patch,
                },
            },
        });
        const filters = targetMode === current.editorMode
            ? syncFiltersWithModeConfig(current.filters, editorConfig.modes[current.editorMode])
            : current.filters;

        set({
            editorConfig,
            filters,
            searchResults: applyAndSortSearchResults(current.rawSearchResults, filters),
        });
    },

    resetEditorModeConfig: (mode) => {
        const current = get();
        const targetMode = mode ?? current.editorMode;
        const editorConfig = appConfigService.saveDeckEditorConfig({
            ...current.editorConfig,
            modes: {
                ...current.editorConfig.modes,
                [targetMode]: {
                    ...DEFAULT_DECK_EDITOR_MODE_CONFIG,
                    search: current.editorConfig.modes[targetMode].search,
                },
            },
        });
        const filters = targetMode === current.editorMode
            ? syncFiltersWithModeConfig(current.filters, editorConfig.modes[current.editorMode])
            : current.filters;

        set({
            editorConfig,
            filters,
            searchResults: applyAndSortSearchResults(current.rawSearchResults, filters),
        });
    },

    resetEditorConfig: () => {
        const editorConfig = appConfigService.resetDeckEditorConfig();
        const filters = createDefaultFilters(editorConfig.modes[editorConfig.activeMode]);

        set({
            editorMode: editorConfig.activeMode,
            editorConfig,
            filters,
            searchResults: applyAndSortSearchResults(get().rawSearchResults, filters),
        });
    },
}));

export type { DeckListSortKey };
