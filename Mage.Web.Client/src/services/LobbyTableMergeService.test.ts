import assert from 'node:assert/strict';
import { test } from 'vitest';
import { mergeTablesWithPendingCreated } from './LobbyTableMergeService.js';

test('keeps a newly created table visible while the server table list lags', () => {
    const result = mergeTablesWithPendingCreated(
        [{ tableId: 'older-table', tableName: 'Older table' }],
        {
            'new-table': {
                table: { tableId: 'new-table', tableName: 'New table' },
                createdAt: 1_000,
            },
        },
        2_000,
        30_000
    );

    assert.deepEqual(result.tables.map(table => table.tableId), ['older-table', 'new-table']);
    assert.ok(result.pendingCreatedTables['new-table']);
});

test('drops pending created tables once the server list catches up', () => {
    const result = mergeTablesWithPendingCreated(
        [{ tableId: 'new-table', tableName: 'New table from server' }],
        {
            'new-table': {
                table: { tableId: 'new-table', tableName: 'Optimistic table' },
                createdAt: 1_000,
            },
        },
        2_000,
        30_000
    );

    assert.deepEqual(result.tables, [{ tableId: 'new-table', tableName: 'New table from server' }]);
    assert.deepEqual(result.pendingCreatedTables, {});
});

test('expires pending created tables that never appear on the server', () => {
    const result = mergeTablesWithPendingCreated(
        [],
        {
            'ghost-table': {
                table: { tableId: 'ghost-table', tableName: 'Ghost table' },
                createdAt: 1_000,
            },
        },
        40_001,
        30_000
    );

    assert.deepEqual(result.tables, []);
    assert.deepEqual(result.pendingCreatedTables, {});
});
