/**
 * Chat Store
 * 
 * Manages chat messages and channels.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { appConfigService, wsService } from '../services';
import {
    applyProfanityFilter,
    chatCueTitle,
    handleLocalChatCommand,
    normalizeChatCallback,
    readProfanityLevelFromWhisper,
    shouldSuppressIgnoredMessage,
    type ChatDisplayType,
} from '../services/ChatMessageService';
import { audioFeedbackService } from '../services/AudioFeedbackService';
import { useSessionStore } from './sessionStore';
import { useSettingsStore } from './settingsStore';
import { useLobbyStore } from './lobbyStore';
import { useNotificationStore } from './notificationStore';
import { UUID, ClientCallback } from '../types';

export interface ChatMessage {
    id: string;
    timestamp: Date | null;
    userName: string;
    message: string;
    type: ChatDisplayType;
    turnInfo: string | null;
    color: string | null;
    messageType: string | null;
    soundToPlay: string | null;
}

export interface ChatChannel {
    id: UUID;
    name: string;
    kind: 'lobby' | 'table' | 'game' | 'tournament' | 'custom';
    messages: ChatMessage[];
    isJoined: boolean;
    unreadCount: number;
    joinedAt: number;
}

interface ChatState {
    channels: Record<UUID, ChatChannel>;
    activeChannelId: UUID | null;

    // Quick access to common channels
    lobbyChannelId: UUID | null;
    gameChannelId: UUID | null;
    tableChannelId: UUID | null;
    tournamentChannelId: UUID | null;
}

interface ChatActions {
    // Channel management
    joinChannel: (channelId: UUID, name?: string) => Promise<void>;
    leaveChannel: (channelId: UUID) => Promise<void>;
    setActiveChannel: (channelId: UUID | null) => void;

    // Special channel lookups
    joinLobbyChat: (roomId: UUID) => Promise<void>;
    joinGameChat: (gameId: UUID) => Promise<void>;
    joinTableChat: (tableId: UUID) => Promise<UUID | null>;
    joinTournamentChat: (tournamentId: UUID) => Promise<UUID | null>;
    recoverJoinedChannels: () => Promise<void>;

    // Messaging
    sendMessage: (message: string, channelId?: UUID) => Promise<void>;

    // System messages
    addSystemMessage: (channelId: UUID, message: string) => void;

    // Callbacks
    handleCallback: (callback: ClientCallback) => void;

    // Helpers
    getActiveChannel: () => ChatChannel | null;
    getChannelMessages: (channelId: UUID) => ChatMessage[];
}

export const useChatStore = create<ChatState & ChatActions>()(
    devtools(
        immer((set, get) => ({
            // Initial state
            channels: {},
            activeChannelId: null,
            lobbyChannelId: null,
            gameChannelId: null,
            tableChannelId: null,
            tournamentChannelId: null,

            // Channel management
            joinChannel: async (channelId, name = 'Chat') => {
                const { userName, sessionId } = useSessionStore.getState();
                if (!userName) return;

                try {
                    await wsService.send('chatJoin', [channelId, sessionId, userName]);

                    set((state) => {
                        const existingChannel = state.channels[channelId];
                        state.channels[channelId] = {
                            id: channelId,
                            name,
                            kind: existingChannel?.kind ?? inferChannelKind(name),
                            messages: existingChannel?.messages ?? [],
                            isJoined: true,
                            unreadCount: existingChannel?.unreadCount ?? 0,
                            joinedAt: existingChannel?.joinedAt ?? Date.now(),
                        };
                        if (!state.activeChannelId) {
                            state.activeChannelId = channelId;
                        }
                    });
                } catch (error) {
                    console.error('Failed to join channel:', error);
                }
            },

            leaveChannel: async (channelId) => {
                const { sessionId } = useSessionStore.getState();

                try {
                    await wsService.send('chatLeave', [channelId, sessionId]);

                    set((state) => {
                        if (state.channels[channelId]) {
                            state.channels[channelId].isJoined = false;
                        }
                        if (state.activeChannelId === channelId) {
                            state.activeChannelId = null;
                        }
                        if (state.lobbyChannelId === channelId) {
                            state.lobbyChannelId = null;
                        }
                        if (state.gameChannelId === channelId) {
                            state.gameChannelId = null;
                        }
                        if (state.tableChannelId === channelId) {
                            state.tableChannelId = null;
                        }
                    });
                } catch (error) {
                    console.error('Failed to leave channel:', error);
                }
            },

            setActiveChannel: (channelId) => {
                set((state) => {
                    state.activeChannelId = channelId;
                    if (channelId && state.channels[channelId]) {
                        state.channels[channelId].unreadCount = 0;
                    }
                });
            },

            // Special channel lookups
            joinLobbyChat: async (roomId) => {
                try {
                    const channelId = await wsService.send<UUID>('chatFindByRoom', [roomId]);
                    await get().joinChannel(channelId, 'Lobby');
                    set((state) => {
                        state.lobbyChannelId = channelId;
                        state.channels[channelId].kind = 'lobby';
                    });
                } catch (error) {
                    console.error('Failed to join lobby chat:', error);
                }
            },

            joinGameChat: async (gameId) => {
                try {
                    const channelId = await wsService.send<UUID>('chatFindByGame', [gameId]);
                    await get().joinChannel(channelId, 'Game');
                    set((state) => {
                        state.gameChannelId = channelId;
                        state.channels[channelId].kind = 'game';
                        state.activeChannelId = channelId;
                    });
                } catch (error) {
                    console.error('Failed to join game chat:', error);
                }
            },

            joinTableChat: async (tableId) => {
                try {
                    const channelId = await wsService.send<UUID>('chatFindByTable', [tableId]);
                    await get().joinChannel(channelId, 'Table');
                    set((state) => {
                        state.tableChannelId = channelId;
                        state.channels[channelId].kind = 'table';
                    });
                    return channelId;
                } catch (error) {
                    console.error('Failed to join table chat:', error);
                    return null;
                }
            },

            joinTournamentChat: async (tournamentId) => {
                try {
                    const channelId = await wsService.send<UUID>('chatFindByTournament', [tournamentId]);
                    await get().joinChannel(channelId, 'Tournament');
                    set((state) => {
                        state.tournamentChannelId = channelId;
                        state.channels[channelId].kind = 'tournament';
                    });
                    return channelId;
                } catch (error) {
                    console.error('Failed to join tournament chat:', error);
                    return null;
                }
            },

            recoverJoinedChannels: async () => {
                const channelsToRecover = Object.values(get().channels).filter(channel => channel.isJoined);
                for (const channel of channelsToRecover) {
                    await get().joinChannel(channel.id, channel.name);
                }
            },

            // Messaging
            sendMessage: async (message, channelId) => {
                const targetChannelId = channelId || get().activeChannelId;
                const { userName, serverUrl } = useSessionStore.getState();

                if (!targetChannelId || !userName || !message.trim()) return;

                const commandResult = handleLocalChatCommand(message, {
                    serverUrl,
                    currentUserName: userName,
                    ignoredUsers: appConfigService.loadIgnoredUsers(serverUrl),
                    addIgnoredUser: (targetUser) => {
                        const nextUsers = appConfigService.addIgnoredUser(serverUrl, targetUser);
                        useLobbyStore.getState().refreshTableFilters();
                        return nextUsers;
                    },
                    removeIgnoredUser: (targetUser) => {
                        const nextUsers = appConfigService.removeIgnoredUser(serverUrl, targetUser);
                        useLobbyStore.getState().refreshTableFilters();
                        return nextUsers;
                    },
                    setProfanityFilterLevel: (level) => {
                        useSettingsStore.getState().setSetting('chatProfanityFilterLevel', level);
                    },
                });
                if (commandResult.handled) {
                    get().addSystemMessage(targetChannelId, commandResult.response ?? '');
                    return;
                }

                try {
                    await wsService.send('chatSendMessage', [targetChannelId, userName, message]);
                } catch (error) {
                    console.error('Failed to send message:', error);
                }
            },

            // System messages
            addSystemMessage: (channelId, message) => {
                set((state) => {
                    const channel = state.channels[channelId];
                    if (channel) {
                        channel.messages.push({
                            id: crypto.randomUUID(),
                            timestamp: new Date(),
                            userName: 'System',
                            message,
                            type: 'system',
                            turnInfo: null,
                            color: 'BLUE',
                            messageType: 'USER_INFO',
                            soundToPlay: null,
                        });
                    }
                });
            },

            // Callbacks
            handleCallback: (callback) => {
                const normalizedMessage = normalizeChatCallback(callback);
                if (!normalizedMessage) return;

                const { serverUrl, userName: currentUserName } = useSessionStore.getState();
                if (shouldSuppressIgnoredMessage(normalizedMessage, serverUrl, appConfigService.isUserIgnored.bind(appConfigService))) {
                    return;
                }

                const profanityLevel = readProfanityLevelFromWhisper(normalizedMessage, currentUserName);
                if (profanityLevel !== null) {
                    useSettingsStore.getState().setSetting('chatProfanityFilterLevel', profanityLevel);
                }

                const filteredMessage = applyProfanityFilter(
                    normalizedMessage,
                    currentUserName,
                    useSettingsStore.getState().settings.chatProfanityFilterLevel,
                );
                const channelId = filteredMessage.channelId;

                set((state) => {
                    // Ensure channel exists
                    if (!state.channels[channelId]) {
                        state.channels[channelId] = {
                            id: channelId,
                            name: 'Chat',
                            kind: 'custom',
                            messages: [],
                            isJoined: true,
                            unreadCount: 0,
                            joinedAt: Date.now(),
                        };
                    }

                    state.channels[channelId].messages.push({
                        id: crypto.randomUUID(),
                        timestamp: filteredMessage.timestamp,
                        userName: filteredMessage.userName,
                        message: filteredMessage.message,
                        type: filteredMessage.displayType,
                        turnInfo: filteredMessage.turnInfo,
                        color: filteredMessage.color,
                        messageType: filteredMessage.messageType,
                        soundToPlay: filteredMessage.soundToPlay,
                    });
                    if (state.activeChannelId !== channelId) {
                        state.channels[channelId].unreadCount += 1;
                    }

                    // Keep only last 500 messages per channel
                    if (state.channels[channelId].messages.length > 500) {
                        state.channels[channelId].messages = state.channels[channelId].messages.slice(-500);
                    }
                });

                const cueTitle = chatCueTitle(filteredMessage.soundToPlay);
                if (cueTitle) {
                    audioFeedbackService.playChatCue(filteredMessage.soundToPlay!, useSettingsStore.getState().settings);
                    useNotificationStore.getState().enqueue({
                        kind: filteredMessage.soundToPlay === 'PlayerWhispered' ? 'message' : 'game',
                        tone: filteredMessage.soundToPlay === 'PlayerWhispered' ? 'warning' : 'info',
                        title: cueTitle,
                        message: filteredMessage.message,
                        browser: filteredMessage.soundToPlay === 'PlayerWhispered',
                        dedupeKey: `chat-cue:${filteredMessage.channelId}:${filteredMessage.soundToPlay}:${callback.messageId}`,
                        sourceMethod: callback.method,
                    });
                }
            },

            // Helpers
            getActiveChannel: () => {
                const { channels, activeChannelId } = get();
                return activeChannelId ? channels[activeChannelId] || null : null;
            },

            getChannelMessages: (channelId) => {
                const channel = get().channels[channelId];
                return channel?.messages || [];
            },
        })),
        { name: 'ChatStore' }
    )
);

function inferChannelKind(name: string): ChatChannel['kind'] {
    const normalized = name.toLowerCase();
    if (normalized.includes('lobby')) return 'lobby';
    if (normalized.includes('table')) return 'table';
    if (normalized.includes('game')) return 'game';
    if (normalized.includes('tournament')) return 'tournament';
    return 'custom';
}
