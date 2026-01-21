/**
 * Damage Effects Component
 * 
 * Renders damage visual effects including:
 * - Red vignette flash when the player takes damage
 * - Blue/different effect when opponent takes damage
 * - Floating damage numbers
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
    isMe: boolean;
    timestamp: number;
}

export const DamageEffects: React.FC = React.memo(() => {
    const { activeDamageEffects } = useAnimationStore(
        useShallow((state) => ({
            activeDamageEffects: state.activeDamageEffects,
        }))
    );

    const myPlayerId = useGameStore((state) => state.gameView?.myPlayerId);

    const [effects, setEffects] = useState<DamageEffect[]>([]);

    // Convert store damage effects to renderable effects
    useEffect(() => {
        const newEffects: DamageEffect[] = activeDamageEffects.map((d) => ({
            id: d.id,
            playerId: d.targetId,
            amount: d.amount,
            isMe: d.targetId === myPlayerId,
            timestamp: d.timestamp,
        }));
        setEffects(newEffects);
    }, [activeDamageEffects, myPlayerId]);

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

    if (effects.length === 0) return null;

    return (
        <>
            {/* Vignette effects for each damage */}
            {effects.map((effect) => (
                <div
                    key={`vignette-${effect.id}`}
                    className={`damage-vignette ${effect.isMe ? 'player' : 'opponent'}`}
                />
            ))}

            {/* Floating damage numbers */}
            {effects.map((effect) => {
                const pos = getDamagePosition(effect.playerId);
                if (!pos) return null;

                return (
                    <div
                        key={`number-${effect.id}`}
                        className="damage-number"
                        style={{
                            left: pos.x,
                            top: pos.y,
                        }}
                    >
                        -{effect.amount}
                    </div>
                );
            })}
        </>
    );
});
