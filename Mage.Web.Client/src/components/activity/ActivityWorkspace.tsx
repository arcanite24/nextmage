import React from 'react';
import { useActivityStore, useSessionStore } from '../../stores';
import type { ClientActivity, DraftPickPayload } from '../../stores/activityStore';
import { getActivityKindLabel, getActivityDestination } from '../../services/ActivityShellService';
import { moveDeckCard, setDeckCardAmount, type DeckCardZone } from '../../services/DeckCardListService';
import {
    appConfigService,
    createEmptyBasicLandCounts,
    deckLandsService,
    webSocketBridgeService,
    defaultAddLandsDeckSize,
    DEFAULT_DECK_EDITOR_CONFIG,
    type AddBasicLandsOptions,
    type BasicLandCounts,
} from '../../services';
import type {
    DeckEditorConfig,
    DeckEditorModeConfig,
    DeckEditorModeKey,
    DeckListSortKey,
    DeckSortDirection,
} from '../../services/AppConfigService';
import type { DeckCardInfo, DeckCardLists } from '../../types';
import { DeckAddLandsDialog } from '../deck/DeckAddLandsDialog';
import { AddLandsResultDetails, type AddLandsResultDetailsData } from '../deck/AddLandsResultDetails';
import { DeckAnalyticsPanel } from '../deck/DeckAnalyticsPanel';
import { DeckLegalityPanel } from '../deck/DeckLegalityPanel';
import { CardPreviewModal } from '../game/CardPreviewModal';
import './ActivityWorkspace.css';

interface ActivityWorkspaceProps {
    activity: ClientActivity | null;
    activities: ClientActivity[];
    onOpenDecks: () => void;
    onOpenGame: (gameId: string) => void;
    onOpenLobby: () => void;
    onOpenSettings: () => void;
    onOpenDebug: () => void;
    onSubmitDeck?: (tableId: string, deck: DeckCardLists) => Promise<boolean>;
    onOpenDeckEditor?: (
        deck: DeckCardLists,
        mode: DeckEditorModeKey,
        title: string,
        activityContext?: { kind: ClientActivity['kind']; tableId?: string; limitedSideboard?: boolean },
    ) => void;
}

