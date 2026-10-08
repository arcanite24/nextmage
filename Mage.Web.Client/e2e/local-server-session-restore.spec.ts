import {
    configureLocalServerSuite,
    expect,
    LocalServerFixtureSession,
    SMOKE_DECK_LIST,
    test,
    type UUID,
} from './helpers/localServerHarness';

test.describe('local Mage server session restore smoke', () => {
    configureLocalServerSuite();

    let owner: LocalServerFixtureSession | null = null;
    let restored: LocalServerFixtureSession | null = null;
    let tableId: UUID | null = null;

    test.afterEach(async () => {
        const cleanupSession = restored ?? owner;
        if (cleanupSession && tableId) {
            await cleanupSession.removeTable(tableId).catch(() => undefined);
        }

        await restored?.disconnect(false).catch(() => undefined);
        await owner?.disconnect(false).catch(() => undefined);
        restored = null;
        owner = null;
        tableId = null;
    });

    test('reconnects with a keep-games restore id to the same active table and game', async () => {
        owner = await LocalServerFixtureSession.connect('session restore owner');
        const table = await owner.createTable('session restore', {
            playerTypes: ['Human', 'Computer - mad'],
            spectatorsAllowed: true,
        });
        tableId = table.tableId;
        const aiName = 'Session Restore AI';

        await owner.joinTable(table.tableId, owner.userName, 'Human', SMOKE_DECK_LIST);
        await owner.joinTable(table.tableId, aiName, 'Computer - mad', SMOKE_DECK_LIST);
        await owner.startMatch(table.tableId);
        await owner.waitForTableState(table.tableId, 'DUELING');

        const gameId = await owner.waitForTableGame(table.tableId);
        await owner.joinGame(gameId);
        await owner.waitForCallback('GAME_INIT', gameId, 30_000);

        const restoreSessionId = owner.sessionId;
        await owner.disconnect(true);
        owner = null;

        restored = await LocalServerFixtureSession.reconnect(table.controllerName, restoreSessionId);

        const startGame = await restored.waitForCallback('START_GAME', gameId, 30_000);
        expect(startGame.objectId).toBe(gameId);
        await restored.waitForCallback('GAME_INIT', gameId, 30_000);

        const restoredTable = await restored.getTable(table.tableId);
        expect(restoredTable.tableId).toBe(table.tableId);
        expect(restoredTable.tableState).toBe('DUELING');
        expect(restoredTable.games).toContain(gameId);
    });
});
