/**
 * Table Details Panel
 * 
 * Shows detailed information about a selected table.
 */

import React from 'react';
import { TableView, TableState } from '../../types';
import { Button } from '../common';
import './TableDetails.css';

interface TableDetailsProps {
    table: TableView | null;
    onJoin: () => void;
    onWatch: () => void;
    onClose: () => void;
}

export const TableDetails: React.FC<TableDetailsProps> = ({
    table,
    onJoin,
    onWatch,
    onClose,
}) => {
    if (!table) {
        return (
            <div className="table-details empty">
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="6" y="10" width="36" height="28" rx="2" />
                        <circle cx="24" cy="24" r="6" />
                    </svg>
                    <p>Select a table to view details</p>
                </div>
            </div>
        );
    }

    const getStateInfo = (state: TableState) => {
        switch (state) {
            case TableState.WAITING:
                return { label: 'Waiting for players', color: 'success' };
            case TableState.STARTING:
                return { label: 'Starting soon', color: 'warning' };
            case TableState.DUELING:
                return { label: 'Game in progress', color: 'primary' };
            case TableState.FINISHED:
                return { label: 'Game finished', color: 'muted' };
            default:
                return { label: state, color: 'muted' };
        }
    };

    const stateInfo = getStateInfo(table.tableState);
    const canJoin = table.tableState === TableState.WAITING;
    const canWatch = table.tableState === TableState.DUELING && table.spectatorsAllowed;

    return (
        <div className="table-details">
            <div className="details-header">
                <h3>{table.tableName}</h3>
                <button className="close-btn" onClick={onClose} aria-label="Close">
                    ×
                </button>
            </div>

            <div className="details-content">
                {/* Status */}
                <div className={`status-banner status-${stateInfo.color}`}>
                    {stateInfo.label}
                </div>

                {/* Info grid */}
                <div className="details-grid">
                    <div className="detail-item">
                        <span className="detail-label">Host</span>
                        <span className="detail-value">{table.controllerName}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Game Type</span>
                        <span className="detail-value">{table.gameType}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Format</span>
                        <span className="detail-value">{table.deckType}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Players</span>
                        <span className="detail-value">{table.seatsInfo}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Skill Level</span>
                        <span className="detail-value">{table.skillLevel}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Created</span>
                        <span className="detail-value">
                            {new Date(table.createTime).toLocaleTimeString()}
                        </span>
                    </div>
                </div>

                {/* Features */}
                <div className="details-features">
                    {table.passworded && (
                        <span className="feature-badge">🔒 Password Required</span>
                    )}
                    {table.rated && (
                        <span className="feature-badge">⭐ Rated</span>
                    )}
                    {table.spectatorsAllowed && (
                        <span className="feature-badge">👁️ Spectators Allowed</span>
                    )}
                    {table.isTournament && (
                        <span className="feature-badge">🏆 Tournament</span>
                    )}
                </div>

                {/* Additional info */}
                {table.additionalInfoFull && (
                    <div className="additional-info">
                        {table.additionalInfoFull}
                    </div>
                )}

                {/* Seats */}
                {table.seats && table.seats.length > 0 && (
                    <div className="seats-section">
                        <h4>Seats</h4>
                        <div className="seats-list">
                            {table.seats.map((seat, index) => (
                                <div key={index} className={`seat-item ${seat.name ? 'occupied' : 'empty'}`}>
                                    <span className="seat-number">#{seat.seatNum}</span>
                                    <span className="seat-name">
                                        {seat.name || 'Empty'}
                                    </span>
                                    <span className="seat-type">{seat.playerType}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="details-actions">
                {canJoin && (
                    <Button variant="primary" fullWidth onClick={onJoin}>
                        Join Table
                    </Button>
                )}
                {canWatch && (
                    <Button variant="secondary" fullWidth onClick={onWatch}>
                        Watch Game
                    </Button>
                )}
                {!canJoin && !canWatch && (
                    <div className="no-actions">
                        {table.tableState === TableState.FINISHED
                            ? 'This game has ended'
                            : 'Cannot join or watch this game'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TableDetails;
