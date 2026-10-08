/**
 * Table List Component
 *
 * Displays live lobby tables and finished matches with desktop-like density.
 */

import React, { useMemo, useState } from 'react';
import { MatchView, TableView } from '../../types';
import { Button } from '../common';
import {
    buildLobbyTableRows,
    LOBBY_TABLE_COLUMN_KEYS,
    sortLobbyTableRows,
    type LobbyRowSort,
    type LobbyRowSortKey,
    type LobbyTableRow,
    type LobbyTableLayoutConfig,
} from '../../services';
import './TableList.css';

interface TableListProps {
    tables: TableView[];
    finishedMatches: MatchView[];
    isLoading: boolean;
    userName?: string | null;
    onTableClick?: (table: TableView) => void;
    onJoin?: (tableId: string) => void;
    onWatch?: (tableId: string) => void;
    onShowTournament?: (tableId: string, title: string) => void;
    onReplay?: (match: MatchView) => void;
    tableLayout: LobbyTableLayoutConfig;
    onSortChange: (sort: LobbyRowSort) => void;
    onColumnOrderChange: (columnOrder: LobbyRowSortKey[]) => void;
    onColumnWidthChange: (key: LobbyRowSortKey, width: number) => void;
    onResetTableLayout: () => void;
    selectedTableId?: string | null;
}

interface ColumnDef {
    key: LobbyRowSortKey;
    label: string;
    className: string;
    align?: 'right' | 'center';
}

const COLUMNS: ColumnDef[] = [
    { key: 'kind', label: 'M/T', className: 'col-kind', align: 'center' },
    { key: 'deckType', label: 'Deck Type', className: 'col-deck' },
    { key: 'name', label: 'Name', className: 'col-name' },
    { key: 'seats', label: 'Seats', className: 'col-seats', align: 'center' },
    { key: 'ownerPlayers', label: 'Owner / Players', className: 'col-owner' },
    { key: 'gameType', label: 'Game Type', className: 'col-game' },
    { key: 'info', label: 'Info', className: 'col-info' },
    { key: 'status', label: 'Status', className: 'col-status' },
    { key: 'password', label: 'Password', className: 'col-password', align: 'center' },
    { key: 'created', label: 'Created / Started', className: 'col-created' },
    { key: 'skill', label: 'Skill', className: 'col-skill', align: 'center' },
    { key: 'rated', label: 'Rated', className: 'col-rated', align: 'center' },
    { key: 'quitRatio', label: 'Quit %', className: 'col-quit', align: 'right' },
    { key: 'minimumRating', label: 'Min Rating', className: 'col-min-rating', align: 'right' },
    { key: 'action', label: 'Action', className: 'col-actions', align: 'right' },
];

