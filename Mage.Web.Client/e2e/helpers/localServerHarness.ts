import { expect, test as base, type Locator, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

export { expect };

export const test = base;

export const RUN_LOCAL_SERVER_SMOKE = process.env.MAGE_E2E_REQUIRE_SERVER === '1';
export const RUN_ADVANCED_LOCAL_SERVER_FLOWS = process.env.MAGE_E2E_ADVANCED_FLOWS === '1';
export const RUN_REPLAY_LOCAL_SERVER_FLOWS = process.env.MAGE_E2E_REPLAY_FLOWS === '1';
export const SERVER_URL = process.env.MAGE_E2E_SERVER_URL ?? 'ws://127.0.0.1:17172';
export const RUN_ID = process.env.MAGE_E2E_RUN_ID ?? Date.now().toString().slice(-8);
export const USERNAME = process.env.MAGE_E2E_USERNAME ?? `web_${RUN_ID}`;
export const PASSWORD = process.env.MAGE_E2E_PASSWORD ?? 'testpass';

const SMOKE_TABLE_PREFIX = 'Web P0.5 Smoke ';
const TABLE_PREFIX = `${SMOKE_TABLE_PREFIX}${RUN_ID}`;
const LOCAL_SAVED_GAMES_DIR = resolve(process.cwd(), '..', 'Mage.Server', 'release', 'saved');
const LOCAL_SERVER_SKIP_MESSAGE =
    'Set MAGE_E2E_REQUIRE_SERVER=1 and run a local Mage server before executing this smoke suite.';

export const SMOKE_DECK = `4 [M11:149] Lightning Bolt
56 [M11:244] Mountain
`;

export const SMOKE_SIDEBOARD_DECK = `4 [M11:149] Lightning Bolt
56 [M11:244] Mountain

Sideboard
15 [M11:244] Mountain
`;

export type UUID = string;

export interface DeckCardInfo {
    amount: number;
    cardName: string;
    setCode: string | null;
    cardNumber: string | null;
}

export interface DeckCardLists {
    name: string;
    cards: DeckCardInfo[];
    sideboard: DeckCardInfo[];
}

export interface TableView {
    tableId: UUID;
    tableName: string;
    controllerName: string;
    tableState: string;
    tableStateText: string;
    seatsInfo: string;
    spectatorsAllowed: boolean;
    games?: UUID[];
}

export interface MatchView {
    tableId: UUID;
    matchId: UUID;
    matchName: string;
    gameType: string;
    deckType: string;
    games: UUID[];
    result: string;
    players: string;
    startTime: string;
    endTime: string;
    replayAvailable: boolean;
    isTournament: boolean;
    rated?: boolean;
    isRated?: boolean;
}

interface ServerCallback {
    method: string;
    objectId?: UUID;
    data?: unknown;
    messageId?: number;
}

interface DraftPickViewFixture {
    booster: Record<UUID, unknown>;
    picks: Record<UUID, unknown>;
    picking: boolean;
    timeout: number;
}

interface MatchOptionsFixture {
    name: string;
    gameType: string;
    deckType: string;
    winsNeeded: number;
    quitRatio: number;
    freeMulligans: number;
    matchTimeLimit: string;
    matchBufferTime: string;
    password?: string;
    limited: boolean;
    rated: boolean;
    rollbackTurnsAllowed: boolean;
    spectatorsAllowed: boolean;
    playerTypes: string[];
}

interface TournamentOptionsFixture {
    name: string;
    tournamentType: string;
    playerTypes: string[];
    matchOptions: MatchOptionsFixture;
    limitedOptions?: {
        sets: string[];
        constructionTime: number;
        draftCubeName?: string;
        numberBoosters?: number;
        isRandom?: boolean;
        isReshuffled?: boolean;
        isRichMan?: boolean;
        timing?: string;
    };
    watchingAllowed: boolean;
    planeChase: boolean;
    numberRounds: number;
    password: string;
    quitRatio: number;
    minimumRating: number;
}

export const SMOKE_DECK_LIST: DeckCardLists = {
    name: 'P0.5 Smoke Deck',
    cards: [
        { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 56, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ],
    sideboard: [],
};

export const SMOKE_SIDEBOARD_DECK_LIST: DeckCardLists = {
    ...SMOKE_DECK_LIST,
    name: 'P0.5 Smoke Sideboard Deck',
    sideboard: [
        { amount: 15, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ],
};

export const SMOKE_LIMITED_SUBMIT_DECK_LIST: DeckCardLists = {
    name: 'P0.5 Smoke Limited Submit Deck',
    cards: [
        { amount: 17, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
        { amount: 23, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ],
    sideboard: [],
};

interface JsonRpcResponse<T> {
    id?: number;
    result?: T;
    error?: string;
}

interface PendingRequest<T = unknown> {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

interface PendingCallback {
    predicate: (callback: ServerCallback) => boolean;
    resolve: (callback: ServerCallback) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

export class MageRpcClient {
    private nextId = 0;
    private readonly pending = new Map<number, PendingRequest>();
    private readonly callbacks: ServerCallback[] = [];
    private readonly callbackWaiters: PendingCallback[] = [];

    private constructor(private readonly socket: WebSocket) { }

    static connect(url: string): Promise<MageRpcClient> {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(url);

            const cleanupListeners = () => {
                socket.removeEventListener('open', handleOpen);
                socket.removeEventListener('error', handleError);
            };

            const handleOpen = () => {
                cleanupListeners();
                resolve(new MageRpcClient(socket));
            };

            const handleError = () => {
                cleanupListeners();
                reject(new Error(`Unable to connect to Mage websocket at ${url}`));
            };

            socket.addEventListener('open', handleOpen);
            socket.addEventListener('error', handleError);
        });
    }

    send<T>(method: string, params: unknown[] = []): Promise<T> {
        if (this.socket.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('Mage websocket is not open'));
        }

        const id = ++this.nextId;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, 15_000);

            this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
            this.socket.send(JSON.stringify({ method, params, id }));
        });
    }

    listen(): void {
        this.socket.addEventListener('message', (event) => {
            const response = JSON.parse(String(event.data)) as JsonRpcResponse<unknown>;
            if (response.id === undefined) {
                this.recordCallback(response as ServerCallback);
                return;
            }

            const pending = this.pending.get(response.id);
            if (!pending) return;

            clearTimeout(pending.timeout);
            this.pending.delete(response.id);

            if (response.error) {
                pending.reject(new Error(response.error));
            } else {
                pending.resolve(response.result);
            }
        });
    }

    waitForCallback(
        predicate: (callback: ServerCallback) => boolean,
        label: string,
        timeoutMs = 30_000,
    ): Promise<ServerCallback> {
        const existing = this.callbacks.find(predicate);
        if (existing) {
            return Promise.resolve(existing);
        }

        return new Promise((resolve, reject) => {
            const waiter: PendingCallback = {
                predicate,
                resolve,
                reject,
                timeout: setTimeout(() => {
                    const index = this.callbackWaiters.indexOf(waiter);
                    if (index >= 0) this.callbackWaiters.splice(index, 1);
                    const methods = this.callbacks.map(callback => callback.method).join(', ');
                    reject(new Error(`Request timeout waiting for callback ${label}. Seen callbacks: ${methods}`));
                }, timeoutMs),
            };

            this.callbackWaiters.push(waiter);
        });
    }

    close(): void {
        for (const [id, pending] of this.pending.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Mage websocket closed'));
            this.pending.delete(id);
        }

        for (const waiter of this.callbackWaiters.splice(0)) {
            clearTimeout(waiter.timeout);
            waiter.reject(new Error('Mage websocket closed'));
        }

        this.socket.close(1000, 'Local E2E cleanup complete');
    }

    private recordCallback(callback: ServerCallback): void {
        if (!callback.method) return;

        this.callbacks.push(callback);

        for (const waiter of [...this.callbackWaiters]) {
            if (!waiter.predicate(callback)) continue;

            clearTimeout(waiter.timeout);
            this.callbackWaiters.splice(this.callbackWaiters.indexOf(waiter), 1);
            waiter.resolve(callback);
        }
    }
}

interface TrackedTable {
    id: string | null;
    name: string;
    gameIds: Set<string>;
}

type FixtureKind = 'table' | 'watchable-match' | 'finished-match' | 'replay' | 'sideboard-seed' | 'tournament' | 'draft' | 'draft-pick' | 'construction';

export interface LocalServerFixture {
    kind: FixtureKind;
    tableId: UUID;
    tableName: string;
    ownerUserName: string;
    aiName?: string;
    gameId?: UUID;
    matchId?: UUID;
    tournamentId?: UUID;
    draftId?: UUID;
    draftCardId?: UUID;
    draftCardMarked?: boolean;
    boosterLoaded?: boolean;
    draftPickSubmitted?: boolean;
    draftPickBoosterSize?: number;
    draftPicksSize?: number;
    deckSubmitted?: boolean;
    replayAvailable?: boolean;
    replayInitialized?: boolean;
    replayAdvanceCallback?: string;
    expectedState?: string;
}

function fixtureUserName(label: string): string {
    const runToken = (RUN_ID.replace(/[^a-z0-9]/gi, '').slice(-6) || 'run').padStart(3, '0');
    const labelToken = label.replace(/[^a-z0-9]/gi, '').slice(0, 3) || 'fx';
    return `w${runToken}${labelToken}${fixtureHash(label)}`.slice(0, 14);
}

function fixtureTableName(label: string): string {
    return `${TABLE_PREFIX} ${label}`;
}

function fixtureHash(input: string): string {
    let hash = 0;
    for (const character of `${RUN_ID}:${input}`) {
        hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    }

    return Math.abs(hash).toString(36).padStart(4, '0').slice(0, 4);
}

function isTableView(value: unknown): value is TableView {
    return Boolean(
        value
        && typeof value === 'object'
        && 'tableId' in value
        && 'tableName' in value,
    );
}

function isDraftPickView(value: unknown): value is DraftPickViewFixture {
    return Boolean(
        value
        && typeof value === 'object'
        && 'booster' in value
        && 'picks' in value
        && 'picking' in value,
    );
}

function draftPickViewFromCallback(callback: ServerCallback): DraftPickViewFixture {
    const data = callback.data;
    const draftPickView = data && typeof data === 'object' && 'draftPickView' in data
        ? (data as { draftPickView?: unknown }).draftPickView
        : null;

    if (!isDraftPickView(draftPickView)) {
        throw new Error(`Draft callback ${callback.method} did not include a draftPickView payload`);
    }

    return draftPickView;
}

function firstBoosterCardId(view: DraftPickViewFixture): UUID {
    const cardId = Object.keys(view.booster)[0];
    if (!cardId) {
        throw new Error('Draft pick payload did not include any booster cards');
    }

    return cardId;
}

function shouldCleanupLocalSavedGames(): boolean {
    try {
        const url = new URL(SERVER_URL);
        return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    } catch {
        return false;
    }
}

async function sweepRunTablesByController(annotate: (description: string) => void): Promise<void> {
    let inspector: MageRpcClient | null = null;
    const inspectorSessionId = randomUUID();

    try {
        inspector = await MageRpcClient.connect(SERVER_URL);
        inspector.listen();
        await inspector.send<boolean>('connectUser', [
            fixtureUserName('cleanup'),
            PASSWORD,
            inspectorSessionId,
            '',
            '',
            '',
        ]);
        const roomId = await inspector.send<UUID>('serverGetMainRoomId', []);
        const tables = await inspector.send<TableView[]>('roomGetAllTables', [roomId]);
        const runTables = tables.filter(table => table.tableName?.startsWith(SMOKE_TABLE_PREFIX));

        await inspector.send<boolean>('disconnectSession', [inspectorSessionId, false]).catch(() => undefined);
        inspector.close();
        inspector = null;

        for (const table of runTables) {
            await removeRunTableAsController(table, roomId, annotate);
        }
    } catch (error) {
        annotate(`Unable to sweep local smoke tables for "${SMOKE_TABLE_PREFIX}": ${String(error)}`);
    } finally {
        if (inspector) {
            await inspector.send<boolean>('disconnectSession', [inspectorSessionId, false]).catch(() => undefined);
            inspector.close();
        }
    }
}

async function removeRunTableAsController(
    table: TableView,
    roomId: UUID,
    annotate: (description: string) => void,
): Promise<void> {
    if (!table.controllerName) {
        annotate(`Unable to remove leftover table "${table.tableName}" (${table.tableId}): missing controller name`);
        await removeRunTableAsAdmin(table, annotate);
        return;
    }

    let client: MageRpcClient | null = null;
    const sessionId = randomUUID();

    try {
        client = await MageRpcClient.connect(SERVER_URL);
        client.listen();
        await client.send<boolean>('connectUser', [table.controllerName, PASSWORD, sessionId, '', '', '']);
        await client.send<boolean>('tableRemove', [sessionId, roomId, table.tableId]);
        await client.send<boolean>('disconnectSession', [sessionId, false]).catch(() => undefined);
    } catch (error) {
        annotate(`Unable to remove leftover table "${table.tableName}" (${table.tableId}) as "${table.controllerName}": ${String(error)}`);
    } finally {
        client?.close();
    }

    await removeRunTableAsAdmin(table, annotate);
}

async function removeRunTableAsAdmin(
    table: TableView,
    annotate: (description: string) => void,
): Promise<void> {
    let client: MageRpcClient | null = null;
    const sessionId = randomUUID();

    try {
        client = await MageRpcClient.connect(SERVER_URL);
        client.listen();
        await client.send<boolean>('connectAdmin', ['', sessionId]);
        await client.send<boolean>('adminTableRemove', [sessionId, table.tableId]);
        await client.send<boolean>('disconnectSession', [sessionId, false]).catch(() => undefined);
    } catch (error) {
        annotate(`Unable to remove leftover table "${table.tableName}" (${table.tableId}) through admin cleanup: ${String(error)}`);
    } finally {
        client?.close();
    }
}

async function removeLocalSavedGame(gameId: UUID, annotate: (description: string) => void): Promise<void> {
    if (!shouldCleanupLocalSavedGames()) {
        return;
    }

    const savedGamePath = resolve(LOCAL_SAVED_GAMES_DIR, `${gameId}.game`);
    for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
            await unlink(savedGamePath);
            return;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                annotate(`Unable to remove saved game "${savedGamePath}": ${String(error)}`);
                return;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 250));
    }
}

