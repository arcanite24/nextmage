import React, { useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../stores';
import { Button } from '../common';
import './FeedbackPanel.css';

export const FeedbackPanel: React.FC = React.memo(() => {
    const {
        pendingAction,
        sendBoolean
    } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        sendBoolean: state.sendBoolean
    })));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (pendingAction.type === 'none') return;

            // Bind SPACE to "Done" / Confirm
            // We only want to trigger this for types where "Done" or positive confirmation is relevant
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling

                // For target/select, SPACE = Done (sendBoolean(true))
                if (pendingAction.type === 'target' || pendingAction.type === 'select') {
                    sendBoolean(true);
                }
                // We could optionally allow SPACE for "Yes" in 'ask', but user specifically said "Done" button.
                // But usually SPACE is generally "OK".
                else if (pendingAction.type === 'ask') {
                    // Interpreting SPACE as YES for 'ask' is common, but let's stick to "Done" context mostly.
                    // However, if the user means the primary positive action, this is it.
                    // safely enable for now.
                    sendBoolean(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pendingAction.type, sendBoolean]);

    // Handlers must be defined before any conditional returns (Rules of Hooks)
    const handleYes = useCallback(() => sendBoolean(true), [sendBoolean]);
    const handleNo = useCallback(() => sendBoolean(false), [sendBoolean]);
    const handleCancel = useCallback(() => sendBoolean(false), [sendBoolean]);

    // Only show FeedbackPanel for specific action types that need explicit UI
    // target/select are now handled by the Arena "Next" button, so we hide the panel for those
    const shouldShow = useMemo(() => {
        const showableTypes = ['ask', 'mana'];
        return pendingAction.type !== 'none' && showableTypes.includes(pendingAction.type);
    }, [pendingAction.type]);

    // Specific rendering based on action type
    const renderActionContent = useMemo(() => {
        switch (pendingAction.type) {
            case 'ask':
                return (
                    <div className="feedback-actions">
                        <Button variant="primary" onClick={handleYes}>Yes</Button>
                        <Button variant="secondary" onClick={handleNo}>No</Button>
                    </div>
                );

            case 'mana':
                return (
                    <div className="feedback-actions">
                        <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                    </div>
                );

            default:
                return null;
        }
    }, [pendingAction.type, handleYes, handleNo, handleCancel]);

    // Early return after all hooks have been called
    if (!shouldShow) {
        return null;
    }

    return (
        <div className="feedback-panel">
            <div className="feedback-message"
                dangerouslySetInnerHTML={{
                    __html: ((pendingAction as any).message || "Waiting for input...")
                        // Simple cleanup if needed, but <font> tags usually work in browsers
                        // If we wanted to modernize:
                        .replace(/<font color=(.*?)>(.*?)<\/font>/g, '<span style="color:$1">$2</span>')
                }}
            />
            {renderActionContent}
        </div>
    );
});
