import { wsService } from './WebSocketService.js';
import type {
    DeckCardInfo,
    DeckCardLists,
    DeckView,
    DraftPickView,
    GameTypeView,
    BasicLandSetInfo,
    PlayerAction,
    ExpansionSetInfo,
    ServerState,
    TableView,
    TournamentTypeView,
    UUID,
} from '../types/index.js';
import {
    normalizeLobbyServerOptions,
    type LobbyServerOptions,
} from './LobbyOptionsService.js';

export type BridgeSend = <T = unknown>(method: string, params?: unknown[]) => Promise<T>;

export type BridgeCategory =
    | 'session'
    | 'table'
    | 'tournament'
    | 'draft'
    | 'replay'
    | 'permissions'
    | 'server'
    | 'auth'
    | 'deck';

export interface BridgeMethodCoverage {
    category: BridgeCategory;
    method: string;
    parityTask: string;
}

export const P0_BRIDGE_METHODS: readonly BridgeMethodCoverage[] = [
    { category: 'session', method: 'connectUser', parityTask: 'restore session id' },
    { category: 'session', method: 'disconnectSession', parityTask: 'full and keep-games disconnect/exit' },
    { category: 'table', method: 'tableSwapSeats', parityTask: 'swap seats' },
    { category: 'table', method: 'tableRemove', parityTask: 'remove table' },
    { category: 'tournament', method: 'roomCreateTournament', parityTask: 'create tournament table' },
    { category: 'tournament', method: 'roomJoinTournament', parityTask: 'join tournament table' },
    { category: 'tournament', method: 'roomWatchTournament', parityTask: 'watch tournament' },
    { category: 'tournament', method: 'tournamentStart', parityTask: 'start tournament table' },
    { category: 'tournament', method: 'tournamentJoin', parityTask: 'join tournament activity' },
    { category: 'tournament', method: 'tournamentQuit', parityTask: 'quit tournament' },
    { category: 'draft', method: 'draftJoin', parityTask: 'join draft activity' },
    { category: 'draft', method: 'draftQuit', parityTask: 'quit draft activity' },
    { category: 'draft', method: 'sendDraftCardPick', parityTask: 'draft pick' },
    { category: 'draft', method: 'sendDraftCardMark', parityTask: 'draft card mark' },
    { category: 'draft', method: 'draftSetBoosterLoaded', parityTask: 'draft booster loaded' },
    { category: 'replay', method: 'replayInit', parityTask: 'replay init' },
    { category: 'replay', method: 'replayStart', parityTask: 'replay start' },
    { category: 'replay', method: 'replayStop', parityTask: 'replay stop' },
    { category: 'replay', method: 'replayNext', parityTask: 'replay next' },
    { category: 'replay', method: 'replayPrevious', parityTask: 'replay previous' },
    { category: 'replay', method: 'replaySkipForward', parityTask: 'replay skip forward' },
    { category: 'permissions', method: 'sendPlayerAction', parityTask: 'permission requests' },
    { category: 'server', method: 'getServerState', parityTask: 'server status' },
    { category: 'server', method: 'serverGetMainRoomId', parityTask: 'main room status' },
    { category: 'server', method: 'serverGetPromotionMessages', parityTask: 'server promotion messages' },
    { category: 'auth', method: 'authSendTokenToEmail', parityTask: 'auth token request' },
    { category: 'auth', method: 'authResetPassword', parityTask: 'auth token password reset' },
    { category: 'deck', method: 'deckSubmit', parityTask: 'sideboard and limited deck submit' },
] as const;

export const P1_LOBBY_BRIDGE_METHODS: readonly BridgeMethodCoverage[] = [
    { category: 'server', method: 'getGameTypes', parityTask: 'server-provided create-table game types' },
    { category: 'server', method: 'getDeckTypes', parityTask: 'server-provided create-table deck types' },
    { category: 'server', method: 'getPlayerTypes', parityTask: 'server-provided create-table player types' },
    { category: 'server', method: 'getTournamentTypes', parityTask: 'server-provided tournament types' },
    { category: 'server', method: 'getTournamentGameTypes', parityTask: 'server-provided tournament game types' },
    { category: 'server', method: 'getDraftCubes', parityTask: 'server-provided draft cubes' },
    { category: 'server', method: 'getExpansionSets', parityTask: 'server-provided deck-editor set filters' },
    { category: 'server', method: 'getBasicLandSets', parityTask: 'server-provided Add Lands expansion options' },
] as const;

type DeckSubmitPayload = DeckCardLists | DeckView;

