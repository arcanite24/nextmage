/**
 * Stores Barrel Export
 * 
 * Also sets up the callback dispatcher that routes server callbacks
 * to the appropriate stores.
 */

import { wsService } from '../services';
import type { ClientCallback } from '../types';
import { useLobbyStore } from './lobbyStore';
import { useGameStore } from './gameStore';
import { useChatStore } from './chatStore';
import { useSessionStore } from './sessionStore';
import { useDebugStore } from './debugStore';

export { useSessionStore };
export { useLobbyStore } from './lobbyStore';
export { useGameStore } from './gameStore';
export { useChatStore } from './chatStore';
export { useDebugStore };
export { useAnimationStore } from './animationStore';

// Re-export types
export type { PendingAction, MultiAmountMessage } from './gameStore';
export type { ChatMessage } from './chatStore';

/**
 * Initialize callback dispatcher
 * 
 * This function sets up the routing of server callbacks to the appropriate stores.
 * Should be called once when the app initializes.
 */
export function initializeCallbackDispatcher(): () => void {
    const unsubscribe = wsService.onCallback((originalCallback: ClientCallback) => {
        // Normalize method name from UPPER_SNAKE_CASE (Server Enum) to camelCase (Client Expectation)
        // e.g. START_GAME -> startGame
        const methodMap: Record<string, string> = {
            'START_GAME': 'startGame',
            'GAME_INIT': 'gameInit',
            'GAME_UPDATE': 'gameUpdate',
            'GAME_INFORM': 'gameInform',
            'GAME_UPDATE_AND_INFORM': 'gameUpdateAndInform',
            'GAME_INFORM_PERSONAL': 'gameInformPersonal',
            'GAME_ASK': 'gameAsk',
            'GAME_TARGET': 'gameTarget',
            'GAME_SELECT': 'gameSelect',
            'GAME_CHOOSE_ABILITY': 'gameChooseAbility',
            'GAME_CHOOSE_PILE': 'gameChoosePile',
            'GAME_CHOOSE_CHOICE': 'gameChooseChoice',
            'GAME_PLAY_MANA': 'gamePlayMana',
            'GAME_PLAY_X_MANA': 'gamePlayXMana',
            'GAME_PLAY_XMANA': 'gamePlayXMana',
            'GAME_GET_AMOUNT': 'gameGetAmount',
            'GAME_GET_MULTI_AMOUNT': 'gameGetMultiAmount',
            'GAME_ERROR': 'gameError',
            'GAME_OVER': 'gameOver',
            'END_GAME_INFO': 'endGameInfo',

            'CHAT_MESSAGE': 'chatMessage',
            'CHATMESSAGE': 'chatMessage',
            'SERVER_MESSAGE': 'serverMessage',
            'SHOW_USER_MESSAGE': 'showUserMessage',
            'SHOW_USERMESSAGE': 'showUserMessage',

            'JOINED_TABLE': 'joinedTable',
            'SHOW_TOURNAMENT': 'showTournament',
            'WATCH_GAME': 'watchGame',
            'WATCHGAME': 'watchGame',
            'REPLAY_INIT': 'replayInit',
            'REPLAY_UPDATE': 'replayUpdate',
            'REPLAY_DONE': 'replayDone',
        };

        const normalizedMethod = methodMap[originalCallback.method] || originalCallback.method;

        // Create a new callback object with normalized method
        const callback = { ...originalCallback, method: normalizedMethod as any };

        console.log(`[Dispatcher] Routing callback: ${originalCallback.method} -> ${normalizedMethod}`);

        // Game-related callbacks
        if (callback.method.startsWith('game') ||
            callback.method === 'startGame' ||
            callback.method === 'endGameInfo') {
            useGameStore.getState().handleCallback(callback);
        }

        // Chat callbacks
        if (callback.method === 'chatMessage' ||
            callback.method === 'serverMessage') {
            useChatStore.getState().handleCallback(callback);
        }

        // Session / Alert callbacks
        if (callback.method === 'showUserMessage') {
            useSessionStore.getState().handleCallback(callback);
        }

        // Lobby callbacks
        if (callback.method === 'joinedTable') {
            useLobbyStore.getState().handleCallback(callback);
        }

        // Could add more routing for:
        // - Tournament callbacks
        // - Draft callbacks
        // - Replay callbacks
    });

    return unsubscribe;
}
