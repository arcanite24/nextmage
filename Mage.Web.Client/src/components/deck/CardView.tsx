import React, { useState, useEffect } from 'react';
import { SearchCardView, SearchSimpleCardView, CardView as GameCardView, SimpleCardView as GameSimpleCardView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import { useSettingsStore } from '../../stores/settingsStore';
import './CardView.css';

interface CardViewProps {
    card: SearchCardView | SearchSimpleCardView | GameCardView | GameSimpleCardView;
    onClick?: (card: SearchCardView | SearchSimpleCardView | GameCardView | GameSimpleCardView) => void;
    onContextMenu?: (e: React.MouseEvent, card: SearchCardView | SearchSimpleCardView | GameCardView | GameSimpleCardView) => void;
    size?: 'small' | 'normal' | 'large';
}

export const CardView: React.FC<CardViewProps> = ({ card, onClick, onContextMenu, size = 'normal' }) => {
    const cardImageFallbackMode = useSettingsStore(state => state.settings.cardImageFallbackMode);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        setLoading(true);
        setError(false);
        setImageUrl(null);

        // Use the cache-aware preload method (always resolves, returns placeholder on error)
        cardImageService.preload(card, size).then((url) => {
            const failed = url === cardImageService.getPlaceholderUrl();
            setImageUrl(failed ? cardImageService.getFallbackImageUrl(card, cardImageFallbackMode) : url);
            // Check if we got a placeholder (indicates an error)
            setError(failed);
            setLoading(false);
        });
    }, [card, card.expansionSetCode, card.cardNumber, cardImageFallbackMode, size]);

    // Handle cards that might not have a name property (SimpleCardView)
    const cardName = 'name' in card ? (card as any).name : 'Card';

    return (
        <div
            className={`card-view size-${size} ${loading ? 'loading' : ''} ${error ? 'error' : ''}`}
            onClick={() => onClick && onClick(card)}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, card)}
            title={cardName}
        >
            {/* Placeholder skeleton shown while loading */}
            {loading && (
                <div className="card-placeholder">
                    <div className="card-placeholder-shimmer" />
                </div>
            )}

            {/* Actual image - only rendered when URL is available */}
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt={cardName}
                    className={`card-image ${loading ? 'hidden' : ''}`}
                />
            )}

            {/* Fallback text for when image fails to load (e.g. custom sets) */}
            {error && !loading && (
                <div className="card-error-overlay">
                    <span className="card-error-name">{cardName}</span>
                </div>
            )}
        </div>
    );
};