function createPauperMatchOptions(
    name: string,
    overrides: Partial<MatchOptionsFixture> = {},
): MatchOptionsFixture {
    return {
        name,
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Pauper',
        winsNeeded: 1,
        quitRatio: 100,
        freeMulligans: 0,
        matchTimeLimit: 'MIN__25',
        matchBufferTime: 'SEC__03',
        limited: false,
        rated: false,
        rollbackTurnsAllowed: true,
        spectatorsAllowed: true,
        playerTypes: ['Human', 'Human'],
        ...overrides,
    };
}

function createTournamentOptions(
    name: string,
    overrides: Partial<TournamentOptionsFixture> = {},
): TournamentOptionsFixture {
    const matchOptions = createPauperMatchOptions(`${name} match`, overrides.matchOptions);

    return {
        name,
        tournamentType: 'Constructed Swiss',
        playerTypes: ['HUMAN', 'COMPUTER_MAD'],
        matchOptions,
        watchingAllowed: true,
        planeChase: false,
        numberRounds: 1,
        password: '',
        quitRatio: 100,
        minimumRating: 0,
        ...overrides,
        matchOptions,
    };
}

export class LocalServerFixtureSession {
    private constructor(
        readonly userName: string,
        readonly password: string,
        readonly sessionId: string,
        readonly roomId: UUID,
        private readonly client: MageRpcClient,
    ) { }

