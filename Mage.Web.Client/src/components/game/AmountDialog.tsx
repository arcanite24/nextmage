/**
 * Amount Dialog
 * 
 * Dialog for choosing a number value (e.g., X costs, Chalice of the Void).
 */

import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { Modal, Button } from '../common';
import { useGameStore } from '../../stores';
import './AmountDialog.css';

interface AmountDialogProps {
    isOpen: boolean;
    message: string;
    min: number;
    max: number;
}

export const AmountDialog: React.FC<AmountDialogProps> = ({
    isOpen,
    message,
    min,
    max
}) => {
    const sendInteger = useGameStore(state => state.sendInteger);
    const [value, setValue] = useState(min);

    // Reset value when dialog opens
    useEffect(() => {
        if (isOpen) {
            setValue(min);
        }
    }, [isOpen, min]);

    const handleSubmit = () => {
        sendInteger(value);
    };

    const handleIncrement = () => {
        if (value < max) {
            setValue(v => v + 1);
        }
    };

    const handleDecrement = () => {
        if (value > min) {
            setValue(v => v - 1);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value, 10);
        if (!isNaN(newValue)) {
            setValue(Math.min(max, Math.max(min, newValue)));
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleIncrement();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleDecrement();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, value, min, max]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { }} // Can't close without selecting
            title="Choose a Number"
            size="sm"
            closeOnBackdrop={false}
            closeOnEscape={false}
            showCloseButton={false}
        >
            <div className="amount-dialog">
                <p className="amount-message" dangerouslySetInnerHTML={{ __html: message }} />

                <div className="amount-controls">
                    <button
                        className="amount-btn amount-decrement"
                        onClick={handleDecrement}
                        disabled={value <= min}
                        aria-label="Decrease amount"
                    >
                        −
                    </button>

                    <input
                        type="number"
                        className="amount-input"
                        value={value}
                        onChange={handleInputChange}
                        min={min}
                        max={max}
                        autoFocus
                    />

                    <button
                        className="amount-btn amount-increment"
                        onClick={handleIncrement}
                        disabled={value >= max}
                        aria-label="Increase amount"
                    >
                        +
                    </button>
                </div>

                <div className="amount-range">
                    Range: {min} – {max}
                </div>

                {/* Quick select buttons for common values */}
                {max <= 20 && max - min > 3 && (
                    <div className="amount-quick-select">
                        {Array.from({ length: Math.min(10, max - min + 1) }, (_, i) => min + i).map(n => (
                            <button
                                key={n}
                                className={`amount-quick-btn ${value === n ? 'active' : ''}`}
                                onClick={() => setValue(n)}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                )}

                <Button
                    onClick={handleSubmit}
                    variant="primary"
                    size="lg"
                    className="amount-submit"
                >
                    Confirm ({value})
                </Button>

                <div className="amount-hint">
                    <Lightbulb size={14} aria-hidden="true" />
                    Use ↑/↓ arrows or Enter to confirm
                </div>
            </div>
        </Modal>
    );
};
