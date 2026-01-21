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

import { DeckSerializer } from '../../services/DeckSerializer';
import { cardResolverService } from '../../services';
import { DeckSelector } from './DeckSelector';

// Sample starter deck for default init
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
    const [deckText, setDeckText] = useState(() => DeckSerializer.exportDeck(SAMPLE_DECK));
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
            let deck = DeckSerializer.importDeck(deckText);
            deck.name = deckName;

            // Validate deck has at least some cards
            const totalCards = deck.cards.reduce((sum, c) => sum + c.amount, 0);
            if (totalCards < 40) {
                setError(`Deck has only ${totalCards} cards. Most formats require at least 40-60 cards.`);
                setIsLoading(false);
                return;
            }

            // Check if any cards need resolution (missing setCode or cardNumber)
            const needsResolution = [...deck.cards, ...deck.sideboard].some(
                card => !card.setCode || !card.cardNumber
            );

            if (needsResolution) {
                console.log('[JoinTableDialog] Resolving cards from server...');
                deck = await cardResolverService.resolveDeck(deck);
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

    const parsedDeck = DeckSerializer.importDeck(deckText);
    const maindeckCount = parsedDeck.cards.reduce((sum: number, c: DeckCardInfo) => sum + c.amount, 0);
    const sideboardCount = parsedDeck.sideboard.reduce((sum: number, c: DeckCardInfo) => sum + c.amount, 0);

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
                <DeckSelector
                    deckName={deckName}
                    onDeckNameChange={setDeckName}
                    deckText={deckText}
                    onDeckTextChange={setDeckText}
                    onError={setError}
                />
            </div>
        </Modal>
    );
};

export default JoinTableDialog;