    static async connect(label: string): Promise<LocalServerFixtureSession> {
        return this.connectUser(fixtureUserName(label), '');
    }

    static async reconnect(userName: string, restoreSessionId: string): Promise<LocalServerFixtureSession> {
        return this.connectUser(userName, restoreSessionId);
    }

    private static async connectUser(userName: string, restoreSessionId: string): Promise<LocalServerFixtureSession> {
        const client = await MageRpcClient.connect(SERVER_URL);
        client.listen();

        const sessionId = randomUUID();
        const connected = await client.send<boolean>('connectUser', [userName, PASSWORD, sessionId, restoreSessionId, '', '']);
        if (!connected) {
            throw new Error(`Unable to connect local fixture user ${userName}${restoreSessionId ? ' with restore session' : ''}`);
        }

        await client.send<boolean>('connectSetUserData', [
            userName,
            sessionId,
            {
                groupId: 0,
                avatarId: 51,
                allowRequestShowHandCards: false,
                flagName: 'world.png',
            },
            '1.0.0',
            '',
        ]).catch(() => undefined);
        const roomId = await client.send<UUID>('serverGetMainRoomId', []);

        return new LocalServerFixtureSession(userName, PASSWORD, sessionId, roomId, client);
    }

    async createTable(label: string, overrides: Partial<MatchOptionsFixture> = {}): Promise<TableView> {
        const tableName = fixtureTableName(label);
        const response = await this.client.send<TableView | boolean>('roomCreateTable', [
            this.sessionId,
            this.roomId,
            createPauperMatchOptions(tableName, overrides),
        ]);

        return this.resolveCreatedTable(tableName, response);
    }

    async createTournament(label: string, overrides: Partial<TournamentOptionsFixture> = {}): Promise<TableView> {
        const tableName = fixtureTableName(label);
        const response = await this.client.send<TableView | boolean>('roomCreateTournament', [
            this.sessionId,
            this.roomId,
            createTournamentOptions(tableName, overrides),
        ]);

        return this.resolveCreatedTable(tableName, response);
    }

    async joinTable(tableId: UUID, playerName: string, playerType: string, deckList: DeckCardLists): Promise<boolean> {
        return this.client.send<boolean>('roomJoinTable', [
            this.sessionId,
            this.roomId,
            tableId,
            playerName,
            playerType,
            5,
            deckList,
            '',
        ]);
    }

    async joinTournament(tableId: UUID, playerName: string, playerType: string, deckList: DeckCardLists): Promise<boolean> {
        return this.client.send<boolean>('roomJoinTournament', [
            this.sessionId,
            this.roomId,
            tableId,
            playerName,
            playerType,
            5,
            deckList,
            '',
        ]);
    }

    async startMatch(tableId: UUID): Promise<boolean> {
        return this.client.send<boolean>('matchStart', [this.sessionId, this.roomId, tableId]);
    }

    async joinGame(gameId: UUID): Promise<boolean> {
        return this.client.send<boolean>('gameJoin', [gameId, this.sessionId]);
    }

    async sendPlayerAction(action: string, gameId: UUID, data: unknown = null): Promise<boolean> {
        return this.client.send<boolean>('sendPlayerAction', [action, gameId, this.sessionId, data]);
    }

    async sendPlayerBoolean(gameId: UUID, value: boolean): Promise<boolean> {
        return this.client.send<boolean>('sendPlayerBoolean', [gameId, this.sessionId, value]);
    }

    async testEndGame(tableId: UUID): Promise<boolean> {
        return this.client.send<boolean>('testEndGame', [this.sessionId, tableId]);
    }

    async initReplay(gameId: UUID): Promise<boolean> {
        return this.client.send<boolean>('replayInit', [gameId, this.sessionId]);
    }

    async startReplay(gameId: UUID): Promise<boolean> {
        return this.client.send<boolean>('replayStart', [gameId, this.sessionId]);
    }

    async nextReplay(gameId: UUID): Promise<boolean> {
        return this.client.send<boolean>('replayNext', [gameId, this.sessionId]);
    }

    async stopReplay(gameId: UUID): Promise<boolean> {
        return this.client.send<boolean>('replayStop', [gameId, this.sessionId]);
    }

    async startTournament(tableId: UUID): Promise<boolean> {
        return this.client.send<boolean>('tournamentStart', [this.sessionId, this.roomId, tableId]);
    }

    async joinTournamentActivity(tournamentId: UUID): Promise<boolean> {
        return this.client.send<boolean>('tournamentJoin', [tournamentId, this.sessionId]);
    }

    async joinDraft(draftId: UUID): Promise<boolean> {
        return this.client.send<boolean>('draftJoin', [draftId, this.sessionId]);
    }

    async markDraftCard(draftId: UUID, cardId: UUID): Promise<boolean> {
        return this.client.send<boolean>('sendDraftCardMark', [draftId, this.sessionId, cardId]);
    }

    async setDraftBoosterLoaded(draftId: UUID): Promise<boolean> {
        return this.client.send<boolean>('draftSetBoosterLoaded', [draftId, this.sessionId]);
    }

    async pickDraftCard(draftId: UUID, cardId: UUID): Promise<DraftPickViewFixture | null> {
        return this.client.send<DraftPickViewFixture | null>('sendDraftCardPick', [draftId, this.sessionId, cardId, []]);
    }

    async submitDeck(tableId: UUID, deckList: DeckCardLists): Promise<boolean> {
        return this.client.send<boolean>('deckSubmit', [this.sessionId, tableId, deckList]);
    }

