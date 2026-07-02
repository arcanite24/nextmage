import assert from 'node:assert/strict';
import test from 'node:test';
import { createTournamentLifecycleHandler } from './TournamentLifecycleService.js';
import type { ClientCallback } from '../types/api.js';

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000010';
const SESSION_ID = 'session-1';

function callback(method: ClientCallback['method'] = 'startTournament', objectId: string | null = TOURNAMENT_ID): ClientCallback {
    return {
        method,
        messageId: 1,
        objectId,
        data: {},
    };
}

test('joins tournament activity once when the server starts a tournament', async () => {
    const calls: Array<{ tournamentId: string; sessionId: string }> = [];
    const handler = createTournamentLifecycleHandler({
        getSessionId: () => SESSION_ID,
        joinTournament: async (tournamentId, sessionId) => {
            calls.push({ tournamentId, sessionId });
            return true;
        },
    });

    handler.handleCallback(callback());
    handler.handleCallback(callback());
    await Promise.resolve();

    assert.deepEqual(calls, [{ tournamentId: TOURNAMENT_ID, sessionId: SESSION_ID }]);
});

test('joins draft activity once when the server starts a draft', async () => {
    const calls: Array<{ draftId: string; sessionId: string }> = [];
    const handler = createTournamentLifecycleHandler({
        getSessionId: () => SESSION_ID,
        joinTournament: async () => true,
        joinDraft: async (draftId, sessionId) => {
            calls.push({ draftId, sessionId });
            return true;
        },
    });

    handler.handleCallback(callback('startDraft'));
    handler.handleCallback(callback('startDraft'));
    await Promise.resolve();

    assert.deepEqual(calls, [{ draftId: TOURNAMENT_ID, sessionId: SESSION_ID }]);
});

test('ignores unrelated callbacks and missing session state', async () => {
    const calls: string[] = [];
    const handler = createTournamentLifecycleHandler({
        getSessionId: () => null,
        joinTournament: async (tournamentId) => {
            calls.push(tournamentId);
            return true;
        },
    });

    handler.handleCallback(callback('tournamentUpdate'));
    handler.handleCallback(callback('startTournament', null));
    handler.handleCallback(callback());
    await Promise.resolve();

    assert.deepEqual(calls, []);
});

test('allows a later start callback to retry after a failed tournament join', async () => {
    const errors: unknown[] = [];
    let attempt = 0;
    const handler = createTournamentLifecycleHandler({
        getSessionId: () => SESSION_ID,
        joinTournament: async () => {
            attempt += 1;
            if (attempt === 1) {
                throw new Error('join failed');
            }
            return true;
        },
        onError: (error) => errors.push(error),
    });

    handler.handleCallback(callback());
    await new Promise(resolve => setTimeout(resolve, 0));
    handler.handleCallback(callback());
    await Promise.resolve();

    assert.equal(attempt, 2);
    assert.equal(errors.length, 1);
});
