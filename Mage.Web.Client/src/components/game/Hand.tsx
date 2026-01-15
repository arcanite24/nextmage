import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

export const Hand: React.FC<HandProps> = ({ hand, onCardClick, onCardInspect }) => {
    const cards = hand ? Object.values(hand) : [];
    const { pendingAction } = useGameStore();
    const [hoveredCard, setHoveredCard] = React.useState<CardView | null>(null);

    // Helper to check if card is a valid target
    const isValidTarget = (cardId: string): boolean => {
        if (pendingAction.type === 'target' && pendingAction.validTargets) {
            return pendingAction.validTargets.includes(cardId);
        }
        return pendingAction.type === 'select';
    };

    const count = cards.length;

    return (
        <div className="hand-container">
            <div
                className="hand-cards"
                onMouseLeave={() => setHoveredCard(null)}
            >
                <AnimatePresence mode="popLayout">
                    {cards.map((card, index) => {
                        const validTarget = isValidTarget(card.id);
                        const isHovered = hoveredCard?.id === card.id;
                        const position = calculateCardPosition(index, count);

                        return (
                            <motion.div
                                key={card.id}
                                className={`hand-card ${validTarget ? 'valid-target' : ''}`}
                                // Layout animation for smooth repositioning when cards enter/exit
                                layout
                                layoutId={card.id}
                                // Initial state (entering)
                                initial={{
                                    opacity: 0,
                                    y: 50,
                                    x: position.x,
                                    rotate: position.rotation,
                                }}
                                // Animated state
                                animate={{
                                    opacity: 1,
                                    x: isHovered ? position.hoverX : position.x,
                                    y: isHovered ? -HAND_LAYOUT.HOVER_LIFT : position.y,
                                    rotate: isHovered ? 0 : position.rotation,
                                    zIndex: isHovered ? 100 : index,
                                }}
                                // Exit state
                                exit={{
                                    opacity: 0,
                                    y: -30,
                                    scale: 0.8,
                                    transition: TWEENS.exit,
                                }}
                                // Transition configuration
                                transition={isHovered ? SPRINGS.snappy : SPRINGS.gentle}
                                // Hover shadow handled by CSS for performance
                                whileHover={{ boxShadow: '0 8px 16px rgba(0, 0, 0, 0.8)' }}
                                // Event handlers
                                onClick={() => onCardClick?.(card.id)}
                                onMouseEnter={() => setHoveredCard(card)}
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
};