    waitForCallback(
        method: string,
        objectId?: UUID,
        timeoutMs = 30_000,
    ): Promise<ServerCallback> {
        return this.client.waitForCallback(
            callback => callback.method === method && (!objectId || callback.objectId === objectId),
            objectId ? `${method}:${objectId}` : method,
            timeoutMs,
        );
    }

    waitForAnyCallback(
        methods: string[],
        objectId?: UUID,
        timeoutMs = 30_000,
    ): Promise<ServerCallback> {
        return this.client.waitForCallback(
            callback => methods.includes(callback.method) && (!objectId || callback.objectId === objectId),
            objectId ? `${methods.join('|')}:${objectId}` : methods.join('|'),
            timeoutMs,
        );
    }

    async getTable(tableId: UUID): Promise<TableView> {
        return this.client.send<TableView>('roomGetTableById', [this.roomId, tableId]);
    }

    async getTables(): Promise<TableView[]> {
        return this.client.send<TableView[]>('roomGetAllTables', [this.roomId]);
    }

    async getFinishedMatches(): Promise<MatchView[]> {
        return this.client.send<MatchView[]>('roomGetFinishedMatches', [this.roomId]);
    }

    async removeTable(tableId: UUID): Promise<boolean> {
        return this.client.send<boolean>('tableRemove', [this.sessionId, this.roomId, tableId]);
    }

