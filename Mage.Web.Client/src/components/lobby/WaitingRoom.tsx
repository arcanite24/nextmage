/**
 * Waiting Room Component
 * 
 * Displayed when a user has joined a table but the game hasn't started yet.
 * Allows the host to start the match.
 */

import React, { useEffect, useState } from 'react';
import { useLobbyStore, useSessionStore } from '../../stores';
import { Button } from '../common';
import { TableState } from '../../types';
import './WaitingRoom.css';

export const WaitingRoom: React.FC = () => {
    const { currentTable, myDeck, leaveTable, startMatch, fetchTables, addAI, refreshCurrentTable } = useLobbyStore();
    const { userName } = useSessionStore();
    const [showDeckSelector, setShowDeckSelector] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isAddingAI, setIsAddingAI] = useState(false);

    // Poll for updates on this specific table to ensure seats are up to date
    useEffect(() => {
        const interval = setInterval(() => {
            refreshCurrentTable();
        }, 1000); // 1 second polling for active waiting room
        return () => clearInterval(interval);
    }, [refreshCurrentTable]);

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
        setShowDeckSelector(true);
    };

    const handleAISelectedDeck = async (deck: any, name: string) => { // Using explicit types would be better but keeping it simple for now
        if (!currentTable) return;

        // Validation: Ensure deck has cards
        if (!deck || !deck.cards || deck.cards.length === 0) {
            alert("Please select a valid deck with cards for the AI.");
            return;
        }

        const aiName = window.prompt("Enter AI Name:", "Computer");
        if (!aiName) {
            setShowDeckSelector(false);
            return;
        }

        setIsAddingAI(true);
        // Ensure deck has correct structure if it came from editor
        const deckList = deck.cards ? deck : { cards: [], sideboard: [], name: 'Unknown' };

        const success = await addAI(currentTable.tableId, aiName, deckList, 5);
        if (!success) {
            alert("Failed to add AI player. Check if the deck is valid for this format.");
        }
        setIsAddingAI(false);
        setShowDeckSelector(false);
    };

    const handleRefresh = () => {
        fetchTables();
        refreshCurrentTable();
    };

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

            {/* Re-using JoinTableDialog as a Deck Selector for now, since we don't have a dedicated component */}
            {/* Ideally we would refactor JoinTableDialog to separate deck selection logic */}
            {/* For this step, we will use a modified JoinTableDialog logic or create a simple modal inline? */}
            {/* Actually, let's inject a new simple modal for deck selection since we don't have DeckEditorModal */}

            {showDeckSelector && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>Select Deck for AI</h3>
                            <button className="modal-close" onClick={() => setShowDeckSelector(false)}>×</button>
                        </div>
                        <div className="modal-content">
                            <p>For now, the AI will use the same deck as you.</p>
                            <p>TODO: Implement full deck selector.</p>
                        </div>
                        <div className="modal-footer">
                            <Button onClick={() => setShowDeckSelector(false)}>Cancel</Button>
                            <Button variant="primary" onClick={() => handleAISelectedDeck(myDeck, "AI Deck")}>Use My Deck</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
