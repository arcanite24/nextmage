import React from 'react';
import { FastForward } from 'lucide-react';
import { PhaseStep } from '../../types';
import { useGameStore, useSettingsStore } from '../../stores';
import { useShallow } from 'zustand/react/shallow';
import { audioFeedbackService } from '../../services';
import { shouldCompleteSelectWithBooleanFalse } from '../../services/BattlefieldPerformanceService';
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
    const { pendingAction, sendBoolean, sendUUID, sendPlayerAction } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        sendBoolean: state.sendBoolean,
        sendUUID: state.sendUUID,
        sendPlayerAction: state.sendPlayerAction
    })));
    const settings = useSettingsStore(state => state.settings);

    const phaseLabel = getNextPhaseLabel(currentPhase, pendingAction.type);

    // Handler for "Next" button - context-aware
    const handleNext = () => {
        // If there's a pending action requiring a response, respond to it
        switch (pendingAction.type) {
            case 'ask':
                // yes/no questions (e.g. mulligan) are answered with their own labeled buttons
                break;
            case 'priority':
                sendBoolean(false);
                break;
            case 'target':
            case 'select': {
                if (shouldCompleteSelectWithBooleanFalse(pendingAction)) {
                    sendBoolean(false);
                    break;
                }
                const min = typeof pendingAction.min === 'number' ? pendingAction.min : pendingAction.required ? 1 : 0;
                if (!pendingAction.required && min === 0) {
                    sendUUID(null);
                }
                break;
            }
            default:
                // No pending action - just pass priority
                sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
                break;
        }
    };

    const handleToggleSkip = () => {
        audioFeedbackService.playSkipCue(settings);
        onToggleSkip();
    };

    // Only show controls when we have priority or it's our turn
    if (!hasPriority && !isMyTurn) {
        return null;
    }

    return (
        <div className="arena-priority-controls" data-testid="arena-priority-controls">
            {/* Main "Next" Button */}
            <button
                className={`arena-next-button ${hasPriority ? 'has-priority' : ''}`}
                onClick={handleNext}
                disabled={!hasPriority}
                title="Pass Priority / Confirm (Space)"
                aria-label={`${phaseLabel}: pass priority or confirm`}
                data-testid="priority-next-button"
            >
                <span className="next-label">Next</span>
                <span className="next-phase">{phaseLabel}</span>
            </button>

            {/* Skip Toggle Button */}
            <button
                className={`arena-skip-toggle ${skipEnabled ? 'active' : ''}`}
                onClick={handleToggleSkip}
                title={skipEnabled ? 'Stop Auto-Pass (Click or ESC)' : 'Enable Auto-Pass'}
                aria-label={skipEnabled ? 'Stop auto-pass' : 'Enable auto-pass'}
                data-testid="priority-skip-toggle"
            >
                <FastForward className="skip-icon" size={16} aria-hidden="true" />
            </button>
        </div>
    );
});
