/**
 * Deck Card Component
 * 
 * A thumbnail card displaying a deck with cover art, name, and color indicators.
 * Styled to match Magic Arena's deck card appearance.
 */

import React from 'react';
import { DeckSummary } from '../../core/decks/DeckStorageService';
import { ManaSymbol } from '../common/ManaSymbols';
import './DeckCard.css';

interface DeckCardProps {
    deck: DeckSummary;
    isSelected?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
    onDelete?: () => void;
}

export const DeckCard: React.FC<DeckCardProps> = ({
    deck,
    isSelected = false,
    onClick,
    onDoubleClick,
    onDelete,
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
    const deckName = deck.name || 'Untitled Deck';

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.currentTarget !== event.target) return;

        if (event.key === 'Escape' && isSelected) {
            event.preventDefault();
            onClick?.();
            return;
        }

        if ((event.key === 'Delete' || event.key === 'Backspace') && isSelected && onDelete) {
            event.preventDefault();
            onDelete();
            return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        if (event.key === 'Enter' && isSelected && onDoubleClick) {
            onDoubleClick();
            return;
        }
        onClick?.();
    };

    return (
        <div
            className={`deck-card ${isSelected ? 'selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${deckName}. ${cardCount} cards. ${isSelected ? `Press Enter to edit${onDelete ? ' or Delete/Backspace to remove' : ''}.` : 'Press Enter or Space to select.'}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onKeyDown={handleKeyDown}
            data-testid="deck-manager-deck-card"
            data-deck-name={deckName}
        >
            <div className="deck-card-image-container">
                <img
                    src={getCoverImageUrl()}
                    alt={deckName}
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
                <div className="deck-card-name">{deckName}</div>
                {deck.description && (
                    <div className="deck-card-description">{deck.description}</div>
                )}
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
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.currentTarget !== event.target) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        onClick();
    };

    return (
        <div
            className="deck-card create-deck-card"
            role="button"
            tabIndex={0}
            aria-label="Create new deck"
            onClick={onClick}
            onKeyDown={handleKeyDown}
            data-testid="deck-manager-new-deck-card"
        >
            <div className="create-deck-icon">+</div>
            <div className="create-deck-text">New Deck</div>
        </div>
    );
};

export default DeckCard;
