/**
 * Multi Amount Dialog
 * 
 * Dialog for distributing values among multiple targets (e.g., combat damage, counters).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Button } from '../common';
import { useGameStore, MultiAmountMessage } from '../../stores';
import './MultiAmountDialog.css';

interface MultiAmountDialogProps {
    isOpen: boolean;
    messages: MultiAmountMessage[];
    min: number;  // Total min
    max: number;  // Total max
}

export const MultiAmountDialog: React.FC<MultiAmountDialogProps> = ({
    isOpen,
    messages,
    min: totalMin,
    max: totalMax,
}) => {
    const sendString = useGameStore(state => state.sendString);

    // Initialize with default values
    const [values, setValues] = useState<number[]>([]);

    // Reset values when dialog opens
    useEffect(() => {
        if (isOpen && messages.length > 0) {
            setValues(messages.map(m => m.defaultValue));
        }
    }, [isOpen, messages]);

    const total = useMemo(() => values.reduce((sum, v) => sum + v, 0), [values]);
    const remaining = totalMax - total;

    const isValid = useMemo(() => {
        // Check total constraints
        if (total < totalMin || total > totalMax) return false;

        // Check individual constraints
        return values.every((v, i) => {
            const msg = messages[i];
            return v >= msg.min && v <= msg.max;
        });
    }, [values, messages, totalMin, totalMax, total]);

    const handleChange = (index: number, newValue: number) => {
        const msg = messages[index];
        const clamped = Math.max(msg.min, Math.min(msg.max, newValue));

        setValues(prev => {
            const next = [...prev];
            next[index] = clamped;
            return next;
        });
    };

    const handleIncrement = (index: number) => {
        const msg = messages[index];
        if (values[index] < msg.max && total < totalMax) {
            handleChange(index, values[index] + 1);
        }
    };

    const handleDecrement = (index: number) => {
        const msg = messages[index];
        if (values[index] > msg.min) {
            handleChange(index, values[index] - 1);
        }
    };

    const handleSubmit = useCallback(() => {
        if (isValid) {
            // Server expects values as comma-separated string
            sendString(values.join(','));
        }
    }, [isValid, sendString, values]);

    const handleAutoDistribute = () => {
        // Distribute remaining evenly across items that can accept more
        const newValues = messages.map(m => m.min);
        let toDistribute = totalMax;

        // First, allocate minimums
        toDistribute -= newValues.reduce((sum, v) => sum + v, 0);

        // Then distribute remaining
        for (let i = 0; i < newValues.length && toDistribute > 0; i++) {
            const canAdd = Math.min(toDistribute, messages[i].max - newValues[i]);
            newValues[i] += canAdd;
            toDistribute -= canAdd;
        }

        setValues(newValues);
    };

    if (values.length !== messages.length) {
        return null; // Not yet initialized
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { }} // Can't close without selecting
            title="Distribute Amount"
            size="md"
            closeOnBackdrop={false}
            closeOnEscape={false}
            showCloseButton={false}
        >
            <div className="multi-amount-dialog">
                <div className="multi-amount-summary">
                    <div className="multi-amount-total">
                        Total: <span className={total > totalMax ? 'over' : (total >= totalMin ? 'valid' : 'under')}>{total}</span>
                        <span className="multi-amount-target">/ {totalMax}</span>
                    </div>
                    {remaining > 0 && (
                        <div className="multi-amount-remaining">
                            {remaining} remaining to distribute
                        </div>
                    )}
                </div>

                <div className="multi-amount-list">
                    {messages.map((msg, index) => (
                        <div key={index} className="multi-amount-item">
                            <div className="multi-amount-label">
                                <span dangerouslySetInnerHTML={{ __html: msg.message }} />
                                <span className="multi-amount-range">
                                    ({msg.min}–{msg.max})
                                </span>
                            </div>
                            <div className="multi-amount-controls">
                                <button
                                    className="multi-amount-btn"
                                    onClick={() => handleDecrement(index)}
                                    disabled={values[index] <= msg.min}
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    className="multi-amount-input"
                                    value={values[index]}
                                    onChange={(e) => handleChange(index, parseInt(e.target.value, 10) || 0)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                    min={msg.min}
                                    max={msg.max}
                                    autoFocus={index === 0}
                                />
                                <button
                                    className="multi-amount-btn"
                                    onClick={() => handleIncrement(index)}
                                    disabled={values[index] >= msg.max || total >= totalMax}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="multi-amount-actions">
                    <Button
                        onClick={handleAutoDistribute}
                        variant="secondary"
                        size="sm"
                    >
                        Auto Distribute
                    </Button>

                    <Button
                        onClick={handleSubmit}
                        variant="primary"
                        size="lg"
                        disabled={!isValid}
                    >
                        Confirm Distribution
                    </Button>
                </div>

                {!isValid && (
                    <div className="multi-amount-warning">
                        Total must be between {totalMin} and {totalMax}, and every row must stay in range.
                    </div>
                )}
            </div>
        </Modal>
    );
};
