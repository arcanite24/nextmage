import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CardsView, CardView, StackAbilityView } from '../../types';
import { cardImageService, type CardImageFallbackMode } from '../../services/CardImageService';
import { createValidTargetLookup } from '../../services/BattlefieldPerformanceService';
import { useGameStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import './ArenaLayout.css';

interface ArenaStackProps {
    stack: CardsView;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
    onCardHover?: (cardId: string | null) => void;
}

// Type guard to check if a card is an ability with sourceCard
const isStackAbility = (card: CardView): card is StackAbilityView => {
    return card.isAbility && 'sourceCard' in card && !!(card as StackAbilityView).sourceCard;
};

export const ArenaStack: React.FC<ArenaStackProps> = React.memo(({ stack, onCardClick, onCardInspect, onCardHover }) => {
    const stackItems = useMemo(() => stack ? Object.values(stack) : [], [stack]);

    const { pendingAction, isTargetMode } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        isTargetMode: state.pendingAction.type === 'target' || state.pendingAction.type === 'select'
    })));
    const cardImageFallbackMode = useSettingsStore(state => state.settings.cardImageFallbackMode);
    const isValidTargetByCardId = useMemo(() => createValidTargetLookup(pendingAction), [pendingAction]);

    if (stackItems.length === 0) {
        return null;
    }

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
                        const validTarget = isTargetMode && isValidTargetByCardId(card.id);
                        const isAbility = isStackAbility(card);
                        const imageCard = isAbility ? card.sourceCard : card;
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
                                imageCard={imageCard}
                                cardImageFallbackMode={cardImageFallbackMode}
                                onCardClick={onCardClick}
                                onCardInspect={onCardInspect}
                                onCardHover={onCardHover}
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
    imageCard: CardView;
    cardImageFallbackMode: CardImageFallbackMode;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
    onCardHover?: (cardId: string | null) => void;
}

const ArenaStackCard: React.FC<ArenaStackCardProps> = React.memo(({
    card, index, total, rotation, validTarget, isAbility, name, type, rules,
    imageCard, cardImageFallbackMode, onCardClick, onCardInspect, onCardHover
}) => {
    return (
        <div
            id={`card-${card.id}`}
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
            onMouseEnter={() => onCardHover?.(card.id)}
            onMouseLeave={() => onCardHover?.(null)}
        >
            <img
                src={cardImageService.getImageUrl(imageCard)}
                alt={name}
                onError={(e) => e.currentTarget.src = cardImageService.getFallbackImageUrl(imageCard, cardImageFallbackMode)}
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
