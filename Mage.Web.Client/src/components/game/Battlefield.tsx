import React, { useState, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PermanentView, PlayerView } from '../../types';
import { useGameStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import { cardImageService, type CardImageFallbackMode } from '../../services/CardImageService';
import {
    areCountersEqual,
    createCombatStateLookup,
    createValidTargetLookup,
    getVisibleStackCards,
} from '../../services/BattlefieldPerformanceService';
import { ManaCost } from '../common/ManaSymbols';
import './GamePage.css';

interface BattlefieldProps {
    player: PlayerView;
    isMe?: boolean;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
    onCardHover?: (cardId: string | null) => void;
}


const ZONE_ORDER = {
    CREATURES: 0,
    LANDS: 0,
    ARTIFACTS: 1,
    ENCHANTMENTS: 2,
    PLANESWALKERS: 3,
    BATTLES: 4,
    OTHER: 5
};

type ZoneType = keyof typeof ZONE_ORDER;
type BattlefieldZoneKey = ZoneType | 'NONLANDS';

const zoneLabels: Record<BattlefieldZoneKey, string> = {
    CREATURES: 'Creatures',
    NONLANDS: 'Nonlands',
    LANDS: 'Lands',
    ARTIFACTS: 'Artifacts',
    ENCHANTMENTS: 'Enchantments',
    PLANESWALKERS: 'Planeswalkers',
    BATTLES: 'Battles',
    OTHER: 'Other',
};

interface StackedGroup {
    key: string;
    cards: PermanentView[];
}

const getBattlefieldSignature = (player: PlayerView): string => {
    const battlefield = player.battlefield ? Object.values(player.battlefield) : [];
    return battlefield
        .map((card) => [
            card.id,
            card.name,
            card.tapped,
            card.transformed,
            card.summoningSickness,
            card.power,
            card.toughness,
            card.loyalty,
            card.defense,
            card.damage,
            card.isToken,
            card.copy,
            card.canAttack,
            card.canBlock,
            card.attachments?.join(',') ?? '',
            card.attachedTo ?? '',
            card.attachedToPermanent,
            card.attachedControllerDiffers,
            card.cardTypes.join(','),
            card.counters
                ? [...card.counters]
                    .sort((first, second) => first.name.localeCompare(second.name))
                    .map((counter) => `${counter.name}:${counter.count}`)
                    .join(',')
                : '',
        ].join(':'))
        .sort()
        .join('|');
};

const areBattlefieldPropsEqual = (prev: BattlefieldProps, next: BattlefieldProps) => {
    return (
        prev.player.playerId === next.player.playerId &&
        prev.isMe === next.isMe &&
        prev.onCardClick === next.onCardClick &&
        prev.onCardInspect === next.onCardInspect &&
        prev.onCardHover === next.onCardHover &&
        getBattlefieldSignature(prev.player) === getBattlefieldSignature(next.player)
    );
};

export const Battlefield: React.FC<BattlefieldProps> = React.memo(({ player, isMe, onCardClick, onCardInspect, onCardHover }) => {
    const permanents = useMemo(
        () => player.battlefield ? Object.values(player.battlefield) : [],
        [player.battlefield]
    );

    // Use shallow selectors to avoid unnecessary re-renders when other parts of store change
    const { pendingAction, combat, selectedCardId } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        combat: state.gameView?.combat,
        selectedCardId: state.selectedCardId,
    })));
    const { battlefieldGrouping, cardImageFallbackMode } = useSettingsStore(useShallow(state => ({
        battlefieldGrouping: state.settings.battlefieldGrouping,
        cardImageFallbackMode: state.settings.cardImageFallbackMode,
    })));

    const [expandedStacks, setExpandedStacks] = useState<Record<string, boolean>>({});
    const isValidTargetByCardId = useMemo(() => createValidTargetLookup(pendingAction), [pendingAction]);
    const combatStateByCardId = useMemo(() => createCombatStateLookup(combat), [combat]);

    const handleCardClick = useCallback((cardId: string) => {
        if (onCardClick) onCardClick(cardId);
    }, [onCardClick]);

    const toggleStack = useCallback((stackKey: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedStacks(prev => ({ ...prev, [stackKey]: !prev[stackKey] }));
    }, []);

    const playableObjectStats = useGameStore(state => state.gameView?.canPlayObjects?.objects);
    const isPlayableByCardId = useMemo(() => {
        const stats = playableObjectStats || {};
        return (cardId: string) => (stats[cardId]?.playableAmount ?? 0) > 0;
    }, [playableObjectStats]);

    // Group cards by configured battlefield preference.
    const zones = useMemo(() => {
        const z: Record<BattlefieldZoneKey, PermanentView[]> = {
            CREATURES: [] as PermanentView[],
            NONLANDS: [] as PermanentView[],
            LANDS: [] as PermanentView[],
            ARTIFACTS: [] as PermanentView[],
            ENCHANTMENTS: [] as PermanentView[],
            PLANESWALKERS: [] as PermanentView[],
            BATTLES: [] as PermanentView[],
            OTHER: [] as PermanentView[],
        };

        const getZoneForPermanent = (perm: PermanentView): BattlefieldZoneKey => {
            if (battlefieldGrouping === 'nonlands') {
                return perm.cardTypes.includes('Land') ? 'LANDS' : 'NONLANDS';
            }

            if (battlefieldGrouping === 'creature-land-other') {
                if (perm.cardTypes.includes('Creature')) return 'CREATURES';
                if (perm.cardTypes.includes('Land')) return 'LANDS';
                return 'OTHER';
            }

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
    }, [battlefieldGrouping, permanents]);

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
                const combatStateKey = combatStateByCardId.get(card.id) ?? '';

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
    }, [zones, combatStateByCardId]);

    // Note: renderCounters moved effectively outside (or to bottom)


    const renderCard = useCallback((
        card: PermanentView,
        index: number,
        total: number,
        isStacked: boolean,
        stackKey: string,
        stackSize: number,
        isStackTop: boolean
    ) => {
        return (
            <BattlefieldCard
                key={card.id}
                card={card}
                index={index}
                total={total}
                isStacked={isStacked}
                stackKey={stackKey}
                stackSize={stackSize}
                isStackTop={isStackTop}
                isStackExpanded={!!expandedStacks[stackKey]}
                combatState={combatStateByCardId.get(card.id) ?? null}
                isValidTarget={isValidTargetByCardId(card.id)}
                isChosenTarget={pendingAction.type === 'target' && selectedCardId === card.id}
                isPlayable={isPlayableByCardId(card.id)}
                cardImageFallbackMode={cardImageFallbackMode}
                onCardClick={handleCardClick}
                onCardInspect={onCardInspect}
                onCardHover={onCardHover}
                onToggleStack={toggleStack}
            />
        );
    }, [cardImageFallbackMode, combatStateByCardId, expandedStacks, handleCardClick, isPlayableByCardId, isValidTargetByCardId, onCardHover, onCardInspect, pendingAction.type, selectedCardId, toggleStack]);

    const renderStack = (stack: StackedGroup) => {
        const isExpanded = expandedStacks[stack.key];

        if (isExpanded) {
            return (
                <div key={stack.key} className="stack-expanded-wrapper">
                    <div className="stack-controls" onClick={(e) => toggleStack(stack.key, e)} title="Collapse">
                        ◀
                    </div>
                    {stack.cards.map((card, i) => renderCard(card, i, stack.cards.length, false, stack.key, stack.cards.length, i === stack.cards.length - 1))}
                </div>
            );
        }

        const visibleCards = getVisibleStackCards(stack.cards, false);

        return (
            <div key={stack.key} className="card-stack" onClick={(e) => {
                if (stack.cards.length > 1) {
                    toggleStack(stack.key, e);
                }
            }}>
                {visibleCards.map((card, i) => renderCard(
                    card,
                    i,
                    visibleCards.length,
                    true,
                    stack.key,
                    stack.cards.length,
                    i === visibleCards.length - 1
                ))}
            </div>
        );
    };

    const renderZone = (zoneKey: BattlefieldZoneKey) => {
        const stacks = zoneStacks[zoneKey];
        if (!stacks || stacks.length === 0) return null;

        return (
            <div className={`battlefield-zone zone-${zoneKey.toLowerCase()}`} key={zoneKey}>
                <div className="battlefield-zone-label">{zoneLabels[zoneKey]}</div>
                {stacks.map(stack => renderStack(stack))}
            </div>
        );
    };

    const rowConfig = battlefieldGrouping === 'nonlands'
        ? { front: ['NONLANDS'] as BattlefieldZoneKey[], back: ['LANDS'] as BattlefieldZoneKey[] }
        : battlefieldGrouping === 'creature-land-other'
            ? { front: ['CREATURES'] as BattlefieldZoneKey[], back: ['LANDS', 'OTHER'] as BattlefieldZoneKey[] }
            : { front: ['CREATURES'] as BattlefieldZoneKey[], back: ['LANDS', 'ARTIFACTS', 'ENCHANTMENTS', 'PLANESWALKERS', 'BATTLES', 'OTHER'] as BattlefieldZoneKey[] };

    const backRowContent = (
        <div className="battlefield-row back-row">
            {rowConfig.back.map(z => renderZone(z))}
        </div>
    );

    const frontRowWrapper = (
        <div className="battlefield-row front-row">
            {rowConfig.front.map(z => renderZone(z))}
        </div>
    );

    return (
        <div className={`battlefield ${isMe ? 'me' : 'opponent'} grouping-${battlefieldGrouping}`}>
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
}, areBattlefieldPropsEqual);


