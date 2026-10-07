import React from 'react';
import { AbilityPickerView } from '../../../types';
import { useGameStore } from '../../../stores';
import { isEditableEventTarget } from '../../../services/KeybindService';
import './AbilityPickerDialog.css';

interface AbilityPickerDialogProps {
    data: AbilityPickerView;
}

export const AbilityPickerDialog: React.FC<AbilityPickerDialogProps> = ({ data }) => {
    const sendUUID = useGameStore(state => state.sendUUID);

    // Parse abilities from the map
    // The server sends a map of UUID -> String representation
    // String format is usually: "Index. Cost: Description"
    // e.g. "1. +1: Create a 1/1 white Soldier creature token."
    const choices = React.useMemo(() => Object.entries(data.choices).map(([id, text]) => {
        const match = text.match(/^(\d+)\.\s*([+-]?\d+|0|X)?\s*:?\s*(.*)$/);

        if (match) {
            return {
                id,
                index: parseInt(match[1]),
                cost: match[2] || '', // Loyalty cost (+1, -3, 0)
                description: match[3],
                originalText: text
            };
        }
        return {
            id,
            index: 0,
            cost: '',
            description: text,
            originalText: text
        };
    }).sort((a, b) => a.index - b.index), [data.choices]);

    // Extract planeswalker name from message if possible
    // Message format: "Choose spell or ability to play<br><font ...>Name</font> ..."
    const titleMatch = data.message?.match(/>([^<]+)<\/font>/);
    const title = titleMatch ? titleMatch[1] : 'Choose Ability';
    const titleId = React.useId();
    const descriptionId = React.useId();

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableEventTarget(event.target)) return;
            const shortcut = Number.parseInt(event.key, 10);
            if (shortcut >= 1 && shortcut <= 9 && shortcut <= choices.length) {
                event.preventDefault();
                void sendUUID(choices[shortcut - 1].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [choices, sendUUID]);

    return (
        <div className="ability-picker-overlay">
            <div
                className="ability-picker-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                data-testid="ability-picker-dialog"
            >
                <div className="ability-picker-header">
                    <h2 id={titleId}>{title}</h2>
                    <div id={descriptionId} className="ability-picker-subtitle">Select an ability to activate</div>
                </div>

                <div className="ability-picker-content">
                    {choices.map((choice, index) => (
                        <button
                            key={choice.id}
                            className={`ability-option loyalty-${choice.cost.replace(/[+-]/, '')}`}
                            onClick={() => sendUUID(choice.id)}
                            autoFocus={index === 0}
                            aria-label={`Choose ability ${index + 1}: ${choice.description}`}
                        >
                            <div className="loyalty-cost-container">
                                <div className={`loyalty-badge ${choice.cost.startsWith('+') ? 'plus' : choice.cost.startsWith('-') ? 'minus' : 'neutral'}`}>
                                    {choice.cost}
                                </div>
                            </div>
                            <div className="ability-description">
                                {choice.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
