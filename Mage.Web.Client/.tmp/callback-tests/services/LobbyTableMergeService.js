export const PENDING_CREATED_TABLE_TTL_MS = 30_000;
export function mergeTablesWithPendingCreated(serverTables, pendingCreatedTables, now = Date.now(), ttlMs = PENDING_CREATED_TABLE_TTL_MS) {
    const tableIds = new Set(serverTables.map(table => table.tableId).filter(Boolean));
    const mergedTables = [...serverTables];
    const nextPending = {};
    for (const [tableId, pending] of Object.entries(pendingCreatedTables)) {
        if (tableIds.has(tableId))
            continue;
        if (now - pending.createdAt > ttlMs)
            continue;
        mergedTables.push(pending.table);
        nextPending[tableId] = pending;
    }
    return {
        tables: mergedTables,
        pendingCreatedTables: nextPending,
    };
}