    async waitForTableState(tableId: UUID, expectedState: string, timeoutMs = 20_000): Promise<TableView> {
        const deadline = Date.now() + timeoutMs;
        let lastTable = await this.getTable(tableId);

        while (Date.now() < deadline) {
            lastTable = await this.getTable(tableId);
            if (lastTable.tableState === expectedState || lastTable.tableStateText === expectedState) {
                return lastTable;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error(`Table ${tableId} stayed ${lastTable.tableState}/${lastTable.tableStateText}; expected ${expectedState}`);
    }

    async waitForTableGame(tableId: UUID, timeoutMs = 20_000): Promise<UUID> {
        const deadline = Date.now() + timeoutMs;
        let lastTable = await this.getTable(tableId);

        while (Date.now() < deadline) {
            lastTable = await this.getTable(tableId);
            const gameId = lastTable.games?.[0];
            if (gameId) {
                return gameId;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error(`Table ${tableId} did not expose a game id. Last table: ${JSON.stringify(lastTable)}`);
    }

    async waitForFinishedMatch(tableId: UUID, matchName: string, gameId?: UUID, timeoutMs = 60_000): Promise<MatchView> {
        const deadline = Date.now() + timeoutMs;
        let lastMatches: MatchView[] = [];

        while (Date.now() < deadline) {
            lastMatches = await this.getFinishedMatches();
            const match = lastMatches.find((candidate) => (
                candidate.tableId === tableId
                || candidate.matchName === matchName
                || Boolean(gameId && candidate.games?.includes(gameId))
            ));

            if (match) {
                return match;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const matchNames = lastMatches.map(match => match.matchName).join(', ');
        throw new Error(`Finished match "${matchName}" was not visible in roomGetFinishedMatches. Last matches: ${matchNames}`);
    }

    private async resolveCreatedTable(tableName: string, response: TableView | boolean): Promise<TableView> {
        if (isTableView(response)) {
            return response;
        }

        if (response === false) {
            throw new Error(`Server rejected fixture table creation for "${tableName}"`);
        }

        return this.waitForTableByName(tableName);
    }

    private async waitForTableByName(tableName: string, timeoutMs = 20_000): Promise<TableView> {
        const deadline = Date.now() + timeoutMs;
        let lastTables: TableView[] = [];

        while (Date.now() < deadline) {
            lastTables = await this.getTables();
            const table = lastTables.find((candidate) => candidate.tableName === tableName);
            if (table) {
                return table;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const tableNames = lastTables.map(table => table.tableName).join(', ');
        throw new Error(`Created fixture table "${tableName}" was not visible in roomGetAllTables. Last tables: ${tableNames}`);
    }

    async disconnect(keepGames = true): Promise<void> {
        await this.client.send<boolean>('disconnectSession', [this.sessionId, keepGames]).catch(() => undefined);
        this.client.close();
    }
}

export class LocalServerFixtureManager {
    private readonly sessions: LocalServerFixtureSession[] = [];
    private readonly fixtures: Array<{ fixture: LocalServerFixture; owner: LocalServerFixtureSession }> = [];

    constructor(private readonly testInfo: TestInfo) { }

    async createReadyTable(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTable(label, { playerTypes: ['Human', 'Human'] });
        const fixture = this.track(owner, {
            kind: 'table',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            expectedState: 'WAITING',
        });

        return fixture;
    }

    async createSideboardSeed(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTable(label, {
            winsNeeded: 2,
            playerTypes: ['Human', 'Human'],
            spectatorsAllowed: true,
        });
        const fixture = this.track(owner, {
            kind: 'sideboard-seed',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            aiName: owner.userName,
            expectedState: 'WAITING',
        });
        await owner.joinTable(table.tableId, owner.userName, 'Human', SMOKE_SIDEBOARD_DECK_LIST);

        return fixture;
    }

    async startSideboardMatch(fixture: LocalServerFixture): Promise<LocalServerFixture> {
        const entry = this.fixtures.find(candidate => candidate.fixture === fixture);
        if (!entry) {
            throw new Error(`Fixture ${fixture.tableName} is not tracked by this manager`);
        }

        const { owner } = entry;
        await owner.startMatch(fixture.tableId);
        await owner.waitForTableState(fixture.tableId, 'DUELING', 30_000);
        const gameId = await owner.waitForTableGame(fixture.tableId, 30_000);
        await owner.joinGame(gameId).catch(() => undefined);

        Object.assign(fixture, {
            gameId,
            expectedState: 'DUELING',
        });

        return fixture;
    }

    async endSideboardGameOne(fixture: LocalServerFixture): Promise<LocalServerFixture> {
        const entry = this.fixtures.find(candidate => candidate.fixture === fixture);
        if (!entry) {
            throw new Error(`Fixture ${fixture.tableName} is not tracked by this manager`);
        }
        if (!fixture.gameId) {
            throw new Error(`Fixture ${fixture.tableName} does not have an active game id`);
        }

        const { owner } = entry;
        const ended = await owner.testEndGame(fixture.tableId);
        if (!ended) {
            throw new Error(`Server rejected testEndGame for ${fixture.tableName}. Restart the local server in test mode with the websocket testEndGame handler.`);
        }

        return fixture;
    }

    async submitFixtureSideboard(fixture: LocalServerFixture): Promise<boolean> {
        const entry = this.fixtures.find(candidate => candidate.fixture === fixture);
        if (!entry) {
            throw new Error(`Fixture ${fixture.tableName} is not tracked by this manager`);
        }

        return entry.owner.submitDeck(fixture.tableId, SMOKE_SIDEBOARD_DECK_LIST);
    }

    async endCurrentFixtureGame(fixture: LocalServerFixture): Promise<LocalServerFixture> {
        const entry = this.fixtures.find(candidate => candidate.fixture === fixture);
        if (!entry) {
            throw new Error(`Fixture ${fixture.tableName} is not tracked by this manager`);
        }

        const { owner } = entry;
        if (!fixture.gameId) {
            const gameId = await owner.waitForTableGame(fixture.tableId, 2_000).catch(() => undefined);
            if (gameId) {
                Object.assign(fixture, { gameId });
            }
        }

        const ended = await owner.testEndGame(fixture.tableId);
        if (!ended) {
            throw new Error(`Server rejected testEndGame for ${fixture.tableName}. Restart the local server in test mode with the websocket testEndGame handler.`);
        }

        return fixture;
    }

    async waitForFixtureTableState(
        fixture: LocalServerFixture,
        expectedState: string,
        timeoutMs = 20_000,
    ): Promise<TableView> {
        const entry = this.fixtures.find(candidate => candidate.fixture === fixture);
        if (!entry) {
            throw new Error(`Fixture ${fixture.tableName} is not tracked by this manager`);
        }

        return entry.owner.waitForTableState(fixture.tableId, expectedState, timeoutMs);
    }

    async createWatchableMatch(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTable(label, {
            playerTypes: ['Human', 'Computer - mad'],
            spectatorsAllowed: true,
        });
        const aiName = `${label} AI`;

        await owner.joinTable(table.tableId, owner.userName, 'Human', SMOKE_SIDEBOARD_DECK_LIST);
        await owner.joinTable(table.tableId, aiName, 'Computer - mad', SMOKE_SIDEBOARD_DECK_LIST);
        await owner.startMatch(table.tableId);
        await owner.waitForTableState(table.tableId, 'DUELING');
        const gameId = await owner.waitForTableGame(table.tableId);

        return this.track(owner, {
            kind: 'watchable-match',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            aiName,
            gameId,
            expectedState: 'DUELING',
        });
    }

    async createFinishedMatch(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTable(label, {
            playerTypes: ['Human', 'Computer - mad'],
            spectatorsAllowed: true,
        });
        const aiName = `${label} AI`;

        await owner.joinTable(table.tableId, owner.userName, 'Human', SMOKE_DECK_LIST);
        await owner.joinTable(table.tableId, aiName, 'Computer - mad', SMOKE_DECK_LIST);
        await owner.startMatch(table.tableId);
        await owner.waitForTableState(table.tableId, 'DUELING');

        const gameId = await owner.waitForTableGame(table.tableId);
        await owner.joinGame(gameId).catch(() => undefined);
        await owner.waitForCallback('GAME_INIT', gameId, 30_000).catch(() => undefined);
        await owner.sendPlayerAction('CONCEDE', gameId);

        const finishedMatch = await owner.waitForFinishedMatch(table.tableId, table.tableName, gameId);

        return this.track(owner, {
            kind: 'finished-match',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            aiName,
            gameId,
            matchId: finishedMatch.matchId,
            replayAvailable: finishedMatch.replayAvailable,
            expectedState: 'FINISHED',
        });
    }

    async createReplayableFinishedMatch(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTable(label, {
            playerTypes: ['Human', 'Computer - mad'],
            spectatorsAllowed: true,
        });
        const aiName = `${label} AI`;
        const fixture = this.track(owner, {
            kind: 'replay',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            aiName,
            expectedState: 'WAITING',
        });

        await owner.joinTable(table.tableId, owner.userName, 'Human', SMOKE_DECK_LIST);
        await owner.joinTable(table.tableId, aiName, 'Computer - mad', SMOKE_DECK_LIST);
        await owner.startMatch(table.tableId);
        await owner.waitForTableState(table.tableId, 'DUELING');

        const gameId = await owner.waitForTableGame(table.tableId);
        Object.assign(fixture, { gameId, expectedState: 'DUELING' });
        await owner.joinGame(gameId).catch(() => undefined);
        await owner.waitForCallback('GAME_INIT', gameId, 30_000);
        await owner.waitForAnyCallback(['GAME_UPDATE', 'GAME_ASK', 'GAME_TARGET', 'PRIORITY'], gameId, 30_000).catch(() => undefined);
        await new Promise(resolve => setTimeout(resolve, 500));
        await owner.sendPlayerAction('CONCEDE', gameId);

        const finishedMatch = await owner.waitForFinishedMatch(table.tableId, table.tableName, gameId);
        if (!finishedMatch.replayAvailable) {
            throw new Error(
                `Finished match ${finishedMatch.matchId} is not replayable. Start the local server with saveGameActivated=true before setting MAGE_E2E_REPLAY_FLOWS=1.`,
            );
        }

        await owner.initReplay(gameId);
        await owner.waitForCallback('REPLAY_GAME', gameId, 30_000);
        await owner.startReplay(gameId);
        await owner.waitForCallback('REPLAY_INIT', gameId, 30_000);
        await owner.nextReplay(gameId);
        const replayAdvance = await owner.waitForAnyCallback(['REPLAY_UPDATE', 'REPLAY_DONE'], gameId, 30_000);
        if (replayAdvance.method !== 'REPLAY_DONE') {
            await owner.stopReplay(gameId);
            await owner.waitForCallback('REPLAY_DONE', gameId, 30_000).catch(() => undefined);
        }

        Object.assign(fixture, {
            gameId,
            matchId: finishedMatch.matchId,
            replayAvailable: true,
            replayInitialized: true,
            replayAdvanceCallback: replayAdvance.method,
            expectedState: 'FINISHED',
        });

        return fixture;
    }

    async createTournamentTable(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTournament(label, {
            tournamentType: 'Constructed Swiss',
            playerTypes: ['HUMAN', 'COMPUTER_MAD'],
            matchOptions: createPauperMatchOptions(`${fixtureTableName(label)} match`),
        });

        return this.track(owner, {
            kind: 'tournament',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            expectedState: 'WAITING',
        });
    }

    async createDraftTable(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTournament(label, {
            tournamentType: 'Booster Draft Swiss',
            playerTypes: ['HUMAN', 'COMPUTER_DRAFT_BOT'],
            matchOptions: createPauperMatchOptions(`${fixtureTableName(label)} draft match`, {
                deckType: 'Limited',
                limited: true,
            }),
            limitedOptions: {
                sets: ['M11', 'M11', 'M11'],
                constructionTime: 0,
                timing: 'REGULAR',
            },
        });

        return this.track(owner, {
            kind: 'draft',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            expectedState: 'WAITING',
        });
    }

    async createDraftConstructionTable(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTournament(label, {
            tournamentType: 'Booster Draft Swiss',
            playerTypes: ['HUMAN', 'COMPUTER_DRAFT_BOT'],
            matchOptions: createPauperMatchOptions(`${fixtureTableName(label)} draft match`, {
                deckType: 'Limited',
                limited: true,
            }),
            limitedOptions: {
                sets: ['M11'],
                constructionTime: 60,
                numberBoosters: 1,
                timing: 'REGULAR',
            },
        });

        return this.track(owner, {
            kind: 'draft',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            expectedState: 'WAITING',
        });
    }

    async startDraft(fixture: LocalServerFixture): Promise<LocalServerFixture> {
        const entry = this.fixtures.find(candidate => candidate.fixture === fixture);
        if (!entry) {
            throw new Error(`Fixture ${fixture.tableName} is not tracked by this manager`);
        }
        const { owner } = entry;
        const aiName = fixture.aiName ?? `${fixture.tableName} draftbot`;

        await owner.joinTournament(fixture.tableId, aiName, 'Computer - draftbot', SMOKE_DECK_LIST);
        await owner.startTournament(fixture.tableId);
        await owner.waitForTableState(fixture.tableId, 'DRAFTING', 30_000);

        Object.assign(fixture, {
            aiName,
            expectedState: 'DRAFTING',
        });

        return fixture;
    }

    async createDraftPickSeed(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTournament(label, {
            tournamentType: 'Booster Draft Swiss',
            playerTypes: ['HUMAN', 'COMPUTER_DRAFT_BOT'],
            matchOptions: createPauperMatchOptions(`${fixtureTableName(label)} draft match`, {
                deckType: 'Limited',
                limited: true,
            }),
            limitedOptions: {
                sets: ['M11', 'M11', 'M11'],
                constructionTime: 60,
                timing: 'REGULAR',
            },
        });
        const aiName = `${label} draftbot`;
        const fixture = this.track(owner, {
            kind: 'draft-pick',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            aiName,
            expectedState: 'WAITING',
        });

        await owner.joinTournament(table.tableId, owner.userName, 'Human', SMOKE_DECK_LIST);
        await owner.joinTournament(table.tableId, aiName, 'Computer - draftbot', SMOKE_DECK_LIST);
        await owner.startTournament(table.tableId);

        const tournamentStarted = await owner.waitForCallback('START_TOURNAMENT', undefined, 20_000);
        if (!tournamentStarted.objectId) {
            throw new Error(`Started draft tournament for ${table.tableName} did not include a tournament id`);
        }

        await owner.joinTournamentActivity(tournamentStarted.objectId);

        const draftStarted = await owner.waitForCallback('START_DRAFT', undefined, 20_000);
        if (!draftStarted.objectId) {
            throw new Error(`Started draft for ${table.tableName} did not include a draft id`);
        }

        await owner.joinDraft(draftStarted.objectId);
        await owner.waitForCallback('DRAFT_INIT', draftStarted.objectId, 20_000);

        const draftPick = await owner.waitForCallback('DRAFT_PICK', draftStarted.objectId, 60_000);
        const draftPickView = draftPickViewFromCallback(draftPick);
        const draftCardId = firstBoosterCardId(draftPickView);

        const draftCardMarked = await owner.markDraftCard(draftStarted.objectId, draftCardId);
        const boosterLoaded = await owner.setDraftBoosterLoaded(draftStarted.objectId);
        const pickResult = await owner.pickDraftCard(draftStarted.objectId, draftCardId);
        if (!pickResult || pickResult.picking || Object.keys(pickResult.picks).length === 0) {
            throw new Error(`Draft card pick for ${table.tableName} did not return a picked-card payload`);
        }

        await owner.waitForTableState(table.tableId, 'DRAFTING', 10_000);

        Object.assign(fixture, {
            tournamentId: tournamentStarted.objectId,
            draftId: draftStarted.objectId,
            draftCardId,
            draftCardMarked,
            boosterLoaded,
            draftPickSubmitted: true,
            draftPickBoosterSize: Object.keys(draftPickView.booster).length,
            draftPicksSize: Object.keys(pickResult.picks).length,
            expectedState: 'DRAFTING',
        });

        return fixture;
    }

    async createLimitedConstructionSubmit(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTournament(label, {
            tournamentType: 'Sealed Swiss',
            playerTypes: ['HUMAN', 'COMPUTER_MAD'],
            matchOptions: createPauperMatchOptions(`${fixtureTableName(label)} sealed match`, {
                deckType: 'Limited',
                winsNeeded: 2,
                limited: true,
                playerTypes: ['Human', 'Computer - mad'],
            }),
            limitedOptions: {
                sets: ['M11', 'M11', 'M11', 'M11', 'M11', 'M11'],
                constructionTime: 60,
                numberBoosters: 6,
            },
        });
        const aiName = `${label} AI`;
        const fixture = this.track(owner, {
            kind: 'construction',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            aiName,
            expectedState: 'WAITING',
        });

        await owner.joinTournament(table.tableId, owner.userName, 'Human', SMOKE_DECK_LIST);
        await owner.joinTournament(table.tableId, aiName, 'Computer - mad', SMOKE_DECK_LIST);
        await owner.startTournament(table.tableId);

        const tournamentStarted = await owner.waitForCallback('START_TOURNAMENT', undefined, 20_000);
        if (!tournamentStarted.objectId) {
            throw new Error(`Started tournament for ${table.tableName} did not include a tournament id`);
        }

        await owner.joinTournamentActivity(tournamentStarted.objectId);
        await owner.waitForCallback('CONSTRUCT', table.tableId, 45_000);
        await owner.waitForTableState(table.tableId, 'CONSTRUCTING', 20_000);

        const deckSubmitted = await owner.submitDeck(table.tableId, SMOKE_LIMITED_SUBMIT_DECK_LIST);
        if (!deckSubmitted) {
            throw new Error(`Server rejected limited construction deck submit for ${table.tableName}`);
        }

        await owner.waitForTableState(table.tableId, 'DUELING', 20_000);
        const gameStarted = await owner.waitForCallback('START_GAME', undefined, 20_000);
        if (!gameStarted.objectId) {
            throw new Error(`Started limited construction game for ${table.tableName} did not include a game id`);
        }

        Object.assign(fixture, {
            tournamentId: tournamentStarted.objectId,
            gameId: gameStarted.objectId,
            deckSubmitted,
            expectedState: 'DUELING',
        });

        return fixture;
    }

    async createLimitedConstructionTable(label: string): Promise<LocalServerFixture> {
        const owner = await this.createSession(`${label}-owner`);
        const table = await owner.createTournament(label, {
            tournamentType: 'Sealed Swiss',
            playerTypes: ['HUMAN', 'COMPUTER_MAD'],
            matchOptions: createPauperMatchOptions(`${fixtureTableName(label)} sealed match`, {
                deckType: 'Limited',
                winsNeeded: 2,
                limited: true,
                playerTypes: ['Human', 'Computer - mad'],
            }),
            limitedOptions: {
                sets: ['M11', 'M11', 'M11', 'M11', 'M11', 'M11'],
                constructionTime: 60,
                numberBoosters: 6,
            },
        });

        return this.track(owner, {
            kind: 'construction',
            tableId: table.tableId,
            tableName: table.tableName,
            ownerUserName: owner.userName,
            aiName: `${label} AI`,
            expectedState: 'WAITING',
        });
    }

    async startLimitedConstruction(fixture: LocalServerFixture): Promise<LocalServerFixture> {
        const entry = this.fixtures.find(candidate => candidate.fixture === fixture);
        if (!entry) {
            throw new Error(`Fixture ${fixture.tableName} is not tracked by this manager`);
        }
        const { owner } = entry;
        const aiName = fixture.aiName ?? `${fixture.tableName} AI`;

        await owner.joinTournament(fixture.tableId, aiName, 'Computer - mad', SMOKE_DECK_LIST);
        await owner.startTournament(fixture.tableId);
        await owner.waitForTableState(fixture.tableId, 'CONSTRUCTING', 30_000);

        Object.assign(fixture, {
            aiName,
            expectedState: 'CONSTRUCTING',
        });

        return fixture;
    }

    async cleanup(): Promise<void> {
        for (const { fixture, owner } of [...this.fixtures].reverse()) {
            await owner.removeTable(fixture.tableId).catch((error) => {
                this.annotate(`Unable to remove fixture table "${fixture.tableName}" (${fixture.tableId}): ${String(error)}`);
            });
            await this.removeSavedGame(fixture);
        }

        for (const session of [...this.sessions].reverse()) {
            await session.disconnect(false).catch((error) => {
                this.annotate(`Unable to disconnect fixture session "${session.userName}": ${String(error)}`);
            });
        }

        await sweepRunTablesByController(description => this.annotate(description));
    }

    private async createSession(label: string): Promise<LocalServerFixtureSession> {
        const session = await LocalServerFixtureSession.connect(label);
        this.sessions.push(session);
        return session;
    }

    private track(owner: LocalServerFixtureSession, fixture: LocalServerFixture): LocalServerFixture {
        this.fixtures.push({ owner, fixture });
        return fixture;
    }

    private async removeSavedGame(fixture: LocalServerFixture): Promise<void> {
        if (!fixture.gameId || !shouldCleanupLocalSavedGames()) {
            return;
        }

        await removeLocalSavedGame(fixture.gameId, description => this.annotate(description));
    }

    private annotate(description: string): void {
        this.testInfo.annotations.push({ type: 'fixture-cleanup', description });
    }
}

export function configureLocalServerSuite(): void {
    test.skip(!RUN_LOCAL_SERVER_SMOKE, LOCAL_SERVER_SKIP_MESSAGE);
    test.describe.configure({ mode: 'serial' });
}

export function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class LocalServerHarness {
    private readonly trackedTables = new Map<string, TrackedTable>();

    constructor(
        private readonly page: Page,
        private readonly testInfo: TestInfo,
    ) { }

    tableName(label: string): string {
        return `${TABLE_PREFIX} ${label}`;
    }

    tableRow(name: string): Locator {
        return this.page.getByTestId('table-row').filter({ hasText: name });
    }

    trackCreatedTable(name: string, id: string | null): void {
        this.trackTable(name, id);
    }

    async expectTableRowState(name: string, state: RegExp | string): Promise<Locator> {
        const row = this.tableRow(name);
        await expect(row).toBeVisible({ timeout: 20_000 });
        await expect(row).toContainText(state, { timeout: 20_000 });
        return row;
    }

    async expectTableDetails(name: string, state: RegExp | string): Promise<Locator> {
        const row = await this.expectTableRowState(name, state);
        await row.click();

        const details = this.page.getByTestId('table-details');
        await expect(details).toBeVisible({ timeout: 10_000 });
        await expect(details.getByTestId('table-details-name')).toContainText(name);
        await expect(details.getByTestId('table-details-status')).toContainText(state);
        return details;
    }

    async expectWatchActionForTable(name: string): Promise<void> {
        const details = await this.expectTableDetails(name, /In Game|Game in progress|DUELING/i);
        await expect(details.getByTestId('watch-table-button')).toBeVisible();
    }

    async expectActivityWorkspace(kind: string, title?: RegExp | string): Promise<Locator> {
        const workspace = this.page.getByTestId('activity-workspace');
        await expect(workspace).toBeVisible({ timeout: 10_000 });
        await expect(workspace).toHaveAttribute('data-activity-kind', kind);

        if (title) {
            await expect(workspace.getByTestId('activity-workspace-title')).toContainText(title);
        }

        return workspace;
    }

    async expectTrackedActivity(kind: string, status?: string): Promise<Locator> {
        const activity = this.page.locator(`[data-testid="tracked-activity"][data-activity-kind="${kind}"]`).first();

        await expect(activity).toBeVisible({ timeout: 10_000 });

        if (status) {
            await expect(activity).toHaveAttribute('data-activity-status', status);
        }

        return activity;
    }

    async login(): Promise<void> {
        await this.page.goto('/', { waitUntil: 'domcontentloaded' });
        const endpoint = new URL(SERVER_URL);
        await this.page.getByTestId('login-server-host').fill(endpoint.hostname);
        await this.page.getByTestId('login-server-port').fill(endpoint.port || '17172');
        await this.page.getByTestId('login-server-protocol').selectOption(endpoint.protocol === 'wss:' ? 'wss' : 'ws');
        await this.page.getByLabel('Username').fill(USERNAME);
        await this.page.getByLabel('Password').fill(PASSWORD);
        await this.page.getByRole('button', { name: /^Connect$/ }).click();
        await this.expectLobbyReady();
    }

    async expectLobbyReady(): Promise<void> {
        await expect(this.page.getByRole('heading', { name: 'Game Tables' })).toBeVisible({ timeout: 20_000 });
        await expect(this.page.getByRole('navigation')).toContainText('Lobby');
        await expect(this.page.getByRole('button', { name: /Create Table/i })).toBeVisible();
    }

    async expectDeckManagerReady(): Promise<void> {
        await expect(this.page.getByRole('heading', { name: 'DECKS' })).toBeVisible();
    }

    async expectWaitingRoomReady(expectedSeats: RegExp = /\d+\/\d+/): Promise<void> {
        const waitingRoom = this.page.getByTestId('waiting-room');
        await expect(waitingRoom).toBeVisible({ timeout: 20_000 });
        await expect(waitingRoom.getByTestId('waiting-room-status')).toBeVisible();
        await expect(waitingRoom.getByTestId('waiting-room-seats')).toBeVisible();
        await expect(waitingRoom.getByTestId('waiting-room-seats')).toContainText(expectedSeats, { timeout: 20_000 });
    }

    async expectNormalGameReady(aiName: string): Promise<void> {
        await expect(this.page.getByTestId('game-page')).toBeVisible({ timeout: 60_000 });
        await expect(this.page.getByTestId('player-hud')).toContainText(USERNAME);
        await expect(this.page.getByTestId('opponent-hud')).toContainText(aiName);
        await expect(this.page.getByTestId('game-phase-region')).toContainText(/Turn \d+/);
        await this.captureTrackedTableGameIds().catch((error) => {
            this.annotateCleanup(`Unable to capture tracked game id after game start: ${String(error)}`);
        });
    }

    async expectZoneDialogReady(name: RegExp | string): Promise<Locator> {
        const dialog = this.page.getByRole('dialog', { name });
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        return dialog;
    }

    async pasteDeck(deckText = SMOKE_DECK): Promise<void> {
        await this.page.getByRole('button', { name: 'Paste Deck' }).click();
        const pasteDialog = await this.expectZoneDialogReady('Paste Deck');
        await pasteDialog.locator('textarea.deck-picker-textarea').fill(deckText);
        await pasteDialog.getByRole('button', { name: 'Import' }).click();
        await expect(pasteDialog).toBeHidden({ timeout: 20_000 });
    }

    async createPauperTable(name: string): Promise<Locator> {
        await this.page.getByRole('button', { name: /Create Table/i }).click();
        await this.page.getByTestId('create-table-name-input').fill(name);
        await this.page.getByLabel('Format').selectOption('Constructed - Pauper');
        await this.page.getByRole('dialog').getByRole('button', { name: 'Create Table' }).click();

        const row = this.tableRow(name);
        await expect(row).toBeVisible({ timeout: 20_000 });
        await row.click();
        this.trackTable(name, await row.getAttribute('data-table-id'));
        return row;
    }

    async joinSelectedTableWithDeck(name: string, expectedSeats: RegExp = /1\/2/): Promise<void> {
        await this.page.getByRole('button', { name: 'Join Table' }).click();
        const joinDialog = await this.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(name)}`));
        await this.pasteDeck();
        await expect(joinDialog.getByText(/60 cards/)).toBeVisible({ timeout: 20_000 });
        await joinDialog.getByRole('button', { name: 'Join Table' }).click();
        await this.expectWaitingRoomReady(expectedSeats);
    }

    async addAiOpponent(aiName: string): Promise<void> {
        const waitingRoom = this.page.getByTestId('waiting-room');
        await waitingRoom.getByRole('button', { name: 'Add AI' }).click();

        const aiDialog = await this.expectZoneDialogReady('Add AI Player');
        await aiDialog.getByLabel('AI Player Name').fill(aiName);
        await this.pasteDeck();
        await expect(aiDialog.getByText(/60 cards/)).toBeVisible({ timeout: 20_000 });
        await aiDialog.getByRole('button', { name: 'Add AI Player' }).click();

        await expect(aiDialog).toBeHidden({ timeout: 20_000 });
        await expect(waitingRoom).toContainText(aiName, { timeout: 20_000 });
        await this.expectWaitingRoomReady(/2\/2/);
        await expect(waitingRoom.getByRole('button', { name: 'Start Match' })).toBeEnabled({ timeout: 10_000 });
    }

    async cleanup(): Promise<void> {
        await this.closeVisibleDialogs();
        await this.captureTrackedTableGameIds().catch((error) => {
            this.annotateCleanup(`Unable to capture tracked game ids during cleanup: ${String(error)}`);
        });
        await this.leaveVisibleActivity();
        await this.removeTrackedTables();
        await this.removeSavedGamesForTrackedTables();
        await sweepRunTablesByController(description => this.annotateCleanup(description));
    }

    private trackTable(name: string, id: string | null): void {
        this.trackedTables.set(name, { id, name, gameIds: new Set() });
    }

    private async captureTrackedTableGameIds(): Promise<void> {
        const trackedTables = [...this.trackedTables.values()].filter((table) => table.id);
        if (trackedTables.length === 0) return;

        let client: MageRpcClient | null = null;
        const cleanupSessionId = randomUUID();

        try {
            client = await MageRpcClient.connect(SERVER_URL);
            client.listen();
            await client.send<boolean>('connectUser', [USERNAME, PASSWORD, cleanupSessionId, '', '', '']);
            const roomId = await client.send<string>('serverGetMainRoomId', []);

            for (const table of trackedTables) {
                const tableView = await client.send<TableView | null>('roomGetTableById', [roomId, table.id]).catch(() => null);
                for (const gameId of tableView?.games ?? []) {
                    table.gameIds.add(gameId);
                }
            }

            await client.send<boolean>('disconnectSession', [cleanupSessionId, false]).catch(() => undefined);
        } finally {
            client?.close();
        }
    }

    private async closeVisibleDialogs(): Promise<void> {
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const dialogs = this.page.getByRole('dialog');
            const count = await dialogs.count().catch(() => 0);
            if (count === 0) return;

            const dialog = dialogs.nth(count - 1);
            if (!(await dialog.isVisible().catch(() => false))) return;

            const cancelOrClose = dialog.getByRole('button', { name: /^(Cancel|Close modal|Close)$/i }).first();
            if (await cancelOrClose.isVisible().catch(() => false)) {
                await cancelOrClose.click({ timeout: 2_000 }).catch(() => undefined);
            } else {
                await this.page.keyboard.press('Escape').catch(() => undefined);
            }

            await expect(dialog).toBeHidden({ timeout: 2_000 }).catch(() => undefined);
        }
    }

    private async leaveVisibleActivity(): Promise<void> {
        const gamePage = this.page.getByTestId('game-page');
        if (await gamePage.isVisible().catch(() => false)) {
            const leaveButton = this.page.getByRole('button', { name: 'Concede / Leave' });
            if (!(await leaveButton.isVisible().catch(() => false))) {
                await this.page.getByTestId('game-sidebar-toggle').click({ timeout: 2_000 }).catch(() => undefined);
            }

            await this.page.getByRole('button', { name: 'Concede / Leave' }).click({ timeout: 5_000 }).catch((error) => {
                this.annotateCleanup(`Unable to leave visible game through UI: ${String(error)}`);
            });
            await expect(gamePage).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
        }

        const waitingRoom = this.page.getByTestId('waiting-room');
        if (await waitingRoom.isVisible().catch(() => false)) {
            await waitingRoom.getByRole('button', { name: 'Leave Table' }).click({ timeout: 5_000 }).catch((error) => {
                this.annotateCleanup(`Unable to leave waiting room through UI: ${String(error)}`);
            });
            await expect(waitingRoom).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
        }
    }

    private async removeTrackedTables(): Promise<void> {
        const trackedTables = [...this.trackedTables.values()].filter((table) => table.id);
        if (trackedTables.length === 0) return;

        let client: MageRpcClient | null = null;
        const cleanupSessionId = randomUUID();

        try {
            client = await MageRpcClient.connect(SERVER_URL);
            client.listen();
            await client.send<boolean>('connectUser', [USERNAME, PASSWORD, cleanupSessionId, '', '', '']);
            const roomId = await client.send<string>('serverGetMainRoomId', []);

            for (const table of trackedTables) {
                try {
                    await client.send<boolean>('tableRemove', [cleanupSessionId, roomId, table.id]);
                } catch (error) {
                    this.annotateCleanup(`Unable to remove table "${table.name}" (${table.id}): ${String(error)}`);
                }
            }

            await client.send<boolean>('disconnectSession', [cleanupSessionId, false]).catch(() => undefined);
        } catch (error) {
            this.annotateCleanup(`Unable to open cleanup session: ${String(error)}`);
        } finally {
            client?.close();
        }
    }

    private async removeSavedGamesForTrackedTables(): Promise<void> {
        const gameIds = new Set([...this.trackedTables.values()].flatMap(table => [...table.gameIds]));
        for (const gameId of gameIds) {
            await removeLocalSavedGame(gameId, description => this.annotateCleanup(description));
        }
    }

    private annotateCleanup(description: string): void {
        this.testInfo.annotations.push({ type: 'cleanup', description });
    }
}
