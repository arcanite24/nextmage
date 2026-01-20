import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSessionStore, useDebugStore } from '../../stores';
import { GameView, PhaseStep, SkipPrioritySteps } from '../../types';
import './PhaseIndicator.css';

interface PhaseIndicatorProps {
    turn: GameView['turn'];
    step: GameView['step'];
}

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

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = React.memo(({ turn, step }) => {
    const { userData, updateSkipPrioritySteps } = useSessionStore(useShallow(state => ({
        userData: state.userData,
        updateSkipPrioritySteps: state.updateSkipPrioritySteps
    })));

    const { config } = useDebugStore(useShallow(state => ({ config: state.config })));

    // Helper functions moved outside component

    const handleToggleStop = React.useCallback((key: string | null) => {
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
    }, [userData, updateSkipPrioritySteps]);

    const isStopSet = React.useCallback((key: string | null) => {
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
    }, [userData]);

    return (
        <div className="phase-indicator">
            <div className="turn-info">
                Turn {turn}
            </div>
            {config.enabled && (
                <div
                    className="debug-mode-badge"
                    title="Debug Mode Enabled (Ctrl+Shift+D to toggle)"
                >
                    DEBUG
                </div>
            )}
            <div className="steps-row">
                {phases.map(p => {
                    const stopSet = isStopSet(p.key);
                    const canSet = !!p.key;

                    return (
                        <PhaseStepIndicator
                            key={p.id}
                            id={p.id}
                            label={p.label}
                            stepKey={p.key}
                            isActive={step === p.id}
                            isStopSet={stopSet}
                            canSet={canSet}
                            onClick={() => handleToggleStop(p.key)}
                        />
                    );
                })}
            </div>
            <div className="phase-legend">
                Highlighted border = Stop Set
            </div>
        </div>
    );
});

// === SUB-COMPONENTS ===

interface PhaseStepIndicatorProps {
    id: PhaseStep;
    label: string;
    stepKey: string | null;
    isActive: boolean;
    isStopSet: boolean;
    canSet: boolean;
    onClick: () => void;
}

const PhaseStepIndicator: React.FC<PhaseStepIndicatorProps> = React.memo(({
    id, label, stepKey, isActive, isStopSet, canSet, onClick
}) => {
    return (
        <div
            className={`step-item ${isActive ? 'active' : ''} ${isStopSet ? 'stop-set' : ''}`}
            title={canSet ? `Click to toggle stop at ${label}` : label}
            onClick={onClick}
            style={{ cursor: canSet ? 'pointer' : 'default', opacity: canSet ? 1 : 0.7 } as React.CSSProperties}
        >
            {label}
        </div>
    );
});
