import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerFeedbackSnapshot, diffPlayerFeedbackSnapshots, formatPlayerFeedbackEvent, } from './PlayerFeedbackService.js';
function makePlayer(overrides) {
    return {
        playerId: 'player-a',
        name: 'Alice',
        life: 20,
        counters: [],
        ...overrides,
    };
}
test('diffs player life loss and life gain from seeded snapshots', () => {
    const previous = createPlayerFeedbackSnapshot([
        makePlayer({ playerId: 'player-a', name: 'Alice', life: 20 }),
        makePlayer({ playerId: 'player-b', name: 'Bob', life: 3 }),
    ]);
    const current = createPlayerFeedbackSnapshot([
        makePlayer({ playerId: 'player-a', name: 'Alice', life: 17 }),
        makePlayer({ playerId: 'player-b', name: 'Bob', life: 6 }),
    ]);
    const events = diffPlayerFeedbackSnapshots(previous, current);
    assert.deepEqual(events.map(event => `${event.playerId}:${event.kind}:${event.amount}`), [
        'player-a:lifeLost:3',
        'player-b:lifeGained:3',
    ]);
    assert.equal(formatPlayerFeedbackEvent(events[0]), 'Alice lost 3 life');
});
test('sums duplicate player counters and reports counter deltas by name', () => {
    const previous = createPlayerFeedbackSnapshot([
        makePlayer({
            counters: [
                { name: 'poison', count: 1 },
                { name: 'energy', count: 3 },
                { name: 'poison', count: 1 },
            ],
        }),
    ]);
    const current = createPlayerFeedbackSnapshot([
        makePlayer({
            counters: [
                { name: 'poison', count: 4 },
                { name: 'energy', count: 1 },
                { name: 'experience', count: 1 },
            ],
        }),
    ]);
    const events = diffPlayerFeedbackSnapshots(previous, current);
    assert.deepEqual(events.map(event => `${event.counterName}:${event.kind}:${event.amount}:${event.previousValue}->${event.currentValue}`), [
        'energy:counterLost:2:3->1',
        'experience:counterGained:1:0->1',
        'poison:counterGained:2:2->4',
    ]);
    assert.equal(formatPlayerFeedbackEvent(events[1]), 'Alice gained 1 experience counter');
    assert.equal(formatPlayerFeedbackEvent(events[2]), 'Alice gained 2 poison counters');
});
