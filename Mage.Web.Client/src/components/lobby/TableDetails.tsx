/**
 * Table Details Panel
 * 
 * Shows detailed information about a selected table.
 */

import React from 'react';
import { Eye, Lock, Star, Trophy, X } from 'lucide-react';
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
            case TableState.READY_TO_START:
                return { label: 'Ready to start', color: 'warning' };
            case TableState.STARTING:
                return { label: 'Starting soon', color: 'warning' };
            case TableState.DRAFTING:
                return { label: 'Drafting', color: 'warning' };
            case TableState.SIDEBOARDING:
                return { label: 'Sideboarding', color: 'warning' };
            case TableState.CONSTRUCTING:
                return { label: 'Constructing', color: 'warning' };
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
        <div className="table-details" data-testid="table-details" data-table-id={table.tableId}>
            <div className="details-header">
                <h3 data-testid="table-details-name">{table.tableName}</h3>
                <button className="close-btn" onClick={onClose} aria-label="Close">
                    <X size={16} aria-hidden="true" />
                </button>
            </div>

            <div className="details-content">
                {/* Status */}
                <div className={`status-banner status-${stateInfo.color}`} data-testid="table-details-status">
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
                        <span className="feature-badge"><Lock size={14} aria-hidden="true" /> Password Required</span>
                    )}
                    {table.rated && (
                        <span className="feature-badge"><Star size={14} aria-hidden="true" /> Rated</span>
                    )}
                    {table.spectatorsAllowed && (
                        <span className="feature-badge"><Eye size={14} aria-hidden="true" /> Spectators Allowed</span>
                    )}
                    {table.isTournament && (
                        <span className="feature-badge"><Trophy size={14} aria-hidden="true" /> Tournament</span>
                    )}
                </div>

                {/* Additional info */}
                {table.additionalInfoFull && (
                    <div
                        className="additional-info"
                        dangerouslySetInnerHTML={{ __html: table.additionalInfoFull }}
                    />
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
                    <Button variant="secondary" fullWidth onClick={onWatch} data-testid="watch-table-button">
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
