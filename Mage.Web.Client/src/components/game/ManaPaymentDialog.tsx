/**
 * Mana Payment Panel
 * 
 * An overlay panel (not a blocking modal) for paying mana costs.
 * Users can tap lands on the battlefield, and the mana pool updates in real-time.
 * Clicking mana in the pool pays from the pool.
 */

import React from 'react';
import { Coins, MousePointerClick, WandSparkles, X } from 'lucide-react';
import { ManaType, ManaPoolView } from '../../types';
import { useGameStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import './ManaPaymentDialog.css';

interface ManaPaymentDialogProps {
    isOpen: boolean;
    message: string;
    /** X-mana prompt: Done finishes paying X (for normal costs any boolean cancels the spell) */
    isXMana?: boolean;
}

const MANA_CONFIG: Array<{ type: ManaType; color: string; symbol: string; bgColor: string; key: keyof ManaPoolView }> = [
    { type: ManaType.WHITE, color: '#1a1a1a', bgColor: '#fef08a', symbol: 'W', key: 'white' },
    { type: ManaType.BLUE, color: '#ffffff', bgColor: '#3b82f6', symbol: 'U', key: 'blue' },
    { type: ManaType.BLACK, color: '#ffffff', bgColor: '#1f2937', symbol: 'B', key: 'black' },
    { type: ManaType.RED, color: '#ffffff', bgColor: '#ef4444', symbol: 'R', key: 'red' },
    { type: ManaType.GREEN, color: '#ffffff', bgColor: '#22c55e', symbol: 'G', key: 'green' },
    { type: ManaType.COLORLESS, color: '#1a1a1a', bgColor: '#d1d5db', symbol: 'C', key: 'colorless' },
];

function getAvailableManaTypes(manaPool: ManaPoolView | undefined): ManaType[] {
    if (!manaPool) return [];
    return MANA_CONFIG
        .filter(({ key }) => manaPool[key] > 0)
        .map(({ type }) => type);
}

export const ManaPaymentDialog: React.FC<ManaPaymentDialogProps> = ({ isOpen, message, isXMana = false }) => {
    const sendManaType = useGameStore(state => state.sendManaType);
    const sendBoolean = useGameStore(state => state.sendBoolean);
    const sendString = useGameStore(state => state.sendString);
    // e.g. "Convoke", "Delve" or "Improvise": the server pays part of the cost with a special action
    const specialButton = useGameStore(state => {
        const action = state.pendingAction;
        const label = action.type !== 'none' && 'options' in action ? action.options?.specialButton : undefined;
        return typeof label === 'string' && label.trim() ? label : null;
    });
    const getMyPlayer = useGameStore(state => state.getMyPlayer);
    const settings = useSettingsStore(state => state.settings);
    const [isAutoPaying, setIsAutoPaying] = React.useState(false);

    const myPlayer = getMyPlayer();
    const manaPool = myPlayer?.manaPool;

    if (!isOpen) return null;

    const totalMana = manaPool
        ? manaPool.white + manaPool.blue + manaPool.black + manaPool.red + manaPool.green + manaPool.colorless
        : 0;
    const availableManaTypes = getAvailableManaTypes(manaPool);

    const handleClickMana = (manaType: ManaType) => {
        // Send the mana type to the server to pay from pool
        sendManaType(manaType);
    };

    // payment finishes by itself once the cost is paid; any boolean answer cancels it on the server
    const handleSpecial = () => {
        sendString('special');
    };

    const handleAutoPay = async () => {
        if (availableManaTypes.length === 0 || isAutoPaying) return;

        setIsAutoPaying(true);
        try {
            for (const manaType of availableManaTypes) {
                await sendManaType(manaType);
            }
        } finally {
            setIsAutoPaying(false);
        }
    };

    const handleCancel = () => {
        // Cancel
        sendBoolean(false);
    };

    return (
        <div className="mana-payment-panel">
            <div className="mana-payment-header">
                <span className="mana-payment-title">
                    <Coins size={16} aria-hidden="true" />
                    Pay Mana
                </span>
                <button className="mana-payment-close" onClick={handleCancel} title="Cancel (Esc)">
                    <X size={14} aria-hidden="true" />
                </button>
            </div>

            <div className="mana-payment-message" dangerouslySetInnerHTML={{ __html: message }} />

            <div className="mana-payment-instructions">
                <MousePointerClick className="instruction-icon" size={14} aria-hidden="true" />
                <span>{settings.autoTapManaPayment ? 'Auto-pay is enabled for matching costs' : 'Tap lands to add mana, then click mana below to pay'}</span>
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
                <button
                    className="mana-action-btn auto"
                    onClick={handleAutoPay}
                    disabled={availableManaTypes.length === 0 || isAutoPaying}
                    title={availableManaTypes.length > 0 ? 'Pay with available mana in pool' : 'No mana in pool'}
                    data-testid="mana-auto-pay-button"
                >
                    <WandSparkles size={14} aria-hidden="true" />
                    {isAutoPaying ? 'Paying' : 'Auto pay'}
                </button>
                {isXMana && (
                    <button className="mana-action-btn done" onClick={() => sendBoolean(true)}>
                        Done
                    </button>
                )}
                {specialButton && (
                    <button className="mana-action-btn done" onClick={handleSpecial} data-testid="mana-special-button" aria-label={`Pay with ${specialButton}`}>
                        {specialButton}
                    </button>
                )}
            </div>
        </div>
    );
};
