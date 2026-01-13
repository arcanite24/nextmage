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
import {
    UUID,
    GameView,
    PlayerView,
    CardView,
    PermanentView,
    AbilityPickerView,
    GameEndView,
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
    updateGameView: (gameView: GameView) => void;
    endGame: (gameEndView: GameEndView) => void;
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
                    state.pendingAction = { type: 'none' };
                });
            },

            updateGameView: (gameView) => {
                set((state) => {
                    state.gameView = gameView;
                    state.lastError = null;
                });
            },

            endGame: (gameEndView) => {
                set((state) => {
                    state.gameEnded = true;
                    state.gameEndView = gameEndView;
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
                        // Game is starting, data contains gameId and playerId info
                        const startData = callback.data as { gameId: UUID; playerId: UUID };
                        initGame(startData.gameId, startData.playerId);
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
                            state.gameView = callback.data as GameView;
                            state.pendingAction = {
                                type: 'ask',
                                message: 'Respond?', // Would extract from gameView
                                gameView: callback.data as GameView,
                            };
                        });
                        break;

                    case 'gameTarget':
                        set((state) => {
                            state.gameView = callback.data as GameView;
                            state.pendingAction = {
                                type: 'target',
                                message: 'Select target',
                                validTargets: [], // Would extract from gameView
                                gameView: callback.data as GameView,
                            };
                        });
                        break;

                    case 'gameSelect':
                        set((state) => {
                            state.gameView = callback.data as GameView;
                            state.pendingAction = {
                                type: 'select',
                                message: 'Select',
                                gameView: callback.data as GameView,
                            };
                        });
                        break;

                    case 'gameChooseAbility':
                        set((state) => {
                            state.pendingAction = {
                                type: 'chooseAbility',
                                abilities: callback.data as AbilityPickerView,
                            };
                        });
                        break;

                    case 'gamePlayMana':
                        set((state) => {
                            state.gameView = callback.data as GameView;
                            state.pendingAction = {
                                type: 'mana',
                                message: 'Pay mana',
                                gameView: callback.data as GameView,
                            };
                        });
                        break;

                    case 'gamePlayXMana':
                        set((state) => {
                            state.gameView = callback.data as GameView;
                            state.pendingAction = {
                                type: 'xmana',
                                message: 'Choose X value',
                                gameView: callback.data as GameView,
                            };
                        });
                        break;

                    case 'gameError':
                        set((state) => {
                            state.lastError = callback.data as string;
                        });
                        break;

                    case 'gameOver':
                    case 'endGameInfo':
                        endGame(callback.data as GameEndView);
                        break;
                }
            },

            // Helpers
            getMyPlayer: () => {
                const { gameView, playerId } = get();
                if (!gameView || !playerId) return null;
                return gameView.players.find(p => p.playerId === playerId) || null;
            },

            getOpponents: () => {
                const { gameView, playerId } = get();
                if (!gameView) return [];
                return gameView.players.filter(p => p.playerId !== playerId);
            },

            getCardById: (cardId) => {
                const { gameView } = get();
                if (!gameView) return null;

                // Check hand
                if (gameView.myHand[cardId]) return gameView.myHand[cardId];

                // Check stack
                if (gameView.stack[cardId]) return gameView.stack[cardId];

                // Check all player zones
                for (const player of gameView.players) {
                    if (player.battlefield[cardId]) return player.battlefield[cardId];
                    if (player.graveyard[cardId]) return player.graveyard[cardId];
                    if (player.exile[cardId]) return player.exile[cardId];
                }

                return null;
            },
        })),
        { name: 'GameStore' }
    )
);