export const TableList: React.FC<TableListProps> = ({
    tables,
    finishedMatches,
    isLoading,
    userName,
    onTableClick,
    onJoin,
    onWatch,
    onShowTournament,
    onReplay,
    tableLayout,
    onSortChange,
    onColumnOrderChange,
    onColumnWidthChange,
    onResetTableLayout,
    selectedTableId,
}) => {
    const [draggedColumn, setDraggedColumn] = useState<LobbyRowSortKey | null>(null);
    const columnByKey = useMemo(() => new Map(COLUMNS.map(column => [column.key, column])), []);
    const orderedColumns = useMemo(() => {
        const configured = tableLayout.columnOrder
            .map(key => columnByKey.get(key))
            .filter((column): column is ColumnDef => Boolean(column));
        const missing = COLUMNS.filter(column => !configured.some(current => current.key === column.key));
        return [...configured, ...missing];
    }, [columnByKey, tableLayout.columnOrder]);
    const gridStyle = useMemo(() => {
        const widths = orderedColumns.map(column => tableLayout.columnWidths[column.key] ?? 100);
        const minWidth = widths.reduce((total, width) => total + width, 0);
        return {
            '--lobby-grid-columns': widths.map(width => `${width}px`).join(' '),
            '--lobby-grid-min-width': `${minWidth}px`,
        } as React.CSSProperties;
    }, [orderedColumns, tableLayout.columnWidths]);

    const rows = useMemo(() => {
        return sortLobbyTableRows(
            buildLobbyTableRows(tables, finishedMatches, userName),
            tableLayout.sort,
        );
    }, [finishedMatches, tableLayout.sort, tables, userName]);

    const updateSort = (key: LobbyRowSortKey) => {
        const current = tableLayout.sort;
        onSortChange({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        });
    };

    const moveColumn = (from: LobbyRowSortKey, to: LobbyRowSortKey) => {
        if (from === to) return;
        const currentOrder = tableLayout.columnOrder.filter(key => LOBBY_TABLE_COLUMN_KEYS.includes(key));
        const fromIndex = currentOrder.indexOf(from);
        const toIndex = currentOrder.indexOf(to);
        if (fromIndex === -1 || toIndex === -1) return;
        const nextOrder = [...currentOrder];
        nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, from);
        onColumnOrderChange(nextOrder);
    };

    const startColumnResize = (event: React.PointerEvent, key: LobbyRowSortKey) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = tableLayout.columnWidths[key] ?? 100;

        const handleMove = (moveEvent: PointerEvent) => {
            const nextWidth = Math.round(Math.min(360, Math.max(52, startWidth + moveEvent.clientX - startX)));
            onColumnWidthChange(key, nextWidth);
        };

        const handleUp = () => {
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleUp);
        };

        document.addEventListener('pointermove', handleMove);
        document.addEventListener('pointerup', handleUp);
    };

    if (isLoading && rows.length === 0) {
        return (
            <div className="table-list-loading">
                <div className="spinner spinner-lg" />
                <span>Loading tables...</span>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="table-list-empty">
                <div className="empty-table-glyph" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <h3>No rows found</h3>
                <p>Create a new table or adjust your filters</p>
            </div>
        );
    }

    return (
        <div className="table-list" data-testid="lobby-table-list" style={gridStyle}>
            <button
                type="button"
                className="column-reset-button"
                onClick={onResetTableLayout}
                aria-label="Reset table columns"
                title="Reset table columns"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 7v5h5" />
                    <path d="M5.5 12A7 7 0 1 0 7 6.9L4 10" />
                </svg>
                <span className="column-reset-button-label">Reset table columns</span>
            </button>
            <div className="table-list-scroll">
                <div className="dense-table-grid table-list-header" role="row">
                    {orderedColumns.map((column) => (
                        <button
                            key={column.key}
                            type="button"
                            draggable
                            className={`table-header-cell ${column.className} ${column.align ? `align-${column.align}` : ''} ${draggedColumn === column.key ? 'dragging' : ''}`}
                            onClick={() => updateSort(column.key)}
                            onDragStart={() => setDraggedColumn(column.key)}
                            onDragEnd={() => setDraggedColumn(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                                event.preventDefault();
                                if (draggedColumn) moveColumn(draggedColumn, column.key);
                                setDraggedColumn(null);
                            }}
                            aria-sort={tableLayout.sort.key === column.key ? tableLayout.sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}
                        >
                            <span>{column.label}</span>
                            <span className="sort-indicator" aria-hidden="true">
                                {tableLayout.sort.key === column.key ? tableLayout.sort.direction === 'asc' ? '▲' : '▼' : ''}
                            </span>
                            <span
                                className="column-resize-handle"
                                role="separator"
                                aria-orientation="vertical"
                                aria-label={`Resize ${column.label} column`}
                                onPointerDown={(event) => startColumnResize(event, column.key)}
                            />
                        </button>
                    ))}
                </div>

                <div className="table-list-body">
                    {rows.map((row) => (
                        <LobbyRow
                            key={row.key}
                            row={row}
                            columns={orderedColumns}
                            isSelected={row.source === 'table' && selectedTableId === row.tableId}
                            onTableClick={onTableClick}
                            onJoin={onJoin}
                            onWatch={onWatch}
                            onShowTournament={onShowTournament}
                            onReplay={onReplay}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface LobbyRowProps {
    row: LobbyTableRow;
    columns: ColumnDef[];
    isSelected: boolean;
    onTableClick?: (table: TableView) => void;
    onJoin?: (tableId: string) => void;
    onWatch?: (tableId: string) => void;
    onShowTournament?: (tableId: string, title: string) => void;
    onReplay?: (match: MatchView) => void;
}

const LobbyRow: React.FC<LobbyRowProps> = ({
    row,
    columns,
    isSelected,
    onTableClick,
    onJoin,
    onWatch,
    onShowTournament,
    onReplay,
}) => {
    const handleClick = () => {
        if (row.table) {
            onTableClick?.(row.table);
        }
    };

    return (
        <div
            className={`dense-table-grid table-row ${isSelected ? 'selected' : ''} row-${row.source}`}
            onClick={handleClick}
            data-testid={row.source === 'table' ? 'table-row' : 'finished-match-row'}
            data-table-id={row.tableId}
            data-match-id={row.match?.matchId}
            data-row-source={row.source}
        >
            {columns.map((column) => renderRowCell(row, column, { onJoin, onWatch, onShowTournament, onReplay }))}
        </div>
    );
};

interface CellProps extends React.HTMLAttributes<HTMLDivElement> {
    className: string;
}

const Cell: React.FC<CellProps> = ({ className, children, ...props }) => (
    <div className={`table-cell ${className}`} {...props}>
        {children}
    </div>
);

interface RowActionProps {
    row: LobbyTableRow;
    onJoin?: (tableId: string) => void;
    onWatch?: (tableId: string) => void;
    onShowTournament?: (tableId: string, title: string) => void;
    onReplay?: (match: MatchView) => void;
}

const RowAction: React.FC<RowActionProps> = ({ row, onJoin, onWatch, onShowTournament, onReplay }) => {
    if (row.action === 'join') {
        return (
            <Button variant="primary" size="sm" onClick={() => onJoin?.(row.tableId)}>
                Join
            </Button>
        );
    }

    if (row.action === 'watch') {
        return (
            <Button variant="secondary" size="sm" onClick={() => onWatch?.(row.tableId)}>
                Watch
            </Button>
        );
    }

    if (row.action === 'replay' && row.match) {
        const match = row.match;
        return (
            <Button
                variant="secondary"
                size="sm"
                onClick={() => onReplay?.(match)}
                disabled={!onReplay || !row.gameId}
            >
                Replay
            </Button>
        );
    }

    if (row.action === 'show') {
        return (
            <Button
                variant="secondary"
                size="sm"
                onClick={() => onShowTournament?.(row.tableId, row.name)}
                disabled={!onShowTournament}
                data-testid="show-tournament-button"
            >
                Show
            </Button>
        );
    }

    return <span className="table-status-text">—</span>;
};

function renderRowCell(
    row: LobbyTableRow,
    column: ColumnDef,
    actions: Pick<RowActionProps, 'onJoin' | 'onWatch' | 'onShowTournament' | 'onReplay'>,
): React.ReactNode {
    const alignClass = column.align ? ` align-${column.align}` : '';
    const className = `${column.className}${alignClass}`;

    switch (column.key) {
        case 'kind':
            return (
                <Cell key={column.key} className={className}>
                    <span className={`kind-badge kind-${row.kindTone}`}>{row.kind}</span>
                </Cell>
            );
        case 'name':
            return (
                <Cell key={column.key} className={className} title={row.name}>
                    <span className="row-name">{row.name || 'Untitled'}</span>
                </Cell>
            );
        case 'status':
            return (
                <Cell key={column.key} className={className} title={row.status}>
                    <span className={`status-badge state-${row.statusTone}`}>{row.status || '—'}</span>
                </Cell>
            );
        case 'password':
            return (
                <Cell key={column.key} className={className}>
                    {row.passworded ? <span className="table-flag">YES</span> : '—'}
                </Cell>
            );
        case 'rated':
            return (
                <Cell key={column.key} className={className}>
                    {row.rated ? <span className="table-flag">YES</span> : '—'}
                </Cell>
            );
        case 'action':
            return (
                <Cell key={column.key} className={className} onClick={(event) => event.stopPropagation()}>
                    <RowAction row={row} {...actions} />
                </Cell>
            );
        default: {
            const value = row[column.key] || '—';
            return (
                <Cell key={column.key} className={className} title={String(value)}>
                    {value}
                </Cell>
            );
        }
    }
}

export default TableList;
