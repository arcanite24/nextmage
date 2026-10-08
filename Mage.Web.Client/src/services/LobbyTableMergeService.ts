export const PENDING_CREATED_TABLE_TTL_MS = 30_000;

interface TableIdentity {
    tableId?: string | null;
}

export interface PendingCreatedTable<T extends TableIdentity> {
    table: T;
    createdAt: number;
}

export interface MergePendingTablesResult<T extends TableIdentity> {
    tables: T[];
    pendingCreatedTables: Record<string, PendingCreatedTable<T>>;
}

export function mergeTablesWithPendingCreated<T extends TableIdentity>(
    serverTables: T[],
    pendingCreatedTables: Record<string, PendingCreatedTable<T>>,
    now = Date.now(),
    ttlMs = PENDING_CREATED_TABLE_TTL_MS
): MergePendingTablesResult<T> {
    const tableIds = new Set(serverTables.map(table => table.tableId).filter(Boolean));
    const mergedTables = [...serverTables];
    const nextPending: Record<string, PendingCreatedTable<T>> = {};

    for (const [tableId, pending] of Object.entries(pendingCreatedTables)) {
        if (tableIds.has(tableId)) continue;
        if (now - pending.createdAt > ttlMs) continue;

        mergedTables.push(pending.table);
        nextPending[tableId] = pending;
    }

    return {
        tables: mergedTables,
        pendingCreatedTables: nextPending,
    };
}
