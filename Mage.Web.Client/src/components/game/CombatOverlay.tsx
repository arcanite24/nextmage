import React, { useEffect, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../stores';
import './GamePage.css';

interface Point {
    x: number;
    y: number;
}

interface CombatLine {
    id: string;
    start: Point;
    end: Point;
    type: 'attack' | 'block';
}

const getElementCenter = (id: string): Point | null => {
    const el = document.getElementById(id);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
};

export const CombatOverlay: React.FC = React.memo(() => {
    const { combat } = useGameStore(useShallow(state => ({
        combat: state.gameView?.combat
    })));
    const [lines, setLines] = useState<CombatLine[]>([]);

    const updateLines = useCallback(() => {
        if (!combat) {
            setLines([]);
            return;
        }

        const newLines: CombatLine[] = [];

        combat.forEach((group, index) => {
            // 1. Attackers -> Defender
            // Defender can be a Player or a Permanent (Planeswalker/Battle)
            let defenderId = group.defenderId;
            let targetPoint: Point | null = null;

            // Try determining target element ID
            // Check if it's a player
            let targetElId = `player-${defenderId}`;
            targetPoint = getElementCenter(targetElId);

            // If not found, try card (planeswalker/battle)
            if (!targetPoint) {
                targetElId = `card-${defenderId}`;
                targetPoint = getElementCenter(targetElId);
            }

            if (targetPoint && group.attackers) {
                Object.values(group.attackers).forEach(attacker => {
                    const start = getElementCenter(`card-${attacker.id}`);
                    if (start) {
                        newLines.push({
                            id: `atk-${attacker.id}-${defenderId}`,
                            start,
                            end: targetPoint!,
                            type: 'attack'
                        });
                    }
                });
            }

            // 2. Blockers -> Attackers
            // Each blocker blocks one or more attackers in this group. 
            // Usually in a group, all blockers block the attackers in that group.
            // We draw lines from Blocker to Attacker(s).
            if (group.blockers && group.attackers) {
                const attackerIds = Object.keys(group.attackers);
                // If multiple attackers in a group (banding), blockers block the group?
                // Simply draw line to the first attacker for now or average point?
                // Let's draw to all attackers in the group to be safe (mesh).

                Object.values(group.blockers).forEach(blocker => {
                    const start = getElementCenter(`card-${blocker.id}`);
                    if (start) {
                        attackerIds.forEach(atkId => {
                            const end = getElementCenter(`card-${atkId}`);
                            if (end) {
                                newLines.push({
                                    id: `blk-${blocker.id}-${atkId}`,
                                    start,
                                    end,
                                    type: 'block'
                                });
                            }
                        });
                    }
                });
            }
        });

        setLines(newLines);
    }, [combat]);

    useEffect(() => {
        updateLines();

        // Update on resize
        window.addEventListener('resize', updateLines);

        // Also a periodic check/animation frame in case of layout shifts?
        // Let's rely on render cycles + resize for now.
        // Maybe a small delay to allow DOM to settle after state updates?
        const timeout = setTimeout(updateLines, 100);

        return () => {
            window.removeEventListener('resize', updateLines);
            clearTimeout(timeout);
        };
    }, [updateLines, combat]); // Re-run when combat data changes

    if (lines.length === 0) return null;

    return (
        <svg className="combat-overlay">
            <defs>
                <marker id="arrow-attack" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="rgba(220, 38, 38, 0.8)" />
                </marker>
                <marker id="arrow-block" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="rgba(37, 99, 235, 0.8)" />
                </marker>
            </defs>
            {lines.map(line => (
                <CombatLineComponent
                    key={line.id}
                    line={line}
                />
            ))}
        </svg>
    );
});

// === SUB-COMPONENTS ===

interface CombatLineComponentProps {
    line: CombatLine;
}

const CombatLineComponent: React.FC<CombatLineComponentProps> = React.memo(({ line }) => {
    return (
        <line
            x1={line.start.x}
            y1={line.start.y}
            x2={line.end.x}
            y2={line.end.y}
            className={`combat-line combat-line-${line.type}`}
            markerEnd={`url(#arrow-${line.type})`}
        />
    );
});
