export type ActivityKind =
    | 'game'
    | 'watch'
    | 'replay'
    | 'draft'
    | 'tournament'
    | 'sideboard'
    | 'construction'
    | 'deck-manager'
    | 'deck-editor'
    | 'card-viewer'
    | 'settings'
    | 'debug';

export type ActivityDestination =
    | 'activity-workspace'
    | 'deck-editor'
    | 'deck-manager'
    | 'debug'
    | 'game'
    | 'settings';

const FLOATING_ACTIVITY_KINDS = new Set<ActivityKind>([
    'game',
    'watch',
    'replay',
    'draft',
    'tournament',
    'sideboard',
    'construction',
]);

interface FloatingActivityShellInput {
    isAuthenticated: boolean;
    currentView: string;
    activities: readonly {
        kind: ActivityKind;
        status?: string;
    }[];
}

export function shouldShowFloatingActivityShell({
    isAuthenticated,
    currentView,
    activities,
}: FloatingActivityShellInput): boolean {
    if (!isAuthenticated || currentView === 'login') return false;
    if (currentView === 'game') return true;

    const hasActiveMatchActivity = activities.some(activity =>
        activity.status !== 'completed' &&
        FLOATING_ACTIVITY_KINDS.has(activity.kind)
    );

    if (currentView === 'lobby') return hasActiveMatchActivity;
    if (currentView !== 'activity') return false;

    return hasActiveMatchActivity;
}

export function getActivityDestination(kind: ActivityKind): ActivityDestination {
    switch (kind) {
        case 'game':
        case 'watch':
            return 'game';
        case 'deck-manager':
            return 'deck-manager';
        case 'deck-editor':
            return 'deck-editor';
        case 'settings':
            return 'settings';
        case 'debug':
            return 'debug';
        case 'card-viewer':
        case 'construction':
        case 'draft':
        case 'replay':
        case 'sideboard':
        case 'tournament':
            return 'activity-workspace';
    }
}

export function getActivityKindLabel(kind: ActivityKind): string {
    switch (kind) {
        case 'game':
            return 'Game';
        case 'watch':
            return 'Watch';
        case 'replay':
            return 'Replay';
        case 'draft':
            return 'Draft';
        case 'tournament':
            return 'Event';
        case 'sideboard':
            return 'Sideboard';
        case 'construction':
            return 'Build';
        case 'deck-manager':
            return 'Decks';
        case 'deck-editor':
            return 'Editor';
        case 'card-viewer':
            return 'Cards';
        case 'settings':
            return 'Settings';
        case 'debug':
            return 'Debug';
    }
}

export function getUtilityActivityTitle(kind: ActivityKind): string {
    switch (kind) {
        case 'deck-manager':
            return 'Deck manager';
        case 'deck-editor':
            return 'Deck editor';
        case 'card-viewer':
            return 'Card viewer';
        case 'settings':
            return 'Settings';
        case 'debug':
            return 'Debug tools';
        default:
            return getActivityKindLabel(kind);
    }
}
