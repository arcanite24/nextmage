import React from 'react';
import { DeckCardInfo, DeckCardLists } from '../../types';
import './DeckArea.css';

interface DeckAreaProps {
    deck: DeckCardLists;
    onRemoveCard: (card: DeckCardInfo, zone: 'main' | 'side') => void;
}

export const DeckArea: React.FC<DeckAreaProps> = ({ deck, onRemoveCard }) => {

    // Helper to group cards by name for display (optional, but standard for list views)
    // For now, just listing them.

    const mainDeckCount = deck.cards.reduce((acc, card) => acc + card.amount, 0);
    const sideboardCount = deck.sideboard.reduce((acc, card) => acc + card.amount, 0);

    return (
        <div className="deck-area">
            <div className="deck-column">
                <div className="deck-header">
                    <h3>Main Deck ({mainDeckCount})</h3>
                </div>
                <div className="card-list main-deck-list">
                    {deck.cards.map((card, index) => (
                        <div
                            key={`${card.setCode}-${card.cardNumber}-${index}`}
                            className="deck-card-item"
                            onClick={() => onRemoveCard(card, 'main')}
                        >
                            <span className="card-amount">{card.amount}</span>
                            <span className="card-name">{card.cardName}</span>
                            <span className="card-set">{card.setCode}</span>
                        </div>
                    ))}
                    {deck.cards.length === 0 && (
                        <div className="empty-message">Drag cards here or click to add</div>
                    )}
                </div>
            </div>

            <div className="deck-column sideboard-column">
                <div className="deck-header">
                    <h3>Sideboard ({sideboardCount})</h3>
                </div>
                <div className="card-list sideboard-list">
                    {deck.sideboard.map((card, index) => (
                        <div
                            key={`sb-${card.setCode}-${card.cardNumber}-${index}`}
                            className="deck-card-item"
                            onClick={() => onRemoveCard(card, 'side')}
                        >
                            <span className="card-amount">{card.amount}</span>
                            <span className="card-name">{card.cardName}</span>
                            <span className="card-set">{card.setCode}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
