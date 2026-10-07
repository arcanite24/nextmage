import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button } from '../common';
import { useLobbyStore, useSessionStore } from '../../stores';
import {
    appConfigService,
    FALLBACK_LOBBY_SERVER_OPTIONS,
    findTournamentType,
    getClampedPlayerCount,
    getDefaultComputerPlayerType,
    getDefaultDeckType,
    getDefaultTournamentTypeName,
    getHumanPlayerType,
    isLimitedDeckType,
    isTournamentTypeCubeBooster,
    isTournamentTypeDraft,
    isTournamentTypeElimination,
    isTournamentTypeJumpstart,
    isTournamentTypeLimited,
    isTournamentTypeRandom,
    isTournamentTypeReshuffled,
    isTournamentTypeRichMan,
    resizePlayerTypes,
    validateDeckGameTypePair,
    type CreateTournamentLoadPresetSlot,
    type CreateTournamentPresetConfig,
    type CreateTournamentPresetSlot,
    type LobbyServerOptions,
} from '../../services';
import { DeckCardLists, DraftTimingOption, GameTypeView, SkillLevel, TournamentOptions } from '../../types';
import { DeckPicker } from './DeckPicker';
import './CreateTableDialog.css';

interface CreateTournamentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onTournamentCreated: (tableId: string) => void;
}

interface CreateTournamentFormData {
    name: string;
    tournamentType: string;
    gameType: string;
    deckType: string;
    winsNeeded: number;
    numberRounds: number;
    numberOfPlayers: number;
    singleMultiplayerGame: boolean;
    timeLimit: string;
    bufferTime: string;
    constructionTimeMinutes: number;
    draftTiming: DraftTimingOption;
    draftCubeName: string;
    setCodes: string[];
    randomSetCodes: string[];
    cubeFromDeck: DeckCardLists | null;
    jumpstartPacks: string;
    password: string;
    skillLevel: SkillLevel;
    spectatorsAllowed: boolean;
    rollbackTurnsAllowed: boolean;
    rated: boolean;
    quitRatio: number;
    minimumRating: number;
    playerTypes: string[];
    playerSkills: number[];
}

const MATCH_TIME_LIMIT_OPTIONS = [
    { value: 'NONE', label: 'Unlimited' },
    { value: 'MIN___5', label: '5 minutes' },
    { value: 'MIN__10', label: '10 minutes' },
    { value: 'MIN__15', label: '15 minutes' },
    { value: 'MIN__20', label: '20 minutes' },
    { value: 'MIN__25', label: '25 minutes' },
    { value: 'MIN__30', label: '30 minutes' },
    { value: 'MIN__45', label: '45 minutes' },
    { value: 'MIN__60', label: '60 minutes' },
    { value: 'MIN__90', label: '90 minutes' },
    { value: 'MIN_120', label: '120 minutes' },
] as const;

const MATCH_BUFFER_TIME_OPTIONS = [
    { value: 'NONE', label: 'No buffer' },
    { value: 'SEC__01', label: '1 second' },
    { value: 'SEC__03', label: '3 seconds' },
    { value: 'SEC__05', label: '5 seconds' },
    { value: 'SEC__10', label: '10 seconds' },
    { value: 'SEC__15', label: '15 seconds' },
    { value: 'SEC__30', label: '30 seconds' },
] as const;

const SKILL_LEVEL_OPTIONS = [
    { value: SkillLevel.BEGINNER, label: 'Beginner' },
    { value: SkillLevel.CASUAL, label: 'Casual' },
    { value: SkillLevel.SERIOUS, label: 'Serious' },
] as const;

const DRAFT_TIMING_OPTIONS: Array<{ value: DraftTimingOption; label: string }> = [
    { value: 'BEGINNER', label: 'Beginner (x2.0)' },
    { value: 'REGULAR', label: 'Regular (x1.5)' },
    { value: 'PROFESSIONAL', label: 'Professional (x1.0)' },
];

const CUBE_FROM_DECK_NAME = 'Cube From Deck';
const MAX_SINGLE_GAME_WORKABLE_PLAYERS = 6;

