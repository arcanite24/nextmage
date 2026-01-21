import React, { useEffect, useState, useCallback, useRef } from 'react';
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

// Calculate a point between start and end, offset from the end
const offsetFromEnd = (start: Point, end: Point, offset: number): Point => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return end;
    const ratio = (distance - offset) / distance;
    return {
        x: start.x + dx * ratio,
        y: start.y + dy * ratio
    };
};

export const CombatOverlay: React.FC = React.memo(() => {
    const { combat, step } = useGameStore(useShallow(state => ({
        combat: state.gameView?.combat,
        step: state.gameView?.step
    })));
    const [lines, setLines] = useState<CombatLine[]>([]);
    const animFrameRef = useRef<number | null>(null);

    const updateLines = useCallback(() => {
        if (!combat || combat.length === 0) {
            setLines([]);
            return;
        }

        const newLines: CombatLine[] = [];

        combat.forEach((group) => {
            // 1. Attackers -> Defender
            // Defender can be a Player or a Permanent (Planeswalker/Battle)
            const defenderId = group.defenderId;
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
                        // Offset the end point slightly so the arrow doesn't overlap the target center
                        const offsetEnd = offsetFromEnd(start, targetPoint!, 30);
                        newLines.push({
                            id: `atk-${attacker.id}-${defenderId}`,
                            start,
                            end: offsetEnd,
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

                Object.values(group.blockers).forEach(blocker => {
                    const start = getElementCenter(`card-${blocker.id}`);
                    if (start) {
                        attackerIds.forEach(atkId => {
                            const end = getElementCenter(`card-${atkId}`);
                            if (end) {
                                // Offset the end point slightly
                                const offsetEnd = offsetFromEnd(start, end, 30);
                                newLines.push({
                                    id: `blk-${blocker.id}-${atkId}`,
                                    start,
                                    end: offsetEnd,
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
        // Initial update with small delay to let DOM settle
        const timeout = setTimeout(updateLines, 50);

        // Update on resize
        const handleResize = () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
            animFrameRef.current = requestAnimationFrame(updateLines);
        };
        window.addEventListener('resize', handleResize);

        // Use MutationObserver to detect DOM changes (cards moving)
        const observer = new MutationObserver(() => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
            animFrameRef.current = requestAnimationFrame(updateLines);
        });

        // Observe the entire game page for attribute and subtree changes
        const gameEl = document.querySelector('.game-page');
        if (gameEl) {
            observer.observe(gameEl, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }

        // Additional periodic update for smooth animations
        const interval = setInterval(updateLines, 200);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeout);
            clearInterval(interval);
            observer.disconnect();
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [updateLines, combat]);

    if (lines.length === 0) return null;

    return (
        <svg className="combat-overlay">
            <defs>
                {/* Attack arrow - red with glow effect */}
                <marker id="arrow-attack" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,8 L12,4 z" fill="#ef4444" />
                </marker>
                {/* Block arrow - blue */}
                <marker id="arrow-block" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,8 L12,4 z" fill="#3b82f6" />
                </marker>
                {/* Glow filters */}
                <filter id="glow-attack" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="glow-block" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
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
    const isAttack = line.type === 'attack';

    return (
        <g>
            {/* Outer glow line */}
            <line
                x1={line.start.x}
                y1={line.start.y}
                x2={line.end.x}
                y2={line.end.y}
                className={`combat-line combat-line-${line.type}-glow`}
            />
            {/* Main line */}
            <line
                x1={line.start.x}
                y1={line.start.y}
                x2={line.end.x}
                y2={line.end.y}
                className={`combat-line combat-line-${line.type}`}
                markerEnd={`url(#arrow-${line.type})`}
                filter={isAttack ? 'url(#glow-attack)' : 'url(#glow-block)'}
            />
        </g>
    );
});
