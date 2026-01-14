/**
 * Game Store
 * 
 * Manages in-game state including game view, pending actions, and game controls.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { wsService } from '../services';
import { useSessionStore } from './sessionStore';
import { useLobbyStore } from './lobbyStore';
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
} from '../types';

// === Pending Action Types ===

export type PendingAction =
    | { type: 'none' }
    | { type: 'ask'; message: string; gameView: GameView }
    | { type: 'target'; message: string; validTargets: UUID[]; gameView: GameView }
    | { type: 'select'; message: string; gameView: GameView }
    | { type: 'chooseAbility'; abilities: AbilityPickerView }
    | { type: 'choosePile'; piles: unknown; message: string }
    | { type: 'chooseChoice'; choices: string[]; message: string }
    | { type: 'mana'; message: string; gameView: GameView }
    | { type: 'xmana'; message: string; gameView: GameView }
    | { type: 'amount'; min: number; max: number; message: string }
    | { type: 'multiAmount'; options: unknown; message: string };

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
    showingZone: 'graveyard' | 'exile' | 'library' | null;
    showingPlayerId: UUID | null;

    // Informational messages
    lastMessage: string | null;
    lastError: string | null;

    // Loading states
    isLoading: boolean;
}

interface GameActions {
    // Game lifecycle
    initGame: (gameId: UUID, playerId: UUID | null) => void;
    joinGame: (gameId: UUID) => Promise<void>;
    updateGameView: (gameView: GameView) => void;
    endGame: (gameEndView: GameEndView) => void;
    setEndGameInfo: (info: EndGameInfo) => void;
    leaveGame: () => Promise<void>;

    // Player actions
    passPriority: () => Promise<void>;
    passPriorityUntilEndOfTurn: () => Promise<void>;
    passPriorityUntilNextMain: () => Promise<void>;
    passPriorityUntilStackResolved: () => Promise<void>;
    passPriorityUntilNextTurn: () => Promise<void>;
    holdPriority: () => Promise<void>;
    cancelPassActions: () => Promise<void>;
    concede: () => Promise<void>;
    undo: () => Promise<void>;

    // Responses
    sendPlayerAction: (action: PlayerAction, data?: unknown) => Promise<void>;
    sendUUID: (uuid: UUID) => Promise<void>;
    sendBoolean: (value: boolean) => Promise<void>;
    sendInteger: (value: number) => Promise<void>;
    sendString: (value: string) => Promise<void>;
    sendManaType: (manaType: ManaType) => Promise<void>;

    // UI
    selectCard: (cardId: UUID | null) => void;
    hoverCard: (cardId: UUID | null) => void;
    showZone: (zone: 'graveyard' | 'exile' | 'library' | null, playerId?: UUID | null) => void;

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
            },

            joinGame: async (gameId: UUID) => {
                const { sessionId } = useSessionStore.getState();
                const { initGame } = get();

                console.log('[GameStore] Manual joining game:', gameId);

                // Initialize local state
                // We might not know our playerId yet, but the server will tell us in gameInit
                initGame(gameId, null);

                useLobbyStore.getState().clearCurrentTable();

                try {
                    await wsService.send('gameJoin', [gameId, sessionId]);
                } catch (error) {
                    console.error('Failed to join game:', error);
                    set((state) => { state.lastError = `Failed to join game: ${error}`; });
                }
            },

            updateGameView: (gameView) => {
                set((state) => {
                    state.gameView = gameView;
                    state.lastError = null;
                    // Ensure we know who 'we' are if the view tells us
                    if (gameView.myPlayerId) {
                        state.playerId = gameView.myPlayerId;
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
            },

            // Player actions (F-key equivalents)
            passPriority: async () => {
                await get().sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
            },

            passPriorityUntilEndOfTurn: async () => {
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_TURN_END_STEP');
            },

            passPriorityUntilNextMain: async () => {
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE');
            },

            passPriorityUntilStackResolved: async () => {
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_STACK_RESOLVED');
            },

            passPriorityUntilNextTurn: async () => {
                await get().sendPlayerAction('PASS_PRIORITY_UNTIL_MY_NEXT_TURN');
            },

            holdPriority: async () => {
                await get().sendPlayerAction('HOLD_PRIORITY');
            },

            cancelPassActions: async () => {
                await get().sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
            },

            concede: async () => {
                await get().sendPlayerAction('CONCEDE');
            },

            undo: async () => {
                await get().sendPlayerAction('UNDO');
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
                const { gameId, updateGameView, endGame, initGame } = get();

                switch (callback.method) {
                    case 'startGame':
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

                            // Initialize local state to switch view
                            initGame(gameId, playerId);

                            // Clear any open waiting room/table in the lobby
                            // This ensures that if/when the user returns to the lobby, the waiting room is gone
                            // Note: We use the store getter directly to avoid circular dependency issues at module load
                            useLobbyStore.getState().clearCurrentTable();

                            // Send join command to server
                            const sessionId = useSessionStore.getState().sessionId;
                            // gameJoin expects [gameId, sessionId]
                            wsService.send('gameJoin', [gameId, sessionId]).catch(err => {
                                console.error('[GameStore] gameJoin failed:', err);
                            });
                        } else {
                            console.error('[GameStore] Received startGame but could not parse gameId:', callback.data);
                        }
                        break;

                    case 'gameInit':
                    case 'gameUpdate':
                        updateGameView(callback.data as GameView);
                        set((state) => { state.pendingAction = { type: 'none' }; });
                        break;

                    case 'gameInform':
                        updateGameView(callback.data as GameView);
                        // Could extract message from callback and display
                        break;

                    case 'gameAsk':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'ask',
                                message: data.message || 'Respond?',
                                gameView: state.gameView!,
                            };
                            if (state.gameView?.myPlayerId) {
                                state.playerId = state.gameView.myPlayerId;
                            }
                        });
                        break;

                    case 'gameTarget':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'target',
                                message: data.message || 'Select target',
                                validTargets: data.targets || [],
                                gameView: state.gameView!,
                            };
                            if (state.gameView?.myPlayerId) {
                                state.playerId = state.gameView.myPlayerId;
                            }
                        });
                        break;

                    case 'gameSelect':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'select',
                                message: data.message || 'Select',
                                gameView: state.gameView!,
                            };
                            if (state.gameView?.myPlayerId) {
                                state.playerId = state.gameView.myPlayerId;
                            }
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

                    case 'gamePlayMana':
                        set((state) => {
                            const data = callback.data as any;
                            state.gameView = data.gameView || data;
                            state.pendingAction = {
                                type: 'mana',
                                message: data.message || 'Pay mana',
                                gameView: state.gameView!,
                            };
                            if (state.gameView?.myPlayerId) {
                                state.playerId = state.gameView.myPlayerId;
                            }
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
                            if (state.gameView?.myPlayerId) {
                                state.playerId = state.gameView.myPlayerId;
                            }
                        });
                        break;

                    case 'gameError':
                        set((state) => {
                            state.lastError = callback.data as string;
                        });
                        break;

                    case 'gameOver':
                        endGame(callback.data as GameEndView);
                        break;

                    case 'endGameInfo':
                        // This provides richer info than gameOver
                        // @ts-ignore
                        get().setEndGameInfo(callback.data as EndGameInfo);
                        break;

                    case 'SIDEBOARD':
                        console.log('Sideboard event received:', callback.data);
                        // TODO: Implement sideboard logic
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
