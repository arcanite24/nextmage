/**
 * Card Filters Component
 * 
 * Filter bar for card search with color toggles, type dropdown,
 * mana value, rarity, and sorting options.
 */

import React from 'react';
import { useDeckStore, DeckColors } from '../../stores/deckStore';
import { ManaSymbol } from '../common/ManaSymbols';
import './CardFilters.css';

const CARD_TYPES = [
    'Creature',
    'Instant',
    'Sorcery',
    'Enchantment',
    'Artifact',
    'Planeswalker',
    'Land',
];

const RARITIES = [
    { value: 'COMMON', label: 'Common' },
    { value: 'UNCOMMON', label: 'Uncommon' },
    { value: 'RARE', label: 'Rare' },
    { value: 'MYTHIC', label: 'Mythic' },
];

interface CardFiltersProps {
    onSearch: () => void;
}

export const CardFilters: React.FC<CardFiltersProps> = ({ onSearch }) => {
    const { filters, setFilters, resetFilters, isSearching } = useDeckStore();

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters({ nameContains: e.target.value });
    };

    const handleColorToggle = (color: keyof DeckColors) => {
        setFilters({
            colors: {
                ...filters.colors,
                [color]: !filters.colors[color],
            },
        });
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === '') {
            setFilters({ types: [] });
        } else {
            setFilters({ types: [value] });
        }
    };

    const handleRarityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === '') {
            setFilters({ rarities: [] });
        } else {
            setFilters({ rarities: [value] });
        }
    };

    const handleManaValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFilters({ manaValue: value === '' ? null : parseInt(value, 10) });
    };

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters({ sortBy: e.target.value as any });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSearch();
        }
    };

    const handleReset = () => {
        resetFilters();
    };

    const colorButtons: { color: keyof DeckColors; symbol: string }[] = [
        { color: 'white', symbol: 'W' },
        { color: 'blue', symbol: 'U' },
        { color: 'black', symbol: 'B' },
        { color: 'red', symbol: 'R' },
        { color: 'green', symbol: 'G' },
    ];

    return (
        <div className="card-filters">
            <div className="filter-row filter-row-main">
                <div className="filter-group filter-search">
                    <input
                        type="text"
                        placeholder="Search cards..."
                        value={filters.nameContains}
                        onChange={handleNameChange}
                        onKeyDown={handleKeyDown}
                        className="filter-input"
                    />
                </div>

                <div className="filter-group filter-colors">
                    {colorButtons.map(({ color, symbol }) => (
                        <button
                            key={color}
                            className={`color-toggle ${filters.colors[color] ? 'active' : ''}`}
                            onClick={() => handleColorToggle(color)}
                            title={color.charAt(0).toUpperCase() + color.slice(1)}
                        >
                            <ManaSymbol symbol={symbol} size="sm" />
                        </button>
                    ))}
                </div>

                <div className="filter-group">
                    <select
                        value={filters.types[0] || ''}
                        onChange={handleTypeChange}
                        className="filter-select"
                    >
                        <option value="">All Types</option>
                        {CARD_TYPES.map(type => (
                            <option key={type} value={type.toUpperCase()}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group filter-mana-value">
                    <input
                        type="number"
                        placeholder="MV"
                        min={0}
                        max={20}
                        value={filters.manaValue ?? ''}
                        onChange={handleManaValueChange}
                        onKeyDown={handleKeyDown}
                        className="filter-input filter-input-small"
                    />
                </div>

                <div className="filter-group">
                    <select
                        value={filters.rarities[0] || ''}
                        onChange={handleRarityChange}
                        className="filter-select"
                    >
                        <option value="">All Rarities</option>
                        {RARITIES.map(r => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <select
                        value={filters.sortBy}
                        onChange={handleSortChange}
                        className="filter-select"
                    >
                        <option value="name">Sort: Name</option>
                        <option value="manaValue">Sort: Mana Value</option>
                        <option value="color">Sort: Color</option>
                        <option value="rarity">Sort: Rarity</option>
                    </select>
                </div>

                <div className="filter-actions">
                    <button
                        className="btn btn-primary btn-search"
                        onClick={onSearch}
                        disabled={isSearching}
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
        </div>
    );
};

export default CardFilters;
