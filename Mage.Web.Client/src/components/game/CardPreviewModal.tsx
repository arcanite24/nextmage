import React, { useEffect, useState } from 'react';
import { CardView, PermanentView, StackAbilityView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import './CardPreviewModal.css';

interface CardPreviewModalProps {
    card: CardView | PermanentView;
    onClose: () => void;
}

// Type guard to check if a card is an ability with sourceCard
const isStackAbility = (card: CardView): card is StackAbilityView => {
    return card.isAbility && 'sourceCard' in card && !!(card as StackAbilityView).sourceCard;
};

// Parse and render rich text with HTML tags (from server rules text)
const parseRulesText = (text: string): React.ReactNode => {
    if (!text) return null;

    // Replace common HTML entities and tags
    let processed = text
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&bull;/g, '•')
        .replace(/&middot;/g, '·')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Split by <br> tags for line breaks
    const lines = processed.split(/<br\s*\/?>/gi);

    return lines.map((line, i) => {
        // Process <i>italic</i> tags
        const parts: React.ReactNode[] = [];
        let key = 0;

        // Match <i>...</i> tags
        const italicRegex = /<i>(.*?)<\/i>/gi;
        let lastIndex = 0;
        let match;

        while ((match = italicRegex.exec(line)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(<span key={key++}>{line.slice(lastIndex, match.index)}</span>);
            }
            // Add italic text
            parts.push(<i key={key++}>{match[1]}</i>);
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < line.length) {
            parts.push(<span key={key++}>{line.slice(lastIndex)}</span>);
        }

        if (parts.length === 0) {
            return <p key={i} className="rules-line">{line}</p>;
        }

        return <p key={i} className="rules-line">{parts}</p>;
    });
};

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({ card, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string>(cardImageService.getCardBackUrl());
    const [isLoading, setIsLoading] = useState(true);

    // Check if this is an ability
    const isAbility = isStackAbility(card);

    // Use source card as the main card to display for abilities
    const displayCard = isAbility ? card.sourceCard : card;

    // Load image using cache-aware preload (always resolves, returns placeholder on error)
    useEffect(() => {
        setIsLoading(true);
        cardImageService.preload(displayCard, 'large').then((url) => {
            setImageUrl(url);
            setIsLoading(false);
        });
    }, [displayCard.expansionSetCode, displayCard.cardNumber]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Close on click outside (overlay click)
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const abilitySourceCard = isAbility ? card.sourceCard : null;

    // Extract card info from the display card
    const isPermanent = 'tapped' in displayCard;
    const permanentCard = isPermanent ? (displayCard as PermanentView) : null;

    // Get mana cost string
    const getManaCost = (): string | null => {
        if (displayCard.manaCostRightStr && displayCard.manaCostRightStr.length > 0) {
            return displayCard.manaCostRightStr.join('');
        }
        if (displayCard.manaCostLeftStr && displayCard.manaCostLeftStr.length > 0) {
            return displayCard.manaCostLeftStr.join('');
        }
        return null;
    };

    const manaCost = getManaCost();

    // Get display name
    const getDisplayName = (): string => {
        return displayCard.name;
    };

    // Get type line
    const getTypeLine = (): string => {
        return displayCard.cardTypes?.join(' ').toUpperCase() || 'UNKNOWN TYPE';
    };

    return (
        <div className="card-preview-overlay" onClick={handleOverlayClick} onContextMenu={(e) => e.preventDefault()}>
            <div className="card-preview-container">
                <div className="card-preview-content">
                    <div className={`card-preview-image-wrapper ${isLoading ? 'loading' : ''}`}>
                        {isLoading && <div className="card-preview-spinner" />}
                        <img src={imageUrl} alt={getDisplayName()} className="card-preview-image" />
                    </div>
                    <button className="card-preview-close" onClick={onClose}>x</button>
                </div>

                <div className="card-info-panel">
                    <div className="card-info-header">
                        <h2 className="card-info-name">{getDisplayName()}</h2>
                        {manaCost && (
                            <div className="card-info-mana">{manaCost}</div>
                        )}
                    </div>

                    <div className="card-info-type">
                        {getTypeLine()}
                        {displayCard.subTypes && displayCard.subTypes.length > 0 && (
                            <span className="card-info-subtypes"> — {displayCard.subTypes.join(' ')}</span>
                        )}
                    </div>

                    {/* Indicator that we are viewing the source of a stack ability */}
                    {isAbility && (
                        <div className="card-info-ability-source">
                            <span className="ability-label">⚡ Source of Ability</span>
                        </div>
                    )}

                    {displayCard.rules && displayCard.rules.length > 0 && (
                        <div className="card-info-rules">
                            {displayCard.rules.map((rule, i) => (
                                <div key={i} className="rules-text">
                                    {parseRulesText(rule)}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* P/T for creatures */}
                    {displayCard.cardTypes?.includes('Creature') && (
                        <div className="card-info-pt">
                            <span className="pt-value">
                                {displayCard.power}/{displayCard.toughness}
                            </span>
                            {permanentCard && permanentCard.damage > 0 && (
                                <span className="damage-value">({permanentCard.damage} damage)</span>
                            )}
                        </div>
                    )}

                    {/* Loyalty for planeswalkers */}
                    {displayCard.cardTypes?.includes('Planeswalker') && displayCard.loyalty && (
                        <div className="card-info-loyalty">
                            Loyalty: <span className="loyalty-value">
                                {displayCard.loyalty}
                            </span>
                        </div>
                    )}

                    {/* Counters for permanents */}
                    {permanentCard && permanentCard.counters && permanentCard.counters.length > 0 && (
                        <div className="card-info-counters">
                            <div className="counters-label">Counters:</div>
                            <div className="counters-list">
                                {permanentCard.counters.map((counter, i) => (
                                    <span key={i} className="counter-item">
                                        {counter.count}x {counter.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Set info */}
                    <div className="card-info-set">
                        {displayCard.expansionSetCode && (
                            <span className="set-code">{displayCard.expansionSetCode}</span>
                        )}
                        {displayCard.rarity && (
                            <span className={`set-rarity rarity-${String(displayCard.rarity).toLowerCase()}`}>
                                {displayCard.rarity}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
