import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { CardView, CardsView } from '../../types';
import { cardImageService, type CardImageFallbackMode } from '../../services/CardImageService';
import { createValidTargetLookup } from '../../services/BattlefieldPerformanceService';
import { useGameStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import { ManaCost } from '../common/ManaSymbols';
import {
    CARD,
    HAND_LAYOUT,
    PREVIEW,
    SPRINGS,
    TWEENS,
    calculateCardPosition,
} from '../../config/animations';
import './Hand.css';

interface HandProps {
    hand: CardsView;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
}

export const Hand: React.FC<HandProps> = React.memo(({ hand, onCardClick, onCardInspect }) => {
    const cards = useMemo(() => hand ? Object.values(hand) : [], [hand]);

    const { pendingAction, isTargetMode, playableObjects } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        isTargetMode: state.pendingAction.type === 'target' || state.pendingAction.type === 'select',
        playableObjects: state.gameView?.canPlayObjects?.objects ?? null,
    })));
    const cardImageFallbackMode = useSettingsStore(state => state.settings.cardImageFallbackMode);

    const playableSet = useMemo(() => {
        return new Set(playableObjects ? Object.keys(playableObjects) : []);
    }, [playableObjects]);

    const isValidTargetByCardId = useMemo(() => createValidTargetLookup(pendingAction), [pendingAction]);

    const [hoveredCardId, setHoveredCardId] = React.useState<string | null>(null);

    const hoveredCard = useMemo(() => {
        return hoveredCardId ? hand?.[hoveredCardId] ?? null : null;
    }, [hoveredCardId, hand]);

    const count = cards.length;

    const handleHover = useCallback((id: string | null) => {
        setHoveredCardId(id);
    }, []);

    return (
        <div className="hand-container">
            <div
                className="hand-cards"
                onMouseLeave={() => handleHover(null)}
            >
                <AnimatePresence mode="popLayout">
                    {cards.map((card, index) => {
                        const isValid = isTargetMode && isValidTargetByCardId(card.id);
                        const isPlayable = !isTargetMode && (
                            playableSet.has(card.id) ||
                            (card.playableStats?.playableAmount ?? 0) > 0 ||
                            card.isChoosable
                        );
                        const isHovered = hoveredCardId === card.id;

                        return (
                            <HandCard
                                key={card.id}
                                card={card}
                                index={index}
                                count={count}
                                isValidTarget={isValid}
                                isPlayable={isPlayable}
                                isHovered={isHovered}
                                cardImageFallbackMode={cardImageFallbackMode}
                                onCardClick={onCardClick}
                                onCardInspect={onCardInspect}
                                onHover={handleHover}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Arena-style: Large preview on the side */}
            <AnimatePresence>
                {hoveredCard && (
                    <motion.div
                        className="hand-card-preview"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.98 }}
                        transition={TWEENS.fast}
                        style={{
                            width: PREVIEW.WIDTH,
                            left: PREVIEW.LEFT,
                            bottom: PREVIEW.BOTTOM,
                        }}
                    >
                        <img
                            src={cardImageService.getImageUrl(hoveredCard)}
                            alt={hoveredCard.name}
                            draggable={false}
                            onError={(e) => e.currentTarget.src = cardImageService.getFallbackImageUrl(hoveredCard, cardImageFallbackMode)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

// === SUB COMPONENTS ===

interface HandCardProps {
    card: CardView;
    index: number;
    count: number;
    isValidTarget: boolean;
    isPlayable: boolean;
    isHovered: boolean;
    cardImageFallbackMode: CardImageFallbackMode;
    onCardClick?: (id: string) => void;
    onCardInspect?: (id: string) => void;
    onHover: (id: string | null) => void;
}

const areHandCardPropsEqual = (prev: HandCardProps, next: HandCardProps) => {
    if (prev.index !== next.index) return false;
    if (prev.count !== next.count) return false;
    if (prev.isValidTarget !== next.isValidTarget) return false;
    if (prev.isPlayable !== next.isPlayable) return false;
    if (prev.isHovered !== next.isHovered) return false;
    if (prev.cardImageFallbackMode !== next.cardImageFallbackMode) return false;
    if (prev.onCardClick !== next.onCardClick) return false;
    if (prev.onCardInspect !== next.onCardInspect) return false;
    if (prev.onHover !== next.onHover) return false;

    // Stable card check
    if (prev.card.id !== next.card.id) return false;
    if (prev.card.name !== next.card.name) return false;
    // Hand cards don't have tap state usually, but check just in case
    // if (prev.card.playable !== next.card.playable) return false; // If 'playable' was a property

    return true;
};

const HandCard: React.FC<HandCardProps> = React.memo(({
    card, index, count, isValidTarget, isPlayable, isHovered,
    cardImageFallbackMode, onCardClick, onCardInspect, onHover
}) => {
    const position = useMemo(() => calculateCardPosition(index, count), [index, count]);

    return (
        <motion.div
            id={`card-${card.id}`}
            layout
            layoutId={card.id}
            className={`hand-card ${isValidTarget ? 'valid-target' : ''} ${isPlayable ? 'playable-card' : ''} ${card.isToken ? 'token-card' : ''}`}
            data-testid="hand-card"
            data-card-id={card.id}
            initial={{
                opacity: 0,
                y: 50,
                x: position.x,
                rotate: position.rotation,
            }}
            animate={{
                opacity: 1,
                x: isHovered ? position.hoverX : position.x,
                y: isHovered ? -HAND_LAYOUT.HOVER_LIFT : position.y,
                rotate: isHovered ? 0 : position.rotation,
                zIndex: isHovered ? 100 : index,
            }}
            exit={{
                opacity: 0,
                y: -30,
                scale: 0.8,
                transition: TWEENS.exit,
            }}
            transition={isHovered ? SPRINGS.snappy : SPRINGS.gentle}
            whileHover={{ boxShadow: '0 8px 16px rgba(0, 0, 0, 0.8)' }}
            onClick={() => onCardClick?.(card.id)}
            onMouseEnter={() => onHover(card.id)}
            onContextMenu={(e) => {
                e.preventDefault();
                onCardInspect?.(card.id);
            }}
            style={{
                width: `var(--mage-hand-card-size, ${CARD.WIDTH}px)`,
                aspectRatio: `${CARD.ASPECT_RATIO}`,
                bottom: HAND_LAYOUT.BOTTOM_OFFSET,
            }}
        >
            <img
                src={cardImageService.getImageUrl(card)}
                alt={card.name}
                loading="lazy"
                draggable={false}
                onError={(e) => e.currentTarget.src = cardImageService.getFallbackImageUrl(card, cardImageFallbackMode)}
            />
            <div className="hand-card-mana">
                <ManaCost cost={card.manaCostRightStr?.length ? card.manaCostRightStr : card.manaCostLeftStr} size="sm" />
            </div>
            {card.isToken && <div className="hand-card-token-badge">Token</div>}
        </motion.div>
    );
}, areHandCardPropsEqual);
