/**
 * Attack Animation Component
 * 
 * Renders Hearthstone-style attack animations where the actual card
 * moves toward its target and impacts with visual effects.
 * Uses Framer Motion for smooth, physics-based animations.
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAnimationStore } from '../../stores';
import './AttackAnimation.css';

interface PlainRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface Point {
    x: number;
    y: number;
}

interface CardSnapshot {
    id: string;
    imageUrl: string;
    rect: PlainRect;
}

/** Random visual jitter, rolled once per attack so renders stay pure. */
interface AttackJitter {
    rotation: number;
    sparkDistances: number[];
}

const SPARK_COUNT = 8;

const rollAttackJitter = (): AttackJitter => ({
    rotation: Math.random() * 10 - 5,
    sparkDistances: Array.from({ length: SPARK_COUNT }, () => 50 + Math.random() * 30),
});

const getElementRect = (id: string): DOMRect | null => {
    const el = document.getElementById(id);
    if (!el) return null;
    return el.getBoundingClientRect();
};

const getElementCenter = (rect: PlainRect | DOMRect): Point => ({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
});

export const AttackAnimation: React.FC = React.memo(() => {
    const { currentAttack, isAnimating, completeCurrentAnimation, applyCombatDamage } = useAnimationStore(
        useShallow((state) => ({
            currentAttack: state.currentAttack,
            isAnimating: state.isAnimating,
            completeCurrentAnimation: state.completeCurrentAnimation,
            applyCombatDamage: state.applyCombatDamage,
        }))
    );

    const [attackerSnapshot, setAttackerSnapshot] = useState<CardSnapshot | null>(null);
    const [targetCenter, setTargetCenter] = useState<Point | null>(null);
    const [showImpact, setShowImpact] = useState(false);
    const [animationPhase, setAnimationPhase] = useState<'idle' | 'attacking' | 'returning'>('idle');
    const [attackJitter, setAttackJitter] = useState<AttackJitter>(rollAttackJitter);

    const originalCardRef = useRef<HTMLElement | null>(null);

    // 1. Prepare Snapshot Effect
    // When a new attack starts, locate elements and set up the snapshot.
    // This triggers a render which mounts the motion components.
    useEffect(() => {
        if (!currentAttack || currentAttack.status !== 'playing') {
            setAnimationPhase('idle');
            setShowImpact(false);
            setAttackerSnapshot(null);
            return;
        }

        // Find attacker card element
        const attackerEl = document.getElementById(`card-${currentAttack.attackerId}`);
        const attackerRect = attackerEl?.getBoundingClientRect();

        // Find target element (card or player)
        const targetRect =
            getElementRect(`card-${currentAttack.targetId}`) ||
            getElementRect(`player-${currentAttack.targetId}`);

        if (!attackerEl || !attackerRect || !targetRect) {
            console.warn('Attack animation elements not found, completing animation');
            completeCurrentAnimation();
            return;
        }

        originalCardRef.current = attackerEl;

        // Get the card image URL from the img inside the card element
        const imgEl = attackerEl.querySelector('img');
        const imageUrl = imgEl?.src || '/back.webp';

        // Check for tapped state (landscape aspect ratio) and normalize to portrait
        // This ensures the animation always plays with an upright card
        let width = attackerRect.width;
        let height = attackerRect.height;
        let left = attackerRect.left;
        let top = attackerRect.top;

        if (width > height) {
            // Card is likely tapped (landscape). Swap dimensions to force portrait upright.
            const centerX = left + width / 2;
            const centerY = top + height / 2;

            // Swap
            const temp = width;
            width = height;
            height = temp;

            // Recalculate top/left to keep center consistent
            left = centerX - width / 2;
            top = centerY - height / 2;
        }

        const normalizedRect: PlainRect = { left, top, width, height };

        setTargetCenter(getElementCenter(targetRect));
        setAttackJitter(rollAttackJitter());
        setAttackerSnapshot({
            id: currentAttack.attackerId,
            imageUrl,
            rect: normalizedRect,
        });
        setAnimationPhase('attacking');

    }, [currentAttack, completeCurrentAnimation]);


    // 2. Execution Effect (Refactored to state-driven variants)
    // We no longer imperatively drive controls. We just ensure we are mounted.

    // Calculate delta for variants
    const dx = (targetCenter && attackerSnapshot) ? targetCenter.x - getElementCenter(attackerSnapshot.rect).x : 0;
    const dy = (targetCenter && attackerSnapshot) ? targetCenter.y - getElementCenter(attackerSnapshot.rect).y : 0;

    const variants: Variants = {
        idle: { x: 0, y: 0, scale: 1, rotate: 0 },
        attacking: {
            x: dx * 0.85,
            y: dy * 0.85,
            scale: 1.25, // Slightly larger for impact
            rotate: attackJitter.rotation,
            transition: { duration: 0.4, ease: "backIn" as any } // Hammer hit feel
        },
        impact: {
            x: dx * 0.9,
            y: dy * 0.9,
            scale: 1.15,
            transition: { duration: 0.1, ease: "linear" as any }
        },
        returning: {
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
            transition: { duration: 0.3, ease: "circIn" as any }
        }
    };

    const handleAnimationComplete = (definition: any) => {
        // definition is the variant name (string)
        if (definition === 'attacking') {
            console.log('[AttackAnimation] Phase 1 Complete (Attacking). Showing Impact.');
            setShowImpact(true);
            setAnimationPhase('impact' as any);
        } else if (definition === 'impact') {
            console.log('[AttackAnimation] Phase 2 Complete (Impact). Returning.');
            if (currentAttack) {
                applyCombatDamage(currentAttack.targetId);
            }
            setShowImpact(false);
            setAnimationPhase('returning');
        } else if (definition === 'returning') {
            console.log('[AttackAnimation] Phase 3 Complete (Returning). Done.');
            setAnimationPhase('idle');
            setAttackerSnapshot(null); // Unmount

            // Restore opacity immediately
            if (originalCardRef.current) originalCardRef.current.style.opacity = '1';

            completeCurrentAnimation();
        }
    };

    // Ensure opacity is hidden while animating
    useEffect(() => {
        if (animationPhase !== 'idle' && originalCardRef.current) {
            originalCardRef.current.style.opacity = '0';
        }
        return () => {
            // Safety restore
            if (originalCardRef.current && animationPhase === 'idle') {
                originalCardRef.current.style.opacity = '1';
            }
        };
    }, [animationPhase]);

    // Don't render if no animation
    if (!isAnimating || !attackerSnapshot || animationPhase === 'idle') {
        return null;
    }

    return (
        <div className="attack-animation-overlay">
            {/* Animated card clone */}
            <motion.div
                className="attacking-card"
                initial="idle"
                animate={animationPhase === 'attacking' || animationPhase === 'returning' || animationPhase === 'impact' as any ? animationPhase : 'idle'}
                variants={variants}
                onAnimationComplete={handleAnimationComplete}
                style={{
                    position: 'fixed',
                    left: attackerSnapshot.rect.left,
                    top: attackerSnapshot.rect.top,
                    width: attackerSnapshot.rect.width,
                    height: attackerSnapshot.rect.height,
                    zIndex: 1000,
                }}
            >
                <img
                    src={attackerSnapshot.imageUrl}
                    alt="Attacking card"
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '8px',
                        boxShadow: animationPhase === 'attacking'
                            ? '0 0 30px 10px rgba(239, 68, 68, 0.6), 0 0 60px 20px rgba(251, 191, 36, 0.4)'
                            : '0 4px 20px rgba(0, 0, 0, 0.5)',
                    }}
                />

                {/* Attack glow overlay */}
                {animationPhase === 'attacking' && (
                    <motion.div
                        className="attack-glow-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.8, 0.6] }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: 'absolute',
                            inset: -4,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(239, 68, 68, 0.4))',
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </motion.div>

            {/* Impact effect at target */}
            <AnimatePresence>
                {showImpact && targetCenter && (
                    <motion.div
                        className="impact-container"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            left: targetCenter.x,
                            top: targetCenter.y,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            zIndex: 999,
                        }}
                    >
                        {/* Expanding rings */}
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ scale: 0, opacity: 1 }}
                                animate={{
                                    scale: [0, 2, 3],
                                    opacity: [1, 0.6, 0],
                                }}
                                transition={{
                                    duration: 0.5,
                                    delay: i * 0.08,
                                    ease: 'easeOut',
                                }}
                                style={{
                                    position: 'absolute',
                                    width: 60,
                                    height: 60,
                                    borderRadius: '50%',
                                    border: '3px solid',
                                    borderColor: i === 0 ? '#fbbf24' : i === 1 ? '#ef4444' : '#f97316',
                                    left: -30,
                                    top: -30,
                                }}
                            />
                        ))}

                        {/* Central flash */}
                        <motion.div
                            initial={{ scale: 0, opacity: 1 }}
                            animate={{
                                scale: [0, 1.5, 0],
                                opacity: [1, 0.9, 0],
                            }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            style={{
                                position: 'absolute',
                                width: 80,
                                height: 80,
                                left: -40,
                                top: -40,
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(251,191,36,0.6) 40%, transparent 70%)',
                            }}
                        />

                        {/* Spark particles */}
                        {attackJitter.sparkDistances.map((distance, i) => {
                            const angle = (i / SPARK_COUNT) * Math.PI * 2;
                            return (
                                <motion.div
                                    key={`spark-${i}`}
                                    initial={{
                                        x: 0,
                                        y: 0,
                                        scale: 1,
                                        opacity: 1,
                                    }}
                                    animate={{
                                        x: Math.cos(angle) * distance,
                                        y: Math.sin(angle) * distance,
                                        scale: 0,
                                        opacity: 0,
                                    }}
                                    transition={{
                                        duration: 0.4,
                                        ease: 'easeOut',
                                    }}
                                    style={{
                                        position: 'absolute',
                                        width: 8,
                                        height: 8,
                                        left: -4,
                                        top: -4,
                                        borderRadius: '50%',
                                        background: i % 2 === 0 ? '#fbbf24' : '#ef4444',
                                        boxShadow: '0 0 10px 2px currentColor',
                                    }}
                                />
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Screen shake effect during impact */}
            {showImpact && (
                <motion.div
                    initial={{ x: 0, y: 0 }}
                    animate={{
                        x: [0, -5, 5, -3, 3, 0],
                        y: [0, 3, -3, 2, -2, 0],
                    }}
                    transition={{ duration: 0.3 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: -1,
                    }}
                />
            )}
        </div>
    );
});
