/**
 * Deck Store
 * 
 * Zustand store for deck management and editing state.
 */

import { create } from 'zustand';
import { DeckCardLists, DeckCardInfo, SearchCardView, CardSearchCriteria, Rarity } from '../types';
import { deckStorage, DeckSummary } from '../services/DeckStorageService';
import { wsService } from '../services/WebSocketService';

export interface DeckColors {
    white: boolean;
    blue: boolean;
    black: boolean;
    red: boolean;
    green: boolean;
}

export interface CardFilters {
    nameContains: string;
    colors: DeckColors;
    colorMatch: 'any' | 'exact' | 'include';
    types: string[];
    manaValue: number | null;
    manaValueOperator: 'eq' | 'lte' | 'gte';
    rarities: string[];
    sortBy: 'name' | 'manaValue' | 'color' | 'rarity';
    sortDirection: 'asc' | 'desc';
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
    searchResults: SearchCardView[];
    isSearching: boolean;
    filters: CardFilters;

    // Actions - Deck Manager
    loadDecks: () => Promise<void>;
    selectDeck: (id: string | null) => void;
    createNewDeck: () => void;
    deleteDeck: (id: string) => Promise<void>;
    cloneDeck: (id: string) => Promise<string | null>;

    // Actions - Deck Editor
    loadDeck: (id: string) => Promise<void>;
    saveDeck: () => Promise<string | null>;
    closeDeck: () => void;
    setDeckName: (name: string) => void;
    setDeckFormat: (format: string) => void;

    // Actions - Card Management
    addCard: (card: SearchCardView, zone: 'main' | 'side') => void;
    removeCard: (card: DeckCardInfo, zone: 'main' | 'side') => void;
    moveCard: (card: DeckCardInfo, fromZone: 'main' | 'side', toZone: 'main' | 'side') => void;

    // Actions - Filters & Search
    setFilters: (filters: Partial<CardFilters>) => void;
    resetFilters: () => void;
    searchCards: () => Promise<void>;
}

const defaultFilters: CardFilters = {
    nameContains: '',
    colors: { white: false, blue: false, black: false, red: false, green: false },
    colorMatch: 'any',
    types: [],
    manaValue: null,
    manaValueOperator: 'eq',
    rarities: [],
    sortBy: 'name',
    sortDirection: 'asc',
};

/**
 * Calculate deck colors from card list
 */
function calculateDeckColors(cards: DeckCardInfo[]): DeckColors {
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

    searchResults: [],
    isSearching: false,
    filters: { ...defaultFilters },

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

            const newId = await deckStorage.saveDeck(clonedDeck);
            await get().loadDecks();
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
                });
            }
        } catch (error) {
            console.error('[DeckStore] Failed to load deck:', error);
        }
    },

    saveDeck: async () => {
        const { currentDeck } = get();
        if (!currentDeck) return null;

        try {
            // Update metadata before saving
            const deckToSave: DeckCardLists = {
                ...currentDeck,
                coverCard: getCoverCard(currentDeck.cards),
                colors: calculateDeckColors(currentDeck.cards),
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

    closeDeck: () => {
        set({
            currentDeck: null,
            isEditing: false,
            isDirty: false,
            searchResults: [],
        });
    },

    setDeckName: (name) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        set({
            currentDeck: { ...currentDeck, name },
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

        const newCard: DeckCardInfo = {
            cardName: card.name,
            setCode: card.expansionSetCode,
            cardNumber: card.cardNumber,
            amount: 1,
        };

        const targetList = zone === 'main' ? [...currentDeck.cards] : [...currentDeck.sideboard];
        const existing = targetList.find(
            c => c.setCode === newCard.setCode && c.cardNumber === newCard.cardNumber
        );

        if (existing) {
            existing.amount++;
        } else {
            targetList.push(newCard);
        }

        set({
            currentDeck: {
                ...currentDeck,
                [zone === 'main' ? 'cards' : 'sideboard']: targetList,
            },
            isDirty: true,
        });
    },

    removeCard: (card, zone) => {
        const { currentDeck } = get();
        if (!currentDeck) return;

        const targetList = (zone === 'main' ? currentDeck.cards : currentDeck.sideboard)
            .map(c => ({ ...c }));

        const index = targetList.findIndex(
            c => c.setCode === card.setCode && c.cardNumber === card.cardNumber
        );

        if (index !== -1) {
            if (targetList[index].amount > 1) {
                targetList[index].amount--;
            } else {
                targetList.splice(index, 1);
            }
        }

        set({
            currentDeck: {
                ...currentDeck,
                [zone === 'main' ? 'cards' : 'sideboard']: targetList,
            },
            isDirty: true,
        });
    },

    moveCard: (card, fromZone, toZone) => {
        const { currentDeck, removeCard, addCard } = get();
        if (!currentDeck) return;

        // Create a synthetic SearchCardView for addCard
        const searchCard: SearchCardView = {
            id: `${card.setCode}-${card.cardNumber}`,
            name: card.cardName,
            displayName: card.cardName,
            rules: [],
            power: '',
            toughness: '',
            loyalty: '',
            defense: '',
            cardTypes: [],
            subTypes: [],
            superTypes: [],
            expansionSetCode: card.setCode || '',
            cardNumber: card.cardNumber || '',
            imageFileName: '',
            imageNumber: 0,
            color: { white: false, blue: false, black: false, red: false, green: false },
            frameColor: { white: false, blue: false, black: false, red: false, green: false },
            manaValue: 0,
            rarity: Rarity.COMMON,
            isSplitCard: false,
            isDoubleFacedCard: false,
        };

        // Remove from source and add to destination
        removeCard(card, fromZone);
        addCard(searchCard, toZone);
    },

    // Filters & Search Actions
    setFilters: (newFilters) => {
        set({
            filters: { ...get().filters, ...newFilters },
        });
    },

    resetFilters: () => {
        set({ filters: { ...defaultFilters } });
    },

    searchCards: async () => {
        const { filters } = get();
        set({ isSearching: true });

        try {
            const criteria: CardSearchCriteria = {
                nameContains: filters.nameContains || undefined,
                count: 100,
                sortBy: filters.sortBy,
            };

            // Add color filters if any are selected
            if (filters.colors.white) criteria.white = true;
            if (filters.colors.blue) criteria.blue = true;
            if (filters.colors.black) criteria.black = true;
            if (filters.colors.red) criteria.red = true;
            if (filters.colors.green) criteria.green = true;

            // Add type filters
            if (filters.types.length > 0) {
                criteria.types = filters.types as any;
            }

            // Add rarity filters
            if (filters.rarities.length > 0) {
                criteria.rarities = filters.rarities as any;
            }

            // Add mana value filter
            if (filters.manaValue !== null) {
                criteria.manaValue = filters.manaValue;
            }

            const results = await wsService.searchCards(criteria);
            set({ searchResults: results, isSearching: false });
        } catch (error) {
            console.error('[DeckStore] Search failed:', error);
            set({ searchResults: [], isSearching: false });
        }
    },
}));
