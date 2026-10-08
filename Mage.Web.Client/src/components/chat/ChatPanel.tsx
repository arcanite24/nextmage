/**
 * Chat Panel Component
 * 
 * Collapsible chat panel with message history and input.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { useChatStore } from '../../stores';
import { renderChatMessageHtml } from '../../services/ChatMessageService';
import { Button } from '../common';
import './ChatPanel.css';

interface ChatPanelProps {
    className?: string;
    channelId?: string | null;
    title?: string;
    showTabs?: boolean;
    collapsible?: boolean;
    emptyMessage?: string;
    draftMessage?: string | null;
    onDraftConsumed?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
    className = '',
    channelId = null,
    title = 'Chat',
    showTabs = true,
    collapsible = true,
    emptyMessage = 'No messages yet',
    draftMessage = null,
    onDraftConsumed,
}) => {
    const [message, setMessage] = useState('');
    const [isExpanded, setIsExpanded] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        channels,
        activeChannelId,
        setActiveChannel,
        sendMessage,
        getActiveChannel,
    } = useChatStore();

    const activeChannel = channelId ? channels[channelId] ?? null : getActiveChannel();
    const messages = activeChannel?.messages || [];

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (isExpanded) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, isExpanded]);

    useEffect(() => {
        if (draftMessage === null) return;

        setIsExpanded(true);
        setMessage(draftMessage);
        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(draftMessage.length, draftMessage.length);
        });
        onDraftConsumed?.();
    }, [draftMessage, onDraftConsumed]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            sendMessage(message, channelId ?? undefined);
            setMessage('');
        }
    };

    const channelList = Object.values(channels);
    const isInputDisabled = Boolean(channelId && !activeChannel);

    return (
        <div className={`chat-panel glass-panel ${isExpanded ? 'expanded' : 'collapsed'} ${className}`}>
            {/* Header */}
            <div
                className={`chat-header ${collapsible ? 'is-collapsible' : ''}`}
                onClick={() => {
                    if (collapsible) setIsExpanded(!isExpanded);
                }}
            >
                <div className="chat-header-left">
                    <MessageSquare className="chat-icon" size={18} aria-hidden="true" />
                    <span className="chat-title">{activeChannel?.name ?? title}</span>
                    {!isExpanded && activeChannel && activeChannel.unreadCount > 0 && (
                        <span className="unread-badge">{activeChannel.unreadCount}</span>
                    )}
                </div>
                {collapsible && (
                    <button
                        className="expand-toggle"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        <ChevronDown
                            size={16}
                            aria-hidden="true"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                    </button>
                )}
            </div>

            {isExpanded && (
                <>
                    {/* Channel tabs */}
                    {showTabs && channelList.length > 1 && (
                        <div className="chat-tabs">
                            {channelList.map((channel) => (
                                <button
                                    key={channel.id}
                                    className={`chat-tab ${activeChannelId === channel.id ? 'active' : ''}`}
                                    onClick={() => setActiveChannel(channel.id)}
                                    data-channel-kind={channel.kind}
                                    data-joined={channel.isJoined ? 'true' : 'false'}
                                >
                                    <span>{channel.name}</span>
                                    {channel.unreadCount > 0 && (
                                        <span className="chat-tab-unread">{channel.unreadCount}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.length === 0 ? (
                            <div className="chat-empty">{isInputDisabled ? 'Joining chat...' : emptyMessage}</div>
                        ) : (
                            messages.map((msg) => {
                                const authorLabel = formatAuthorLabel(msg.type, msg.userName);
                                return (
                                    <div
                                        key={msg.id}
                                        className={`chat-message message-${msg.type}`}
                                        data-message-type={msg.messageType ?? msg.type}
                                        data-sound-cue={msg.soundToPlay ?? ''}
                                    >
                                        <span className="message-meta">
                                            {msg.timestamp && (
                                                <time dateTime={msg.timestamp.toISOString()}>
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </time>
                                            )}
                                            {msg.turnInfo && <span className="message-turn">{msg.turnInfo}</span>}
                                        </span>
                                        {authorLabel && (
                                            <span className="message-author">{authorLabel}</span>
                                        )}
                                        <span
                                            className="message-text"
                                            dangerouslySetInnerHTML={{ __html: renderChatMessageHtml(msg.message) }}
                                        />
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form className="chat-input-form" onSubmit={handleSend}>
                        <input
                            ref={inputRef}
                            type="text"
                            className="chat-input"
                            placeholder="Type a message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={isInputDisabled}
                        />
                        <Button type="submit" variant="primary" size="sm" disabled={isInputDisabled || !message.trim()}>
                            Send
                        </Button>
                    </form>
                </>
            )}
        </div>
    );
};

function formatAuthorLabel(type: string, userName: string): string | null {
    if (!userName || type === 'system' || type === 'status' || type === 'personal' || type === 'game') return null;
    if (type === 'whisper-from') return `Whisper from ${userName}:`;
    if (type === 'whisper-to') return `Whisper to ${userName}:`;
    return `${userName}:`;
}

export default ChatPanel;
