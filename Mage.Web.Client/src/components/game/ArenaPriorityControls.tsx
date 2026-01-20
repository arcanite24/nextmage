import React from 'react';
import { PhaseStep } from '../../types';
import { useGameStore } from '../../stores';
import { useShallow } from 'zustand/react/shallow';
import './ArenaPriorityControls.css';

interface ArenaPriorityControlsProps {
    hasPriority: boolean;
    isMyTurn: boolean;
    currentPhase: PhaseStep;
    skipEnabled: boolean;
    onToggleSkip: () => void;
}

/**
 * Returns a human-readable label for the next phase target.
 * E.g., during Main 1, clicking "Next" would advance "To Combat"
 */
const getNextPhaseLabel = (currentPhase: PhaseStep, pendingType: string): string => {
    // If there's a pending action, show a contextual label
    if (pendingType === 'target' || pendingType === 'select') {
        return 'Confirm';
    }
    if (pendingType === 'ask') {
        return 'Yes';
    }

    switch (currentPhase) {
        case PhaseStep.UNTAP:
        case PhaseStep.UPKEEP:
            return 'To Draw';
        case PhaseStep.DRAW:
            return 'To Main';
        case PhaseStep.PRECOMBAT_MAIN:
            return 'To Combat';
        case PhaseStep.BEGIN_COMBAT:
            return 'To Attackers';
        case PhaseStep.DECLARE_ATTACKERS:
            return 'To Blockers';
        case PhaseStep.DECLARE_BLOCKERS:
        case PhaseStep.COMBAT_DAMAGE:
            return 'To End Combat';
        case PhaseStep.END_COMBAT:
            return 'To Main 2';
        case PhaseStep.POSTCOMBAT_MAIN:
            return 'To End';
        case PhaseStep.END_TURN:
        case PhaseStep.CLEANUP:
            return 'End Turn';
        default:
            return 'Pass';
    }
};

export const ArenaPriorityControls: React.FC<ArenaPriorityControlsProps> = React.memo(({
    hasPriority,
    isMyTurn,
    currentPhase,
    skipEnabled,
    onToggleSkip,
}) => {
    const { pendingType, sendBoolean, sendPlayerAction } = useGameStore(useShallow(state => ({
        pendingType: state.pendingAction.type,
        sendBoolean: state.sendBoolean,
        sendPlayerAction: state.sendPlayerAction
    })));

    const phaseLabel = getNextPhaseLabel(currentPhase, pendingType);

    // Handler for "Next" button - context-aware
    const handleNext = () => {
        // If there's a pending action requiring a response, respond to it
        switch (pendingType) {
            case 'ask':
            case 'target':
            case 'select':
                // Confirm/Done - same as pressing Space in FeedbackPanel
                sendBoolean(true);
                break;
            default:
                // No pending action - just pass priority
                sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
                break;
        }
    };

    // Only show controls when we have priority or it's our turn
    if (!hasPriority && !isMyTurn) {
        return null;
    }

    return (
        <div className="arena-priority-controls">
            {/* Main "Next" Button */}
            <button
                className={`arena-next-button ${hasPriority ? 'has-priority' : ''}`}
                onClick={handleNext}
                disabled={!hasPriority}
                title="Pass Priority / Confirm (Space)"
            >
                <span className="next-label">Next</span>
                <span className="next-phase">{phaseLabel}</span>
            </button>

            {/* Skip Toggle Button */}
            <button
                className={`arena-skip-toggle ${skipEnabled ? 'active' : ''}`}
                onClick={onToggleSkip}
                title={skipEnabled ? 'Stop Auto-Pass (Click or ESC)' : 'Enable Auto-Pass'}
            >
                <span className="skip-icon">⏩</span>
            </button>
        </div>
    );
});

