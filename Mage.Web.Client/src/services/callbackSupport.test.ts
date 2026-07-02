import assert from 'node:assert/strict';
import test from 'node:test';
import {
    JAVA_CALLBACK_METHODS,
    createCallbackOrderingGuard,
    getCallbackDeliveryType,
    getCallbackRouteTargets,
    normalizeCallback,
    normalizeCallbackMethod,
} from './callbackSupport.js';
import type { ClientCallback } from '../types/api.js';

function callback(method: string, messageId: number, data: unknown = {}): ClientCallback {
    return {
        method: method as ClientCallback['method'],
        messageId,
        objectId: '00000000-0000-0000-0000-000000000000',
        data,
    };
}

test('normalizes Java enum names and wire-code aliases', () => {
    assert.equal(normalizeCallbackMethod('START_GAME'), 'startGame');
    assert.equal(normalizeCallbackMethod('CHATMESSAGE'), 'chatMessage');
    assert.equal(normalizeCallbackMethod('SHOW_USERMESSAGE'), 'showUserMessage');
    assert.equal(normalizeCallbackMethod('WATCHGAME'), 'watchGame');
    assert.equal(normalizeCallbackMethod('SIDEBOARD'), 'sideboard');
    assert.equal(normalizeCallbackMethod('sideboard'), 'sideboard');
});

test('normalizes Java callback names that differ from current store names', () => {
    assert.equal(normalizeCallbackMethod('GAME_UPDATE_AND_INFORM'), 'gameUpdateAndInform');
    assert.equal(normalizeCallbackMethod('gameInform'), 'gameUpdateAndInform');
    assert.equal(normalizeCallbackMethod('GAME_GET_AMOUNT'), 'gameGetAmount');
    assert.equal(normalizeCallbackMethod('gameSelectAmount'), 'gameGetAmount');
    assert.equal(normalizeCallbackMethod('GAME_GET_MULTI_AMOUNT'), 'gameGetMultiAmount');
    assert.equal(normalizeCallbackMethod('gameSelectMultiAmount'), 'gameGetMultiAmount');
});

test('covers every Java callback method with a delivery type and a route target', () => {
    for (const method of JAVA_CALLBACK_METHODS) {
        const normalizedMethod = normalizeCallbackMethod(method);

        assert.notEqual(
            getCallbackDeliveryType(normalizedMethod),
            'UNKNOWN',
            `${method} (${normalizedMethod}) should have a delivery type`
        );
        assert.notDeepEqual(
            getCallbackRouteTargets(normalizedMethod),
            [],
            `${method} (${normalizedMethod}) should have a route target`
        );
    }
});

test('routes lifecycle callbacks to the activity foundation', () => {
    assert.deepEqual(getCallbackRouteTargets('START_GAME'), ['game', 'activity']);
    assert.deepEqual(getCallbackRouteTargets('GAME_INIT'), ['game', 'activity']);
    assert.deepEqual(getCallbackRouteTargets('SIDEBOARD'), ['game', 'activity']);
    assert.deepEqual(getCallbackRouteTargets('REPLAY_INIT'), ['activity']);
    assert.deepEqual(getCallbackRouteTargets('DRAFT_UPDATE'), ['activity']);
    assert.deepEqual(getCallbackRouteTargets('TOURNAMENT_OVER'), ['activity']);
});

test('ignores stale update callbacks after a later synced callback', () => {
    const guard = createCallbackOrderingGuard();

    assert.equal(guard.evaluate(callback('START_GAME', 10)).shouldProcess, true);

    const staleUpdate = guard.evaluate(callback('GAME_UPDATE', 9));
    assert.equal(staleUpdate.shouldProcess, false);
    assert.equal(staleUpdate.reason, 'ignored-outdated-update');
});

test('still processes stale message and dialog callbacks like the Java client', () => {
    const guard = createCallbackOrderingGuard();

    assert.equal(guard.evaluate(callback('START_GAME', 10)).shouldProcess, true);

    const staleMessage = guard.evaluate(callback('GAME_ERROR', 8, 'late error'));
    assert.equal(staleMessage.shouldProcess, true);
    assert.equal(staleMessage.reason, 'accepted-out-of-order');

    const staleDialog = guard.evaluate(callback('GAME_ASK', 7, { message: 'late prompt' }));
    assert.equal(staleDialog.shouldProcess, true);
    assert.equal(staleDialog.reason, 'accepted-out-of-order');
});

test('normalizes callbacks before returning ordering decisions', () => {
    const guard = createCallbackOrderingGuard();
    const decision = guard.evaluate(callback('gameInform', 1, { gameView: { turn: 1 }, message: 'Priority' }));

    assert.equal(decision.shouldProcess, true);
    assert.equal(decision.callback.method, 'gameUpdateAndInform');
    assert.equal(normalizeCallback(callback('WATCHGAME', 2)).method, 'watchGame');
});
