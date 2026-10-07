import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildLobbyTableRows,
  sortLobbyTableRows,
} from './LobbyTableRowsService.js';
import { SkillLevel, TableState, type MatchView, type TableView } from '../types/index.js';

const WAITING_TABLE: TableView = {
  tableId: '00000000-0000-0000-0000-000000000001',
  tableName: 'Pauper Queue',
  controllerName: 'Alice',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Pauper',
  spectatorsAllowed: true,
  createTime: '2026-06-21T20:00:00.000Z',
  tableState: TableState.WAITING,
  tableStateText: 'Waiting',
  seats: [],
  games: [],
  seatsInfo: '1/2',
  isTournament: false,
  additionalInfoShort: 'Bo1',
  additionalInfoFull: 'Best of 1',
  skillLevel: SkillLevel.CASUAL,
  quitRatio: '100',
  minimumRating: '0',
  limited: false,
  rated: true,
  passworded: true,
};

const DUELING_TABLE: TableView = {
  ...WAITING_TABLE,
  tableId: '00000000-0000-0000-0000-000000000002',
  tableName: 'Modern Watch',
  controllerName: 'Bob',
  deckType: 'Constructed - Modern',
  createTime: '2026-06-21T20:10:00.000Z',
  tableState: TableState.DUELING,
  tableStateText: 'Dueling',
  games: ['00000000-0000-0000-0000-000000000099'],
  seatsInfo: '2/2',
  skillLevel: SkillLevel.SERIOUS,
  rated: false,
  passworded: false,
};

const FINISHED_MATCH: MatchView = {
  tableId: '00000000-0000-0000-0000-000000000003',
  matchId: '00000000-0000-0000-0000-000000000004',
  matchName: 'Replay Match',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Standard',
  games: ['00000000-0000-0000-0000-000000000005'],
  result: 'Alice won 2-1',
  players: 'Alice, Bob',
  startTime: '2026-06-21T20:20:00.000Z',
  endTime: '2026-06-21T20:45:00.000Z',
  replayAvailable: true,
  isTournament: false,
  isRated: true,
};

const TOURNAMENT_TABLE: TableView = {
  ...WAITING_TABLE,
  tableId: '00000000-0000-0000-0000-000000000006',
  tableName: 'Draft Pod',
  deckType: 'Limited',
  tableState: TableState.DRAFTING,
  tableStateText: 'Drafting',
  isTournament: true,
  additionalInfoShort: 'Booster Draft',
};

const FINISHED_TOURNAMENT_MATCH: MatchView = {
  ...FINISHED_MATCH,
  tableId: '00000000-0000-0000-0000-000000000007',
  matchId: '00000000-0000-0000-0000-000000000008',
  matchName: 'Draft Finals',
  isTournament: true,
};

test('builds dense Java-style rows for active tables and finished matches', () => {
  const rows = buildLobbyTableRows([WAITING_TABLE, DUELING_TABLE], [FINISHED_MATCH], 'Charlie');

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.kind), ['Match', 'Match', 'Finished']);
  assert.deepEqual(rows.map(row => row.action), ['join', 'watch', 'replay']);
  assert.equal(rows[0].password, 'YES');
  assert.equal(rows[0].rated, 'YES');
  assert.equal(rows[0].skill, '**');
  assert.equal(rows[1].skill, '***');
  assert.equal(rows[2].ownerPlayers, 'Alice, Bob');
  assert.equal(rows[2].info, 'Alice won 2-1');
});

test('suppresses join and watch actions for the owning user like the Java table model', () => {
  const rows = buildLobbyTableRows([WAITING_TABLE, DUELING_TABLE], [], 'Alice');

  assert.equal(rows[0].action, 'none');
  assert.equal(rows[1].action, 'watch');
});

test('sorts dense lobby rows by Java-visible columns', () => {
  const rows = buildLobbyTableRows([WAITING_TABLE, DUELING_TABLE], [FINISHED_MATCH], 'Charlie');

  assert.deepEqual(
    sortLobbyTableRows(rows, { key: 'deckType', direction: 'asc' }).map(row => row.deckType),
    ['Constructed - Modern', 'Constructed - Pauper', 'Constructed - Standard'],
  );
  assert.deepEqual(
    sortLobbyTableRows(rows, { key: 'created', direction: 'desc' }).map(row => row.name),
    ['Replay Match', 'Modern Watch', 'Pauper Queue'],
  );
});

test('routes tournament table and finished tournament actions to show', () => {
  const rows = buildLobbyTableRows([TOURNAMENT_TABLE], [FINISHED_TOURNAMENT_MATCH], 'Charlie');

  assert.deepEqual(rows.map(row => row.kind), ['Tourney', 'Tourney']);
  assert.deepEqual(rows.map(row => row.action), ['show', 'show']);
  assert.deepEqual(rows.map(row => row.actionLabel), ['Show', 'Show']);
});
