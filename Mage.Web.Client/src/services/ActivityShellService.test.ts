import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getActivityDestination,
    getActivityKindLabel,
    getUtilityActivityTitle,
    shouldShowFloatingActivityShell,
    type ActivityKind,
} from './ActivityShellService.js';
import { useActivityStore } from '../stores/activityStore.js';
import type { ClientCallback } from '../types/api.js';

test('routes playable game activities to the match screen', () => {
    assert.equal(getActivityDestination('game'), 'game');
    assert.equal(getActivityDestination('watch'), 'game');
});

test('routes callback activity kinds without game screens to the activity workspace', () => {
    const workspaceKinds: ActivityKind[] = [
        'construction',
        'draft',
        'replay',
        'sideboard',
        'tournament',
    ];

    for (const kind of workspaceKinds) {
        assert.equal(getActivityDestination(kind), 'activity-workspace', kind);
    }
});

test('routes utility activities to their owned shell destinations', () => {
    assert.equal(getActivityDestination('deck-manager'), 'deck-manager');
    assert.equal(getActivityDestination('deck-editor'), 'deck-editor');
    assert.equal(getActivityDestination('settings'), 'settings');
    assert.equal(getActivityDestination('debug'), 'debug');
    assert.equal(getActivityDestination('card-viewer'), 'activity-workspace');
});

test('provides concise labels and titles for activity chips', () => {
    assert.equal(getActivityKindLabel('tournament'), 'Event');
    assert.equal(getActivityKindLabel('card-viewer'), 'Cards');
    assert.equal(getUtilityActivityTitle('debug'), 'Debug tools');
    assert.equal(getUtilityActivityTitle('card-viewer'), 'Card viewer');
});

test('shows the floating activity shell for active match contexts', () => {
    assert.equal(shouldShowFloatingActivityShell({
        isAuthenticated: false,
        currentView: 'game',
        activities: [{ kind: 'game', status: 'active' }],
    }), false);

    assert.equal(shouldShowFloatingActivityShell({
        isAuthenticated: true,
        currentView: 'deck-manager',
        activities: [
            { kind: 'deck-manager', status: 'active' },
            { kind: 'card-viewer', status: 'active' },
            { kind: 'settings', status: 'active' },
        ],
    }), false);

    assert.equal(shouldShowFloatingActivityShell({
        isAuthenticated: true,
        currentView: 'activity',
        activities: [{ kind: 'card-viewer', status: 'active' }],
    }), false);

    assert.equal(shouldShowFloatingActivityShell({
        isAuthenticated: true,
        currentView: 'activity',
        activities: [{ kind: 'draft', status: 'waiting' }],
    }), true);

    assert.equal(shouldShowFloatingActivityShell({
        isAuthenticated: true,
        currentView: 'lobby',
        activities: [{ kind: 'game', status: 'active' }],
    }), true);

    assert.equal(shouldShowFloatingActivityShell({
        isAuthenticated: true,
        currentView: 'lobby',
        activities: [{ kind: 'settings', status: 'active' }],
    }), false);

    assert.equal(shouldShowFloatingActivityShell({
        isAuthenticated: true,
        currentView: 'game',
        activities: [],
    }), true);
});

test('activity store retains normalized sideboard deck payloads from callbacks', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const callback: ClientCallback = {
        method: 'sideboard',
        messageId: 42,
        objectId: '00000000-0000-0000-0000-000000000123',
        data: {
            currentTableId: '00000000-0000-0000-0000-000000000456',
            time: 90,
            deck: {
                name: 'Sideboard Payload',
                cards: {
                    '00000000-0000-0000-0000-000000000001': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                    '00000000-0000-0000-0000-000000000002': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                },
                sideboard: {
                    '00000000-0000-0000-0000-000000000003': {
                        name: 'Mountain',
                        expansionSetCode: 'M11',
                        cardNumber: '244',
                    },
                },
            },
        },
    };

    useActivityStore.getState().handleCallback(callback);

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'sideboard');
    assert.equal(useActivityStore.getState().activeActivityId, activity.id);
    assert.equal(activity.objectId, '00000000-0000-0000-0000-000000000456');
    assert.equal(activity.time, 90);
    assert.equal(activity.limitedSideboard, false);
    assert.deepEqual(activity.deck?.cards, [
        { amount: 2, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]);
    assert.deepEqual(activity.deck?.sideboard, [
        { amount: 1, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
    ]);
});

