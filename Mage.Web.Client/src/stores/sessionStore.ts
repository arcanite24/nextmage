/**
 * Session Store
 * 
 * Manages user authentication state and session data.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
    appConfigService,
    clientSettingsToUserData,
    connectionProfileService,
    connectionProfileKey,
    DEFAULT_SERVER_URL,
    DEFAULT_USER_SKIP_PRIORITY_STEPS,
    normalizeServerUrl,
    UserRequestService,
    webSocketBridgeService,
    wsService,
    type ConnectionProfileSnapshot,
    type ConnectionStatus,
} from '../services';
import { UUID, UserData, UserSkipPrioritySteps, ClientCallback, PlayerAction, UserRequestMessage, ServerState } from '../types';
import { useNotificationStore } from './notificationStore';

type UserRequestResponse = 1 | 2 | 3 | null;

type ServerStatusKind = 'idle' | 'checking' | 'online' | 'offline';

interface ServerStatusSnapshot {
    status: ServerStatusKind;
    message: string;
    checkedAt: string | null;
    serverState: ServerState | null;
}

let pendingLocalUserRequestResolver: ((response: UserRequestResponse) => void) | null = null;

function resolveLocalUserRequest(response: UserRequestResponse) {
    const resolver = pendingLocalUserRequestResolver;
    pendingLocalUserRequestResolver = null;
    resolver?.(response);
}

interface SessionState {
    // Connection state
    serverUrl: string;
    connectionStatus: ConnectionStatus;
    connectionProfiles: ConnectionProfileSnapshot;
    serverStatus: ServerStatusSnapshot;

    // Session state
    sessionId: string;
    userName: string | null;
    userId: string | null;
    userData: UserData | null;
    isAuthenticated: boolean;
    isRestoring: boolean;
    mainRoomId: UUID | null;
    lastSessionId: string | null;

    // Error state
    lastError: string | null;

    // UI Alert state
    alert: {
        title: string;
        message: string;
        isOpen: boolean;
    };
    userRequest: {
        request: UserRequestMessage | null;
        isOpen: boolean;
        isExecuting: boolean;
        error: string | null;
    };
}

interface SessionActions {
    // Connection
    setServerUrl: (url: string) => void;
    connect: () => Promise<void>;
    cancelConnect: () => void;
    checkServerStatus: () => Promise<boolean>;
    setAutoConnect: (enabled: boolean) => void;
    saveServerPreset: (label: string, url?: string) => void;
    deleteServerPreset: (presetId: string) => void;
    disconnect: (keepGames?: boolean) => Promise<void>;

    // Authentication
    login: (userName: string, password: string) => Promise<boolean>;
    register: (userName: string, password: string, email: string) => Promise<boolean>;
    requestPasswordResetToken: (email: string) => Promise<boolean>;
    resetPassword: (email: string, authToken: string, password: string) => Promise<boolean>;
    logout: () => void;

    // User data
    setUserData: (userData: Partial<UserData>) => Promise<boolean>;
    updateSkipPrioritySteps: (steps: Partial<UserSkipPrioritySteps>) => Promise<boolean>;
    sendFeedback: (title: string, type: string, message: string, email: string) => Promise<boolean>;

    // Internal
    _setConnectionStatus: (status: ConnectionStatus) => void;
    _setError: (error: string | null) => void;
    _initializeCallbackHandler: () => void;

    // Callbacks
    handleCallback: (callback: ClientCallback) => void;
    showAlert: (title: string, message: string) => void;
    showUserRequest: (request: UserRequestMessage) => void;
    showLocalUserRequest: (request: UserRequestMessage) => Promise<UserRequestResponse>;
    respondToUserRequest: (buttonIndex: 1 | 2 | 3) => Promise<void>;
    executeUserRequestAction: (action: PlayerAction, request: UserRequestMessage) => Promise<void>;
    closeUserRequest: () => void;
    closeAlert: () => void;

    restoreSession: () => Promise<boolean>;
}

// Helper to generate UUID
const generateUUID = (): string => {
    return crypto.randomUUID();
};

const initialConnectionProfiles = connectionProfileService.load();

function formatServerVersion(serverState: ServerState): string {
    const { version } = serverState;
    const release = version.release ?? version.patch ?? 0;
    const releaseInfo = version.releaseInfo ?? version.info ?? '';
    const baseVersion = `${version.major}.${version.minor}.${release}`;
    return releaseInfo ? `${baseVersion}-${releaseInfo}` : baseVersion;
}

export const useSessionStore = create<SessionState & SessionActions>()(
    devtools(
        persist(
            immer((set, get) => ({
                // Initial state
                serverUrl: initialConnectionProfiles.lastServerUrl || DEFAULT_SERVER_URL,
                connectionStatus: 'disconnected',
                connectionProfiles: initialConnectionProfiles,
                serverStatus: {
                    status: 'idle',
                    message: 'Server status has not been checked.',
                    checkedAt: null,
                    serverState: null,
                },
                sessionId: crypto.randomUUID(),
                lastSessionId: null,
                userName: null,
                userId: null,
                userData: null,
                isAuthenticated: false,
                isRestoring: false,
                mainRoomId: null,
                lastError: null,
                alert: {
                    title: '',
                    message: '',
                    isOpen: false,
                },
                userRequest: {
                    request: null,
                    isOpen: false,
                    isExecuting: false,
                    error: null,
                },

                // Connection
                setServerUrl: (url) => {
                    const normalizedUrl = normalizeServerUrl(url);
                    const { serverUrl, isAuthenticated, connectionProfiles } = get();

                    if (serverUrl !== normalizedUrl && !isAuthenticated && wsService.status !== 'disconnected') {
                        wsService.disconnect();
                    }

                    const nextProfiles = connectionProfileService.withSelectedServer(connectionProfiles, normalizedUrl);
                    set((state) => {
                        state.serverUrl = normalizedUrl;
                        state.connectionProfiles = nextProfiles;
                        state.serverStatus = {
                            status: 'idle',
                            message: 'Server status has not been checked.',
                            checkedAt: null,
                            serverState: null,
                        };
                    });
                },

                connect: async () => {
                    const { serverUrl, connectionStatus, _setConnectionStatus, _setError, _initializeCallbackHandler } = get();
                    const normalizedUrl = normalizeServerUrl(serverUrl);
                    _setError(null);

                    if (connectionStatus === 'connected') return;

                    // If already connecting, wait a bit and check again
                    if (connectionStatus === 'connecting') {
                        return new Promise<void>((resolve) => {
                            const check = setInterval(() => {
                                const status = get().connectionStatus;
                                if (status === 'connected') {
                                    clearInterval(check);
                                    resolve();
                                } else if (status === 'disconnected') {
                                    clearInterval(check);
                                    resolve();
                                }
                            }, 100);
                        });
                    }

                    try {
                        // _setConnectionStatus is internal, but we can set state directly via immer
                        _setConnectionStatus('connecting');

                        if (wsService.status !== 'connected') {
                            await wsService.connect(normalizedUrl);
                            _initializeCallbackHandler();
                        }
                    } catch (error) {
                        _setError(`Connection failed: ${error}`);
                        _setConnectionStatus('disconnected');
                        throw error;
                    }
                },

                cancelConnect: () => {
                    if (wsService.status === 'connecting' || get().connectionStatus === 'connecting') {
                        wsService.disconnect();
                        set((state) => {
                            state.serverStatus = {
                                status: 'idle',
                                message: 'Connect was canceled.',
                                checkedAt: null,
                                serverState: null,
                            };
                        });
                    }
                },

                checkServerStatus: async () => {
                    const { serverUrl, _setError } = get();
                    const checkedAt = new Date().toISOString();

                    set((state) => {
                        state.serverStatus = {
                            status: 'checking',
                            message: `Checking ${serverUrl}...`,
                            checkedAt: null,
                            serverState: null,
                        };
                    });

                    try {
                        const serverState = await wsService.requestOnce<ServerState>(
                            normalizeServerUrl(serverUrl),
                            'getServerState',
                        );
                        const version = formatServerVersion(serverState);

                        set((state) => {
                            state.serverStatus = {
                                status: 'online',
                                message: `Online - ${version}${serverState.testMode ? ' test mode' : ''}`,
                                checkedAt,
                                serverState,
                            };
                        });

                        return true;
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        _setError(`Server status failed: ${message}`);
                        set((state) => {
                            state.serverStatus = {
                                status: 'offline',
                                message,
                                checkedAt,
                                serverState: null,
                            };
                        });

                        return false;
                    }
                },

                setAutoConnect: (enabled) => {
                    const { connectionProfiles, serverUrl } = get();
                    const nextProfiles = connectionProfileService.withAutoConnect(connectionProfiles, enabled, serverUrl);
                    set((state) => {
                        state.connectionProfiles = nextProfiles;
                    });
                },

                saveServerPreset: (label, url) => {
                    const { connectionProfiles, serverUrl } = get();
                    const nextProfiles = connectionProfileService.saveServerPreset(
                        connectionProfiles,
                        label,
                        url ?? serverUrl,
                    );
                    set((state) => {
                        state.connectionProfiles = nextProfiles;
                    });
                },

                deleteServerPreset: (presetId) => {
                    const { connectionProfiles } = get();
                    const nextProfiles = connectionProfileService.deleteServerPreset(connectionProfiles, presetId);
                    set((state) => {
                        state.connectionProfiles = nextProfiles;
                    });
                },

                restoreSession: async () => {
                    const { userName, isAuthenticated, connect, login, isRestoring } = get();

                    if (isRestoring || !isAuthenticated || !userName) return false;

                    set((state) => { state.isRestoring = true; });

                    try {
                        await connect();
                        // In test mode (dev), we can reconnect without password. 
                        // In prod, we'd need a token or prompts. For now we assume dev/test mode flexibility.
                        // We pass empty password. If server is in Test Mode, it accepts. 
                        // If not, this fails and user gets redirected to Login (correct behavior).
                        return await login(userName, "");
                    } catch (e) {
                        console.error("Session restore failed", e);
                        set((state) => { state.isAuthenticated = false; });
                        return false;
                    } finally {
                        set((state) => { state.isRestoring = false; });
                    }
                },

                disconnect: async (keepGames = false) => {
                    const { sessionId, userName, serverUrl, connectionProfiles } = get();
                    let nextProfiles: ConnectionProfileSnapshot | null = null;

                    if (userName) {
                        nextProfiles = keepGames
                            ? connectionProfileService.rememberRestoreSession(connectionProfiles, serverUrl, userName, sessionId)
                            : connectionProfileService.clearRestoreSession(connectionProfiles, serverUrl, userName);
                    }

                    if (wsService.status === 'connected') {
                        try {
                            await webSocketBridgeService.disconnectSession(sessionId, keepGames);
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            if (message !== 'Client disconnected') {
                                console.warn('Failed to notify server about disconnect:', error);
                            }
                        }
                    }

                    wsService.disconnect();
                    set((state) => {
                        state.isAuthenticated = false;
                        state.userName = null;
                        state.userData = null;
                        state.mainRoomId = null;
                        if (!keepGames) {
                            state.lastSessionId = null;
                        }
                        if (nextProfiles) {
                            state.connectionProfiles = nextProfiles;
                        }
                    });
                },

                // Authentication
                login: async (userName, password) => {
                    const { sessionId, serverUrl, connectionProfiles, _setError } = get();
                    _setError(null);

                    try {
                        const restoreSessionId = connectionProfileService.findRestoreSession(
                            connectionProfiles,
                            serverUrl,
                            userName,
                        );

                        // Connect user
                        const result = await webSocketBridgeService.connectUser(
                            userName,
                            password,
                            sessionId,
                            restoreSessionId,
                            '', // userIdStr
                        );

                        if (!result) {
                            _setError('Login failed: Invalid credentials');
                            return false;
                        }

                        // Set initial user data from the same persisted preferences Java sends on connect.
                        const userData = clientSettingsToUserData(appConfigService.loadSettings());
                        await wsService.send<boolean>('connectSetUserData', [
                            userName,
                            sessionId,
                            userData,
                            '1.0.0', // client version
                            '',      // userIdStr
                        ]);

                        // Get main room ID (ALWAYS fetch fresh - it changes on server restart)
                        const mainRoomId = await webSocketBridgeService.getMainRoomId();
                        const loginProfiles = connectionProfileService.rememberLogin(
                            get().connectionProfiles,
                            get().serverUrl,
                            userName,
                        );
                        const nextProfiles = connectionProfileService.rememberRestoreSession(
                            loginProfiles,
                            get().serverUrl,
                            userName,
                            sessionId,
                        );

                        set((state) => {
                            state.userName = userName;
                            state.userData = userData;
                            state.isAuthenticated = true;
                            state.mainRoomId = mainRoomId;
                            state.lastSessionId = sessionId;
                            state.connectionProfiles = nextProfiles;
                        });

                        return true;
                    } catch (error) {
                        _setError(`Login failed: ${error}`);
                        return false;
                    }
                },

                register: async (userName, password, email) => {
                    const { sessionId, _setError } = get();
                    _setError(null);

                    try {
                        const result = await wsService.send<boolean>('authRegister', [
                            sessionId,
                            userName,
                            password,
                            email,
                        ]);

                        if (!result) {
                            _setError('Registration failed');
                            return false;
                        }

                        const nextProfiles = connectionProfileService.rememberLogin(
                            get().connectionProfiles,
                            get().serverUrl,
                            userName,
                            email,
                        );
                        set((state) => {
                            state.connectionProfiles = nextProfiles;
                        });

                        return true;
                    } catch (error) {
                        _setError(`Registration failed: ${error}`);
                        return false;
                    }
                },

                requestPasswordResetToken: async (email) => {
                    const { sessionId, _setError } = get();
                    _setError(null);

                    try {
                        const result = await webSocketBridgeService.requestAuthToken(sessionId, email);
                        if (!result) {
                            _setError('Password reset token request failed');
                        }
                        return result;
                    } catch (error) {
                        _setError(`Password reset token request failed: ${error}`);
                        return false;
                    }
                },

                resetPassword: async (email, authToken, password) => {
                    const { sessionId, _setError } = get();
                    _setError(null);

                    try {
                        const result = await webSocketBridgeService.resetPassword(sessionId, email, authToken, password);
                        if (!result) {
                            _setError('Password reset failed');
                        }
                        return result;
                    } catch (error) {
                        _setError(`Password reset failed: ${error}`);
                        return false;
                    }
                },

                logout: () => {
                    void get().disconnect(false);
                },

                // User data
                setUserData: async (partialUserData) => {
                    const { userName, sessionId, userData, _setError } = get();
                    if (!userName || !userData) return false;

                    const newUserData = { ...userData, ...partialUserData };

                    try {
                        const result = await wsService.send<boolean>('connectSetUserData', [
                            userName,
                            sessionId,
                            newUserData,
                            '1.0.0',
                            '',
                        ]);

                        if (result) {
                            set((state) => {
                                state.userData = newUserData;
                            });
                        }

                        return result;
                    } catch (error) {
                        _setError(`Failed to update user data: ${error}`);
                        return false;
                    }
                },

                updateSkipPrioritySteps: async (steps) => {
                    const { userData, setUserData } = get();
                    if (!userData) return false;

                    const newSteps = {
                        ...userData.userSkipPrioritySteps,
                        ...steps,
                    };

                    return setUserData({ userSkipPrioritySteps: newSteps });
                },

                sendFeedback: async (title, type, message, email) => {
                    const { sessionId, userName, connectionStatus, _setError } = get();
                    if (!userName || connectionStatus !== 'connected') {
                        _setError('Feedback can only be sent while connected.');
                        return false;
                    }

                    try {
                        await wsService.send<boolean>('sendFeedback', [
                            sessionId,
                            userName,
                            title,
                            type,
                            message,
                            email,
                        ]);
                        return true;
                    } catch (error) {
                        _setError(`Feedback failed: ${error}`);
                        return false;
                    }
                },

                // Internal
                _setConnectionStatus: (status) => {
                    const previousStatus = get().connectionStatus;
                    const isAuthenticated = get().isAuthenticated;
                    set((state) => {
                        state.connectionStatus = status;
                    });
                    useNotificationStore.getState().handleConnectionStatus(previousStatus, status, isAuthenticated);
                },

                _setError: (error) => {
                    set((state) => {
                        state.lastError = error;
                    });
                },

                _initializeCallbackHandler: () => {
                    wsService.setSessionIdProvider(() => {
                        const { isAuthenticated, sessionId } = get();
                        return isAuthenticated ? sessionId : null;
                    });

                    // Subscribe to connection status changes
                    wsService.onStatusChange((status) => {
                        const { isAuthenticated, restoreSession, _setConnectionStatus } = get();
                        _setConnectionStatus(status);

                        // If we reconnected and were previously logged in, try to restore the session
                        if (status === 'connected' && isAuthenticated) {
                            console.log('[SessionStore] Reconnected, attempting to restore session...');
                            restoreSession().then(success => {
                                if (success) {
                                    console.log('[SessionStore] Session restored successfully');
                                } else {
                                    console.warn('[SessionStore] Session restore failed, user must login again');
                                }
                            });
                        }
                    });
                },

                handleCallback: (callback) => {
                    const data = callback.data as any; // Usually [title, message]
                    if (callback.method === 'userRequestDialog') {
                        get().showUserRequest(UserRequestService.normalize(callback.data));
                        return;
                    }

                    if (callback.method === 'showUserMessage') {
                        if (Array.isArray(data) && data.length >= 2) {
                            get().showAlert(String(data[0]), String(data[1]));
                        } else {
                            get().showAlert('Message', String(data));
                        }
                    }
                },

                showAlert: (title, message) => {
                    set((state) => {
                        state.alert = {
                            title,
                            message,
                            isOpen: true,
                        };
                    });
                },

                showUserRequest: (request) => {
                    resolveLocalUserRequest(null);
                    set((state) => {
                        state.userRequest = {
                            request,
                            isOpen: true,
                            isExecuting: false,
                            error: null,
                        };
                    });
                },

                showLocalUserRequest: (request) => {
                    resolveLocalUserRequest(null);

                    return new Promise<UserRequestResponse>((resolve) => {
                        pendingLocalUserRequestResolver = resolve;
                        set((state) => {
                            state.userRequest = {
                                request,
                                isOpen: true,
                                isExecuting: false,
                                error: null,
                            };
                        });
                    });
                },

                respondToUserRequest: async (buttonIndex) => {
                    const { userRequest, executeUserRequestAction } = get();
                    const request = userRequest.request;
                    if (!request || userRequest.isExecuting) return;

                    const button = UserRequestService.getButton(request, buttonIndex);
                    if (!button) return;

                    if (pendingLocalUserRequestResolver) {
                        resolveLocalUserRequest(button.index);
                        set((state) => {
                            state.userRequest = {
                                request: null,
                                isOpen: false,
                                isExecuting: false,
                                error: null,
                            };
                        });
                        return;
                    }

                    set((state) => {
                        state.userRequest.isExecuting = true;
                        state.userRequest.error = null;
                    });

                    try {
                        if (button.action) {
                            await executeUserRequestAction(button.action, request);
                        }

                        set((state) => {
                            state.userRequest = {
                                request: null,
                                isOpen: false,
                                isExecuting: false,
                                error: null,
                            };
                        });
                    } catch (error) {
                        set((state) => {
                            state.userRequest.isExecuting = false;
                            state.userRequest.error = error instanceof Error ? error.message : String(error);
                        });
                    }
                },

                executeUserRequestAction: async (action, request) => {
                    const requireId = (value: UUID | undefined, name: string): UUID => {
                        if (!value) throw new Error(`${name} is required for ${action}`);
                        return value;
                    };

                    const { sessionId, disconnect, connect, restoreSession, isAuthenticated } = get();

                    switch (action) {
                        case 'CLIENT_DOWNLOAD_SYMBOLS':
                        case 'CLIENT_DOWNLOAD_CARD_IMAGES':
                            get().showAlert(
                                'Resources',
                                'The web client loads and caches card images and symbols through the browser. A desktop-style resource download is not required here.'
                            );
                            break;

                        case 'CLIENT_DISCONNECT_FULL':
                        case 'CLIENT_DISCONNECT_KEEP_GAMES':
                        case 'CLIENT_EXIT_FULL':
                        case 'CLIENT_EXIT_KEEP_GAMES':
                            await disconnect(action === 'CLIENT_DISCONNECT_KEEP_GAMES' || action === 'CLIENT_EXIT_KEEP_GAMES');
                            if (action === 'CLIENT_EXIT_FULL' || action === 'CLIENT_EXIT_KEEP_GAMES') {
                                get().showAlert('Disconnected', 'You are disconnected. Close the browser tab when you are ready.');
                            }
                            break;

                        case 'CLIENT_QUIT_TOURNAMENT':
                            await webSocketBridgeService.quitTournament(requireId(request.tournamentId, 'tournamentId'), sessionId);
                            break;

                        case 'CLIENT_QUIT_DRAFT_TOURNAMENT':
                            await webSocketBridgeService.quitDraft(requireId(request.tournamentId, 'tournamentId'), sessionId);
                            break;

                        case 'CLIENT_CONCEDE_GAME':
                            await webSocketBridgeService.sendPlayerAction('CONCEDE', requireId(request.gameId, 'gameId'), sessionId, null);
                            break;

                        case 'CLIENT_CONCEDE_MATCH':
                            await wsService.send('matchQuit', [requireId(request.gameId, 'gameId'), sessionId]);
                            break;

                        case 'CLIENT_STOP_WATCHING':
                            await wsService.send('gameWatchStop', [requireId(request.gameId, 'gameId'), sessionId]);
                            break;

                        case 'CLIENT_REMOVE_TABLE':
                            await webSocketBridgeService.removeTable(
                                sessionId,
                                requireId(request.roomId, 'roomId'),
                                requireId(request.tableId, 'tableId'),
                            );
                            break;

                        case 'CLIENT_RECONNECT':
                            await connect();
                            if (isAuthenticated) {
                                await restoreSession();
                            }
                            break;

                        case 'CLIENT_REPLAY_ACTION':
                            await webSocketBridgeService.stopReplay(requireId(request.gameId, 'gameId'), sessionId);
                            break;

                        default:
                            await webSocketBridgeService.sendPlayerAction(
                                action,
                                requireId(request.gameId, 'gameId'),
                                sessionId,
                                request.relatedUserId ?? null,
                            );
                            break;
                    }
                },

                closeUserRequest: () => {
                    resolveLocalUserRequest(null);
                    set((state) => {
                        state.userRequest = {
                            request: null,
                            isOpen: false,
                            isExecuting: false,
                            error: null,
                        };
                    });
                },

                closeAlert: () => {
                    set((state) => {
                        state.alert.isOpen = false;
                    });
                },
            })),
            {
                name: 'xmage-session',
                version: 4,
                partialize: (state) => ({
                    serverUrl: state.serverUrl,
                    connectionProfiles: state.connectionProfiles,
                    lastSessionId: state.lastSessionId,
                    userName: state.userName,
                    userData: state.userData,
                    isAuthenticated: state.isAuthenticated,
                    // Don't persist isRestoring
                }),
                migrate: (persistedState: any, version: number) => {
                    if (version === 0 || version === 1) {
                        // Fix SkipPrioritySteps from old convention to correct Java convention
                        // Old: main1: false meant STOP, true meant SKIP
                        // New (correct): main1: true means STOP, false means SKIP
                        if (persistedState.userData?.userSkipPrioritySteps) {
                            // Reset to correct defaults - don't try to migrate, just replace
                            persistedState.userData.userSkipPrioritySteps = DEFAULT_USER_SKIP_PRIORITY_STEPS;
                        }
                    }
                    if (persistedState.serverUrl) {
                        persistedState.serverUrl = normalizeServerUrl(persistedState.serverUrl);
                    }
                    if (version < 4 && persistedState.lastSessionId && persistedState.userName && persistedState.serverUrl) {
                        const connectionProfiles = persistedState.connectionProfiles ?? {};
                        persistedState.connectionProfiles = {
                            ...connectionProfiles,
                            restoreSessionsByServerUser: {
                                ...(connectionProfiles.restoreSessionsByServerUser ?? {}),
                                [connectionProfileKey(persistedState.serverUrl, persistedState.userName)]: {
                                    sessionId: persistedState.lastSessionId,
                                    savedAt: new Date(0).toISOString(),
                                },
                            },
                        };
                    }
                    persistedState.connectionProfiles = connectionProfileService.normalize({
                        lastServerUrl: persistedState.serverUrl ?? DEFAULT_SERVER_URL,
                        ...(persistedState.connectionProfiles ?? {}),
                    });
                    return persistedState;
                },
                merge: (persistedState, currentState) => {
                    const persisted = (persistedState ?? {}) as Partial<SessionState>;
                    const connectionProfiles = connectionProfileService.normalize({
                        lastServerUrl: persisted.serverUrl ?? currentState.serverUrl,
                        ...(persisted.connectionProfiles ?? {}),
                    });

                    return {
                        ...currentState,
                        ...persisted,
                        serverUrl: normalizeServerUrl(persisted.serverUrl ?? connectionProfiles.lastServerUrl),
                        connectionProfiles,
                        connectionStatus: currentState.connectionStatus,
                        serverStatus: currentState.serverStatus,
                        isRestoring: false,
                        alert: currentState.alert,
                        userRequest: currentState.userRequest,
                    };
                },
            }
        ),
        { name: 'SessionStore' }
    )
);
