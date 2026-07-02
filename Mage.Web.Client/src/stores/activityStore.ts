import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ClientCallback, ClientCallbackMethod, UUID } from '../types/index.js';
import { normalizeDeckSubmitPayload } from '../services/WebSocketBridgeService.js';
import { getUtilityActivityTitle, type ActivityKind } from '../services/ActivityShellService.js';
import type { CardView, CardsView, DeckCardInfo, DeckCardLists, DeckView } from '../types/index.js';

export type { ActivityKind } from '../services/ActivityShellService.js';

export type ActivityStatus = 'active' | 'waiting' | 'completed';
export type ActivitySource = ClientCallbackMethod | 'clientActivity';

export interface DraftPickPayload {
    booster: Record<string, unknown>;
    picks: Record<string, unknown>;
    picking: boolean;
    timeout?: number;
    message?: string;
}

export interface ClientActivity {
    id: string;
    kind: ActivityKind;
    title: string;
    objectId: UUID | null;
    status: ActivityStatus;
    lastCallbackMethod: ActivitySource;
    lastMessageId: number;
    updatedAt: number;
    deck?: DeckCardLists | null;
    draftPick?: DraftPickPayload | null;
    limitedSideboard?: boolean;
    time?: number;
}

interface ActivityDraft {
    id: string;
    kind: ActivityKind;
    title: string;
    objectId: UUID | null;
    status?: ActivityStatus;
    deck?: DeckCardLists | null;
    draftPick?: DraftPickPayload | null;
    limitedSideboard?: boolean;
    time?: number;
}

interface ActivityState {
    activities: ClientActivity[];
    activeActivityId: string | null;
}

interface ActivityActions {
    handleCallback: (callback: ClientCallback) => void;
    openViewedSideboard: (input: { gameId?: UUID | null; playerId: UUID; playerName: string; sideboard: CardsView }) => ClientActivity | null;
    openUtilityActivity: (kind: ActivityKind, options?: { objectId?: UUID | null; title?: string }) => ClientActivity;
    setActiveActivity: (activityId: string | null) => void;
    removeActivity: (activityId: string) => void;
    clearCompleted: () => void;
    updateDraftPick: (draftId: UUID, draftPick: DraftPickPayload) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function readRecordString(record: Record<string, unknown>, key: string): string | null {
    return readString(record[key]);
}

function readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function readDraftPickPayload(data: Record<string, unknown>): DraftPickPayload | null {
    const candidate = data.draftPickView;
    if (!isRecord(candidate) || !isRecord(candidate.booster) || !isRecord(candidate.picks)) return null;

    return {
        booster: candidate.booster,
        picks: candidate.picks,
        picking: candidate.picking === true,
        timeout: readNumber(candidate.timeout) ?? undefined,
        message: readString(candidate.message) ?? undefined,
    };
}

function readCardName(record: Record<string, unknown>): string {
    return readString(record.cardName)
        ?? readString(record.name)
        ?? readString(record.displayName)
        ?? 'Unknown Card';
}

function draftCardToDeckCard(value: unknown): DeckCardInfo | null {
    if (!isRecord(value)) return null;

    const cardName = readCardName(value).trim();
    if (!cardName) return null;

    return {
        amount: 1,
        cardName,
        setCode: readString(value.setCode) ?? readString(value.expansionSetCode),
        cardNumber: readString(value.cardNumber),
    };
}

function cardViewToDeckCard(card: CardView): DeckCardInfo {
    return {
        amount: 1,
        cardName: card.displayName?.trim() || card.name?.trim() || 'Unknown Card',
        setCode: readString(card.expansionSetCode),
        cardNumber: readString(card.cardNumber),
    };
}

function groupDeckCards(cards: DeckCardInfo[]): DeckCardInfo[] {
    const grouped = new Map<string, DeckCardInfo>();

    for (const card of cards) {
        const key = [
            card.cardName.trim().toLocaleLowerCase(),
            card.setCode?.trim().toLocaleLowerCase() ?? '',
            card.cardNumber?.trim().toLocaleLowerCase() ?? '',
        ].join('|');
        const existing = grouped.get(key);
        if (existing) {
            existing.amount += card.amount;
        } else {
            grouped.set(key, { ...card });
        }
    }

    return [...grouped.values()];
}

function cardsViewToDeckCards(cardsView: CardsView): DeckCardInfo[] {
    return groupDeckCards(Object.values(cardsView).map(cardViewToDeckCard));
}

function countDeckCards(deck: DeckCardLists | null | undefined): number {
    if (!deck) return 0;
    return deck.cards.reduce((sum, card) => sum + card.amount, 0)
        + deck.sideboard.reduce((sum, card) => sum + card.amount, 0);
}

function hasDeckCards(deck: DeckCardLists | null | undefined): deck is DeckCardLists {
    return countDeckCards(deck) > 0;
}

function cloneDeck(deck: DeckCardLists): DeckCardLists {
    return {
        ...deck,
        cards: deck.cards.map(card => ({ ...card })),
        sideboard: deck.sideboard.map(card => ({ ...card })),
    };
}

function deckWithFallbackFormat(deck: DeckCardLists | null, format: string): DeckCardLists | null {
    const fallbackFormat = readString(format);
    if (!deck || readString(deck.format) || !fallbackFormat) return deck;
    return { ...deck, format: fallbackFormat };
}

function deckFromDraftPick(draftPick: DraftPickPayload | null): DeckCardLists | null {
    if (!draftPick) return null;

    const cards = groupDeckCards(Object.values(draftPick.picks)
        .map(draftCardToDeckCard)
        .filter((card): card is DeckCardInfo => card !== null));
    if (cards.length === 0) return null;

    return {
        name: 'Draft Picks',
        format: 'Limited',
        cards,
        sideboard: [],
    };
}

function mergeDraftPickPayload(
    previous: DraftPickPayload | null | undefined,
    next: DraftPickPayload | null | undefined,
): DraftPickPayload | null {
    if (!previous) return next ?? null;
    if (!next) return previous;

    return {
        booster: next.booster,
        picks: {
            ...previous.picks,
            ...next.picks,
        },
        picking: next.picking,
        timeout: next.timeout ?? previous.timeout,
        message: next.message ?? previous.message,
    };
}

function deckFromActivityData(data: Record<string, unknown>): DeckCardLists | null {
    const deck = data.deck;
    if (!deck || typeof deck !== 'object') return deckFromDraftPick(readDraftPickPayload(data));

    try {
        return normalizeDeckSubmitPayload(deck as DeckCardLists | DeckView);
    } catch {
        return null;
    }
}

function latestCompletedDraftDeck(activities: ClientActivity[]): DeckCardLists | null {
    const draft = activities
        .filter(activity => activity.kind === 'draft' && activity.status === 'completed' && hasDeckCards(activity.deck))
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];
    return draft?.deck ? cloneDeck(draft.deck) : null;
}

