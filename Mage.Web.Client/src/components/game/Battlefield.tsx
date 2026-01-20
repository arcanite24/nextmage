import React, { useState, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PermanentView, PlayerView } from '../../types';
import { useGameStore } from '../../stores';
import { cardImageService } from '../../services/CardImageService';
import './GamePage.css';

interface BattlefieldProps {
    player: PlayerView;
    isMe?: boolean;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
}


const ZONE_ORDER = {
    LANDS: 0,
    ARTIFACTS: 1,
    ENCHANTMENTS: 2,
    PLANESWALKERS: 3,
    BATTLES: 4,
    OTHER: 5
};

type ZoneType = keyof typeof ZONE_ORDER;

interface StackedGroup {
    key: string;
    cards: PermanentView[];
}

export const Battlefield: React.FC<BattlefieldProps> = React.memo(({ player, isMe, onCardClick, onCardInspect }) => {
    const permanents = player.battlefield ? Object.values(player.battlefield) : [];

    // Use shallow selectors to avoid unnecessary re-renders when other parts of store change
    const { pendingAction, combat } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        combat: state.gameView?.combat
    })));

    const [expandedStacks, setExpandedStacks] = useState<Record<string, boolean>>({});

    const handleCardClick = useCallback((cardId: string) => {
        if (onCardClick) onCardClick(cardId);
    }, [onCardClick]);

    const toggleStack = useCallback((stackKey: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedStacks(prev => ({ ...prev, [stackKey]: !prev[stackKey] }));
    }, []);

    // Helper to check if card is a valid target
    const getIsValidTarget = useCallback((cardId: string): boolean => {
        if (pendingAction.type === 'target' && pendingAction.validTargets) {
            return pendingAction.validTargets.includes(cardId);
        }
        return pendingAction.type === 'select';
    }, [pendingAction]);

    // Helper to check combat state
    const getCombatState = useCallback((cardId: string) => {
        if (!combat) return null;

        for (const group of combat) {
            if (group.attackers && group.attackers[cardId]) return 'attacking';
            if (group.blockers && group.blockers[cardId]) return 'blocking';
        }
        return null;
    }, [combat]);

    // Group cards by zone
    const zones = useMemo(() => {
        const z = {
            CREATURES: [] as PermanentView[],
            LANDS: [] as PermanentView[],
            ARTIFACTS: [] as PermanentView[],
            ENCHANTMENTS: [] as PermanentView[],
            PLANESWALKERS: [] as PermanentView[],
            BATTLES: [] as PermanentView[],
            OTHER: [] as PermanentView[],
        };

        const getZoneForPermanent = (perm: PermanentView): keyof typeof z => {
            if (perm.cardTypes.includes('Creature')) return 'CREATURES';
            if (perm.cardTypes.includes('Land')) return 'LANDS';
            if (perm.cardTypes.includes('Planeswalker')) return 'PLANESWALKERS';
            if (perm.cardTypes.includes('Battle')) return 'BATTLES';
            if (perm.cardTypes.includes('Enchantment')) return 'ENCHANTMENTS';
            if (perm.cardTypes.includes('Artifact')) return 'ARTIFACTS';
            return 'OTHER';
        };

        permanents.forEach(p => {
            const zone = getZoneForPermanent(p);
            if (z[zone]) z[zone].push(p);
        });
        return z;
    }, [permanents]);

    // Group stackable cards
    const zoneStacks = useMemo(() => {
        const groupStacks = (cards: PermanentView[]): StackedGroup[] => {
            const groups: Record<string, PermanentView[]> = {};

            // Sorting
            const sortedCards = [...cards].sort((a, b) => {
                const nameCompare = a.name.localeCompare(b.name);
                if (nameCompare !== 0) return nameCompare;
                return a.tapped === b.tapped ? 0 : a.tapped ? 1 : -1;
            });

            sortedCards.forEach(card => {
                let combatStateKey = '';
                if (combat) {
                    for (const group of combat) {
                        if (group.attackers && group.attackers[card.id]) { combatStateKey = 'attacking'; break; }
                        if (group.blockers && group.blockers[card.id]) { combatStateKey = 'blocking'; break; }
                    }
                }

                const countersKey = card.counters
                    ? [...card.counters].sort((a, b) => a.name.localeCompare(b.name))
                        .map(c => `${c.name}:${c.count}`)
                        .join('|')
                    : '';

                const key = `${card.name}-${card.tapped}-${combatStateKey}-${card.summoningSickness}-${countersKey}`;

                if (!groups[key]) groups[key] = [];
                groups[key].push(card);
            });

            return Object.entries(groups).map(([key, groupCards]) => ({
                key,
                cards: groupCards
            }));
        };

        const res: Record<string, StackedGroup[]> = {};
        (Object.keys(zones) as Array<keyof typeof zones>).forEach(key => {
            res[key] = groupStacks(zones[key]);
        });
        return res;
    }, [zones, combat]);

    // Note: renderCounters moved effectively outside (or to bottom)


    const renderCard = useCallback((card: PermanentView, index: number, total: number, isStacked: boolean, stackKey: string) => {
        return (
            <BattlefieldCard
                key={card.id}
                card={card}
                index={index}
                total={total}
                isStacked={isStacked}
                stackKey={stackKey}
                isStackExpanded={!!expandedStacks[stackKey]}
                combatState={getCombatState(card.id)}
                isValidTarget={getIsValidTarget(card.id)}
                onCardClick={handleCardClick}
                onCardInspect={onCardInspect}
                onToggleStack={toggleStack}
            />
        );
    }, [expandedStacks, getCombatState, getIsValidTarget, handleCardClick, onCardInspect, toggleStack]);

    const renderStack = (stack: StackedGroup) => {
        const isExpanded = expandedStacks[stack.key];

        if (isExpanded) {
            return (
                <div key={stack.key} className="stack-expanded-wrapper">
                    <div className="stack-controls" onClick={(e) => toggleStack(stack.key, e)} title="Collapse">
                        ◀
                    </div>
                    {stack.cards.map((card, i) => renderCard(card, i, stack.cards.length, false, stack.key))}
                </div>
            );
        }

        return (
            <div key={stack.key} className="card-stack" onClick={(e) => {
                if (stack.cards.length > 1) {
                    toggleStack(stack.key, e);
                }
            }}>
                {stack.cards.map((card, i) => {
                    // Optimization: Rendering all in the stack vertically?
                    // We used negative top margin in renderCard to pile them up.
                    // But standard 'flex' layout will put them side by side.
                    // card-stack class should probably be column?
                    return renderCard(card, i, stack.cards.length, true, stack.key);
                })}
            </div>
        );
    };

    const renderZone = (zoneKey: string) => {
        const stacks = zoneStacks[zoneKey];
        if (!stacks || stacks.length === 0) return null;

        return (
            <div className={`battlefield-zone zone-${zoneKey.toLowerCase()}`} key={zoneKey}>
                {stacks.map(stack => renderStack(stack))}
            </div>
        );
    };

    // Prepare rows
    // Prepare rows
    const frontRowContent = renderZone('CREATURES');

    // Back row zones
    const backRowZones: ZoneType[] = ['LANDS', 'ARTIFACTS', 'ENCHANTMENTS', 'PLANESWALKERS', 'BATTLES', 'OTHER'];
    const backRowContent = (
        <div className="battlefield-row back-row">
            {backRowZones.map(z => renderZone(z))}
        </div>
    );

    const frontRowWrapper = (
        <div className="battlefield-row front-row">
            {frontRowContent}
        </div>
    );

    return (
        <div className={`battlefield ${isMe ? 'me' : 'opponent'}`}>
            {isMe ? (
                <>
                    {frontRowWrapper}
                    {backRowContent}
                </>
            ) : (
                <>
                    {backRowContent}
                    {frontRowWrapper}
                </>
            )}
        </div>
    );
});