test('activity store keeps replay callback state for replay controls', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const gameId = '00000000-0000-0000-0000-000000000777';
    useActivityStore.getState().handleCallback({
        method: 'replayInit',
        messageId: 51,
        objectId: gameId,
        data: {
            players: [],
            myPlayerId: null,
            turn: 3,
            phase: 'COMBAT',
            step: 'DECLARE_ATTACKERS',
            activePlayerName: 'Alice',
            priorityPlayerName: 'Bob',
        },
    } as ClientCallback);

    let activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'replay');
    assert.equal(activity.status, 'active');
    assert.equal(activity.objectId, gameId);
    assert.equal(activity.replay?.state, 'ready');
    assert.equal(activity.replay?.turn, 3);
    assert.equal(activity.replay?.phase, 'COMBAT');
    assert.equal(activity.replay?.step, 'DECLARE_ATTACKERS');
    assert.equal(useActivityStore.getState().activeActivityId, activity.id);

    useActivityStore.getState().handleCallback({
        method: 'replayDone',
        messageId: 52,
        objectId: gameId,
        data: {},
    });

    activity = useActivityStore.getState().activities[0];
    assert.equal(activity.status, 'completed');
    assert.equal(activity.replay?.state, 'done');
    assert.equal(activity.replay?.message, 'Replay finished.');
});

test('activity store preserves limited sideboard callbacks from the Java flag bit', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const callback: ClientCallback = {
        method: 'sideboard',
        messageId: 47,
        objectId: '00000000-0000-0000-0000-000000000223',
        data: {
            currentTableId: '00000000-0000-0000-0000-000000000556',
            flag: true,
            time: 75,
            deck: {
                name: 'Limited Sideboard Payload',
                cards: {
                    '00000000-0000-0000-0000-000000000011': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                },
                sideboard: {},
            },
        },
    };

    useActivityStore.getState().handleCallback(callback);

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'sideboard');
    assert.equal(activity.title, 'Limited sideboarding');
    assert.equal(activity.objectId, '00000000-0000-0000-0000-000000000556');
    assert.equal(activity.limitedSideboard, true);
    assert.equal(activity.time, 75);
    assert.equal(activity.deck?.format, 'Limited');
});

test('activity store opens view limited deck callbacks as read-only deck activities', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const callback: ClientCallback = {
        method: 'viewLimitedDeck',
        messageId: 48,
        objectId: '00000000-0000-0000-0000-000000000323',
        data: {
            currentTableId: '00000000-0000-0000-0000-000000000656',
            deck: {
                name: 'Viewed Limited Deck',
                cards: {
                    '00000000-0000-0000-0000-000000000021': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                },
                sideboard: {
                    '00000000-0000-0000-0000-000000000022': {
                        name: 'Naturalize',
                        expansionSetCode: 'M11',
                        cardNumber: '190',
                    },
                },
            },
        },
    };

    useActivityStore.getState().handleCallback(callback);

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'card-viewer');
    assert.equal(activity.title, 'Viewed limited deck');
    assert.equal(activity.id, 'card-viewer:00000000-0000-0000-0000-000000000656');
    assert.equal(activity.objectId, '00000000-0000-0000-0000-000000000656');
    assert.equal(activity.lastCallbackMethod, 'viewLimitedDeck');
    assert.equal(useActivityStore.getState().activeActivityId, activity.id);
    assert.equal(activity.deck?.format, 'Limited');
    assert.deepEqual(activity.deck?.cards, [
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]);
    assert.deepEqual(activity.deck?.sideboard, [
        { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
    ]);
});

