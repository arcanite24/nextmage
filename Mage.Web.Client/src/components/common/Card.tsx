/**
 * Card Component
 * 
 * Renders an MTG card with image loading, hover effects, and state indicators.
 */

import React, { useState, memo } from 'react';
import { CardView, SimpleCardView, PermanentView } from '../../types';
import { cardImageService } from '../../services';
import './Card.css';

interface CardProps {
    card: CardView | SimpleCardView | PermanentView;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
    onHover?: () => void;
    onHoverEnd?: () => void;
    isSelected?: boolean;
    isPlayable?: boolean;
    isTargeting?: boolean;
    showOverlay?: boolean;
    overlayContent?: React.ReactNode;
}

const CardComponent: React.FC<CardProps> = ({
    card,
    size = 'md',
    onClick,
    onHover,
    onHoverEnd,
    isSelected = false,
    isPlayable = false,
    isTargeting = false,
    showOverlay = false,
    overlayContent,
}) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Check if it's a permanent and tapped
    const isTapped = 'tapped' in card && card.tapped;

    // Check if it's choosable/selected from server state
    const serverSelected = card.isSelected;
    const serverChoosable = card.isChoosable;

    const classes = [
        'mtg-card',
        `card-${size}`,
        isTapped && 'tapped',
        (isSelected || serverSelected) && 'selected',
        (isPlayable || serverChoosable) && 'playable',
        isTargeting && 'targeting',
        !imageLoaded && !imageError && 'loading',
        imageError && 'error',
    ]
        .filter(Boolean)
        .join(' ');

    const imageUrl = cardImageService.getImageUrl(card, size === 'lg' ? 'large' : 'normal');
    const fallbackUrl = cardImageService.getCardBackUrl();

    // Get display name if available
    const displayName = 'displayName' in card ? card.displayName : 'Card';

    return (
        <div
            className={classes}
            onClick={onClick}
            onMouseEnter={onHover}
            onMouseLeave={onHoverEnd}
            title={displayName}
        >
            <img
                src={imageError ? fallbackUrl : imageUrl}
                alt={displayName}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                draggable={false}
            />

            {!imageLoaded && !imageError && (
                <div className="card-loading">
                    <div className="spinner" />
                </div>
            )}

            {/* Counters overlay */}
            {'counters' in card && card.counters && card.counters.length > 0 && (
                <div className="card-counters">
                    {card.counters.map((counter, i) => (
                        <span key={i} className="counter-badge" title={counter.name}>
                            {counter.count > 0 ? `+${counter.count}` : counter.count}
                        </span>
                    ))}
                </div>
            )}

            {/* Damage overlay for permanents */}
            {'damage' in card && (card as PermanentView).damage > 0 && (
                <div className="card-damage">
                    {(card as PermanentView).damage}
                </div>
            )}

            {/* P/T overlay if modified */}
            {'power' in card && 'toughness' in card && (
                <div className="card-pt">
                    {card.power}/{card.toughness}
                </div>
            )}

            {/* Custom overlay */}
            {showOverlay && overlayContent && (
                <div className="card-overlay">
                    {overlayContent}
                </div>
            )}

            {/* Summoning sickness indicator */}
            {'summoningSickness' in card && (card as PermanentView).summoningSickness && (
                <div className="summoning-sickness-indicator" />
            )}
        </div>
    );
};

// Memoize to prevent unnecessary re-renders
export const Card = memo(CardComponent, (prev, next) => {
    return (
        prev.card.id === next.card.id &&
        prev.isSelected === next.isSelected &&
        prev.isPlayable === next.isPlayable &&
        prev.isTargeting === next.isTargeting &&
        ('tapped' in prev.card && 'tapped' in next.card
            ? (prev.card as PermanentView).tapped === (next.card as PermanentView).tapped
            : true)
    );
});

export default Card;
