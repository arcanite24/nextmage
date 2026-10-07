import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useActivityStore, type ActivityKind, type ClientActivity } from '../../stores/activityStore';
import { getActivityKindLabel } from '../../services/ActivityShellService';
import './ActivitySwitcher.css';

type ActivityShellView = 'login' | 'lobby' | 'game' | 'deck-manager' | 'deck-editor' | 'settings' | 'activity';

interface ActivitySwitcherProps {
    currentView: ActivityShellView;
    currentGameId: string | null;
    onOpenLobby: () => void;
    onOpenDecks: () => void;
    onOpenSettings: () => void;
    onOpenGame: (gameId: string) => void;
    onOpenActivity: (activity: ClientActivity) => void;
}

interface ActivityGroup {
    key: string;
    label: string;
    activities: ClientActivity[];
}

const TABLE_ACTIVITY_KINDS = new Set<ActivityKind>([
    'game',
    'watch',
    'replay',
    'sideboard',
    'construction',
]);

function getStatusLabel(activity: ClientActivity): string {
    if (activity.status === 'completed') return 'Done';
    if (activity.status === 'waiting') return 'Waiting';
    return 'Active';
}

function shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) : id;
}

function groupActivities(activities: ClientActivity[]): ActivityGroup[] {
    const groups = new Map<string, ActivityGroup>();

    activities.forEach((activity) => {
        const key = activity.objectId ?? activity.id;
        const existing = groups.get(key);

        if (existing) {
            existing.activities.push(activity);
            return;
        }

        groups.set(key, {
            key,
            label: TABLE_ACTIVITY_KINDS.has(activity.kind) && activity.objectId
                ? `Table ${shortId(activity.objectId)}`
                : getActivityKindLabel(activity.kind),
            activities: [activity],
        });
    });

    return Array.from(groups.values());
}

export const ActivitySwitcher: React.FC<ActivitySwitcherProps> = ({
    currentView,
    currentGameId,
    onOpenLobby,
    onOpenDecks,
    onOpenSettings,
    onOpenGame,
    onOpenActivity,
}) => {
    const { activities, activeActivityId, setActiveActivity, clearCompleted } = useActivityStore(useShallow(state => ({
        activities: state.activities,
        activeActivityId: state.activeActivityId,
        setActiveActivity: state.setActiveActivity,
        clearCompleted: state.clearCompleted,
    })));

    const activityGroups = React.useMemo(() => groupActivities(activities), [activities]);
    const activeCount = activities.filter(activity => activity.status !== 'completed').length;
    const tableActivities = activities.filter(activity => TABLE_ACTIVITY_KINDS.has(activity.kind));
    const activeTableCount = tableActivities.filter(activity => activity.status !== 'completed').length;
    const completedCount = activities.length - activeCount;
    const currentDeckView = currentView === 'deck-manager' || currentView === 'deck-editor';

    const openActivity = React.useCallback((activity: ClientActivity) => {
        setActiveActivity(activity.id);

        if ((activity.kind === 'game' || activity.kind === 'watch') && activity.objectId) {
            onOpenGame(activity.objectId);
            return;
        }

        onOpenActivity(activity);
    }, [onOpenActivity, onOpenGame, setActiveActivity]);

    return (
        <nav
            className={`activity-switcher ${currentView === 'game' ? 'activity-switcher-game' : ''}`}
            aria-label="Activity switcher"
        >
            <div className="activity-shell-tabs" role="group" aria-label="Main views">
                <button
                    type="button"
                    className={`activity-shell-tab ${currentView === 'lobby' ? 'active' : ''}`}
                    onClick={onOpenLobby}
                    aria-pressed={currentView === 'lobby'}
                >
                    Lobby
                </button>
                <button
                    type="button"
                    className={`activity-shell-tab ${currentDeckView ? 'active' : ''}`}
                    onClick={onOpenDecks}
                    aria-pressed={currentDeckView}
                >
                    Decks
                </button>
                <button
                    type="button"
                    className={`activity-shell-tab ${currentView === 'settings' ? 'active' : ''}`}
                    onClick={onOpenSettings}
                    aria-pressed={currentView === 'settings'}
                >
                    Settings
                </button>
            </div>

            <div className="activity-counts" aria-label={`${activeTableCount} active tables out of ${tableActivities.length} total tracked tables`}>
                <span>Tables {activeTableCount}/{tableActivities.length}</span>
                <span>Active {activeCount}</span>
            </div>

            <div className="activity-groups" aria-label="Tracked game activities">
                {activityGroups.length === 0 ? (
                    <span className="activity-empty">No active tables</span>
                ) : (
                    activityGroups.map(group => (
                        <div className="activity-group" key={group.key}>
                            {(group.activities.length > 1 || TABLE_ACTIVITY_KINDS.has(group.activities[0].kind)) && (
                                <span className="activity-group-label">{group.label}</span>
                            )}
                            <div className="activity-group-chips">
                                {group.activities.map(activity => {
                                    const isActive = activeActivityId === activity.id || (
                                        currentView === 'game' &&
                                        activity.objectId === currentGameId &&
                                        (activity.kind === 'game' || activity.kind === 'watch' || activity.kind === 'replay')
                                    );

                                    return (
                                        <button
                                            type="button"
                                            key={activity.id}
                                            className={`activity-chip activity-chip-${activity.status} ${isActive ? 'active' : ''}`}
                                            onClick={() => openActivity(activity)}
                                            aria-pressed={isActive}
                                            title={`${activity.title} - ${getStatusLabel(activity)}`}
                                            data-testid="activity-chip"
                                            data-activity-kind={activity.kind}
                                            data-activity-status={activity.status}
                                            data-activity-id={activity.id}
                                            data-activity-object-id={activity.objectId ?? 'none'}
                                            data-activity-last-callback={activity.lastCallbackMethod}
                                        >
                                            <span className="activity-chip-kind">{getActivityKindLabel(activity.kind)}</span>
                                            <span className="activity-chip-title">{activity.title}</span>
                                            <span className="activity-chip-status">{getStatusLabel(activity)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {completedCount > 0 && (
                <button
                    type="button"
                    className="activity-clear"
                    onClick={clearCompleted}
                    aria-label={`Clear ${completedCount} completed activities`}
                >
                    Clear done
                </button>
            )}
        </nav>
    );
};
