/**
 * Centralized animation configuration for the game UI.
 * 
 * This file contains all animation-related constants, spring configs,
 * and utility functions to avoid magic numbers and ensure consistency.
 */

import type { Transition } from 'framer-motion';

// =============================================================================
// CARD DIMENSIONS
// =============================================================================

export const CARD = {
    /** Base width of a card in pixels */
    WIDTH: 140,
    /** Aspect ratio for Magic cards (2.5:3.5 = 63:88mm) */
    ASPECT_RATIO: 2.5 / 3.5,
    /** Corner radius as percentage of width/height */
    BORDER_RADIUS: '4.5% / 3.5%',
} as const;

// =============================================================================
// HAND LAYOUT CONFIGURATION
// =============================================================================

export const HAND_LAYOUT = {
    /** Base horizontal spacing between cards (matches card width for minimal overlap) */
    BASE_SPACING: 140,
    /** Minimum spacing when hand is full */
    MIN_SPACING: 100,
    /** Spacing reduction per card in hand */
    SPACING_REDUCTION_PER_CARD: 4,

    /** Base rotation angle for fanning (degrees) */
    BASE_FAN_ANGLE: 4,
    /** Minimum fan angle for large hands */
    MIN_FAN_ANGLE: 2,
    /** Fan angle reduction per card */
    FAN_REDUCTION_PER_CARD: 0.2,

    /** Vertical offset for arching effect (multiplier for distance from center) */
    ARCH_MULTIPLIER: 10,

    /** How far cards shift away from neighbors on hover (multiplier) */
    HOVER_SHIFT_MULTIPLIER: 15,

    /** How far card lifts on hover (pixels) */
    HOVER_LIFT: 25,

    /** Bottom offset for hand container */
    BOTTOM_OFFSET: -20,
} as const;

// =============================================================================
// PREVIEW PANEL CONFIGURATION
// =============================================================================

export const PREVIEW = {
    /** Width of the enlarged preview card */
    WIDTH: 280,
    /** Position from left edge */
    LEFT: 20,
    /** Position from bottom */
    BOTTOM: 180,
} as const;

// =============================================================================
// SPRING CONFIGURATIONS (Physics-based animations)
// =============================================================================

/**
 * Spring presets for different animation feels.
 * Higher stiffness = snappier, higher damping = less bounce.
 */
export const SPRINGS = {
    /** Snappy, responsive - for hover/interaction feedback */
    snappy: { type: 'spring', stiffness: 500, damping: 30 } as Transition,

    /** Gentle movement - for card repositioning */
    gentle: { type: 'spring', stiffness: 300, damping: 25 } as Transition,

    /** Bouncy - for entrance animations */
    bouncy: { type: 'spring', stiffness: 400, damping: 15 } as Transition,

    /** Stiff - minimal overshoot, for precise movements */
    stiff: { type: 'spring', stiffness: 600, damping: 40 } as Transition,
} as const;

// =============================================================================
// TWEEN CONFIGURATIONS (Time-based animations)
// =============================================================================

export const TWEENS = {
    /** Fast micro-interactions */
    fast: { type: 'tween', duration: 0.15, ease: 'easeOut' } as Transition,

    /** Standard transitions */
    normal: { type: 'tween', duration: 0.25, ease: 'easeInOut' } as Transition,

    /** Slow, dramatic animations */
    slow: { type: 'tween', duration: 0.4, ease: 'easeInOut' } as Transition,

    /** Entrance animations */
    enter: { type: 'tween', duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } as Transition,

    /** Exit animations */
    exit: { type: 'tween', duration: 0.2, ease: 'easeIn' } as Transition,
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate dynamic spacing based on number of cards in hand.
 */
export function calculateHandSpacing(cardCount: number): number {
    return Math.max(
        HAND_LAYOUT.MIN_SPACING,
        HAND_LAYOUT.BASE_SPACING - cardCount * HAND_LAYOUT.SPACING_REDUCTION_PER_CARD
    );
}

/**
 * Calculate fan angle based on number of cards in hand.
 */
export function calculateFanAngle(cardCount: number): number {
    return Math.max(
        HAND_LAYOUT.MIN_FAN_ANGLE,
        HAND_LAYOUT.BASE_FAN_ANGLE - cardCount * HAND_LAYOUT.FAN_REDUCTION_PER_CARD
    );
}

/**
 * Calculate card position in a fanned hand layout.
 */
export function calculateCardPosition(
    index: number,
    cardCount: number
): { x: number; y: number; rotation: number; hoverX: number } {
    const centerIndex = (cardCount - 1) / 2;
    const distFromCenter = index - centerIndex;

    const spacing = calculateHandSpacing(cardCount);
    const fanAngle = calculateFanAngle(cardCount);

    const x = distFromCenter * spacing;
    const y = Math.abs(distFromCenter) * HAND_LAYOUT.ARCH_MULTIPLIER;
    const rotation = distFromCenter * fanAngle;
    const hoverX = x + distFromCenter * HAND_LAYOUT.HOVER_SHIFT_MULTIPLIER;

    return { x, y, rotation, hoverX };
}

// =============================================================================
// ANIMATION VARIANTS (Framer Motion presets)
// =============================================================================

/**
 * Stagger children animations.
 */
export function getStaggerChildren(staggerMs: number = 50) {
    return {
        animate: {
            transition: {
                staggerChildren: staggerMs / 1000,
            },
        },
    };
}

/**
 * Fade + scale entrance animation.
 */
export const fadeScaleVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
};

/**
 * Slide up entrance animation.
 */
export const slideUpVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
};
