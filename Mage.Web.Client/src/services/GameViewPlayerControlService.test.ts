import assert from 'node:assert/strict';
import { test } from 'vitest';
import { resolvePlayerControlIdentityFromGameView } from './GameViewPlayerControlService.js';

test('game views with myPlayerId unlock player controls after a join placeholder', () => {
    const identity = resolvePlayerControlIdentityFromGameView(
        { playerId: null, isWatching: true },
        { myPlayerId: '00000000-0000-4000-8000-000000000302' },
    );

    assert.deepEqual(identity, {
        playerId: '00000000-0000-4000-8000-000000000302',
        isWatching: false,
    });
});

test('spectator game views keep the current watch state', () => {
    const identity = resolvePlayerControlIdentityFromGameView(
        { playerId: null, isWatching: true },
        { myPlayerId: null },
    );

    assert.deepEqual(identity, {
        playerId: null,
        isWatching: true,
    });
});