interface SubmitCardLike {
    amount?: number;
    cardName?: string;
    name?: string;
    displayName?: string;
    expansionSetCode?: string | null;
    setCode?: string | null;
    cardNumber?: string | null;
}

function isDeckCardLists(deck: DeckSubmitPayload): deck is DeckCardLists {
    return Array.isArray((deck as DeckCardLists).cards) && Array.isArray((deck as DeckCardLists).sideboard);
}

function cardKey(card: DeckCardInfo): string {
    return `${card.cardName}\u0000${card.setCode ?? ''}\u0000${card.cardNumber ?? ''}`;
}

function normalizeCard(card: SubmitCardLike): DeckCardInfo {
    return {
        amount: card.amount ?? 1,
        cardName: card.cardName ?? card.name ?? card.displayName ?? 'Unknown Card',
        setCode: card.setCode ?? card.expansionSetCode ?? null,
        cardNumber: card.cardNumber ?? null,
    };
}

function cardCollectionToList(cards: DeckView['cards']): DeckCardInfo[] {
    const grouped = new Map<string, DeckCardInfo>();

    for (const rawCard of Object.values(cards) as SubmitCardLike[]) {
        const card = normalizeCard(rawCard);
        const key = cardKey(card);
        const existing = grouped.get(key);

        if (existing) {
            existing.amount += card.amount;
        } else {
            grouped.set(key, { ...card });
        }
    }

    return [...grouped.values()];
}

export function normalizeDeckSubmitPayload(deck: DeckSubmitPayload): DeckCardLists {
    if (isDeckCardLists(deck)) {
        // Layout metadata is client-only; strip it before submitting to the server.
        const submitDeck: DeckCardLists = { ...deck };
        delete submitDeck.cardLayout;
        delete submitDeck.sideboardLayout;
        return {
            ...submitDeck,
            cards: deck.cards.map((card: DeckCardInfo) => ({ ...card })),
            sideboard: deck.sideboard.map((card: DeckCardInfo) => ({ ...card })),
        };
    }

    return {
        name: deck.name,
        cards: cardCollectionToList(deck.cards),
        sideboard: cardCollectionToList(deck.sideboard),
    };
}

export class WebSocketBridgeService {
    constructor(private readonly sendRequest: BridgeSend = wsService.send.bind(wsService)) { }

    connectUser(
        userName: string,
        password: string,
        sessionId: string,
        restoreSessionId = '',
        userIdStr = '',
    ): Promise<boolean> {
        return this.sendRequest<boolean>('connectUser', [
            userName,
            password,
            sessionId,
            restoreSessionId,
            '',
            userIdStr,
        ]);
    }

    disconnectSession(sessionId: string, keepGames = false): Promise<boolean> {
        return this.sendRequest<boolean>('disconnectSession', [sessionId, keepGames]);
    }

    requestAuthToken(sessionId: string, email: string): Promise<boolean> {
        return this.sendRequest<boolean>('authSendTokenToEmail', [sessionId, email]);
    }

    resetPassword(sessionId: string, email: string, authToken: string, password: string): Promise<boolean> {
        return this.sendRequest<boolean>('authResetPassword', [sessionId, email, authToken, password]);
    }

    getServerState(): Promise<ServerState> {
        return this.sendRequest<ServerState>('getServerState', []);
    }

    getMainRoomId(): Promise<UUID> {
        return this.sendRequest<UUID>('serverGetMainRoomId', []);
    }

    getPromotionMessages(sessionId: string): Promise<unknown> {
        return this.sendRequest<unknown>('serverGetPromotionMessages', [sessionId]);
    }

    getGameTypes(): Promise<GameTypeView[]> {
        return this.sendRequest<GameTypeView[]>('getGameTypes', []);
    }

    getDeckTypes(): Promise<string[]> {
        return this.sendRequest<string[]>('getDeckTypes', []);
    }

    getPlayerTypes(): Promise<string[]> {
        return this.sendRequest<string[]>('getPlayerTypes', []);
    }

    getTournamentTypes(): Promise<TournamentTypeView[]> {
        return this.sendRequest<TournamentTypeView[]>('getTournamentTypes', []);
    }

    getTournamentGameTypes(): Promise<GameTypeView[]> {
        return this.sendRequest<GameTypeView[]>('getTournamentGameTypes', []);
    }

    getDraftCubes(): Promise<string[]> {
        return this.sendRequest<string[]>('getDraftCubes', []);
    }

