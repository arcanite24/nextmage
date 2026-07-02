import React from 'react';
import { useNotificationStore, type ClientNotification } from '../../stores/notificationStore';
import { sanitizeServerHtml } from '../../services/ServerHtmlService';
import './NotificationToastHost.css';

const MAX_VISIBLE_NOTIFICATIONS = 3;

function iconFor(notification: ClientNotification): string {
    switch (notification.kind) {
        case 'connection':
            return notification.tone === 'danger' ? '!' : '~';
        case 'draft':
            return 'D';
        case 'game':
            return 'G';
        case 'message':
            return 'M';
        case 'replay':
            return 'R';
        case 'tournament':
            return 'T';
    }
}

export const NotificationToastHost: React.FC = () => {
    const notifications = useNotificationStore(state => state.notifications);
    const dismiss = useNotificationStore(state => state.dismiss);

    React.useEffect(() => {
        const timers = notifications
            .map(notification => window.setTimeout(
                () => dismiss(notification.id),
                Math.max(0, notification.dismissAt - Date.now())
            ));

        return () => timers.forEach(timer => window.clearTimeout(timer));
    }, [dismiss, notifications]);

    if (notifications.length === 0) return null;

    return (
        <section className="notification-toasts" aria-live="polite" aria-label="Notifications">
            {notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS).map(notification => (
                <article
                    key={notification.id}
                    className={`notification-toast notification-toast-${notification.tone}`}
                    role={notification.tone === 'danger' ? 'alert' : 'status'}
                >
                    <div className="notification-toast-icon" aria-hidden="true">
                        {iconFor(notification)}
                    </div>
                    <div className="notification-toast-content">
                        <h3>{notification.title}</h3>
                        <div
                            className="notification-toast-message"
                            dangerouslySetInnerHTML={{ __html: sanitizeServerHtml(notification.message) }}
                        />
                    </div>
                    <button
                        type="button"
                        className="notification-toast-dismiss"
                        onClick={() => dismiss(notification.id)}
                        aria-label={`Dismiss ${notification.title}`}
                    >
                        x
                    </button>
                </article>
            ))}
        </section>
    );
};
