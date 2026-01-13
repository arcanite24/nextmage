/**
 * Mana Symbols Component
 * 
 * Renders mana cost and mana pool displays.
 */

import React from 'react';
import { ManaPoolView, ManaType } from '../../types';
import './ManaSymbols.css';

interface ManaSymbolProps {
    symbol: string;
    size?: 'sm' | 'md' | 'lg';
}

export const ManaSymbol: React.FC<ManaSymbolProps> = ({ symbol, size = 'md' }) => {
    const getSymbolClass = (s: string): string => {
        const lower = s.toLowerCase();
        switch (lower) {
            case 'w':
                return 'mana-w';
            case 'u':
                return 'mana-u';
            case 'b':
                return 'mana-b';
            case 'r':
                return 'mana-r';
            case 'g':
                return 'mana-g';
            case 'c':
                return 'mana-c';
            default:
                // Generic mana (numbers)
                return 'mana-generic';
        }
    };

    const displaySymbol = symbol.toUpperCase();

    return (
        <span className={`mana-symbol mana-${size} ${getSymbolClass(symbol)}`}>
            {displaySymbol}
        </span>
    );
};

interface ManaCostProps {
    cost: string[] | undefined;
    size?: 'sm' | 'md' | 'lg';
}

export const ManaCost: React.FC<ManaCostProps> = ({ cost, size = 'md' }) => {
    if (!cost || cost.length === 0) return null;

    return (
        <span className="mana-cost">
            {cost.map((symbol, index) => (
                <ManaSymbol key={index} symbol={symbol} size={size} />
            ))}
        </span>
    );
};

interface ManaPoolProps {
    pool: ManaPoolView;
    onManaClick?: (type: ManaType) => void;
    interactive?: boolean;
}

export const ManaPool: React.FC<ManaPoolProps> = ({
    pool,
    onManaClick,
    interactive = false,
}) => {
    const manaTypes: { type: ManaType; color: string; count: number }[] = [
        { type: ManaType.WHITE, color: 'w', count: pool.white },
        { type: ManaType.BLUE, color: 'u', count: pool.blue },
        { type: ManaType.BLACK, color: 'b', count: pool.black },
        { type: ManaType.RED, color: 'r', count: pool.red },
        { type: ManaType.GREEN, color: 'g', count: pool.green },
        { type: ManaType.COLORLESS, color: 'c', count: pool.colorless },
    ];

    const totalMana = Object.values(pool).reduce((sum, val) => sum + val, 0);

    if (totalMana === 0) {
        return <span className="mana-pool-empty">No mana</span>;
    }

    return (
        <div className={`mana-pool ${interactive ? 'mana-pool-interactive' : ''}`}>
            {manaTypes.map(
                ({ type, color, count }) =>
                    count > 0 && (
                        <button
                            key={type}
                            className="mana-pip"
                            onClick={() => interactive && onManaClick?.(type)}
                            disabled={!interactive}
                            type="button"
                        >
                            <ManaSymbol symbol={color} size="sm" />
                            <span className="mana-count">{count}</span>
                        </button>
                    )
            )}
        </div>
    );
};

export default { ManaSymbol, ManaCost, ManaPool };
