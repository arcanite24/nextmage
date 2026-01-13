/**
 * Session Store
 * 
 * Manages user authentication state and session data.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { wsService, ConnectionStatus } from '../services';
import { UUID, UserData, UserSkipPrioritySteps, SkipPrioritySteps } from '../types';

// Default user skip priority steps (sensible defaults for new users)
const defaultSkipSteps: SkipPrioritySteps = {
    upkeep: true,
    draw: true,
    main1: false,
    beforeCombat: true,
    endOfCombat: true,
    main2: false,
    endOfTurn: true,
};

const defaultUserSkipPrioritySteps: UserSkipPrioritySteps = {
    yourTurn: defaultSkipSteps,
    opponentTurn: { ...defaultSkipSteps, main1: true, main2: true },
    stopOnDeclareAttackers: true,
    stopOnDeclareBlockersWithZeroPermanents: false,
    stopOnDeclareBlockersWithAnyPermanents: true,
    stopOnAllMainPhases: false,
    stopOnAllEndPhases: false,
    stopOnStackNewObjects: false,
};

const defaultUserData: UserData = {
    groupId: 0,
    avatarId: 51,
    allowRequestShowHandCards: false,
    confirmEmptyManaPool: true,
    userSkipPrioritySteps: defaultUserSkipPrioritySteps,
    flagName: 'world.png',
    askMoveToGraveOrder: false,
    manaPoolAutomatic: true,
    manaPoolAutomaticRestricted: false,
    passPriorityCast: false,
    passPriorityActivation: false,
    autoOrderTrigger: true,
    autoTargetLevel: 0,
    useSameSettingsForReplacementEffects: true,
    useFirstManaAbility: false,
};

interface SessionState {
    // Connection state
    serverUrl: string;
    connectionStatus: ConnectionStatus;

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
}

interface SessionActions {
    // Connection
    setServerUrl: (url: string) => void;
    connect: () => Promise<void>;
    disconnect: () => void;

    // Authentication
    login: (userName: string, password: string) => Promise<boolean>;
    register: (userName: string, password: string, email: string) => Promise<boolean>;
    logout: () => void;

    // User data
    setUserData: (userData: Partial<UserData>) => Promise<boolean>;
    updateSkipPrioritySteps: (steps: Partial<UserSkipPrioritySteps>) => Promise<boolean>;

    // Internal
    _setConnectionStatus: (status: ConnectionStatus) => void;
    _setError: (error: string | null) => void;
    _initializeCallbackHandler: () => void;

    restoreSession: () => Promise<boolean>;
}

// Helper to generate UUID
const generateUUID = (): string => {
    return crypto.randomUUID();
};

export const useSessionStore = create<SessionState & SessionActions>()(
    devtools(
        persist(
            immer((set, get) => ({
                // Initial state
                serverUrl: 'ws://localhost:17172',
                connectionStatus: 'disconnected',
                sessionId: crypto.randomUUID(),
                lastSessionId: null,
                userName: null,
                userId: null,
                userData: null,
                isAuthenticated: false,
                isRestoring: false,
                mainRoomId: null,
                lastError: null,

                // Connection
                setServerUrl: (url) => {
                    set((state) => {
                        state.serverUrl = url;
                    });
                },

                connect: async () => {
                    const { serverUrl, connectionStatus, _setError, _initializeCallbackHandler } = get();
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
                        set((state) => { state.connectionStatus = 'connecting'; });

                        if (wsService.status !== 'connected') {
                            await wsService.connect(serverUrl);
                            _initializeCallbackHandler();
                        }
                    } catch (error) {
                        _setError(`Connection failed: ${error}`);
                        set((state) => { state.connectionStatus = 'disconnected'; });
                        throw error;
                    }
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

                disconnect: () => {
                    wsService.disconnect();
                    set((state) => {
                        state.isAuthenticated = false;
                        state.userName = null;
                        state.mainRoomId = null;
                    });
                },

                // Authentication
                login: async (userName, password) => {
                    const { sessionId, lastSessionId, _setError } = get();
                    _setError(null);

                    try {
                        // Connect user
                        const result = await wsService.send<boolean>('connectUser', [
                            userName,
                            password,
                            sessionId,
                            lastSessionId || '', // restoreSessionId
                            '', // version (server uses its own)
                            '', // userIdStr
                        ]);

                        if (!result) {
                            _setError('Login failed: Invalid credentials');
                            return false;
                        }

                        // Set initial user data
                        const userData = { ...defaultUserData };
                        await wsService.send<boolean>('connectSetUserData', [
                            userName,
                            sessionId,
                            userData,
                            '1.0.0', // client version
                            '',      // userIdStr
                        ]);

                        // Get main room ID (ALWAYS fetch fresh - it changes on server restart)
                        const mainRoomId = await wsService.send<UUID>('serverGetMainRoomId', []);

                        set((state) => {
                            state.userName = userName;
                            state.userData = userData;
                            state.isAuthenticated = true;
                            state.mainRoomId = mainRoomId;
                            state.lastSessionId = sessionId;
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

                        return true;
                    } catch (error) {
                        _setError(`Registration failed: ${error}`);
                        return false;
                    }
                },

                logout: () => {
                    const { sessionId } = get();

                    // Send disconnect if connected
                    if (wsService.status === 'connected') {
                        wsService.send('playerLogout', [sessionId]).catch(() => { });
                    }

                    set((state) => {
                        state.isAuthenticated = false;
                        state.userName = null;
                        state.userData = null;
                        state.mainRoomId = null;
                    });
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

                // Internal
                _setConnectionStatus: (status) => {
                    set((state) => {
                        state.connectionStatus = status;
                    });
                },

                _setError: (error) => {
                    set((state) => {
                        state.lastError = error;
                    });
                },

                _initializeCallbackHandler: () => {
                    // Subscribe to connection status changes
                    wsService.onStatusChange((status) => {
                        get()._setConnectionStatus(status);
                    });
                },
            })),
            {
                name: 'xmage-session',
                partialize: (state) => ({
                    serverUrl: state.serverUrl,
                    lastSessionId: state.lastSessionId,
                    userName: state.userName,
                    userData: state.userData,
                    isAuthenticated: state.isAuthenticated,
                    // Don't persist isRestoring
                }),
            }
        ),
        { name: 'SessionStore' }
    )
);
