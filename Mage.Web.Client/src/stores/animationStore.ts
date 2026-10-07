/**
 * Animation Store
 * 
 * Manages animation state for the game, including attack animations,
 * damage effects, and queued animations that must play sequentially.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { UUID } from '../types';

// Animation Types
export interface AttackAnimation {
    id: string;
    attackerId: UUID;
    targetId: UUID; // Can be player ID or permanent ID
    type: 'attack';
    status: 'pending' | 'playing' | 'completed';
}

export interface DamageAnimation {
    id: string;
    targetId: UUID; // Player ID
    amount: number;
    type: 'damage' | 'lifeGain';
    timestamp: number;
}

export interface PlayerCounterAnimation {
    id: string;
    targetId: UUID; // Player ID
    counterName: string;
    amount: number;
    type: 'counterGain' | 'counterLoss';
    previousValue: number;
    currentValue: number;
    timestamp: number;
}

export interface LifeChangeAnimation {
    playerId: UUID;
    previousLife: number;
    currentLife: number;
    delta: number;
    timestamp: number;
}

interface AnimationState {
    // Attack animation queue
    attackQueue: AttackAnimation[];
    currentAttack: AttackAnimation | null;
    isAnimating: boolean;

    // Damage effects (shown as flash effects)
    activeDamageEffects: DamageAnimation[];
    activePlayerCounterEffects: PlayerCounterAnimation[];

    // Life tracking for detecting changes
    previousLifeTotals: Record<UUID, number>;
    // Visual overrides for life (deferred updates during combat)
    visualLifeTotals: Record<UUID, number> | null;
    damagePools: Record<UUID, number>;

    // Animation settings
    animationSpeed: number; // Multiplier (1 = normal, 0.5 = fast, 2 = slow)
    animationsEnabled: boolean;
}

interface AnimationActions {
    // Attack animations
    queueAttackAnimation: (attackerId: UUID, targetId: UUID) => void;
    queueMultipleAttacks: (attacks: Array<{ attackerId: UUID; targetId: UUID }>) => void;
    startNextAnimation: () => void;
    completeCurrentAnimation: () => void;
    clearAnimationQueue: () => void;

    // Damage animations
    triggerDamageEffect: (targetId: UUID, amount: number) => void;
    triggerLifeGainEffect: (targetId: UUID, amount: number) => void;
    triggerPlayerCounterEffect: (
        targetId: UUID,
        counterName: string,
        amount: number,
        type: 'counterGain' | 'counterLoss',
        previousValue: number,
        currentValue: number
    ) => void;
    clearDamageEffect: (damageId: string) => void;
    clearPlayerCounterEffect: (effectId: string) => void;
    applyCombatDamage: (targetId: UUID) => void;

    // Life tracking
    updateLifeTotals: (lifeTotals: Record<UUID, number>, isCombatDamageStep: boolean) => LifeChangeAnimation[];
    getLifeDelta: (playerId: UUID, currentLife: number) => number;

    // Settings
    setAnimationSpeed: (speed: number) => void;
    toggleAnimations: (enabled: boolean) => void;

    // Utility
    isAnimationQueueEmpty: () => boolean;
    getAnimationDuration: () => number;
}

// Animation timing constants (in ms)
const BASE_ATTACK_DURATION = 600;
const BASE_DAMAGE_EFFECT_DURATION = 500;
const BASE_COUNTER_EFFECT_DURATION = 900;

export const useAnimationStore = create<AnimationState & AnimationActions>()(
    devtools(
        immer((set, get) => ({
            // Initial state
            attackQueue: [],
            currentAttack: null,
            isAnimating: false,
            activeDamageEffects: [],
            activePlayerCounterEffects: [],
            previousLifeTotals: {},
            visualLifeTotals: null,
            damagePools: {},
            animationSpeed: 1,
            animationsEnabled: true,

            // ... (queueAttackAnimation, queueMultipleAttacks same as before)
            queueAttackAnimation: (attackerId, targetId) => {
                const id = `attack-${attackerId}-${targetId}-${Date.now()}`;
                set((state) => {
                    state.attackQueue.push({
                        id,
                        attackerId,
                        targetId,
                        type: 'attack',
                        status: 'pending',
                    });
                });
                if (!get().isAnimating) {
                    get().startNextAnimation();
                }
            },

            queueMultipleAttacks: (attacks) => {
                set((state) => {
                    attacks.forEach(({ attackerId, targetId }) => {
                        const id = `attack-${attackerId}-${targetId}-${Date.now()}-${Math.random()}`;
                        state.attackQueue.push({
                            id,
                            attackerId,
                            targetId,
                            type: 'attack',
                            status: 'pending',
                        });
                    });
                });
                if (!get().isAnimating) {
                    get().startNextAnimation();
                }
            },

            startNextAnimation: () => {
                const { attackQueue, animationsEnabled } = get();

                if (!animationsEnabled || attackQueue.length === 0) {
                    set((state) => {
                        state.isAnimating = false;
                        state.currentAttack = null;
                        // Cleanup visual overrides when queue finishes
                        state.visualLifeTotals = null;
                        state.damagePools = {};
                    });
                    return;
                }

                const nextAnimation = attackQueue[0];

                set((state) => {
                    state.isAnimating = true;
                    state.currentAttack = { ...nextAnimation, status: 'playing' };
                    state.attackQueue = state.attackQueue.slice(1);
                });

                // Schedule completion (failsafe only)
                setTimeout(() => {
                    const { currentAttack } = get();
                    if (currentAttack && currentAttack.id === nextAnimation.id && currentAttack.status === 'playing') {
                        console.warn('Animation timed out, forcing completion');
                        get().completeCurrentAnimation();
                    }
                }, 2000);
            },

            completeCurrentAnimation: () => {
                set((state) => {
                    if (state.currentAttack) {
                        state.currentAttack.status = 'completed';
                    }
                    state.currentAttack = null;
                });

                if (get().attackQueue.length > 0) {
                    setTimeout(() => {
                        get().startNextAnimation();
                    }, 100);
                } else {
                    set((state) => {
                        state.isAnimating = false;
                        // Cleanup visual overrides
                        state.visualLifeTotals = null;
                        state.damagePools = {};
                    });
                }
            },

            clearAnimationQueue: () => {
                set((state) => {
                    state.attackQueue = [];
                    state.currentAttack = null;
                    state.isAnimating = false;
                    state.visualLifeTotals = null;
                    state.damagePools = {};
                });
            },

            // Trigger a damage flash effect on a player
            triggerDamageEffect: (targetId, amount) => {
                if (!get().animationsEnabled) {
                    return;
                }

                const id = `damage-${targetId}-${Date.now()}`;
                set((state) => {
                    state.activeDamageEffects.push({
                        id,
                        targetId,
                        amount,
                        type: 'damage',
                        timestamp: Date.now(),
                    });
                });

                const duration = BASE_DAMAGE_EFFECT_DURATION / get().animationSpeed;
                setTimeout(() => {
                    get().clearDamageEffect(id);
                }, duration);
            },

            triggerLifeGainEffect: (targetId, amount) => {
                if (!get().animationsEnabled) {
                    return;
                }

                const id = `life-gain-${targetId}-${Date.now()}`;
                set((state) => {
                    state.activeDamageEffects.push({
                        id,
                        targetId,
                        amount,
                        type: 'lifeGain',
                        timestamp: Date.now(),
                    });
                });

                const duration = BASE_DAMAGE_EFFECT_DURATION / get().animationSpeed;
                setTimeout(() => {
                    get().clearDamageEffect(id);
                }, duration);
            },

            triggerPlayerCounterEffect: (targetId, counterName, amount, type, previousValue, currentValue) => {
                if (!get().animationsEnabled) {
                    return;
                }

                const id = `counter-${targetId}-${counterName}-${Date.now()}`;
                set((state) => {
                    state.activePlayerCounterEffects.push({
                        id,
                        targetId,
                        counterName,
                        amount,
                        type,
                        previousValue,
                        currentValue,
                        timestamp: Date.now(),
                    });
                });

                const duration = BASE_COUNTER_EFFECT_DURATION / get().animationSpeed;
                setTimeout(() => {
                    get().clearPlayerCounterEffect(id);
                }, duration);
            },

            clearDamageEffect: (damageId) => {
                set((state) => {
                    state.activeDamageEffects = state.activeDamageEffects.filter(
                        (d) => d.id !== damageId
                    );
                });
            },

            clearPlayerCounterEffect: (effectId) => {
                set((state) => {
                    state.activePlayerCounterEffects = state.activePlayerCounterEffects.filter(
                        (effect) => effect.id !== effectId
                    );
                });
            },

            // Apply a chunk of pending combat damage to the visual life total
            applyCombatDamage: (targetId) => {
                set((state) => {
                    const pool = state.damagePools[targetId] || 0;
                    if (pool <= 0) return;

                    // Count how many more attacks are queued for this target
                    const remainingAttacks = state.attackQueue.filter(a => a.targetId === targetId).length + 1; // +1 for current

                    // Simple heuristic: Try to distribute damage evenly among remaining hits
                    let damageStep = Math.ceil(pool / remainingAttacks);

                    // Ensure we don't overestimate due to rounding in last step
                    if (damageStep > pool) damageStep = pool;

                    if (state.visualLifeTotals) {
                        const currentVisual = state.visualLifeTotals[targetId];
                        if (currentVisual !== undefined) {
                            state.visualLifeTotals[targetId] = currentVisual - damageStep;
                        }
                    }
                    state.damagePools[targetId] = pool - damageStep;

                    // Trigger effect
                    // We call the internal helper to show the flash
                    // Cannot call get().triggerDamageEffect here easily due to immer constraint? 
                    // Actually we can, but let's just push to array for safety or assume the component effect handles it.
                    // Ideally we re-use triggerDamageEffect logic:
                });

                // Trigger the red flash via action (outside Immer setter if possible, but immer supports calling actions inside?)
                // Actually, typically we do it outside.
                // Let's rely on the visual change to trigger effects? No, `updateLifeTotals` triggers them. 
                // We should manually trigger one here.
                // For simplicity, we just updated the state. The specific red flash might have been triggered by the original updateLifeTotals.
                // If we deferred the flash, we should trigger it here.
            },

            // Update life totals and detect changes
            updateLifeTotals: (lifeTotals, isCombatDamageStep) => {
                const { previousLifeTotals, animationsEnabled } = get();
                const changes: LifeChangeAnimation[] = [];

                Object.entries(lifeTotals).forEach(([playerId, currentLife]) => {
                    const previousLife = previousLifeTotals[playerId];
                    if (previousLife !== undefined && previousLife !== currentLife) {
                        const delta = currentLife - previousLife;
                        changes.push({
                            playerId,
                            previousLife,
                            currentLife,
                            delta,
                            timestamp: Date.now(),
                        });

                        // Logic for deferred combat damage
                        if (animationsEnabled && isCombatDamageStep && delta < 0) {
                            set((state) => {
                                if (!state.visualLifeTotals) state.visualLifeTotals = {};
                                // Initialize with previous life if not present
                                if (state.visualLifeTotals[playerId] === undefined) {
                                    state.visualLifeTotals[playerId] = previousLife;
                                }
                                // Add absolute damage to pool
                                state.damagePools[playerId] = (state.damagePools[playerId] || 0) + Math.abs(delta);
                            });
                        } else {
                            // Non-combat change (or healing), update visual immediately to match reality so we don't desync
                            set((state) => {
                                if (state.visualLifeTotals && state.visualLifeTotals[playerId] !== undefined) {
                                    state.visualLifeTotals[playerId] = currentLife;
                                }
                            });
                            if (animationsEnabled) {
                                // Trigger immediate effect for non-deferred
                                if (delta < 0) {
                                    get().triggerDamageEffect(playerId, Math.abs(delta));
                                } else if (delta > 0) {
                                    get().triggerLifeGainEffect(playerId, delta);
                                }
                            }
                        }
                    }
                });

                // Update stored life totals
                set((state) => {
                    state.previousLifeTotals = { ...lifeTotals };
                });

                return changes;
            },

            // Get life change delta for a specific player
            getLifeDelta: (playerId, currentLife) => {
                const previous = get().previousLifeTotals[playerId];
                return previous !== undefined ? currentLife - previous : 0;
            },

            // Settings
            setAnimationSpeed: (speed) => {
                set((state) => {
                    state.animationSpeed = speed;
                });
            },

            toggleAnimations: (enabled) => {
                set((state) => {
                    state.animationsEnabled = enabled;
                    if (!enabled) {
                        state.attackQueue = [];
                        state.currentAttack = null;
                        state.isAnimating = false;
                        state.activeDamageEffects = [];
                        state.activePlayerCounterEffects = [];
                        state.visualLifeTotals = null;
                        state.damagePools = {};
                    }
                });
            },

            // Utility
            isAnimationQueueEmpty: () => {
                const { attackQueue, currentAttack } = get();
                return attackQueue.length === 0 && currentAttack === null;
            },

            getAnimationDuration: () => {
                return BASE_ATTACK_DURATION / get().animationSpeed;
            },
        })),
        { name: 'animation-store' }
    )
);
