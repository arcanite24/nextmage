/**
 * Chat Store
 * 
 * Manages chat messages and channels.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { wsService } from '../services';
import { useSessionStore } from './sessionStore';
import { UUID, ClientCallback } from '../types';

export interface ChatMessage {
    id: string;
    timestamp: Date;
    userName: string;
    message: string;
    type: 'user' | 'system' | 'status' | 'error';
}

interface ChatChannel {
    id: UUID;
    name: string;
    messages: ChatMessage[];
    isJoined: boolean;
}

interface ChatState {
    channels: Record<UUID, ChatChannel>;
    activeChannelId: UUID | null;

    // Quick access to common channels
    lobbyChannelId: UUID | null;
    gameChannelId: UUID | null;
}

interface ChatActions {
    // Channel management
    joinChannel: (channelId: UUID, name?: string) => Promise<void>;
    leaveChannel: (channelId: UUID) => Promise<void>;
    setActiveChannel: (channelId: UUID | null) => void;

    // Special channel lookups
    joinLobbyChat: (roomId: UUID) => Promise<void>;
    joinGameChat: (gameId: UUID) => Promise<void>;
    joinTableChat: (tableId: UUID) => Promise<void>;

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

            // Channel management
            joinChannel: async (channelId, name = 'Chat') => {
                const { userName, sessionId } = useSessionStore.getState();
                if (!userName) return;

                try {
                    await wsService.send('chatJoin', [channelId, sessionId, userName]);

                    set((state) => {
                        state.channels[channelId] = {
                            id: channelId,
                            name,
                            messages: [],
                            isJoined: true,
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
                    });
                } catch (error) {
                    console.error('Failed to leave channel:', error);
                }
            },

            setActiveChannel: (channelId) => {
                set((state) => { state.activeChannelId = channelId; });
            },

            // Special channel lookups
            joinLobbyChat: async (roomId) => {
                try {
                    const channelId = await wsService.send<UUID>('chatFindByRoom', [roomId]);
                    await get().joinChannel(channelId, 'Lobby');
                    set((state) => { state.lobbyChannelId = channelId; });
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
                } catch (error) {
                    console.error('Failed to join table chat:', error);
                }
            },

            // Messaging
            sendMessage: async (message, channelId) => {
                const targetChannelId = channelId || get().activeChannelId;
                const { userName } = useSessionStore.getState();

                if (!targetChannelId || !userName || !message.trim()) return;

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
                        });
                    }
                });
            },

            // Callbacks
            handleCallback: (callback) => {
                if (callback.method !== 'chatMessage') return;

                // Parse chat message data
                // The format varies based on the message type
                const data = callback.data as {
                    chatId?: UUID;
                    userName?: string;
                    message?: string;
                    type?: string;
                };

                const channelId = callback.objectId || data.chatId;
                if (!channelId) return;

                set((state) => {
                    // Ensure channel exists
                    if (!state.channels[channelId]) {
                        state.channels[channelId] = {
                            id: channelId,
                            name: 'Chat',
                            messages: [],
                            isJoined: true,
                        };
                    }

                    // Add the message
                    const messageType = data.type === 'STATUS' ? 'status' :
                        data.type === 'ERROR' ? 'error' :
                            data.userName === 'System' ? 'system' : 'user';

                    state.channels[channelId].messages.push({
                        id: crypto.randomUUID(),
                        timestamp: new Date(),
                        userName: data.userName || 'Unknown',
                        message: typeof data.message === 'string' ? data.message : String(callback.data),
                        type: messageType,
                    });

                    // Keep only last 500 messages per channel
                    if (state.channels[channelId].messages.length > 500) {
                        state.channels[channelId].messages = state.channels[channelId].messages.slice(-500);
                    }
                });
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
