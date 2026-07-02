import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { normalizeDeckSubmitPayload } from '../services/WebSocketBridgeService.js';
import { getUtilityActivityTitle } from '../services/ActivityShellService.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readString(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
function readRecordString(record, key) {
    return readString(record[key]);
}
function readNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function readBoolean(value) {
    return typeof value === 'boolean' ? value : null;
}
function readGameView(value) {
    return isRecord(value) && Array.isArray(value.players) && 'turn' in value
        ? value
        : null;
}
function replayPayloadFromCallback(callback) {
    switch (callback.method) {
        case 'replayGame':
            return {
                state: 'requested',
                message: 'Replay requested.',
            };
        case 'replayInit': {
            const gameView = readGameView(callback.data);
            return {
                state: 'ready',
                message: 'Replay ready.',
                turn: gameView?.turn,
                phase: gameView?.phase,
                step: gameView?.step,
                activePlayerName: gameView?.activePlayerName,
                priorityPlayerName: gameView?.priorityPlayerName,
            };
        }
        case 'replayUpdate': {
            const gameView = readGameView(callback.data);
            return {
                state: 'updated',
                message: 'Replay advanced.',
                turn: gameView?.turn,
                phase: gameView?.phase,
                step: gameView?.step,
                activePlayerName: gameView?.activePlayerName,
                priorityPlayerName: gameView?.priorityPlayerName,
            };
        }
        case 'replayDone':
            return {
                state: 'done',
                message: 'Replay finished.',
            };
        default:
            return null;
    }
}
function readDraftPickPayload(data) {
    const candidate = data.draftPickView;
    if (!isRecord(candidate) || !isRecord(candidate.booster) || !isRecord(candidate.picks))
        return null;
    return {
        booster: candidate.booster,
        picks: candidate.picks,
        picking: candidate.picking === true,
        timeout: readNumber(candidate.timeout) ?? undefined,
        message: readString(candidate.message) ?? undefined,
    };
}
function readCardName(record) {
    return readString(record.cardName)
        ?? readString(record.name)
        ?? readString(record.displayName)
        ?? 'Unknown Card';
}
function draftCardToDeckCard(value) {
    if (!isRecord(value))
        return null;
    const cardName = readCardName(value).trim();
    if (!cardName)
        return null;
    return {
        amount: 1,
        cardName,
        setCode: readString(value.setCode) ?? readString(value.expansionSetCode),
        cardNumber: readString(value.cardNumber),
    };
}
function cardViewToDeckCard(card) {
    return {
        amount: 1,
        cardName: card.displayName?.trim() || card.name?.trim() || 'Unknown Card',
        setCode: readString(card.expansionSetCode),
        cardNumber: readString(card.cardNumber),
    };
}
function groupDeckCards(cards) {
    const grouped = new Map();
    for (const card of cards) {
        const key = [
            card.cardName.trim().toLocaleLowerCase(),
            card.setCode?.trim().toLocaleLowerCase() ?? '',
            card.cardNumber?.trim().toLocaleLowerCase() ?? '',
        ].join('|');
        const existing = grouped.get(key);
        if (existing) {
            existing.amount += card.amount;
        }
        else {
            grouped.set(key, { ...card });
        }
    }
    return [...grouped.values()];
}
function cardsViewToDeckCards(cardsView) {
    return groupDeckCards(Object.values(cardsView).map(cardViewToDeckCard));
}
function countDeckCards(deck) {
    if (!deck)
        return 0;
    return deck.cards.reduce((sum, card) => sum + card.amount, 0)
        + deck.sideboard.reduce((sum, card) => sum + card.amount, 0);
}
function hasDeckCards(deck) {
    return countDeckCards(deck) > 0;
}
function cloneDeck(deck) {
    return {
        ...deck,
        cards: deck.cards.map(card => ({ ...card })),
        sideboard: deck.sideboard.map(card => ({ ...card })),
    };
}
function deckWithFallbackFormat(deck, format) {
    const fallbackFormat = readString(format);
    if (!deck || readString(deck.format) || !fallbackFormat)
        return deck;
    return { ...deck, format: fallbackFormat };
}
function deckFromDraftPick(draftPick) {
    if (!draftPick)
        return null;
    const cards = groupDeckCards(Object.values(draftPick.picks)
        .map(draftCardToDeckCard)
        .filter((card) => card !== null));
    if (cards.length === 0)
        return null;
    return {
        name: 'Draft Picks',
        format: 'Limited',
        cards,
        sideboard: [],
    };
}
function mergeDraftPickPayload(previous, next) {
    if (!previous)
        return next ?? null;
    if (!next)
        return previous;
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
function deckFromActivityData(data) {
    const deck = data.deck;
    if (!deck || typeof deck !== 'object')
        return deckFromDraftPick(readDraftPickPayload(data));
    try {
        return normalizeDeckSubmitPayload(deck);
    }
    catch {
        return null;
    }
}
function latestCompletedDraftDeck(activities) {
    const draft = activities
        .filter(activity => activity.kind === 'draft' && activity.status === 'completed' && hasDeckCards(activity.deck))
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];
    return draft?.deck ? cloneDeck(draft.deck) : null;
}
function constructionDeckWithDraftFallback(incomingDeck, fallbackDeck) {
    if (!fallbackDeck)
        return incomingDeck;
    if (!incomingDeck)
        return cloneDeck(fallbackDeck);
    return {
        ...incomingDeck,
        format: readString(incomingDeck.format) ?? fallbackDeck.format,
        cards: fallbackDeck.cards.map(card => ({ ...card })),
        sideboard: fallbackDeck.sideboard.map(card => ({ ...card })),
    };
}
function shouldFocusActivity(activity) {
    if (activity.status === 'active')
        return true;
    if (activity.status === 'completed')
        return false;
    return activity.kind === 'construction'
        || activity.kind === 'sideboard'
        || activity.kind === 'draft';
}
function titleFor(kind, label) {
    if (label)
        return label;
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
function getActivityFallbackTitle(kind) {
    return kind;
}
function gameIdFromStartGame(callback) {
    const data = callback.data;
    if (Array.isArray(data)) {
        return readString(data[0]);
    }
    if (isRecord(data)) {
        return readRecordString(data, 'gameId') ?? readRecordString(data, 'id');
    }
    return readString(data) ?? callback.objectId;
}
function activityFromCallback(callback) {
    const objectId = callback.objectId;
    const data = isRecord(callback.data) ? callback.data : {};
    switch (callback.method) {
        case 'startGame': {
            const gameId = gameIdFromStartGame(callback);
            if (!gameId)
                return null;
            return {
                id: `game:${gameId}`,
                kind: 'game',
                title: titleFor('game', readRecordString(data, 'tableName')),
                objectId: gameId,
                status: 'active',
            };
        }
        case 'gameInit':
            if (!objectId)
                return null;
            return {
                id: `game:${objectId}`,
                kind: 'game',
                title: titleFor('game'),
                objectId,
                status: 'active',
            };
        case 'gameOver':
        case 'endGameInfo':
            if (!objectId)
                return null;
            return {
                id: `game:${objectId}`,
                kind: 'game',
                title: titleFor('game'),
                objectId,
                status: 'completed',
            };
        case 'watchGame':
            if (!objectId)
                return null;
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
            if (!objectId)
                return null;
            return {
                id: `replay:${objectId}`,
                kind: 'replay',
                title: titleFor('replay'),
                objectId,
                status: callback.method === 'replayDone' ? 'completed' : 'active',
                replay: replayPayloadFromCallback(callback),
            };
        case 'startTournament':
        case 'showTournament':
        case 'tournamentInit':
        case 'tournamentUpdate':
        case 'tournamentOver':
            if (!objectId)
                return null;
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
            if (!objectId)
                return null;
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
            if (!tableId)
                return null;
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
            if (!tableId)
                return null;
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
            if (!tableId)
                return null;
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
export const useActivityStore = create()(devtools(immer((set) => ({
    activities: [],
    activeActivityId: null,
    handleCallback: (callback) => {
        const activity = activityFromCallback(callback);
        if (!activity)
            return;
        set((state) => {
            const existing = state.activities.find(item => item.id === activity.id);
            const draftPick = mergeDraftPickPayload(existing?.draftPick, activity.draftPick);
            const incomingDeck = activity.kind === 'draft'
                ? deckFromDraftPick(draftPick) ?? activity.deck ?? existing?.deck ?? null
                : activity.deck ?? existing?.deck ?? null;
            const deck = activity.kind === 'construction' && !hasDeckCards(incomingDeck)
                ? constructionDeckWithDraftFallback(incomingDeck, latestCompletedDraftDeck(state.activities))
                : incomingDeck;
            const nextActivity = {
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
                replay: activity.replay ?? existing?.replay ?? null,
                limitedSideboard: activity.limitedSideboard ?? existing?.limitedSideboard ?? false,
                time: activity.time ?? draftPick?.timeout ?? existing?.time,
            };
            if (existing) {
                Object.assign(existing, nextActivity);
            }
            else {
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
        const nextActivity = {
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
            }
            else {
                state.activities.unshift(nextActivity);
            }
            state.activeActivityId = id;
        });
        return nextActivity;
    },
    openUtilityActivity: (kind, options = {}) => {
        const id = `${kind}:${options.objectId ?? 'main'}`;
        const nextActivity = {
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
            }
            else {
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
            if (state.activeActivityId &&
                !state.activities.some(activity => activity.id === state.activeActivityId)) {
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
})), { name: 'activity-store' }));
