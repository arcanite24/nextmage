import React from 'react';
import { CardsView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import './GamePage.css';

interface HandProps {
    hand: CardsView;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
}

export const Hand: React.FC<HandProps> = ({ hand, onCardClick, onCardInspect }) => {
    const cards = hand ? Object.values(hand) : [];

    return (
        <div className="hand-container">
            <div className="hand-cards">
                {cards.map(card => (
                    <div
                        key={card.id}
                        className="hand-card"
                        onClick={() => onCardClick && onCardClick(card.id)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            if (onCardInspect) onCardInspect(card.id);
                        }}
                    >
                        <img
                            src={cardImageService.getImageUrl(card)}
                            alt={card.name}
                            style={{ width: '100%', borderRadius: '4px' }}
                            onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