export const CreateTournamentDialog: React.FC<CreateTournamentDialogProps> = ({
    isOpen,
    onClose,
    onTournamentCreated,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [presetMessage, setPresetMessage] = useState<string | null>(null);
    const [loadPresetSlot, setLoadPresetSlot] = useState<CreateTournamentLoadPresetSlot>('lastUsed');
    const [savePresetSlot, setSavePresetSlot] = useState<Exclude<CreateTournamentPresetSlot, 'lastUsed'>>('config1');
    const [presets, setPresets] = useState(() => appConfigService.loadCreateTournamentPresets());
    const [formData, setFormData] = useState<CreateTournamentFormData>(() =>
        createInitialFormData(FALLBACK_LOBBY_SERVER_OPTIONS)
    );
    const didLoadPresetForOpenRef = useRef(false);
    const hasUserEditedFormRef = useRef(false);

    const serverUrl = useSessionStore((state) => state.serverUrl);
    const {
        createTournament,
        loadServerOptions,
        serverOptions,
        serverOptionsLoadedAt,
        isLoadingOptions,
        optionsError,
    } = useLobbyStore();

    const selectedTournamentType = useMemo(
        () => findTournamentType(serverOptions, formData.tournamentType),
        [formData.tournamentType, serverOptions],
    );
    const selectedGameType = useMemo(
        () => findTournamentGameType(serverOptions, formData.gameType),
        [formData.gameType, serverOptions],
    );
    const humanPlayerType = getHumanPlayerType(serverOptions);
    const computerPlayerType = getDefaultComputerPlayerType(serverOptions);
    const isLimited = isTournamentTypeLimited(selectedTournamentType);
    const isDraft = isTournamentTypeDraft(selectedTournamentType);
    const isCube = isTournamentTypeCubeBooster(selectedTournamentType);
    const isRandomPool = isTournamentTypeRandom(selectedTournamentType)
        || isTournamentTypeRichMan(selectedTournamentType)
        || isTournamentTypeReshuffled(selectedTournamentType);
    const isJumpstart = isTournamentTypeJumpstart(selectedTournamentType);
    const packCount = Math.max(1, selectedTournamentType?.numBoosters ?? (isDraft ? 3 : 6));
    const showPackPicker = isLimited && !isCube && !isRandomPool && !isJumpstart;
    const showLimitedSetup = isLimited;
    const seatPlayerTypes = resizePlayerTypes(formData.playerTypes, formData.numberOfPlayers, humanPlayerType);
    const workablePlayers = seatPlayerTypes.filter(playerType => isWorkablePlayerType(playerType, serverOptions)).length;
    const validationError = validateTournamentForm(formData, serverOptions, selectedTournamentType);

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
            setError(null);
            return;
        }

        if (didLoadPresetForOpenRef.current || isLoadingOptions) return;
        if (!serverOptionsLoadedAt && !optionsError) return;

        const nextPresets = appConfigService.loadCreateTournamentPresets();
        setPresets(nextPresets);
        const preset = nextPresets.lastUsed;
        setFormData((prev) => {
            const loadedForm = preset ? createFormDataFromPreset(preset) : createInitialFormData(serverOptions);
            return reconcileFormWithOptions(hasUserEditedFormRef.current ? prev : loadedForm, serverOptions);
        });
        setLoadPresetSlot(preset ? 'lastUsed' : 'default');
        didLoadPresetForOpenRef.current = true;
    }, [isOpen, isLoadingOptions, optionsError, serverOptions, serverOptionsLoadedAt]);

    const updateField = <K extends keyof CreateTournamentFormData>(
        field: K,
        value: CreateTournamentFormData[K],
    ) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError(null);
    };

    const updateTournamentType = (tournamentType: string) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => {
            const nextType = findTournamentType(serverOptions, tournamentType);
            const numberOfPlayers = clampTournamentPlayerCount(nextType, prev.numberOfPlayers);
            const isNextLimited = isTournamentTypeLimited(nextType);
            return {
                ...prev,
                tournamentType,
                numberOfPlayers,
                gameType: isNextLimited ? 'Two Player Duel' : ensureTournamentGameType(serverOptions, prev.gameType),
                deckType: isNextLimited ? 'Limited' : ensureDeckType(serverOptions, prev.deckType),
                setCodes: resizeSetCodes(prev.setCodes, Math.max(1, nextType?.numBoosters ?? (isTournamentTypeDraft(nextType) ? 3 : 6))),
                playerTypes: resizePlayerTypes(prev.playerTypes, numberOfPlayers, humanPlayerType),
                playerSkills: resizePlayerSkills(prev.playerSkills, numberOfPlayers),
            };
        });
        setError(null);
    };

    const updatePlayerCount = (count: number) => {
        hasUserEditedFormRef.current = true;
        const numberOfPlayers = clampTournamentPlayerCount(selectedTournamentType, count);
        setFormData((prev) => ({
            ...prev,
            numberOfPlayers,
            playerTypes: resizePlayerTypes(prev.playerTypes, numberOfPlayers, humanPlayerType),
            playerSkills: resizePlayerSkills(prev.playerSkills, numberOfPlayers),
        }));
        setError(null);
    };

    const updateSeatPlayerType = (index: number, playerType: string) => {
        if (index === 0) return;
        hasUserEditedFormRef.current = true;
        setFormData((prev) => {
            const nextPlayerTypes = resizePlayerTypes(prev.playerTypes, prev.numberOfPlayers, humanPlayerType);
            nextPlayerTypes[index] = playerType;
            return { ...prev, playerTypes: nextPlayerTypes };
        });
        setError(null);
    };

    const updateSeatSkill = (index: number, skill: number) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => {
            const nextSkills = resizePlayerSkills(prev.playerSkills, prev.numberOfPlayers);
            nextSkills[index] = clampInteger(skill, 1, 10);
            return { ...prev, playerSkills: nextSkills };
        });
        setError(null);
    };

    const updatePackCode = (index: number, setCode: string) => {
        hasUserEditedFormRef.current = true;
        setFormData((prev) => {
            const setCodes = resizeSetCodes(prev.setCodes, packCount);
            setCodes[index] = normalizeSetCodeInput(setCode);
            return { ...prev, setCodes };
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
        }));
        setError(null);
    };

    const loadPreset = (slot: CreateTournamentLoadPresetSlot) => {
        const nextPresets = appConfigService.loadCreateTournamentPresets();
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

    const savePreset = (slot: Exclude<CreateTournamentPresetSlot, 'lastUsed'>) => {
        setPresets(appConfigService.saveCreateTournamentPreset(slot, createPresetFromFormData(formData)));
        setSavePresetSlot(slot);
        setPresetMessage(`Saved ${presetSlotLabel(slot)}`);
        setError(null);
    };

    const submitForm = async () => {
        const nextError = validateTournamentForm(formData, serverOptions, selectedTournamentType);
        if (nextError) {
            setError(nextError);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const options = createTournamentOptions(formData, serverOptions, serverUrl, selectedTournamentType);
            setPresets(appConfigService.saveCreateTournamentPreset('lastUsed', createPresetFromFormData(formData)));
            const table = await createTournament(options);
            if (table) {
                onTournamentCreated(table.tableId);
            }
        } catch (err) {
            console.error('Failed to create tournament:', err);
            setError(err instanceof Error ? err.message.replace(/^Error:\s*/, '') : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create Tournament"
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
                        Create Tournament
                    </Button>
                </>
            }
        >
            <form className="create-table-form create-tournament-form" onSubmit={(event) => {
                event.preventDefault();
                void submitForm();
            }}>
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

                <section className="preset-toolbar" aria-label="Create tournament presets">
                    <div className="preset-toolbar-group">
                        <label htmlFor="loadTournamentPresetSlot" className="input-label">
                            Load
                        </label>
                        <select
                            id="loadTournamentPresetSlot"
                            className="input preset-select"
                            value={loadPresetSlot}
                            onChange={(event) => setLoadPresetSlot(event.target.value as CreateTournamentLoadPresetSlot)}
                            data-testid="create-tournament-load-preset-select"
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
                            data-testid="create-tournament-load-preset-button"
                        >
                            Load
                        </Button>
                    </div>

                    <div className="preset-toolbar-group">
                        <label htmlFor="saveTournamentPresetSlot" className="input-label">
                            Save
                        </label>
                        <select
                            id="saveTournamentPresetSlot"
                            className="input preset-select"
                            value={savePresetSlot}
                            onChange={(event) => setSavePresetSlot(event.target.value as Exclude<CreateTournamentPresetSlot, 'lastUsed'>)}
                            data-testid="create-tournament-save-preset-select"
                        >
                            <option value="config1">Config 1</option>
                            <option value="config2">Config 2</option>
                        </select>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => savePreset(savePresetSlot)}
                            data-testid="create-tournament-save-preset-button"
                        >
                            Save
                        </Button>
                    </div>

                    {presetMessage && (
                        <span className="preset-message" role="status" data-testid="create-tournament-preset-message">
                            {presetMessage}
                        </span>
                    )}
                </section>

                <div className="input-group">
                    <label htmlFor="tournamentName" className="input-label">
                        Tournament Name
                    </label>
                    <input
                        id="tournamentName"
                        type="text"
                        className="input"
                        value={formData.name}
                        onChange={(event) => updateField('name', event.target.value)}
                        data-testid="create-tournament-name-input"
                    />
                </div>

                <section className="create-table-section" aria-label="Tournament structure">
                    <div className="create-table-section-header">
                        <h4>Structure</h4>
                    </div>
                    <div className="advanced-grid">
                        <div className="input-group">
                            <label htmlFor="tournamentType" className="input-label">
                                Tournament
                            </label>
                            <select
                                id="tournamentType"
                                className="input"
                                value={formData.tournamentType}
                                onChange={(event) => updateTournamentType(event.target.value)}
                                disabled={isLoadingOptions || serverOptions.tournamentTypes.length === 0}
                                data-testid="create-tournament-type-select"
                            >
                                {serverOptions.tournamentTypes.map((tournamentType) => (
                                    <option key={tournamentType.name} value={tournamentType.name}>
                                        {tournamentType.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentGameType" className="input-label">
                                Game Type
                            </label>
                            <select
                                id="tournamentGameType"
                                className="input"
                                value={isLimited ? 'Two Player Duel' : formData.gameType}
                                onChange={(event) => updateField('gameType', event.target.value)}
                                disabled={isLoadingOptions || isLimited}
                                data-testid="create-tournament-game-type-select"
                            >
                                {serverOptions.tournamentGameTypes.map((gameType) => (
                                    <option key={gameType.name} value={gameType.name}>
                                        {gameType.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentDeckType" className="input-label">
                                Deck Type
                            </label>
                            <select
                                id="tournamentDeckType"
                                className="input"
                                value={isLimited ? 'Limited' : formData.deckType}
                                onChange={(event) => updateField('deckType', event.target.value)}
                                disabled={isLoadingOptions || isLimited}
                                data-testid="create-tournament-deck-type-select"
                            >
                                {deckOptionsForTournament(serverOptions, isLimited).map((deckType) => (
                                    <option key={deckType} value={deckType}>
                                        {deckType}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentPlayers" className="input-label">
                                Players
                            </label>
                            <input
                                id="tournamentPlayers"
                                type="number"
                                className="input"
                                min={selectedTournamentType?.minPlayers ?? 1}
                                max={selectedTournamentType?.maxPlayers ?? 64}
                                value={formData.numberOfPlayers}
                                onChange={(event) => updatePlayerCount(Number(event.target.value))}
                                data-testid="create-tournament-player-count-input"
                            />
                        </div>
                    </div>

                    <div className="advanced-grid advanced-grid-compact">
                        <div className="input-group">
                            <label htmlFor="tournamentWins" className="input-label">
                                Wins
                            </label>
                            <input
                                id="tournamentWins"
                                type="number"
                                className="input"
                                min={1}
                                max={5}
                                value={formData.winsNeeded}
                                onChange={(event) => updateField('winsNeeded', clampInteger(Number(event.target.value), 1, 5))}
                                data-testid="create-tournament-wins-needed-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentRounds" className="input-label">
                                Rounds
                            </label>
                            <input
                                id="tournamentRounds"
                                type="number"
                                className="input"
                                min={1}
                                max={12}
                                value={formData.numberRounds}
                                disabled={isTournamentTypeElimination(selectedTournamentType)}
                                onChange={(event) => updateField('numberRounds', clampInteger(Number(event.target.value), 1, 12))}
                                data-testid="create-tournament-rounds-input"
                            />
                        </div>
                    </div>

                    <div className="checkbox-group checkbox-grid">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.singleMultiplayerGame}
                                onChange={(event) => updateField('singleMultiplayerGame', event.target.checked)}
                                data-testid="create-tournament-single-game-checkbox"
                            />
                            <span className="checkbox-text">Single multiplayer game</span>
                        </label>
                    </div>
                </section>

                <section className="create-table-section" aria-label="Tournament timing">
                    <div className="create-table-section-header">
                        <h4>Timing</h4>
                    </div>
                    <div className="advanced-grid">
                        <div className="input-group">
                            <label htmlFor="tournamentTimeLimit" className="input-label">
                                Time Limit
                            </label>
                            <select
                                id="tournamentTimeLimit"
                                className="input"
                                value={formData.timeLimit}
                                onChange={(event) => updateField('timeLimit', event.target.value)}
                                data-testid="create-tournament-time-limit-select"
                            >
                                {MATCH_TIME_LIMIT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentBufferTime" className="input-label">
                                Buffer
                            </label>
                            <select
                                id="tournamentBufferTime"
                                className="input"
                                value={formData.bufferTime}
                                onChange={(event) => updateField('bufferTime', event.target.value)}
                                data-testid="create-tournament-buffer-time-select"
                            >
                                {MATCH_BUFFER_TIME_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentConstructionTime" className="input-label">
                                Construction
                            </label>
                            <input
                                id="tournamentConstructionTime"
                                type="number"
                                className="input"
                                min={1}
                                max={120}
                                value={formData.constructionTimeMinutes}
                                disabled={!isLimited}
                                onChange={(event) => updateField('constructionTimeMinutes', clampInteger(Number(event.target.value), 1, 120))}
                                data-testid="create-tournament-construction-time-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentSkillLevel" className="input-label">
                                Skill
                            </label>
                            <select
                                id="tournamentSkillLevel"
                                className="input"
                                value={formData.skillLevel}
                                onChange={(event) => updateField('skillLevel', event.target.value as SkillLevel)}
                                data-testid="create-tournament-skill-level-select"
                            >
                                {SKILL_LEVEL_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {showLimitedSetup && (
                    <section className="create-table-section" aria-label="Limited setup">
                        <div className="create-table-section-header">
                            <h4>Limited Setup</h4>
                            <span className="custom-options-count" data-testid="create-tournament-limited-mode">
                                {limitedModeLabel(selectedTournamentType)}
                            </span>
                        </div>

                        {isDraft && (
                            <div className="input-group">
                                <label htmlFor="draftTiming" className="input-label">
                                    Draft Timing
                                </label>
                                <select
                                    id="draftTiming"
                                    className="input"
                                    value={formData.draftTiming}
                                    onChange={(event) => updateField('draftTiming', event.target.value as DraftTimingOption)}
                                    data-testid="create-tournament-draft-timing-select"
                                >
                                    {DRAFT_TIMING_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {showPackPicker && (
                            <div className="limited-pack-grid" data-testid="create-tournament-pack-picker">
                                {resizeSetCodes(formData.setCodes, packCount).map((setCode, index) => (
                                    <div className="input-group" key={index}>
                                        <label htmlFor={`packSet${index}`} className="input-label">
                                            Pack {index + 1}
                                        </label>
                                        <input
                                            id={`packSet${index}`}
                                            className="input"
                                            value={setCode}
                                            onChange={(event) => updatePackCode(index, event.target.value)}
                                            placeholder="M11"
                                            data-testid={`create-tournament-pack-${index + 1}-input`}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {isRandomPool && (
                            <div className="input-group">
                                <label htmlFor="randomDraftPool" className="input-label">
                                    Random Draft Pool
                                </label>
                                <textarea
                                    id="randomDraftPool"
                                    className="input create-tournament-textarea"
                                    value={formData.randomSetCodes.join('\n')}
                                    onChange={(event) => updateField('randomSetCodes', parseSetCodeText(event.target.value))}
                                    rows={5}
                                    placeholder="M11&#10;ZEN&#10;ROE"
                                    data-testid="create-tournament-random-pool-textarea"
                                />
                            </div>
                        )}

                        {isCube && (
                            <>
                                <div className="input-group">
                                    <label htmlFor="draftCube" className="input-label">
                                        Draft Cube
                                    </label>
                                    <select
                                        id="draftCube"
                                        className="input"
                                        value={formData.draftCubeName}
                                        onChange={(event) => updateField('draftCubeName', event.target.value)}
                                        data-testid="create-tournament-draft-cube-select"
                                    >
                                        <option value="">Select a cube</option>
                                        {[...serverOptions.draftCubes, CUBE_FROM_DECK_NAME].map((cubeName) => (
                                            <option key={cubeName} value={cubeName}>
                                                {cubeName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formData.draftCubeName === CUBE_FROM_DECK_NAME && (
                                    <DeckPicker
                                        selectedDeck={formData.cubeFromDeck}
                                        onDeckChange={(deck) => updateField('cubeFromDeck', deck)}
                                        isLoading={isLoading}
                                        error={null}
                                        onError={setError}
                                        label="Cube From Deck"
                                        showTextEditor
                                    />
                                )}
                            </>
                        )}

                        {isJumpstart && (
                            <div className="input-group">
                                <label htmlFor="jumpstartPacks" className="input-label">
                                    Jumpstart Packs
                                </label>
                                <textarea
                                    id="jumpstartPacks"
                                    className="input create-tournament-textarea"
                                    value={formData.jumpstartPacks}
                                    onChange={(event) => updateField('jumpstartPacks', event.target.value)}
                                    rows={7}
                                    placeholder="# Minions&#10;1 JMP 236 Ghoulcaller Gisa"
                                    data-testid="create-tournament-jumpstart-packs-textarea"
                                />
                            </div>
                        )}
                    </section>
                )}

                <section className="seat-editor" aria-label="Tournament players">
                    <div className="seat-editor-header">
                        <div>
                            <h4>Players</h4>
                            <p>
                                {selectedTournamentType?.minPlayers ?? 1}
                                {(selectedTournamentType?.minPlayers ?? 1) !== (selectedTournamentType?.maxPlayers ?? 64)
                                    ? `-${selectedTournamentType?.maxPlayers ?? 64}`
                                    : ''} seats
                            </p>
                        </div>
                        {formData.singleMultiplayerGame && (
                            <span className="seat-editor-summary">
                                {workablePlayers}/{MAX_SINGLE_GAME_WORKABLE_PLAYERS} single-game seats
                            </span>
                        )}
                        <div className="seat-editor-actions">
                            <Button type="button" variant="ghost" size="sm" onClick={() => fillOpenSeats(humanPlayerType)}>
                                Humans
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => fillOpenSeats(computerPlayerType)}>
                                AI
                            </Button>
                        </div>
                    </div>

                    <div className="seat-list">
                        {seatPlayerTypes.map((playerType, index) => (
                            <div className="seat-row tournament-seat-row" key={index}>
                                <span className="seat-number">Seat {index + 1}</span>
                                <select
                                    className="input"
                                    value={playerType}
                                    onChange={(event) => updateSeatPlayerType(index, event.target.value)}
                                    disabled={index === 0}
                                    aria-label={`Seat ${index + 1} player type`}
                                    data-testid={`create-tournament-seat-${index + 1}-player-type`}
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
                                <input
                                    type="number"
                                    className="input"
                                    min={1}
                                    max={10}
                                    value={resizePlayerSkills(formData.playerSkills, formData.numberOfPlayers)[index]}
                                    onChange={(event) => updateSeatSkill(index, Number(event.target.value))}
                                    aria-label={`Seat ${index + 1} player skill`}
                                    data-testid={`create-tournament-seat-${index + 1}-skill`}
                                />
                            </div>
                        ))}
                    </div>
                </section>

                <section className="create-table-section" aria-label="Tournament access and requirements">
                    <div className="create-table-section-header">
                        <h4>Access and Requirements</h4>
                    </div>

                    <div className="advanced-grid">
                        <div className="input-group">
                            <label htmlFor="tournamentPassword" className="input-label">
                                Password
                            </label>
                            <input
                                id="tournamentPassword"
                                type="password"
                                className="input"
                                value={formData.password}
                                onChange={(event) => updateField('password', event.target.value)}
                                placeholder="Public tournament"
                                data-testid="create-tournament-password-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentQuitRatio" className="input-label">
                                Max Quit %
                            </label>
                            <input
                                id="tournamentQuitRatio"
                                type="number"
                                className="input"
                                min={0}
                                max={100}
                                step={5}
                                value={formData.quitRatio}
                                onChange={(event) => updateField('quitRatio', clampInteger(Number(event.target.value), 0, 100))}
                                data-testid="create-tournament-quit-ratio-input"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="tournamentMinimumRating" className="input-label">
                                Min Rating
                            </label>
                            <input
                                id="tournamentMinimumRating"
                                type="number"
                                className="input"
                                min={0}
                                max={3000}
                                step={10}
                                value={formData.minimumRating}
                                onChange={(event) => updateField('minimumRating', clampInteger(Number(event.target.value), 0, 3000))}
                                data-testid="create-tournament-minimum-rating-input"
                            />
                        </div>
                    </div>

                    <div className="checkbox-group checkbox-grid">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.spectatorsAllowed}
                                onChange={(event) => updateField('spectatorsAllowed', event.target.checked)}
                                data-testid="create-tournament-spectators-checkbox"
                            />
                            <span className="checkbox-text">Spectators</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.rollbackTurnsAllowed}
                                onChange={(event) => updateField('rollbackTurnsAllowed', event.target.checked)}
                                data-testid="create-tournament-rollback-checkbox"
                            />
                            <span className="checkbox-text">Rollbacks</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.rated}
                                onChange={(event) => updateField('rated', event.target.checked)}
                                data-testid="create-tournament-rated-checkbox"
                            />
                            <span className="checkbox-text">Rated tournament</span>
                        </label>
                    </div>
                </section>
            </form>
        </Modal>
    );
};

export default CreateTournamentDialog;

function createInitialFormData(options: LobbyServerOptions): CreateTournamentFormData {
    const tournamentType = getDefaultTournamentTypeName(options);
    const selectedTournamentType = findTournamentType(options, tournamentType);
    const isLimited = isTournamentTypeLimited(selectedTournamentType);
    const gameType = isLimited ? 'Two Player Duel' : getDefaultTournamentGameTypeName(options);
    const deckType = isLimited ? 'Limited' : getDefaultDeckType(options);
    const numberOfPlayers = clampTournamentPlayerCount(selectedTournamentType, selectedTournamentType?.minPlayers ?? 2);
    const humanPlayerType = getHumanPlayerType(options);
    const packCount = Math.max(1, selectedTournamentType?.numBoosters ?? (isTournamentTypeDraft(selectedTournamentType) ? 3 : 6));

    return {
        name: 'Tournament',
        tournamentType,
        gameType,
        deckType,
        winsNeeded: 2,
        numberRounds: 3,
        numberOfPlayers,
        singleMultiplayerGame: false,
        timeLimit: 'MIN__25',
        bufferTime: 'NONE',
        constructionTimeMinutes: 10,
        draftTiming: 'REGULAR',
        draftCubeName: '',
        setCodes: resizeSetCodes([], packCount),
        randomSetCodes: [],
        cubeFromDeck: null,
        jumpstartPacks: '',
        password: '',
        skillLevel: SkillLevel.CASUAL,
        spectatorsAllowed: true,
        rollbackTurnsAllowed: true,
        rated: false,
        quitRatio: 100,
        minimumRating: 0,
        playerTypes: resizePlayerTypes([], numberOfPlayers, humanPlayerType),
        playerSkills: resizePlayerSkills([], numberOfPlayers),
    };
}

function reconcileFormWithOptions(
    formData: CreateTournamentFormData,
    options: LobbyServerOptions,
): CreateTournamentFormData {
    const tournamentType = options.tournamentTypes.some(option => option.name === formData.tournamentType)
        ? formData.tournamentType
        : getDefaultTournamentTypeName(options);
    const selectedTournamentType = findTournamentType(options, tournamentType);
    const isLimited = isTournamentTypeLimited(selectedTournamentType);
    const numberOfPlayers = clampTournamentPlayerCount(selectedTournamentType, formData.numberOfPlayers);
    const humanPlayerType = getHumanPlayerType(options);
    const packCount = Math.max(1, selectedTournamentType?.numBoosters ?? (isTournamentTypeDraft(selectedTournamentType) ? 3 : 6));

    return {
        ...formData,
        tournamentType,
        gameType: isLimited ? 'Two Player Duel' : ensureTournamentGameType(options, formData.gameType),
        deckType: isLimited ? 'Limited' : ensureDeckType(options, formData.deckType),
        numberOfPlayers,
        playerTypes: reconcilePlayerTypesWithOptions(formData.playerTypes, numberOfPlayers, humanPlayerType, options),
        playerSkills: resizePlayerSkills(formData.playerSkills, numberOfPlayers),
        setCodes: resizeSetCodes(formData.setCodes, packCount),
        draftCubeName: reconcileDraftCubeName(formData.draftCubeName, options),
    };
}

function createPresetFromFormData(formData: CreateTournamentFormData): Omit<CreateTournamentPresetConfig, 'savedAt'> {
    return {
        name: formData.name,
        tournamentType: formData.tournamentType,
        gameType: formData.gameType,
        deckType: formData.deckType,
        winsNeeded: formData.winsNeeded,
        numberRounds: formData.numberRounds,
        numberOfPlayers: formData.numberOfPlayers,
        singleMultiplayerGame: formData.singleMultiplayerGame,
        timeLimit: formData.timeLimit,
        bufferTime: formData.bufferTime,
        constructionTimeMinutes: formData.constructionTimeMinutes,
        draftTiming: formData.draftTiming,
        draftCubeName: formData.draftCubeName,
        setCodes: [...formData.setCodes],
        randomSetCodes: [...formData.randomSetCodes],
        cubeFromDeck: cloneDeck(formData.cubeFromDeck),
        jumpstartPacks: formData.jumpstartPacks,
        password: formData.password,
        skillLevel: formData.skillLevel,
        spectatorsAllowed: formData.spectatorsAllowed,
        rollbackTurnsAllowed: formData.rollbackTurnsAllowed,
        rated: formData.rated,
        quitRatio: formData.quitRatio,
        minimumRating: formData.minimumRating,
        playerTypes: [...formData.playerTypes],
        playerSkills: [...formData.playerSkills],
    };
}

function createFormDataFromPreset(preset: CreateTournamentPresetConfig): CreateTournamentFormData {
    return {
        name: preset.name,
        tournamentType: preset.tournamentType,
        gameType: preset.gameType,
        deckType: preset.deckType,
        winsNeeded: preset.winsNeeded,
        numberRounds: preset.numberRounds,
        numberOfPlayers: preset.numberOfPlayers,
        singleMultiplayerGame: preset.singleMultiplayerGame,
        timeLimit: preset.timeLimit,
        bufferTime: preset.bufferTime,
        constructionTimeMinutes: preset.constructionTimeMinutes,
        draftTiming: preset.draftTiming as DraftTimingOption,
        draftCubeName: preset.draftCubeName,
        setCodes: [...preset.setCodes],
        randomSetCodes: [...preset.randomSetCodes],
        cubeFromDeck: cloneDeck(preset.cubeFromDeck),
        jumpstartPacks: preset.jumpstartPacks,
        password: preset.password,
        skillLevel: preset.skillLevel as SkillLevel,
        spectatorsAllowed: preset.spectatorsAllowed,
        rollbackTurnsAllowed: preset.rollbackTurnsAllowed,
        rated: preset.rated,
        quitRatio: preset.quitRatio,
        minimumRating: preset.minimumRating,
        playerTypes: [...preset.playerTypes],
        playerSkills: [...preset.playerSkills],
    };
}

function createTournamentOptions(
    formData: CreateTournamentFormData,
    options: LobbyServerOptions,
    serverUrl: string,
    selectedTournamentType = findTournamentType(options, formData.tournamentType),
): TournamentOptions {
    const isLimited = isTournamentTypeLimited(selectedTournamentType);
    const isDraft = isTournamentTypeDraft(selectedTournamentType);
    const isCube = isTournamentTypeCubeBooster(selectedTournamentType);
    const isRandom = isTournamentTypeRandom(selectedTournamentType);
    const isReshuffled = isTournamentTypeReshuffled(selectedTournamentType);
    const isRichMan = isTournamentTypeRichMan(selectedTournamentType);
    const isJumpstart = isTournamentTypeJumpstart(selectedTournamentType);
    const gameType = isLimited ? 'Two Player Duel' : formData.gameType;
    const deckType = isLimited ? 'Limited' : formData.deckType;
    const playerTypes = resizePlayerTypes(formData.playerTypes, formData.numberOfPlayers, getHumanPlayerType(options));
    const bannedUsers = appConfigService.loadIgnoredUsers(serverUrl);

    return {
        name: formData.name.trim() || 'Tournament',
        tournamentType: formData.tournamentType,
        playerTypes,
        playerSkills: resizePlayerSkills(formData.playerSkills, formData.numberOfPlayers),
        watchingAllowed: formData.spectatorsAllowed,
        planeChase: false,
        numberRounds: isTournamentTypeElimination(selectedTournamentType) ? undefined : formData.numberRounds,
        password: formData.password,
        quitRatio: formData.quitRatio,
        minimumRating: formData.minimumRating,
        singleMultiplayerGame: formData.singleMultiplayerGame,
        matchOptions: {
            name: '',
            gameType,
            deckType,
            winsNeeded: formData.winsNeeded,
            freeMulligans: 0,
            matchTimeLimit: formData.timeLimit,
            matchBufferTime: formData.bufferTime,
            attackOption: 'MULTIPLE',
            range: 'ALL',
            password: formData.password,
            skillLevel: formData.skillLevel,
            limited: isLimited || isLimitedDeckType(deckType),
            rated: formData.rated,
            rollbackTurnsAllowed: formData.rollbackTurnsAllowed,
            spectatorsAllowed: formData.spectatorsAllowed,
            playerTypes,
            quitRatio: formData.quitRatio,
            minimumRating: formData.minimumRating,
            bannedUsers: bannedUsers.length > 0 ? bannedUsers : undefined,
        },
        limitedOptions: isLimited
            ? {
                sets: limitedSetCodes(formData, selectedTournamentType),
                constructionTime: formData.constructionTimeMinutes * 60,
                draftCubeName: isCube ? formData.draftCubeName : undefined,
                cubeFromDeck: isCube && formData.draftCubeName === CUBE_FROM_DECK_NAME ? cloneDeck(formData.cubeFromDeck) : undefined,
                jumpstartPacks: isJumpstart ? formData.jumpstartPacks : undefined,
                numberBoosters: selectedTournamentType?.numBoosters ?? (isDraft ? 3 : 6),
                isRandom,
                isReshuffled,
                isRichMan,
                isJumpstart,
                timing: isDraft ? formData.draftTiming : undefined,
            }
            : undefined,
    };
}

function validateTournamentForm(
    formData: CreateTournamentFormData,
    options: LobbyServerOptions,
    selectedTournamentType = findTournamentType(options, formData.tournamentType),
): string | null {
    if (options.tournamentTypes.length === 0 || !selectedTournamentType) {
        return 'Tournament creation needs server-provided tournament types.';
    }

    const isLimited = isTournamentTypeLimited(selectedTournamentType);
    const isDraft = isTournamentTypeDraft(selectedTournamentType);
    const isCube = isTournamentTypeCubeBooster(selectedTournamentType);
    const isRandomPool = isTournamentTypeRandom(selectedTournamentType)
        || isTournamentTypeRichMan(selectedTournamentType)
        || isTournamentTypeReshuffled(selectedTournamentType);
    const isJumpstart = isTournamentTypeJumpstart(selectedTournamentType);

    if (!isLimited) {
        const gameDeckError = validateDeckGameTypePair(formData.gameType, formData.deckType);
        if (gameDeckError) return gameDeckError;
    }

    if (isLimited) {
        if (isDraft && formData.draftTiming === 'NONE') {
            return 'Select a draft timing option.';
        }

        if (isCube) {
            if (!formData.draftCubeName) return 'Select a draft cube.';
            if (formData.draftCubeName === CUBE_FROM_DECK_NAME) {
                const cubeCards = (formData.cubeFromDeck?.cards.length ?? 0) + (formData.cubeFromDeck?.sideboard.length ?? 0);
                if (cubeCards === 0) return 'Import a non-empty Cube From Deck list.';
            }
        } else if (isRandomPool) {
            if (formData.randomSetCodes.length === 0) return 'Select at least one set for the random draft pool.';
        } else if (!isJumpstart) {
            const packCount = Math.max(1, selectedTournamentType.numBoosters ?? (isDraft ? 3 : 6));
            const setCodes = resizeSetCodes(formData.setCodes, packCount);
            if (setCodes.some(setCode => !setCode)) return 'Fill every sealed or draft pack slot with a set code.';
        }

        if (isJumpstart && selectedTournamentType.name.toLowerCase().includes('custom') && !formData.jumpstartPacks.trim()) {
            return 'Import Jumpstart packs for custom Jumpstart tournaments.';
        }
    }

    const playerTypes = resizePlayerTypes(formData.playerTypes, formData.numberOfPlayers, getHumanPlayerType(options));
    if (formData.singleMultiplayerGame) {
        const workablePlayers = playerTypes.filter(playerType => isWorkablePlayerType(playerType, options)).length;
        if (workablePlayers > MAX_SINGLE_GAME_WORKABLE_PLAYERS) {
            return `Single-game tournaments support ${MAX_SINGLE_GAME_WORKABLE_PLAYERS} human or AI players.`;
        }
    }

    return null;
}

function getDefaultTournamentGameTypeName(options: LobbyServerOptions): string {
    return options.tournamentGameTypes.find(gameType => gameType.name === 'Two Player Duel')?.name
        ?? options.tournamentGameTypes[0]?.name
        ?? 'Two Player Duel';
}

function findTournamentGameType(options: LobbyServerOptions, gameTypeName: string): GameTypeView {
    return options.tournamentGameTypes.find(gameType => gameType.name === gameTypeName)
        ?? options.tournamentGameTypes[0]
        ?? {
            name: 'Two Player Duel',
            minPlayers: 2,
            maxPlayers: 2,
            numTeams: 0,
            playersPerTeam: 0,
            useRange: false,
            useAttackOption: false,
        };
}

function ensureTournamentGameType(options: LobbyServerOptions, gameTypeName: string): string {
    return options.tournamentGameTypes.some(gameType => gameType.name === gameTypeName)
        ? gameTypeName
        : getDefaultTournamentGameTypeName(options);
}

function ensureDeckType(options: LobbyServerOptions, deckType: string): string {
    return options.deckTypes.includes(deckType) ? deckType : getDefaultDeckType(options);
}

function deckOptionsForTournament(options: LobbyServerOptions, isLimited: boolean): string[] {
    if (!isLimited) return options.deckTypes;
    return options.deckTypes.includes('Limited') ? options.deckTypes.filter(deckType => deckType === 'Limited') : ['Limited'];
}

function clampTournamentPlayerCount(tournamentType: ReturnType<typeof findTournamentType>, requestedCount: number): number {
    const minPlayers = Math.max(1, tournamentType?.minPlayers ?? 2);
    const maxPlayers = Math.max(minPlayers, tournamentType?.maxPlayers ?? minPlayers);
    if (!Number.isFinite(requestedCount)) return minPlayers;
    return Math.min(maxPlayers, Math.max(minPlayers, Math.round(requestedCount)));
}

function resizePlayerSkills(playerSkills: number[], count: number): number[] {
    const next = playerSkills.slice(0, count).map(skill => clampInteger(skill, 1, 10));
    while (next.length < count) next.push(2);
    return next;
}

function resizeSetCodes(setCodes: string[], count: number): string[] {
    const next = setCodes.slice(0, count).map(normalizeSetCodeInput);
    while (next.length < count) next.push('');
    return next;
}

function normalizeSetCodeInput(value: string): string {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function parseSetCodeText(value: string): string[] {
    return [...new Set(
        value
            .split(/[\s,;]+/g)
            .map(normalizeSetCodeInput)
            .filter(Boolean)
    )];
}

function limitedSetCodes(
    formData: CreateTournamentFormData,
    tournamentType: ReturnType<typeof findTournamentType>,
): string[] {
    if (isTournamentTypeCubeBooster(tournamentType) || isTournamentTypeJumpstart(tournamentType)) return [];
    if (
        isTournamentTypeRandom(tournamentType)
        || isTournamentTypeRichMan(tournamentType)
        || isTournamentTypeReshuffled(tournamentType)
    ) {
        return [...formData.randomSetCodes];
    }
    return resizeSetCodes(formData.setCodes, Math.max(1, tournamentType?.numBoosters ?? (isTournamentTypeDraft(tournamentType) ? 3 : 6)))
        .filter(Boolean);
}

function reconcileDraftCubeName(draftCubeName: string, options: LobbyServerOptions): string {
    if (!draftCubeName) return '';
    if (draftCubeName === CUBE_FROM_DECK_NAME) return draftCubeName;
    return options.draftCubes.includes(draftCubeName) ? draftCubeName : '';
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

function isWorkablePlayerType(playerType: string, options: LobbyServerOptions): boolean {
    const option = options.playerTypes.find(type => type.value === playerType);
    if (option) return option.isWorkablePlayer;
    return !playerType.toLowerCase().includes('draftbot');
}

function limitedModeLabel(tournamentType: ReturnType<typeof findTournamentType>): string {
    if (isTournamentTypeCubeBooster(tournamentType)) return 'Cube';
    if (isTournamentTypeJumpstart(tournamentType)) return 'Jumpstart';
    if (isTournamentTypeRandom(tournamentType)) return 'Random';
    if (isTournamentTypeRichMan(tournamentType)) return 'Rich';
    if (isTournamentTypeReshuffled(tournamentType)) return 'Reshuffled';
    if (isTournamentTypeDraft(tournamentType)) return 'Draft';
    return 'Sealed';
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

function clampInteger(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
}

function presetSlotLabel(slot: CreateTournamentLoadPresetSlot): string {
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
