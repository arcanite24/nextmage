/**
 * Lobby Store
 * 
 * Manages lobby state including tables, users, and room information.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { wsService } from '../services';
import { useSessionStore } from './sessionStore';
import {
    UUID,
    TableView,
    MatchView,
    RoomUsersView,
    MatchOptions,
    DeckCardLists,
    ClientCallback,
    TableState,
} from '../types';

interface LobbyState {
    // Tables
    tables: TableView[];
    filteredTables: TableView[];
    selectedTableId: UUID | null;

    // Matches
    finishedMatches: MatchView[];

    // Users
    roomUsers: RoomUsersView | null;

    // Filters
    filters: {
        showWaiting: boolean;
        showStarting: boolean;
        showDueling: boolean;
        showFinished: boolean;
        gameType: string | null;
        deckType: string | null;
        showPassworded: boolean;
        showUnrated: boolean;
        searchText: string;
    };

    // Loading states
    isLoading: boolean;
    isJoining: boolean;

    // Current table (when joined)
    currentTable: TableView | null;
    myDeck: DeckCardLists | null;

    // Polling
    pollingInterval: ReturnType<typeof setInterval> | null;
}

interface LobbyActions {
    // Fetching
    fetchTables: () => Promise<void>;
    fetchFinishedMatches: () => Promise<void>;
    fetchRoomUsers: () => Promise<void>;
    refreshAll: () => Promise<void>;
    refreshCurrentTable: () => Promise<void>;

    // Polling
    startPolling: (intervalMs?: number) => void;
    stopPolling: () => void;

    // Table actions
    createTable: (options: MatchOptions) => Promise<TableView | null>;
    joinTable: (tableId: UUID, playerName: string, deckList: DeckCardLists, password?: string) => Promise<boolean>;
    watchTable: (tableId: UUID) => Promise<boolean>;
    leaveTable: () => Promise<boolean>;
    clearCurrentTable: () => void;
    startMatch: () => Promise<boolean>;
    addAI: (tableId: UUID, aiName: string, deckList: DeckCardLists, skill?: number) => Promise<boolean>;

    // Selection
    selectTable: (tableId: UUID | null) => void;

    // Filters
    setFilter: <K extends keyof LobbyState['filters']>(key: K, value: LobbyState['filters'][K]) => void;
    resetFilters: () => void;

    // Callbacks
    handleCallback: (callback: ClientCallback) => void;
}

const defaultFilters: LobbyState['filters'] = {
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

// Filter tables based on current filter settings
function applyFilters(tables: TableView[], filters: LobbyState['filters']): TableView[] {
    return tables.filter((table) => {
        // State filters
        const stateVisible =
            (filters.showWaiting && table.tableState === TableState.WAITING) ||
            (filters.showStarting && table.tableState === TableState.STARTING) ||
            (filters.showDueling && table.tableState === TableState.DUELING) ||
            (filters.showFinished && table.tableState === TableState.FINISHED);

        if (!stateVisible) return false;

        // Type filters
        if (filters.gameType && table.gameType !== filters.gameType) return false;
        if (filters.deckType && table.deckType !== filters.deckType) return false;

        // Flag filters
        if (!filters.showPassworded && table.passworded) return false;
        if (!filters.showUnrated && !table.rated) return false;

        // Search filter
        if (filters.searchText) {
            const search = filters.searchText.toLowerCase();
            const matchesSearch =
                table.tableName.toLowerCase().includes(search) ||
                table.controllerName.toLowerCase().includes(search) ||
                table.gameType.toLowerCase().includes(search);
            if (!matchesSearch) return false;
        }

        return true;
    });
}

export const useLobbyStore = create<LobbyState & LobbyActions>()(
    devtools(
        immer((set, get) => ({
            // Initial state
            tables: [],
            filteredTables: [],
            selectedTableId: null,
            finishedMatches: [],
            roomUsers: null,
            filters: defaultFilters,
            isLoading: false,
            isJoining: false,
            currentTable: null,
            myDeck: null,
            pollingInterval: null,

            // Fetching
            fetchTables: async () => {
                const { mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return;

                try {
                    const tables = await wsService.send<TableView[]>('roomGetAllTables', [mainRoomId]);
                    set((state) => {
                        state.tables = tables;
                        state.filteredTables = applyFilters(tables, state.filters);
                    });
                } catch (error) {
                    console.error('Failed to fetch tables:', error);
                }
            },

            fetchFinishedMatches: async () => {
                const { mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return;

                try {
                    const matches = await wsService.send<MatchView[]>('roomGetFinishedMatches', [mainRoomId]);
                    set((state) => {
                        state.finishedMatches = matches;
                    });
                } catch (error) {
                    console.error('Failed to fetch finished matches:', error);
                }
            },

            fetchRoomUsers: async () => {
                const { mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return;

                try {
                    const users = await wsService.send<RoomUsersView[]>('roomGetUsers', [mainRoomId]);
                    set((state) => {
                        state.roomUsers = users[0] || null;
                    });
                } catch (error) {
                    console.error('Failed to fetch room users:', error);
                }
            },

            refreshAll: async () => {
                set((state) => { state.isLoading = true; });

                await Promise.all([
                    get().fetchTables(),
                    get().fetchRoomUsers(),
                ]);

                set((state) => { state.isLoading = false; });
            },

            refreshCurrentTable: async () => {
                const { currentTable } = get();
                const { mainRoomId } = useSessionStore.getState();
                if (!mainRoomId || !currentTable) return;

                try {
                    const updated = await wsService.send<TableView>('roomGetTableById', [mainRoomId, currentTable.tableId]);
                    if (updated) {
                        set((state) => { state.currentTable = updated; });
                    } else {
                        // Table no longer exists
                        set((state) => { state.currentTable = null; });
                    }
                } catch (error) {
                    console.error('Failed to refresh current table:', error);
                }
            },

            // Polling
            startPolling: (intervalMs = 5000) => {
                const { stopPolling, refreshAll } = get();
                stopPolling();

                refreshAll(); // Initial fetch

                const interval = setInterval(() => {
                    get().fetchTables();
                }, intervalMs);

                set((state) => { state.pollingInterval = interval; });
            },

            stopPolling: () => {
                const { pollingInterval } = get();
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    set((state) => { state.pollingInterval = null; });
                }
            },

            // Table actions
            createTable: async (options) => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return null;

                try {
                    console.log('Creating table with options:', options);
                    const table = await wsService.send<TableView>('roomCreateTable', [
                        sessionId,
                        mainRoomId,
                        options,
                    ]);

                    await get().fetchTables();

                    // Optimistic update: ensure the created table is in the list immediately
                    // This handles cases where fetchTables might be slightly delayed or the server index lags
                    set((state) => {
                        const exists = state.tables.find(t => t.tableId === table.tableId);
                        if (!exists) {
                            state.tables.push(table);
                            // Re-apply filters
                            state.filteredTables = applyFilters(state.tables, state.filters);
                        }
                    });

                    return table;
                } catch (error) {
                    console.error('Failed to create table:', error);
                    throw error;
                }
            },

            joinTable: async (tableId, playerName, deckList, password = '') => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return false;

                set((state) => { state.isJoining = true; });

                try {
                    const result = await wsService.send<boolean>('roomJoinTable', [
                        sessionId,
                        mainRoomId,
                        tableId,
                        playerName,
                        'Human',
                        5, // skill level
                        deckList,
                        password,
                    ]);

                    if (result) {
                        const table = await wsService.send<TableView>('roomGetTableById', [mainRoomId, tableId]);
                        set((state) => {
                            state.currentTable = table;
                            state.myDeck = deckList;
                        });
                    }

                    return result;
                } catch (error) {
                    console.error('Failed to join table:', error);
                    throw error;
                } finally {
                    set((state) => { state.isJoining = false; });
                }
            },

            addAI: async (tableId: UUID, aiName: string, deckList: DeckCardLists, skill = 5) => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return false;

                try {
                    // Re-use roomJoinTable but with 'Computer'
                    // Note: This relies on the server allowing the same Session/User to add a Computer player
                    const result = await wsService.send<boolean>('roomJoinTable', [
                        sessionId,
                        mainRoomId,
                        tableId,
                        aiName,
                        'Computer - mad',
                        skill,
                        deckList,
                        '', // No password needed usually for adding AI by host
                    ]);

                    if (result) {
                        // Refresh table to show new seat
                        await get().fetchTables();
                        // Also update current table if we are in it
                        const { currentTable } = get();
                        if (currentTable && currentTable.tableId === tableId) {
                            const updated = await wsService.send<TableView>('roomGetTableById', [mainRoomId, tableId]);
                            set((state) => { state.currentTable = updated; });
                        }
                    }
                    return result;
                } catch (error) {
                    console.error('Failed to add AI:', error);
                    return false;
                }
            },

            watchTable: async (tableId) => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return false;

                try {
                    return await wsService.send<boolean>('roomWatchTable', [
                        sessionId,
                        mainRoomId,
                        tableId,
                    ]);
                } catch (error) {
                    console.error('Failed to watch table:', error);
                    return false;
                }
            },

            leaveTable: async () => {
                const { currentTable } = get();
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId || !currentTable) return false;

                if (!currentTable.tableId) {
                    console.error('Cannot leave table: tableId is missing', currentTable);
                    set((state) => { state.currentTable = null; }); // Force clear
                    return false;
                }

                try {
                    const result = await wsService.send<boolean>('roomLeaveTableOrTournament', [
                        sessionId,
                        mainRoomId,
                        currentTable.tableId,
                    ]);

                    if (result) {
                        set((state) => { state.currentTable = null; });
                    }

                    return result;
                } catch (error) {
                    console.error('Failed to leave table:', error);
                    return false;
                }
            },

            clearCurrentTable: () => {
                set((state) => { state.currentTable = null; });
            },

            startMatch: async () => {
                const { currentTable } = get();
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId || !currentTable) return false;

                try {
                    return await wsService.send<boolean>('matchStart', [
                        sessionId,
                        mainRoomId,
                        currentTable.tableId,
                    ]);
                } catch (error) {
                    console.error('Failed to start match:', error);
                    return false;
                }
            },

            // Selection
            selectTable: (tableId) => {
                set((state) => { state.selectedTableId = tableId; });
            },

            // Filters
            setFilter: (key, value) => {
                set((state) => {
                    state.filters[key] = value;
                    state.filteredTables = applyFilters(state.tables, state.filters);
                });
            },

            resetFilters: () => {
                set((state) => {
                    state.filters = defaultFilters;
                    state.filteredTables = applyFilters(state.tables, state.filters);
                });
            },

            // Callbacks
            handleCallback: (callback) => {
                switch (callback.method) {
                    case 'joinedTable':
                        const newTable = callback.data as TableView;
                        if (newTable && newTable.tableId) {
                            set((state) => {
                                state.currentTable = newTable;
                            });
                        } else {
                            console.warn('joinedTable callback received without valid tableId:', callback.data);
                        }
                        break;
                }
            },
        })),
        { name: 'LobbyStore' }
    )
);