function formatActivityTime(timestamp: number): string {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(activity: ClientActivity): string {
    if (activity.status === 'completed') return 'Completed';
    if (activity.status === 'waiting') return 'Waiting';
    return 'Active';
}

interface ActivityCommand {
    key: string;
    label: string;
    testId: string;
    reason: string;
}

interface ActivityDeckRowDragData {
    card: DeckCardInfo;
    sourceZone: DeckCardZone;
}

type ActivityDeckSelectionSource = 'legality' | 'analytics' | null;

const ACTIVITY_DECK_ROW_DRAG_MIME = 'application/x-mage-activity-deck-row';
const ACTIVITY_DECK_ROW_CLICK_COMMIT_DELAY_MS = 220;

function activityCommands(activity: ClientActivity | null): ActivityCommand[] {
    switch (activity?.kind) {
        case 'replay':
            return [
                { key: 'previous', label: 'Previous', testId: 'replay-previous-button', reason: 'Replay controls need a replay payload before they can run.' },
                { key: 'next', label: 'Next', testId: 'replay-next-button', reason: 'Replay controls need a replay payload before they can run.' },
                { key: 'skip-forward', label: 'Skip Forward', testId: 'replay-skip-forward-button', reason: 'Replay controls need a replay payload before they can run.' },
                { key: 'autoplay', label: 'Autoplay', testId: 'replay-autoplay-button', reason: 'Replay controls need a replay payload before they can run.' },
                { key: 'stop', label: 'Stop Replay', testId: 'replay-stop-button', reason: 'Replay controls need a replay payload before they can run.' },
            ];
        case 'tournament':
            return [
                { key: 'join', label: 'Join Event', testId: 'tournament-join-button', reason: 'Tournament actions need an attached tournament session.' },
                { key: 'watch', label: 'Watch Event', testId: 'tournament-watch-button', reason: 'Tournament actions need an attached tournament session.' },
                { key: 'quit', label: 'Quit Event', testId: 'tournament-quit-button', reason: 'Tournament actions need an attached tournament session.' },
            ];
        case 'draft':
            return [
                { key: 'pick', label: 'Pick Card', testId: 'draft-pick-button', reason: 'Draft actions need an active booster payload.' },
                { key: 'mark', label: 'Mark Card', testId: 'draft-mark-button', reason: 'Draft actions need an active booster payload.' },
                { key: 'booster-loaded', label: 'Booster Loaded', testId: 'draft-booster-loaded-button', reason: 'Draft actions need an active booster payload.' },
                { key: 'quit', label: 'Quit Draft', testId: 'draft-quit-button', reason: 'Draft actions need an active booster payload.' },
            ];
        case 'sideboard':
            return activity.limitedSideboard ? [
                { key: 'submit-sideboard', label: 'Submit Sideboard', testId: 'sideboard-submit-deck-button', reason: 'Sideboard actions need a deck payload.' },
                { key: 'reset-sideboard', label: 'Reset', testId: 'sideboard-reset-button', reason: 'Sideboard actions need a deck payload.' },
                { key: 'add-lands', label: 'Add Lands', testId: 'sideboard-add-lands-button', reason: 'Limited sideboarding needs a deck payload.' },
            ] : [
                { key: 'submit-sideboard', label: 'Submit Sideboard', testId: 'sideboard-submit-deck-button', reason: 'Sideboard actions need a deck payload.' },
                { key: 'reset-sideboard', label: 'Reset', testId: 'sideboard-reset-button', reason: 'Sideboard actions need a deck payload.' },
            ];
        case 'construction':
            return [
                { key: 'submit-deck', label: 'Submit Deck', testId: 'construction-submit-deck-button', reason: 'Construction actions need a limited deck payload.' },
                { key: 'add-lands', label: 'Add Lands', testId: 'construction-add-lands-button', reason: 'Construction actions need a limited deck payload.' },
            ];
        default:
            return [];
    }
}

function countDeckCards(cards: DeckCardLists['cards']): number {
    return cards.reduce((sum, card) => sum + card.amount, 0);
}

function normalizeSelectedDeckCardName(cardName: string): string {
    return cardName.trim().toLocaleLowerCase();
}

function collectDeckCardNameSet(deck: DeckCardLists | null): Set<string> {
    const names = new Set<string>();
    for (const card of deck?.cards ?? []) {
        if (card.amount > 0) names.add(normalizeSelectedDeckCardName(card.cardName));
    }
    for (const card of deck?.sideboard ?? []) {
        if (card.amount > 0) names.add(normalizeSelectedDeckCardName(card.cardName));
    }
    return names;
}

function pruneSelectedDeckCardNames(deck: DeckCardLists | null, cardNames: string[]): string[] {
    if (cardNames.length === 0) return cardNames;

    const availableCardNames = collectDeckCardNameSet(deck);
    return cardNames.filter(cardName => availableCardNames.has(normalizeSelectedDeckCardName(cardName)));
}

function deckCardIdentity(card: DeckCardInfo): string {
    return [
        card.cardName.trim().toLocaleLowerCase(),
        card.setCode?.trim().toLocaleLowerCase() ?? '',
        card.cardNumber?.trim().toLocaleLowerCase() ?? '',
    ].join('|');
}

function countDeckZone(cards: DeckCardInfo[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const card of cards) {
        const identity = deckCardIdentity(card);
        counts.set(identity, (counts.get(identity) ?? 0) + card.amount);
    }
    return counts;
}

function deckZonesMatch(left: DeckCardInfo[], right: DeckCardInfo[]): boolean {
    const leftCounts = countDeckZone(left);
    const rightCounts = countDeckZone(right);
    if (leftCounts.size !== rightCounts.size) return false;

    for (const [key, leftCount] of leftCounts) {
        if (rightCounts.get(key) !== leftCount) return false;
    }

    return true;
}

function decksMatch(left: DeckCardLists | null, right: DeckCardLists | null): boolean {
    if (!left || !right) return left === right;
    return deckZonesMatch(left.cards, right.cards) && deckZonesMatch(left.sideboard, right.sideboard);
}

function formatSignedDelta(value: number): string {
    if (value > 0) return `+${value}`;
    return String(value);
}

function formatDeckTimer(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getTimerRemainingSeconds(activity: ClientActivity | null, now: number): number | null {
    if (!activity || typeof activity.time !== 'number' || activity.time <= 0) return null;
    const elapsed = activity.updatedAt > 0 ? Math.max(0, Math.floor((now - activity.updatedAt) / 1000)) : 0;
    return Math.max(0, activity.time - elapsed);
}

function activityDeckEditorMode(activity: ClientActivity | null): DeckEditorModeKey {
    if (activity?.kind === 'sideboard') return 'sideboard';
    if (activity?.kind === 'construction') return 'limited';
    if (activity?.kind === 'card-viewer') return 'limited';
    if (activity?.kind === 'draft') return 'draft';
    return 'normal';
}

function cloneDeck(deck: DeckCardLists): DeckCardLists {
    return {
        ...deck,
        cards: deck.cards.map(card => ({ ...card })),
        sideboard: deck.sideboard.map(card => ({ ...card })),
    };
}

function cardRowKey(card: DeckCardInfo, index: number): string {
    return [
        card.setCode ?? '',
        card.cardNumber ?? '',
        card.cardName,
        index,
    ].join('|');
}

function deckPayloadKind(activity: ClientActivity | null): 'sideboard' | 'construction' | 'draft' | 'view' | null {
    if (activity?.kind === 'sideboard') return 'sideboard';
    if (activity?.kind === 'construction') return 'construction';
    if (activity?.kind === 'draft' && activity.deck) return 'draft';
    if (activity?.kind === 'card-viewer' && activity.deck) return 'view';
    return null;
}

function firstBoosterCardId(draftPick: DraftPickPayload | null | undefined): string | null {
    if (!draftPick) return null;
    return Object.keys(draftPick.booster)[0] ?? null;
}

function sortDeckCards(
    cards: DeckCardInfo[],
    sortBy: DeckListSortKey,
    direction: DeckSortDirection,
): DeckCardInfo[] {
    if (sortBy === 'custom') return cards;

    const multiplier = direction === 'desc' ? -1 : 1;
    return [...cards].sort((left, right) => compareDeckCards(left, right, sortBy) * multiplier);
}

function compareDeckCards(left: DeckCardInfo, right: DeckCardInfo, sortBy: Exclude<DeckListSortKey, 'custom'>): number {
    switch (sortBy) {
        case 'amount':
            return left.amount - right.amount || compareText(left.cardName, right.cardName);
        case 'set':
            return compareText(left.setCode, right.setCode)
                || compareText(left.cardNumber, right.cardNumber)
                || compareText(left.cardName, right.cardName);
        case 'name':
        default:
            return compareText(left.cardName, right.cardName);
    }
}

function compareText(left: string | null | undefined, right: string | null | undefined): number {
    return (left ?? '').localeCompare(right ?? '', undefined, { sensitivity: 'base', numeric: true });
}

export const ActivityWorkspace: React.FC<ActivityWorkspaceProps> = ({
    activity,
    activities,
    onOpenDecks,
    onOpenGame,
    onOpenLobby,
    onOpenSettings,
    onOpenDebug,
    onSubmitDeck,
    onOpenDeckEditor,
}) => {
    const sessionId = useSessionStore(state => state.sessionId);
    const showLocalUserRequest = useSessionStore(state => state.showLocalUserRequest);
    const updateDraftPick = useActivityStore(state => state.updateDraftPick);
    const [submitStatus, setSubmitStatus] = React.useState<string | null>(null);
    const [isSubmittingDeck, setIsSubmittingDeck] = React.useState(false);
    const [isDraftCommandBusy, setIsDraftCommandBusy] = React.useState(false);
    const [isReplayCommandBusy, setIsReplayCommandBusy] = React.useState(false);
    const [isAddLandsOpen, setIsAddLandsOpen] = React.useState(false);
    const [isAddingLands, setIsAddingLands] = React.useState(false);
    const [addLandsError, setAddLandsError] = React.useState<string | null>(null);
    const [addLandsResultDetails, setAddLandsResultDetails] = React.useState<AddLandsResultDetailsData | null>(null);
    const [selectedLegalityCardNames, setSelectedLegalityCardNames] = React.useState<string[]>([]);
    const [deckSelectionSource, setDeckSelectionSource] = React.useState<ActivityDeckSelectionSource>(null);
    const [activeLegalityProblemCardNames, setActiveLegalityProblemCardNames] = React.useState<string[]>([]);
    const [previewCard, setPreviewCard] = React.useState<DeckCardInfo | null>(null);
    const [deckEditorConfig, setDeckEditorConfig] = React.useState<DeckEditorConfig>(() => appConfigService.loadDeckEditorConfig());
    const [dragOverZone, setDragOverZone] = React.useState<DeckCardZone | null>(null);
    const [draggingDeckCardKey, setDraggingDeckCardKey] = React.useState<string | null>(null);
    const [timerNow, setTimerNow] = React.useState(() => Date.now());
    const deckRowClickTimerRef = React.useRef<number | null>(null);
    const destination = activity ? getActivityDestination(activity.kind) : 'activity-workspace';
    const commands = activityCommands(activity);
    const activeDeckPayloadKind = deckPayloadKind(activity);
    const activityEditorMode = activityDeckEditorMode(activity);
    const activityModeConfig = deckEditorConfig.modes[activityEditorMode];
    const isReadOnlyDeck = activity?.kind === 'card-viewer';
    const canUseLimitedAddLands = activity?.kind === 'construction' || (activity?.kind === 'sideboard' && activity.limitedSideboard === true);
    const deckPayload = activeDeckPayloadKind ? activity?.deck ?? null : null;
    const draftCardId = firstBoosterCardId(activity?.draftPick);
    const canQuitDraft = Boolean(activity?.kind === 'draft' && activity.objectId && sessionId);
    const isDraftPicking = activity?.draftPick?.picking !== false;
    const draftPickCount = Object.keys(activity?.draftPick?.picks ?? {}).length;
    const draftBoosterCount = Object.keys(activity?.draftPick?.booster ?? {}).length;
    const canRunDraftCommand = Boolean(canQuitDraft && draftCardId && isDraftPicking);
    const replayPayload = activity?.kind === 'replay' ? activity.replay ?? null : null;
    const canRunReplayCommand = Boolean(activity?.kind === 'replay' && activity.objectId && sessionId && activity.status !== 'completed');
    const [editableDeck, setEditableDeck] = React.useState<DeckCardLists | null>(() => (
        deckPayload ? cloneDeck(deckPayload) : null
    ));
    const [submittedDeckBaseline, setSubmittedDeckBaseline] = React.useState<DeckCardLists | null>(null);
    const deckBaseline = submittedDeckBaseline ?? deckPayload;
    const canSubmitDeck = Boolean(
        activity?.objectId
        && editableDeck
        && onSubmitDeck
        && (activity.kind === 'sideboard' || activity.kind === 'construction')
    );
    const mainCount = editableDeck ? countDeckCards(editableDeck.cards) : 0;
    const sideboardCount = editableDeck ? countDeckCards(editableDeck.sideboard) : 0;
    const sourceMainCount = deckBaseline ? countDeckCards(deckBaseline.cards) : 0;
    const sourceSideboardCount = deckBaseline ? countDeckCards(deckBaseline.sideboard) : 0;
    const mainDelta = mainCount - sourceMainCount;
    const sideboardDelta = sideboardCount - sourceSideboardCount;
    const isDeckDirty = !decksMatch(deckBaseline, editableDeck);
    const timerRemainingSeconds = getTimerRemainingSeconds(activity, timerNow);
    const timerState = timerRemainingSeconds === null
        ? 'none'
        : timerRemainingSeconds === 0 ? 'expired' : 'running';
    const timerLabel = timerRemainingSeconds === null ? 'Untimed' : formatDeckTimer(timerRemainingSeconds);
    const submitReadinessLabel = canSubmitDeck
        ? timerState === 'expired' ? 'Submit window elapsed' : 'Ready to submit'
        : isReadOnlyDeck ? 'Read-only view' : editableDeck ? 'Submit unavailable' : 'Waiting for deck';
    const sortedMainDeck = editableDeck
        ? sortDeckCards(editableDeck.cards, activityModeConfig.deckSortBy, activityModeConfig.deckSortDirection)
        : [];
    const sortedSideboard = editableDeck
        ? sortDeckCards(editableDeck.sideboard, activityModeConfig.deckSortBy, activityModeConfig.deckSortDirection)
        : [];

    React.useEffect(() => {
        setEditableDeck(deckPayload ? cloneDeck(deckPayload) : null);
        setSubmitStatus(null);
        setSubmittedDeckBaseline(null);
        setIsAddLandsOpen(false);
        setAddLandsError(null);
        setAddLandsResultDetails(null);
        setSelectedLegalityCardNames([]);
        setDeckSelectionSource(null);
        setActiveLegalityProblemCardNames([]);
        setDragOverZone(null);
        setDraggingDeckCardKey(null);
    }, [activity?.id, deckPayload]);

    React.useEffect(() => {
        const prunedCardNames = pruneSelectedDeckCardNames(editableDeck, selectedLegalityCardNames);
        if (prunedCardNames.length === selectedLegalityCardNames.length) return;

        setSelectedLegalityCardNames(prunedCardNames);
        if (prunedCardNames.length === 0) {
            setDeckSelectionSource(null);
        }
    }, [editableDeck, selectedLegalityCardNames]);

    React.useEffect(() => {
        if (!activity?.time || activity.time <= 0) return;

        setTimerNow(Date.now());
        const intervalId = window.setInterval(() => setTimerNow(Date.now()), 1000);
        return () => window.clearInterval(intervalId);
    }, [activity?.id, activity?.time, activity?.updatedAt]);

    React.useEffect(() => {
        return () => {
            if (deckRowClickTimerRef.current !== null) {
                window.clearTimeout(deckRowClickTimerRef.current);
            }
        };
    }, []);

    const clearPendingDeckRowClick = React.useCallback(() => {
        if (deckRowClickTimerRef.current !== null) {
            window.clearTimeout(deckRowClickTimerRef.current);
            deckRowClickTimerRef.current = null;
        }
    }, []);

    const scheduleDeckRowClick = React.useCallback((callback: () => void) => {
        clearPendingDeckRowClick();
        deckRowClickTimerRef.current = window.setTimeout(() => {
            deckRowClickTimerRef.current = null;
            callback();
        }, ACTIVITY_DECK_ROW_CLICK_COMMIT_DELAY_MS);
    }, [clearPendingDeckRowClick]);

    const handleSetDeckCardAmount = React.useCallback((card: DeckCardInfo, zone: DeckCardZone, amount: number) => {
        setEditableDeck(current => current ? setDeckCardAmount(current, card, zone, amount) : current);
    }, []);

    const handleMoveDeckCard = React.useCallback((card: DeckCardInfo, zone: DeckCardZone) => {
        setEditableDeck(current => current ? moveDeckCard(current, card, zone, zone === 'main' ? 'side' : 'main', 1) : current);
    }, []);

    const handleDeckRowClick = React.useCallback((card: DeckCardInfo, zone: DeckCardZone) => {
        scheduleDeckRowClick(() => handleSetDeckCardAmount(card, zone, 0));
    }, [handleSetDeckCardAmount, scheduleDeckRowClick]);

    const handleDeckRowDoubleClick = React.useCallback((event: React.MouseEvent, card: DeckCardInfo, zone: DeckCardZone) => {
        event.preventDefault();
        clearPendingDeckRowClick();

        if (event.altKey) {
            handleMoveDeckCard(card, zone);
            return;
        }

        handleSetDeckCardAmount(card, zone, 0);
    }, [clearPendingDeckRowClick, handleMoveDeckCard, handleSetDeckCardAmount]);

    const handleDeckRowContextMenu = React.useCallback((event: React.MouseEvent, card: DeckCardInfo) => {
        event.preventDefault();
        clearPendingDeckRowClick();
        setPreviewCard(card);
    }, [clearPendingDeckRowClick]);

    const handleDeckRowKeyDown = React.useCallback((event: React.KeyboardEvent, card: DeckCardInfo, zone: DeckCardZone, canEdit: boolean) => {
        if (event.currentTarget !== event.target) return;

        if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault();
            clearPendingDeckRowClick();
            setPreviewCard(card);
            return;
        }

        if (!canEdit) return;

        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            clearPendingDeckRowClick();
            handleSetDeckCardAmount(card, zone, 0);
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            clearPendingDeckRowClick();
            if (event.altKey) {
                handleMoveDeckCard(card, zone);
            } else {
                handleSetDeckCardAmount(card, zone, 0);
            }
        }
    }, [clearPendingDeckRowClick, handleMoveDeckCard, handleSetDeckCardAmount]);

    const stopDeckRowAction = React.useCallback((event: React.SyntheticEvent) => {
        clearPendingDeckRowClick();
        event.stopPropagation();
    }, [clearPendingDeckRowClick]);

    const handleDeckRowDragStart = React.useCallback((event: React.DragEvent, card: DeckCardInfo, zone: DeckCardZone, rowKey: string) => {
        clearPendingDeckRowClick();
        const payload: ActivityDeckRowDragData = { card, sourceZone: zone };
        setDraggingDeckCardKey(rowKey);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(ACTIVITY_DECK_ROW_DRAG_MIME, JSON.stringify(payload));
        event.dataTransfer.setData('text/plain', `${card.amount} ${card.cardName}`);
    }, [clearPendingDeckRowClick]);

    const handleDeckListDragOver = React.useCallback((event: React.DragEvent, zone: DeckCardZone) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes(ACTIVITY_DECK_ROW_DRAG_MIME) ? 'move' : 'none';
        setDragOverZone(zone);
    }, []);

    const handleDeckListDragLeave = React.useCallback(() => {
        setDragOverZone(null);
    }, []);

    const handleDeckListDrop = React.useCallback((event: React.DragEvent, targetZone: DeckCardZone) => {
        event.preventDefault();
        clearPendingDeckRowClick();
        setDragOverZone(null);
        setDraggingDeckCardKey(null);

        try {
            const dragData = event.dataTransfer.getData(ACTIVITY_DECK_ROW_DRAG_MIME);
            if (!dragData) return;

            const { card, sourceZone } = JSON.parse(dragData) as ActivityDeckRowDragData;
            if (sourceZone !== targetZone) {
                setEditableDeck(current => current ? moveDeckCard(current, card, sourceZone, targetZone, 1) : current);
            }
        } catch (error) {
            console.error('Failed to parse activity deck row drag data:', error);
        }
    }, [clearPendingDeckRowClick]);

    const handleDeckRowDragEnd = React.useCallback(() => {
        clearPendingDeckRowClick();
        setDragOverZone(null);
        setDraggingDeckCardKey(null);
    }, [clearPendingDeckRowClick]);

    const handleResetDeck = React.useCallback(() => {
        if (!deckBaseline) return;
        clearPendingDeckRowClick();
        setEditableDeck(cloneDeck(deckBaseline));
        setAddLandsResultDetails(null);
        setSubmitStatus('Deck changes reset.');
    }, [clearPendingDeckRowClick, deckBaseline]);

    const updateActivityEditorModeConfig = React.useCallback((patch: Partial<DeckEditorModeConfig>) => {
        setDeckEditorConfig(current => appConfigService.saveDeckEditorConfig({
            ...current,
            activeMode: activityEditorMode,
            modes: {
                ...current.modes,
                [activityEditorMode]: {
                    ...current.modes[activityEditorMode],
                    ...patch,
                },
            },
        }));
    }, [activityEditorMode]);

    const handleDeckSortChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        updateActivityEditorModeConfig({ deckSortBy: event.currentTarget.value as DeckListSortKey });
    }, [updateActivityEditorModeConfig]);

    const handleDeckSortDirectionToggle = React.useCallback(() => {
        updateActivityEditorModeConfig({
            deckSortDirection: activityModeConfig.deckSortDirection === 'asc' ? 'desc' : 'asc',
        });
    }, [activityModeConfig.deckSortDirection, updateActivityEditorModeConfig]);

    const handleResetActivityLayout = React.useCallback(() => {
        setDeckEditorConfig(current => appConfigService.saveDeckEditorConfig({
            ...current,
            activeMode: activityEditorMode,
            modes: {
                ...current.modes,
                [activityEditorMode]: DEFAULT_DECK_EDITOR_CONFIG.modes[activityEditorMode],
            },
        }));
    }, [activityEditorMode]);

    const handleSuggestBasicLands = React.useCallback(async (deckSize: number): Promise<BasicLandCounts> => {
        setAddLandsError(null);
        if (!editableDeck) return createEmptyBasicLandCounts();

        try {
            return await deckLandsService.suggestBasicLands(editableDeck, deckSize);
        } catch (error) {
            console.error('Failed to suggest activity basic lands:', error);
            setAddLandsError(error instanceof Error ? error.message : 'Failed to suggest basic lands.');
            return createEmptyBasicLandCounts();
        }
    }, [editableDeck]);

    const handleLoadBasicLandSetOptions = React.useCallback(async () => {
        if (!editableDeck) return [];
        return deckLandsService.listBasicLandSetOptions(editableDeck, { allowSnowBasics: false });
    }, [editableDeck]);

    const handleAddBasicLands = React.useCallback(async (
        counts: BasicLandCounts,
        zone: DeckCardZone,
        options: AddBasicLandsOptions,
    ) => {
        if (!editableDeck) return;

        setIsAddingLands(true);
        setAddLandsError(null);
        setAddLandsResultDetails(null);
        setSubmitStatus(null);

        try {
            const result = await deckLandsService.addBasicLands(editableDeck, counts, zone, {
                ...options,
                allowSnowBasics: false,
            });
            setEditableDeck(result.deck);
            setIsAddLandsOpen(false);

            const totalAdded = result.addedCards.reduce((sum, card) => sum + card.amount, 0);
            const landCountLabel = totalAdded === 1 ? 'basic land' : 'basic lands';
            const printingDetails = [
                options.setCode?.trim() ? `from ${options.setCode.trim().toUpperCase()}` : null,
                options.fullArtOnly ? 'full-art only' : null,
            ].filter(Boolean).join(', ');
            const printingMessage = printingDetails ? ` (${printingDetails})` : '';
            const unresolvedMessage = result.unresolvedCardNames.length > 0
                ? ` ${result.unresolvedCardNames.join(', ')} used fallback printings.`
                : '';
            setAddLandsResultDetails({
                totalAdded,
                destination: zone,
                setCode: options.setCode?.trim().toUpperCase() || null,
                fullArtOnly: Boolean(options.fullArtOnly),
                addedCards: result.addedCards,
                unresolvedCardNames: result.unresolvedCardNames,
            });
            setSubmitStatus(`Added ${totalAdded} ${landCountLabel}${printingMessage} to main deck.${unresolvedMessage}`);
        } catch (error) {
            console.error('Failed to add activity basic lands:', error);
            setAddLandsResultDetails(null);
            setAddLandsError(error instanceof Error ? error.message : 'Failed to add basic lands.');
        } finally {
            setIsAddingLands(false);
        }
    }, [editableDeck]);

    const handleSubmitDeck = async () => {
        if (!activity?.objectId || !editableDeck || !onSubmitDeck) return;

        setIsSubmittingDeck(true);
        setSubmitStatus(null);
        try {
            const submitted = await onSubmitDeck(activity.objectId, editableDeck);
            if (submitted) {
                setSubmittedDeckBaseline(cloneDeck(editableDeck));
            }
            setSubmitStatus(submitted ? 'Deck submitted.' : 'Deck submit was rejected.');
        } catch (error) {
            setSubmitStatus(error instanceof Error ? error.message : 'Deck submit failed.');
        } finally {
            setIsSubmittingDeck(false);
        }
    };

    const handleDraftCommand = React.useCallback(async (command: 'pick' | 'mark' | 'booster-loaded' | 'quit') => {
        if (activity?.kind !== 'draft' || !activity.objectId) return;

        setIsDraftCommandBusy(true);
        setSubmitStatus(null);
        try {
            if (command === 'quit') {
                const quit = await webSocketBridgeService.quitDraft(activity.objectId, sessionId);
                setSubmitStatus(quit ? 'Draft quit.' : 'Draft quit was rejected.');
                return;
            }

            if (!draftCardId) return;

            if (command === 'mark') {
                const marked = await webSocketBridgeService.markDraftCard(activity.objectId, sessionId, draftCardId);
                setSubmitStatus(marked ? 'Draft card marked.' : 'Draft card mark was rejected.');
                return;
            }

            if (command === 'booster-loaded') {
                const loaded = await webSocketBridgeService.setDraftBoosterLoaded(activity.objectId, sessionId);
                setSubmitStatus(loaded ? 'Draft booster loaded.' : 'Draft booster load was rejected.');
                return;
            }

            const pick = await webSocketBridgeService.pickDraftCard(activity.objectId, sessionId, draftCardId, []);
            updateDraftPick(activity.objectId, {
                booster: pick.booster,
                picks: pick.picks,
                picking: pick.picking,
                timeout: pick.timeout,
                message: pick.message,
            });
            setSubmitStatus('Draft card picked.');
        } catch (error) {
            setSubmitStatus(error instanceof Error ? error.message : 'Draft command failed.');
        } finally {
            setIsDraftCommandBusy(false);
        }
    }, [activity, draftCardId, sessionId, updateDraftPick]);

    const handleReplayCommand = React.useCallback(async (command: 'previous' | 'next' | 'skip-forward' | 'autoplay' | 'stop') => {
        if (activity?.kind !== 'replay' || !activity.objectId) return;

        setIsReplayCommandBusy(true);
        setSubmitStatus(null);
        try {
            if (command === 'stop') {
                const confirmed = await showLocalUserRequest({
                    title: 'Stop replay',
                    message: 'Are you sure you want to stop replay?',
                    gameId: activity.objectId,
                    button1Text: 'No',
                    button1Action: null,
                    button2Text: 'Yes',
                    button2Action: 'CLIENT_REPLAY_ACTION',
                });
                if (confirmed !== 2) {
                    setSubmitStatus('Replay stop cancelled.');
                    return;
                }
                const stopped = await webSocketBridgeService.stopReplay(activity.objectId, sessionId);
                setSubmitStatus(stopped ? 'Replay stop requested.' : 'Replay stop was rejected.');
                return;
            }

            if (command === 'previous') {
                const moved = await webSocketBridgeService.previousReplay(activity.objectId, sessionId);
                setSubmitStatus(moved ? 'Previous play requested.' : 'Previous play was rejected.');
                return;
            }

            if (command === 'next') {
                const moved = await webSocketBridgeService.nextReplay(activity.objectId, sessionId);
                setSubmitStatus(moved ? 'Next play requested.' : 'Next play was rejected.');
                return;
            }

            if (command === 'skip-forward') {
                const skipped = await webSocketBridgeService.skipReplayForward(activity.objectId, sessionId, 10);
                setSubmitStatus(skipped ? 'Replay skip requested.' : 'Replay skip was rejected.');
                return;
            }

            const started = await webSocketBridgeService.startReplay(activity.objectId, sessionId);
            setSubmitStatus(started ? 'Replay autoplay started.' : 'Replay autoplay was rejected.');
        } catch (error) {
            setSubmitStatus(error instanceof Error ? error.message : 'Replay command failed.');
        } finally {
            setIsReplayCommandBusy(false);
        }
    }, [activity, sessionId, showLocalUserRequest]);

    const handleOpenDeckEditor = React.useCallback(() => {
        if (!editableDeck || !onOpenDeckEditor) return;
        onOpenDeckEditor(
            cloneDeck(editableDeck),
            activityEditorMode,
            activity?.title || editableDeck.name || 'Activity deck',
            activity ? {
                kind: activity.kind,
                tableId: activity.objectId ?? undefined,
                limitedSideboard: activity.limitedSideboard,
            } : undefined,
        );
    }, [activity, activityEditorMode, editableDeck, onOpenDeckEditor]);

    const handleSelectLegalityCards = React.useCallback((cardNames: string[]) => {
        setSelectedLegalityCardNames(cardNames);
        setDeckSelectionSource('legality');
    }, []);

    const handleSelectAnalyticsCards = React.useCallback((cardNames: string[]) => {
        if (cardNames.length === 0) {
            setSelectedLegalityCardNames(current => deckSelectionSource === 'analytics' ? [] : current);
            setDeckSelectionSource(current => current === 'analytics' ? null : current);
            return;
        }

        setSelectedLegalityCardNames(cardNames);
        setDeckSelectionSource('analytics');
    }, [deckSelectionSource]);

    const primaryAction = React.useMemo(() => {
        if (!activity) {
            return { label: 'Lobby', onClick: onOpenLobby };
        }

        if (destination === 'game' && activity.objectId) {
            return { label: 'Open Match', onClick: () => onOpenGame(activity.objectId!) };
        }

        if (destination === 'deck-manager' || destination === 'deck-editor') {
            return { label: 'Open Decks', onClick: onOpenDecks };
        }

        if (destination === 'settings') {
            return { label: 'Open Settings', onClick: onOpenSettings };
        }

        if (destination === 'debug') {
            return { label: 'Open Debug', onClick: onOpenDebug };
        }

        if (activity.kind === 'sideboard' || activity.kind === 'construction' || activity.kind === 'card-viewer') {
            return { label: 'Open Decks', onClick: onOpenDecks };
        }

        return { label: 'Lobby', onClick: onOpenLobby };
    }, [activity, destination, onOpenDebug, onOpenDecks, onOpenGame, onOpenLobby, onOpenSettings]);

    const renderDeckRows = (zone: DeckCardZone, cards: DeckCardInfo[]) => (
        <div
            className="activity-deck-editor-list"
            data-testid={`activity-deck-editor-${zone}`}
            data-drag-over={dragOverZone === zone ? 'true' : 'false'}
            onDragOver={isReadOnlyDeck ? undefined : event => handleDeckListDragOver(event, zone)}
            onDragLeave={isReadOnlyDeck ? undefined : handleDeckListDragLeave}
            onDrop={isReadOnlyDeck ? undefined : event => handleDeckListDrop(event, zone)}
        >
            {cards.length === 0 ? (
                <p className="activity-deck-editor-empty">No cards</p>
            ) : (
                cards.map((card, index) => {
                    const rowKey = cardRowKey(card, index);
                    const isSelected = selectedLegalityCardNames.includes(card.cardName);
                    const isFormatInvalid = activeLegalityProblemCardNames.includes(card.cardName);
                    const isDragging = draggingDeckCardKey === rowKey;
                    return (
                        <div
                            key={rowKey}
                            className="activity-deck-editor-row"
                            data-testid="activity-deck-editor-row"
                            data-zone={zone}
                            data-card-name={card.cardName}
                            data-selected={isSelected ? 'true' : 'false'}
                            data-format-invalid={isFormatInvalid ? 'true' : 'false'}
                            data-dragging={isDragging ? 'true' : 'false'}
                            data-read-only={isReadOnlyDeck ? 'true' : 'false'}
                            tabIndex={0}
                            aria-label={`${card.amount} ${card.cardName} in ${zone === 'main' ? 'main deck' : 'sideboard'}`}
                            draggable={!isReadOnlyDeck}
                            onClick={isReadOnlyDeck ? undefined : () => handleDeckRowClick(card, zone)}
                            onDoubleClick={isReadOnlyDeck ? undefined : event => handleDeckRowDoubleClick(event, card, zone)}
                            onContextMenu={event => handleDeckRowContextMenu(event, card)}
                            onKeyDown={event => handleDeckRowKeyDown(event, card, zone, !isReadOnlyDeck)}
                            onDragStart={isReadOnlyDeck ? undefined : event => handleDeckRowDragStart(event, card, zone, rowKey)}
                            onDragEnd={isReadOnlyDeck ? undefined : handleDeckRowDragEnd}
                        >
                            <label>
                                <span className="sr-only">{card.cardName} copies</span>
                                <input
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    value={card.amount}
                                    data-testid="activity-deck-editor-count-input"
                                    disabled={isReadOnlyDeck}
                                    onClick={stopDeckRowAction}
                                    onChange={event => handleSetDeckCardAmount(card, zone, Number(event.currentTarget.value))}
                                    onDoubleClick={stopDeckRowAction}
                                />
                            </label>
                            <div className="activity-deck-editor-card">
                                <strong>{card.cardName}</strong>
                                <span>{[card.setCode, card.cardNumber].filter(Boolean).join(' ') || 'Unknown printing'}</span>
                            </div>
                            {!isReadOnlyDeck && (
                                <>
                                    <button
                                        type="button"
                                        className="activity-deck-editor-button"
                                        data-testid="activity-deck-editor-move-button"
                                        onClick={event => {
                                            stopDeckRowAction(event);
                                            handleMoveDeckCard(card, zone);
                                        }}
                                        onDoubleClick={stopDeckRowAction}
                                    >
                                        {zone === 'main' ? 'Side' : 'Main'}
                                    </button>
                                    <button
                                        type="button"
                                        className="activity-deck-editor-button"
                                        data-testid="activity-deck-editor-remove-button"
                                        onClick={event => {
                                            stopDeckRowAction(event);
                                            handleSetDeckCardAmount(card, zone, 0);
                                        }}
                                        onDoubleClick={stopDeckRowAction}
                                    >
                                        Remove
                                    </button>
                                </>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <main
            className="activity-workspace page"
            aria-labelledby="activity-workspace-title"
            data-testid="activity-workspace"
            data-activity-kind={activity?.kind ?? 'none'}
            data-activity-status={activity?.status ?? 'idle'}
            data-activity-id={activity?.id ?? 'none'}
            data-activity-object-id={activity?.objectId ?? 'none'}
            data-activity-last-callback={activity?.lastCallbackMethod ?? 'none'}
        >
            <section className="activity-workspace-hero" data-testid="activity-workspace-hero">
                <div>
                    <span className="activity-workspace-kicker" data-testid="activity-workspace-kind">
                        {activity ? getActivityKindLabel(activity.kind) : 'Activity'}
                    </span>
                    <h1 id="activity-workspace-title" data-testid="activity-workspace-title">
                        {activity?.title ?? 'Activity workspace'}
                    </h1>
                </div>
                <div className="activity-workspace-actions">
                    <button type="button" className="btn btn-secondary" onClick={onOpenLobby}>
                        Lobby
                    </button>
                    <button type="button" className="btn btn-primary" onClick={primaryAction.onClick}>
                        {primaryAction.label}
                    </button>
                </div>
            </section>

            <section className="activity-workspace-status" aria-label="Activity status" data-testid="activity-workspace-status">
                <div data-testid="activity-status-value">
                    <span>Status</span>
                    <strong>{activity ? statusLabel(activity) : 'Idle'}</strong>
                </div>
                <div data-testid="activity-object-value">
                    <span>Object</span>
                    <strong>{activity?.objectId?.slice(0, 8) ?? 'None'}</strong>
                </div>
                <div data-testid="activity-last-event-value">
                    <span>Last Event</span>
                    <strong>{activity?.lastCallbackMethod ?? 'None'}</strong>
                </div>
                <div>
                    <span>Updated</span>
                    <strong>{activity ? formatActivityTime(activity.updatedAt) : 'Unknown'}</strong>
                </div>
            </section>

            {activity && (commands.length > 0 || editableDeck) && (
                <section
                    className="activity-command-panel"
                    aria-label={`${getActivityKindLabel(activity.kind)} ${commands.length > 0 ? 'controls' : 'deck view'}`}
                    data-testid="activity-command-panel"
                    data-activity-command-kind={activity.kind}
                    data-command-count={commands.length}
                    data-controls-ready={canSubmitDeck || canRunReplayCommand ? 'true' : 'false'}
                    data-deck-read-only={isReadOnlyDeck ? 'true' : 'false'}
                >
                    <h2>{getActivityKindLabel(activity.kind)} {commands.length > 0 ? 'Controls' : 'Deck View'}</h2>
                    {activity.kind === 'replay' && (
                        <div
                            className="activity-replay-payload"
                            data-testid="activity-replay-payload"
                            data-replay-state={replayPayload?.state ?? 'waiting'}
                            data-replay-turn={replayPayload?.turn ?? 0}
                            data-replay-phase={replayPayload?.phase ?? 'unknown'}
                            data-replay-step={replayPayload?.step ?? 'unknown'}
                            data-replay-active-player={replayPayload?.activePlayerName ?? ''}
                            data-replay-priority-player={replayPayload?.priorityPlayerName ?? ''}
                            data-controls-ready={String(canRunReplayCommand)}
                        >
                            <div>
                                <span>Replay</span>
                                <strong data-testid="activity-replay-state">{replayPayload?.message ?? 'Waiting for replay payload.'}</strong>
                            </div>
                            <div>
                                <span>Turn</span>
                                <strong data-testid="activity-replay-turn">{replayPayload?.turn ?? '-'}</strong>
                            </div>
                            <div>
                                <span>Phase</span>
                                <strong data-testid="activity-replay-phase">
                                    {[replayPayload?.phase, replayPayload?.step].filter(Boolean).join(' / ') || '-'}
                                </strong>
                            </div>
                        </div>
                    )}
                    {editableDeck && (
                        <div
                            className="activity-deck-payload"
                            data-testid="activity-deck-payload"
                            data-deck-payload-kind={activeDeckPayloadKind ?? 'none'}
                            data-deck-name={editableDeck.name ?? ''}
                            data-deck-format={editableDeck.format ?? ''}
                            data-main-count={mainCount}
                            data-sideboard-count={sideboardCount}
                            data-source-main-count={sourceMainCount}
                            data-source-sideboard-count={sourceSideboardCount}
                            data-main-delta={mainDelta}
                            data-sideboard-delta={sideboardDelta}
                            data-deck-dirty={isDeckDirty ? 'true' : 'false'}
                            data-limited-sideboard={activity?.kind === 'sideboard' ? String(activity.limitedSideboard === true) : 'none'}
                            data-draft-picking={activity?.kind === 'draft' ? String(isDraftPicking) : 'none'}
                            data-draft-pick-count={activity?.kind === 'draft' ? draftPickCount : 0}
                            data-draft-booster-count={activity?.kind === 'draft' ? draftBoosterCount : 0}
                            data-timer-state={timerState}
                            data-time-initial={activity.time ?? 0}
                            data-time-remaining={timerRemainingSeconds ?? 0}
                            data-submit-ready={String(canSubmitDeck)}
                            data-read-only={isReadOnlyDeck ? 'true' : 'false'}
                        >
                            <div>
                                <span>Deck</span>
                                <strong>{editableDeck.name || 'Untitled deck'}</strong>
                            </div>
                            <div>
                                <span>Main</span>
                                <strong data-testid="activity-deck-main-count">{mainCount}</strong>
                            </div>
                            <div>
                                <span>Side</span>
                                <strong data-testid="activity-deck-sideboard-count">{sideboardCount}</strong>
                            </div>
                            <div>
                                <span>Delta</span>
                                <strong data-testid="activity-deck-delta">
                                    Main {formatSignedDelta(mainDelta)} / Side {formatSignedDelta(sideboardDelta)}
                                </strong>
                            </div>
                            <div>
                                <span>Changes</span>
                                <strong data-testid="activity-deck-dirty-state">{isDeckDirty ? 'Edited' : 'Callback'}</strong>
                            </div>
                            <div>
                                <span>Timer</span>
                                <strong
                                    className="activity-deck-timer"
                                    data-testid="activity-deck-timer"
                                    data-timer-state={timerState}
                                >
                                    {timerLabel}
                                </strong>
                            </div>
                            <div>
                                <span>Submit</span>
                                <strong
                                    className="activity-deck-submit-state"
                                    data-testid="activity-deck-submit-state"
                                    data-submit-ready={String(canSubmitDeck)}
                                >
                                    {submitReadinessLabel}
                                </strong>
                            </div>
                        </div>
                    )}
                    {editableDeck && (
                        <>
                            <div className="activity-deck-editor" data-testid="activity-deck-editor">
                                <div
                                    className="activity-deck-editor-toolbar"
                                    data-testid="activity-deck-editor-toolbar"
                                    data-editor-mode={activityEditorMode}
                                    data-deck-sort={activityModeConfig.deckSortBy}
                                    data-deck-sort-direction={activityModeConfig.deckSortDirection}
                                    data-sideboard-visible={activityModeConfig.showSideboard}
                                >
                                    <label>
                                        <span>Sort</span>
                                        <select
                                            value={activityModeConfig.deckSortBy}
                                            onChange={handleDeckSortChange}
                                            data-testid="activity-deck-sort-select"
                                        >
                                            <option value="custom">Deck order</option>
                                            <option value="name">Name</option>
                                            <option value="amount">Quantity</option>
                                            <option value="set">Set/No.</option>
                                        </select>
                                    </label>
                                    <button
                                        type="button"
                                        className="activity-deck-editor-button"
                                        onClick={handleDeckSortDirectionToggle}
                                        aria-label={activityModeConfig.deckSortDirection === 'asc' ? 'Sort activity deck ascending' : 'Sort activity deck descending'}
                                        data-testid="activity-deck-sort-direction-button"
                                    >
                                        {activityModeConfig.deckSortDirection === 'asc' ? 'Asc' : 'Desc'}
                                    </button>
                                    <label className="activity-deck-sideboard-toggle">
                                        <input
                                            type="checkbox"
                                            checked={activityModeConfig.showSideboard}
                                            onChange={event => updateActivityEditorModeConfig({ showSideboard: event.currentTarget.checked })}
                                            data-testid="activity-deck-sideboard-toggle"
                                        />
                                        <span>Sideboard</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="activity-deck-editor-button"
                                        onClick={handleResetActivityLayout}
                                        title={`Reset ${activityEditorMode} activity deck layout and sort settings`}
                                        data-testid="activity-deck-reset-layout-button"
                                        data-editor-mode={activityEditorMode}
                                    >
                                        Reset
                                    </button>
                                    <button
                                        type="button"
                                        className="activity-deck-editor-button"
                                        onClick={handleOpenDeckEditor}
                                        disabled={!editableDeck || !onOpenDeckEditor || isReadOnlyDeck}
                                        data-testid="activity-open-full-editor-button"
                                    >
                                        Full Editor
                                    </button>
                                </div>
                                <section>
                                    <h3>Main Deck</h3>
                                    {renderDeckRows('main', sortedMainDeck)}
                                </section>
                                {activityModeConfig.showSideboard && (
                                    <section>
                                        <h3>Sideboard</h3>
                                        {renderDeckRows('side', sortedSideboard)}
                                    </section>
                                )}
                            </div>
                            <div className="activity-deck-legality" data-testid="activity-deck-legality">
                                <DeckLegalityPanel
                                    deck={editableDeck}
                                    selectedFormat={editableDeck.format}
                                    onSelectCardNames={handleSelectLegalityCards}
                                    onActiveProblemCardNames={setActiveLegalityProblemCardNames}
                                />
                            </div>
                            <div className="activity-deck-analytics" data-testid="activity-deck-analytics">
                                <DeckAnalyticsPanel deck={editableDeck} onSelectCardNames={handleSelectAnalyticsCards} />
                            </div>
                        </>
                    )}
                    {submitStatus && (
                        <div className="activity-command-status" role="status" data-testid="activity-command-status">
                            {submitStatus}
                        </div>
                    )}
                    {addLandsResultDetails && (
                        <AddLandsResultDetails details={addLandsResultDetails} className="activity-add-lands-result" />
                    )}
                    {commands.length > 0 && (
                        <div className="activity-command-grid">
                            {commands.map(command => (
                            <button
                                key={command.key}
                                type="button"
                                className="activity-command-button"
                                data-testid={command.testId}
                                data-activity-command={command.key}
                                disabled={
                                    activity.kind === 'replay'
                                        ? isReplayCommandBusy || !canRunReplayCommand
                                    : activity.kind === 'draft'
                                        ? isDraftCommandBusy || (command.key === 'quit' ? !canQuitDraft : !canRunDraftCommand)
                                        : isSubmittingDeck || (
                                        command.key === 'reset-sideboard'
                                            ? !editableDeck
                                            : command.key === 'add-lands'
                                                ? !editableDeck || !canUseLimitedAddLands
                                            : !canSubmitDeck
                                                || (command.key !== 'submit-sideboard' && command.key !== 'submit-deck')
                                    )
                                }
                                title={
                                    activity.kind === 'replay' && canRunReplayCommand
                                        ? 'Run this replay command against the live replay session.'
                                    : activity.kind === 'draft' && (command.key === 'quit' ? canQuitDraft : canRunDraftCommand)
                                        ? 'Run this draft command against the live booster payload.'
                                    :
                                    canSubmitDeck && (command.key === 'submit-sideboard' || command.key === 'submit-deck')
                                        ? 'Submit the current deck payload to the server.'
                                        : command.key === 'reset-sideboard' && editableDeck
                                            ? 'Reset the deck payload to the latest server callback.'
                                        : command.key === 'add-lands' && editableDeck && canUseLimitedAddLands
                                            ? 'Add basic lands to the limited main deck.'
                                        : command.reason
                                }
                                onClick={
                                    command.key === 'submit-sideboard' || command.key === 'submit-deck'
                                        ? () => void handleSubmitDeck()
                                        : command.key === 'reset-sideboard'
                                            ? handleResetDeck
                                        : command.key === 'add-lands'
                                            ? () => setIsAddLandsOpen(true)
                                        : command.key === 'pick'
                                            ? () => void handleDraftCommand('pick')
                                        : command.key === 'mark'
                                            ? () => void handleDraftCommand('mark')
                                        : command.key === 'booster-loaded'
                                            ? () => void handleDraftCommand('booster-loaded')
                                        : command.key === 'quit'
                                            ? () => void handleDraftCommand('quit')
                                        : command.key === 'previous'
                                            ? () => void handleReplayCommand('previous')
                                        : command.key === 'next'
                                            ? () => void handleReplayCommand('next')
                                        : command.key === 'skip-forward'
                                            ? () => void handleReplayCommand('skip-forward')
                                        : command.key === 'autoplay'
                                            ? () => void handleReplayCommand('autoplay')
                                        : command.key === 'stop'
                                            ? () => void handleReplayCommand('stop')
                                        : undefined
                                }
                            >
                                {isSubmittingDeck && (command.key === 'submit-sideboard' || command.key === 'submit-deck')
                                    ? 'Submitting'
                                    : command.label}
                            </button>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <section className="activity-workspace-list" aria-label="Tracked activities" data-testid="tracked-activities">
                <h2>Tracked Activities</h2>
                {activities.length === 0 ? (
                    <p>No active activities</p>
                ) : (
                    <div className="activity-workspace-grid">
                        {activities.map(item => (
                            <article
                                key={item.id}
                                className={`activity-workspace-item activity-workspace-item-${item.status}`}
                                data-testid="tracked-activity"
                                data-activity-kind={item.kind}
                                data-activity-status={item.status}
                                data-activity-id={item.id}
                                data-activity-object-id={item.objectId ?? 'none'}
                                data-activity-last-callback={item.lastCallbackMethod}
                            >
                                <span>{getActivityKindLabel(item.kind)}</span>
                                <strong>{item.title}</strong>
                                <small>{statusLabel(item)} - {formatActivityTime(item.updatedAt)}</small>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {isAddLandsOpen && editableDeck && activity?.kind === 'construction' && (
                <DeckAddLandsDialog
                    deck={editableDeck}
                    busy={isAddingLands}
                    error={addLandsError}
                    allowSnowBasics={false}
                    allowedZones={['main']}
                    initialDeckSize={defaultAddLandsDeckSize(editableDeck, { limited: true })}
                    contextLabel="limited construction main deck"
                    onCancel={() => setIsAddLandsOpen(false)}
                    onSuggest={handleSuggestBasicLands}
                    onLoadSetOptions={handleLoadBasicLandSetOptions}
                    onAdd={handleAddBasicLands}
                />
            )}
            {isAddLandsOpen && editableDeck && activity?.kind === 'sideboard' && activity.limitedSideboard === true && (
                <DeckAddLandsDialog
                    deck={editableDeck}
                    busy={isAddingLands}
                    error={addLandsError}
                    allowSnowBasics={false}
                    allowedZones={['main']}
                    initialDeckSize={defaultAddLandsDeckSize(editableDeck, { limited: true })}
                    contextLabel="limited sideboard main deck"
                    onCancel={() => setIsAddLandsOpen(false)}
                    onSuggest={handleSuggestBasicLands}
                    onLoadSetOptions={handleLoadBasicLandSetOptions}
                    onAdd={handleAddBasicLands}
                />
            )}
            {previewCard && (
                <CardPreviewModal
                    card={{
                        id: `${previewCard.setCode}-${previewCard.cardNumber}`,
                        name: previewCard.cardName,
                        displayName: previewCard.cardName,
                        expansionSetCode: previewCard.setCode || '',
                        cardNumber: previewCard.cardNumber || '',
                        rules: [],
                        cardTypes: [],
                        subTypes: [],
                    } as any}
                    onClose={() => setPreviewCard(null)}
                />
            )}
        </main>
    );
};
