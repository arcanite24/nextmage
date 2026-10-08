import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { appConfigService } from '../services';
import {
    notificationService,
    getNotificationAutoDismissDelay,
    type BrowserNotificationPermission,
    type ClientNotificationDraft,
    type NotificationKind,
    type NotificationTone,
} from '../services/NotificationService';
import type { ClientCallback } from '../types';
import type { ConnectionStatus } from '../services';

export interface ClientNotification {
    id: string;
    kind: NotificationKind;
    tone: NotificationTone;
    title: string;
    message: string;
    sourceMethod?: string;
    createdAt: number;
    dismissAt: number;
    read: boolean;
}

interface NotificationState {
    notifications: ClientNotification[];
    browserPermission: BrowserNotificationPermission;
}

interface NotificationActions {
    enqueue: (draft: ClientNotificationDraft) => void;
    handleCallback: (callback: ClientCallback) => void;
    handleConnectionStatus: (previousStatus: ConnectionStatus, nextStatus: ConnectionStatus, isAuthenticated: boolean) => void;
    requestBrowserPermission: () => Promise<BrowserNotificationPermission>;
    dismiss: (id: string) => void;
    clearAll: () => void;
}

const MAX_NOTIFICATIONS = 8;

export const useNotificationStore = create<NotificationState & NotificationActions>()(
    devtools(
        immer((set, get) => ({
            notifications: [],
            browserPermission: notificationService.getBrowserPermission(),

            enqueue: (draft) => {
                notificationService.showBrowserNotification(draft);
                if (draft.toast === false) return;

                set((state) => {
                    const createdAt = Date.now();
                    if (draft.dedupeKey) {
                        state.notifications = state.notifications.filter(notification => notification.id !== draft.dedupeKey);
                    }

                    state.notifications.unshift({
                        id: draft.dedupeKey ?? createNotificationId(),
                        kind: draft.kind,
                        tone: draft.tone,
                        title: draft.title,
                        message: draft.message,
                        sourceMethod: draft.sourceMethod,
                        createdAt,
                        dismissAt: createdAt + getNotificationAutoDismissDelay(draft.tone),
                        read: false,
                    });

                    state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
                });
            },

            handleCallback: (callback) => {
                const draft = notificationService.fromCallback(callback);
                if (draft) {
                    get().enqueue(draft);
                }
            },

            handleConnectionStatus: (previousStatus, nextStatus, isAuthenticated) => {
                if (!appConfigService.loadSettings().showConnectionStatusMessages) {
                    return;
                }
                const draft = notificationService.fromConnectionStatus(previousStatus, nextStatus, isAuthenticated);
                if (draft) {
                    get().enqueue(draft);
                }
            },

            requestBrowserPermission: async () => {
                const permission = await notificationService.requestBrowserPermission();
                set((state) => {
                    state.browserPermission = permission;
                });
                return permission;
            },

            dismiss: (id) => {
                set((state) => {
                    state.notifications = state.notifications.filter(notification => notification.id !== id);
                });
            },

            clearAll: () => {
                set((state) => {
                    state.notifications = [];
                });
            },
        })),
        { name: 'NotificationStore' }
    )
);

function createNotificationId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
