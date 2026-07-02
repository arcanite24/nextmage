import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import './GamePage.css';

interface Point {
    x: number;
    y: number;
}

interface CombatLine {
    id: string;
    start: Point;
    end: Point;
    type: 'attack' | 'block' | 'target';
}

interface TargetMarker {
    id: string;
    point: Point;
    label: string;
    chosen: boolean;
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

const resolveElementCenter = (uuid: string): Point | null => {
    return getElementCenter(`player-${uuid}`) || getElementCenter(`card-${uuid}`);
};

export const CombatOverlay: React.FC = React.memo(() => {
    const { combat, pendingAction, selectedCardId, stack } = useGameStore(useShallow(state => ({
        combat: state.gameView?.combat,
        pendingAction: state.pendingAction,
        selectedCardId: state.selectedCardId,
        stack: state.gameView?.stack,
    })));
    const { animationsEnabled, animationSpeed } = useSettingsStore(useShallow(state => ({
        animationsEnabled: state.settings.animationsEnabled,
        animationSpeed: state.settings.animationSpeed,
    })));
    const [lines, setLines] = useState<CombatLine[]>([]);
    const [markers, setMarkers] = useState<TargetMarker[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const pulseDuration = useMemo(() => `${Math.max(0.75, 1.5 / animationSpeed).toFixed(2)}s`, [animationSpeed]);

    const updateLines = useCallback(() => {
        const newLines: CombatLine[] = [];
        const newMarkers: TargetMarker[] = [];

        combat?.forEach((group) => {
            // 1. Attackers -> Defender
            // Defender can be a Player or a Permanent (Planeswalker/Battle)
            const defenderId = group.defenderId;
            const targetPoint = resolveElementCenter(defenderId);

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
                            type: 'attack',
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
                                    type: 'block',
                                });
                            }
                        });
                    }
                });
            }
        });

        if (pendingAction.type === 'target' && pendingAction.validTargets.length > 0) {
            const stackCards = stack ? Object.values(stack) : [];
            const sourceId = selectedCardId && getElementCenter(`card-${selectedCardId}`)
                ? selectedCardId
                : stackCards.length > 0
                    ? stackCards[stackCards.length - 1].id
                    : null;
            const source = sourceId ? getElementCenter(`card-${sourceId}`) : null;

            pendingAction.validTargets.forEach((targetId) => {
                const target = resolveElementCenter(targetId);
                if (!target) return;

                const chosen = selectedCardId === targetId;
                newMarkers.push({
                    id: `target-marker-${targetId}`,
                    point: target,
                    label: chosen ? 'Chosen' : 'Target',
                    chosen,
                });

                if (source && sourceId !== targetId) {
                    newLines.push({
                        id: `target-${sourceId}-${targetId}`,
                        start: source,
                        end: offsetFromEnd(source, target, 28),
                        type: 'target',
                    });
                }
            });
        }

        setLines(newLines);
        setMarkers(newMarkers);
    }, [combat, pendingAction, selectedCardId, stack]);

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
    }, [updateLines]);

    if (lines.length === 0 && markers.length === 0) return null;

    return (
        <div
            className={`combat-overlay-root ${animationsEnabled ? '' : 'reduced-motion'}`}
            style={{ '--combat-pulse-duration': pulseDuration } as React.CSSProperties}
            data-testid="combat-overlay"
        >
            <svg className="combat-overlay">
                <defs>
                    <marker id="arrow-attack" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,8 L12,4 z" fill="#ef4444" />
                    </marker>
                    <marker id="arrow-block" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,8 L12,4 z" fill="#3b82f6" />
                    </marker>
                    <marker id="arrow-target" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,8 L12,4 z" fill="#fbbf24" />
                    </marker>
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
                    <filter id="glow-target" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
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
            {markers.map(marker => (
                <div
                    key={marker.id}
                    className={`combat-target-marker ${marker.chosen ? 'chosen' : ''}`}
                    style={{ left: marker.point.x, top: marker.point.y }}
                    data-testid="combat-target-marker"
                >
                    {marker.label}
                </div>
            ))}
        </div>
    );
});

// === SUB-COMPONENTS ===

interface CombatLineComponentProps {
    line: CombatLine;
}

const CombatLineComponent: React.FC<CombatLineComponentProps> = React.memo(({ line }) => {
    const filterId = line.type === 'attack'
        ? 'glow-attack'
        : line.type === 'block'
            ? 'glow-block'
            : 'glow-target';

    return (
        <g data-testid={`combat-line-${line.type}`}>
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
                filter={`url(#${filterId})`}
            />
        </g>
    );
});