function constructionDeckWithDraftFallback(
    incomingDeck: DeckCardLists | null,
    fallbackDeck: DeckCardLists | null,
): DeckCardLists | null {
    if (!fallbackDeck) return incomingDeck;
    if (!incomingDeck) return cloneDeck(fallbackDeck);

    return {
        ...incomingDeck,
        format: readString(incomingDeck.format) ?? fallbackDeck.format,
        cards: fallbackDeck.cards.map(card => ({ ...card })),
        sideboard: fallbackDeck.sideboard.map(card => ({ ...card })),
    };
}

function shouldFocusActivity(activity: ClientActivity): boolean {
    if (activity.status === 'active') return true;
    if (activity.status === 'completed') return false;

    return activity.kind === 'construction'
        || activity.kind === 'sideboard'
        || activity.kind === 'draft';
}

function titleFor(kind: ActivityKind, label?: string | null): string {
    if (label) return label;

    switch (kind) {
        case 'game':
            return 'Game';
        case 'watch':
            return 'Watched game';
        case 'replay':
            return 'Replay';
        case 'draft':
            return 'Draft';
        case 'tournament':
            return 'Tournament';
        case 'sideboard':
            return 'Sideboarding';
        case 'construction':
            return 'Deck construction';
        case 'deck-manager':
        case 'deck-editor':
        case 'card-viewer':
        case 'settings':
        case 'debug':
            return getUtilityActivityTitle(kind);
    }

    return getActivityFallbackTitle(kind);
}

function getActivityFallbackTitle(kind: never): string {
    return kind;
}

function gameIdFromStartGame(callback: ClientCallback): string | null {
    const data = callback.data;

    if (Array.isArray(data)) {
        return readString(data[0]);
    }

    if (isRecord(data)) {
        return readRecordString(data, 'gameId') ?? readRecordString(data, 'id');
    }

    return readString(data) ?? callback.objectId;
}

