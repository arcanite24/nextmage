/**
 * Lobby Store
 * 
 * Manages lobby state including tables, users, and room information.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { wsService } from '../services';
import {
    mergeTablesWithPendingCreated,
    type PendingCreatedTable,
} from '../services/LobbyTableMergeService';
import {
    appConfigService,
    DEFAULT_LOBBY_CONFIG,
    DEFAULT_LOBBY_FILTERS,
    FALLBACK_LOBBY_SERVER_OPTIONS,
    getDefaultComputerPlayerType,
    normalizeLobbyServerOptions,
    webSocketBridgeService,
    type LobbyRowSort,
    type LobbyRowSortKey,
    type LobbyServerOptions,
    type LobbyTableLayoutConfig,
} from '../services';
import { useSessionStore } from './sessionStore';
import {
    UUID,
    TableView,
    MatchView,
    RoomUsersView,
    MatchOptions,
    TournamentOptions,
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
    filteredFinishedMatches: MatchView[];

    // Users
    roomUsers: RoomUsersView | null;

    // Server-provided option lists
    serverOptions: LobbyServerOptions;
    serverOptionsLoadedAt: string | null;
    isLoadingOptions: boolean;
    optionsError: string | null;

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
    tableLayout: LobbyTableLayoutConfig;

    // Loading states
    isLoading: boolean;
    isJoining: boolean;

    // Current table (when joined)
    currentTable: TableView | null;
    myDeck: DeckCardLists | null;
    tableActionError: string | null;

    // Polling
    pollingInterval: ReturnType<typeof setInterval> | null;
    pendingCreatedTables: Record<UUID, PendingCreatedTable<TableView>>;
}

interface LobbyActions {
    // Fetching
    fetchTables: () => Promise<void>;
    fetchFinishedMatches: () => Promise<void>;
    fetchRoomUsers: () => Promise<void>;
    loadServerOptions: (force?: boolean) => Promise<void>;
    refreshAll: () => Promise<void>;
    refreshCurrentTable: () => Promise<void>;

    // Polling
    startPolling: (intervalMs?: number) => void;
    stopPolling: () => void;

    // Table actions
    createTable: (options: MatchOptions) => Promise<TableView | null>;
    createTournament: (options: TournamentOptions) => Promise<TableView | null>;
    joinTable: (tableId: UUID, playerName: string, deckList: DeckCardLists, password?: string) => Promise<boolean>;
    watchTable: (tableId: UUID) => Promise<boolean>;
    leaveTable: () => Promise<boolean>;
    clearCurrentTable: () => void;
    startTable: () => Promise<boolean>;
    clearTableActionError: () => void;
    addAI: (tableId: UUID, aiName: string, deckList: DeckCardLists, playerType: string, skill?: number) => Promise<boolean>;
    swapSeats: (tableId: UUID, fromSeatIndex: number, toSeatIndex: number) => Promise<boolean>;
    removeTable: (tableId: UUID) => Promise<boolean>;

    // Selection
    selectTable: (tableId: UUID | null) => void;

    // Filters
    setFilter: <K extends keyof LobbyState['filters']>(key: K, value: LobbyState['filters'][K]) => void;
    resetFilters: () => void;
    setTableSort: (sort: LobbyRowSort) => void;
    setTableColumnOrder: (columnOrder: LobbyRowSortKey[]) => void;
    setTableColumnWidth: (key: LobbyRowSortKey, width: number) => void;
    resetTableLayout: () => void;
    refreshTableFilters: () => void;

    // Callbacks
    handleCallback: (callback: ClientCallback) => void;
}

const initialLobbyConfig = appConfigService.loadLobbyConfig();
const defaultFilters: LobbyState['filters'] = DEFAULT_LOBBY_FILTERS;

function isStartingBucketState(state: TableState): boolean {
    return state === TableState.STARTING
        || state === TableState.READY_TO_START
        || state === TableState.DRAFTING
        || state === TableState.SIDEBOARDING
        || state === TableState.CONSTRUCTING;
}

// Filter tables based on current filter settings
function applyFilters(tables: TableView[], filters: LobbyState['filters']): TableView[] {
    const ignoredHosts = getIgnoredUsersForCurrentServer();

    return tables.filter((table) => {
        if (ignoredHosts.has(normalizeIgnoredUserKey(table.controllerName))) return false;

        // State filters
        const stateVisible =
            (filters.showWaiting && table.tableState === TableState.WAITING) ||
            (filters.showStarting && isStartingBucketState(table.tableState)) ||
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

function getIgnoredUsersForCurrentServer(): Set<string> {
    const { serverUrl } = useSessionStore.getState();
    return new Set(appConfigService.loadIgnoredUsers(serverUrl).map(normalizeIgnoredUserKey));
}

function normalizeIgnoredUserKey(userName: string): string {
    return userName.trim().toLowerCase();
}

function applyMatchFilters(matches: MatchView[], filters: LobbyState['filters']): MatchView[] {
    if (!filters.showFinished) return [];

    return matches.filter((match) => {
        if (filters.gameType && match.gameType !== filters.gameType) return false;
        if (filters.deckType && match.deckType !== filters.deckType) return false;
        if (!filters.showUnrated && !match.isRated) return false;

        if (filters.searchText) {
            const search = filters.searchText.toLowerCase();
            const matchesSearch =
                match.matchName.toLowerCase().includes(search) ||
                match.players.toLowerCase().includes(search) ||
                match.gameType.toLowerCase().includes(search) ||
                match.deckType.toLowerCase().includes(search) ||
                match.result.toLowerCase().includes(search);
            if (!matchesSearch) return false;
        }

        return true;
    });
}

function getUnresolvedDeckCardNames(deck: DeckCardLists): string[] {
    const cards = [...deck.cards, ...deck.sideboard].filter(card => !card.setCode || !card.cardNumber);
    return [...new Set(cards.map(card => card.cardName))];
}

type TableActionKind = 'leave' | 'remove' | 'start' | 'swap';

function extractErrorMessage(error: unknown): string | null {
    if (!error) return null;
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    const message = String(error).trim();
    return message || null;
}

function describeTableActionFailure(action: TableActionKind, table: TableView | null, error?: unknown): string {
    const isTournament = Boolean(table?.isTournament);
    const subject = isTournament ? 'tournament table' : 'table';
    const detail = extractErrorMessage(error);

    const baseMessage = (() => {
        switch (action) {
            case 'leave':
                return `The server did not leave this ${subject}. It may already be closed, started, or attached to a restored session.`;
            case 'remove':
                return `The server did not remove this ${subject}. It may already be closed, started, or controlled by another host session.`;
            case 'start':
                return `The server did not start this ${isTournament ? 'tournament' : 'match'}. The table may no longer be ready, a player may have left, or host permissions may have changed.`;
            case 'swap':
                return `The server did not move the selected seat. The seating order may have changed, or the table may no longer be waiting.`;
        }
    })();

    return detail ? `${baseMessage} Server response: ${detail}` : baseMessage;
}

function persistLobbyState(state: Pick<LobbyState, 'filters' | 'selectedTableId' | 'tableLayout'>): void {
    appConfigService.saveLobbyConfig({
        filters: { ...state.filters },
        selectedTableId: state.selectedTableId,
        tableLayout: {
            columnOrder: [...state.tableLayout.columnOrder],
            columnWidths: { ...state.tableLayout.columnWidths },
            sort: { ...state.tableLayout.sort },
        },
    });
}

export const useLobbyStore = create<LobbyState & LobbyActions>()(
    devtools(
        immer((set, get) => ({
            // Initial state
            tables: [],
            filteredTables: [],
            selectedTableId: initialLobbyConfig.selectedTableId,
            finishedMatches: [],
            filteredFinishedMatches: [],
            roomUsers: null,
            serverOptions: FALLBACK_LOBBY_SERVER_OPTIONS,
            serverOptionsLoadedAt: null,
            isLoadingOptions: false,
            optionsError: null,
            filters: initialLobbyConfig.filters,
            tableLayout: initialLobbyConfig.tableLayout,
            isLoading: false,
            isJoining: false,
            currentTable: null,
            myDeck: null,
            tableActionError: null,
            pollingInterval: null,
            pendingCreatedTables: {},

            // Fetching
            fetchTables: async () => {
                const { mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return;

                try {
                    const tables = await wsService.send<TableView[]>('roomGetAllTables', [mainRoomId]);
                    set((state) => {
                        const merged = mergeTablesWithPendingCreated(tables, state.pendingCreatedTables);
                        state.pendingCreatedTables = merged.pendingCreatedTables;
                        state.tables = merged.tables;
                        state.filteredTables = applyFilters(merged.tables, state.filters);
                        if (state.selectedTableId && !merged.tables.some(table => table.tableId === state.selectedTableId)) {
                            state.selectedTableId = null;
                            persistLobbyState(state);
                        }
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
                        state.filteredFinishedMatches = applyMatchFilters(matches, state.filters);
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

            loadServerOptions: async (force = false) => {
                const { serverOptionsLoadedAt, isLoadingOptions } = get();
                if (!force && (serverOptionsLoadedAt || isLoadingOptions)) return;

                set((state) => {
                    state.isLoadingOptions = true;
                    state.optionsError = null;
                });

                try {
                    const options = await webSocketBridgeService.getLobbyServerOptions();
                    set((state) => {
                        state.serverOptions = options;
                        state.serverOptionsLoadedAt = new Date().toISOString();
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn('Failed to load lobby server options:', error);
                    set((state) => {
                        state.serverOptions = normalizeLobbyServerOptions(null);
                        state.optionsError = message;
                    });
                } finally {
                    set((state) => { state.isLoadingOptions = false; });
                }
            },

            refreshAll: async () => {
                set((state) => { state.isLoading = true; });

                await Promise.all([
                    get().fetchTables(),
                    get().fetchFinishedMatches(),
                    get().fetchRoomUsers(),
                    get().loadServerOptions(),
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
                    get().fetchFinishedMatches();
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

                    if (!table?.tableId) {
                        await get().fetchTables();
                        return null;
                    }

                    set((state) => {
                        state.pendingCreatedTables[table.tableId] = {
                            table,
                            createdAt: Date.now(),
                        };
                        const merged = mergeTablesWithPendingCreated(state.tables, state.pendingCreatedTables);
                        state.pendingCreatedTables = merged.pendingCreatedTables;
                        state.tables = merged.tables;
                        state.filteredTables = applyFilters(merged.tables, state.filters);
                        state.selectedTableId = table.tableId;
                    });

                    void get().fetchTables();

                    return table;
                } catch (error) {
                    console.error('Failed to create table:', error);
                    throw error;
                }
            },

            createTournament: async (options) => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return null;

                try {
                    const table = await webSocketBridgeService.createTournament(sessionId, mainRoomId, options);

                    if (!table?.tableId) {
                        await get().fetchTables();
                        return null;
                    }

                    set((state) => {
                        state.pendingCreatedTables[table.tableId] = {
                            table,
                            createdAt: Date.now(),
                        };
                        const merged = mergeTablesWithPendingCreated(state.tables, state.pendingCreatedTables);
                        state.pendingCreatedTables = merged.pendingCreatedTables;
                        state.tables = merged.tables;
                        state.filteredTables = applyFilters(merged.tables, state.filters);
                        state.selectedTableId = table.tableId;
                    });

                    void get().fetchTables();

                    return table;
                } catch (error) {
                    console.error('Failed to create tournament:', error);
                    throw error;
                }
            },

            joinTable: async (tableId, playerName, deckList, password = '') => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return false;
                const table = get().currentTable?.tableId === tableId
                    ? get().currentTable
                    : get().tables.find(candidate => candidate.tableId === tableId) ?? null;

                const unresolvedCards = getUnresolvedDeckCardNames(deckList);
                if (unresolvedCards.length > 0) {
                    throw new Error(`Unresolved cards: ${unresolvedCards.slice(0, 8).join(', ')}. Check the deck text before joining.`);
                }

                set((state) => { state.isJoining = true; });

                try {
                    const result = table?.isTournament
                        ? await webSocketBridgeService.joinTournamentTable(
                            sessionId,
                            mainRoomId,
                            tableId,
                            playerName,
                            'Human',
                            5,
                            deckList,
                            password,
                        )
                        : await wsService.send<boolean>('roomJoinTable', [
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

            addAI: async (tableId: UUID, aiName: string, deckList: DeckCardLists, playerType: string, skill = 2) => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return false;
                const table = get().currentTable?.tableId === tableId
                    ? get().currentTable
                    : get().tables.find(candidate => candidate.tableId === tableId) ?? null;

                const unresolvedCards = getUnresolvedDeckCardNames(deckList);
                if (unresolvedCards.length > 0) {
                    console.error('Cannot add AI with unresolved cards:', unresolvedCards);
                    return false;
                }

                try {
                    // Re-use the matching join path with the server-provided default computer type.
                    // Note: This relies on the server allowing the same Session/User to add a Computer player
                    const effectivePlayerType = playerType || getDefaultComputerPlayerType(get().serverOptions);
                    const result = table?.isTournament
                        ? await webSocketBridgeService.joinTournamentTable(
                            sessionId,
                            mainRoomId,
                            tableId,
                            aiName,
                            effectivePlayerType,
                            skill,
                            deckList,
                            '',
                        )
                        : await wsService.send<boolean>('roomJoinTable', [
                            sessionId,
                            mainRoomId,
                            tableId,
                            aiName,
                            effectivePlayerType,
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

            swapSeats: async (tableId, fromSeatIndex, toSeatIndex) => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return false;
                const table = get().currentTable?.tableId === tableId
                    ? get().currentTable
                    : get().tables.find(candidate => candidate.tableId === tableId) ?? null;

                set((state) => { state.tableActionError = null; });

                try {
                    const result = await webSocketBridgeService.swapSeats(
                        sessionId,
                        mainRoomId,
                        tableId,
                        fromSeatIndex,
                        toSeatIndex,
                    );

                    if (result) {
                        const updated = await wsService.send<TableView>('roomGetTableById', [mainRoomId, tableId]);
                        set((state) => {
                            state.currentTable = updated;
                            const tableIndex = state.tables.findIndex(table => table.tableId === tableId);
                            if (tableIndex >= 0) {
                                state.tables[tableIndex] = updated;
                                state.filteredTables = applyFilters(state.tables, state.filters);
                            }
                        });
                    } else {
                        set((state) => {
                            state.tableActionError = describeTableActionFailure('swap', table);
                        });
                    }

                    return result;
                } catch (error) {
                    console.error('Failed to swap seats:', error);
                    set((state) => {
                        state.tableActionError = describeTableActionFailure('swap', table, error);
                    });
                    return false;
                }
            },

            removeTable: async (tableId) => {
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId) return false;
                const table = get().currentTable?.tableId === tableId
                    ? get().currentTable
                    : get().tables.find(candidate => candidate.tableId === tableId) ?? null;

                set((state) => { state.tableActionError = null; });

                try {
                    const result = await webSocketBridgeService.removeTable(sessionId, mainRoomId, tableId);

                    if (result) {
                        set((state) => {
                            state.currentTable = state.currentTable?.tableId === tableId ? null : state.currentTable;
                            state.tables = state.tables.filter(table => table.tableId !== tableId);
                            state.filteredTables = applyFilters(state.tables, state.filters);
                            if (state.selectedTableId === tableId) {
                                state.selectedTableId = null;
                                persistLobbyState(state);
                            }
                        });
                        void get().fetchTables();
                    } else {
                        set((state) => {
                            state.tableActionError = describeTableActionFailure('remove', table);
                        });
                    }

                    return result;
                } catch (error) {
                    console.error('Failed to remove table:', error);
                    set((state) => {
                        state.tableActionError = describeTableActionFailure('remove', table, error);
                    });
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
                if (!mainRoomId || !currentTable) {
                    set((state) => {
                        state.tableActionError = 'There is no active table session to leave.';
                    });
                    return false;
                }

                set((state) => { state.tableActionError = null; });

                if (!currentTable.tableId) {
                    console.error('Cannot leave table: tableId is missing', currentTable);
                    set((state) => {
                        state.currentTable = null;
                        state.tableActionError = 'The table session was missing its table id, so the local waiting room was cleared.';
                    });
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
                    } else {
                        set((state) => {
                            state.tableActionError = describeTableActionFailure('leave', currentTable);
                        });
                    }

                    return result;
                } catch (error) {
                    console.error('Failed to leave table:', error);
                    set((state) => {
                        state.tableActionError = describeTableActionFailure('leave', currentTable, error);
                    });
                    return false;
                }
            },

            clearCurrentTable: () => {
                set((state) => { state.currentTable = null; });
            },

            startTable: async () => {
                const { currentTable } = get();
                const { sessionId, mainRoomId } = useSessionStore.getState();
                if (!mainRoomId || !currentTable) {
                    set((state) => {
                        state.tableActionError = 'There is no ready table session to start.';
                    });
                    return false;
                }

                set((state) => { state.tableActionError = null; });

                try {
                    if (currentTable.isTournament) {
                        const result = await webSocketBridgeService.startTournamentTable(
                            sessionId,
                            mainRoomId,
                            currentTable.tableId,
                        );
                        if (!result) {
                            set((state) => {
                                state.tableActionError = describeTableActionFailure('start', currentTable);
                            });
                        }
                        return result;
                    }

                    const result = await wsService.send<boolean>('matchStart', [
                        sessionId,
                        mainRoomId,
                        currentTable.tableId,
                    ]);
                    if (!result) {
                        set((state) => {
                            state.tableActionError = describeTableActionFailure('start', currentTable);
                        });
                    }
                    return result;
                } catch (error) {
                    console.error('Failed to start table:', error);
                    set((state) => {
                        state.tableActionError = describeTableActionFailure('start', currentTable, error);
                    });
                    return false;
                }
            },

            clearTableActionError: () => {
                set((state) => { state.tableActionError = null; });
            },

            // Selection
            selectTable: (tableId) => {
                set((state) => {
                    state.selectedTableId = tableId;
                    persistLobbyState(state);
                });
            },

            // Filters
            setFilter: (key, value) => {
                set((state) => {
                    state.filters[key] = value;
                    state.filteredTables = applyFilters(state.tables, state.filters);
                    state.filteredFinishedMatches = applyMatchFilters(state.finishedMatches, state.filters);
                    persistLobbyState(state);
                });
            },

            resetFilters: () => {
                set((state) => {
                    state.filters = { ...defaultFilters };
                    state.filteredTables = applyFilters(state.tables, state.filters);
                    state.filteredFinishedMatches = applyMatchFilters(state.finishedMatches, state.filters);
                    persistLobbyState(state);
                });
            },

            setTableSort: (sort) => {
                set((state) => {
                    state.tableLayout.sort = sort;
                    persistLobbyState(state);
                });
            },

            setTableColumnOrder: (columnOrder) => {
                set((state) => {
                    state.tableLayout.columnOrder = columnOrder;
                    persistLobbyState(state);
                });
            },

            setTableColumnWidth: (key, width) => {
                set((state) => {
                    state.tableLayout.columnWidths[key] = width;
                    persistLobbyState(state);
                });
            },

            resetTableLayout: () => {
                set((state) => {
                    state.tableLayout = {
                        columnOrder: [...DEFAULT_LOBBY_CONFIG.tableLayout.columnOrder],
                        columnWidths: { ...DEFAULT_LOBBY_CONFIG.tableLayout.columnWidths },
                        sort: { ...DEFAULT_LOBBY_CONFIG.tableLayout.sort },
                    };
                    persistLobbyState(state);
                });
            },

            refreshTableFilters: () => {
                set((state) => {
                    state.filteredTables = applyFilters(state.tables, state.filters);
                    state.filteredFinishedMatches = applyMatchFilters(state.finishedMatches, state.filters);
                    if (state.selectedTableId && !state.filteredTables.some(table => table.tableId === state.selectedTableId)) {
                        state.selectedTableId = null;
                        persistLobbyState(state);
                    }
                });
            },

            // Callbacks
            handleCallback: (callback) => {
                switch (callback.method) {
                    case 'joinedTable': {
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
                }
            },
        })),
        { name: 'LobbyStore' }
    )
);