test('activity store opens viewed sideboards from current game player state', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const activity = useActivityStore.getState().openViewedSideboard({
        gameId: '00000000-0000-0000-0000-000000000757',
        playerId: '00000000-0000-0000-0000-000000000758',
        playerName: 'Sideboard Player',
        sideboard: {
            '00000000-0000-0000-0000-000000000031': {
                name: 'Naturalize',
                displayName: 'Naturalize',
                expansionSetCode: 'M11',
                cardNumber: '190',
            },
            '00000000-0000-0000-0000-000000000032': {
                name: 'Naturalize',
                displayName: 'Naturalize',
                expansionSetCode: 'M11',
                cardNumber: '190',
            },
            '00000000-0000-0000-0000-000000000033': {
                name: 'Forest',
                displayName: 'Forest',
                expansionSetCode: 'M11',
                cardNumber: '248',
            },
        } as any,
    });

    assert.ok(activity);
    assert.equal(activity.kind, 'card-viewer');
    assert.equal(activity.title, 'Viewed sideboard - Sideboard Player');
    assert.equal(activity.id, 'card-viewer:sideboard:00000000-0000-0000-0000-000000000758');
    assert.equal(activity.objectId, '00000000-0000-0000-0000-000000000757');
    assert.equal(activity.lastCallbackMethod, 'viewSideboard');
    assert.equal(useActivityStore.getState().activeActivityId, activity.id);
    assert.deepEqual(activity.deck?.cards, []);
    assert.deepEqual(activity.deck?.sideboard, [
        { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
        { amount: 1, cardName: 'Forest', setCode: 'M11', cardNumber: '248' },
    ]);
});

test('activity store retains normalized draft deck payloads from callbacks', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const callback: ClientCallback = {
        method: 'draftPick',
        messageId: 43,
        objectId: '00000000-0000-0000-0000-000000000789',
        data: {
            time: 45,
            deck: {
                name: 'Draft Picks',
                cards: {
                    '00000000-0000-0000-0000-000000000004': {
                        name: 'Llanowar Elves',
                        expansionSetCode: 'M12',
                        cardNumber: '182',
                    },
                },
                sideboard: {
                    '00000000-0000-0000-0000-000000000005': {
                        name: 'Naturalize',
                        expansionSetCode: 'M11',
                        cardNumber: '190',
                    },
                    '00000000-0000-0000-0000-000000000006': {
                        name: 'Naturalize',
                        expansionSetCode: 'M11',
                        cardNumber: '190',
                    },
                },
            },
        },
    };

    useActivityStore.getState().handleCallback(callback);

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'draft');
    assert.equal(activity.objectId, '00000000-0000-0000-0000-000000000789');
    assert.equal(activity.time, 45);
    assert.deepEqual(activity.deck?.cards, [
        { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
    ]);
    assert.deepEqual(activity.deck?.sideboard, [
        { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
    ]);
});

test('activity store derives draft deck payloads from live draft pick views', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const callback: ClientCallback = {
        method: 'draftPick',
        messageId: 44,
        objectId: '00000000-0000-0000-0000-000000000790',
        data: {
            draftPickView: {
                booster: {
                    '00000000-0000-0000-0000-000000000007': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                },
                picks: {
                    '00000000-0000-0000-0000-000000000008': {
                        name: 'Llanowar Elves',
                        expansionSetCode: 'M12',
                        cardNumber: '182',
                    },
                    '00000000-0000-0000-0000-000000000009': {
                        displayName: 'Llanowar Elves',
                        expansionSetCode: 'M12',
                        cardNumber: '182',
                    },
                },
                picking: false,
                timeout: 30,
            },
        },
    };

    useActivityStore.getState().handleCallback(callback);

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'draft');
    assert.equal(activity.time, 30);
    assert.equal(activity.draftPick?.picking, false);
    assert.deepEqual(activity.deck?.cards, [
        { amount: 2, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
    ]);
    assert.deepEqual(activity.deck?.sideboard, []);
});

