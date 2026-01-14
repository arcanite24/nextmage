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

        // Parse card line: 
        // 4 Lightning Bolt
        // 4x Lightning Bolt
        // 4 Lightning Bolt (M21) 123
        // 4 Burst Lightning <199> [PRM] (F)

        // Strategy: 
        // 1. Extract amount at start
        // 2. Extract Set Code from [...] or (...) if present
        // 3. Remove all extra junk (<...>, [...], (...), numbers at end) to get clean name

        const amountMatch = trimmed.match(/^(\d+)x?\s+/);
        if (amountMatch) {
            const amount = parseInt(amountMatch[1], 10);
            let rest = trimmed.substring(amountMatch[0].length).trim();

            let setCode: string | undefined = undefined;
            let cardNumber: string | undefined = undefined;

            // Try to find set code in [SET] (MTGO style)
            const setMatchBrackets = rest.match(/\s+\[([A-Za-z0-9_]+)\]/);
            if (setMatchBrackets) {
                setCode = setMatchBrackets[1];
            } else {
                // Try (SET) (Arena/Standard style)
                const setMatchParens = rest.match(/\s+\(([A-Za-z0-9_]+)\)/);
                if (setMatchParens) {
                    setCode = setMatchParens[1];
                }
            }

            // Try to find card number at the very end if it's a number
            const numberMatch = rest.match(/\s+(\d+)$/);
            if (numberMatch) {
                cardNumber = numberMatch[1];
            }

            // Clean up name: remove tags like <...>, [...], (...), and card number
            // Remove <...> (Collector number in brackets often found in exports)
            rest = rest.replace(/\s+<[^>]+>/g, '');
            // Remove [...]
            rest = rest.replace(/\s+\[[^\]]+\]/g, '');
            // Remove (...) (Foil markings etc, but optionally set code too if we extracted it)
            rest = rest.replace(/\s+\([^)]+\)/g, '');
            // Remove trailing numbers (collector info)
            rest = rest.replace(/\s+\d+$/, '');

            const cardName = rest.trim();

            // IMPORTANT: The server's Deck.load uses findCard(setCode, cardNumber) which requires 
            // BOTH to be present. If we only have setCode without cardNumber, the lookup fails.
            // To align with Java client behavior: only send setCode+cardNumber if we have BOTH,
            // otherwise send empty and let server resolve by name using findPreferredCoreExpansionCard.
            const finalSetCode = (setCode && cardNumber) ? setCode : undefined;
            const finalCardNumber = (setCode && cardNumber) ? cardNumber : undefined;

            const cardInfo: DeckCardInfo = {
                cardName,
                setCode: finalSetCode,
                cardNumber: finalCardNumber,
                amount,
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
            text += `${card.amount} ${card.cardName} (${card.setCode}) ${card.cardNumber || ''}\n`;
        } else {
            text += `${card.amount} ${card.cardName}\n`;
        }
    }

    if (deck.sideboard.length > 0) {
        text += '\nSideboard\n';
        for (const card of deck.sideboard) {
            if (card.setCode) {
                text += `${card.amount} ${card.cardName} (${card.setCode}) ${card.cardNumber || ''}\n`;
            } else {
                text += `${card.amount} ${card.cardName}\n`;
            }
        }
    }

    return text;
}

// Sample starter deck
const SAMPLE_DECK: DeckCardLists = {
    name: 'Sample Deck',
    cards: [
        { cardName: 'Mountain', setCode: 'M21', cardNumber: '269', amount: 20 },
        { cardName: 'Lightning Bolt', setCode: 'M21', cardNumber: '152', amount: 4 },
        { cardName: 'Shock', setCode: 'M21', cardNumber: '159', amount: 4 },
        { cardName: 'Goblin Guide', setCode: 'ZNE', cardNumber: '4', amount: 4 },
        { cardName: 'Monastery Swiftspear', setCode: 'KTK', cardNumber: '118', amount: 4 },
        { cardName: 'Eidolon of the Great Revel', setCode: 'JOU', cardNumber: '94', amount: 4 },
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
            const totalCards = deck.cards.reduce((sum, c) => sum + c.amount, 0);
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                setDeckText(text);
                // Try to derive name from filename
                const name = file.name.replace(/\.(dck|txt)$/i, '');
                setDeckName(name);
            }
        };
        reader.onerror = () => {
            setError('Failed to read file.');
        };
        reader.readAsText(file);
    };

    if (!table) return null;

    const parsedDeck = parseDeckList(deckText);
    const maindeckCount = parsedDeck.cards.reduce((sum, c) => sum + c.amount, 0);
    const sideboardCount = parsedDeck.sideboard.reduce((sum, c) => sum + c.amount, 0);

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
                            <label className="btn btn-ghost btn-sm upload-btn">
                                📁 Upload
                                <input
                                    type="file"
                                    accept=".dck,.txt"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>
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