function activityFromCallback(callback: ClientCallback): ActivityDraft | null {
    const objectId = callback.objectId;
    const data = isRecord(callback.data) ? callback.data : {};

    switch (callback.method) {
        case 'startGame': {
            const gameId = gameIdFromStartGame(callback);
            if (!gameId) return null;
            return {
                id: `game:${gameId}`,
                kind: 'game',
                title: titleFor('game', readRecordString(data, 'tableName')),
                objectId: gameId,
                status: 'active',
            };
        }

        case 'gameInit':
            if (!objectId) return null;
            return {
                id: `game:${objectId}`,
                kind: 'game',
                title: titleFor('game'),
                objectId,
                status: 'active',
            };

        case 'gameOver':
        case 'endGameInfo':
            if (!objectId) return null;
            return {
                id: `game:${objectId}`,
                kind: 'game',
                title: titleFor('game'),
                objectId,
                status: 'completed',
            };

        case 'watchGame':
            if (!objectId) return null;
            return {
                id: `watch:${objectId}`,
                kind: 'watch',
                title: titleFor('watch'),
                objectId,
                status: 'active',
            };

        case 'replayGame':
        case 'replayInit':
        case 'replayUpdate':
        case 'replayDone':
            if (!objectId) return null;
            return {
                id: `replay:${objectId}`,
                kind: 'replay',
                title: titleFor('replay'),
                objectId,
                status: callback.method === 'replayDone' ? 'completed' : 'active',
            };

        case 'startTournament':
        case 'showTournament':
        case 'tournamentInit':
        case 'tournamentUpdate':
        case 'tournamentOver':
            if (!objectId) return null;
            return {
                id: `tournament:${objectId}`,
                kind: 'tournament',
                title: titleFor('tournament', readRecordString(data, 'tournamentName')),
                objectId,
                status: callback.method === 'tournamentOver' ? 'completed' : 'active',
            };

        case 'startDraft':
        case 'draftInit':
        case 'draftPick':
        case 'draftUpdate':
        case 'draftOver':
            if (!objectId) return null;
            const draftPick = readDraftPickPayload(data);
            return {
                id: `draft:${objectId}`,
                kind: 'draft',
                title: titleFor('draft'),
                objectId,
                status: callback.method === 'draftOver' ? 'completed' : 'active',
                deck: deckFromActivityData(data),
                draftPick,
                time: readNumber(data.time) ?? draftPick?.timeout ?? undefined,
            };

        case 'sideboard': {
            const tableId = readRecordString(data, 'currentTableId') ?? objectId;
            if (!tableId) return null;
            const limitedSideboard = readBoolean(data.flag) === true;
            return {
                id: `sideboard:${tableId}`,
                kind: 'sideboard',
                title: limitedSideboard ? 'Limited sideboarding' : titleFor('sideboard'),
                objectId: tableId,
                status: 'waiting',
                deck: deckWithFallbackFormat(deckFromActivityData(data), limitedSideboard ? 'Limited' : ''),
                limitedSideboard,
                time: readNumber(data.time) ?? undefined,
            };
        }

        case 'construct': {
            const tableId = readRecordString(data, 'currentTableId') ?? objectId;
            if (!tableId) return null;
            return {
                id: `construction:${tableId}`,
                kind: 'construction',
                title: titleFor('construction'),
                objectId: tableId,
                status: 'waiting',
                deck: deckWithFallbackFormat(deckFromActivityData(data), 'Limited'),
                time: readNumber(data.time) ?? undefined,
            };
        }

        case 'viewLimitedDeck': {
            const tableId = readRecordString(data, 'currentTableId') ?? objectId;
            if (!tableId) return null;
            return {
                id: `card-viewer:${tableId}`,
                kind: 'card-viewer',
                title: 'Viewed limited deck',
                objectId: tableId,
                status: 'active',
                deck: deckWithFallbackFormat(deckFromActivityData(data), 'Limited'),
            };
        }

        default:
            return null;
    }
}

