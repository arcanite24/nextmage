import React, { useState } from 'react';
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

export const Battlefield: React.FC<BattlefieldProps> = ({ player, isMe, onCardClick, onCardInspect }) => {
    const permanents = player.battlefield ? Object.values(player.battlefield) : [];
    const { gameView, pendingAction } = useGameStore();
    const [expandedStacks, setExpandedStacks] = useState<Record<string, boolean>>({});

    const handleCardClick = (cardId: string) => {
        if (onCardClick) onCardClick(cardId);
    };

    const toggleStack = (stackKey: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedStacks(prev => ({ ...prev, [stackKey]: !prev[stackKey] }));
    };

    // Helper to check if card is a valid target
    const isValidTarget = (cardId: string): boolean => {
        if (pendingAction.type === 'target' && pendingAction.validTargets) {
            return pendingAction.validTargets.includes(cardId);
        }
        return pendingAction.type === 'select';
    };

    // Helper to check combat state
    const getCombatState = (cardId: string) => {
        if (!gameView || !gameView.combat) return null;

        for (const group of gameView.combat) {
            if (group.attackers && group.attackers[cardId]) return 'attacking';
            if (group.blockers && group.blockers[cardId]) return 'blocking';
        }
        return null;
    };

    const getZoneForPermanent = (perm: PermanentView): 'CREATURES' | ZoneType => {
        if (perm.cardTypes.includes('Creature')) return 'CREATURES';
        if (perm.cardTypes.includes('Land')) return 'LANDS';
        if (perm.cardTypes.includes('Planeswalker')) return 'PLANESWALKERS';
        if (perm.cardTypes.includes('Battle')) return 'BATTLES';
        if (perm.cardTypes.includes('Enchantment')) return 'ENCHANTMENTS';
        if (perm.cardTypes.includes('Artifact')) return 'ARTIFACTS';
        return 'OTHER';
    };

    // Group cards by zone
    const zones = {
        CREATURES: [] as PermanentView[],
        LANDS: [] as PermanentView[],
        ARTIFACTS: [] as PermanentView[],
        ENCHANTMENTS: [] as PermanentView[],
        PLANESWALKERS: [] as PermanentView[],
        BATTLES: [] as PermanentView[],
        OTHER: [] as PermanentView[],
    };

    permanents.forEach(p => {
        const zone = getZoneForPermanent(p);
        zones[zone].push(p);
    });

    // Helper to group stackable cards
    const groupStacks = (cards: PermanentView[]): StackedGroup[] => {
        const groups: Record<string, PermanentView[]> = {};

        // Sorting to ensure consistent order (Group by name mainly, keep tapped near untapped of same name)
        const sortedCards = [...cards].sort((a, b) => {
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;
            return a.tapped === b.tapped ? 0 : a.tapped ? 1 : -1;
        });

        sortedCards.forEach(card => {
            // Stack criteria: Name + Tapped + Attacking/Blocking/Sickness status + Counters
            const combatState = getCombatState(card.id);
            const countersKey = card.counters
                ? [...card.counters].sort((a, b) => a.name.localeCompare(b.name))
                    .map(c => `${c.name}:${c.count}`)
                    .join('|')
                : '';

            const key = `${card.name}-${card.tapped}-${combatState}-${card.summoningSickness}-${countersKey}`;

            if (!groups[key]) groups[key] = [];
            groups[key].push(card);
        });

        // Convert to array
        return Object.entries(groups).map(([key, groupCards]) => ({
            key,
            cards: groupCards
        }));
    };

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
                        {c.count} {/* specialized icons could go here */}
                    </div>
                ))}
            </div>
        );
    };

    const renderCard = (card: PermanentView, index: number, total: number, isStacked: boolean, stackKey: string) => {
        const isCreature = card.cardTypes.includes('Creature');
        const isPlaneswalker = card.cardTypes.includes('Planeswalker');
        const isBattle = card.cardTypes.includes('Battle');

        const combatState = getCombatState(card.id);
        const validTarget = isValidTarget(card.id);

        const style: React.CSSProperties = isStacked ? {
            marginTop: `${index * -110}px`, // Large negative margin for tight overlap
            marginLeft: `${index * 0}px`,
            zIndex: index,
            position: 'relative' // relative flow but overlapped
        } : {};

        return (
            <div
                key={card.id}
                id={`card-${card.id}`}
                className={`permanent ${card.tapped ? 'tapped' : ''} ${card.isAbility ? 'ability' : ''} ${combatState ? combatState : ''} ${validTarget ? 'valid-target' : ''}`}
                style={isStacked && index > 0 ? style : { zIndex: index }}
                onClick={(e) => {
                    if (isStacked && index < total - 1 && !expandedStacks[stackKey]) {
                        toggleStack(stackKey, e);
                    } else {
                        handleCardClick(card.id);
                    }
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (onCardInspect) onCardInspect(card.id);
                }}
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
                {isStacked && index === total - 1 && !expandedStacks[stackKey] && total > 1 && (
                    <div className="stack-count" onClick={(e) => toggleStack(stackKey, e)}>
                        {total}
                    </div>
                )}
            </div>
        );
    };

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

    const renderZone = (zoneKey: string, cards: PermanentView[]) => {
        if (cards.length === 0) return null;

        const stacks = groupStacks(cards);

        return (
            <div className={`battlefield-zone zone-${zoneKey.toLowerCase()}`} key={zoneKey}>
                {stacks.map(stack => renderStack(stack))}
            </div>
        );
    };

    // Prepare rows
    const frontRowContent = renderZone('CREATURES', zones.CREATURES);

    // Back row zones
    const backRowZones: ZoneType[] = ['LANDS', 'ARTIFACTS', 'ENCHANTMENTS', 'PLANESWALKERS', 'BATTLES', 'OTHER'];
    const backRowContent = (
        <div className="battlefield-row back-row">
            {backRowZones.map(z => renderZone(z, zones[z]))}
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
};
