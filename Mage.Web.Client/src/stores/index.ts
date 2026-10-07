/**
 * Stores Barrel Export
 * 
 * Also sets up the callback dispatcher that routes server callbacks
 * to the appropriate stores.
 */

import { webSocketBridgeService, wsService } from '../services';
import type { ClientCallback } from '../types';
import { useLobbyStore } from './lobbyStore';
import { useGameStore } from './gameStore';
import { useChatStore } from './chatStore';
import { useSessionStore } from './sessionStore';
import { useDebugStore } from './debugStore';
import { useActivityStore } from './activityStore';
import { useNotificationStore } from './notificationStore';
import { useSettingsStore } from './settingsStore';
import {
    createCallbackOrderingGuard,
    getCallbackRouteTargets,
} from '../services/callbackSupport';
import { createTournamentLifecycleHandler } from '../services/TournamentLifecycleService';

export { useSessionStore };
export { useLobbyStore } from './lobbyStore';
export { useGameStore } from './gameStore';
export { useChatStore } from './chatStore';
export { useDebugStore };
export { useActivityStore } from './activityStore';
export { useNotificationStore } from './notificationStore';
export { useAnimationStore } from './animationStore';
export { useSettingsStore } from './settingsStore';

// Re-export types
export type { PendingAction, MultiAmountMessage } from './gameStore';
export type { ChatMessage } from './chatStore';
export type { ClientActivity, ActivityKind, ActivityStatus } from './activityStore';
export type { ClientNotification } from './notificationStore';
export type { ClientSettings } from './settingsStore';

/**
 * Initialize callback dispatcher
 * 
 * This function sets up the routing of server callbacks to the appropriate stores.
 * Should be called once when the app initializes.
 */
export function initializeCallbackDispatcher(): () => void {
    const orderingGuard = createCallbackOrderingGuard();
    const tournamentLifecycleHandler = createTournamentLifecycleHandler({
        getSessionId: () => {
            const { isAuthenticated, sessionId } = useSessionStore.getState();
            return isAuthenticated ? sessionId : null;
        },
        joinTournament: (tournamentId, sessionId) => webSocketBridgeService.joinTournament(tournamentId, sessionId),
        joinDraft: (draftId, sessionId) => webSocketBridgeService.joinDraft(draftId, sessionId),
        onError: (error, tournamentId) => {
            console.error(`[Dispatcher] Failed to join tournament/draft activity ${tournamentId}`, error);
        },
    });

    const unsubscribe = wsService.onCallback((originalCallback: ClientCallback) => {
        const decision = orderingGuard.evaluate(originalCallback);
        const callback = decision.callback;
        const routeTargets = getCallbackRouteTargets(callback.method);

        if (!decision.shouldProcess) {
            console.warn(
                `[Dispatcher] Ignoring stale callback ${originalCallback.method} (${originalCallback.messageId}) ` +
                `after message ${decision.lastAnyMessageId}`
            );
            return;
        }

        console.log(`[Dispatcher] Routing callback: ${originalCallback.method} -> ${callback.method}`, routeTargets);
        useDebugStore.getState().recordCallbackFixture(callback);
        useNotificationStore.getState().handleCallback(callback);
        tournamentLifecycleHandler.handleCallback(callback);

        if (routeTargets.includes('game')) {
            useGameStore.getState().handleCallback(callback);
        }

        if (callback.method === 'viewSideboard') {
            const data = typeof callback.data === 'object' && callback.data !== null ? callback.data as Record<string, unknown> : {};
            const gameId = typeof data.gameId === 'string' ? data.gameId : callback.objectId ?? null;
            const playerId = typeof data.playerId === 'string' ? data.playerId : null;
            const gameView = useGameStore.getState().gameView;
            const player = playerId && gameView?.players
                ? gameView.players.find(candidate => candidate.playerId === playerId)
                : null;

            if (player) {
                useActivityStore.getState().openViewedSideboard({
                    gameId,
                    playerId: player.playerId,
                    playerName: player.name,
                    sideboard: player.sideboard ?? {},
                });
            }
        }

        if (routeTargets.includes('chat')) {
            useChatStore.getState().handleCallback(callback);
        }

        if (routeTargets.includes('session')) {
            useSessionStore.getState().handleCallback(callback);
        }

        if (routeTargets.includes('lobby')) {
            useLobbyStore.getState().handleCallback(callback);
        }

        if (routeTargets.includes('activity')) {
            useActivityStore.getState().handleCallback(callback);
        }
    });

    const unsubscribeStatus = wsService.onStatusChange((status) => {
        if (status !== 'connected') return;
        if (!useSettingsStore.getState().settings.reconnectRecoveryEnabled) return;
        globalThis.setTimeout(() => {
            useChatStore.getState().recoverJoinedChannels().catch((error) => {
                console.error('[Dispatcher] Failed to recover joined chat channels', error);
            });
        }, 1000);
    });

    return () => {
        unsubscribe();
        unsubscribeStatus();
    };
}