export const useActivityStore = create<ActivityState & ActivityActions>()(
    devtools(
        immer((set) => ({
            activities: [],
            activeActivityId: null,

            handleCallback: (callback) => {
                const activity = activityFromCallback(callback);
                if (!activity) return;

                set((state) => {
                    const existing = state.activities.find(item => item.id === activity.id);
                    const draftPick = mergeDraftPickPayload(existing?.draftPick, activity.draftPick);
                    const incomingDeck = activity.kind === 'draft'
                        ? deckFromDraftPick(draftPick) ?? activity.deck ?? existing?.deck ?? null
                        : activity.deck ?? existing?.deck ?? null;
                    const deck = activity.kind === 'construction' && !hasDeckCards(incomingDeck)
                        ? constructionDeckWithDraftFallback(incomingDeck, latestCompletedDraftDeck(state.activities))
                        : incomingDeck;
                    const nextActivity: ClientActivity = {
                        id: activity.id,
                        kind: activity.kind,
                        title: activity.title,
                        objectId: activity.objectId,
                        status: activity.status ?? 'active',
                        lastCallbackMethod: callback.method,
                        lastMessageId: callback.messageId,
                        updatedAt: Date.now(),
                        deck,
                        draftPick,
                        limitedSideboard: activity.limitedSideboard ?? existing?.limitedSideboard ?? false,
                        time: activity.time ?? draftPick?.timeout ?? existing?.time,
                    };

                    if (existing) {
                        Object.assign(existing, nextActivity);
                    } else {
                        state.activities.unshift(nextActivity);
                    }

                    if (!state.activeActivityId || shouldFocusActivity(nextActivity)) {
                        state.activeActivityId = nextActivity.id;
                    }
                });
            },

            openViewedSideboard: ({ gameId, playerId, playerName, sideboard }) => {
                const sideboardCards = cardsViewToDeckCards(sideboard);
                const id = `card-viewer:sideboard:${playerId}`;
                const nextActivity: ClientActivity = {
                    id,
                    kind: 'card-viewer',
                    title: `Viewed sideboard - ${playerName}`,
                    objectId: gameId ?? playerId,
                    status: 'active',
                    lastCallbackMethod: 'viewSideboard',
                    lastMessageId: 0,
                    updatedAt: Date.now(),
                    deck: {
                        name: `${playerName} sideboard`,
                        cards: [],
                        sideboard: sideboardCards,
                    },
                };

                set((state) => {
                    const existing = state.activities.find(item => item.id === id);
                    if (existing) {
                        Object.assign(existing, nextActivity);
                    } else {
                        state.activities.unshift(nextActivity);
                    }
                    state.activeActivityId = id;
                });

                return nextActivity;
            },

            openUtilityActivity: (kind, options = {}) => {
                const id = `${kind}:${options.objectId ?? 'main'}`;
                const nextActivity: ClientActivity = {
                    id,
                    kind,
                    title: options.title ?? getUtilityActivityTitle(kind),
                    objectId: options.objectId ?? null,
                    status: 'active',
                    lastCallbackMethod: 'clientActivity',
                    lastMessageId: 0,
                    updatedAt: Date.now(),
                };

                set((state) => {
                    const existing = state.activities.find(item => item.id === id);
                    if (existing) {
                        Object.assign(existing, nextActivity);
                    } else {
                        state.activities.unshift(nextActivity);
                    }
                    state.activeActivityId = id;
                });

                return nextActivity;
            },

            setActiveActivity: (activityId) => {
                set((state) => {
                    state.activeActivityId = activityId;
                });
            },

            removeActivity: (activityId) => {
                set((state) => {
                    state.activities = state.activities.filter(activity => activity.id !== activityId);
                    if (state.activeActivityId === activityId) {
                        state.activeActivityId = state.activities[0]?.id ?? null;
                    }
                });
            },

            clearCompleted: () => {
                set((state) => {
                    state.activities = state.activities.filter(activity => activity.status !== 'completed');
                    if (
                        state.activeActivityId &&
                        !state.activities.some(activity => activity.id === state.activeActivityId)
                    ) {
                        state.activeActivityId = state.activities[0]?.id ?? null;
                    }
                });
            },

            updateDraftPick: (draftId, draftPick) => {
                set((state) => {
                    const id = `draft:${draftId}`;
                    const existing = state.activities.find(activity => activity.id === id);
                    const mergedDraftPick = mergeDraftPickPayload(existing?.draftPick, draftPick);
                    const deck = deckFromDraftPick(mergedDraftPick);

                    if (existing) {
                        existing.lastCallbackMethod = 'clientActivity';
                        existing.updatedAt = Date.now();
                        existing.draftPick = mergedDraftPick;
                        existing.deck = deck ?? existing.deck ?? null;
                        existing.time = mergedDraftPick?.timeout ?? existing.time;
                        state.activeActivityId = id;
                        return;
                    }

                    state.activities.unshift({
                        id,
                        kind: 'draft',
                        title: titleFor('draft'),
                        objectId: draftId,
                        status: 'active',
                        lastCallbackMethod: 'clientActivity',
                        lastMessageId: 0,
                        updatedAt: Date.now(),
                        deck,
                        draftPick: mergedDraftPick,
                        time: mergedDraftPick?.timeout,
                    });
                    state.activeActivityId = id;
                });
            },
        })),
        { name: 'activity-store' }
    )
);