// === SUB-COMPONENTS ===

interface BattlefieldCardProps {
    card: PermanentView;
    index: number;
    total: number;
    isStacked: boolean;
    stackKey: string;
    isStackExpanded: boolean;
    combatState: string | null;
    isValidTarget: boolean;
    onCardClick: (id: string) => void;
    onCardInspect?: (id: string) => void;
    onToggleStack: (key: string, e: React.MouseEvent) => void;
}

const renderCounters = (card: PermanentView) => {
    if (!card.counters || card.counters.length === 0) return null;

    // Prioritize +1/+1 and -1/-1 counters for main display
    const p1p1 = card.counters.find(c => c.name === '+1/+1');
    const m1m1 = card.counters.find(c => c.name === '-1/-1');
    const loyalty = card.counters.find(c => c.name === 'loyalty');
    const otherCounters = card.counters.filter(c => c.name !== '+1/+1' && c.name !== '-1/-1' && c.name !== 'loyalty');

    return (
        <div className="counters-container">
            {p1p1 && (
                <div className="counter-badge plus-one" title="+1/+1 Counters">
                    +{p1p1.count}/+{p1p1.count}
                </div>
            )}
            {m1m1 && (
                <div className="counter-badge minus-one" title="-1/-1 Counters">
                    -{m1m1.count}/-{m1m1.count}
                </div>
            )}
            {loyalty && (
                <div className="counter-badge loyalty-counter" title="Loyalty Counters">
                    {loyalty.count}
                </div>
            )}
            {otherCounters.map(c => (
                <div key={c.name} className="counter-badge generic-counter" title={`${c.count} ${c.name} counters`}>
                    {c.count}
                </div>
            ))}
        </div>
    );
};

