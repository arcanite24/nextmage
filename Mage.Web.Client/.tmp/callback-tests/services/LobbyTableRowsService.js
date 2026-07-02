import { TableState } from '../types/index.js';
export const LOBBY_TABLE_COLUMN_KEYS = [
    'kind',
    'deckType',
    'name',
    'seats',
    'ownerPlayers',
    'gameType',
    'info',
    'status',
    'password',
    'created',
    'skill',
    'rated',
    'quitRatio',
    'minimumRating',
    'action',
];
export function buildLobbyTableRows(tables, finishedMatches, currentUserName) {
    return [
        ...tables.map(table => buildTableRow(table, currentUserName)),
        ...finishedMatches.map(buildMatchRow),
    ];
}
export function sortLobbyTableRows(rows, sort) {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
        const comparison = compareRows(left, right, sort.key);
        if (comparison !== 0)
            return comparison * direction;
        return (left.createdTimestamp - right.createdTimestamp) * -1
            || left.name.localeCompare(right.name)
            || left.key.localeCompare(right.key);
    });
}
export function getTableStateLabel(table) {
    switch (table.tableState) {
        case TableState.WAITING:
            return table.tableStateText || 'Waiting';
        case TableState.READY_TO_START:
            return table.tableStateText || 'Ready';
        case TableState.STARTING:
            return table.tableStateText || 'Starting';
        case TableState.DRAFTING:
            return table.tableStateText || 'Drafting';
        case TableState.SIDEBOARDING:
            return table.tableStateText || 'Sideboarding';
        case TableState.CONSTRUCTING:
            return table.tableStateText || 'Constructing';
        case TableState.DUELING:
            return table.tableStateText || 'In Game';
        case TableState.FINISHED:
            return table.tableStateText || 'Finished';
        default:
            return table.tableStateText || table.tableState;
    }
}
function buildTableRow(table, currentUserName) {
    const action = getTableAction(table, currentUserName);
    return {
        key: `table:${table.tableId}`,
        source: 'table',
        tableId: table.tableId,
        gameId: table.games?.[0] ?? null,
        table,
        match: null,
        kind: table.isTournament ? 'Tourney' : 'Match',
        kindTone: table.isTournament ? 'tournament' : 'match',
        deckType: table.deckType || '',
        name: table.tableName || '',
        seats: table.seatsInfo || '',
        ownerPlayers: table.controllerName || '',
        gameType: table.gameType || '',
        info: table.additionalInfoShort || '',
        status: getTableStateLabel(table),
        statusTone: getTableStatusTone(table.tableState),
        password: table.passworded ? 'YES' : '',
        passworded: table.passworded,
        created: formatDateTime(table.createTime),
        createdTimestamp: toTimestamp(table.createTime),
        skill: skillLevelCode(table.skillLevel),
        rated: table.rated ? 'YES' : '',
        quitRatio: table.quitRatio || '',
        minimumRating: table.minimumRating || '',
        action,
        actionLabel: getActionLabel(action),
    };
}
function buildMatchRow(match) {
    const action = match.isTournament ? 'show' : match.replayAvailable ? 'replay' : 'none';
    return {
        key: `match:${match.matchId}`,
        source: 'match',
        tableId: match.tableId,
        gameId: match.games?.[0] ?? null,
        table: null,
        match,
        kind: match.isTournament ? 'Tourney' : 'Finished',
        kindTone: match.isTournament ? 'tournament' : 'finished',
        deckType: match.deckType || '',
        name: match.matchName || '',
        seats: '',
        ownerPlayers: match.players || '',
        gameType: match.gameType || '',
        info: match.result || '',
        status: 'Finished',
        statusTone: 'finished',
        password: '',
        passworded: false,
        created: formatDateTime(match.startTime),
        createdTimestamp: toTimestamp(match.startTime),
        skill: '',
        rated: match.isRated ? 'YES' : '',
        quitRatio: '',
        minimumRating: '',
        action,
        actionLabel: getActionLabel(action),
    };
}
function getTableAction(table, currentUserName) {
    const isOwner = Boolean(currentUserName && table.controllerName === currentUserName);
    switch (table.tableState) {
        case TableState.WAITING:
            return isOwner ? 'none' : 'join';
        case TableState.CONSTRUCTING:
        case TableState.DRAFTING:
            return table.isTournament ? 'show' : 'none';
        case TableState.DUELING:
            if (table.isTournament)
                return 'show';
            if (isOwner)
                return 'none';
            return table.spectatorsAllowed ? 'watch' : 'none';
        default:
            return 'none';
    }
}
function getActionLabel(action) {
    switch (action) {
        case 'join':
            return 'Join';
        case 'watch':
            return 'Watch';
        case 'show':
            return 'Show';
        case 'replay':
            return 'Replay';
        default:
            return '';
    }
}
function getTableStatusTone(state) {
    switch (state) {
        case TableState.WAITING:
            return 'waiting';
        case TableState.READY_TO_START:
        case TableState.STARTING:
        case TableState.DRAFTING:
        case TableState.SIDEBOARDING:
        case TableState.CONSTRUCTING:
            return 'starting';
        case TableState.DUELING:
            return 'dueling';
        case TableState.FINISHED:
            return 'finished';
        default:
            return 'muted';
    }
}
function compareRows(left, right, key) {
    switch (key) {
        case 'created':
            return left.createdTimestamp - right.createdTimestamp;
        case 'rated':
        case 'password':
            return Number(Boolean(left[key])) - Number(Boolean(right[key]));
        default:
            return String(left[key] ?? '').localeCompare(String(right[key] ?? ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            });
    }
}
function skillLevelCode(skillLevel) {
    switch (skillLevel) {
        case 'BEGINNER':
            return '*';
        case 'CASUAL':
            return '**';
        case 'SERIOUS':
            return '***';
        default:
            return '';
    }
}
function formatDateTime(value) {
    const timestamp = toTimestamp(value);
    if (timestamp === 0)
        return '';
    return new Date(timestamp).toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
function toTimestamp(value) {
    if (value instanceof Date)
        return value.getTime();
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}
