import React, { useEffect } from 'react';
import { useGameStore } from '../../stores';
import { Button } from '../common';
import './FeedbackPanel.css';

export const FeedbackPanel: React.FC = () => {
    const {
        pendingAction,
        sendBoolean,
        sendInteger,
        sendPlayerAction
    } = useGameStore();

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
    }, [pendingAction, sendBoolean]);

    if (pendingAction.type === 'none') return null;

    const handleYes = () => sendBoolean(true);
    const handleNo = () => sendBoolean(false);

    // For manual priority passing (usually handled by F-keys or sidebar, but good to have context here)
    const handleOK = () => sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');

    // Specific rendering based on action type
    const renderActionContent = () => {
        switch (pendingAction.type) {
            case 'ask':
                return (
                    <div className="feedback-actions">
                        <Button variant="primary" onClick={handleYes}>Yes</Button>
                        <Button variant="secondary" onClick={handleNo}>No</Button>
                    </div>
                );

            case 'target':
            case 'select':
                return (
                    <div className="feedback-actions">
                        {/* Done button usually needed if multiple targets allowed, implies we are finished selecting */}
                        <Button variant="primary" onClick={() => sendBoolean(true)}>Done</Button>
                        <Button variant="ghost" onClick={() => sendBoolean(false)}>Cancel</Button>
                    </div>
                );

            case 'mana':
                return (
                    <div className="feedback-actions">
                        <Button variant="ghost" onClick={() => sendBoolean(false)}>Cancel</Button>
                    </div>
                );

            case 'chooseChoice':
                // Handled by distinct modal usually, but if simple choices:
                return (
                    <div className="feedback-actions">
                        {/* Placeholder - usually rendering choices as buttons */}
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Select an option...</div>
                    </div>
                );

            default:
                return null;
        }
    };

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
            {renderActionContent()}
        </div>
    );
};
