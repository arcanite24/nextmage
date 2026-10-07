import React, { useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../stores';
import { shouldCompleteSelectWithBooleanFalse } from '../../services/BattlefieldPerformanceService';
import { Button } from '../common';
import './FeedbackPanel.css';

function getOptionText(options: Record<string, any> | undefined, keys: string[], fallback: string): string {
    for (const key of keys) {
        const value = options?.[key];
        if (typeof value === 'string') {
            return value;
        }
    }
    return fallback;
}

export const FeedbackPanel: React.FC = React.memo(() => {
    const {
        pendingAction,
        sendBoolean,
        sendUUID,
        sendPlayerAction,
    } = useGameStore(useShallow(state => ({
        pendingAction: state.pendingAction,
        sendBoolean: state.sendBoolean,
        sendUUID: state.sendUUID,
        sendPlayerAction: state.sendPlayerAction,
    })));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (pendingAction.type === 'none') return;

            // Bind SPACE to "Done" / Confirm
            // We only want to trigger this for types where "Done" or positive confirmation is relevant
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling

                if (pendingAction.type === 'priority') {
                    sendBoolean(false);
                } else if (pendingAction.type === 'target' || pendingAction.type === 'select') {
                    if (shouldCompleteSelectWithBooleanFalse(pendingAction)) {
                        sendBoolean(false);
                        return;
                    }
                    const min = typeof pendingAction.min === 'number' ? pendingAction.min : pendingAction.required ? 1 : 0;
                    if (!pendingAction.required && min === 0) {
                        sendUUID(null);
                    }
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
    }, [pendingAction, sendBoolean, sendUUID]);

    // Handlers must be defined before any conditional returns (Rules of Hooks)
    const handleYes = useCallback(() => sendBoolean(true), [sendBoolean]);
    const handleNo = useCallback(() => sendBoolean(false), [sendBoolean]);
    const handleCancel = useCallback(() => sendBoolean(false), [sendBoolean]);
    const handleDoneSelecting = useCallback(() => {
        if (shouldCompleteSelectWithBooleanFalse(pendingAction)) {
            sendBoolean(false);
            return;
        }
        sendUUID(null);
    }, [pendingAction, sendBoolean, sendUUID]);
    const handleDonePriority = useCallback(() => sendBoolean(false), [sendBoolean]);
    const autoAnswerPayload = useMemo(() => {
        if (pendingAction.type !== 'ask') return null;
        const options = pendingAction.options ?? {};
        const originalId = typeof options.originalId === 'string' ? options.originalId : null;
        const message = typeof options.autoAnswerMessage === 'string' && options.autoAnswerMessage.trim()
            ? options.autoAnswerMessage.trim()
            : pendingAction.message.replace(/<[^>]+>/g, '').trim();

        if (!message) return null;

        return {
            text: message,
            idText: originalId ? `${originalId}#${message}` : null,
        };
    }, [pendingAction]);
    const createAutoAnswer = useCallback(async (
        action: 'REQUEST_AUTO_ANSWER_ID_YES' | 'REQUEST_AUTO_ANSWER_ID_NO' | 'REQUEST_AUTO_ANSWER_TEXT_YES' | 'REQUEST_AUTO_ANSWER_TEXT_NO',
        answer: boolean,
        payload: string,
    ) => {
        await sendPlayerAction(action, payload);
        await sendBoolean(answer);
    }, [sendBoolean, sendPlayerAction]);

    // Only show FeedbackPanel for specific action types that need explicit UI
    const shouldShow = useMemo(() => {
        const showableTypes = ['ask', 'priority', 'mana', 'target', 'select'];
        return pendingAction.type !== 'none' && showableTypes.includes(pendingAction.type);
    }, [pendingAction.type]);

    // Specific rendering based on action type
    const renderActionContent = useMemo(() => {
        switch (pendingAction.type) {
            case 'ask': {
                const yesText = getOptionText(pendingAction.options, ['UI.left.btn.text', 'leftButtonText'], 'Yes');
                const noText = getOptionText(pendingAction.options, ['UI.right.btn.text', 'rightButtonText'], 'No');
                return (
                    <>
                        <div className="feedback-actions">
                            {yesText && <Button variant="primary" onClick={handleYes}>{yesText}</Button>}
                            {noText && <Button variant="secondary" onClick={handleNo}>{noText}</Button>}
                        </div>
                        {autoAnswerPayload && (
                            <div className="feedback-auto-answer" data-testid="feedback-auto-answer-controls">
                                {autoAnswerPayload.idText && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => createAutoAnswer('REQUEST_AUTO_ANSWER_ID_YES', true, autoAnswerPayload.idText!)}
                                            data-testid="feedback-auto-answer-id-yes"
                                        >
                                            Always Yes: same ability
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => createAutoAnswer('REQUEST_AUTO_ANSWER_ID_NO', false, autoAnswerPayload.idText!)}
                                            data-testid="feedback-auto-answer-id-no"
                                        >
                                            Always No: same ability
                                        </button>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => createAutoAnswer('REQUEST_AUTO_ANSWER_TEXT_YES', true, autoAnswerPayload.text)}
                                    data-testid="feedback-auto-answer-text-yes"
                                >
                                    Always Yes: same text
                                </button>
                                <button
                                    type="button"
                                    onClick={() => createAutoAnswer('REQUEST_AUTO_ANSWER_TEXT_NO', false, autoAnswerPayload.text)}
                                    data-testid="feedback-auto-answer-text-no"
                                >
                                    Always No: same text
                                </button>
                            </div>
                        )}
                    </>
                );
            }

            case 'priority': {
                const passText = getOptionText(pendingAction.options, ['UI.right.btn.text', 'rightButtonText'], 'Done');
                const playText = getOptionText(pendingAction.options, ['UI.left.btn.text', 'leftButtonText'], '');
                return (
                    <div className="feedback-actions">
                        {playText && <Button variant="primary" onClick={handleYes}>{playText}</Button>}
                        {passText && <Button variant={playText ? 'secondary' : 'primary'} onClick={handleDonePriority}>{passText}</Button>}
                    </div>
                );
            }

            case 'mana':
                return (
                    <div className="feedback-actions">
                        <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                    </div>
                );

            case 'target':
            case 'select': {
                // For target/select, show Done/Cancel based on whether selection is required
                const actionData = pendingAction as any;
                const isRequired = actionData.required;
                const minSelections = typeof actionData.min === 'number' ? actionData.min : isRequired ? 1 : 0;
                const canFinishWithoutChoice = !isRequired && minSelections === 0;
                return (
                    <div className="feedback-actions">
                        {canFinishWithoutChoice ? (
                            <Button variant="primary" onClick={handleDoneSelecting}>Done</Button>
                        ) : (
                            <span className="feedback-required-note">Select a valid target to continue</span>
                        )}
                        {canFinishWithoutChoice && (
                            <Button variant="ghost" onClick={handleDoneSelecting}>Cancel</Button>
                        )}
                    </div>
                );
            }

            default:
                return null;
        }
    }, [pendingAction, handleYes, handleNo, handleCancel, handleDoneSelecting, handleDonePriority, autoAnswerPayload, createAutoAnswer]);

    // Early return after all hooks have been called
    if (!shouldShow) {
        return null;
    }

    return (
        <div className="feedback-panel" data-testid="game-feedback-panel">
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