test('activity store accumulates draft picks across incremental live pick payloads', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const draftId = '00000000-0000-0000-0000-000000000791';
    useActivityStore.getState().handleCallback({
        method: 'draftPick',
        messageId: 45,
        objectId: draftId,
        data: {
            draftPickView: {
                booster: {
                    '00000000-0000-0000-0000-000000000010': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                },
                picks: {
                    '00000000-0000-0000-0000-000000000011': {
                        name: 'Llanowar Elves',
                        expansionSetCode: 'M12',
                        cardNumber: '182',
                    },
                },
                picking: true,
                timeout: 40,
            },
        },
    });
    useActivityStore.getState().handleCallback({
        method: 'draftPick',
        messageId: 46,
        objectId: draftId,
        data: {
            draftPickView: {
                booster: {
                    '00000000-0000-0000-0000-000000000012': {
                        name: 'Cancel',
                        expansionSetCode: 'M11',
                        cardNumber: '49',
                    },
                },
                picks: {
                    '00000000-0000-0000-0000-000000000013': {
                        name: 'Naturalize',
                        expansionSetCode: 'M11',
                        cardNumber: '190',
                    },
                },
                picking: true,
                timeout: 39,
            },
        },
    });

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'draft');
    assert.equal(activity.time, 39);
    assert.deepEqual(activity.deck?.cards, [
        { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
        { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
    ]);
    assert.equal(Object.keys(activity.draftPick?.picks ?? {}).length, 2);
    assert.equal(Object.keys(activity.draftPick?.booster ?? {}).length, 1);
});

test('activity store accumulates draft picks from command responses', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const draftId = '00000000-0000-0000-0000-000000000792';
    useActivityStore.getState().updateDraftPick(draftId, {
        booster: {},
        picks: {
            '00000000-0000-0000-0000-000000000014': {
                name: 'Forest',
                expansionSetCode: 'M11',
                cardNumber: '249',
            },
        },
        picking: true,
        timeout: 38,
    });
    useActivityStore.getState().updateDraftPick(draftId, {
        booster: {},
        picks: {
            '00000000-0000-0000-0000-000000000015': {
                name: 'Forest',
                expansionSetCode: 'M11',
                cardNumber: '249',
            },
            '00000000-0000-0000-0000-000000000016': {
                name: 'Lightning Bolt',
                expansionSetCode: 'M11',
                cardNumber: '149',
            },
        },
        picking: true,
        timeout: 37,
    });

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.time, 37);
    assert.deepEqual(activity.deck?.cards, [
        { amount: 2, cardName: 'Forest', setCode: 'M11', cardNumber: '249' },
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]);
});

test('activity store preserves accumulated draft deck when the draft completes', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const draftId = '00000000-0000-0000-0000-000000000793';
    useActivityStore.getState().handleCallback({
        method: 'draftPick',
        messageId: 47,
        objectId: draftId,
        data: {
            draftPickView: {
                booster: {
                    '00000000-0000-0000-0000-000000000017': {
                        name: 'Cancel',
                        expansionSetCode: 'M11',
                        cardNumber: '49',
                    },
                },
                picks: {
                    '00000000-0000-0000-0000-000000000018': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                },
                picking: true,
                timeout: 12,
            },
        },
    });
    useActivityStore.getState().handleCallback({
        method: 'draftOver',
        messageId: 48,
        objectId: draftId,
        data: {},
    });

    const activity = useActivityStore.getState().activities[0];
    assert.equal(activity.kind, 'draft');
    assert.equal(activity.status, 'completed');
    assert.equal(activity.lastCallbackMethod, 'draftOver');
    assert.deepEqual(activity.deck?.cards, [
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]);
    assert.equal(Object.keys(activity.draftPick?.picks ?? {}).length, 1);
});

