import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useChatStore } from '../../stores';
import { GameView, UUID } from '../../types';
import './MatchLogPanel.css';

interface MatchLogPanelProps {
    gameId: UUID | null;
    gameView: GameView;
    lastMessage: string | null;
    lastError: string | null;
}

interface MatchLogEntry {
    id: string;
    kind: 'game' | 'personal' | 'status' | 'error' | 'chat';
    label: string;
    message: string;
    time?: Date;
}

const MAX_VISIBLE_ENTRIES = 10;

export const MatchLogPanel: React.FC<MatchLogPanelProps> = ({ gameId, gameView, lastMessage, lastError }) => {
    const { channels, activeChannelId } = useChatStore(useShallow(state => ({
        channels: state.channels,
        activeChannelId: state.activeChannelId,
    })));

    const entries = React.useMemo<MatchLogEntry[]>(() => {
        const chatEntries = Object.values(channels)
            .flatMap((channel) => channel.messages.map((message) => ({
                id: `${channel.id}-${message.id}`,
                kind: message.type === 'error' ? 'error' : message.type === 'status' ? 'status' : message.type === 'system' ? 'status' : 'chat',
                label: channel.name,
                message: message.type === 'user' ? `${message.userName}: ${message.message}` : message.message,
                time: message.timestamp,
            } satisfies MatchLogEntry)))
            .sort((first, second) => second.time.getTime() - first.time.getTime());

        const systemEntries: MatchLogEntry[] = [];
        if (lastError) {
            systemEntries.push({
                id: 'last-error',
                kind: 'error',
                label: 'Error',
                message: lastError,
            });
        }
        if (lastMessage) {
            systemEntries.push({
                id: 'last-message',
                kind: 'personal',
                label: 'Game',
                message: lastMessage,
            });
        }

        return [...systemEntries, ...chatEntries].slice(0, MAX_VISIBLE_ENTRIES);
    }, [channels, lastError, lastMessage]);

    const handleExport = React.useCallback(() => {
        const exportPayload = {
            exportedAt: new Date().toISOString(),
            gameId,
            turn: gameView.turn,
            phase: gameView.phase,
            step: gameView.step,
            activePlayerName: gameView.activePlayerName,
            priorityPlayerName: gameView.priorityPlayerName,
            lastMessage,
            lastError,
            activeChannelId,
            chat: Object.values(channels).map((channel) => ({
                id: channel.id,
                name: channel.name,
                messages: channel.messages.map((message) => ({
                    timestamp: message.timestamp.toISOString(),
                    userName: message.userName,
                    type: message.type,
                    message: message.message,
                })),
            })),
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `mage-game-log-${gameId ?? 'match'}-${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }, [activeChannelId, channels, gameId, gameView, lastError, lastMessage]);

    return (
        <section className="match-log-panel" data-testid="match-log-panel" aria-label="Match log">
            <div className="match-log-header">
                <h4>Match Log</h4>
                <button
                    type="button"
                    className="match-log-export"
                    onClick={handleExport}
                    data-testid="match-log-export"
                >
                    Export JSON
                </button>
            </div>

            <div className="match-log-context">
                <span>Turn {gameView.turn}</span>
                <span>{gameView.step}</span>
                <span>Active: {gameView.activePlayerName || 'Unknown'}</span>
                <span>Priority: {gameView.priorityPlayerName || 'None'}</span>
            </div>

            <div className="match-log-entries">
                {entries.length === 0 ? (
                    <div className="match-log-empty">No match messages yet.</div>
                ) : (
                    entries.map((entry) => (
                        <article key={entry.id} className={`match-log-entry match-log-${entry.kind}`}>
                            <div className="match-log-entry-meta">
                                <strong>{entry.label}</strong>
                                {entry.time && <time>{entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}
                            </div>
                            <p>{entry.message}</p>
                        </article>
                    ))
                )}
            </div>
        </section>
    );
};
