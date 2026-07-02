import assert from 'node:assert/strict';
import test from 'node:test';
import { CallbackFixtureService } from './CallbackFixtureService.js';
import type { ClientCallback } from '../types/api.js';

const callback: ClientCallback = {
    messageId: 42,
    method: 'gameUpdate',
    objectId: '11111111-1111-4111-8111-111111111111',
    data: {
        turn: 3,
        myPlayerId: '22222222-2222-4222-8222-222222222222',
    },
};

test('converts callbacks to replayable fixtures and back', () => {
    const fixture = CallbackFixtureService.toFixture(callback, 1234);
    assert.deepEqual(fixture, {
        capturedAt: 1234,
        messageId: 42,
        method: 'gameUpdate',
        objectId: '11111111-1111-4111-8111-111111111111',
        data: {
            turn: 3,
            myPlayerId: '22222222-2222-4222-8222-222222222222',
        },
    });

    assert.deepEqual(CallbackFixtureService.toCallback(fixture), callback);
});

test('serializes and parses fixture arrays', () => {
    const fixture = CallbackFixtureService.toFixture(callback, 1234);
    const serialized = CallbackFixtureService.serialize([fixture]);

    assert.deepEqual(CallbackFixtureService.parse(serialized), [fixture]);
    assert.deepEqual(CallbackFixtureService.parseCallbacks(serialized), [callback]);
});

test('parses callback fixtures from a full debug export', () => {
    const fixture = CallbackFixtureService.toFixture(callback, 1234);
    const debugExport = {
        timestamp: 1235,
        config: {
            enabled: true,
            maxHistorySize: 50,
        },
        currentGameView: null,
        boardStateSummary: null,
        actionHistory: [],
        callbackFixtures: [fixture],
        metadata: {
            totalActions: 0,
            totalCallbackFixtures: 1,
            matchId: null,
            lastUpdate: 0,
        },
    };

    assert.deepEqual(CallbackFixtureService.parse(JSON.stringify(debugExport)), [fixture]);
});

test('rejects malformed fixture input', () => {
    assert.throws(
        () => CallbackFixtureService.parse(JSON.stringify([{ method: 'gameUpdate' }])),
        /capturedAt/
    );
});
