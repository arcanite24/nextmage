/**
 * Table Filters Component
 * 
 * Filtering controls for the table list.
 */

import React, { useMemo } from 'react';
import { useLobbyStore } from '../../stores';
import { TableState } from '../../types';
import './TableFilters.css';

export const TableFilters: React.FC = () => {
    const { filters, setFilter, resetFilters, tables, filteredTables } = useLobbyStore();

    // specific unique values from all tables (not just filtered ones) to populate dropdowns
    const uniqueGameTypes = useMemo(() => {
        const types = new Set(tables.map(t => t.gameType));
        return Array.from(types).sort();
    }, [tables]);

    const uniqueDeckTypes = useMemo(() => {
        const types = new Set(tables.map(t => t.deckType));
        return Array.from(types).sort();
    }, [tables]);

    return (
        <div className="table-filters">
            <div className="filters-row">
                {/* Search */}
                <div className="filter-group filter-search">
                    <input
                        type="text"
                        className="input filter-input"
                        placeholder="Search tables..."
                        value={filters.searchText}
                        onChange={(e) => setFilter('searchText', e.target.value)}
                    />
                    {filters.searchText && (
                        <button
                            className="clear-search"
                            onClick={() => setFilter('searchText', '')}
                            aria-label="Clear search"
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* State filters */}
                <div className="filter-group filter-states">
                    <label className="filter-checkbox">
                        <input
                            type="checkbox"
                            checked={filters.showWaiting}
                            onChange={(e) => setFilter('showWaiting', e.target.checked)}
                        />
                        <span className="checkbox-badge state-waiting">Waiting</span>
                    </label>
                    <label className="filter-checkbox">
                        <input
                            type="checkbox"
                            checked={filters.showDueling}
                            onChange={(e) => setFilter('showDueling', e.target.checked)}
                        />
                        <span className="checkbox-badge state-dueling">In Game</span>
                    </label>
                    <label className="filter-checkbox">
                        <input
                            type="checkbox"
                            checked={filters.showFinished}
                            onChange={(e) => setFilter('showFinished', e.target.checked)}
                        />
                        <span className="checkbox-badge state-finished">Finished</span>
                    </label>
                </div>

                {/* Type filters */}
                <div className="filter-group filter-types">
                    <select
                        className="input filter-select"
                        value={filters.gameType || ''}
                        onChange={(e) => setFilter('gameType', e.target.value || null)}
                    >
                        <option value="">All Game Types</option>
                        {uniqueGameTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>

                    <select
                        className="input filter-select"
                        value={filters.deckType || ''}
                        onChange={(e) => setFilter('deckType', e.target.value || null)}
                    >
                        <option value="">All Formats</option>
                        {uniqueDeckTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* Options */}
                <div className="filter-group filter-options">
                    <label className="filter-checkbox">
                        <input
                            type="checkbox"
                            checked={filters.showPassworded}
                            onChange={(e) => setFilter('showPassworded', e.target.checked)}
                        />
                        <span className="checkbox-label-text">🔒 Passworded</span>
                    </label>
                </div>

                {/* Reset */}
                <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
                    Reset Filters
                </button>
            </div>

            <div className="filter-summary">
                Showing {filteredTables.length} of {tables.length} tables
            </div>
        </div>
    );
};

export default TableFilters;
