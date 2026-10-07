import assert from 'node:assert/strict';
import test from 'node:test';
import {
    P0_BRIDGE_METHODS,
    P1_LOBBY_BRIDGE_METHODS,
    WebSocketBridgeService,
    normalizeDeckSubmitPayload,
} from './WebSocketBridgeService.js';
import type { BridgeCategory } from './WebSocketBridgeService.js';
import type { DeckCardLists, DeckView, PlayerAction, UUID } from '../types/index.js';

const SESSION_ID = 'session-1';
const ROOM_ID: UUID = '00000000-0000-0000-0000-000000000001';
const TABLE_ID: UUID = '00000000-0000-0000-0000-000000000002';
const GAME_ID: UUID = '00000000-0000-0000-0000-000000000003';
const DRAFT_ID: UUID = '00000000-0000-0000-0000-000000000004';
const CARD_ID: UUID = '00000000-0000-0000-0000-000000000005';

const DECK_CARD_LISTS: DeckCardLists = {
    name: 'Bridge Deck',
    cards: [
        { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ],
    sideboard: [
        { amount: 1, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ],
    cardLayout: { stale: true },
    sideboardLayout: { stale: true },
};

test('tracks every P0 bridge method by category', () => {
    const expectedCategories: BridgeCategory[] = [
        'session',
        'table',
        'tournament',
        'draft',
        'replay',
        'permissions',
        'server',
        'auth',
        'deck',
    ];
    const methods = new Set(P0_BRIDGE_METHODS.map(item => item.method));

    assert.equal(methods.size, P0_BRIDGE_METHODS.length);

    for (const category of expectedCategories) {
        assert.ok(
            P0_BRIDGE_METHODS.some(item => item.category === category),
            `Expected ${category} bridge coverage`,
        );
    }

    assert.deepEqual([...methods].sort(), [
        'authResetPassword',
        'authSendTokenToEmail',
        'connectUser',
        'deckSubmit',
        'disconnectSession',
        'draftJoin',
        'draftQuit',
        'draftSetBoosterLoaded',
        'getServerState',
        'replayInit',
        'replayNext',
        'replayPrevious',
        'replaySkipForward',
        'replayStart',
        'replayStop',
        'roomCreateTournament',
        'roomJoinTournament',
        'roomWatchTournament',
        'sendDraftCardMark',
        'sendDraftCardPick',
        'sendPlayerAction',
        'serverGetMainRoomId',
        'serverGetPromotionMessages',
        'tableRemove',
        'tableSwapSeats',
        'tournamentJoin',
        'tournamentQuit',
        'tournamentStart',
    ].sort());
});

test('tracks P1 lobby option bridge methods separately from P0', () => {
    const methods = new Set(P1_LOBBY_BRIDGE_METHODS.map(item => item.method));

    assert.deepEqual([...methods].sort(), [
        'getBasicLandSets',
        'getDeckTypes',
        'getDraftCubes',
        'getExpansionSets',
        'getGameTypes',
        'getPlayerTypes',
        'getTournamentGameTypes',
        'getTournamentTypes',
    ]);
    assert.ok(P1_LOBBY_BRIDGE_METHODS.every(item => item.category === 'server'));
});

test('bridge wrappers emit every P0 server method', async () => {
    const calls: Array<{ method: string; params: unknown[] }> = [];
    const service = new WebSocketBridgeService(async <T = unknown>(method: string, params: unknown[] = []): Promise<T> => {
        calls.push({ method, params });
        return true as T;
    });

    await service.connectUser('alice', 'password', SESSION_ID, 'old-session', 'user-1');
    await service.disconnectSession(SESSION_ID, true);
    await service.swapSeats(SESSION_ID, ROOM_ID, TABLE_ID, 0, 1);
    await service.removeTable(SESSION_ID, ROOM_ID, TABLE_ID);
    await service.createTournament(SESSION_ID, ROOM_ID, { tournamentType: 'Booster Draft' });
    await service.joinTournamentTable(SESSION_ID, ROOM_ID, TABLE_ID, 'Alice', 'Human', 5, DECK_CARD_LISTS);
    await service.watchTournament(SESSION_ID, TABLE_ID);
    await service.startTournamentTable(SESSION_ID, ROOM_ID, TABLE_ID);
    await service.joinTournament(TABLE_ID, SESSION_ID);
    await service.quitTournament(TABLE_ID, SESSION_ID);
    await service.joinDraft(DRAFT_ID, SESSION_ID);
    await service.quitDraft(DRAFT_ID, SESSION_ID);
    await service.pickDraftCard(DRAFT_ID, SESSION_ID, CARD_ID, [CARD_ID]);
    await service.markDraftCard(DRAFT_ID, SESSION_ID, CARD_ID);
    await service.markDraftCard(DRAFT_ID, SESSION_ID, null);
    await service.setDraftBoosterLoaded(DRAFT_ID, SESSION_ID);
    await service.initReplay(GAME_ID, SESSION_ID);
    await service.startReplay(GAME_ID, SESSION_ID);
    await service.stopReplay(GAME_ID, SESSION_ID);
    await service.nextReplay(GAME_ID, SESSION_ID);
    await service.previousReplay(GAME_ID, SESSION_ID);
    await service.skipReplayForward(GAME_ID, SESSION_ID, 2);
    await service.sendPermissionAction('REQUEST_PERMISSION_TO_ROLLBACK_TURN' as PlayerAction, GAME_ID, SESSION_ID, CARD_ID);
    await service.getServerState();
    await service.getMainRoomId();
    await service.getPromotionMessages(SESSION_ID);
    await service.requestAuthToken(SESSION_ID, 'alice@example.com');
    await service.resetPassword(SESSION_ID, 'alice@example.com', '123456', 'new-password');
    await service.submitDeck(SESSION_ID, TABLE_ID, DECK_CARD_LISTS);

    assert.deepEqual(
        new Set(calls.map(call => call.method)),
        new Set(P0_BRIDGE_METHODS.map(item => item.method)),
    );
    assert.deepEqual(calls.find(call => call.method === 'disconnectSession')?.params, [SESSION_ID, true]);
    assert.deepEqual(calls.find(call => call.method === 'connectUser')?.params, [
        'alice',
        'password',
        SESSION_ID,
        'old-session',
        '',
        'user-1',
    ]);
});

test('bridge wrappers emit every P1 lobby option server method', async () => {
    const calls: Array<{ method: string; params: unknown[] }> = [];
    const service = new WebSocketBridgeService(async <T = unknown>(method: string, params: unknown[] = []): Promise<T> => {
        calls.push({ method, params });
        if (method === 'getGameTypes' || method === 'getTournamentGameTypes') return [] as T;
        if (method === 'getTournamentTypes') return [] as T;
        return [] as T;
    });

    await service.getGameTypes();
    await service.getDeckTypes();
    await service.getPlayerTypes();
    await service.getTournamentTypes();
    await service.getTournamentGameTypes();
    await service.getDraftCubes();
    await service.getExpansionSets();
    await service.getBasicLandSets();

    assert.deepEqual(
        new Set(calls.map(call => call.method)),
        new Set(P1_LOBBY_BRIDGE_METHODS.map(item => item.method)),
    );
    assert.ok(calls.every(call => call.params.length === 0));
});

test('normalizes Java DeckView sideboard payloads into DeckCardLists', () => {
    const deckView: DeckView = {
        name: 'Sideboard Deck',
        cards: {
            [CARD_ID]: {
                id: CARD_ID,
                expansionSetCode: 'M11',
                cardNumber: '149',
                usesVariousArt: false,
                gameObject: false,
                isChoosable: false,
                isSelected: false,
                name: 'Lightning Bolt',
            },
            '00000000-0000-0000-0000-000000000006': {
                id: '00000000-0000-0000-0000-000000000006',
                expansionSetCode: 'M11',
                cardNumber: '149',
                usesVariousArt: false,
                gameObject: false,
                isChoosable: false,
                isSelected: false,
                name: 'Lightning Bolt',
            },
        },
        sideboard: {
            '00000000-0000-0000-0000-000000000007': {
                id: '00000000-0000-0000-0000-000000000007',
                expansionSetCode: 'M11',
                cardNumber: '244',
                usesVariousArt: false,
                gameObject: false,
                isChoosable: false,
                isSelected: false,
                name: 'Mountain',
            },
        },
    };

    assert.deepEqual(normalizeDeckSubmitPayload(deckView), {
        name: 'Sideboard Deck',
        cards: [
            { amount: 2, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        ],
        sideboard: [
            { amount: 1, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
        ],
    });
});

test('strips Java-incompatible deck layout fields before submit', () => {
    assert.deepEqual(normalizeDeckSubmitPayload(DECK_CARD_LISTS), {
        name: 'Bridge Deck',
        cards: [
            { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        ],
        sideboard: [
            { amount: 1, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
        ],
    });
});
