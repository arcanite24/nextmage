import React from 'react';
import { CardsView, CardView, StackAbilityView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import { useGameStore } from '../../stores';
import './ArenaLayout.css';

interface ArenaStackProps {
    stack: CardsView;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
}

// Type guard to check if a card is an ability with sourceCard
const isStackAbility = (card: CardView): card is StackAbilityView => {
    return card.isAbility && 'sourceCard' in card && !!(card as StackAbilityView).sourceCard;
};

export const ArenaStack: React.FC<ArenaStackProps> = ({ stack, onCardClick, onCardInspect }) => {
    const stackItems = stack ? Object.values(stack) : [];
    const { pendingAction } = useGameStore();

    if (stackItems.length === 0) {
        return null;
    }

    // Helper to check if card is a valid target
    const isValidTarget = (cardId: string): boolean => {
        if (pendingAction.type === 'target' && pendingAction.validTargets) {
            return pendingAction.validTargets.includes(cardId);
        }
        return pendingAction.type === 'select';
    };

    // Get the image URL for a stack item (uses source card for abilities)
    const getStackItemImage = (card: CardView): string => {
        // For abilities, use the source card's image
        if (isStackAbility(card)) {
            return cardImageService.getImageUrl(card.sourceCard);
        }
        return cardImageService.getImageUrl(card);
    };

    // Get display name and text for a stack item
    const getStackItemInfo = (card: CardView) => {
        let name = card.name;
        let type = '';
        let rules = card.rules ? card.rules.join('\n') : '';

        if (isStackAbility(card)) {
            name = card.sourceCard.name;
            type = card.abilityType || 'Ability';
            // Ensure rules are included
            if (!rules && card.rules && card.rules.length > 0) {
                rules = card.rules.join('\n');
            }
        } else {
            // For spells, maybe show type line?
            type = 'Spell';
        }

        return { name, type, rules };
    };

    return (
        <div className="arena-stack-container">
            <div className="arena-stack-label">Stack ({stackItems.length})</div>
            <div className="arena-stack-wrapper">
                <div className="arena-stack-cards">
                    {stackItems.map((card, index) => {
                        const validTarget = isValidTarget(card.id);
                        const isAbility = isStackAbility(card);
                        const { name, type, rules } = getStackItemInfo(card);

                        // Calculate rotation for fan effect - slight rotation for each card
                        const rotation = (index - (stackItems.length - 1) / 2) * 3;

                        return (
                            <div
                                key={card.id}
                                className={`arena-stack-card ${validTarget ? 'valid-target' : ''} ${isAbility ? 'is-ability' : ''}`}
                                style={{
                                    zIndex: stackItems.length - index,
                                    transform: `rotate(${rotation}deg)`,
                                }}
                                title={`${name}\n${type}\n\n${rules}`}
                                onClick={() => onCardClick?.(card.id)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    onCardInspect?.(card.id);
                                }}
                            >
                                <img
                                    src={getStackItemImage(card)}
                                    alt={name}
                                    onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
                                />
                                {/* Ability indicator overlay with text preview */}
                                {isAbility && (
                                    <div className="arena-stack-ability-badge">
                                        <div className="arena-stack-ability-title">⚡ {type}</div>
                                    </div>
                                )}
                                <div className="arena-stack-index">{stackItems.length - index}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
