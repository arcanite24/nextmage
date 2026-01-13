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

export { useSessionStore } from './sessionStore';
export { useLobbyStore } from './lobbyStore';
export { useGameStore } from './gameStore';
export { useChatStore } from './chatStore';

// Re-export types
export type { PendingAction } from './gameStore';
export type { ChatMessage } from './chatStore';

/**
 * Initialize callback dispatcher
 * 
 * This function sets up the routing of server callbacks to the appropriate stores.
 * Should be called once when the app initializes.
 */
export function initializeCallbackDispatcher(): () => void {
    const unsubscribe = wsService.onCallback((callback: ClientCallback) => {
        console.log('[Dispatcher] Routing callback:', callback.method);

        // Game-related callbacks
        if (callback.method.startsWith('game') ||
            callback.method === 'startGame' ||
            callback.method === 'endGameInfo') {
            useGameStore.getState().handleCallback(callback);
        }

        // Chat callbacks
        if (callback.method === 'chatMessage' ||
            callback.method === 'serverMessage' ||
            callback.method === 'showUserMessage') {
            useChatStore.getState().handleCallback(callback);
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
