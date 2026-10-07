/**
 * Choice Dialog
 * 
 * Generic dialog for selecting from a list of text choices.
 * Supports both:
 * - String choices (simple list)
 * - Key-value choices (used for replacement effects, etc.)
 * - Special option (e.g., "Remember answer")
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Lightbulb } from 'lucide-react';
import { Modal } from '../common';
import { useGameStore } from '../../stores';
import './ChoiceDialog.css';

interface ChoiceDialogProps {
    isOpen: boolean;
    message: string;
    choices: string[];
    keyChoices?: Record<string, string>;
    hintData?: Record<string, string[]>;
    hintType?: string;
    required?: boolean;
    specialEnabled?: boolean;
    specialCanBeEmpty?: boolean;
    specialText?: string;
    specialHint?: string;
    searchEnabled?: boolean;
    manaColorChoice?: boolean;
}

export const ChoiceDialog: React.FC<ChoiceDialogProps> = ({
    isOpen,
    message,
    choices,
    keyChoices = {},
    hintData,
    hintType,
    required = true,
    specialEnabled = false,
    specialCanBeEmpty = false,
    specialText = 'Remember answer',
    specialHint,
    searchEnabled = false,
    manaColorChoice = false,
}) => {
    const sendString = useGameStore(state => state.sendString);
    const [searchText, setSearchText] = useState('');
    const [specialChecked, setSpecialChecked] = useState(false);
    const [specialValue, setSpecialValue] = useState('');
    const specialTextInput = specialEnabled && (
        specialCanBeEmpty ||
        hintType === 'TEXT_INPUT' ||
        /text|input|name|value/i.test(`${specialText} ${specialHint ?? ''}`)
    );

    // Determine if we're using key-value choices or simple string choices
    const isKeyChoice = Object.keys(keyChoices).length > 0;

    // Build the list of options for display
    const options = useMemo(() => {
        if (isKeyChoice) {
            return Object.entries(keyChoices).map(([key, value]) => ({
                key,
                display: value,
                hints: hintData?.[key] || [],
            }));
        } else {
            return choices.map((choice, index) => ({
                key: String(index),
                display: choice,
                hints: [],
            }));
        }
    }, [isKeyChoice, keyChoices, choices, hintData]);

    // Filter options by search text
    const filteredOptions = useMemo(() => {
        if (!searchText.trim()) return options;
        const lower = searchText.toLowerCase();
        return options.filter(opt =>
            opt.display.toLowerCase().includes(lower) ||
            opt.hints.some(h => h.toLowerCase().includes(lower))
        );
    }, [options, searchText]);

    // Handle selection
    const handleSelect = useCallback((key: string) => {
        if (isKeyChoice) {
            // For key choices, send the key (possibly with special flag info)
            // The server expects a string for key-based choices
            if (specialChecked && specialEnabled) {
                // Send the key with special flag - server handles this via different mechanism
                // Based on Java impl, special selection is handled by prefixing with "#"
                sendString('#' + key);
            } else {
                sendString(key);
            }
        } else {
            // For simple choices (like mana color), send the actual choice string value
            // The server expects the string value, not an index
            // See HumanPlayer.choose(): choice.setChoice(val) expects the string
            const index = parseInt(key, 10);
            const choiceValue = choices[index];
            sendString(choiceValue);
        }
    }, [choices, isKeyChoice, sendString, specialChecked, specialEnabled]);

    const handleCancel = useCallback(() => {
        if (!required) {
            sendString('');
        }
    }, [required, sendString]);

    const handleSpecialSubmit = useCallback(() => {
        if (!specialCanBeEmpty && specialValue.trim().length === 0) {
            return;
        }
        sendString(specialValue);
    }, [sendString, specialCanBeEmpty, specialValue]);

    // Keyboard shortcuts (1-9 for quick selection)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for number keys 1-9
            const num = parseInt(e.key, 10);
            if (num >= 1 && num <= 9 && num <= filteredOptions.length) {
                e.preventDefault();
                handleSelect(filteredOptions[num - 1].key);
            } else if (e.key === 'Escape' && !required) {
                e.preventDefault();
                handleCancel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredOptions, required, handleSelect, handleCancel]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCancel}
            title="Make a Choice"
            size="md"
            closeOnBackdrop={!required}
            closeOnEscape={!required}
            showCloseButton={!required}
        >
            <div className="choice-dialog">
                <p className="choice-message" dangerouslySetInnerHTML={{ __html: message }} />

                {searchEnabled && (
                    <div className="choice-search">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="choice-search-input"
                            autoFocus
                        />
                    </div>
                )}

                <div className="choice-list">
                    {filteredOptions.map((option, index) => (
                        <button
                            key={option.key}
                            className={`choice-option ${manaColorChoice ? 'mana-choice' : ''}`}
                            onClick={() => handleSelect(option.key)}
                            autoFocus={index === 0 && !searchEnabled}
                        >
                            <div className="choice-number">{index + 1}</div>
                            {manaColorChoice && (
                                <span className={`choice-mana-dot mana-${option.display.toLowerCase()}`} aria-hidden="true" />
                            )}
                            <div className="choice-content">
                                <div className="choice-text">{option.display}</div>
                                {option.hints.length > 0 && hintType === 'TEXT' && (
                                    <div className="choice-hints">
                                        {option.hints.map((hint, i) => (
                                            <span key={i} className="choice-hint-item">{hint}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}

                    {filteredOptions.length === 0 && (
                        <div className="choice-empty">
                            No options match your search
                        </div>
                    )}
                </div>

                {specialEnabled && (
                    <div className="choice-special-group">
                        <label className="choice-special">
                            <input
                                type="checkbox"
                                checked={specialChecked}
                                onChange={(e) => setSpecialChecked(e.target.checked)}
                            />
                            <span className="choice-special-text">{specialText}</span>
                            {specialHint && (
                                <span className="choice-special-hint" title={specialHint}>Info</span>
                            )}
                        </label>
                        {specialTextInput && (
                            <div className="choice-special-input-row">
                                <input
                                    type="text"
                                    value={specialValue}
                                    onChange={(event) => setSpecialValue(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleSpecialSubmit();
                                        }
                                    }}
                                    placeholder={specialHint || specialText}
                                    className="choice-special-input"
                                    aria-label={specialText}
                                />
                                <button
                                    type="button"
                                    className="choice-special-submit"
                                    onClick={handleSpecialSubmit}
                                >
                                    Submit
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {filteredOptions.length > 0 && filteredOptions.length <= 9 && (
                    <div className="choice-shortcut-hint">
                        <Lightbulb size={14} aria-hidden="true" />
                        Tip: Press number key (1-{Math.min(filteredOptions.length, 9)}) to select
                    </div>
                )}

                {!required && (
                    <div className="choice-actions">
                        <button type="button" onClick={handleCancel}>
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};
