import React, { useState } from 'react';
import { CardSearchCriteria, CardType, Rarity, ObjectColor } from '../../types';
import './CardSearch.css';

interface CardSearchProps {
    onSearch: (criteria: CardSearchCriteria) => void;
}

export const CardSearch: React.FC<CardSearchProps> = ({ onSearch }) => {
    const [name, setName] = useState('');
    const [rules, setRules] = useState('');
    const [types, setTypes] = useState<CardType[]>([]);

    // Add more filters as needed

    const handleSearch = () => {
        // Construct criteria explicitly to avoid any phantom properties
        const criteria: CardSearchCriteria = {
            nameContains: name && name.length > 0 ? name : undefined,
            rules: rules && rules.length > 0 ? rules : undefined,
            types: types.length > 0 ? types : undefined,
            count: 100
        };

        // Explicitly ensure 'name' key is not present if we want contains search
        // (TypeScript interface might allow it if it was loose, but we want to be sure)
        // @ts-ignore
        if (criteria['name']) {
            // @ts-ignore
            delete criteria['name'];
        }

        onSearch(criteria);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="card-search">
            <div className="search-row">
                <input
                    type="text"
                    placeholder="Card Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="search-input"
                />
            </div>
            <div className="search-row">
                <input
                    type="text"
                    placeholder="Rules Text"
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="search-input"
                />
            </div>
            <div className="search-row">
                <button onClick={handleSearch} className="btn btn-primary search-btn">Search</button>
            </div>
        </div>
    );
};
