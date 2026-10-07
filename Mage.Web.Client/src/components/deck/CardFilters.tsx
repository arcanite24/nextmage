/**
 * Card Filters Component
 * 
 * Filter bar for card search with color toggles, type dropdown,
 * mana value, rarity, and sorting options.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useDeckStore, DeckFilterColors } from '../../stores/deckStore';
import { resolvePennyDreadfulSearchFormat } from '../../services/DeckSearchFilterService';
import { WebSocketBridgeService } from '../../services/WebSocketBridgeService';
import { wsService } from '../../services/WebSocketService';
import { ManaSymbol } from '../common/ManaSymbols';
import type { ExpansionSetInfo } from '../../types';
import './CardFilters.css';

const CARD_TYPES = [
    { value: 'CREATURE', label: 'Creature' },
    { value: 'INSTANT', label: 'Instant' },
    { value: 'SORCERY', label: 'Sorcery' },
    { value: 'ENCHANTMENT', label: 'Enchantment' },
    { value: 'ARTIFACT', label: 'Artifact' },
    { value: 'PLANESWALKER', label: 'Walker' },
    { value: 'LAND', label: 'Land' },
];

const RARITIES = [
    { value: 'LAND', label: 'Land' },
    { value: 'COMMON', label: 'Common' },
    { value: 'UNCOMMON', label: 'Uncommon' },
    { value: 'RARE', label: 'Rare' },
    { value: 'MYTHIC', label: 'Mythic' },
];

const DEFAULT_FILTER_COLORS: DeckFilterColors = {
    white: false,
    blue: false,
    black: false,
    red: false,
    green: false,
    colorless: false,
};

const COLOR_LABELS: Record<keyof DeckFilterColors, string> = {
    white: 'White',
    blue: 'Blue',
    black: 'Black',
    red: 'Red',
    green: 'Green',
    colorless: 'Colorless',
};

const MANA_OPERATOR_LABELS: Record<string, string> = {
    eq: '=',
    lte: '<=',
    gte: '>=',
};

interface CardFiltersProps {
    onSearch: () => void;
}

export const CardFilters: React.FC<CardFiltersProps> = ({ onSearch }) => {
    const [deckTypeOptions, setDeckTypeOptions] = useState<string[]>([]);
    const [setOptions, setSetOptions] = useState<ExpansionSetInfo[]>([]);
    const [pendingSetCode, setPendingSetCode] = useState('');
    const [pendingFormat, setPendingFormat] = useState('');
    const {
        currentDeck,
        filters,
        setFilters,
        resetFilters,
        isSearching,
        editorMode,
        editorConfig,
        updateEditorModeConfig,
    } = useDeckStore();
    const modeConfig = editorConfig.modes[editorMode];
    const currentDeckFormat = currentDeck?.format;
    const formatOptions = useMemo(() => {
        const options = new Set(deckTypeOptions);
        if (currentDeckFormat) options.add(currentDeckFormat);
        if (filters.format) options.add(filters.format);
        return Array.from(options)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    }, [currentDeckFormat, deckTypeOptions, filters.format]);
    const setCodeOptions = useMemo(() => {
        const byCode = new Map<string, ExpansionSetInfo>();
        for (const setInfo of setOptions) {
            if (!setInfo.setCode) continue;
            byCode.set(setInfo.setCode.toUpperCase(), {
                ...setInfo,
                setCode: setInfo.setCode.toUpperCase(),
            });
        }
        for (const setCode of filters.setCodes) {
            const normalized = setCode.toUpperCase();
            if (!byCode.has(normalized)) {
                byCode.set(normalized, {
                    setCode: normalized,
                    name: normalized,
                    blockName: null,
                    releaseDate: 0,
                    hasBasicLands: false,
                });
            }
        }
        return Array.from(byCode.values()).sort((a, b) => (
            b.releaseDate - a.releaseDate || a.setCode.localeCompare(b.setCode)
        ));
    }, [filters.setCodes, setOptions]);

    useEffect(() => {
        let cancelled = false;
        const bridge = new WebSocketBridgeService(wsService.send.bind(wsService));
        Promise.allSettled([
            bridge.getDeckTypes(),
            bridge.getExpansionSets(),
        ]).then(([deckTypesResult, expansionSetsResult]) => {
            if (cancelled) return;
            setDeckTypeOptions(deckTypesResult.status === 'fulfilled' ? deckTypesResult.value.filter(Boolean) : []);
            setSetOptions(expansionSetsResult.status === 'fulfilled' ? expansionSetsResult.value.filter(setInfo => Boolean(setInfo.setCode)) : []);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!filters.pennyDreadful) return;
        const resolvedFormat = resolvePennyDreadfulSearchFormat(deckTypeOptions);
        if (filters.format !== resolvedFormat) {
            setFilters({ format: resolvedFormat });
        }
    }, [deckTypeOptions, filters.format, filters.pennyDreadful, setFilters]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters({ searchText: e.target.value, nameContains: e.target.value });
    };

    const handleColorToggle = (event: React.MouseEvent, color: keyof DeckFilterColors) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            const selectOnlyClicked = event.altKey;
            const nextColors = colorButtons.reduce((colors, colorButton) => ({
                ...colors,
                [colorButton.color]: selectOnlyClicked
                    ? colorButton.color === color
                    : colorButton.color !== color,
            }), {} as DeckFilterColors);
            setFilters({
                colors: nextColors,
                excludedColors: { ...DEFAULT_FILTER_COLORS },
            });
            return;
        }

        setFilters({
            colors: {
                ...filters.colors,
                [color]: !filters.colors[color],
            },
            excludedColors: {
                ...filters.excludedColors,
                [color]: false,
            },
        });
    };

    const toggleListFilter = (
        event: React.MouseEvent,
        value: string,
        includeKey: 'types' | 'rarities',
        excludeKey: 'excludedTypes' | 'excludedRarities',
    ) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            const values = includeKey === 'types'
                ? CARD_TYPES.map(type => type.value)
                : RARITIES.map(rarity => rarity.value);
            setFilters({
                [includeKey]: event.altKey
                    ? [value]
                    : values.filter(item => item !== value),
                [excludeKey]: [],
            });
            return;
        }

        setFilters({
            [includeKey]: filters[includeKey].includes(value)
                ? filters[includeKey].filter(item => item !== value)
                : [...filters[includeKey], value],
            [excludeKey]: filters[excludeKey].filter(item => item !== value),
        });
    };

    const handleSetCodesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters({
            setCodes: e.target.value
                .split(/[\s,;]+/)
                .map(value => value.trim().toUpperCase())
                .filter(Boolean),
        });
    };

    const addSetCode = (setCode: string) => {
        const normalized = setCode.trim().toUpperCase();
        if (!normalized || filters.setCodes.includes(normalized)) return;
        setFilters({ setCodes: [...filters.setCodes, normalized] });
    };

    const removeSetCode = (setCode: string) => {
        setFilters({ setCodes: filters.setCodes.filter(value => value !== setCode) });
    };

    const handleSetPickerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const setCode = e.currentTarget.value;
        addSetCode(setCode);
        setPendingSetCode('');
    };

    const handleFormatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters({ format: e.target.value });
    };

    const handleFormatPickerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const format = e.currentTarget.value;
        setPendingFormat(format);
        if (format) setFilters({ format });
    };

    const handlePennyDreadfulChange = (checked: boolean) => {
        setFilters({
            pennyDreadful: checked,
            ...(checked ? { format: resolvePennyDreadfulSearchFormat(deckTypeOptions) } : {}),
        });
    };

    const handleManaValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFilters({ manaValue: value === '' ? null : parseInt(value, 10) });
    };

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sortBy = e.target.value as typeof filters.sortBy;
        updateEditorModeConfig({ collectionSortBy: sortBy });
        setFilters({ sortBy });
    };

    const handleSortDirectionToggle = () => {
        const sortDirection = filters.sortDirection === 'asc' ? 'desc' : 'asc';
        updateEditorModeConfig({ collectionSortDirection: sortDirection });
        setFilters({ sortDirection });
    };

    const handleCollectionViewChange = (collectionView: typeof modeConfig.collectionView) => {
        updateEditorModeConfig({ collectionView });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSearch();
        }
    };

    const handleReset = () => {
        resetFilters();
    };

    const colorButtons: { color: keyof DeckFilterColors; symbol: string }[] = [
        { color: 'white', symbol: 'W' },
        { color: 'blue', symbol: 'U' },
        { color: 'black', symbol: 'B' },
        { color: 'red', symbol: 'R' },
        { color: 'green', symbol: 'G' },
        { color: 'colorless', symbol: 'C' },
    ];
    const typeLabels = new Map(CARD_TYPES.map(type => [type.value, type.label]));
    const rarityLabels = new Map(RARITIES.map(rarity => [rarity.value, rarity.label]));
    const selectedColors = colorButtons.filter(({ color }) => filters.colors[color]);
    const excludedColors = colorButtons.filter(({ color }) => filters.excludedColors[color]);
    const activeFilterCount = [
        filters.searchText.trim() ? 1 : 0,
        selectedColors.length,
        excludedColors.length,
        filters.types.length,
        filters.excludedTypes.length,
        filters.rarities.length,
        filters.excludedRarities.length,
        filters.setCodes.length,
        filters.format && !filters.useDeckFormat && !filters.pennyDreadful ? 1 : 0,
        filters.useDeckFormat ? 1 : 0,
        filters.pennyDreadful ? 1 : 0,
        filters.manaValue !== null ? 1 : 0,
        filters.uniqueNames ? 1 : 0,
        filters.piles ? 1 : 0,
    ].reduce((sum, count) => sum + count, 0);
    const removeColorFilter = (color: keyof DeckFilterColors) => {
        setFilters({
            colors: { ...filters.colors, [color]: false },
        });
    };
    const removeExcludedColorFilter = (color: keyof DeckFilterColors) => {
        setFilters({
            excludedColors: { ...filters.excludedColors, [color]: false },
        });
    };

    return (
        <div className="card-filters">
            <div className="filter-row filter-row-main">
                <div className="filter-group filter-search">
                    <input
                        type="text"
                        placeholder="Search cards..."
                        value={filters.searchText}
                        onChange={handleNameChange}
                        onKeyDown={handleKeyDown}
                        className="filter-input"
                        data-testid="deck-editor-card-name-filter"
                        title="Search cards by any data like name or mana symbols like {W}, {U}, {C}, etc (use quotes for exact search)"
                    />
                </div>

                <div className="filter-group filter-colors">
                    {colorButtons.map(({ color, symbol }) => (
                        <button
                            key={color}
                            type="button"
                            className={`color-toggle ${filters.colors[color] ? 'active' : ''} ${filters.excludedColors[color] ? 'excluded' : ''}`}
                            onClick={(event) => handleColorToggle(event, color)}
                            title={`${color.charAt(0).toUpperCase() + color.slice(1)}. Alt-click only this; Ctrl-click all other colors.`}
                            aria-label={`Filter ${color}`}
                            data-testid={`deck-editor-color-filter-${color}`}
                        >
                            <ManaSymbol symbol={symbol} size="sm" />
                        </button>
                    ))}
                </div>

                <div className="filter-group">
                    <select
                        value={filters.colorMatch}
                        onChange={(event) => setFilters({ colorMatch: event.currentTarget.value as typeof filters.colorMatch })}
                        className="filter-select"
                        aria-label="Color match mode"
                    >
                        <option value="any">Any color</option>
                        <option value="include">Include colors</option>
                        <option value="exact">Exact colors</option>
                    </select>
                </div>

                <div className="filter-group filter-mana-value">
                    <select
                        value={filters.manaValueOperator}
                        onChange={(event) => setFilters({ manaValueOperator: event.currentTarget.value as typeof filters.manaValueOperator })}
                        className="filter-select filter-select-operator"
                        aria-label="Mana value operator"
                        data-testid="deck-editor-mana-value-operator"
                    >
                        <option value="eq">=</option>
                        <option value="lte">&lt;=</option>
                        <option value="gte">&gt;=</option>
                    </select>
                    <input
                        type="number"
                        placeholder="MV"
                        min={0}
                        max={20}
                        value={filters.manaValue ?? ''}
                        onChange={handleManaValueChange}
                        onKeyDown={handleKeyDown}
                        className="filter-input filter-input-small"
                        data-testid="deck-editor-mana-value-filter"
                    />
                </div>

                <div className="filter-group">
                    <select
                        value={filters.sortBy}
                        onChange={handleSortChange}
                        className="filter-select"
                        data-testid="deck-editor-collection-sort-select"
                    >
                        <option value="name">Sort: Name</option>
                        <option value="cardType">Sort: Card Type</option>
                        <option value="manaValue">Sort: Mana Value</option>
                        <option value="color">Sort: Color</option>
                        <option value="rarity">Sort: Rarity</option>
                        <option value="cardNumber">Sort: Set/No.</option>
                    </select>
                </div>

                <div className="filter-group filter-view-controls" aria-label="Collection layout">
                    <button
                        type="button"
                        className={`filter-icon-button ${modeConfig.collectionView === 'grid' ? 'active' : ''}`}
                        onClick={() => handleCollectionViewChange('grid')}
                        title="Grid view"
                        aria-label="Grid view"
                        data-testid="deck-editor-collection-grid-button"
                    >
                        Grid
                    </button>
                    <button
                        type="button"
                        className={`filter-icon-button ${modeConfig.collectionView === 'list' ? 'active' : ''}`}
                        onClick={() => handleCollectionViewChange('list')}
                        title="List view"
                        aria-label="List view"
                        data-testid="deck-editor-collection-list-button"
                    >
                        List
                    </button>
                    <button
                        type="button"
                        className="filter-icon-button"
                        onClick={handleSortDirectionToggle}
                        title={filters.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                        aria-label={filters.sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
                        data-testid="deck-editor-collection-sort-direction-button"
                    >
                        {filters.sortDirection === 'asc' ? 'A-Z' : 'Z-A'}
                    </button>
                </div>

                <div className="filter-actions">
                    <button
                        className="btn btn-primary btn-search"
                        onClick={onSearch}
                        disabled={isSearching}
                        aria-label={isSearching ? 'Searching cards' : 'Search cards'}
                    >
                        {isSearching ? 'Searching...' : 'Search'}
                    </button>
                    <button
                        className="btn btn-secondary btn-reset"
                        onClick={handleReset}
                    >
                        Reset
                    </button>
                </div>
            </div>

            {activeFilterCount > 0 && (
                <div className="filter-row filter-row-active" data-testid="deck-editor-active-filters">
                    <span className="filter-active-count" data-testid="deck-editor-active-filter-count">
                        {activeFilterCount} active
                    </span>
                    {filters.searchText.trim() && (
                        <button
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ searchText: '', nameContains: '' })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label="Clear text search filter"
                        >
                            Text: {filters.searchText}
                        </button>
                    )}
                    {selectedColors.map(({ color, symbol }) => (
                        <button
                            key={`color-${color}`}
                            type="button"
                            className="filter-active-token"
                            onClick={() => removeColorFilter(color)}
                            data-testid="deck-editor-active-filter-token"
                            aria-label={`Clear ${COLOR_LABELS[color]} color filter`}
                        >
                            Color: {symbol}
                        </button>
                    ))}
                    {excludedColors.map(({ color, symbol }) => (
                        <button
                            key={`exclude-color-${color}`}
                            type="button"
                            className="filter-active-token filter-active-token-excluded"
                            onClick={() => removeExcludedColorFilter(color)}
                            data-testid="deck-editor-active-filter-token"
                            aria-label={`Clear excluded ${COLOR_LABELS[color]} color filter`}
                        >
                            Not: {symbol}
                        </button>
                    ))}
                    {filters.types.map(type => (
                        <button
                            key={`type-${type}`}
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ types: filters.types.filter(value => value !== type) })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label={`Clear ${typeLabels.get(type) ?? type} type filter`}
                        >
                            Type: {typeLabels.get(type) ?? type}
                        </button>
                    ))}
                    {filters.excludedTypes.map(type => (
                        <button
                            key={`exclude-type-${type}`}
                            type="button"
                            className="filter-active-token filter-active-token-excluded"
                            onClick={() => setFilters({ excludedTypes: filters.excludedTypes.filter(value => value !== type) })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label={`Clear excluded ${typeLabels.get(type) ?? type} type filter`}
                        >
                            Not type: {typeLabels.get(type) ?? type}
                        </button>
                    ))}
                    {filters.rarities.map(rarity => (
                        <button
                            key={`rarity-${rarity}`}
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ rarities: filters.rarities.filter(value => value !== rarity) })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label={`Clear ${rarityLabels.get(rarity) ?? rarity} rarity filter`}
                        >
                            Rarity: {rarityLabels.get(rarity) ?? rarity}
                        </button>
                    ))}
                    {filters.excludedRarities.map(rarity => (
                        <button
                            key={`exclude-rarity-${rarity}`}
                            type="button"
                            className="filter-active-token filter-active-token-excluded"
                            onClick={() => setFilters({ excludedRarities: filters.excludedRarities.filter(value => value !== rarity) })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label={`Clear excluded ${rarityLabels.get(rarity) ?? rarity} rarity filter`}
                        >
                            Not rarity: {rarityLabels.get(rarity) ?? rarity}
                        </button>
                    ))}
                    {filters.setCodes.map(setCode => (
                        <button
                            key={`set-${setCode}`}
                            type="button"
                            className="filter-active-token"
                            onClick={() => removeSetCode(setCode)}
                            data-testid="deck-editor-active-filter-token"
                            aria-label={`Clear ${setCode} set filter`}
                        >
                            Set: {setCode}
                        </button>
                    ))}
                    {filters.format && !filters.useDeckFormat && !filters.pennyDreadful && (
                        <button
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ format: '', pennyDreadful: false })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label="Clear format filter"
                        >
                            Format: {filters.format}
                        </button>
                    )}
                    {filters.useDeckFormat && (
                        <button
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ useDeckFormat: false })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label="Clear deck format search filter"
                        >
                            Deck format
                        </button>
                    )}
                    {filters.pennyDreadful && (
                        <button
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ pennyDreadful: false, format: '' })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label="Clear Penny Dreadful filter"
                        >
                            Penny
                        </button>
                    )}
                    {filters.manaValue !== null && (
                        <button
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ manaValue: null })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label="Clear mana value filter"
                        >
                            MV {MANA_OPERATOR_LABELS[filters.manaValueOperator] ?? '='} {filters.manaValue}
                        </button>
                    )}
                    {filters.uniqueNames && (
                        <button
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ uniqueNames: false })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label="Clear unique cards filter"
                        >
                            Unique
                        </button>
                    )}
                    {filters.piles && (
                        <button
                            type="button"
                            className="filter-active-token"
                            onClick={() => setFilters({ piles: false })}
                            data-testid="deck-editor-active-filter-token"
                            aria-label="Clear piles filter"
                        >
                            Piles
                        </button>
                    )}
                </div>
            )}

            <div className="filter-row filter-row-advanced">
                <div className="filter-chip-group" aria-label="Types">
                    {CARD_TYPES.map(type => (
                        <button
                            key={type.value}
                            type="button"
                            className={`filter-chip ${filters.types.includes(type.value) ? 'active' : ''} ${filters.excludedTypes.includes(type.value) ? 'excluded' : ''}`}
                            onClick={(event) => toggleListFilter(event, type.value, 'types', 'excludedTypes')}
                            title={`${type.label}. Alt-click only this; Ctrl-click all other types.`}
                            data-testid={`deck-editor-type-filter-${type.value.toLowerCase()}`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>

                <div className="filter-chip-group filter-rarity-group" aria-label="Rarities">
                    {RARITIES.map(rarity => (
                        <button
                            key={rarity.value}
                            type="button"
                            className={`filter-chip ${filters.rarities.includes(rarity.value) ? 'active' : ''} ${filters.excludedRarities.includes(rarity.value) ? 'excluded' : ''}`}
                            onClick={(event) => toggleListFilter(event, rarity.value, 'rarities', 'excludedRarities')}
                            title={`${rarity.label}. Alt-click only this; Ctrl-click all other rarities.`}
                            data-testid={`deck-editor-rarity-filter-${rarity.value.toLowerCase()}`}
                        >
                            {rarity.label}
                        </button>
                    ))}
                </div>

                <div className="filter-group filter-set-codes">
                    <input
                        type="text"
                        list="deck-editor-set-code-options"
                        placeholder="Sets..."
                        value={filters.setCodes.join(' ')}
                        onChange={handleSetCodesChange}
                        onKeyDown={handleKeyDown}
                        className="filter-input"
                        aria-label="Set codes"
                        data-testid="deck-editor-set-code-filter"
                    />
                    <select
                        value={pendingSetCode}
                        onChange={handleSetPickerChange}
                        className="filter-select filter-picker-select"
                        aria-label="Add set code"
                        data-testid="deck-editor-set-code-picker"
                    >
                        <option value="">Add set</option>
                        {setCodeOptions.map(setInfo => (
                            <option
                                key={setInfo.setCode}
                                value={setInfo.setCode}
                            >
                                {setInfo.name ? `${setInfo.setCode} - ${setInfo.name}` : setInfo.setCode}
                            </option>
                        ))}
                    </select>
                    <datalist id="deck-editor-set-code-options" data-testid="deck-editor-set-code-options">
                        {setCodeOptions.map(setInfo => (
                            <option
                                key={setInfo.setCode}
                                value={setInfo.setCode}
                                label={setInfo.name ? `${setInfo.setCode} - ${setInfo.name}` : setInfo.setCode}
                            />
                        ))}
                    </datalist>
                    {filters.setCodes.length > 0 && (
                        <div className="filter-token-list" aria-label="Selected set codes" data-testid="deck-editor-set-code-tokens">
                            {filters.setCodes.map(setCode => (
                                <button
                                    key={setCode}
                                    type="button"
                                    className="filter-token"
                                    onClick={() => removeSetCode(setCode)}
                                    aria-label={`Remove ${setCode} set filter`}
                                >
                                    {setCode}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="filter-group filter-format">
                    <input
                        type="text"
                        list="deck-editor-format-options"
                        placeholder="Format..."
                        value={filters.format}
                        onChange={handleFormatChange}
                        onKeyDown={handleKeyDown}
                        className="filter-input"
                        aria-label="Search format"
                        disabled={filters.useDeckFormat || filters.pennyDreadful}
                        data-testid="deck-editor-format-filter"
                    />
                    <select
                        value={pendingFormat}
                        onChange={handleFormatPickerChange}
                        className="filter-select filter-format-picker"
                        aria-label="Choose search format"
                        disabled={filters.useDeckFormat || filters.pennyDreadful}
                        data-testid="deck-editor-format-picker"
                    >
                        <option value="">Format list</option>
                        {formatOptions.map(format => (
                            <option key={format} value={format}>
                                {format}
                            </option>
                        ))}
                    </select>
                    <datalist id="deck-editor-format-options" data-testid="deck-editor-format-options">
                        {formatOptions.map(format => (
                            <option key={format} value={format} />
                        ))}
                    </datalist>
                    <label className="filter-check">
                        <input
                            type="checkbox"
                            checked={filters.useDeckFormat}
                            onChange={(event) => setFilters({ useDeckFormat: event.currentTarget.checked })}
                        />
                        <span>Deck</span>
                    </label>
                    <label className="filter-check">
                        <input
                            type="checkbox"
                            checked={filters.pennyDreadful}
                            onChange={(event) => handlePennyDreadfulChange(event.currentTarget.checked)}
                        />
                        <span>Penny</span>
                    </label>
                </div>

                <div className="filter-group filter-mode-toggles">
                    <label className="filter-check" title="Search in card names.">
                        <input
                            type="checkbox"
                            checked={filters.searchNames}
                            onChange={(event) => setFilters({ searchNames: event.currentTarget.checked })}
                            data-testid="deck-editor-search-names-toggle"
                        />
                        <span>Names</span>
                    </label>
                    <label className="filter-check" title="Search in card types.">
                        <input
                            type="checkbox"
                            checked={filters.searchTypes}
                            onChange={(event) => setFilters({ searchTypes: event.currentTarget.checked })}
                            data-testid="deck-editor-search-types-toggle"
                        />
                        <span>Types</span>
                    </label>
                    <label className="filter-check" title="Search in card rules.">
                        <input
                            type="checkbox"
                            checked={filters.searchRules}
                            onChange={(event) => setFilters({ searchRules: event.currentTarget.checked })}
                            data-testid="deck-editor-search-rules-toggle"
                        />
                        <span>Rules</span>
                    </label>
                    <label className="filter-check" title="Show only the first found card of every card name.">
                        <input
                            type="checkbox"
                            checked={filters.uniqueNames}
                            onChange={(event) => setFilters({ uniqueNames: event.currentTarget.checked })}
                        />
                        <span>Unique</span>
                    </label>
                    <label className="filter-check">
                        <input
                            type="checkbox"
                            checked={filters.piles}
                            onChange={(event) => setFilters({ piles: event.currentTarget.checked })}
                        />
                        <span>Piles</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default CardFilters;
