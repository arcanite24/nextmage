import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Copy, Eye, Layers3, RotateCwSquare } from 'lucide-react';
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
import {
    buildBattlefieldLayout,
    createBattlefieldSignature,
    hasCardType,
    type BattlefieldAttachment,
    type BattlefieldStackGroup,
    type BattlefieldZone,
} from '../../services/BattlefieldLayoutService';
import {
    createBattlefieldFeedbackSnapshot,
    diffBattlefieldFeedbackSnapshots,
    type BattlefieldFeedbackEvent,
    type BattlefieldFeedbackKind,
    type BattlefieldFeedbackSnapshot,
} from '../../services/BattlefieldFeedbackService';
import {
    createCardIconSignature,
    normalizeCardIcons,
} from '../../services/CardIconService';
import { ManaCost } from '../common/ManaSymbols';
import './GamePage.css';

interface BattlefieldProps {
    player: PlayerView;
    isMe?: boolean;
    onCardClick?: (cardId: string, options?: BattlefieldCardClickOptions) => void;
    onCardInspect?: (cardId: string, mode?: BattlefieldInspectMode) => void;
    onCardHover?: (cardId: string | null) => void;
}

export type BattlefieldInspectMode = 'normal' | 'alternate' | 'copy' | 'mutate';

export interface BattlefieldCardClickOptions {
    holdPriority?: boolean;
}

const SINGLE_CLICK_DELAY_MS = 220;

interface BattlefieldEventMessage {
    id: string;
    kind: 'left' | 'died';
    text: string;
}

function isDepartureFeedbackEvent(event: BattlefieldFeedbackEvent): event is BattlefieldFeedbackEvent & { kind: 'left' | 'died' } {
    return event.kind === 'left' || event.kind === 'died';
}

const areBattlefieldPropsEqual = (prev: BattlefieldProps, next: BattlefieldProps) => {
    return (
        prev.player.playerId === next.player.playerId &&
        prev.isMe === next.isMe &&
        prev.onCardClick === next.onCardClick &&
        prev.onCardInspect === next.onCardInspect &&
        prev.onCardHover === next.onCardHover &&
        createBattlefieldSignature(prev.player) === createBattlefieldSignature(next.player)
    );
};

