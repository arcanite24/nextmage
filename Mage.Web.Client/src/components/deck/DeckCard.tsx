/**
 * Deck Card Component
 * 
 * A thumbnail card displaying a deck with cover art, name, and color indicators.
 * Styled to match Magic Arena's deck card appearance.
 */

import React from 'react';
import { DeckSummary } from '../../services/DeckStorageService';
import { cardImageService } from '../../services/CardImageService';
import { ManaSymbol } from '../common/ManaSymbols';
import './DeckCard.css';

interface DeckCardProps {
    deck: DeckSummary;
    isSelected?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export const DeckCard: React.FC<DeckCardProps> = ({
    deck,
    isSelected = false,
    onClick,
    onDoubleClick,
}) => {
    // Get cover card image URL
    const getCoverImageUrl = (): string => {
        if (deck.coverCard?.setCode && deck.coverCard?.cardNumber) {
            return `https://api.scryfall.com/cards/${deck.coverCard.setCode.toLowerCase()}/${deck.coverCard.cardNumber}?format=image&version=art_crop`;
        }
        return '/back.webp';
    };

    // Get active color symbols
    const getColorSymbols = () => {
        if (!deck.colors) return [];
        const colors: string[] = [];
        if (deck.colors.white) colors.push('W');
        if (deck.colors.blue) colors.push('U');
        if (deck.colors.black) colors.push('B');
        if (deck.colors.red) colors.push('R');
        if (deck.colors.green) colors.push('G');
        return colors;
    };

    const colorSymbols = getColorSymbols();
    const cardCount = deck.cardCount || 0;

    return (
        <div
            className={`deck-card ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
        >
            <div className="deck-card-image-container">
                <img
                    src={getCoverImageUrl()}
                    alt={deck.name}
                    className="deck-card-image"
                    loading="lazy"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = '/back.webp';
                    }}
                />
                <div className="deck-card-overlay" />
            </div>

            <div className="deck-card-info">
                {colorSymbols.length > 0 && (
                    <div className="deck-card-colors">
                        {colorSymbols.map((color) => (
                            <ManaSymbol key={color} symbol={color} size="sm" />
                        ))}
                    </div>
                )}
                <div className="deck-card-name">{deck.name || 'Untitled Deck'}</div>
            </div>

            <div className="deck-card-count">
                {cardCount} cards
            </div>
        </div>
    );
};

interface CreateDeckCardProps {
    onClick: () => void;
}

export const CreateDeckCard: React.FC<CreateDeckCardProps> = ({ onClick }) => {
    return (
        <div className="deck-card create-deck-card" onClick={onClick}>
            <div className="create-deck-icon">+</div>
            <div className="create-deck-text">New Deck</div>
        </div>
    );
};

export default DeckCard;
