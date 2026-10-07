/**
 * Damage Effects Component
 * 
 * Renders damage visual effects including:
 * - Red vignette flash when the player takes damage
 * - Blue/different effect when opponent takes damage
 * - Floating damage numbers
 * - Floating life-gain numbers
 */

import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAnimationStore, useGameStore } from '../../stores';
import { UUID } from '../../types';
import './AttackAnimation.css';

interface DamageEffect {
    id: string;
    playerId: UUID;
    amount: number;
    type: 'damage' | 'lifeGain';
    isMe: boolean;
    timestamp: number;
}

interface CounterEffect {
    id: string;
    playerId: UUID;
    counterName: string;
    amount: number;
    type: 'counterGain' | 'counterLoss';
    previousValue: number;
    currentValue: number;
    timestamp: number;
}

export const DamageEffects: React.FC = React.memo(() => {
    const { activeDamageEffects, activePlayerCounterEffects } = useAnimationStore(
        useShallow((state) => ({
            activeDamageEffects: state.activeDamageEffects,
            activePlayerCounterEffects: state.activePlayerCounterEffects,
        }))
    );

    const myPlayerId = useGameStore((state) => state.gameView?.myPlayerId);

    const [effects, setEffects] = useState<DamageEffect[]>([]);
    const [counterEffects, setCounterEffects] = useState<CounterEffect[]>([]);

    // Convert store damage effects to renderable effects
    useEffect(() => {
        const newEffects: DamageEffect[] = activeDamageEffects.map((d) => ({
            id: d.id,
            playerId: d.targetId,
            amount: d.amount,
            type: d.type,
            isMe: d.targetId === myPlayerId,
            timestamp: d.timestamp,
        }));
        setEffects(newEffects);
    }, [activeDamageEffects, myPlayerId]);

    useEffect(() => {
        const newCounterEffects: CounterEffect[] = activePlayerCounterEffects.map((effect) => ({
            id: effect.id,
            playerId: effect.targetId,
            counterName: effect.counterName,
            amount: effect.amount,
            type: effect.type,
            previousValue: effect.previousValue,
            currentValue: effect.currentValue,
            timestamp: effect.timestamp,
        }));
        setCounterEffects(newCounterEffects);
    }, [activePlayerCounterEffects]);

    // Get position for damage number
    const getDamagePosition = (playerId: UUID): { x: number; y: number } | null => {
        // Try player avatar
        const el = document.getElementById(`player-${playerId}`);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    };

    if (effects.length === 0 && counterEffects.length === 0) return null;

    return (
        <>
            {/* Vignette effects for each damage */}
            {effects.map((effect) => (
                <div
                    key={`vignette-${effect.id}`}
                    className={`damage-vignette ${effect.type === 'lifeGain' ? 'life-gain' : effect.isMe ? 'player' : 'opponent'}`}
                />
            ))}

            {/* Floating life-change numbers */}
            {effects.map((effect) => {
                const pos = getDamagePosition(effect.playerId);
                if (!pos) return null;

                return (
                    <div
                        key={`number-${effect.id}`}
                        className={`damage-number ${effect.type === 'lifeGain' ? 'life-gain' : ''}`}
                        style={{
                            left: pos.x,
                            top: pos.y,
                        }}
                        data-testid={effect.type === 'lifeGain' ? 'life-gain-number' : 'damage-number'}
                    >
                        {effect.type === 'lifeGain' ? `+${effect.amount}` : `-${effect.amount}`}
                    </div>
                );
            })}

            {/* Floating player counter-change chips */}
            {counterEffects.map((effect, index) => {
                const pos = getDamagePosition(effect.playerId);
                if (!pos) return null;
                const signedAmount = effect.type === 'counterGain' ? `+${effect.amount}` : `-${effect.amount}`;

                return (
                    <div
                        key={`counter-${effect.id}`}
                        className={`player-counter-effect ${effect.type === 'counterGain' ? 'counter-gain' : 'counter-loss'}`}
                        style={{
                            left: pos.x,
                            top: pos.y + 34 + index * 26,
                        }}
                        data-testid="player-counter-effect"
                        data-player-id={effect.playerId}
                        data-counter-name={effect.counterName}
                        data-effect-type={effect.type}
                        data-previous-value={effect.previousValue}
                        data-current-value={effect.currentValue}
                    >
                        <span className="player-counter-effect-delta">{signedAmount}</span>
                        <span className="player-counter-effect-name">{effect.counterName}</span>
                    </div>
                );
            })}
        </>
    );
});
