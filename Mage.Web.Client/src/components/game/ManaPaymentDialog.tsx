/**
 * Mana Payment Panel
 * 
 * An overlay panel (not a blocking modal) for paying mana costs.
 * Users can tap lands on the battlefield, and the mana pool updates in real-time.
 * Clicking mana in the pool pays from the pool.
 */

import React from 'react';
import { ManaType, ManaPoolView } from '../../types';
import { useGameStore } from '../../stores';
import './ManaPaymentDialog.css';

interface ManaPaymentDialogProps {
    isOpen: boolean;
    message: string;
}

const MANA_CONFIG: Array<{ type: ManaType; color: string; symbol: string; bgColor: string; key: keyof ManaPoolView }> = [
    { type: ManaType.WHITE, color: '#1a1a1a', bgColor: '#fef08a', symbol: 'W', key: 'white' },
    { type: ManaType.BLUE, color: '#ffffff', bgColor: '#3b82f6', symbol: 'U', key: 'blue' },
    { type: ManaType.BLACK, color: '#ffffff', bgColor: '#1f2937', symbol: 'B', key: 'black' },
    { type: ManaType.RED, color: '#ffffff', bgColor: '#ef4444', symbol: 'R', key: 'red' },
    { type: ManaType.GREEN, color: '#ffffff', bgColor: '#22c55e', symbol: 'G', key: 'green' },
    { type: ManaType.COLORLESS, color: '#1a1a1a', bgColor: '#d1d5db', symbol: 'C', key: 'colorless' },
];

export const ManaPaymentDialog: React.FC<ManaPaymentDialogProps> = ({ isOpen, message }) => {
    const { gameView, sendManaType, sendBoolean, getMyPlayer } = useGameStore();

    const myPlayer = getMyPlayer();
    const manaPool = myPlayer?.manaPool;

    if (!isOpen) return null;

    const totalMana = manaPool
        ? manaPool.white + manaPool.blue + manaPool.black + manaPool.red + manaPool.green + manaPool.colorless
        : 0;

    const handleClickMana = (manaType: ManaType) => {
        // Send the mana type to the server to pay from pool
        sendManaType(manaType);
    };

    const handleDone = () => {
        // Confirm payment / pass
        sendBoolean(true);
    };

    const handleCancel = () => {
        // Cancel
        sendBoolean(false);
    };

    return (
        <div className="mana-payment-panel">
            <div className="mana-payment-header">
                <span className="mana-payment-title">💰 Pay Mana</span>
                <button className="mana-payment-close" onClick={handleCancel} title="Cancel (Esc)">
                    ✕
                </button>
            </div>

            <div className="mana-payment-message" dangerouslySetInnerHTML={{ __html: message }} />

            <div className="mana-payment-instructions">
                <span className="instruction-icon">👆</span>
                <span>Tap lands to add mana, then click mana below to pay</span>
            </div>

            <div className="mana-pool-section">
                <div className="mana-pool-label">
                    Mana Pool {totalMana > 0 && <span className="mana-total">({totalMana})</span>}
                </div>

                <div className="mana-pool-buttons">
                    {MANA_CONFIG.map(({ type, color, bgColor, symbol, key }) => {
                        const count = manaPool ? manaPool[key] : 0;
                        const hasAny = count > 0;

                        return (
                            <button
                                key={type}
                                className={`mana-pool-button ${hasAny ? 'available' : 'empty'}`}
                                style={{
                                    '--mana-bg': bgColor,
                                    '--mana-color': color,
                                } as React.CSSProperties}
                                onClick={() => hasAny && handleClickMana(type)}
                                disabled={!hasAny}
                                title={hasAny ? `Pay ${symbol} from pool` : `No ${symbol} mana in pool`}
                            >
                                <span className="mana-symbol">{symbol}</span>
                                <span className="mana-count">{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mana-payment-actions">
                <button className="mana-action-btn cancel" onClick={handleCancel}>
                    Cancel
                </button>
                <button className="mana-action-btn done" onClick={handleDone}>
                    Done
                </button>
            </div>
        </div>
    );
};
