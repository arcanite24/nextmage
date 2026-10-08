import React from 'react';
import { useDebugStore, useNotificationStore, useSessionStore } from '../../stores';
import { Button } from './Button';
import { Modal } from './Modal';
import './SupportMenu.css';

type SupportDialog = 'about' | 'whats-new' | 'feedback' | 'resources' | null;

interface SupportMenuProps {
    placement?: 'fixed' | 'inline';
    onOpenCardViewer: () => void;
    onOpenDebug: () => void;
    onOpenSettings: () => void;
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0';
const FEEDBACK_TYPES = [
    'Bug or something does not work',
    'Idea or feature request',
    'UI feedback',
    'Rules or gameplay issue',
    'Other',
];

export const SupportMenu: React.FC<SupportMenuProps> = ({
    placement = 'fixed',
    onOpenCardViewer,
    onOpenDebug,
    onOpenSettings,
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [dialog, setDialog] = React.useState<SupportDialog>(null);
    const [feedbackTitle, setFeedbackTitle] = React.useState('');
    const [feedbackType, setFeedbackType] = React.useState(FEEDBACK_TYPES[0]);
    const [feedbackEmail, setFeedbackEmail] = React.useState('');
    const [feedbackMessage, setFeedbackMessage] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement | null>(null);

    const serverUrl = useSessionStore(state => state.serverUrl);
    const connectionStatus = useSessionStore(state => state.connectionStatus);
    const userName = useSessionStore(state => state.userName);
    const sessionId = useSessionStore(state => state.sessionId);
    const restoreSession = useSessionStore(state => state.restoreSession);
    const sendFeedback = useSessionStore(state => state.sendFeedback);
    const showAlert = useSessionStore(state => state.showAlert);
    const debugEnabled = useDebugStore(state => state.config.enabled);
    const toggleDebugMode = useDebugStore(state => state.toggleDebugMode);
    const callbackFixtureCount = useDebugStore(state => state.callbackFixtures.length);
    const actionCount = useDebugStore(state => state.actions.length);
    const browserPermission = useNotificationStore(state => state.browserPermission);
    const requestBrowserPermission = useNotificationStore(state => state.requestBrowserPermission);

    React.useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen]);

    const openDialog = (nextDialog: SupportDialog) => {
        setDialog(nextDialog);
        setIsOpen(false);
    };

    const handleReconnect = async () => {
        setIsOpen(false);

        if (connectionStatus === 'connected') {
            showAlert('Reconnect', 'You are already connected.');
            return;
        }

        const restored = await restoreSession();
        showAlert(
            restored ? 'Reconnect complete' : 'Reconnect failed',
            restored
                ? 'Your session was restored successfully.'
                : 'The session could not be restored. Return to login if the server requires a fresh password.'
        );
    };

    const handleOpenDebug = () => {
        setIsOpen(false);
        if (!debugEnabled) {
            toggleDebugMode();
        }
        onOpenDebug();
    };

    const handleOpenCardViewer = () => {
        setIsOpen(false);
        onOpenCardViewer();
    };

    const handleCopyDiagnostics = async () => {
        const diagnostics = [
            `Mage Web Client ${APP_VERSION}`,
            `User: ${userName ?? 'unknown'}`,
            `Server: ${serverUrl}`,
            `Connection: ${connectionStatus}`,
            `Session: ${sessionId}`,
            `Callback fixtures: ${callbackFixtureCount}`,
            `Debug actions: ${actionCount}`,
        ].join('\n');

        try {
            await navigator.clipboard.writeText(diagnostics);
            showAlert('Diagnostics copied', 'Connection and debug diagnostics were copied to the clipboard.');
        } catch (error) {
            console.error('Failed to copy diagnostics:', error);
            showAlert('Diagnostics', 'Unable to copy diagnostics. Check browser clipboard permissions.');
        } finally {
            setIsOpen(false);
        }
    };

    const handleEnableNotifications = async () => {
        setIsOpen(false);
        const permission = await requestBrowserPermission();

        if (permission === 'granted') {
            showAlert('Notifications enabled', 'Browser notifications will appear when Mage needs attention and the tab is not focused.');
        } else if (permission === 'denied') {
            showAlert('Notifications blocked', 'Browser notifications are blocked for this site. Use your browser site settings to allow them.');
        } else if (permission === 'unsupported') {
            showAlert('Notifications unavailable', 'This browser does not support desktop notifications.');
        } else {
            showAlert('Notifications', 'Browser notification permission was not granted. In-app notifications will still appear.');
        }
    };

