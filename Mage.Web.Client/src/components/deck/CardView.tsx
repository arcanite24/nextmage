import React, { useState, useEffect } from 'react';
import { SearchCardView, SearchSimpleCardView, CardView as GameCardView, SimpleCardView as GameSimpleCardView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import './CardView.css';

interface CardViewProps {
    card: SearchCardView | SearchSimpleCardView | GameCardView | GameSimpleCardView;
    onClick?: (card: SearchCardView | SearchSimpleCardView | GameCardView | GameSimpleCardView) => void;
    onContextMenu?: (e: React.MouseEvent, card: SearchCardView | SearchSimpleCardView | GameCardView | GameSimpleCardView) => void;
    size?: 'small' | 'normal' | 'large';
}

export const CardView: React.FC<CardViewProps> = ({ card, onClick, onContextMenu, size = 'normal' }) => {
    const [imageUrl, setImageUrl] = useState<string>(cardImageService.getCardBackUrl());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const url = cardImageService.getImageUrl(card, size);

        // We can just use the URL directly, but preloading verifies availability
        const img = new Image();
        img.src = url;
        img.onload = () => {
            setImageUrl(url);
            setLoading(false);
        };
        img.onerror = () => {
            setImageUrl(cardImageService.getPlaceholderUrl());
            setLoading(false);
        };

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [card.expansionSetCode, card.cardNumber, size]);

    // Handle cards that might not have a name property (SimpleCardView)
    const cardName = 'name' in card ? (card as any).name : 'Card';

    return (
        <div
            className={`card-view size-${size} ${loading ? 'loading' : ''}`}
            onClick={() => onClick && onClick(card)}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, card)}
            title={cardName}
        >
            <img
                src={imageUrl}
                alt={cardName}
                className="card-image"
                loading="lazy"
            />
            {/* Optional overlay for loading/text if image fails? */}
        </div>
    );
};
