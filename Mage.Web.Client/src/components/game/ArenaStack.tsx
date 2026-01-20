import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
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

export const ArenaStack: React.FC<ArenaStackProps> = React.memo(({ stack, onCardClick, onCardInspect }) => {
    const stackItems = useMemo(() => stack ? Object.values(stack) : [], [stack]);

    const { validTargets, isTargetMode } = useGameStore(useShallow(state => ({
        validTargets: state.pendingAction.type === 'target' ? state.pendingAction.validTargets : null,
        isTargetMode: state.pendingAction.type === 'target' || state.pendingAction.type === 'select'
    })));

    if (stackItems.length === 0) {
        return null;
    }

    // Helper to check if card is a valid target
    const isValidTarget = (cardId: string): boolean => {
        if (isTargetMode && validTargets) {
            return validTargets.includes(cardId);
        }
        return isTargetMode;
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
                            <ArenaStackCard
                                key={card.id}
                                card={card}
                                index={index}
                                total={stackItems.length}
                                rotation={rotation}
                                validTarget={validTarget}
                                isAbility={isAbility}
                                name={name}
                                type={type}
                                rules={rules}
                                onCardClick={onCardClick}
                                onCardInspect={onCardInspect}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

// === SUB-COMPONENTS ===

interface ArenaStackCardProps {
    card: CardView;
    index: number;
    total: number;
    rotation: number;
    validTarget: boolean;
    isAbility: boolean;
    name: string;
    type: string;
    rules: string;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
}

const ArenaStackCard: React.FC<ArenaStackCardProps> = React.memo(({
    card, index, total, rotation, validTarget, isAbility, name, type, rules,
    onCardClick, onCardInspect
}) => {
    return (
        <div
            className={`arena-stack-card ${validTarget ? 'valid-target' : ''} ${isAbility ? 'is-ability' : ''}`}
            style={{
                zIndex: total - index,
                transform: `rotate(${rotation}deg)`,
            } as React.CSSProperties}
            title={`${name}\n${type}\n\n${rules}`}
            onClick={() => onCardClick?.(card.id)}
            onContextMenu={(e) => {
                e.preventDefault();
                onCardInspect?.(card.id);
            }}
        >
            <img
                src={isAbility && 'sourceCard' in card ? cardImageService.getImageUrl((card as any).sourceCard) : cardImageService.getImageUrl(card)}
                alt={name}
                onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
            />
            {/* Ability indicator overlay with text preview */}
            {isAbility && (
                <div className="arena-stack-ability-badge">
                    <div className="arena-stack-ability-title">⚡ {type}</div>
                </div>
            )}
            <div className="arena-stack-index">{total - index}</div>
        </div>
    );
});
