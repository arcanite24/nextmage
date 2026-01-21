/**
 * Waiting Room Component
 * 
 * Displayed when a user has joined a table but the game hasn't started yet.
 * Allows the host to start the match.
 */

import React, { useEffect, useState } from 'react';
import { useLobbyStore, useSessionStore, useGameStore } from '../../stores';
import { Button, Modal } from '../common';
import { TableState, DeckCardLists } from '../../types';
import { DeckPicker } from './DeckPicker';
import './WaitingRoom.css';

export const WaitingRoom: React.FC = () => {
    const { currentTable, myDeck, leaveTable, startMatch, fetchTables, addAI, refreshCurrentTable } = useLobbyStore();
    const { userName } = useSessionStore();
    const [showAddAIModal, setShowAddAIModal] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isAddingAI, setIsAddingAI] = useState(false);

    // AI Configuration State
    const [aiName, setAiName] = useState('Computer');
    const [aiDeck, setAiDeck] = useState<DeckCardLists | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const { joinGame, gameId } = useGameStore();

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

        if (isGameActive && currentTable.games && currentTable.games.length > 0) {
            const activeGameId = currentTable.games[0];
            // Only join if we aren't already in this game
            if (activeGameId !== gameId) {
                console.log('WaitingRoom: Table is active, auto-joining game:', activeGameId);
                joinGame(activeGameId);
            }
        }
    }, [currentTable, gameId, joinGame]);

    // Reset AI modal state when closing
    useEffect(() => {
        if (!showAddAIModal) {
            setAiName('Computer');
            setAiDeck(null);
            setAiError(null);
        }
    }, [showAddAIModal]);

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

    const isHost = safeControllerName === userName;
    const isHostEquivalent = safeControllerName.split(', ').includes(userName || '');

    const canStart = (isHost || isHostEquivalent) && safeState === TableState.READY_TO_START;

    const isStartingState = safeState === TableState.STARTING || safeState === TableState.DUELING;
    const hasEmptySeats = safeSeats.some(s => !s.name);

    const handleStart = async () => {
        setIsStarting(true);
        await startMatch();
        setIsStarting(false);
    };

    const handleAddAIClick = () => {
        setShowAddAIModal(true);
        setAiError(null);
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

            // Skill level 5 seems to be standard/default for now
            const success = await addAI(currentTable.tableId, aiName.trim(), aiDeck, 5);

            if (success) {
                setShowAddAIModal(false);
            } else {
                setAiError("Failed to add AI player. Check if the deck is valid for this format.");
            }
        } catch (err: any) {
            setAiError(err.message || "Error adding AI player");
        } finally {
            setIsAddingAI(false);
        }
    };

    const handleRefresh = () => {
        fetchTables();
        refreshCurrentTable();
    };

    const aiMainDeckCount = aiDeck?.cards.reduce((sum, c) => sum + c.amount, 0) || 0;

    return (
        <>
            <div className="waiting-room-overlay">
                <div className="waiting-room-panel">
                    <div className="waiting-header">
                        <h3>{isStartingState ? 'Joining Game...' : `Waiting Room: ${safeTableName}`}</h3>
                        <div className="waiting-status">
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

                        <div className="seats-list">
                            <h4>Players ({tableToRender?.seatsInfo || '0/2'})</h4>
                            {safeSeats.map((seat, index) => (
                                <div key={index} className="seat-row">
                                    <span className="seat-num">Seat {(typeof seat.seatNum === 'number' ? seat.seatNum : index) + 1}</span>
                                    <span className={`seat-player ${seat.name ? 'occupied' : 'empty'}`}>
                                        {seat.name || '(Empty)'}
                                    </span>
                                    <span className="seat-type">{seat.playerType}</span>
                                </div>
                            ))}
                            {safeSeats.length === 0 && (
                                <div className="no-seats">No seat data available. Try refreshing.</div>
                            )}
                        </div>
                    </div>

                    <div className="waiting-actions">
                        <Button variant="ghost" onClick={fetchTables}>
                            Refresh
                        </Button>
                        <Button variant="ghost" onClick={leaveTable}>
                            Leave Table
                        </Button>
                        {isHost && hasEmptySeats && !isStartingState && (
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
                            >
                                Start Match
                            </Button>
                        )}
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
                            disabled={!aiDeck || aiMainDeckCount < 1 || !aiName.trim()}
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

                    {/* AI Name Input */}
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
