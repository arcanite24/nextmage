import React from 'react';
import { CardsView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import { useSettingsStore } from '../../stores/settingsStore';
import './GamePage.css';

interface StackProps {
    stack: CardsView;
}

export const Stack: React.FC<StackProps> = ({ stack }) => {
    const stackItems = stack ? Object.values(stack) : [];
    const cardImageFallbackMode = useSettingsStore(state => state.settings.cardImageFallbackMode);

    if (stackItems.length === 0) {
        return null; // Don't show anything when stack is empty
    }

    return (
        <div className="stack-list">
            <h4>Stack ({stackItems.length})</h4>
            <div className="stack-cards">
                {stackItems.map((card, index) => (
                    <div key={card.id} className="stack-card-item" title={card.name}>
                        <img
                            src={cardImageService.getImageUrl(card)}
                            alt={card.name}
                            className="stack-card-image"
                            onError={(e) => e.currentTarget.src = cardImageService.getFallbackImageUrl(card, cardImageFallbackMode)}
                        />
                        <div className="stack-card-index">{stackItems.length - index}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
