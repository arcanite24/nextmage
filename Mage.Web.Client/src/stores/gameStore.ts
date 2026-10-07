/**
 * Game Store
 * 
 * Manages in-game state including game view, pending actions, and game controls.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { webSocketBridgeService, wsService } from '../services';
import { resolvePlayerControlIdentityFromGameView } from '../services/GameViewPlayerControlService';
import { isPrioritySelectPrompt } from '../services/BattlefieldPerformanceService';
import { useSessionStore } from './sessionStore';
import { useLobbyStore } from './lobbyStore';
import { useDebugStore } from './debugStore';
import {
    UUID,
    GameView,
    PlayerView,
    CardView,
    PermanentView,
    AbilityPickerView,
    GameEndView,
    EndGameInfo,
    ClientCallback,
    PlayerAction,
    ManaType,
    DeckView,
    DeckCardLists,
    TableClientMessage,
} from '../types';

const firstGameViewsByGameId = new Map<UUID, GameView>();

export type GameZoneView =
    | 'graveyard'
    | 'exile'
    | 'library'
    | 'sideboard'
    | 'command'
    | 'commanders'
    | 'commandEmblems'
    | 'dungeons'
    | 'planes'
    | 'commandOther'
    | 'topLibrary'
    | 'exileGroup'
    | 'revealed'
    | 'lookedAt'
    | 'companion'
    | 'emblems'
    | 'opponentHand'
    | 'watchedHand';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringValue(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function extractGameView(data: unknown): GameView | null {
    if (!isRecord(data)) return null;

    if (isRecord(data.gameView)) {
        return data.gameView as unknown as GameView;
    }

    if ('players' in data || 'myPlayerId' in data || 'turn' in data) {
        return data as unknown as GameView;
    }

    return null;
}

function createRequestUuid(): UUID {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return '00000000-0000-4000-8000-000000000000';
}

function optionBoolean(options: Record<string, any> | undefined, keys: string[], fallback = false): boolean {
    if (!options) return fallback;
    for (const key of keys) {
        const value = options[key];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true') return true;
            if (normalized === 'false') return false;
        }
    }
    return fallback;
}

function optionNumber(options: Record<string, any> | undefined, keys: string[], fallback: number | undefined): number | undefined {
    if (!options) return fallback;
    for (const key of keys) {
        const value = Number(options[key]);
        if (Number.isFinite(value)) return value;
    }
    return fallback;
}

function isOrderPrompt(message: string, options?: Record<string, any>): boolean {
    if (optionBoolean(options, ['ordered', 'order', 'orderSelection', 'chooseOrder', 'isOrder'], false)) {
        return true;
    }
    return /\b(order|ORDER)\b/.test(message) || /last one chosen/i.test(message);
}

function syncPlayerControlIdentity(
    state: { playerId: UUID | null; isWatching: boolean },
    gameView: GameView | null | undefined,
): void {
    const nextIdentity = resolvePlayerControlIdentityFromGameView(
        {
            playerId: state.playerId,
            isWatching: state.isWatching,
        },
        gameView,
    );
    state.playerId = nextIdentity.playerId;
    state.isWatching = nextIdentity.isWatching;
}

// === Pending Action Types ===

export interface SideboardAction {
    type: 'sideboarding';
    deck: DeckView;
    tableId: UUID;
    time: number;
}

export type PendingAction =
    | { type: 'none' }
    | { type: 'ask'; message: string; gameView: GameView; options?: Record<string, any> }
    | { type: 'priority'; message: string; gameView: GameView; options?: Record<string, any> }
    | { type: 'target'; message: string; validTargets: UUID[]; gameView: GameView; options?: Record<string, any>; cardsView?: Record<string, CardView>; required?: boolean; min?: number; max?: number; orderSelection?: boolean }
    | { type: 'select'; message: string; gameView: GameView; options?: Record<string, any>; cardsView?: Record<string, CardView>; required?: boolean; min?: number; max?: number; orderSelection?: boolean }
    | { type: 'chooseAbility'; abilities: AbilityPickerView }
    | {
        type: 'choosePile';
        message: string;
        pile1: Record<string, CardView>;
        pile2: Record<string, CardView>;
        gameView: GameView;
    }
    | {
        type: 'chooseChoice';
        message: string;
        choices: string[];
        keyChoices: Record<string, string>;
        hintData?: Record<string, string[]>;
        hintType?: string;
        required?: boolean;
        specialEnabled?: boolean;
        specialCanBeEmpty?: boolean;
        specialText?: string;
        specialHint?: string;
        searchEnabled?: boolean;
        manaColorChoice?: boolean;
    }
    | { type: 'mana'; message: string; gameView: GameView }
    | { type: 'xmana'; message: string; gameView: GameView }
    | { type: 'amount'; min: number; max: number; message: string; gameView: GameView }
    | {
        type: 'multiAmount';
        messages: MultiAmountMessage[];
        min: number;
        max: number;
        gameView: GameView;
    }
    | SideboardAction;

// Multi-amount message structure (for distributing damage/counters)
export interface MultiAmountMessage {
    message: string;
    min: number;
    max: number;
    defaultValue: number;
}

interface GameState {
    // Core game state
    gameId: UUID | null;
    playerId: UUID | null;
    gameView: GameView | null;
    isWatching: boolean;

    // Pending action
    pendingAction: PendingAction;

    // Game end
    gameEnded: boolean;
    gameEndView: GameEndView | null;
    endGameInfo: EndGameInfo | null;

    // UI State
    selectedCardId: UUID | null;
    hoveredCardId: UUID | null;
    showingZone: GameZoneView | null;
    showingPlayerId: string | null;

    // Skip actions
    activeSkip: 'none' | 'F4' | 'F5' | 'F6' | 'F7' | 'F9' | 'F10' | 'F11';
    arenaSkipEnabled: boolean;

    // Informational messages
    lastMessage: string | null;
    lastError: string | null;

    // Loading states
    isLoading: boolean;
}

interface GameActions {
    // Game lifecycle
    initGame: (gameId: UUID, playerId: UUID | null) => void;
    joinGame: (gameId: UUID) => Promise<boolean>;
    watchGame: (gameId: UUID) => Promise<boolean>;
    updateGameView: (gameView: GameView) => void;
    endGame: (gameEndView: GameEndView) => void;
    setEndGameInfo: (info: EndGameInfo) => void;
    leaveGame: () => Promise<void>;

    // Player actions
    passPriority: () => Promise<void>;
    passPriorityUntilEndOfTurn: () => Promise<void>;
    passPriorityUntilNextTurnSkipStack: () => Promise<void>;
    passPriorityUntilNextMain: () => Promise<void>;
    passPriorityUntilStackResolved: () => Promise<void>;
    passPriorityUntilNextTurn: () => Promise<void>;
    passPriorityUntilMyNextTurn: () => Promise<void>;
    passPriorityUntilEndStepBeforeMyTurn: () => Promise<void>;
    holdPriority: () => Promise<void>;
    cancelPassActions: () => Promise<void>;
    toggleArenaSkip: () => Promise<void>;
    concede: () => Promise<void>;
    undo: () => Promise<void>;
    stopWatching: () => Promise<void>;
    stopReplay: () => Promise<void>;

    // Responses
    sendPlayerAction: (action: PlayerAction, data?: unknown) => Promise<void>;
    sendUUID: (uuid: UUID | null) => Promise<void>;
    sendBoolean: (value: boolean) => Promise<void>;
    sendInteger: (value: number) => Promise<void>;
    sendString: (value: string) => Promise<void>;
    sendManaType: (manaType: ManaType) => Promise<void>;

    // UI
    selectCard: (cardId: UUID | null) => void;
    hoverCard: (cardId: UUID | null) => void;
    showZone: (zone: GameZoneView | null, playerId?: string | null) => void;

    // Deck
    submitDeck: (tableId: UUID, deck: DeckView | DeckCardLists) => Promise<boolean>;

    // Callbacks
    handleCallback: (callback: ClientCallback) => void;

    // Helpers
    getMyPlayer: () => PlayerView | null;
    getOpponents: () => PlayerView[];
    getCardById: (cardId: UUID) => CardView | PermanentView | null;
}

export const useGameStore = create<GameState & GameActions>()(
    devtools(
        immer((set, get) => ({
            // Initial state
            gameId: null,
            playerId: null,
            gameView: null,
            isWatching: false,
            pendingAction: { type: 'none' },
            gameEnded: false,
            gameEndView: null,
            endGameInfo: null,
            selectedCardId: null,
            hoveredCardId: null,
            showingZone: null,
            showingPlayerId: null,
            activeSkip: 'none',
            arenaSkipEnabled: false,
            lastMessage: null,
            lastError: null,
            isLoading: false,

            // Game lifecycle
            initGame: (gameId, playerId) => {
                set((state) => {
                    state.gameId = gameId;
                    state.playerId = playerId;
                    state.isWatching = playerId === null;
                    state.gameEnded = false;
                    state.gameEndView = null;
                    state.endGameInfo = null;
                    state.pendingAction = { type: 'none' };
                });
                useDebugStore.getState().startNewMatch(gameId);
            },

            joinGame: async (gameId: UUID) => {
                const { sessionId } = useSessionStore.getState();
                const { initGame } = get();

                console.log('[GameStore] Manual joining game:', gameId);

                try {
                    await wsService.send('gameJoin', [gameId, sessionId]);

                    // Initialize local state only after the server accepts the join.
                    // The server will tell us our playerId in gameInit/gameUpdate.
                    initGame(gameId, null);
                    useLobbyStore.getState().clearCurrentTable();
                    return true;
                } catch (error) {
                    console.error('Failed to join game:', error);
                    set((state) => { state.lastError = `Failed to join game: ${error}`; });
                    return false;
                }
            },

            watchGame: async (gameId: UUID) => {
                const { sessionId } = useSessionStore.getState();
                const { initGame } = get();

                try {
                    await wsService.send('gameWatchStart', [gameId, sessionId]);
                    initGame(gameId, null);
                    useLobbyStore.getState().clearCurrentTable();
                    return true;
                } catch (error) {
                    console.error('Failed to watch game:', error);
                    set((state) => { state.lastError = `Failed to watch game: ${error}`; });
                    return false;
                }
            },

            submitDeck: async (tableId: UUID, deck: DeckView | DeckCardLists) => {
                const { sessionId } = useSessionStore.getState();
                try {
                    await webSocketBridgeService.submitDeck(sessionId, tableId, deck);
                    set((state) => {
                        state.pendingAction = { type: 'none' };
                    });
                    return true;
                } catch (error) {
                    console.error('Failed to submit deck:', error);
                    set((state) => { state.lastError = `Failed to submit deck: ${error}`; });
                    return false;
                }
            },

            updateGameView: (gameView) => {
                set((state) => {
                    state.gameView = gameView;
                    state.lastError = null;
                    // Ensure we know who 'we' are if the view tells us.
                    syncPlayerControlIdentity(state, gameView);

                    // Sync activeSkip state from server's player view
                    const myPlayer = gameView.players?.find(p => p.playerId === gameView.myPlayerId);
                    if (myPlayer) {
                        // Determine active skip based on server state
                        if (myPlayer.passedUntilEndStepBeforeMyTurn) {
                            state.activeSkip = 'F11';
                        } else if (myPlayer.passedAllTurns) {
                            state.activeSkip = 'F9';
                        } else if (myPlayer.passedTurn) {
                            state.activeSkip = 'F4';
                        } else if (myPlayer.passedUntilEndOfTurn) {
                            state.activeSkip = 'F5';
                        } else if (myPlayer.passedUntilNextMain) {
                            state.activeSkip = 'F7';
                        } else if (myPlayer.passedUntilStackResolved) {
                            state.activeSkip = 'F10';
                        } else {
                            state.activeSkip = 'none';
                        }
                    }
                });
            },

            // ... (rest of the file)

            // Helpers
            getMyPlayer: () => {
                const { gameView, playerId } = get();
                if (!gameView || !gameView.players) return null;

                // Prefer the ID from the view itself if available, otherwise store state
                const targetId = gameView.myPlayerId || playerId;
                if (!targetId) return null;

                return gameView.players.find(p => p.playerId === targetId) || null;
            },

            getOpponents: () => {
                const { gameView, playerId } = get();
                if (!gameView || !gameView.players) return [];

                const targetId = gameView.myPlayerId || playerId;
                // If we don't know who we are, everyone is an 'opponent' (or we are spectator)
                if (!targetId) return gameView.players;

                return gameView.players.filter(p => p.playerId !== targetId);
            },

            endGame: (gameEndView) => {
                set((state) => {
                    state.gameEnded = true;
                    // Only update gameEndView if we don't have richer info yet? 
                    // Or merge? For now, we trust the server sent valid GameEndView
                    state.gameEndView = gameEndView;
                    state.pendingAction = { type: 'none' };
                });
            },

            setEndGameInfo: (info) => {
                set((state) => {
                    state.gameEnded = true;
                    state.endGameInfo = info;
                    state.pendingAction = { type: 'none' };
                });
            },

            leaveGame: async () => {
                const { gameId, isWatching } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    if (isWatching) {
                        await wsService.send('gameWatchStop', [gameId, sessionId]);
                    } else {
                        await wsService.send('matchQuit', [gameId, sessionId]);
                    }
                } catch (error) {
                    console.error('Failed to leave game:', error);
                }

                set((state) => {
                    state.gameId = null;
                    state.playerId = null;
                    state.gameView = null;
                    state.pendingAction = { type: 'none' };
                    state.gameEnded = false;
                    state.gameEndView = null;
                    state.endGameInfo = null;
                });
                useDebugStore.getState().endMatch();
            },

            // Player actions (F-key equivalents)
            passPriority: async () => {
                set((state) => { state.activeSkip = 'none'; });
                await get().sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
            },

            passPriorityUntilEndOfTurn: async () => {
                set((state) => { state.activeSkip = 'F5'; });
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_TURN_END_STEP');
            },

            passPriorityUntilNextTurnSkipStack: async () => {
                set((state) => { state.activeSkip = 'F6'; });
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_NEXT_TURN_SKIP_STACK');
            },

            passPriorityUntilNextMain: async () => {
                set((state) => { state.activeSkip = 'F7'; });
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE');
            },

            passPriorityUntilStackResolved: async () => {
                set((state) => { state.activeSkip = 'F10'; });
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_STACK_RESOLVED');
            },

            passPriorityUntilNextTurn: async () => {
                set((state) => { state.activeSkip = 'F4'; });
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_NEXT_TURN');
            },

            passPriorityUntilMyNextTurn: async () => {
                set((state) => { state.activeSkip = 'F9'; });
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_MY_NEXT_TURN');
            },

            passPriorityUntilEndStepBeforeMyTurn: async () => {
                set((state) => { state.activeSkip = 'F11'; });
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_END_STEP_BEFORE_MY_NEXT_TURN');
            },

            holdPriority: async () => {
                await get().sendPlayerAction('HOLD_PRIORITY');
            },

            cancelPassActions: async () => {
                set((state) => {
                    state.activeSkip = 'none';
                    state.arenaSkipEnabled = false;
                });
                await get().sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
            },

            toggleArenaSkip: async () => {
                const { arenaSkipEnabled } = get();
                if (arenaSkipEnabled) {
                    // Turn off: cancel all pass actions
                    await get().cancelPassActions();
                } else {
                    // Turn on: set skip to next main phase (Arena-like behavior)
                    set((state) => {
                        state.arenaSkipEnabled = true;
                        state.activeSkip = 'F7';
                    });
                    await get().sendPlayerAction('PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE');
                }
            },

            concede: async () => {
                await get().sendPlayerAction('CONCEDE');
            },

            undo: async () => {
                await get().sendPlayerAction('UNDO');
            },

            stopWatching: async () => {
                const { gameId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    await wsService.send('gameWatchStop', [gameId, sessionId]);
                    set((state) => {
                        state.gameId = null;
                        state.playerId = null;
                        state.gameView = null;
                        state.isWatching = false;
                        state.pendingAction = { type: 'none' };
                        state.gameEnded = false;
                        state.gameEndView = null;
                        state.endGameInfo = null;
                    });
                    useDebugStore.getState().endMatch();
                } catch (error) {
                    console.error('Failed to stop watching:', error);
                    set((state) => { state.lastError = `Stop watching failed: ${error}`; });
                }
            },

            stopReplay: async () => {
                const { gameId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    await wsService.send('replayStop', [gameId, sessionId]);
                } catch (error) {
                    console.error('Failed to stop replay:', error);
                    set((state) => { state.lastError = `Stop replay failed: ${error}`; });
                }
            },

            // Responses
            sendPlayerAction: async (action, data = null) => {
                const { gameId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    await wsService.send('sendPlayerAction', [action, gameId, sessionId, data]);
                } catch (error) {
                    console.error('Failed to send player action:', error);
                    set((state) => { state.lastError = `Action failed: ${error}`; });
                }
            },

            sendUUID: async (uuid) => {
                const { gameId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    await wsService.send('sendPlayerUUID', [gameId, sessionId, uuid]);
                    set((state) => { state.pendingAction = { type: 'none' }; });
                } catch (error) {
                    console.error('Failed to send UUID:', error);
                    set((state) => { state.lastError = `Failed to select: ${error}`; });
                }
            },

            sendBoolean: async (value) => {
                const { gameId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    await wsService.send('sendPlayerBoolean', [gameId, sessionId, value]);
                    set((state) => { state.pendingAction = { type: 'none' }; });
                } catch (error) {
                    console.error('Failed to send boolean:', error);
                    set((state) => { state.lastError = `Failed to respond: ${error}`; });
                }
            },

            sendInteger: async (value) => {
                const { gameId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    await wsService.send('sendPlayerInteger', [gameId, sessionId, value]);
                    set((state) => { state.pendingAction = { type: 'none' }; });
                } catch (error) {
                    console.error('Failed to send integer:', error);
                    set((state) => { state.lastError = `Failed to respond: ${error}`; });
                }
            },

            sendString: async (value) => {
                const { gameId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId) return;

                try {
                    await wsService.send('sendPlayerString', [gameId, sessionId, value]);
                    set((state) => { state.pendingAction = { type: 'none' }; });
                } catch (error) {
                    console.error('Failed to send string:', error);
                    set((state) => { state.lastError = `Failed to respond: ${error}`; });
                }
            },

            sendManaType: async (manaType) => {
                const { gameId, playerId } = get();
                const { sessionId } = useSessionStore.getState();

                if (!gameId || !playerId) return;

                try {
                    await wsService.send('sendPlayerManaType', [gameId, playerId, sessionId, manaType]);
                } catch (error) {
                    console.error('Failed to send mana type:', error);
                    set((state) => { state.lastError = `Failed to select mana: ${error}`; });
                }
            },

            // UI
            selectCard: (cardId) => {
                set((state) => { state.selectedCardId = cardId; });
            },

            hoverCard: (cardId) => {
                set((state) => { state.hoveredCardId = cardId; });
            },

            showZone: (zone, playerId = null) => {
                set((state) => {
                    state.showingZone = zone;
                    state.showingPlayerId = playerId;
                });
            },

            // Callbacks
            handleCallback: (callback) => {
                useDebugStore.getState().recordAction(callback);
                const { updateGameView, endGame, joinGame, watchGame } = get();
                const earlyGameView = extractGameView(callback.data);

                if (callback.objectId && earlyGameView && !firstGameViewsByGameId.has(callback.objectId)) {
                    firstGameViewsByGameId.set(callback.objectId, earlyGameView);
                }

                switch (callback.method) {
                    case 'startGame': {
                        // Server signals game start. We must join the game.
                        // payload can be an object {gameId, playerId} or an array [gameId, playerId]
                        console.log('[GameStore] startGame callback received:', callback.data);

                        let gameId: UUID | null = null;
                        let playerId: UUID | null = null; // Sometimes sent, but we might not need it for joinGame

                        const data = callback.data as any;
                        if (Array.isArray(data)) {
                            gameId = data[0];
                            playerId = data[1] || null;
                        } else if (typeof data === 'object' && data !== null) {
                            gameId = data.gameId || data.id;
                            playerId = data.playerId;
                        } else if (typeof data === 'string') {
                            gameId = data;
                        }

                        if (gameId) {
                            console.log('[GameStore] Joining game:', gameId);
                            joinGame(gameId).then(joined => {
                                if (!joined) {
                                    console.error('[GameStore] gameJoin failed after startGame callback:', gameId, playerId);
                                    return;
                                }

                                const cachedGameView = firstGameViewsByGameId.get(gameId);
                                if (cachedGameView) {
                                    console.warn('[GameStore] Recovered game data that arrived before startGame:', gameId);
                                    updateGameView(cachedGameView);
                                    const sessionId = useSessionStore.getState().sessionId;
                                    wsService.send('sendPlayerUUID', [gameId, sessionId, createRequestUuid()]).catch(error => {
                                        console.warn('[GameStore] Failed to request latest game data after reconnect recovery:', error);
                                    });
                                }
                            });
                        } else {
                            console.error('[GameStore] Received startGame but could not parse gameId:', callback.data);
                        }
                        break;
                    }

                    case 'watchGame': {
                        const gameId = callback.objectId
                            ?? (isRecord(callback.data) ? readStringValue(callback.data.gameId) : null)
                            ?? (isRecord(callback.data) ? readStringValue(callback.data.id) : null);

                        if (gameId) {
                            watchGame(gameId).catch(error => {
                                console.error('[GameStore] gameWatchStart failed after watchGame callback:', gameId, error);
                            });
                        } else {
                            console.error('[GameStore] Received watchGame but could not parse gameId:', callback.data);
                        }
                        break;
                    }

                    case 'gameInit':
                    case 'gameUpdate':
                        updateGameView(callback.data as GameView);
                        set((state) => { state.pendingAction = { type: 'none' }; });
                        break;

                    case 'gameInform':
                        updateGameView(callback.data as GameView);
                        // Could extract message from callback and display
                        break;

                    case 'gameUpdateAndInform': {
                        // GAME_UPDATE_AND_INFORM contains both a gameView AND a message
                        // Structure: { gameView: GameView, message: string, flag: boolean, min: number, max: number }
                        const data = callback.data as {
                            gameView?: GameView;
                            message?: string;
                            flag?: boolean;
                            min?: number;
                            max?: number;
                        };

                        if (data.gameView) {
                            updateGameView(data.gameView);
                        } else if (callback.data) {
                            updateGameView(callback.data as GameView);
                        }

                        // Store the message for display in the UI
                        if (data.message) {
                            set((state) => {
                                state.lastMessage = data.message || null;
                            });
                        }
                        break;
                    }

                    case 'gameAsk':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'ask',
                                message: data.message || 'Respond?',
                                gameView: state.gameView!,
                                options: data.options,
                            };
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gameTarget':
                        set((state) => {
                            const data = callback.data as any;
                            const message = data.message || 'Select target';
                            const options = data.options;
                            const min = data.min ?? optionNumber(options, ['min', 'minimum', 'minTargets', 'minNumberOfTargets'], data.flag ? 1 : 0);
                            const max = data.max ?? optionNumber(options, ['max', 'maximum', 'maxTargets', 'maxNumberOfTargets'], 1);
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'target',
                                message,
                                validTargets: data.targets || [],
                                gameView: state.gameView!,
                                required: data.flag ?? min > 0, // 'flag' indicates required in GameClientMessage
                                options,
                                cardsView: data.cardsView1,
                                min,
                                max,
                                orderSelection: isOrderPrompt(message, options),
                            };
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gameSelect':
                        set((state) => {
                            const data = callback.data as any;
                            const message = data.message || 'Select';
                            const options = data.options;
                            const min = data.min ?? optionNumber(options, ['min', 'minimum', 'minChoices', 'minNumberOfTargets'], 0);
                            const max = data.max ?? optionNumber(options, ['max', 'maximum', 'maxChoices', 'maxNumberOfTargets'], 1);
                            state.gameView = data.gameView || data;
                            if (isPrioritySelectPrompt(message)) {
                                state.pendingAction = {
                                    type: 'priority',
                                    message,
                                    gameView: state.gameView!,
                                    options,
                                };
                            } else {
                                state.pendingAction = {
                                    type: 'select',
                                    message,
                                    gameView: state.gameView!,
                                    required: optionBoolean(options, ['required'], min > 0),
                                    options,
                                    cardsView: data.cardsView1,
                                    min,
                                    max,
                                    orderSelection: isOrderPrompt(message, options),
                                };
                            }
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gameChooseAbility':
                        set((state) => {
                            // This might just be AbilityPickerView
                            state.pendingAction = {
                                type: 'chooseAbility',
                                abilities: callback.data as AbilityPickerView,
                            };
                        });
                        break;

                    case 'gameChooseChoice':
                        set((state) => {
                            const data = callback.data as any;
                            // The choice object is nested: data.choice contains the actual choice info
                            const choice = data.choice || data;

                            // Update game view if provided
                            if (data.gameView) {
                                state.gameView = data.gameView;
                                syncPlayerControlIdentity(state, state.gameView);
                            }

                            state.pendingAction = {
                                type: 'chooseChoice',
                                message: choice.message || 'Make a choice',
                                choices: choice.choices || [],
                                keyChoices: choice.keyChoices || {},
                                hintData: choice.hintData,
                                hintType: choice.hintType,
                                required: choice.required,
                                specialEnabled: choice.specialEnabled,
                                specialCanBeEmpty: choice.specialCanBeEmpty,
                                specialText: choice.specialText,
                                specialHint: choice.specialHint,
                                searchEnabled: choice.searchEnabled,
                                manaColorChoice: choice.manaColorChoice,
                            };
                        });
                        break;

                    case 'gamePlayMana':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'mana',
                                message: data.message || 'Pay mana',
                                gameView: state.gameView!,
                            };
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gamePlayXMana':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'xmana',
                                message: data.message || 'Choose X value',
                                gameView: state.gameView!,
                            };
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gameGetAmount':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || state.gameView;
                            state.pendingAction = {
                                type: 'amount',
                                message: data.message || 'Choose a number',
                                min: data.min ?? 0,
                                max: data.max ?? 999,
                                gameView: state.gameView!,
                            };
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gameGetMultiAmount':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || state.gameView;
                            state.pendingAction = {
                                type: 'multiAmount',
                                messages: data.messages || [],
                                min: data.min ?? 0,
                                max: data.max ?? 999,
                                gameView: state.gameView!,
                            };
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gameChoosePile':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || state.gameView;
                            state.pendingAction = {
                                type: 'choosePile',
                                message: data.message || 'Choose a pile',
                                pile1: data.cardsView1 || data.pile1 || {},
                                pile2: data.cardsView2 || data.pile2 || {},
                                gameView: state.gameView!,
                            };
                            syncPlayerControlIdentity(state, state.gameView);
                        });
                        break;

                    case 'gameInformPersonal':
                        // Personal message to the player - show as a brief notification
                        set((state) => {
                            const data = callback.data as any;
                            state.lastMessage = data.message || String(data);
                            // Also update game view if provided
                            if (data.gameView) {
                                state.gameView = data.gameView;
                            }
                        });
                        break;

                    case 'gameError':
                        set((state) => {
                            state.lastError = callback.data as string;
                        });
                        break;

                    case 'gameOver':
                        if (callback.objectId) {
                            firstGameViewsByGameId.delete(callback.objectId);
                        }
                        endGame(callback.data as GameEndView);
                        break;

                    case 'endGameInfo':
                        // This provides richer info than gameOver
                        get().setEndGameInfo(callback.data as EndGameInfo);
                        break;

                    case 'SIDEBOARD':
                    case 'sideboard':
                        set((state) => {
                            const message = callback.data as TableClientMessage;
                            if (message.deck) {
                                state.pendingAction = {
                                    type: 'sideboarding',
                                    deck: message.deck,
                                    tableId: message.currentTableId,
                                    time: message.time || 0
                                };
                            }
                        });
                        break;
                }
            },


            getCardById: (cardId) => {
                const { gameView } = get();
                if (!gameView) return null;

                // Check hand
                if (gameView.myHand && gameView.myHand[cardId]) return gameView.myHand[cardId];

                // Check stack
                if (gameView.stack && gameView.stack[cardId]) return gameView.stack[cardId];

                // Check all player zones
                if (gameView.players) {
                    for (const player of gameView.players) {
                        if (player.battlefield && player.battlefield[cardId]) return player.battlefield[cardId];
                        if (player.graveyard && player.graveyard[cardId]) return player.graveyard[cardId];
                        if (player.exile && player.exile[cardId]) return player.exile[cardId];
                    }
                }

                return null;
            },
        })),
        { name: 'GameStore' }
    )
);
