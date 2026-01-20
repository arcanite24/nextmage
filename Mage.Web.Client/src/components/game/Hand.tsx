import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { CardView, CardsView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import { useGameStore } from '../../stores';
import {
    CARD,
    HAND_LAYOUT,
    PREVIEW,
    SPRINGS,
    TWEENS,
    calculateCardPosition,
    slideUpVariants,
} from '../../config/animations';
import './Hand.css';

interface HandProps {
    hand: CardsView;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
}

export const Hand: React.FC<HandProps> = React.memo(({ hand, onCardClick, onCardInspect }) => {
    const cards = useMemo(() => hand ? Object.values(hand) : [], [hand]);
    // Stable check for pending target
    const { validTargets, isTargetMode } = useGameStore(useShallow(state => ({
        validTargets: state.pendingAction.type === 'target' ? state.pendingAction.validTargets : null,
        isTargetMode: state.pendingAction.type === 'target' || state.pendingAction.type === 'select'
    })));

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
                        const isValid = isTargetMode && (validTargets ? validTargets.includes(card.id) : true);
                        const isHovered = hoveredCardId === card.id;

                        return (
                            <HandCard
                                key={card.id}
                                card={card}
                                index={index}
                                count={count}
                                isValidTarget={isValid}
                                isHovered={isHovered}
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
                            onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
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
    isHovered: boolean;
    onCardClick?: (id: string) => void;
    onCardInspect?: (id: string) => void;
    onHover: (id: string | null) => void;
}

const areHandCardPropsEqual = (prev: HandCardProps, next: HandCardProps) => {
    if (prev.index !== next.index) return false;
    if (prev.count !== next.count) return false;
    if (prev.isValidTarget !== next.isValidTarget) return false;
    if (prev.isHovered !== next.isHovered) return false;

    // Stable card check
    if (prev.card.id !== next.card.id) return false;
    if (prev.card.name !== next.card.name) return false;
    // Hand cards don't have tap state usually, but check just in case
    // if (prev.card.playable !== next.card.playable) return false; // If 'playable' was a property

    return true;
};

const HandCard: React.FC<HandCardProps> = React.memo(({
    card, index, count, isValidTarget, isHovered,
    onCardClick, onCardInspect, onHover
}) => {
    const position = useMemo(() => calculateCardPosition(index, count), [index, count]);

    return (
        <motion.div
            layout
            layoutId={card.id}
            className={`hand-card ${isValidTarget ? 'valid-target' : ''}`}
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
                width: CARD.WIDTH,
                aspectRatio: `${CARD.ASPECT_RATIO}`,
                bottom: HAND_LAYOUT.BOTTOM_OFFSET,
            }}
        >
            <img
                src={cardImageService.getImageUrl(card)}
                alt={card.name}
                loading="lazy"
                draggable={false}
                onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
            />
        </motion.div>
    );
}, areHandCardPropsEqual);
