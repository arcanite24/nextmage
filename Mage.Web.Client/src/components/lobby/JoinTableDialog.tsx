/**
 * Join Table Dialog
 * 
 * Modal for joining a game table with deck selection.
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import { useLobbyStore, useSessionStore } from '../../stores';
import { TableView, DeckCardLists } from '../../types';
import { DeckPicker } from './DeckPicker';
import './JoinTableDialog.css';

interface JoinTableDialogProps {
    isOpen: boolean;
    onClose: () => void;
    table: TableView | null;
    onJoined: () => void;
}

export const JoinTableDialog: React.FC<JoinTableDialogProps> = ({
    isOpen,
    onClose,
    table,
    onJoined,
}) => {
    const [selectedDeck, setSelectedDeck] = useState<DeckCardLists | null>(null);
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { userName } = useSessionStore();
    const { joinTable } = useLobbyStore();

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedDeck(null);
            setPassword('');
            setError(null);
        }
    }, [isOpen]);

    const handleJoin = async () => {
        if (!table || !userName || !selectedDeck) return;

        setError(null);
        setIsLoading(true);

        try {
            // Validate deck has at least some cards
            const totalCards = selectedDeck.cards.reduce((sum, c) => sum + c.amount, 0);
            if (totalCards < 40) {
                setError(`Deck has only ${totalCards} cards. Most formats require at least 40-60 cards.`);
                setIsLoading(false);
                return;
            }

            const success = await joinTable(
                table.tableId,
                userName,
                selectedDeck,
                table.passworded ? password : undefined
            );

            if (success) {
                onJoined();
                onClose();
            } else {
                setError('Failed to join table. The table may be full or you may not meet the requirements.');
            }
        } catch (err: any) {
            // Display specific server error (e.g. "Card not found")
            const msg = err.message || String(err);
            // remove confusing "Error: " prefix if present from wsService
            setError(msg.replace(/^Error:\s*/, ''));
        } finally {
            setIsLoading(false);
        }
    };

    if (!table) return null;

    const mainDeckCount = selectedDeck?.cards.reduce((sum, c) => sum + c.amount, 0) || 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Join: ${table.tableName}`}
            size="lg"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleJoin}
                        isLoading={isLoading}
                        disabled={!selectedDeck || mainDeckCount < 1}
                    >
                        Join Table
                    </Button>
                </>
            }
        >
            <div className="join-table-dialog">
                {/* Table info summary */}
                <div className="table-info-summary">
                    <div className="info-row">
                        <span className="info-label">Format:</span>
                        <span className="info-value">{table.deckType}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Game Type:</span>
                        <span className="info-value">{table.gameType}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Host:</span>
                        <span className="info-value">{table.controllerName}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Players:</span>
                        <span className="info-value">{table.seatsInfo}</span>
                    </div>
                </div>

                {error && (
                    <div className="join-error">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8.75 8a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 1.5 0v3z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Password if needed */}
                {table.passworded && (
                    <div className="input-group">
                        <label htmlFor="tablePassword" className="input-label">
                            Table Password
                        </label>
                        <input
                            id="tablePassword"
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter table password"
                        />
                    </div>
                )}

                {/* Deck Picker */}
                <DeckPicker
                    selectedDeck={selectedDeck}
                    onDeckChange={setSelectedDeck}
                    format={table.deckType}
                    isLoading={isLoading}
                    error={null}
                    onError={setError}
                    label="Your Deck"
                />
            </div>
        </Modal>
    );
};

export default JoinTableDialog;
