import { serverHtmlToPlainText } from './ServerHtmlService.js';
const PRIORITY_CALLBACKS = new Set([
    'gameAsk',
    'gameTarget',
    'gameChooseAbility',
    'gameChoosePile',
    'gameChooseChoice',
    'gameSelect',
    'gamePlayMana',
    'gamePlayXMana',
    'gameGetAmount',
    'gameGetMultiAmount',
]);
const AUTO_DISMISS_DELAYS = {
    success: 6_000,
    info: 7_000,
    warning: 10_000,
    danger: 14_000,
};
class NotificationService {
    fromCallback(callback) {
        switch (callback.method) {
            case 'startGame':
                return {
                    kind: 'game',
                    tone: 'success',
                    title: 'Match started',
                    message: 'A match is ready. Joining the game now.',
                    browser: true,
                    dedupeKey: `match-start:${readCallbackObject(callback)}`,
                    sourceMethod: callback.method,
                };
            case 'gameOver':
            case 'endGameInfo':
                return {
                    kind: 'game',
                    tone: 'info',
                    title: 'Match finished',
                    message: readMessage(callback.data) ?? 'The current match has finished.',
                    browser: true,
                    dedupeKey: `match-finished:${readCallbackObject(callback)}:${callback.method}`,
                    sourceMethod: callback.method,
                };
            case 'draftPick':
                return {
                    kind: 'draft',
                    tone: 'warning',
                    title: 'Draft pick ready',
                    message: readMessage(callback.data) ?? 'Choose a card from the current booster.',
                    browser: true,
                    dedupeKey: `draft-pick:${readCallbackObject(callback)}:${callback.messageId}`,
                    sourceMethod: callback.method,
                };
            case 'startDraft':
            case 'draftInit':
                return {
                    kind: 'draft',
                    tone: 'success',
                    title: 'Draft started',
                    message: 'A draft activity is ready.',
                    browser: true,
                    dedupeKey: `draft-start:${readCallbackObject(callback)}:${callback.method}`,
                    sourceMethod: callback.method,
                };
            case 'draftOver':
                return {
                    kind: 'draft',
                    tone: 'info',
                    title: 'Draft finished',
                    message: 'Drafting is complete.',
                    browser: true,
                    dedupeKey: `draft-over:${readCallbackObject(callback)}`,
                    sourceMethod: callback.method,
                };
            case 'startTournament':
            case 'tournamentInit':
                return {
                    kind: 'tournament',
                    tone: 'success',
                    title: 'Tournament started',
                    message: readMessage(callback.data) ?? 'A tournament activity is ready.',
                    browser: true,
                    dedupeKey: `tournament-start:${readCallbackObject(callback)}:${callback.method}`,
                    sourceMethod: callback.method,
                };
            case 'tournamentUpdate':
                return {
                    kind: 'tournament',
                    tone: 'warning',
                    title: 'Tournament round update',
                    message: readMessage(callback.data) ?? 'A tournament round or table update needs attention.',
                    browser: true,
                    dedupeKey: `tournament-update:${readCallbackObject(callback)}:${callback.messageId}`,
                    sourceMethod: callback.method,
                };
            case 'tournamentOver':
                return {
                    kind: 'tournament',
                    tone: 'info',
                    title: 'Tournament complete',
                    message: readMessage(callback.data) ?? 'The tournament has finished.',
                    browser: true,
                    dedupeKey: `tournament-over:${readCallbackObject(callback)}`,
                    sourceMethod: callback.method,
                };
            case 'showUserMessage': {
                const message = readUserMessage(callback.data);
                return {
                    kind: 'message',
                    tone: 'info',
                    title: message.title,
                    message: message.message,
                    browser: true,
                    dedupeKey: `user-message:${callback.messageId}`,
                    sourceMethod: callback.method,
                };
            }
            case 'serverMessage':
                return {
                    kind: 'message',
                    tone: 'info',
                    title: 'Server message',
                    message: readMessage(callback.data) ?? 'The server sent a message.',
                    browser: true,
                    dedupeKey: `server-message:${callback.messageId}`,
                    sourceMethod: callback.method,
                };
            case 'gameInformPersonal':
                return {
                    kind: 'message',
                    tone: 'info',
                    title: 'Game message',
                    message: readMessage(callback.data) ?? 'You received a personal game message.',
                    browser: false,
                    dedupeKey: `game-personal:${readCallbackObject(callback)}:${callback.messageId}`,
                    sourceMethod: callback.method,
                };
            case 'gameError':
                return {
                    kind: 'game',
                    tone: 'danger',
                    title: 'Game error',
                    message: readMessage(callback.data) ?? 'The game reported an error.',
                    browser: true,
                    dedupeKey: `game-error:${readCallbackObject(callback)}:${callback.messageId}`,
                    sourceMethod: callback.method,
                };
            case 'replayInit':
                return {
                    kind: 'replay',
                    tone: 'success',
                    title: 'Replay ready',
                    message: 'Replay controls are available.',
                    browser: false,
                    dedupeKey: `replay-init:${readCallbackObject(callback)}`,
                    sourceMethod: callback.method,
                };
        }
        if (PRIORITY_CALLBACKS.has(callback.method)) {
            return {
                kind: 'game',
                tone: 'warning',
                title: 'Priority needed',
                message: readMessage(callback.data) ?? 'A game prompt is waiting for your response.',
                browser: true,
                toast: false,
                dedupeKey: `priority:${readCallbackObject(callback)}:${callback.method}`,
                sourceMethod: callback.method,
            };
        }
        return null;
    }
    fromConnectionStatus(previousStatus, nextStatus, isAuthenticated) {
        if (previousStatus === nextStatus)
            return null;
        if (previousStatus === 'connected' && nextStatus === 'disconnected') {
            return {
                kind: 'connection',
                tone: 'danger',
                title: 'Connection lost',
                message: 'The server connection was lost. The client will try to recover active sessions when possible.',
                browser: true,
                dedupeKey: `connection-lost:${Date.now()}`,
            };
        }
        if (isAuthenticated && (nextStatus === 'connecting' || nextStatus === 'reconnecting')) {
            return {
                kind: 'connection',
                tone: 'warning',
                title: 'Reconnecting',
                message: 'Trying to restore the server connection.',
                browser: false,
                dedupeKey: `connection-reconnecting:${Date.now()}`,
            };
        }
        if (isAuthenticated && (previousStatus === 'connecting' || previousStatus === 'reconnecting') && nextStatus === 'connected') {
            return {
                kind: 'connection',
                tone: 'success',
                title: 'Reconnected',
                message: 'The server connection is back.',
                browser: false,
                dedupeKey: `connection-restored:${Date.now()}`,
            };
        }
        return null;
    }
    getBrowserPermission() {
        if (typeof Notification === 'undefined')
            return 'unsupported';
        return Notification.permission;
    }
    async requestBrowserPermission() {
        if (typeof Notification === 'undefined')
            return 'unsupported';
        return Notification.requestPermission();
    }
    showBrowserNotification(notification) {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted')
            return;
        if (typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus())
            return;
        new Notification(notification.title, {
            body: serverHtmlToPlainText(notification.message),
            tag: notification.dedupeKey,
        });
    }
}
export function getNotificationAutoDismissDelay(tone) {
    return AUTO_DISMISS_DELAYS[tone];
}
function readCallbackObject(callback) {
    return callback.objectId ?? readString(callback.data) ?? 'global';
}
function readUserMessage(data) {
    if (Array.isArray(data)) {
        return {
            title: readString(data[0]) ?? 'Message',
            message: readString(data[1]) ?? String(data[1] ?? data[0] ?? ''),
        };
    }
    if (isRecord(data)) {
        return {
            title: readString(data.title) ?? readString(data.caption) ?? 'Message',
            message: readString(data.message) ?? readString(data.text) ?? String(data.message ?? data.text ?? ''),
        };
    }
    return {
        title: 'Message',
        message: String(data ?? ''),
    };
}
function readMessage(data) {
    if (typeof data === 'string' && data.length > 0)
        return data;
    if (Array.isArray(data)) {
        return data.map(item => readString(item)).filter(Boolean).join(' - ') || null;
    }
    if (!isRecord(data))
        return null;
    return (readString(data.message) ??
        readString(data.text) ??
        readString(data.info) ??
        readString(data.status) ??
        readString(data.title));
}
function readString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export const notificationService = new NotificationService();
export { NotificationService };