export const Battlefield: React.FC<BattlefieldProps> = React.memo(({ player, isMe, onCardClick, onCardInspect, onCardHover }) => {
    // Use shallow selectors to avoid unnecessary re-renders when other parts of store change
    const { pendingAction, combat, selectedCardId } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        combat: state.gameView?.combat,
        selectedCardId: state.selectedCardId,
    })));
    const { battlefieldGrouping, battlefieldCardSize, cardImageFallbackMode, animationsEnabled, animationSpeed } = useSettingsStore(useShallow(state => ({
        battlefieldGrouping: state.settings.battlefieldGrouping,
        battlefieldCardSize: state.settings.battlefieldCardSize,
        cardImageFallbackMode: state.settings.cardImageFallbackMode,
        animationsEnabled: state.settings.animationsEnabled,
        animationSpeed: state.settings.animationSpeed,
    })));

    const [expandedStacks, setExpandedStacks] = useState<Record<string, boolean>>({});
    const [feedbackByCardId, setFeedbackByCardId] = useState<Record<string, BattlefieldFeedbackKind>>({});
    const [eventMessages, setEventMessages] = useState<BattlefieldEventMessage[]>([]);
    const previousFeedbackSnapshotRef = useRef<BattlefieldFeedbackSnapshot | null>(null);
    const feedbackTimersRef = useRef<Record<string, number>>({});
    const eventTimersRef = useRef<Record<string, number>>({});
    const isValidTargetByCardId = useMemo(() => createValidTargetLookup(pendingAction), [pendingAction]);
    const combatStateByCardId = useMemo(() => createCombatStateLookup(combat), [combat]);

    const handleCardClick = useCallback((cardId: string, options?: BattlefieldCardClickOptions) => {
        if (onCardClick) onCardClick(cardId, options);
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

    const layout = useMemo(
        () => buildBattlefieldLayout(player, battlefieldGrouping),
        [battlefieldGrouping, player]
    );
    const feedbackDurationMs = Math.round(760 / Math.max(0.5, Math.min(animationSpeed, 2)));
    const battlefieldStyle = {
        '--battlefield-feedback-duration': `${feedbackDurationMs}ms`,
        '--battlefield-card-size-scale': String(battlefieldCardSize / 14),
    } as React.CSSProperties;

    useEffect(() => {
        const currentSnapshot = createBattlefieldFeedbackSnapshot(player, combatStateByCardId);
        const previousSnapshot = previousFeedbackSnapshotRef.current;
        previousFeedbackSnapshotRef.current = currentSnapshot;

        if (!animationsEnabled || !previousSnapshot) {
            return;
        }

        const events = diffBattlefieldFeedbackSnapshots(previousSnapshot, currentSnapshot);
        if (events.length === 0) {
            return;
        }

        const currentCardEvents = events.filter(event => !isDepartureFeedbackEvent(event) && currentSnapshot[event.cardId]);
        const departingEvents = events.filter(isDepartureFeedbackEvent);

        if (currentCardEvents.length > 0) {
            setFeedbackByCardId(previous => {
                const next = { ...previous };
                for (const event of currentCardEvents) {
                    next[event.cardId] = event.kind;
                }
                return next;
            });
        }

        if (departingEvents.length > 0) {
            const messages = departingEvents.map(event => ({
                id: `${event.cardId}:${event.kind}:${Date.now()}`,
                kind: event.kind,
                text: formatBattlefieldEventMessage(event),
            }));

            setEventMessages(previous => [...previous, ...messages].slice(-3));

            for (const message of messages) {
                eventTimersRef.current[message.id] = window.setTimeout(() => {
                    setEventMessages(previous => previous.filter(item => item.id !== message.id));
                    delete eventTimersRef.current[message.id];
                }, feedbackDurationMs * 2);
            }
        }

        for (const event of currentCardEvents) {
            if (feedbackTimersRef.current[event.cardId]) {
                window.clearTimeout(feedbackTimersRef.current[event.cardId]);
            }
            feedbackTimersRef.current[event.cardId] = window.setTimeout(() => {
                setFeedbackByCardId(previous => {
                    if (previous[event.cardId] !== event.kind) {
                        return previous;
                    }
                    const next = { ...previous };
                    delete next[event.cardId];
                    return next;
                });
                delete feedbackTimersRef.current[event.cardId];
            }, feedbackDurationMs);
        }
    }, [animationsEnabled, combatStateByCardId, feedbackDurationMs, player]);

    useEffect(() => {
        if (animationsEnabled) {
            return;
        }
        Object.values(feedbackTimersRef.current).forEach(timerId => window.clearTimeout(timerId));
        Object.values(eventTimersRef.current).forEach(timerId => window.clearTimeout(timerId));
        feedbackTimersRef.current = {};
        eventTimersRef.current = {};
        setFeedbackByCardId({});
        setEventMessages([]);
    }, [animationsEnabled]);

    useEffect(() => {
        return () => {
            Object.values(feedbackTimersRef.current).forEach(timerId => window.clearTimeout(timerId));
            Object.values(eventTimersRef.current).forEach(timerId => window.clearTimeout(timerId));
        };
    }, []);

    const renderCard = useCallback((
        card: PermanentView,
        index: number,
        total: number,
        isStacked: boolean,
        stackKey: string,
        stackSize: number,
        isStackTop: boolean,
        attachment?: BattlefieldAttachment,
        isAttachmentHost = false
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
                isAttachedCard={!!attachment}
                isAttachmentHost={isAttachmentHost}
                attachmentDepth={attachment?.depth ?? 0}
                feedbackKind={feedbackByCardId[card.id] ?? null}
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
    }, [cardImageFallbackMode, combatStateByCardId, expandedStacks, feedbackByCardId, handleCardClick, isPlayableByCardId, isValidTargetByCardId, onCardHover, onCardInspect, pendingAction.type, selectedCardId, toggleStack]);

    const renderAttachments = (stack: BattlefieldStackGroup) => {
        if (stack.attachedCards.length === 0) return null;

        return (
            <div
                className={`battlefield-attachments ${stack.hasControllerMismatch ? 'controller-mismatch' : ''}`}
                data-testid="battlefield-attachments"
                data-attachment-count={stack.attachmentCount}
                data-attachment-columns={stack.attachmentColumns}
            >
                {stack.attachedCards.map((attachment, index) => renderCard(
                    attachment.card,
                    index,
                    stack.attachedCards.length,
                    false,
                    `${stack.key}:attachments`,
                    stack.attachedCards.length,
                    true,
                    attachment
                ))}
            </div>
        );
    };

    const renderStack = (stack: BattlefieldStackGroup) => {
        const isExpanded = expandedStacks[stack.key];
        const stackStyle = {
            '--attachment-columns': stack.attachmentColumns,
        } as React.CSSProperties;
        const stackClassName = [
            'card-stack',
            isExpanded ? 'expanded' : '',
            stack.attachmentCount > 0 ? 'has-attachments' : '',
            stack.hasControllerMismatch ? 'controller-mismatch' : '',
        ].filter(Boolean).join(' ');

        if (isExpanded) {
            return (
                <div
                    key={stack.key}
                    className={`stack-expanded-wrapper ${stackClassName}`}
                    style={stackStyle}
                    data-stack-size={stack.cards.length}
                    data-attachment-count={stack.attachmentCount}
                >
                    <button className="stack-controls" onClick={(e) => toggleStack(stack.key, e)} title="Collapse" aria-label="Collapse stack">
                        &lt;
                    </button>
                    <div className="stack-expanded-cards">
                        {stack.cards.map((card, i) => renderCard(
                            card,
                            i,
                            stack.cards.length,
                            false,
                            stack.key,
                            stack.cards.length,
                            i === stack.cards.length - 1,
                            undefined,
                            stack.attachmentCount > 0
                        ))}
                    </div>
                    {renderAttachments(stack)}
                </div>
            );
        }

        const visibleCards = getVisibleStackCards(stack.cards, false);

        return (
            <div
                key={stack.key}
                className={stackClassName}
                style={stackStyle}
                onClick={(e) => {
                    if (stack.cards.length > 1) {
                        toggleStack(stack.key, e);
                    }
                }}
                data-stack-size={stack.cards.length}
                data-attachment-count={stack.attachmentCount}
            >
                {visibleCards.map((card, i) => renderCard(
                    card,
                    i,
                    visibleCards.length,
                    true,
                    stack.key,
                    stack.cards.length,
                    i === visibleCards.length - 1,
                    undefined,
                    stack.attachmentCount > 0
                ))}
                {renderAttachments(stack)}
            </div>
        );
    };

    const renderZone = (zone: BattlefieldZone) => {
        return (
            <div
                className={`battlefield-zone zone-${zone.zoneKey.toLowerCase()} align-${zone.alignment} ${zone.startsAlignmentGroup ? 'starts-alignment-group' : ''}`}
                key={zone.zoneKey}
                data-zone-key={zone.zoneKey}
                data-zone-alignment={zone.alignment}
                data-zone-starts-alignment-group={zone.startsAlignmentGroup ? 'true' : 'false'}
                data-stack-count={zone.stacks.length}
            >
                <div className="battlefield-zone-label">{zone.label}</div>
                {zone.stacks.map(stack => renderStack(stack))}
            </div>
        );
    };

    const rows = isMe ? layout.rows : [...layout.rows].reverse();

    return (
        <div
            className={`battlefield ${isMe ? 'me' : 'opponent'} grouping-${battlefieldGrouping}`}
            style={battlefieldStyle}
            data-testid="battlefield"
            data-player-id={player.playerId}
            data-battlefield-card-size={battlefieldCardSize}
            data-visible-permanent-count={layout.visiblePermanentCount}
            data-hidden-phased-count={layout.hiddenPhasedCount}
            data-root-permanent-count={layout.rootPermanentCount}
            data-attached-permanent-count={layout.attachedPermanentCount}
        >
            {rows.map(row => (
                <div
                    className={`battlefield-row ${row.role}-row`}
                    key={row.key}
                    data-row-role={row.role}
                    data-zone-count={row.zones.length}
                >
                    {row.zones.map(renderZone)}
                </div>
            ))}
            {eventMessages.length > 0 && (
                <div className="battlefield-event-feed" role="status" aria-live="polite">
                    {eventMessages.map(message => (
                        <div
                            key={message.id}
                            className={`battlefield-event-message event-${message.kind}`}
                            data-testid="battlefield-event-message"
                            data-event-kind={message.kind}
                        >
                            {message.text}
                        </div>
                    ))}
                </div>
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
    isAttachedCard: boolean;
    isAttachmentHost: boolean;
    attachmentDepth: number;
    feedbackKind: BattlefieldFeedbackKind | null;
    combatState: string | null;
    isValidTarget: boolean;
    isChosenTarget: boolean;
    isPlayable: boolean;
    cardImageFallbackMode: CardImageFallbackMode;
    onCardClick: (id: string, options?: BattlefieldCardClickOptions) => void;
    onCardInspect?: (id: string, mode?: BattlefieldInspectMode) => void;
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

const getMutateViewSignature = (card: PermanentView): string => {
    if (!card.mutateView) return '';
    return Object.entries(card.mutateView)
        .filter(([key, value]) => key !== 'id' && key !== 'name' && typeof value === 'object' && value !== null)
        .map(([key, value]) => `${key}:${(value as { name?: unknown }).name ?? ''}`)
        .sort()
        .join('|');
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
    if (prev.isAttachedCard !== next.isAttachedCard) return false;
    if (prev.isAttachmentHost !== next.isAttachmentHost) return false;
    if (prev.attachmentDepth !== next.attachmentDepth) return false;
    if (prev.feedbackKind !== next.feedbackKind) return false;
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
    if (c1.displayName !== c2.displayName) return false;
    if (c1.tapped !== c2.tapped) return false;
    if (c1.flipped !== c2.flipped) return false;
    if (c1.phasedIn !== c2.phasedIn) return false;
    if (c1.faceDown !== c2.faceDown) return false;
    if (c1.morphed !== c2.morphed) return false;
    if (c1.manifested !== c2.manifested) return false;
    if (c1.disguised !== c2.disguised) return false;
    if (c1.cloaked !== c2.cloaked) return false;
    if (c1.mutated !== c2.mutated) return false;
    if (c1.summoningSickness !== c2.summoningSickness) return false;
    if (c1.power !== c2.power) return false;
    if (c1.toughness !== c2.toughness) return false;
    if (c1.loyalty !== c2.loyalty) return false;
    if (c1.defense !== c2.defense) return false;
    if (c1.damage !== c2.damage) return false;
    if (c1.transformed !== c2.transformed) return false;
    if (c1.isToken !== c2.isToken) return false;
    if (c1.copy !== c2.copy) return false;
    if (c1.isSelected !== c2.isSelected) return false;
    if (c1.isChoosable !== c2.isChoosable) return false;
    if ((c1.playableStats?.playableAmount ?? 0) !== (c2.playableStats?.playableAmount ?? 0)) return false;
    if (c1.nameOwner !== c2.nameOwner) return false;
    if (c1.nameController !== c2.nameController) return false;
    if (c1.canAttack !== c2.canAttack) return false;
    if (c1.canBlock !== c2.canBlock) return false;
    if (c1.attachments?.join(',') !== c2.attachments?.join(',')) return false;
    if (c1.attachedTo !== c2.attachedTo) return false;
    if (c1.attachedToPermanent !== c2.attachedToPermanent) return false;
    if (c1.attachedControllerDiffers !== c2.attachedControllerDiffers) return false;
    if (c1.cardTypes.join(',') !== c2.cardTypes.join(',')) return false;
    if (c1.subTypes.join(',') !== c2.subTypes.join(',')) return false;
    if (c1.rules.join('\n') !== c2.rules.join('\n')) return false;
    if (createCardIconSignature(c1.cardIcons) !== createCardIconSignature(c2.cardIcons)) return false;
    if (c1.original?.id !== c2.original?.id) return false;
    if (c1.original?.name !== c2.original?.name) return false;
    if (getMutateViewSignature(c1) !== getMutateViewSignature(c2)) return false;

    if (!areCountersEqual(c1.counters, c2.counters)) return false;

    return true;
};

const parseStat = (value: string): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getFaceDownStatus = (card: PermanentView): { label: string; code: string } | null => {
    if (card.morphed) return { label: 'Morph', code: 'Mo' };
    if (card.manifested) return { label: 'Manifest', code: 'Mf' };
    if (card.disguised) return { label: 'Disguise', code: 'Dg' };
    if (card.cloaked) return { label: 'Cloak', code: 'Cl' };
    if (card.faceDown) return { label: 'Face down', code: 'FD' };
    return null;
};

const formatBattlefieldEventMessage = (event: BattlefieldFeedbackEvent): string => {
    if (event.kind === 'died') {
        return `${event.cardName} died`;
    }
    return `${event.cardName} left`;
};

const hasMutateCards = (card: PermanentView): boolean => {
    if (card.mutated) return true;
    if (!card.mutateView) return false;
    return Object.entries(card.mutateView)
        .some(([key, value]) => key !== 'id' && key !== 'name' && typeof value === 'object' && value !== null);
};

const getWheelInspectMode = (card: PermanentView, deltaY: number): BattlefieldInspectMode => {
    if (deltaY < 0) {
        return 'normal';
    }

    if (card.copy && card.original) {
        return 'copy';
    }

    if (hasMutateCards(card)) {
        return 'mutate';
    }

    if (card.isDoubleFacedCard || card.secondCardFace || card.transformable || card.alternateName) {
        return 'alternate';
    }

    return 'normal';
};

const BattlefieldCard: React.FC<BattlefieldCardProps> = React.memo(({
    card, index, total, isStacked, stackKey, stackSize, isStackTop, isStackExpanded, isAttachedCard, isAttachmentHost, attachmentDepth, feedbackKind, combatState, isValidTarget, isChosenTarget, isPlayable,
    cardImageFallbackMode, onCardClick, onCardInspect, onCardHover, onToggleStack
}) => {
    const [imageFailed, setImageFailed] = React.useState(false);
    const clickTimerRef = useRef<number | null>(null);
    const isCreature = hasCardType(card, 'Creature');
    const isPlaneswalker = hasCardType(card, 'Planeswalker');
    const isBattle = hasCardType(card, 'Battle');
    const attachmentCount = card.attachments?.length ?? 0;
    const toughness = parseStat(card.toughness);
    const remainingToughness = toughness === null ? null : Math.max(0, toughness - (card.damage || 0));
    const manaCost = card.manaCostRightStr?.length ? card.manaCostRightStr : card.manaCostLeftStr;
    const faceDownStatus = getFaceDownStatus(card);
    const cardIcons = normalizeCardIcons(card.cardIcons);
    const visibleCardIcons = cardIcons.slice(0, 4);
    const hiddenCardIconCount = Math.max(0, cardIcons.length - visibleCardIcons.length);
    const copyTitle = card.original?.name ? `Copy of ${card.original.name}` : 'Copy';
    const isMutated = hasMutateCards(card);
    const hasAlternateInspect = card.isDoubleFacedCard || card.secondCardFace || card.transformable || card.alternateName;
    const isServerSelected = card.isSelected === true;
    const isServerChoosable = card.isChoosable === true;
    const playableAmount = Math.max(card.playableStats?.playableAmount ?? 0, isPlayable ? 1 : 0);
    const isPlayableState = playableAmount > 0;
    const className = [
        'permanent',
        card.tapped ? 'tapped' : '',
        card.flipped ? 'flipped' : '',
        card.isAbility ? 'ability' : '',
        isMutated ? 'mutated' : '',
        isStacked ? 'stacked-card' : '',
        isAttachedCard ? 'attached-card' : '',
        isAttachmentHost ? 'attachment-host' : '',
        card.attachedControllerDiffers ? 'controller-mismatch' : '',
        feedbackKind ? `battlefield-feedback-${feedbackKind}` : '',
        faceDownStatus ? 'face-down' : '',
        combatState ? combatState : '',
        isValidTarget ? 'valid-target' : '',
        isChosenTarget ? 'chosen-target' : '',
        isServerSelected ? 'selected-permanent' : '',
        isServerChoosable ? 'choosable-permanent' : '',
        isPlayableState ? 'playable-permanent' : '',
    ].filter(Boolean).join(' ');
    const style = {
        zIndex: isAttachmentHost ? 80 + index : isAttachedCard ? Math.max(20, 44 - attachmentDepth - index) : index,
        marginLeft: isAttachedCard ? `${Math.max(0, attachmentDepth - 1) * 10}px` : undefined,
        '--stack-index': isStacked ? index : 0,
        '--attachment-depth': attachmentDepth,
    } as React.CSSProperties;

    useEffect(() => {
        return () => {
            if (clickTimerRef.current !== null) {
                window.clearTimeout(clickTimerRef.current);
            }
        };
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest('button')) {
            return;
        }

        if (isStacked && !isStackTop && !isStackExpanded) {
            onToggleStack(stackKey, e);
            return;
        }

        if (clickTimerRef.current !== null) {
            window.clearTimeout(clickTimerRef.current);
        }

        const holdPriority = e.ctrlKey || e.metaKey;
        clickTimerRef.current = window.setTimeout(() => {
            onCardClick(card.id, { holdPriority });
            clickTimerRef.current = null;
        }, SINGLE_CLICK_DELAY_MS);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimerRef.current !== null) {
            window.clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
        onCardInspect?.(card.id, 'normal');
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onCardInspect) onCardInspect(card.id, 'normal');
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!onCardInspect) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        onCardInspect(card.id, getWheelInspectMode(card, e.deltaY));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') {
            return;
        }
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            onCardClick(card.id, { holdPriority: true });
            return;
        }
        onCardClick(card.id);
    };

    const inspectMode = (mode: BattlefieldInspectMode) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onCardInspect?.(card.id, mode);
    };
    const cardSource = [card.expansionSetCode, card.cardNumber].filter(Boolean).join(' #');

    return (
        <div
            id={`card-${card.id}`}
            className={className}
            style={style}
            role="button"
            tabIndex={0}
            aria-label={`${card.name}${isAttachedCard ? ' attached permanent' : ''}${total > 1 ? ` ${index + 1} of ${total}` : ''}`}
            data-testid="battlefield-card"
            data-card-id={card.id}
            data-card-name={card.name}
            data-stack-key={stackKey}
            data-stack-size={stackSize}
            data-flipped-state={card.flipped ? 'true' : 'false'}
            data-transformed-state={card.transformed ? 'true' : 'false'}
            data-attached-card={isAttachedCard ? 'true' : 'false'}
            data-attachment-host={isAttachmentHost ? 'true' : 'false'}
            data-attachment-depth={attachmentDepth}
            data-face-down-state={faceDownStatus?.label ?? ''}
            data-controller-differs={card.attachedControllerDiffers ? 'true' : 'false'}
            data-mutated={isMutated ? 'true' : 'false'}
            data-feedback-kind={feedbackKind ?? ''}
            data-selected-state={isServerSelected ? 'true' : 'false'}
            data-choosable-state={isServerChoosable ? 'true' : 'false'}
            data-playable-amount={playableAmount}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
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

            <div className="permanent-card-name" aria-hidden="true">{card.name}</div>
            {cardSource && (
                <div className="permanent-card-source" aria-hidden="true">{cardSource}</div>
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
                    <div className="status-icon copy" title={copyTitle}>C</div>
                )}
                {isMutated && (
                    <div className="status-icon mutated" title="Mutated">Mu</div>
                )}
                {card.isDoubleFacedCard && (
                    <div className="status-icon double-faced" title="Double-faced card" data-testid="battlefield-double-faced-badge">{card.transformed ? 'B' : 'F'}</div>
                )}
                {card.flipped && (
                    <div className="status-icon flipped" title="Flipped" data-testid="battlefield-flipped-badge">FL</div>
                )}
                {faceDownStatus && (
                    <div className="status-icon face-down" title={faceDownStatus.label} data-testid="battlefield-facedown-badge">{faceDownStatus.code}</div>
                )}
                {visibleCardIcons.map(icon => (
                    <div
                        key={icon.key}
                        className={`status-icon card-icon-chip card-icon-${icon.category}`}
                        title={icon.title}
                        aria-label={icon.title}
                        data-testid="battlefield-card-icon"
                        data-card-icon-type={icon.type}
                        data-card-icon-category={icon.category}
                    >
                        {icon.label}
                    </div>
                ))}
                {hiddenCardIconCount > 0 && (
                    <div
                        className="status-icon card-icon-chip card-icon-system"
                        title={`${hiddenCardIconCount} additional card icons`}
                        aria-label={`${hiddenCardIconCount} additional card icons`}
                        data-testid="battlefield-card-icon-overflow"
                    >
                        +{hiddenCardIconCount}
                    </div>
                )}
                {isServerSelected && !isChosenTarget && (
                    <div className="status-icon selected" title="Selected" data-testid="battlefield-selected-badge">Sel</div>
                )}
                {isServerChoosable && !isValidTarget && (
                    <div className="status-icon choosable" title="Choosable" data-testid="battlefield-choosable-badge">Ch</div>
                )}
                {isPlayableState && (
                    <div
                        className="status-icon playable"
                        title={playableAmount > 1 ? `${playableAmount} playable actions` : 'Playable or activatable'}
                        data-testid="battlefield-playable-badge"
                    >
                        {playableAmount > 1 ? `P${playableAmount}` : 'P'}
                    </div>
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

            <div className="permanent-action-strip" aria-label="Card inspection actions">
                <button
                    type="button"
                    className="permanent-action-button"
                    title="Inspect card"
                    aria-label={`Inspect ${card.name}`}
                    onClick={inspectMode('normal')}
                    data-testid="battlefield-inspect-button"
                >
                    <Eye size={12} aria-hidden="true" />
                </button>
                {hasAlternateInspect && (
                    <button
                        type="button"
                        className="permanent-action-button"
                        title="Inspect alternate face"
                        aria-label={`Inspect alternate face of ${card.name}`}
                        onClick={inspectMode('alternate')}
                        data-testid="battlefield-alternate-button"
                    >
                        <RotateCwSquare size={12} aria-hidden="true" />
                    </button>
                )}
                {card.copy && card.original && (
                    <button
                        type="button"
                        className="permanent-action-button"
                        title={copyTitle}
                        aria-label={copyTitle}
                        onClick={inspectMode('copy')}
                        data-testid="battlefield-copy-source-button"
                    >
                        <Copy size={12} aria-hidden="true" />
                    </button>
                )}
                {isMutated && (
                    <button
                        type="button"
                        className="permanent-action-button"
                        title="Inspect mutate stack"
                        aria-label={`Inspect mutate stack for ${card.name}`}
                        onClick={inspectMode('mutate')}
                        data-testid="battlefield-mutate-button"
                    >
                        <Layers3 size={12} aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Stack Count Badge (only on top (last) card of collapsed stack) */}
            {isStacked && isStackTop && !isStackExpanded && stackSize > 1 && (
                <div className="stack-count" onClick={(e) => onToggleStack(stackKey, e)}>
                    {stackSize}
                </div>
            )}
        </div>
    );
}, arePropsEqual);