// === SUB-COMPONENTS ===

interface BattlefieldCardProps {
    card: PermanentView;
    index: number;
    total: number;
    isStacked: boolean;
    stackKey: string;
    stackSize: number;
    isStackTop: boolean;
    isStackExpanded: boolean;
    combatState: string | null;
    isValidTarget: boolean;
    isChosenTarget: boolean;
    isPlayable: boolean;
    cardImageFallbackMode: CardImageFallbackMode;
    onCardClick: (id: string) => void;
    onCardInspect?: (id: string) => void;
    onCardHover?: (id: string | null) => void;
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
    if (prev.stackSize !== next.stackSize) return false;
    if (prev.isStackTop !== next.isStackTop) return false;
    if (prev.isStackExpanded !== next.isStackExpanded) return false;
    if (prev.combatState !== next.combatState) return false;
    if (prev.isValidTarget !== next.isValidTarget) return false;
    if (prev.isChosenTarget !== next.isChosenTarget) return false;
    if (prev.isPlayable !== next.isPlayable) return false;
    if (prev.cardImageFallbackMode !== next.cardImageFallbackMode) return false;
    // Callbacks should be stable ref check
    if (prev.onCardClick !== next.onCardClick) return false;
    if (prev.onCardInspect !== next.onCardInspect) return false;
    if (prev.onCardHover !== next.onCardHover) return false;
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
    if (c1.transformed !== c2.transformed) return false;
    if (c1.isToken !== c2.isToken) return false;
    if (c1.copy !== c2.copy) return false;
    if (c1.canAttack !== c2.canAttack) return false;
    if (c1.canBlock !== c2.canBlock) return false;
    if (c1.attachments?.join(',') !== c2.attachments?.join(',')) return false;
    if (c1.attachedTo !== c2.attachedTo) return false;
    if (c1.attachedToPermanent !== c2.attachedToPermanent) return false;
    if (c1.attachedControllerDiffers !== c2.attachedControllerDiffers) return false;

