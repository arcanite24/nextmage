import { wsService } from './WebSocketService.js';
import { normalizeLobbyServerOptions, } from './LobbyOptionsService.js';
export const P0_BRIDGE_METHODS = [
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
];
export const P1_LOBBY_BRIDGE_METHODS = [
    { category: 'server', method: 'getGameTypes', parityTask: 'server-provided create-table game types' },
    { category: 'server', method: 'getDeckTypes', parityTask: 'server-provided create-table deck types' },
    { category: 'server', method: 'getPlayerTypes', parityTask: 'server-provided create-table player types' },
    { category: 'server', method: 'getTournamentTypes', parityTask: 'server-provided tournament types' },
    { category: 'server', method: 'getTournamentGameTypes', parityTask: 'server-provided tournament game types' },
    { category: 'server', method: 'getDraftCubes', parityTask: 'server-provided draft cubes' },
    { category: 'server', method: 'getExpansionSets', parityTask: 'server-provided deck-editor set filters' },
    { category: 'server', method: 'getBasicLandSets', parityTask: 'server-provided Add Lands expansion options' },
];
function isDeckCardLists(deck) {
    return Array.isArray(deck.cards) && Array.isArray(deck.sideboard);
}
function cardKey(card) {
    return `${card.cardName}\u0000${card.setCode ?? ''}\u0000${card.cardNumber ?? ''}`;
}
function normalizeCard(card) {
    return {
        amount: card.amount ?? 1,
        cardName: card.cardName ?? card.name ?? card.displayName ?? 'Unknown Card',
        setCode: card.setCode ?? card.expansionSetCode ?? null,
        cardNumber: card.cardNumber ?? null,
    };
}
function cardCollectionToList(cards) {
    const grouped = new Map();
    for (const rawCard of Object.values(cards)) {
        const card = normalizeCard(rawCard);
        const key = cardKey(card);
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
export function normalizeDeckSubmitPayload(deck) {
    if (isDeckCardLists(deck)) {
        const { cardLayout: _cardLayout, sideboardLayout: _sideboardLayout, ...submitDeck } = deck;
        return {
            ...submitDeck,
            cards: deck.cards.map((card) => ({ ...card })),
            sideboard: deck.sideboard.map((card) => ({ ...card })),
        };
    }
    return {
        name: deck.name,
        cards: cardCollectionToList(deck.cards),
        sideboard: cardCollectionToList(deck.sideboard),
    };
}
export class WebSocketBridgeService {
    sendRequest;
    constructor(sendRequest = wsService.send.bind(wsService)) {
        this.sendRequest = sendRequest;
    }
    connectUser(userName, password, sessionId, restoreSessionId = '', userIdStr = '') {
        return this.sendRequest('connectUser', [
            userName,
            password,
            sessionId,
            restoreSessionId,
            '',
            userIdStr,
        ]);
    }
    disconnectSession(sessionId, keepGames = false) {
        return this.sendRequest('disconnectSession', [sessionId, keepGames]);
    }
    requestAuthToken(sessionId, email) {
        return this.sendRequest('authSendTokenToEmail', [sessionId, email]);
    }
    resetPassword(sessionId, email, authToken, password) {
        return this.sendRequest('authResetPassword', [sessionId, email, authToken, password]);
    }
    getServerState() {
        return this.sendRequest('getServerState', []);
    }
    getMainRoomId() {
        return this.sendRequest('serverGetMainRoomId', []);
    }
    getPromotionMessages(sessionId) {
        return this.sendRequest('serverGetPromotionMessages', [sessionId]);
    }
    getGameTypes() {
        return this.sendRequest('getGameTypes', []);
    }
    getDeckTypes() {
        return this.sendRequest('getDeckTypes', []);
    }
    getPlayerTypes() {
        return this.sendRequest('getPlayerTypes', []);
    }
    getTournamentTypes() {
        return this.sendRequest('getTournamentTypes', []);
    }
    getTournamentGameTypes() {
        return this.sendRequest('getTournamentGameTypes', []);
    }
    getDraftCubes() {
        return this.sendRequest('getDraftCubes', []);
    }
    getBasicLandSets() {
        return this.sendRequest('getBasicLandSets', []);
    }
    getExpansionSets() {
        return this.sendRequest('getExpansionSets', []);
    }
    async getLobbyServerOptions() {
        const serverState = await this.getServerState();
        return normalizeLobbyServerOptions(serverState);
    }
    submitDeck(sessionId, tableId, deck) {
        return this.sendRequest('deckSubmit', [sessionId, tableId, normalizeDeckSubmitPayload(deck)]);
    }
    swapSeats(sessionId, roomId, tableId, seatNum1, seatNum2) {
        return this.sendRequest('tableSwapSeats', [sessionId, roomId, tableId, seatNum1, seatNum2]);
    }
    removeTable(sessionId, roomId, tableId) {
        return this.sendRequest('tableRemove', [sessionId, roomId, tableId]);
    }
    createTournament(sessionId, roomId, options) {
        return this.sendRequest('roomCreateTournament', [sessionId, roomId, options]);
    }
    joinTournamentTable(sessionId, roomId, tableId, playerName, playerType, skill, deckList, password = '') {
        return this.sendRequest('roomJoinTournament', [
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
    watchTournament(sessionId, tableId) {
        return this.sendRequest('roomWatchTournament', [sessionId, tableId]);
    }
    startTournamentTable(sessionId, roomId, tableId) {
        return this.sendRequest('tournamentStart', [sessionId, roomId, tableId]);
    }
    joinTournament(tournamentId, sessionId) {
        return this.sendRequest('tournamentJoin', [tournamentId, sessionId]);
    }
    quitTournament(tournamentId, sessionId) {
        return this.sendRequest('tournamentQuit', [tournamentId, sessionId]);
    }
    joinDraft(draftId, sessionId) {
        return this.sendRequest('draftJoin', [draftId, sessionId]);
    }
    quitDraft(draftId, sessionId) {
        return this.sendRequest('draftQuit', [draftId, sessionId]);
    }
    pickDraftCard(draftId, sessionId, cardId, hiddenCards = []) {
        return this.sendRequest('sendDraftCardPick', [draftId, sessionId, cardId, hiddenCards]);
    }
    markDraftCard(draftId, sessionId, cardId) {
        return this.sendRequest('sendDraftCardMark', [draftId, sessionId, cardId]);
    }
    setDraftBoosterLoaded(draftId, sessionId) {
        return this.sendRequest('draftSetBoosterLoaded', [draftId, sessionId]);
    }
    initReplay(gameId, sessionId) {
        return this.sendRequest('replayInit', [gameId, sessionId]);
    }
    startReplay(gameId, sessionId) {
        return this.sendRequest('replayStart', [gameId, sessionId]);
    }
    stopReplay(gameId, sessionId) {
        return this.sendRequest('replayStop', [gameId, sessionId]);
    }
    nextReplay(gameId, sessionId) {
        return this.sendRequest('replayNext', [gameId, sessionId]);
    }
    previousReplay(gameId, sessionId) {
        return this.sendRequest('replayPrevious', [gameId, sessionId]);
    }
    skipReplayForward(gameId, sessionId, turns) {
        return this.sendRequest('replaySkipForward', [gameId, sessionId, turns]);
    }
    sendPlayerAction(action, gameId, sessionId, data = null) {
        return this.sendRequest('sendPlayerAction', [action, gameId, sessionId, data]);
    }
    sendPermissionAction(action, gameId, sessionId, data = null) {
        return this.sendPlayerAction(action, gameId, sessionId, data);
    }
}
export const webSocketBridgeService = new WebSocketBridgeService();