const arePropsEqual = (prev: BattlefieldCardProps, next: BattlefieldCardProps) => {
    // Stable props check
    if (prev.index !== next.index) return false;
    if (prev.total !== next.total) return false;
    if (prev.isStacked !== next.isStacked) return false;
    if (prev.stackKey !== next.stackKey) return false;
    if (prev.isStackExpanded !== next.isStackExpanded) return false;
    if (prev.combatState !== next.combatState) return false;
    if (prev.isValidTarget !== next.isValidTarget) return false;
    // Callbacks should be stable ref check
    if (prev.onCardClick !== next.onCardClick) return false;
    if (prev.onToggleStack !== next.onToggleStack) return false;

    // Deep check for Card object because server sends fresh references
    const c1 = prev.card;
    const c2 = next.card;
    if (c1.id !== c2.id) return false;
    if (c1.name !== c2.name) return false;
    if (c1.tapped !== c2.tapped) return false;
    if (c1.summoningSickness !== c2.summoningSickness) return false;
    if (c1.power !== c2.power) return false;
    if (c1.toughness !== c2.toughness) return false;
    if (c1.loyalty !== c2.loyalty) return false;
    if (c1.defense !== c2.defense) return false;
    if (c1.damage !== c2.damage) return false;

    // Counters check
    if (c1.counters?.length !== c2.counters?.length) return false;
    if (c1.counters && c2.counters) {
        if (JSON.stringify(c1.counters) !== JSON.stringify(c2.counters)) return false;
    }

    return true;
};

const BattlefieldCard: React.FC<BattlefieldCardProps> = React.memo(({
    card, index, total, isStacked, stackKey, isStackExpanded, combatState, isValidTarget,
    onCardClick, onCardInspect, onToggleStack
}) => {
    const isCreature = card.cardTypes.includes('Creature');
    const isPlaneswalker = card.cardTypes.includes('Planeswalker');
    const isBattle = card.cardTypes.includes('Battle');

    const style: React.CSSProperties = isStacked ? {
        marginTop: `${index * -110}px`, // Large negative margin for tight overlap
        marginLeft: `${index * 0}px`,
        zIndex: index,
        position: 'relative' // relative flow but overlapped
    } : {};

    const handleClick = (e: React.MouseEvent) => {
        if (isStacked && index < total - 1 && !isStackExpanded) {
            onToggleStack(stackKey, e);
        } else {
            onCardClick(card.id);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onCardInspect) onCardInspect(card.id);
    };

    return (
        <div
            id={`card-${card.id}`}
            className={`permanent ${card.tapped ? 'tapped' : ''} ${card.isAbility ? 'ability' : ''} ${combatState ? combatState : ''} ${isValidTarget ? 'valid-target' : ''}`}
            style={isStacked && index > 0 ? style : { zIndex: index }}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <img
                src={cardImageService.getImageUrl(card)}
                alt={card.name}
                data-id={card.id}
                onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
            />

            <div className="card-status-overlay">
                {card.summoningSickness && (
                    <div className="status-icon sickness" title="Summoning Sickness">💫</div>
                )}
                {combatState === 'attacking' && (
                    <div className="status-icon attacking" title="Attacking">⚔️</div>
                )}
                {combatState === 'blocking' && (
                    <div className="status-icon blocking" title="Blocking">🛡️</div>
                )}
            </div>

            {renderCounters(card)}

            {/* Badges */}
            {isCreature && card.power !== "" && card.toughness !== "" && (
                <div className="pt-badge">
                    {card.power}/{card.toughness}
                    {card.damage > 0 && <span className="damage-indicator" title={`${card.damage} damage marked`}>{`(-${card.damage})`}</span>}
                </div>
            )}
            {isPlaneswalker && card.loyalty !== "" && (
                <div className="loyalty-badge">{card.loyalty}</div>
            )}
            {isBattle && card.defense !== "" && (
                <div className="defense-badge">{card.defense}</div>
            )}

            {/* Stack Count Badge (only on top (last) card of collapsed stack) */}
            {isStacked && index === total - 1 && !isStackExpanded && total > 1 && (
                <div className="stack-count" onClick={(e) => onToggleStack(stackKey, e)}>
                    {total}
                </div>
            )}
        </div>
    );
}, arePropsEqual);
