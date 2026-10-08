/**
 * Waiting Room Component
 * 
 * Displayed when a user has joined a table but the game hasn't started yet.
 * Allows the host to start the match.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLobbyStore, useSessionStore, useGameStore, useChatStore } from '../../stores';
import { Button, Modal } from '../common';
import { TableState, DeckCardLists, SeatView } from '../../types';
import { getDefaultComputerPlayerType } from '../../services';
import { DeckPicker } from './DeckPicker';
import { ChatPanel } from '../chat/ChatPanel';
import './WaitingRoom.css';

export const WaitingRoom: React.FC = () => {
    const {
        currentTable,
        leaveTable,
        startTable,
        fetchTables,
        addAI,
        swapSeats,
        removeTable,
        tableActionError,
        clearTableActionError,
        refreshCurrentTable,
        serverOptions,
        isLoadingOptions,
        optionsError,
        loadServerOptions,
    } = useLobbyStore();
    const { userName, showLocalUserRequest } = useSessionStore();
    const [showAddAIModal, setShowAddAIModal] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isJoiningGame, setIsJoiningGame] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);
    const [failedJoinGameId, setFailedJoinGameId] = useState<string | null>(null);
    const [isAddingAI, setIsAddingAI] = useState(false);
    const [selectedSeatIndex, setSelectedSeatIndex] = useState(0);
    const [isSwappingSeat, setIsSwappingSeat] = useState(false);
    const [isRemovingTable, setIsRemovingTable] = useState(false);

    // AI Configuration State
    const [aiName, setAiName] = useState('Computer');
    const [aiPlayerType, setAiPlayerType] = useState('');
    const [aiSkill, setAiSkill] = useState(2);
    const [aiDeck, setAiDeck] = useState<DeckCardLists | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const { joinGame, gameId } = useGameStore();
    const tableChatChannelId = useChatStore(state => state.tableChannelId);
    const joinTableChat = useChatStore(state => state.joinTableChat);
    const leaveChatChannel = useChatStore(state => state.leaveChannel);
    const computerPlayerTypes = useMemo(
        () => serverOptions.playerTypes.filter(playerType => playerType.isAI),
        [serverOptions.playerTypes],
    );
    const defaultComputerPlayerType = getDefaultComputerPlayerType(serverOptions);

    // Poll for updates on this specific table
    useEffect(() => {
        const interval = setInterval(() => {
            refreshCurrentTable();
        }, 1000);
        return () => clearInterval(interval);
    }, [refreshCurrentTable]);

    // Auto-join game if table is starting/dueling and we have a game ID
    // This recovers players who missed the 'startGame' callback (e.g. due to reconnect)
    useEffect(() => {
        if (!currentTable) return;

        const isGameActive = currentTable.tableState === TableState.STARTING ||
            currentTable.tableState === TableState.DUELING;

        if (isGameActive && currentTable.games && currentTable.games.length > 0 && !isJoiningGame) {
            const activeGameId = currentTable.games[0];
            // Only join if we aren't already in this game
            if (activeGameId !== gameId && activeGameId !== failedJoinGameId) {
                console.log('WaitingRoom: Table is active, auto-joining game:', activeGameId);
                setStartError(null);
                setIsJoiningGame(true);
                joinGame(activeGameId).then(joined => {
                    if (!joined) {
                        setFailedJoinGameId(activeGameId);
                        setStartError('Failed to join the game. Refresh the table or reconnect and try again.');
                    }
                }).finally(() => {
                    setIsJoiningGame(false);
                });
            }
        }
    }, [currentTable, failedJoinGameId, gameId, isJoiningGame, joinGame]);

    useEffect(() => {
        if (showAddAIModal) {
            void loadServerOptions();
        }
    }, [loadServerOptions, showAddAIModal]);

    useEffect(() => {
        if (
            showAddAIModal &&
            (!aiPlayerType || !computerPlayerTypes.some(playerType => playerType.value === aiPlayerType))
        ) {
            setAiPlayerType(defaultComputerPlayerType);
        }
    }, [aiPlayerType, computerPlayerTypes, defaultComputerPlayerType, showAddAIModal]);

    // Reset AI modal state when closing
    useEffect(() => {
        if (!showAddAIModal) {
            setAiName('Computer');
            setAiPlayerType(defaultComputerPlayerType);
            setAiSkill(2);
            setAiDeck(null);
            setAiError(null);
        }
    }, [defaultComputerPlayerType, showAddAIModal]);

    useEffect(() => {
        const seatCount = currentTable?.seats?.length ?? 0;
        if (seatCount === 0) {
            setSelectedSeatIndex(0);
            return;
        }
        setSelectedSeatIndex((current) => Math.min(current, seatCount - 1));
    }, [currentTable?.seats?.length]);

    useEffect(() => {
        const tableId = currentTable?.tableId;
        if (!tableId) return;

        let disposed = false;
        let joinedChannelId: string | null = null;

        void joinTableChat(tableId).then((channelId) => {
            if (!channelId) return;
            if (disposed) return;
            joinedChannelId = channelId;
        });

        return () => {
            disposed = true;
            if (joinedChannelId) {
                void leaveChatChannel(joinedChannelId);
            }
        };
    }, [currentTable?.tableId, joinTableChat, leaveChatChannel]);

    const tableToRender = currentTable;

    // If we have no table context at all, don't render (or render error)
    if (!currentTable) return null;

    // Safety fallback for missing data
    const safeTableName = tableToRender?.tableName || 'Unknown Table';
    const safeControllerName = tableToRender?.controllerName || '';
    const safeState = tableToRender?.tableState || TableState.WAITING;
    const safeSeats = tableToRender?.seats || [];
    const safeGameType = tableToRender?.gameType || 'Unknown';
    const safeDeckType = tableToRender?.deckType || 'Unknown';
    const safeLimited = Boolean(tableToRender?.limited);
    const safeIsTournament = Boolean(tableToRender?.isTournament);

    const isHost = safeControllerName === userName;
    const isHostEquivalent = safeControllerName.split(', ').includes(userName || '');
    const canManageTable = isHost || isHostEquivalent;

    const canStart = canManageTable && safeState === TableState.READY_TO_START;

    const isStartingState = safeState === TableState.STARTING || safeState === TableState.DUELING;
    const hasEmptySeats = safeSeats.some(seat => !isSeatOccupied(seat));
    const canMoveSeats = canManageTable
        && safeState === TableState.READY_TO_START
        && safeSeats.length > 1
        && !isStartingState;
    const canMoveSelectedSeatUp = canMoveSeats && selectedSeatIndex > 0 && !isSwappingSeat;
    const canMoveSelectedSeatDown = canMoveSeats && selectedSeatIndex < safeSeats.length - 1 && !isSwappingSeat;
    const getLatestTableActionError = () => useLobbyStore.getState().tableActionError ?? tableActionError;

    const handleStart = async () => {
        setStartError(null);
        setFailedJoinGameId(null);
        setIsStarting(true);
        const started = await startTable();
        if (!started) {
            await refreshCurrentTable();
            setStartError(getLatestTableActionError() ?? `Failed to start the ${safeIsTournament ? 'tournament' : 'match'}. Check your session and table state, then try again.`);
        } else {
            await refreshCurrentTable();
        }
        setIsStarting(false);
    };

    const handleAddAIClick = () => {
        if (!canManageTable) {
            setStartError('Only the table host can add computer players.');
            return;
        }
        if (!hasEmptySeats) {
            setStartError('There are no empty seats for another player.');
            return;
        }
        setShowAddAIModal(true);
        setAiPlayerType(defaultComputerPlayerType);
        setAiError(null);
    };

    const handleMoveSeat = async (direction: -1 | 1) => {
        if (!currentTable || !canMoveSeats) return;

        const targetIndex = selectedSeatIndex + direction;
        if (targetIndex < 0 || targetIndex >= safeSeats.length) return;

        setStartError(null);
        setIsSwappingSeat(true);

        try {
            const moved = await swapSeats(currentTable.tableId, selectedSeatIndex, targetIndex);
            if (moved) {
                setSelectedSeatIndex(targetIndex);
            } else {
                await refreshCurrentTable();
                setStartError(getLatestTableActionError() ?? 'Failed to move the selected seat. Refresh the table and try again.');
            }
        } finally {
            setIsSwappingSeat(false);
        }
    };

    const handleLeaveTable = async () => {
        setStartError(null);
        clearTableActionError();

        const left = await leaveTable();
        if (!left) {
            await refreshCurrentTable();
            setStartError(getLatestTableActionError() ?? 'Failed to leave the table. Refresh the table or reconnect and try again.');
        }
    };

    const handleRemoveTable = async () => {
        if (!currentTable || !canManageTable) {
            setStartError('Only the table host can remove this table.');
            return;
        }

        const confirmed = await showLocalUserRequest({
            title: 'Remove table?',
            message: `Remove "${safeTableName}" from the room? This closes the waiting room for every player at the table.`,
            tableId: currentTable.tableId,
            button2Text: 'Cancel',
            button2Action: null,
            button1Text: 'Remove table',
            button1Action: null,
        });

        if (confirmed !== 1) return;

        setStartError(null);
        setIsRemovingTable(true);

        try {
            const removed = await removeTable(currentTable.tableId);
            if (!removed) {
                await refreshCurrentTable();
                setStartError(getLatestTableActionError() ?? 'Failed to remove the table. Refresh the table and try again.');
            }
        } finally {
            setIsRemovingTable(false);
        }
    };

    const handleSubmitAI = async () => {
        if (!currentTable || !aiDeck) {
            setAiError('Please select a deck for the AI player.');
            return;
        }

        if (!aiName.trim()) {
            setAiError('Please enter a name for the AI player.');
            return;
        }

        if (!canManageTable) {
            setAiError('Only the table host can add computer players.');
            return;
        }

        if (!hasEmptySeats) {
            setAiError('There are no empty seats for another player.');
            return;
        }

        if (!aiPlayerType || !computerPlayerTypes.some(playerType => playerType.value === aiPlayerType)) {
            setAiError('Please select a computer player type.');
            return;
        }

        setAiError(null);
        setIsAddingAI(true);

        try {
            // Basic validation
            const totalCards = aiDeck.cards.reduce((sum, c) => sum + c.amount, 0);
            if (totalCards < 1) {
                setAiError("Please select a deck with cards.");
                setIsAddingAI(false);
                return;
            }

            const success = await addAI(currentTable.tableId, aiName.trim(), aiDeck, aiPlayerType, aiSkill);

            if (success) {
                setShowAddAIModal(false);
            } else {
                setAiError("Failed to add AI player. Check if the deck is valid for this format.");
            }
        } catch (err: unknown) {
            setAiError(err instanceof Error ? err.message : "Error adding AI player");
        } finally {
            setIsAddingAI(false);
        }
    };

    const handleRefresh = () => {
        setStartError(null);
        clearTableActionError();
        setFailedJoinGameId(null);
        fetchTables();
        refreshCurrentTable();
    };

    const aiMainDeckCount = aiDeck?.cards.reduce((sum, c) => sum + c.amount, 0) || 0;
    const canSubmitAI = Boolean(
        aiDeck
        && aiMainDeckCount >= 1
        && aiName.trim()
        && aiPlayerType
        && canManageTable
        && hasEmptySeats
        && computerPlayerTypes.length > 0
    );

    return (
        <>
            <div className="waiting-room-overlay" data-testid="waiting-room">
                <div className="waiting-room-panel">
                    <div className="waiting-header">
                        <h3>{isStartingState ? 'Joining Game...' : `Waiting Room: ${safeTableName}`}</h3>
                        <div className="waiting-status" data-testid="waiting-room-status">
                            Status: <span className={`status-${safeState.toLowerCase()}`}>
                                {isStartingState ? 'Starting...' : (tableToRender?.tableStateText || safeState)}
                            </span>
                        </div>
                    </div>

                    <div className="waiting-content">
                        <div className="waiting-info">
                            <div className="info-item">
                                <label>Game Type:</label>
                                <span>{safeGameType}</span>
                            </div>
                            <div className="info-item">
                                <label>Format:</label>
                                <span>{safeDeckType}</span>
                            </div>
                            <div className="info-item">
                                <label>Host:</label>
                                <span>{safeControllerName || '(None)'}</span>
                            </div>
                        </div>

                        <div className="waiting-table-workspace">
                            <div className="seats-list" data-testid="waiting-room-seats">
                                <h4>Players ({tableToRender?.seatsInfo || '0/2'})</h4>
                                {safeSeats.length > 0 && (
                                    <div className="waiting-seat-header" aria-hidden="true">
                                        <span>Seat</span>
                                        <span>Loc</span>
                                        <span>Player</span>
                                        <span>Rating</span>
                                        <span>Type</span>
                                        <span>History</span>
                                    </div>
                                )}
                                {safeSeats.map((seat, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className={`waiting-seat-row ${selectedSeatIndex === index ? 'selected' : ''}`}
                                        onClick={() => setSelectedSeatIndex(index)}
                                        data-testid="waiting-room-seat"
                                        data-selected={selectedSeatIndex === index ? 'true' : 'false'}
                                        aria-pressed={selectedSeatIndex === index}
                                    >
                                        <span className="seat-num">Seat {getSeatNumber(seat, index)}</span>
                                        <span className="seat-flag" title={seat.flagName || 'No flag'}>
                                            {seat.flagName || '-'}
                                        </span>
                                        <span className={`seat-player ${isSeatOccupied(seat) ? 'occupied' : 'empty'}`}>
                                            {getSeatPlayerName(seat) || '(Empty)'}
                                        </span>
                                        <span className="seat-rating">{getSeatRating(seat, safeLimited)}</span>
                                        <span className="seat-type">{formatPlayerType(seat.playerType)}</span>
                                        <span className="seat-history">{seat.history || ''}</span>
                                    </button>
                                ))}
                                {safeSeats.length === 0 && (
                                    <div className="no-seats">No seat data available. Try refreshing.</div>
                                )}
                            </div>

                            <ChatPanel
                                className="waiting-room-chat"
                                channelId={tableChatChannelId}
                                title="Table chat"
                                showTabs={false}
                                collapsible={false}
                                emptyMessage="No table messages yet"
                            />
                        </div>
                    </div>

                    <div className="waiting-actions">
                        {startError && (
                            <div className="waiting-error-message">
                                {startError}
                            </div>
                        )}
                        <div className="waiting-actions-group">
                            <Button variant="ghost" onClick={handleRefresh}>
                                Refresh
                            </Button>
                            <Button variant="ghost" onClick={() => void handleLeaveTable()}>
                                Leave Table
                            </Button>
                            {canManageTable && !isStartingState && (
                                <Button
                                    variant="danger"
                                    onClick={() => void handleRemoveTable()}
                                    isLoading={isRemovingTable}
                                    data-testid="waiting-room-remove-table-button"
                                >
                                    Remove Table
                                </Button>
                            )}
                        </div>

                        <div className="waiting-actions-group waiting-actions-primary">
                            {canMoveSeats && (
                                <>
                                    <Button
                                        variant="secondary"
                                        onClick={() => void handleMoveSeat(-1)}
                                        disabled={!canMoveSelectedSeatUp}
                                        isLoading={isSwappingSeat}
                                        data-testid="waiting-room-move-seat-up-button"
                                    >
                                        Move Up
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => void handleMoveSeat(1)}
                                        disabled={!canMoveSelectedSeatDown}
                                        isLoading={isSwappingSeat}
                                        data-testid="waiting-room-move-seat-down-button"
                                    >
                                        Move Down
                                    </Button>
                                </>
                            )}
                            {canManageTable && hasEmptySeats && !isStartingState && (
                                <Button
                                    variant="secondary"
                                    onClick={handleAddAIClick}
                                    isLoading={isAddingAI}
                                >
                                    Add AI
                                </Button>
                            )}
                            {canStart && (
                                <Button
                                    variant="primary"
                                    onClick={handleStart}
                                    isLoading={isStarting}
                                    className="start-match-btn"
                                    data-testid={safeIsTournament ? 'waiting-room-start-tournament-button' : 'waiting-room-start-match-button'}
                                >
                                    {safeIsTournament ? 'Start Tournament' : 'Start Match'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add AI Modal */}
            <Modal
                isOpen={showAddAIModal}
                onClose={() => setShowAddAIModal(false)}
                title="Add AI Player"
                size="lg"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowAddAIModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmitAI}
                            isLoading={isAddingAI}
                            disabled={!canSubmitAI}
                        >
                            Add AI Player
                        </Button>
                    </>
                }
            >
                <div className="add-ai-modal">
                    {aiError && (
                        <div className="ai-error-message">
                            {aiError}
                        </div>
                    )}

                    <div className="ai-config-grid">
                        <div className="input-group">
                            <label htmlFor="aiName" className="input-label">
                                AI Player Name
                            </label>
                            <input
                                id="aiName"
                                type="text"
                                className="input"
                                value={aiName}
                                onChange={(e) => setAiName(e.target.value)}
                                placeholder="Computer"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="aiSkill" className="input-label">
                                Skill
                            </label>
                            <input
                                id="aiSkill"
                                type="number"
                                className="input"
                                min={1}
                                max={10}
                                step={1}
                                value={aiSkill}
                                onChange={(e) => setAiSkill(clampSkillLevel(Number(e.target.value)))}
                                data-testid="ai-skill-input"
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="aiPlayerType" className="input-label">
                            Computer Type
                        </label>
                        <select
                            id="aiPlayerType"
                            className="input"
                            value={aiPlayerType}
                            onChange={(e) => setAiPlayerType(e.target.value)}
                            disabled={isLoadingOptions || computerPlayerTypes.length === 0}
                            data-testid="ai-player-type-select"
                        >
                            {computerPlayerTypes.map(playerType => (
                                <option key={playerType.value} value={playerType.value}>
                                    {playerType.label}
                                </option>
                            ))}
                        </select>
                        <p className="ai-helper-text">
                            {isLoadingOptions
                                ? 'Loading server player types...'
                                : optionsError
                                    ? `Using fallback player types: ${optionsError}`
                                    : computerPlayerTypes.length === 0
                                        ? 'This server did not report any computer player types.'
                                        : 'Available computer types come from the connected server.'}
                        </p>
                    </div>

                    {/* Deck Picker */}
                    <DeckPicker
                        selectedDeck={aiDeck}
                        onDeckChange={setAiDeck}
                        format={safeDeckType}
                        isLoading={isAddingAI}
                        error={null}
                        onError={setAiError}
                        label="AI Deck"
                    />
                </div>
            </Modal>
        </>
    );
};

function clampSkillLevel(value: number): number {
    if (!Number.isFinite(value)) return 2;
    return Math.min(10, Math.max(1, Math.round(value)));
}

function getSeatPlayerName(seat: SeatView): string {
    return (seat.name ?? seat.playerName ?? '').trim();
}

function isSeatOccupied(seat: SeatView): boolean {
    return Boolean(getSeatPlayerName(seat) || seat.playerId);
}

function getSeatNumber(seat: SeatView, index: number): number {
    return typeof seat.seatNum === 'number' ? seat.seatNum + 1 : index + 1;
}

function getSeatRating(seat: SeatView, limited: boolean): string {
    if (!isSeatOccupied(seat)) return '';
    const rating = limited ? seat.limitedRating : seat.constructedRating;
    if (typeof rating === 'number' && rating > 0) return String(rating);
    if (typeof seat.generalRating === 'number' && seat.generalRating > 0) return String(seat.generalRating);
    return '';
}

function formatPlayerType(playerType: string): string {
    if (!playerType) return '';
    if (playerType.includes(' ') || playerType.includes('-')) return playerType;
    return playerType
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