    if (!areCountersEqual(c1.counters, c2.counters)) return false;

    return true;
};

const parseStat = (value: string): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const BattlefieldCard: React.FC<BattlefieldCardProps> = React.memo(({
    card, index, total, isStacked, stackKey, stackSize, isStackTop, isStackExpanded, combatState, isValidTarget, isChosenTarget, isPlayable,
    cardImageFallbackMode, onCardClick, onCardInspect, onCardHover, onToggleStack
}) => {
    const [imageFailed, setImageFailed] = React.useState(false);
    const isCreature = card.cardTypes.includes('Creature');
    const isPlaneswalker = card.cardTypes.includes('Planeswalker');
    const isBattle = card.cardTypes.includes('Battle');
    const attachmentCount = card.attachments?.length ?? 0;
    const toughness = parseStat(card.toughness);
    const remainingToughness = toughness === null ? null : Math.max(0, toughness - (card.damage || 0));
    const manaCost = card.manaCostRightStr?.length ? card.manaCostRightStr : card.manaCostLeftStr;

    const style: React.CSSProperties = isStacked ? {
        marginTop: `${index * -110}px`, // Large negative margin for tight overlap
        marginLeft: `${index * 0}px`,
        zIndex: index,
        position: 'relative' // relative flow but overlapped
    } : {};

    const handleClick = (e: React.MouseEvent) => {
        if (isStacked && !isStackTop && !isStackExpanded) {
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
            className={`permanent ${card.tapped ? 'tapped' : ''} ${card.isAbility ? 'ability' : ''} ${combatState ? combatState : ''} ${isValidTarget ? 'valid-target' : ''} ${isChosenTarget ? 'chosen-target' : ''} ${isPlayable ? 'playable-permanent' : ''}`}
            style={isStacked && index > 0 ? style : { zIndex: index }}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => onCardHover?.(card.id)}
            onMouseLeave={() => onCardHover?.(null)}
        >
            <img
                src={cardImageService.getImageUrl(card)}
                alt={card.name}
                data-id={card.id}
                onError={(e) => {
                    setImageFailed(true);
                    e.currentTarget.src = cardImageService.getFallbackImageUrl(card, cardImageFallbackMode);
                }}
            />

            {imageFailed && card.isToken && (
                <div className="token-card-face">
                    <span>{card.name}</span>
                    {isCreature && <strong>{card.power}/{card.toughness}</strong>}
                </div>
            )}

            {manaCost && (
                <div className="permanent-mana-cost">
                    <ManaCost cost={manaCost} size="sm" />
                </div>
            )}

            <div className="card-status-overlay">
                {card.isToken && (
                    <div className="status-icon token" title="Token">T</div>
                )}
                {card.copy && (
                    <div className="status-icon copy" title="Copy">C</div>
                )}
                {card.isDoubleFacedCard && (
                    <div className="status-icon double-faced" title="Double-faced card">{card.transformed ? 'B' : 'F'}</div>
                )}
                {isPlayable && (
                    <div className="status-icon playable" title="Playable or activatable">P</div>
                )}
                {isValidTarget && (
                    <div
                        className={`status-icon target ${isChosenTarget ? 'chosen' : ''}`}
                        title={isChosenTarget ? 'Chosen target' : 'Valid target'}
                        data-testid={isChosenTarget ? 'battlefield-chosen-target-badge' : 'battlefield-valid-target-badge'}
                    >
                        {isChosenTarget ? 'C' : 'T'}
                    </div>
                )}
                {card.canAttack && (
                    <div className="status-icon can-attack" title="Can attack">A</div>
                )}
                {card.canBlock && (
                    <div className="status-icon can-block" title="Can block">B</div>
                )}
                {card.summoningSickness && (
                    <div className="status-icon sickness" title="Summoning sickness">S</div>
                )}
                {combatState === 'attacking' && (
                    <div className="status-icon attacking" title="Attacking">AT</div>
                )}
                {combatState === 'blocking' && (
                    <div className="status-icon blocking" title="Blocking">BL</div>
                )}
                {attachmentCount > 0 && (
                    <div className="status-icon attachment" title={`${attachmentCount} attached cards`}>{attachmentCount}</div>
                )}
                {card.attachedToPermanent && (
                    <div className="status-icon attached" title="Attached to another permanent">L</div>
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
            {isCreature && card.damage > 0 && remainingToughness !== null && (
                <div className={`life-total-badge ${remainingToughness <= 0 ? 'lethal' : ''}`} title="Remaining toughness before cleanup">
                    {remainingToughness}
                </div>
            )}
            {isPlaneswalker && card.loyalty !== "" && (
                <div className="loyalty-badge">{card.loyalty}</div>
            )}
            {isBattle && card.defense !== "" && (
                <div className="defense-badge">{card.defense}</div>
            )}

            {/* Stack Count Badge (only on top (last) card of collapsed stack) */}
            {isStacked && isStackTop && !isStackExpanded && stackSize > 1 && (
                <div className="stack-count" onClick={(e) => onToggleStack(stackKey, e)}>
                    {stackSize}
                </div>
            )}
        </div>
    );
}, arePropsEqual);
