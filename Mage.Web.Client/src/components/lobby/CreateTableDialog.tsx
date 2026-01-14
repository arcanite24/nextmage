/**
 * Create Table Dialog
 * 
 * Modal for creating a new game table.
 */

import React, { useState } from 'react';
import { Modal, Button } from '../common';
import { useLobbyStore } from '../../stores';
import { MatchOptions, SkillLevel } from '../../types';
import './CreateTableDialog.css';

interface CreateTableDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onTableCreated: (tableId: string) => void;
}

export const CreateTableDialog: React.FC<CreateTableDialogProps> = ({
    isOpen,
    onClose,
    onTableCreated,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Standard',
        winsNeeded: 1,
        timeLimit: 'MIN__25',
        password: '',
        spectatorsAllowed: true,
        rollbackTurnsAllowed: true,
        aiOpponent: false,
    });

    const { createTable } = useLobbyStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Helper to determine player types (seats)
        const getPlayerTypes = (gameType: string, aiOpponent: boolean): string[] => {
            let seatCount = 2;
            if (gameType.includes('Free For All')) {
                seatCount = 4;
            }

            const types: string[] = [];
            if (aiOpponent) {
                types.push('HUMAN'); // Seat 1: Host
                // Remaining seats: AI
                for (let i = 1; i < seatCount; i++) {
                    types.push('COMPUTER_MAD');
                }
            } else {
                // All seats Human
                for (let i = 0; i < seatCount; i++) {
                    types.push('HUMAN');
                }
            }
            return types;
        };

        const options: MatchOptions = {
            name: formData.name || `${formData.gameType} Game`,
            gameType: formData.gameType,
            deckType: formData.deckType,
            winsNeeded: formData.winsNeeded,
            freeMulligans: 0,
            matchTimeLimit: formData.timeLimit,
            matchBufferTime: 'SEC__03',
            password: formData.password || undefined,
            limited: false,
            rated: false,
            rollbackTurnsAllowed: formData.rollbackTurnsAllowed,
            spectatorsAllowed: formData.spectatorsAllowed,
            playerTypes: getPlayerTypes(formData.gameType, formData.aiOpponent),
        };

        try {
            const table = await createTable(options);
            if (table) {
                onTableCreated(table.tableId);
            }
        } catch (error) {
            console.error('Failed to create table:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateField = <K extends keyof typeof formData>(
        field: K,
        value: typeof formData[K]
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create Game Table"
            size="md"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        isLoading={isLoading}
                    >
                        Create Table
                    </Button>
                </>
            }
        >
            <form className="create-table-form" onSubmit={handleSubmit}>
                <div className="input-group">
                    <label htmlFor="tableName" className="input-label">
                        Table Name
                    </label>
                    <input
                        id="tableName"
                        type="text"
                        className="input"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="My Game Table"
                    />
                </div>

                <div className="form-row">
                    <div className="input-group">
                        <label htmlFor="gameType" className="input-label">
                            Game Type
                        </label>
                        <select
                            id="gameType"
                            className="input"
                            value={formData.gameType}
                            onChange={(e) => updateField('gameType', e.target.value)}
                        >
                            <option value="Two Player Duel">Two Player Duel</option>
                            <option value="Commander 1v1">Commander 1v1</option>
                            <option value="Free For All">Free For All</option>
                            <option value="Commander Free For All">Commander FFA</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label htmlFor="deckType" className="input-label">
                            Format
                        </label>
                        <select
                            id="deckType"
                            className="input"
                            value={formData.deckType}
                            onChange={(e) => updateField('deckType', e.target.value)}
                        >
                            <option value="Constructed - Standard">Standard</option>
                            <option value="Constructed - Modern">Modern</option>
                            <option value="Constructed - Legacy">Legacy</option>
                            <option value="Constructed - Vintage">Vintage</option>
                            <option value="Constructed - Pioneer">Pioneer</option>
                            <option value="Constructed - Commander">Commander</option>
                            <option value="Constructed - Pauper">Pauper</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="input-group">
                        <label htmlFor="winsNeeded" className="input-label">
                            Best of
                        </label>
                        <select
                            id="winsNeeded"
                            className="input"
                            value={formData.winsNeeded}
                            onChange={(e) => updateField('winsNeeded', parseInt(e.target.value))}
                        >
                            <option value={1}>Best of 1</option>
                            <option value={2}>Best of 3</option>
                            <option value={3}>Best of 5</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label htmlFor="timeLimit" className="input-label">
                            Time Limit
                        </label>
                        <select
                            id="timeLimit"
                            className="input"
                            value={formData.timeLimit}
                            onChange={(e) => updateField('timeLimit', e.target.value)}
                        >
                            <option value="MIN__15">15 minutes</option>
                            <option value="MIN__25">25 minutes</option>
                            <option value="MIN__40">40 minutes</option>
                            <option value="MIN__60">60 minutes</option>
                            <option value="NONE">Unlimited</option>
                        </select>
                    </div>
                </div>

                <div className="input-group">
                    <label htmlFor="password" className="input-label">
                        Password (optional)
                    </label>
                    <input
                        id="password"
                        type="password"
                        className="input"
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        placeholder="Leave empty for public game"
                    />
                </div>

                <div className="checkbox-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={formData.spectatorsAllowed}
                            onChange={(e) => updateField('spectatorsAllowed', e.target.checked)}
                        />
                        <span className="checkbox-text">Allow spectators</span>
                    </label>

                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={formData.rollbackTurnsAllowed}
                            onChange={(e) => updateField('rollbackTurnsAllowed', e.target.checked)}
                        />
                        <span className="checkbox-text">Allow rollback</span>
                    </label>

                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={formData.aiOpponent}
                            onChange={(e) => updateField('aiOpponent', e.target.checked)}
                        />
                        <span className="checkbox-text">Play against AI</span>
                    </label>
                </div>
            </form>
        </Modal>
    );
};

export default CreateTableDialog;