    getBasicLandSets(): Promise<BasicLandSetInfo[]> {
        return this.sendRequest<BasicLandSetInfo[]>('getBasicLandSets', []);
    }

    getExpansionSets(): Promise<ExpansionSetInfo[]> {
        return this.sendRequest<ExpansionSetInfo[]>('getExpansionSets', []);
    }

    async getLobbyServerOptions(): Promise<LobbyServerOptions> {
        const serverState = await this.getServerState();
        return normalizeLobbyServerOptions(serverState);
    }

    submitDeck(sessionId: string, tableId: UUID, deck: DeckSubmitPayload): Promise<boolean> {
        return this.sendRequest<boolean>('deckSubmit', [sessionId, tableId, normalizeDeckSubmitPayload(deck)]);
    }

    swapSeats(sessionId: string, roomId: UUID, tableId: UUID, seatNum1: number, seatNum2: number): Promise<boolean> {
        return this.sendRequest<boolean>('tableSwapSeats', [sessionId, roomId, tableId, seatNum1, seatNum2]);
    }

    removeTable(sessionId: string, roomId: UUID, tableId: UUID): Promise<boolean> {
        return this.sendRequest<boolean>('tableRemove', [sessionId, roomId, tableId]);
    }

    createTournament<TournamentOptions>(sessionId: string, roomId: UUID, options: TournamentOptions): Promise<TableView> {
        return this.sendRequest<TableView>('roomCreateTournament', [sessionId, roomId, options]);
    }

    joinTournamentTable(
        sessionId: string,
        roomId: UUID,
        tableId: UUID,
        playerName: string,
        playerType: string,
        skill: number,
        deckList: DeckCardLists,
        password = '',
    ): Promise<boolean> {
        return this.sendRequest<boolean>('roomJoinTournament', [
            sessionId,
            roomId,
            tableId,
            playerName,
            playerType,
            skill,
            normalizeDeckSubmitPayload(deckList),
            password,
        ]);
    }

    watchTournament(sessionId: string, tableId: UUID): Promise<boolean> {
        return this.sendRequest<boolean>('roomWatchTournament', [sessionId, tableId]);
    }

    startTournamentTable(sessionId: string, roomId: UUID, tableId: UUID): Promise<boolean> {
        return this.sendRequest<boolean>('tournamentStart', [sessionId, roomId, tableId]);
    }

    joinTournament(tournamentId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('tournamentJoin', [tournamentId, sessionId]);
    }

    quitTournament(tournamentId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('tournamentQuit', [tournamentId, sessionId]);
    }

    joinDraft(draftId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('draftJoin', [draftId, sessionId]);
    }

    quitDraft(draftId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('draftQuit', [draftId, sessionId]);
    }

    pickDraftCard(draftId: UUID, sessionId: string, cardId: UUID, hiddenCards: UUID[] = []): Promise<DraftPickView> {
        return this.sendRequest<DraftPickView>('sendDraftCardPick', [draftId, sessionId, cardId, hiddenCards]);
    }

    markDraftCard(draftId: UUID, sessionId: string, cardId: UUID | null): Promise<boolean> {
        return this.sendRequest<boolean>('sendDraftCardMark', [draftId, sessionId, cardId]);
    }

    setDraftBoosterLoaded(draftId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('draftSetBoosterLoaded', [draftId, sessionId]);
    }

    initReplay(gameId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('replayInit', [gameId, sessionId]);
    }

    startReplay(gameId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('replayStart', [gameId, sessionId]);
    }

    stopReplay(gameId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('replayStop', [gameId, sessionId]);
    }

    nextReplay(gameId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('replayNext', [gameId, sessionId]);
    }

    previousReplay(gameId: UUID, sessionId: string): Promise<boolean> {
        return this.sendRequest<boolean>('replayPrevious', [gameId, sessionId]);
    }

    skipReplayForward(gameId: UUID, sessionId: string, turns: number): Promise<boolean> {
        return this.sendRequest<boolean>('replaySkipForward', [gameId, sessionId, turns]);
    }

    sendPlayerAction(action: PlayerAction, gameId: UUID, sessionId: string, data: unknown = null): Promise<boolean> {
        return this.sendRequest<boolean>('sendPlayerAction', [action, gameId, sessionId, data]);
    }

    sendPermissionAction(action: PlayerAction, gameId: UUID, sessionId: string, data: unknown = null): Promise<boolean> {
        return this.sendPlayerAction(action, gameId, sessionId, data);
    }
}

export const webSocketBridgeService = new WebSocketBridgeService();
