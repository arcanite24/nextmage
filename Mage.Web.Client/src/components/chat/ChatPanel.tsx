/**
 * Chat Panel Component
 * 
 * Collapsible chat panel with message history and input.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores';
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
                    <svg className="chat-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="chat-title">{activeChannel?.name ?? title}</span>
                    {!isExpanded && messages.length > 0 && (
                        <span className="unread-badge">{messages.length}</span>
                    )}
                </div>
                {collapsible && (
                    <button className="expand-toggle" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                            <path d="M4 6l4 4 4-4" />
                        </svg>
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
                                >
                                    {channel.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.length === 0 ? (
                            <div className="chat-empty">{isInputDisabled ? 'Joining chat...' : emptyMessage}</div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className={`chat-message message-${msg.type}`}>
                                    {msg.type !== 'system' && (
                                        <span className="message-author">{msg.userName}:</span>
                                    )}
                                    <span className="message-text">{msg.message}</span>
                                    <span className="message-time">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
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

export default ChatPanel;