    const handleSubmitFeedback = async (event: React.FormEvent) => {
        event.preventDefault();

        if (connectionStatus !== 'connected') {
            showAlert('Feedback', 'You may send feedback only when connected to a server.');
            return;
        }

        if (!feedbackTitle.trim() || !feedbackMessage.trim()) {
            showAlert('Feedback', 'Add a title and message before sending feedback.');
            return;
        }

        setIsSubmitting(true);
        try {
            const sent = await sendFeedback(
                feedbackTitle.trim(),
                feedbackType,
                feedbackMessage.trim().slice(0, 300),
                feedbackEmail.trim()
            );

            if (sent) {
                setFeedbackTitle('');
                setFeedbackMessage('');
                setFeedbackEmail('');
                setDialog(null);
                showAlert('Feedback sent', 'Feedback was sent. Thank you.');
            } else {
                showAlert('Feedback', 'Feedback could not be sent. Check the server connection and try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className={`support-menu support-menu-${placement}`} ref={menuRef}>
                <button
                    type="button"
                    className="support-menu-trigger"
                    onClick={() => setIsOpen(open => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    title="Support and advanced tools"
                >
                    <span aria-hidden="true">?</span>
                    <span>Support</span>
                </button>

                {isOpen && (
                    <div className="support-menu-popover" role="menu" aria-label="Support and advanced tools">
                        <button type="button" role="menuitem" onClick={() => openDialog('about')}>
                            About
                        </button>
                        <button type="button" role="menuitem" onClick={() => openDialog('whats-new')}>
                            What's New
                        </button>
                        <button type="button" role="menuitem" onClick={() => openDialog('feedback')}>
                            Send Feedback
                        </button>
                        <button type="button" role="menuitem" onClick={() => openDialog('resources')}>
                            Resources
                        </button>
                        <button type="button" role="menuitem" onClick={handleOpenCardViewer}>
                            Card Viewer
                        </button>
                        <button type="button" role="menuitem" onClick={handleReconnect}>
                            Reconnect
                        </button>
                        <button type="button" role="menuitem" onClick={() => void handleEnableNotifications()}>
                            {browserPermission === 'granted' ? 'Notifications Enabled' : 'Enable Notifications'}
                        </button>
                        <div className="support-menu-divider" />
                        <button type="button" role="menuitem" onClick={handleOpenDebug}>
                            Debug Tools
                        </button>
                        <button type="button" role="menuitem" onClick={() => void handleCopyDiagnostics()}>
                            Copy Diagnostics
                        </button>
                    </div>
                )}
            </div>

            <Modal isOpen={dialog === 'about'} onClose={() => setDialog(null)} title="About Mage Web Client">
                <div className="support-dialog">
                    <dl className="support-facts">
                        <div>
                            <dt>Version</dt>
                            <dd>{APP_VERSION}</dd>
                        </div>
                        <div>
                            <dt>User</dt>
                            <dd>{userName ?? 'Unknown'}</dd>
                        </div>
                        <div>
                            <dt>Server</dt>
                            <dd>{serverUrl}</dd>
                        </div>
                        <div>
                            <dt>Connection</dt>
                            <dd>{connectionStatus}</dd>
                        </div>
                    </dl>
                </div>
            </Modal>

            <Modal isOpen={dialog === 'whats-new'} onClose={() => setDialog(null)} title="What's New">
                <div className="support-dialog">
                    <ul className="support-list">
                        <li>Java callback names now normalize across enum names, wire codes, and legacy aliases.</li>
                        <li>Callback fixtures and model parity fixtures can be exported for regression reports.</li>
                        <li>The activity switcher keeps matches reachable while you return to lobby, decks, or settings.</li>
                        <li>Server and local confirmations use the same request modal surface.</li>
                    </ul>
                </div>
            </Modal>

            <Modal isOpen={dialog === 'feedback'} onClose={() => setDialog(null)} title="Feedback" size="lg">
                <form className="support-feedback-form" onSubmit={handleSubmitFeedback}>
                    <label>
                        <span>Title</span>
                        <input
                            className="input"
                            value={feedbackTitle}
                            onChange={event => setFeedbackTitle(event.target.value)}
                            maxLength={80}
                            required
                        />
                    </label>

                    <label>
                        <span>Type</span>
                        <select
                            className="input"
                            value={feedbackType}
                            onChange={event => setFeedbackType(event.target.value)}
                        >
                            {FEEDBACK_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span>Email</span>
                        <input
                            className="input"
                            type="email"
                            value={feedbackEmail}
                            onChange={event => setFeedbackEmail(event.target.value)}
                            placeholder="Optional"
                        />
                    </label>

                    <label>
                        <span>Message</span>
                        <textarea
                            className="input support-feedback-message"
                            value={feedbackMessage}
                            onChange={event => setFeedbackMessage(event.target.value)}
                            maxLength={300}
                            required
                        />
                    </label>

                    <div className="support-feedback-footer">
                        <span>{feedbackMessage.length}/300</span>
                        <Button type="submit" disabled={isSubmitting || connectionStatus !== 'connected'} isLoading={isSubmitting}>
                            Send
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={dialog === 'resources'} onClose={() => setDialog(null)} title="Resources">
                <div className="support-dialog">
                    <p>
                        Card images and symbols load through browser caching instead of a desktop download pack.
                        Use settings for source language, fallback mode, cache size and age limits, trimming, clearing,
                        and missing-image diagnostics.
                    </p>
                    <div className="support-actions">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setDialog(null);
                                onOpenSettings();
                            }}
                        >
                            Open Settings
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setDialog(null);
                                showAlert('Resources', 'Desktop symbol downloads are replaced by bundled web symbol assets. Desktop card-image downloads are replaced by Scryfall image loading into the browser cache with visible-card preload, progress, cancel, and cache diagnostics in the card viewer and settings.');
                            }}
                        >
                            Resource Info
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
