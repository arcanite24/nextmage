/**
 * Join Table Dialog
 * 
 * Modal for joining a game table with deck selection.
 */

import React, { useState } from 'react';
import { Modal, Button } from '../common';
import { useLobbyStore, useSessionStore } from '../../stores';
import { TableView, DeckCardLists, DeckCardInfo } from '../../types';
import './JoinTableDialog.css';

interface JoinTableDialogProps {
    isOpen: boolean;
    onClose: () => void;
    table: TableView | null;
    onJoined: () => void;
}

// Parse a deck list from text (MTGO/Arena format)
function parseDeckList(text: string): DeckCardLists {
    const lines = text.trim().split('\n');
    const cards: DeckCardInfo[] = [];
    const sideboard: DeckCardInfo[] = [];

    let inSideboard = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Check for sideboard marker
        if (trimmed.toLowerCase() === 'sideboard' || trimmed.toLowerCase() === 'sideboard:') {
            inSideboard = true;
            continue;
        }

        // Parse card line: "4 Lightning Bolt" or "4x Lightning Bolt" or "4 Lightning Bolt (M21) 123"
        const match = trimmed.match(/^(\d+)x?\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s*(\d+)?)?$/i);

        if (match) {
            const quantity = parseInt(match[1], 10);
            const cardName = match[2].trim();
            const setCode = match[3] || '';
            const cardNumber = match[4] || '';

            const cardInfo: DeckCardInfo = {
                cardName,
                setCode,
                cardNumber,
                quantity,
            };

            if (inSideboard) {
                sideboard.push(cardInfo);
            } else {
                cards.push(cardInfo);
            }
        }
    }

    return { cards, sideboard };
}

// Format a deck list back to text
function formatDeckList(deck: DeckCardLists): string {
    let text = '';

    for (const card of deck.cards) {
        if (card.setCode) {
            text += `${card.quantity} ${card.cardName} (${card.setCode}) ${card.cardNumber}\n`;
        } else {
            text += `${card.quantity} ${card.cardName}\n`;
        }
    }

    if (deck.sideboard.length > 0) {
        text += '\nSideboard\n';
        for (const card of deck.sideboard) {
            if (card.setCode) {
                text += `${card.quantity} ${card.cardName} (${card.setCode}) ${card.cardNumber}\n`;
            } else {
                text += `${card.quantity} ${card.cardName}\n`;
            }
        }
    }

    return text;
}

// Sample starter deck
const SAMPLE_DECK: DeckCardLists = {
    name: 'Sample Deck',
    cards: [
        { cardName: 'Mountain', setCode: 'M21', cardNumber: '269', quantity: 20 },
        { cardName: 'Lightning Bolt', setCode: 'M21', cardNumber: '152', quantity: 4 },
        { cardName: 'Shock', setCode: 'M21', cardNumber: '159', quantity: 4 },
        { cardName: 'Goblin Guide', setCode: 'ZNE', cardNumber: '4', quantity: 4 },
        { cardName: 'Monastery Swiftspear', setCode: 'KTK', cardNumber: '118', quantity: 4 },
        { cardName: 'Eidolon of the Great Revel', setCode: 'JOU', cardNumber: '94', quantity: 4 },
    ],
    sideboard: [],
};

export const JoinTableDialog: React.FC<JoinTableDialogProps> = ({
    isOpen,
    onClose,
    table,
    onJoined,
}) => {
    const [deckText, setDeckText] = useState(() => formatDeckList(SAMPLE_DECK));
    const [deckName, setDeckName] = useState('My Deck');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { userName } = useSessionStore();
    const { joinTable } = useLobbyStore();

    const handleJoin = async () => {
        if (!table || !userName) return;

        setError(null);
        setIsLoading(true);

        try {
            // Parse the deck
            const deck = parseDeckList(deckText);
            deck.name = deckName;

            // Validate deck has at least some cards
            const totalCards = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
            if (totalCards < 40) {
                setError(`Deck has only ${totalCards} cards. Most formats require at least 40-60 cards.`);
                setIsLoading(false);
                return;
            }

            const success = await joinTable(
                table.tableId,
                userName,
                deck,
                table.passworded ? password : undefined
            );

            if (success) {
                onJoined();
                onClose();
            } else {
                setError('Failed to join table. The table may be full or you may not meet the requirements.');
            }
        } catch (err) {
            setError(`Error joining table: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadSample = () => {
        setDeckText(formatDeckList(SAMPLE_DECK));
        setDeckName('Sample Red Deck');
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setDeckText(text);
        } catch (err) {
            setError('Failed to read clipboard. Please paste manually.');
        }
    };

    if (!table) return null;

    const parsedDeck = parseDeckList(deckText);
    const maindeckCount = parsedDeck.cards.reduce((sum, c) => sum + c.quantity, 0);
    const sideboardCount = parsedDeck.sideboard.reduce((sum, c) => sum + c.quantity, 0);

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
                        disabled={maindeckCount < 1}
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
                            🔒 Table Password
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

                {/* Deck section */}
                <div className="deck-section">
                    <div className="deck-header">
                        <h4>Your Deck</h4>
                        <div className="deck-actions">
                            <Button variant="ghost" size="sm" onClick={handlePaste}>
                                📋 Paste
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleLoadSample}>
                                📦 Sample Deck
                            </Button>
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="deckName" className="input-label">
                            Deck Name
                        </label>
                        <input
                            id="deckName"
                            type="text"
                            className="input"
                            value={deckName}
                            onChange={(e) => setDeckName(e.target.value)}
                            placeholder="My Deck"
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="deckList" className="input-label">
                            Deck List
                            <span className="deck-count">
                                {maindeckCount} main / {sideboardCount} sideboard
                            </span>
                        </label>
                        <textarea
                            id="deckList"
                            className="input deck-textarea"
                            value={deckText}
                            onChange={(e) => setDeckText(e.target.value)}
                            placeholder={`Paste your deck here in MTGO/Arena format:

4 Lightning Bolt
4 Monastery Swiftspear
20 Mountain

Sideboard
2 Smash to Smithereens`}
                            rows={12}
                        />
                    </div>

                    <div className="deck-format-help">
                        <strong>Supported formats:</strong> MTGO, Arena, or simple list (e.g., "4 Card Name")
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default JoinTableDialog;