test('activity store carries completed draft picks into a thin construction callback', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const draftId = '00000000-0000-0000-0000-000000000794';
    const tableId = '00000000-0000-0000-0000-000000000795';
    useActivityStore.getState().handleCallback({
        method: 'draftPick',
        messageId: 49,
        objectId: draftId,
        data: {
            draftPickView: {
                booster: {},
                picks: {
                    '00000000-0000-0000-0000-000000000019': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                    '00000000-0000-0000-0000-000000000020': {
                        name: 'Llanowar Elves',
                        expansionSetCode: 'M12',
                        cardNumber: '182',
                    },
                },
                picking: false,
                timeout: 0,
            },
        },
    });
    useActivityStore.getState().handleCallback({
        method: 'draftOver',
        messageId: 50,
        objectId: draftId,
        data: {},
    });
    useActivityStore.getState().handleCallback({
        method: 'construct',
        messageId: 51,
        objectId: tableId,
        data: {
            currentTableId: tableId,
            time: 600,
            deck: {
                name: 'Construction Payload',
                cards: {},
                sideboard: {},
            },
        },
    });

    const construction = useActivityStore.getState().activities[0];
    const draft = useActivityStore.getState().activities[1];
    assert.equal(construction.kind, 'construction');
    assert.equal(construction.objectId, tableId);
    assert.equal(construction.time, 600);
    assert.equal(construction.deck?.name, 'Construction Payload');
    assert.equal(construction.deck?.format, 'Limited');
    assert.deepEqual(construction.deck?.cards, [
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 1, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
    ]);
    assert.equal(draft.kind, 'draft');
    assert.equal(draft.status, 'completed');
    assert.equal(useActivityStore.getState().activeActivityId, construction.id);
});

test('activity store treats live construction deck payloads without format as Limited', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const tableId = '00000000-0000-0000-0000-000000000798';
    useActivityStore.getState().handleCallback({
        method: 'construct',
        messageId: 55,
        objectId: tableId,
        data: {
            currentTableId: tableId,
            time: 600,
            deck: {
                name: 'Live Construction Payload',
                cards: {
                    '00000000-0000-0000-0000-000000000022': {
                        name: 'Lightning Bolt',
                        expansionSetCode: 'M11',
                        cardNumber: '149',
                    },
                },
                sideboard: {},
            },
        },
    });

    const construction = useActivityStore.getState().activities[0];
    assert.equal(construction.kind, 'construction');
    assert.equal(construction.deck?.name, 'Live Construction Payload');
    assert.equal(construction.deck?.format, 'Limited');
    assert.deepEqual(construction.deck?.cards, [
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    ]);
});

test('activity store carries completed draft picks into construction callbacks without deck shells', () => {
    useActivityStore.setState({ activities: [], activeActivityId: null });

    const draftId = '00000000-0000-0000-0000-000000000796';
    const tableId = '00000000-0000-0000-0000-000000000797';
    useActivityStore.getState().handleCallback({
        method: 'draftPick',
        messageId: 52,
        objectId: draftId,
        data: {
            draftPickView: {
                booster: {},
                picks: {
                    '00000000-0000-0000-0000-000000000021': {
                        name: 'Naturalize',
                        expansionSetCode: 'M11',
                        cardNumber: '190',
                    },
                },
                picking: false,
                timeout: 0,
            },
        },
    });
    useActivityStore.getState().handleCallback({
        method: 'draftOver',
        messageId: 53,
        objectId: draftId,
        data: {},
    });
    useActivityStore.getState().handleCallback({
        method: 'construct',
        messageId: 54,
        objectId: tableId,
        data: {
            currentTableId: tableId,
            time: 600,
        },
    });

    const construction = useActivityStore.getState().activities[0];
    assert.equal(construction.kind, 'construction');
    assert.equal(construction.deck?.name, 'Draft Picks');
    assert.deepEqual(construction.deck?.cards, [
        { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
    ]);
    assert.equal(useActivityStore.getState().activeActivityId, construction.id);
});
