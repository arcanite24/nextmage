/**
 * Table List Component
 * 
 * Displays the list of game tables in the lobby.
 */

import React from 'react';
import { TableView, TableState } from '../../types';
import { Button } from '../common';
import './TableList.css';

interface TableListProps {
    tables: TableView[];
    isLoading: boolean;
    onTableClick?: (table: TableView) => void;
    onJoin?: (tableId: string) => void;
    onWatch?: (tableId: string) => void;
    selectedTableId?: string | null;
}

export const TableList: React.FC<TableListProps> = ({
    tables,
    isLoading,
    onTableClick,
    onJoin,
    onWatch,
    selectedTableId,
}) => {
    const getStateColor = (state: TableState): string => {
        switch (state) {
            case TableState.WAITING:
                return 'state-waiting';
            case TableState.STARTING:
                return 'state-starting';
            case TableState.DUELING:
                return 'state-dueling';
            case TableState.FINISHED:
                return 'state-finished';
            default:
                return '';
        }
    };

    const getStateLabel = (state: TableState): string => {
        switch (state) {
            case TableState.WAITING:
                return 'Waiting';
            case TableState.STARTING:
                return 'Starting';
            case TableState.DRAFTING:
                return 'Drafting';
            case TableState.SIDEBOARDING:
                return 'Sideboarding';
            case TableState.CONSTRUCTING:
                return 'Constructing';
            case TableState.DUELING:
                return 'In Game';
            case TableState.FINISHED:
                return 'Finished';
            default:
                return state;
        }
    };

    if (isLoading && tables.length === 0) {
        return (
            <div className="table-list-loading">
                <div className="spinner spinner-lg" />
                <span>Loading tables...</span>
            </div>
        );
    }

    if (tables.length === 0) {
        return (
            <div className="table-list-empty">
                <div className="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor">
                        <rect x="6" y="10" width="36" height="28" rx="2" strokeWidth="2" />
                        <line x1="6" y1="18" x2="42" y2="18" strokeWidth="2" />
                        <line x1="18" y1="10" x2="18" y2="38" strokeWidth="2" />
                    </svg>
                </div>
                <h3>No tables found</h3>
                <p>Create a new table or adjust your filters</p>
            </div>
        );
    }

    return (
        <div className="table-list">
            {/* Header row */}
            <div className="table-list-header">
                <span className="col-status">Status</span>
                <span className="col-name">Table</span>
                <span className="col-type">Type</span>
                <span className="col-players">Players</span>
                <span className="col-actions">Actions</span>
            </div>

            {/* Table rows */}
            <div className="table-list-body">
                {tables.map((table) => (
                    <div
                        key={table.tableId}
                        className={`table-row ${selectedTableId === table.tableId ? 'selected' : ''}`}
                        onClick={() => onTableClick?.(table)}
                    >
                        <div className="col-status">
                            <span className={`status-badge ${getStateColor(table.tableState)}`}>
                                {getStateLabel(table.tableState)}
                            </span>
                        </div>

                        <div className="col-name">
                            <div className="table-name">
                                {table.passworded && (
                                    <span className="lock-icon" title="Password protected">
                                        🔒
                                    </span>
                                )}
                                {table.tableName}
                                {table.rated && (
                                    <span className="rated-icon" title="Rated match">
                                        ⭐
                                    </span>
                                )}
                            </div>
                            <div className="table-host">
                                by {table.controllerName}
                            </div>
                        </div>

                        <div className="col-type">
                            <div className="table-game-type">{table.gameType}</div>
                            <div className="table-deck-type">{table.deckType}</div>
                        </div>

                        <div className="col-players">
                            <span className="players-info">{table.seatsInfo}</span>
                        </div>

                        <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                            {table.tableState === TableState.WAITING && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => onJoin?.(table.tableId)}
                                >
                                    Join
                                </Button>
                            )}
                            {table.tableState === TableState.DUELING && table.spectatorsAllowed && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onWatch?.(table.tableId)}
                                >
                                    Watch
                                </Button>
                            )}
                            {(table.tableState === TableState.FINISHED ||
                                (table.tableState === TableState.DUELING && !table.spectatorsAllowed)) && (
                                    <span className="table-status-text">{table.tableStateText || '—'}</span>
                                )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TableList;
