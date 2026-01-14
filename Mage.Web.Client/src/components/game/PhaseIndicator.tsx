import React from 'react';
import { useSessionStore } from '../../stores';
import { GameView, PhaseStep, SkipPrioritySteps } from '../../types';
import './PhaseIndicator.css';

interface PhaseIndicatorProps {
    turn: GameView['turn'];
    step: GameView['step'];
}

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ turn, step }) => {
    const { userData, updateSkipPrioritySteps } = useSessionStore();

    // Map PhaseStep to SkipPrioritySteps keys
    // Note: XMage stops are "Skip if true". The UI usually shows "Stop here if set".
    // So if "stop" is desired, skip should be FALSE.
    // However, the model name is "UserSkipPrioritySteps".
    // Let's assume: true = skip, false = stop (ask for priority).
    // The user wants to "Stop", so we want the value to be FALSE.

    const phases = [
        { id: PhaseStep.UNTAP, label: 'UNT', key: null },
        { id: PhaseStep.UPKEEP, label: 'UPK', key: 'upkeep' },
        { id: PhaseStep.DRAW, label: 'DRW', key: 'draw' },
        { id: PhaseStep.PRECOMBAT_MAIN, label: 'M1', key: 'main1' },
        { id: PhaseStep.BEGIN_COMBAT, label: 'BC', key: 'beforeCombat' },
        { id: PhaseStep.DECLARE_ATTACKERS, label: 'DA', key: null },
        { id: PhaseStep.DECLARE_BLOCKERS, label: 'DB', key: null },
        { id: PhaseStep.COMBAT_DAMAGE, label: 'DMG', key: null },
        { id: PhaseStep.END_COMBAT, label: 'EC', key: 'endOfCombat' },
        { id: PhaseStep.POSTCOMBAT_MAIN, label: 'M2', key: 'main2' },
        { id: PhaseStep.END_TURN, label: 'END', key: 'endOfTurn' },
        { id: PhaseStep.CLEANUP, label: 'CLN', key: null },
    ];

    const handleToggleStop = (key: string | null) => {
        if (!key || !userData) return;

        const currentSteps = userData.userSkipPrioritySteps.yourTurn;
        // Cast key to keyof SkipPrioritySteps because we know our phases array uses valid keys
        const currentVal = currentSteps[key as keyof SkipPrioritySteps];

        // If currentVal is true (skip), we want to make it false (stop) and vice versa.
        // But typically UI highlights "Stop". 
        // So Sticky/Highlighted = Stop = value is FALSE.
        // Unhighlighted = Skip = value is TRUE.

        const newSteps = {
            yourTurn: {
                ...userData.userSkipPrioritySteps.yourTurn,
                [key]: !currentVal, // Toggle
            }
        };

        updateSkipPrioritySteps({ yourTurn: newSteps.yourTurn });
    };

    const isStopSet = (key: string | null) => {
        if (!key || !userData) return false;

        const steps = userData.userSkipPrioritySteps;
        const yourTurnSteps = steps.yourTurn;

        // Handle specific phases
        if (key === 'main1' || key === 'main2') {
            if (steps.stopOnAllMainPhases) return true; // Stop if global setting is true
            // For individual steps: false = stop (ask priority), true = skip
            return !yourTurnSteps[key];
        }

        if (key === 'endOfTurn') {
            if (steps.stopOnAllEndPhases) return true;
            return !yourTurnSteps[key];
        }

        // Default check: false = STOP, true = SKIP
        return !yourTurnSteps[key as keyof typeof yourTurnSteps];
    };

    return (
        <div className="phase-indicator">
            <div className="turn-info">
                Turn {turn}
            </div>
            <div className="steps-row">
                {phases.map(p => {
                    const stopSet = isStopSet(p.key);
                    const canSet = !!p.key;

                    return (
                        <div
                            key={p.id}
                            className={`step-item ${step === p.id ? 'active' : ''} ${stopSet ? 'stop-set' : ''}`}
                            title={canSet ? `Click to toggle stop at ${p.label}` : p.label}
                            onClick={() => handleToggleStop(p.key)}
                            style={{ cursor: canSet ? 'pointer' : 'default', opacity: canSet ? 1 : 0.7 }}
                        >
                            {p.label}
                        </div>
                    );
                })}
            </div>
            <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '4px', color: '#666' }}>
                Highlighted border = Stop Set
            </div>
        </div>
    );
};
