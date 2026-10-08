/**
 * Create Table Dialog
 * 
 * Modal for creating a new game table.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button } from '../common';
import { useLobbyStore, useSessionStore } from '../../stores';
import {
    appConfigService,
    FALLBACK_LOBBY_SERVER_OPTIONS,
    findGameType,
    getClampedPlayerCount,
    getDefaultComputerPlayerType,
    getDefaultDeckType,
    getDefaultGameTypeName,
    getHumanPlayerType,
    isLimitedDeckType,
    resizePlayerTypes,
    validateDeckGameTypePair,
    type CreateTableLoadPresetSlot,
    type CreateTablePresetConfig,
    type CreateTablePresetSlot,
    type LobbyServerOptions,
} from '../../services';
import { DeckCardInfo, DeckCardLists, MatchOptions, SkillLevel } from '../../types';
import { DeckPicker } from './DeckPicker';
import './CreateTableDialog.css';

interface CreateTableDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onTableCreated: (tableId: string) => void;
}

interface CreateTableFormData {
    name: string;
    gameType: string;
    deckType: string;
    winsNeeded: number;
    freeMulligans: number;
    timeLimit: string;
    bufferTime: string;
    mulliganType: string;
    password: string;
    skillLevel: SkillLevel;
    spectatorsAllowed: boolean;
    rollbackTurnsAllowed: boolean;
    planeChase: boolean;
    emblemCardsEnabled: boolean;
    perPlayerEmblemDeck: DeckCardLists | null;
    startingPlayerEmblemDeck: DeckCardLists | null;
    customStartLifeEnabled: boolean;
    customStartLife: number;
    customStartHandSizeEnabled: boolean;
    customStartHandSize: number;
    rated: boolean;
    quitRatio: number;
    minimumRating: number;
    edhPowerLevel: number;
    range: string;
    attackOption: string;
    numberOfPlayers: number;
    playerTypes: string[];
    aiSeats: CreateTableAiSeatFormData[];
}

interface CreateTableAiSeatFormData {
    name: string;
    skill: number;
    deck: DeckCardLists | null;
}

const MATCH_TIME_LIMIT_OPTIONS = [
    { value: 'NONE', label: 'Unlimited' },
    { value: 'MIN___5', label: '5 minutes' },
    { value: 'MIN__10', label: '10 minutes' },
    { value: 'MIN__15', label: '15 minutes' },
    { value: 'MIN__20', label: '20 minutes' },
    { value: 'MIN__25', label: '25 minutes' },
    { value: 'MIN__30', label: '30 minutes' },
    { value: 'MIN__35', label: '35 minutes' },
    { value: 'MIN__40', label: '40 minutes' },
    { value: 'MIN__45', label: '45 minutes' },
    { value: 'MIN__50', label: '50 minutes' },
    { value: 'MIN__55', label: '55 minutes' },
    { value: 'MIN__60', label: '60 minutes' },
    { value: 'MIN__90', label: '90 minutes' },
    { value: 'MIN_120', label: '120 minutes' },
] as const;

const MATCH_BUFFER_TIME_OPTIONS = [
    { value: 'NONE', label: 'No buffer' },
    { value: 'SEC__01', label: '1 second' },
    { value: 'SEC__02', label: '2 seconds' },
    { value: 'SEC__03', label: '3 seconds' },
    { value: 'SEC__05', label: '5 seconds' },
    { value: 'SEC__10', label: '10 seconds' },
    { value: 'SEC__15', label: '15 seconds' },
    { value: 'SEC__20', label: '20 seconds' },
    { value: 'SEC__25', label: '25 seconds' },
    { value: 'SEC__30', label: '30 seconds' },
] as const;

const SKILL_LEVEL_OPTIONS = [
    { value: SkillLevel.BEGINNER, label: 'Beginner' },
    { value: SkillLevel.CASUAL, label: 'Casual' },
    { value: SkillLevel.SERIOUS, label: 'Serious' },
] as const;

const RANGE_OPTIONS = [
    { value: 'ALL', label: 'All players' },
    { value: 'ONE', label: 'Range 1' },
    { value: 'TWO', label: 'Range 2' },
] as const;

const ATTACK_OPTIONS = [
    { value: 'MULTIPLE', label: 'Attack multiple players' },
    { value: 'LEFT', label: 'Attack left' },
    { value: 'RIGHT', label: 'Attack right' },
] as const;

const MULLIGAN_TYPE_OPTIONS = [
    { value: 'GAME_DEFAULT', label: 'Game Default' },
    { value: 'VANCOUVER', label: 'Vancouver' },
    { value: 'PARIS', label: 'Paris' },
    { value: 'LONDON', label: 'London' },
    { value: 'SMOOTHED_LONDON', label: 'Smoothed London' },
    { value: 'CANADIAN_HIGHLANDER', label: 'Canadian Highlander' },
] as const;

export const CreateTableDialog: React.FC<CreateTableDialogProps> = ({
    isOpen,
    onClose,
    onTableCreated,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [presetMessage, setPresetMessage] = useState<string | null>(null);
    const [loadPresetSlot, setLoadPresetSlot] = useState<CreateTableLoadPresetSlot>('lastUsed');
    const [savePresetSlot, setSavePresetSlot] = useState<Exclude<CreateTablePresetSlot, 'lastUsed'>>('config1');
    const [presets, setPresets] = useState(() => appConfigService.loadCreateTablePresets());
    const [formData, setFormData] = useState<CreateTableFormData>(() =>
        createInitialFormData(FALLBACK_LOBBY_SERVER_OPTIONS)
    );
    const didLoadPresetForOpenRef = useRef(false);
    const hasUserEditedFormRef = useRef(false);
    const serverUrl = useSessionStore((state) => state.serverUrl);

    const {
        addAI,
        createTable,
        loadServerOptions,
        serverOptions,
        serverOptionsLoadedAt,
        isLoadingOptions,
        optionsError,
    } = useLobbyStore();

    const selectedGameType = useMemo(
        () => findGameType(serverOptions, formData.gameType),
        [formData.gameType, serverOptions],
    );
    const humanPlayerType = getHumanPlayerType(serverOptions);
    const computerPlayerType = getDefaultComputerPlayerType(serverOptions);
    const validationError = validateDeckGameTypePair(formData.gameType, formData.deckType);

    useEffect(() => {
        if (!isOpen) return;
        void loadServerOptions();
    }, [isOpen, loadServerOptions]);

    useEffect(() => {
        if (!isOpen) return;
        if (!didLoadPresetForOpenRef.current) return;
        setFormData((prev) => reconcileFormWithOptions(prev, serverOptions));
    }, [isOpen, serverOptions]);

    useEffect(() => {
        if (!isOpen) {
            didLoadPresetForOpenRef.current = false;
            hasUserEditedFormRef.current = false;
            setPresetMessage(null);
            return;
        }

        if (didLoadPresetForOpenRef.current || isLoadingOptions) return;
        if (!serverOptionsLoadedAt && !optionsError) return;

        const nextPresets = appConfigService.loadCreateTablePresets();
        setPresets(nextPresets);
        const preset = nextPresets.lastUsed;
        setFormData((prev) => {
            const loadedForm = preset ? createFormDataFromPreset(preset) : createInitialFormData(serverOptions);
            return reconcileFormWithOptions(hasUserEditedFormRef.current ? prev : loadedForm, serverOptions);
        });
        setLoadPresetSlot(preset ? 'lastUsed' : 'default');
        didLoadPresetForOpenRef.current = true;
    }, [isOpen, isLoadingOptions, optionsError, serverOptions, serverOptionsLoadedAt]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitForm();
    };

    const submitForm = async () => {
        const gameDeckError = validateDeckGameTypePair(formData.gameType, formData.deckType);
        if (gameDeckError) {
            setError(gameDeckError);
            return;
        }

        setIsLoading(true);
        setError(null);

        const playerTypes = resizePlayerTypes(
            formData.playerTypes,
            formData.numberOfPlayers,
            humanPlayerType,
        );
        const aiSeats = getConfiguredAiSeats(playerTypes, formData.aiSeats, serverOptions);
        const incompleteAiSeat = aiSeats.find(seat => !seat.deck);
        if (incompleteAiSeat) {
            setError(`Select a deck for Seat ${incompleteAiSeat.index + 1} before creating the table.`);
            setIsLoading(false);
            return;
        }

        const bannedUsers = appConfigService.loadIgnoredUsers(serverUrl);
        const perPlayerEmblemCards = formData.emblemCardsEnabled
            ? expandEmblemDeckCards(formData.perPlayerEmblemDeck)
            : [];
        const globalEmblemCards = formData.emblemCardsEnabled
            ? expandEmblemDeckCards(formData.startingPlayerEmblemDeck)
            : [];
        const options: MatchOptions = {
            name: formData.name.trim() || `${formData.gameType} Game`,
            gameType: formData.gameType,
            deckType: formData.deckType,
            winsNeeded: formData.winsNeeded,
            quitRatio: formData.quitRatio,
            freeMulligans: formData.freeMulligans,
            matchTimeLimit: formData.timeLimit,
            matchBufferTime: formData.bufferTime,
            attackOption: formData.attackOption,
            range: formData.range,
            password: formData.password || undefined,
            skillLevel: formData.skillLevel,
            limited: isLimitedDeckType(formData.deckType),
            rated: formData.rated,
            rollbackTurnsAllowed: formData.rollbackTurnsAllowed,
            spectatorsAllowed: formData.spectatorsAllowed,
            playerTypes,
            minimumRating: formData.minimumRating,
            edhPowerLevel: formData.edhPowerLevel,
            mulliganType: formData.mulliganType,
            customStartLifeEnabled: formData.customStartLifeEnabled,
            customStartLife: formData.customStartLife,
            customStartHandSizeEnabled: formData.customStartHandSizeEnabled,
            customStartHandSize: formData.customStartHandSize,
            planeChase: formData.planeChase,
            perPlayerEmblemCards: perPlayerEmblemCards.length > 0 ? perPlayerEmblemCards : undefined,
            globalEmblemCards: globalEmblemCards.length > 0 ? globalEmblemCards : undefined,
            bannedUsers: bannedUsers.length > 0 ? bannedUsers : undefined,
        };

        try {
            setPresets(appConfigService.saveCreateTablePreset('lastUsed', createPresetFromFormData(formData)));
            const table = await createTable(options);
            if (table) {
                for (const aiSeat of aiSeats) {
                    const joined = await addAI(
                        table.tableId,
                        aiSeat.name,
                        aiSeat.deck!,
                        aiSeat.playerType,
                        aiSeat.skill,
                    );
                    if (!joined) {
                        throw new Error(`Created table, but failed to seat ${aiSeat.name || `Seat ${aiSeat.index + 1}`}. Open the waiting room and add that player manually.`);
                    }
                }
                onTableCreated(table.tableId);
            }
        } catch (err: any) {
            console.error('Failed to create table:', err);
            // Display specific server error
            const msg = err.message || String(err);
            setError(msg.replace(/^Error:\s*/, ''));
        } finally {
            setIsLoading(false);
        }
    };

    const updateField = <K extends keyof typeof formData>(
        field: K,
        value: typeof formData[K]
    ) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError(null);
    };

    const loadPreset = (slot: CreateTableLoadPresetSlot) => {
        const nextPresets = appConfigService.loadCreateTablePresets();
        setPresets(nextPresets);
        setLoadPresetSlot(slot);

        if (slot === 'default') {
            hasUserEditedFormRef.current = false;
            setFormData(createInitialFormData(serverOptions));
            setPresetMessage('Loaded default settings');
            setError(null);
            return;
        }

        const preset = nextPresets[slot];
        if (!preset) {
            setPresetMessage(`${presetSlotLabel(slot)} is empty`);
            return;
        }

        hasUserEditedFormRef.current = false;
        setFormData(reconcileFormWithOptions(createFormDataFromPreset(preset), serverOptions));
        setPresetMessage(`Loaded ${presetSlotLabel(slot)}`);
        setError(null);
    };

    const savePreset = (slot: Exclude<CreateTablePresetSlot, 'lastUsed'>) => {
        setPresets(appConfigService.saveCreateTablePreset(slot, createPresetFromFormData(formData)));
        setSavePresetSlot(slot);
        setPresetMessage(`Saved ${presetSlotLabel(slot)}`);
        setError(null);
    };

    const updateGameType = (gameType: string) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => {
            const nextGameType = findGameType(serverOptions, gameType);
            const numberOfPlayers = getClampedPlayerCount(nextGameType, prev.numberOfPlayers);
            return {
                ...prev,
                gameType,
                numberOfPlayers,
                playerTypes: resizePlayerTypes(prev.playerTypes, numberOfPlayers, humanPlayerType),
                aiSeats: resizeAiSeats(prev.aiSeats, numberOfPlayers),
            };
        });
        setError(null);
    };

    const updatePlayerCount = (count: number) => {
        hasUserEditedFormRef.current = true;
        const numberOfPlayers = getClampedPlayerCount(selectedGameType, count);
        setFormData((prev) => ({
            ...prev,
            numberOfPlayers,
            playerTypes: resizePlayerTypes(prev.playerTypes, numberOfPlayers, humanPlayerType),
            aiSeats: resizeAiSeats(prev.aiSeats, numberOfPlayers),
        }));
        setError(null);
    };

    const updateSeatPlayerType = (index: number, playerType: string) => {
        if (index === 0) return;
        hasUserEditedFormRef.current = true;
        setFormData((prev) => {
            const nextPlayerTypes = resizePlayerTypes(prev.playerTypes, prev.numberOfPlayers, humanPlayerType);
            nextPlayerTypes[index] = playerType;
            return { ...prev, playerTypes: nextPlayerTypes, aiSeats: resizeAiSeats(prev.aiSeats, prev.numberOfPlayers) };
        });
        setError(null);
    };

    const updateAiSeat = (index: number, patch: Partial<CreateTableAiSeatFormData>) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => {
            const aiSeats = resizeAiSeats(prev.aiSeats, prev.numberOfPlayers);
            aiSeats[index] = {
                ...aiSeats[index],
                ...patch,
            };
            return { ...prev, aiSeats };
        });
        setError(null);
    };

    const fillOpenSeats = (playerType: string) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => ({
            ...prev,
            playerTypes: resizePlayerTypes(
                prev.playerTypes.map((currentPlayerType, index) => index === 0 ? currentPlayerType : playerType),
                prev.numberOfPlayers,
                humanPlayerType,
            ),
            aiSeats: resizeAiSeats(prev.aiSeats, prev.numberOfPlayers),
        }));
        setError(null);
    };

    const showMultiplayerOptions = selectedGameType.useRange || selectedGameType.useAttackOption;
    const seatPlayerTypes = resizePlayerTypes(formData.playerTypes, formData.numberOfPlayers, humanPlayerType);
    const aiSeatCount = seatPlayerTypes.filter(playerType => isAiPlayerType(playerType, serverOptions)).length;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create Game Table"
            size="lg"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => void submitForm()}
                        isLoading={isLoading}
                        disabled={Boolean(validationError)}
                    >
                        Create Table
                    </Button>
                </>
            }
        >
            <form className="create-table-form" onSubmit={handleSubmit}>
                {(error || validationError) && (
                    <div className="error-message p-3 mb-4 bg-red-100 text-red-700 rounded border border-red-300">
                        {error || validationError}
                    </div>
                )}
                {optionsError && (
                    <div className="create-table-warning" role="status">
                        Using fallback options. {optionsError}
                    </div>
                )}

                <section className="preset-toolbar" aria-label="Create table presets">
                    <div className="preset-toolbar-group">
                        <label htmlFor="loadPresetSlot" className="input-label">
                            Load
                        </label>
                        <select
                            id="loadPresetSlot"
                            className="input preset-select"
                            value={loadPresetSlot}
                            onChange={(e) => setLoadPresetSlot(e.target.value as CreateTableLoadPresetSlot)}
                            data-testid="create-table-load-preset-select"
                        >
                            <option value="default">Default settings</option>
                            <option value="lastUsed" disabled={!presets.lastUsed}>Last used</option>
                            <option value="config1" disabled={!presets.config1}>Config 1</option>
                            <option value="config2" disabled={!presets.config2}>Config 2</option>
                        </select>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => loadPreset(loadPresetSlot)}
                            data-testid="create-table-load-preset-button"
                        >
                            Load
                        </Button>
                    </div>

                    <div className="preset-toolbar-group">
                        <label htmlFor="savePresetSlot" className="input-label">
                            Save
                        </label>
                        <select
                            id="savePresetSlot"
                            className="input preset-select"
                            value={savePresetSlot}
                            onChange={(e) => setSavePresetSlot(e.target.value as Exclude<CreateTablePresetSlot, 'lastUsed'>)}
                            data-testid="create-table-save-preset-select"
                        >
                            <option value="config1">Config 1</option>
                            <option value="config2">Config 2</option>
                        </select>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => savePreset(savePresetSlot)}
                            data-testid="create-table-save-preset-button"
                        >
                            Save
                        </Button>
                    </div>

                    {presetMessage && (
                        <span className="preset-message" role="status" data-testid="create-table-preset-message">
                            {presetMessage}
                        </span>
                    )}
                </section>

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
                        data-testid="create-table-name-input"
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
                            onChange={(e) => updateGameType(e.target.value)}
                            disabled={isLoadingOptions}
                            data-testid="create-table-game-type-select"
                        >
                            {serverOptions.gameTypes.map((gameType) => (
                                <option key={gameType.name} value={gameType.name}>
                                    {gameType.name}
                                </option>
                            ))}
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
                            disabled={isLoadingOptions}
                            data-testid="create-table-deck-type-select"
                        >
                            {serverOptions.deckTypes.map((deckType) => (
                                <option key={deckType} value={deckType}>
                                    {deckType}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <section className="create-table-section" aria-label="Match settings">
                    <div className="create-table-section-header">
                        <h4>Match settings</h4>
                    </div>
                    <div className="advanced-grid">
                        <div className="input-group">
                            <label htmlFor="winsNeeded" className="input-label">
                                Wins Needed
                            </label>
                            <input
                                id="winsNeeded"
                                type="number"
                                className="input"
                                min={1}
                                max={5}
                                value={formData.winsNeeded}
                                onChange={(e) => updateField('winsNeeded', clampInteger(Number(e.target.value), 1, 5))}
                                data-testid="create-table-wins-needed-input"
                            />
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
                                data-testid="create-table-time-limit-select"
                            >
                                {MATCH_TIME_LIMIT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="bufferTime" className="input-label">
                                Buffer
                            </label>
                            <select
                                id="bufferTime"
                                className="input"
                                value={formData.bufferTime}
                                onChange={(e) => updateField('bufferTime', e.target.value)}
                                data-testid="create-table-buffer-time-select"
                            >
                                {MATCH_BUFFER_TIME_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="skillLevel" className="input-label">
                                Skill
                            </label>
                            <select
                                id="skillLevel"
                                className="input"
                                value={formData.skillLevel}
                                onChange={(e) => updateField('skillLevel', e.target.value as SkillLevel)}
                                data-testid="create-table-skill-level-select"
                            >
                                {SKILL_LEVEL_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {showMultiplayerOptions && (
                        <div className="advanced-grid advanced-grid-compact">
                            <div className="input-group">
                                <label htmlFor="range" className="input-label">
                                    Range
                                </label>
                                <select
                                    id="range"
                                    className="input"
                                    value={formData.range}
                                    onChange={(e) => updateField('range', e.target.value)}
                                    disabled={!selectedGameType.useRange}
                                    data-testid="create-table-range-select"
                                >
                                    {RANGE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label htmlFor="attackOption" className="input-label">
                                    Attack
                                </label>
                                <select
                                    id="attackOption"
                                    className="input"
                                    value={formData.attackOption}
                                    onChange={(e) => updateField('attackOption', e.target.value)}
                                    disabled={!selectedGameType.useAttackOption}
                                    data-testid="create-table-attack-option-select"
                                >
                                    {ATTACK_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </section>

                <section className="create-table-section" aria-label="Custom table options">
                    <div className="create-table-section-header">
                        <h4>Custom options</h4>
                        <span className="custom-options-count" data-testid="create-table-custom-options-count">
                            {countActiveCustomOptions(formData)} active
                        </span>
                    </div>

                    <div className="advanced-grid">
                        <div className="input-group">
                            <label htmlFor="mulliganType" className="input-label">
                                Mulligan
                            </label>
                            <select
                                id="mulliganType"
                                className="input"
                                value={formData.mulliganType}
                                onChange={(e) => updateField('mulliganType', e.target.value)}
                                data-testid="create-table-mulligan-type-select"
                            >
                                {MULLIGAN_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="freeMulligans" className="input-label">
                                Free Mulligans
                            </label>
                            <input
                                id="freeMulligans"
                                type="number"
                                className="input"
                                min={0}
                                max={5}
                                value={formData.freeMulligans}
                                onChange={(e) => updateField('freeMulligans', clampInteger(Number(e.target.value), 0, 5))}
                                data-testid="create-table-free-mulligans-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="customStartLife" className="input-label">
                                Start Life
                            </label>
                            <div className="compound-field">
                                <label className="compact-toggle" aria-label="Enable custom starting life">
                                    <input
                                        type="checkbox"
                                        checked={formData.customStartLifeEnabled}
                                        onChange={(e) => updateField('customStartLifeEnabled', e.target.checked)}
                                        data-testid="create-table-custom-life-checkbox"
                                    />
                                </label>
                                <input
                                    id="customStartLife"
                                    type="number"
                                    className="input"
                                    min={1}
                                    max={100}
                                    value={formData.customStartLife}
                                    disabled={!formData.customStartLifeEnabled}
                                    onChange={(e) => updateField('customStartLife', clampInteger(Number(e.target.value), 1, 100))}
                                    data-testid="create-table-custom-life-input"
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="customStartHandSize" className="input-label">
                                Start Hand
                            </label>
                            <div className="compound-field">
                                <label className="compact-toggle" aria-label="Enable custom starting hand size">
                                    <input
                                        type="checkbox"
                                        checked={formData.customStartHandSizeEnabled}
                                        onChange={(e) => updateField('customStartHandSizeEnabled', e.target.checked)}
                                        data-testid="create-table-custom-hand-checkbox"
                                    />
                                </label>
                                <input
                                    id="customStartHandSize"
                                    type="number"
                                    className="input"
                                    min={0}
                                    max={20}
                                    value={formData.customStartHandSize}
                                    disabled={!formData.customStartHandSizeEnabled}
                                    onChange={(e) => updateField('customStartHandSize', clampInteger(Number(e.target.value), 0, 20))}
                                    data-testid="create-table-custom-hand-input"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="checkbox-group checkbox-grid custom-options-toggles">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.planeChase}
                                onChange={(e) => updateField('planeChase', e.target.checked)}
                                data-testid="create-table-planechase-checkbox"
                            />
                            <span className="checkbox-text">Planechase</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.emblemCardsEnabled}
                                onChange={(e) => updateField('emblemCardsEnabled', e.target.checked)}
                                data-testid="create-table-emblem-cards-checkbox"
                            />
                            <span className="checkbox-text">Emblem cards</span>
                        </label>
                    </div>

                    {formData.emblemCardsEnabled && (
                        <div className="emblem-deck-grid">
                            <DeckPicker
                                selectedDeck={formData.perPlayerEmblemDeck}
                                onDeckChange={(deck) => updateField('perPlayerEmblemDeck', deck)}
                                format={formData.deckType}
                                isLoading={isLoading}
                                error={null}
                                onError={setError}
                                label="Per-player emblems"
                            />
                            <DeckPicker
                                selectedDeck={formData.startingPlayerEmblemDeck}
                                onDeckChange={(deck) => updateField('startingPlayerEmblemDeck', deck)}
                                format={formData.deckType}
                                isLoading={isLoading}
                                error={null}
                                onError={setError}
                                label="Starting-player emblems"
                            />
                        </div>
                    )}
                </section>

                <section className="seat-editor" aria-label="Table seats">
                    <div className="seat-editor-header">
                        <div>
                            <h4>Seats</h4>
                            <p>
                                {selectedGameType.minPlayers}
                                {selectedGameType.minPlayers !== selectedGameType.maxPlayers
                                    ? `-${selectedGameType.maxPlayers}`
                                    : ''} players
                            </p>
                        </div>
                        {aiSeatCount > 0 && (
                            <span className="seat-editor-summary">
                                {aiSeatCount} AI deck{aiSeatCount === 1 ? '' : 's'} required
                            </span>
                        )}
                        <div className="seat-editor-actions">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => fillOpenSeats(humanPlayerType)}
                            >
                                Humans
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => fillOpenSeats(computerPlayerType)}
                            >
                                AI
                            </Button>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="input-group">
                            <label htmlFor="numberOfPlayers" className="input-label">
                                Players
                            </label>
                            <input
                                id="numberOfPlayers"
                                type="number"
                                className="input"
                                min={selectedGameType.minPlayers}
                                max={selectedGameType.maxPlayers}
                                value={formData.numberOfPlayers}
                                onChange={(e) => updatePlayerCount(Number(e.target.value))}
                                disabled={selectedGameType.minPlayers === selectedGameType.maxPlayers}
                                data-testid="create-table-player-count-input"
                            />
                        </div>
                    </div>

                    <div className="seat-list">
                        {seatPlayerTypes.map((playerType, index) => {
                            const isAiSeat = isAiPlayerType(playerType, serverOptions);
                            const aiSeat = getAiSeat(formData.aiSeats, index);

                            return (
                                <div className={`seat-row ${isAiSeat ? 'seat-row-ai' : ''}`} key={index}>
                                    <span className="seat-number">Seat {index + 1}</span>
                                    <select
                                        className="input"
                                        value={playerType}
                                        onChange={(e) => updateSeatPlayerType(index, e.target.value)}
                                        disabled={index === 0}
                                        aria-label={`Seat ${index + 1} player type`}
                                        data-testid={`create-table-seat-${index + 1}-player-type`}
                                    >
                                        {serverOptions.playerTypes.map((type) => (
                                            <option
                                                key={type.value}
                                                value={type.value}
                                                disabled={index === 0 && type.isAI}
                                            >
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>

                                    {isAiSeat && (
                                        <div className="seat-ai-settings">
                                            <div className="seat-ai-fields">
                                                <div className="input-group">
                                                    <label htmlFor={`aiSeatName${index}`} className="input-label">
                                                        AI Name
                                                    </label>
                                                    <input
                                                        id={`aiSeatName${index}`}
                                                        type="text"
                                                        className="input"
                                                        value={aiSeat.name}
                                                        onChange={(e) => updateAiSeat(index, { name: e.target.value })}
                                                        data-testid={`create-table-seat-${index + 1}-ai-name`}
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label htmlFor={`aiSeatSkill${index}`} className="input-label">
                                                        Skill
                                                    </label>
                                                    <input
                                                        id={`aiSeatSkill${index}`}
                                                        type="number"
                                                        className="input"
                                                        min={1}
                                                        max={10}
                                                        step={1}
                                                        value={aiSeat.skill}
                                                        onChange={(e) => updateAiSeat(index, { skill: clampInteger(Number(e.target.value), 1, 10) })}
                                                        data-testid={`create-table-seat-${index + 1}-ai-skill`}
                                                    />
                                                </div>
                                            </div>
                                            <DeckPicker
                                                selectedDeck={aiSeat.deck}
                                                onDeckChange={(deck) => updateAiSeat(index, { deck })}
                                                format={formData.deckType}
                                                isLoading={isLoading}
                                                error={null}
                                                onError={setError}
                                                label={`Seat ${index + 1} AI Deck`}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="create-table-section" aria-label="Access and requirements">
                    <div className="create-table-section-header">
                        <h4>Access and requirements</h4>
                    </div>

                    <div className="advanced-grid">
                        <div className="input-group">
                            <label htmlFor="password" className="input-label">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                value={formData.password}
                                onChange={(e) => updateField('password', e.target.value)}
                                placeholder="Public game"
                                data-testid="create-table-password-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="quitRatio" className="input-label">
                                Max Quit %
                            </label>
                            <input
                                id="quitRatio"
                                type="number"
                                className="input"
                                min={0}
                                max={100}
                                step={5}
                                value={formData.quitRatio}
                                onChange={(e) => updateField('quitRatio', clampInteger(Number(e.target.value), 0, 100))}
                                data-testid="create-table-quit-ratio-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="minimumRating" className="input-label">
                                Min Rating
                            </label>
                            <input
                                id="minimumRating"
                                type="number"
                                className="input"
                                min={0}
                                max={3000}
                                step={10}
                                value={formData.minimumRating}
                                onChange={(e) => updateField('minimumRating', clampInteger(Number(e.target.value), 0, 3000))}
                                data-testid="create-table-minimum-rating-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="edhPowerLevel" className="input-label">
                                EDH Power
                            </label>
                            <input
                                id="edhPowerLevel"
                                type="number"
                                className="input"
                                min={0}
                                max={100}
                                step={5}
                                value={formData.edhPowerLevel}
                                onChange={(e) => updateField('edhPowerLevel', clampInteger(Number(e.target.value), 0, 100))}
                                data-testid="create-table-edh-power-input"
                            />
                        </div>
                    </div>

                    <div className="checkbox-group checkbox-grid">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.spectatorsAllowed}
                                onChange={(e) => updateField('spectatorsAllowed', e.target.checked)}
                                data-testid="create-table-spectators-checkbox"
                            />
                            <span className="checkbox-text">Spectators</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.rollbackTurnsAllowed}
                                onChange={(e) => updateField('rollbackTurnsAllowed', e.target.checked)}
                                data-testid="create-table-rollback-checkbox"
                            />
                            <span className="checkbox-text">Rollbacks</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.rated}
                                onChange={(e) => updateField('rated', e.target.checked)}
                                data-testid="create-table-rated-checkbox"
                            />
                            <span className="checkbox-text">Rated game</span>
                        </label>
                    </div>
                </section>
            </form>
        </Modal>
    );
};

export default CreateTableDialog;

function createInitialFormData(options: LobbyServerOptions): CreateTableFormData {
    const gameType = getDefaultGameTypeName(options);
    const deckType = getDefaultDeckType(options);
    const humanPlayerType = getHumanPlayerType(options);
    const gameTypeView = findGameType(options, gameType);
    const numberOfPlayers = getClampedPlayerCount(gameTypeView, gameTypeView.minPlayers);

    return {
        name: '',
        gameType,
        deckType,
        winsNeeded: 2,
        freeMulligans: 0,
        timeLimit: 'MIN__25',
        bufferTime: 'NONE',
        mulliganType: 'GAME_DEFAULT',
        password: '',
        skillLevel: SkillLevel.CASUAL,
        spectatorsAllowed: true,
        rollbackTurnsAllowed: true,
        planeChase: false,
        emblemCardsEnabled: false,
        perPlayerEmblemDeck: null,
        startingPlayerEmblemDeck: null,
        customStartLifeEnabled: false,
        customStartLife: 20,
        customStartHandSizeEnabled: false,
        customStartHandSize: 7,
        rated: false,
        quitRatio: 100,
        minimumRating: 0,
        edhPowerLevel: 0,
        range: 'ALL',
        attackOption: 'MULTIPLE',
        numberOfPlayers,
        playerTypes: resizePlayerTypes([], numberOfPlayers, humanPlayerType),
        aiSeats: resizeAiSeats([], numberOfPlayers),
    };
}

function reconcileFormWithOptions(
    formData: CreateTableFormData,
    options: LobbyServerOptions,
): CreateTableFormData {
    const gameType = options.gameTypes.some(option => option.name === formData.gameType)
        ? formData.gameType
        : getDefaultGameTypeName(options);
    const deckType = options.deckTypes.includes(formData.deckType)
        ? formData.deckType
        : getDefaultDeckType(options);
    const humanPlayerType = getHumanPlayerType(options);
    const selectedGameType = findGameType(options, gameType);
    const numberOfPlayers = getClampedPlayerCount(selectedGameType, formData.numberOfPlayers);

    return {
        ...formData,
        gameType,
        deckType,
        numberOfPlayers,
        playerTypes: reconcilePlayerTypesWithOptions(formData.playerTypes, numberOfPlayers, humanPlayerType, options),
        aiSeats: resizeAiSeats(formData.aiSeats, numberOfPlayers),
    };
}

function clampInteger(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
}

function countActiveCustomOptions(formData: CreateTableFormData): number {
    return [
        formData.freeMulligans > 0,
        formData.mulliganType !== 'GAME_DEFAULT',
        formData.customStartLifeEnabled,
        formData.customStartHandSizeEnabled,
        formData.planeChase,
        formData.emblemCardsEnabled && (formData.perPlayerEmblemDeck || formData.startingPlayerEmblemDeck),
    ].filter(Boolean).length;
}

function expandEmblemDeckCards(deck: DeckCardLists | null): DeckCardInfo[] {
    if (!deck) return [];

    return deck.cards.flatMap((card) =>
        Array.from({ length: clampInteger(card.amount, 1, 99) }, () => ({
            cardName: card.cardName,
            setCode: card.setCode ?? null,
            cardNumber: card.cardNumber ?? null,
            amount: 1,
        }))
    );
}

function createPresetFromFormData(formData: CreateTableFormData): Omit<CreateTablePresetConfig, 'savedAt'> {
    return {
        name: formData.name,
        gameType: formData.gameType,
        deckType: formData.deckType,
        winsNeeded: formData.winsNeeded,
        freeMulligans: formData.freeMulligans,
        timeLimit: formData.timeLimit,
        bufferTime: formData.bufferTime,
        mulliganType: formData.mulliganType,
        password: formData.password,
        skillLevel: formData.skillLevel,
        spectatorsAllowed: formData.spectatorsAllowed,
        rollbackTurnsAllowed: formData.rollbackTurnsAllowed,
        planeChase: formData.planeChase,
        emblemCardsEnabled: formData.emblemCardsEnabled,
        perPlayerEmblemDeck: cloneDeck(formData.perPlayerEmblemDeck),
        startingPlayerEmblemDeck: cloneDeck(formData.startingPlayerEmblemDeck),
        customStartLifeEnabled: formData.customStartLifeEnabled,
        customStartLife: formData.customStartLife,
        customStartHandSizeEnabled: formData.customStartHandSizeEnabled,
        customStartHandSize: formData.customStartHandSize,
        rated: formData.rated,
        quitRatio: formData.quitRatio,
        minimumRating: formData.minimumRating,
        edhPowerLevel: formData.edhPowerLevel,
        range: formData.range,
        attackOption: formData.attackOption,
        numberOfPlayers: formData.numberOfPlayers,
        playerTypes: [...formData.playerTypes],
        aiSeats: formData.aiSeats.map(cloneAiSeat),
    };
}

function createFormDataFromPreset(preset: CreateTablePresetConfig): CreateTableFormData {
    return {
        name: preset.name,
        gameType: preset.gameType,
        deckType: preset.deckType,
        winsNeeded: preset.winsNeeded,
        freeMulligans: preset.freeMulligans,
        timeLimit: preset.timeLimit,
        bufferTime: preset.bufferTime,
        mulliganType: preset.mulliganType,
        password: preset.password,
        skillLevel: preset.skillLevel as SkillLevel,
        spectatorsAllowed: preset.spectatorsAllowed,
        rollbackTurnsAllowed: preset.rollbackTurnsAllowed,
        planeChase: preset.planeChase,
        emblemCardsEnabled: preset.emblemCardsEnabled,
        perPlayerEmblemDeck: cloneDeck(preset.perPlayerEmblemDeck),
        startingPlayerEmblemDeck: cloneDeck(preset.startingPlayerEmblemDeck),
        customStartLifeEnabled: preset.customStartLifeEnabled,
        customStartLife: preset.customStartLife,
        customStartHandSizeEnabled: preset.customStartHandSizeEnabled,
        customStartHandSize: preset.customStartHandSize,
        rated: preset.rated,
        quitRatio: preset.quitRatio,
        minimumRating: preset.minimumRating,
        edhPowerLevel: preset.edhPowerLevel,
        range: preset.range,
        attackOption: preset.attackOption,
        numberOfPlayers: preset.numberOfPlayers,
        playerTypes: [...preset.playerTypes],
        aiSeats: resizeAiSeats(preset.aiSeats, preset.numberOfPlayers),
    };
}

function createDefaultAiSeat(index: number): CreateTableAiSeatFormData {
    return {
        name: `Computer ${index + 1}`,
        skill: 2,
        deck: null,
    };
}

function resizeAiSeats(aiSeats: CreateTableAiSeatFormData[], count: number): CreateTableAiSeatFormData[] {
    return Array.from({ length: count }, (_, index) => cloneAiSeat(aiSeats[index] ?? createDefaultAiSeat(index)));
}

function cloneAiSeat(aiSeat: CreateTableAiSeatFormData): CreateTableAiSeatFormData {
    return {
        name: aiSeat.name,
        skill: aiSeat.skill,
        deck: cloneDeck(aiSeat.deck),
    };
}

function cloneDeck(deck: DeckCardLists | null): DeckCardLists | null {
    return deck
        ? {
            ...deck,
            cards: deck.cards.map(card => ({ ...card })),
            sideboard: deck.sideboard.map(card => ({ ...card })),
        }
        : null;
}

function getAiSeat(aiSeats: CreateTableAiSeatFormData[], index: number): CreateTableAiSeatFormData {
    return aiSeats[index] ?? createDefaultAiSeat(index);
}

function isAiPlayerType(playerType: string, options: LobbyServerOptions): boolean {
    return Boolean(options.playerTypes.find(type => type.value === playerType)?.isAI)
        || playerType.toLowerCase().includes('computer');
}

interface ConfiguredAiSeat {
    index: number;
    playerType: string;
    name: string;
    skill: number;
    deck: DeckCardLists | null;
}

function getConfiguredAiSeats(
    playerTypes: string[],
    aiSeats: CreateTableAiSeatFormData[],
    options: LobbyServerOptions,
): ConfiguredAiSeat[] {
    return playerTypes
        .map((playerType, index): ConfiguredAiSeat | null => {
            if (!isAiPlayerType(playerType, options)) return null;
            const aiSeat = getAiSeat(aiSeats, index);
            const name = aiSeat.name.trim() || `Computer ${index + 1}`;
            return {
                index,
                playerType,
                name,
                skill: clampInteger(aiSeat.skill, 1, 10),
                deck: aiSeat.deck,
            };
        })
        .filter((seat): seat is ConfiguredAiSeat => seat !== null);
}

function reconcilePlayerTypesWithOptions(
    playerTypes: string[],
    count: number,
    humanPlayerType: string,
    options: LobbyServerOptions,
): string[] {
    const allowedTypes = new Set(options.playerTypes.map(type => type.value));
    return resizePlayerTypes(playerTypes, count, humanPlayerType)
        .map((playerType, index) => {
            if (index === 0) return humanPlayerType;
            return allowedTypes.has(playerType) ? playerType : humanPlayerType;
        });
}

function presetSlotLabel(slot: CreateTableLoadPresetSlot): string {
    switch (slot) {
        case 'lastUsed':
            return 'last used';
        case 'config1':
            return 'Config 1';
        case 'config2':
            return 'Config 2';
        case 'default':
        default:
            return 'default settings';
    }
}
