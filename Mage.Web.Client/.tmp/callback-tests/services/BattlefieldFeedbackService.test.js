import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattlefieldFeedbackSnapshot, diffBattlefieldFeedbackSnapshots, } from './BattlefieldFeedbackService.js';
function makePermanent(id, overrides = {}) {
    return {
        id,
        name: id,
        displayName: id,
        displayFullName: id,
        rules: [],
        cardTypes: ['Creature'],
        subTypes: [],
        superTypes: [],
        power: '1',
        toughness: '1',
        loyalty: '',
        defense: '',
        isToken: false,
        isAbility: false,
        tapped: false,
        flipped: false,
        phasedIn: true,
        transformed: false,
        summoningSickness: false,
        damage: 0,
        attachments: [],
        copy: false,
        canAttack: false,
        canBlock: false,
        controlledByOwner: true,
        nameOwner: 'Alice',
        nameController: 'Alice',
        controlled: true,
        attachedToPermanent: false,
        attachedControllerDiffers: false,
        morphed: false,
        manifested: false,
        disguised: false,
        cloaked: false,
        mutated: false,
        ...overrides,
    };
}
function makePlayer(cards) {
    return {
        playerId: 'player-a',
        battlefield: Object.fromEntries(cards.map(card => [card.id, card])),
    };
}
test('creates feedback snapshots from visible battlefield permanents only', () => {
    const visible = makePermanent('visible');
    const phasedOut = makePermanent('phased-out', { phasedIn: false });
    const combat = new Map([['visible', 'attacking']]);
    const snapshot = createBattlefieldFeedbackSnapshot(makePlayer([visible, phasedOut]), combat);
    assert.deepEqual(Object.keys(snapshot), ['visible']);
    assert.equal(snapshot.visible.combatState, 'attacking');
});
test('detects battlefield enter, state, attachment, combat, death, and leave feedback events', () => {
    const previous = createBattlefieldFeedbackSnapshot(makePlayer([
        makePermanent('tapper'),
        makePermanent('damaged'),
        makePermanent('attached', { attachments: ['old-aura'] }),
        makePermanent('dies', { name: 'Grizzly Bears' }),
        makePermanent('leaves', { cardTypes: ['Artifact'] }),
        makePermanent('combat'),
    ]), new Map([['combat', 'attacking']]));
    const current = createBattlefieldFeedbackSnapshot(makePlayer([
        makePermanent('tapper', { tapped: true }),
        makePermanent('damaged', { damage: 2 }),
        makePermanent('attached', { attachments: ['new-aura'] }),
        makePermanent('combat'),
        makePermanent('enters'),
    ]), new Map([['combat', 'blocking']]));
    const events = diffBattlefieldFeedbackSnapshots(previous, current);
    assert.deepEqual(events.map(event => `${event.cardId}:${event.kind}`).sort(), [
        'attached:attachment',
        'combat:combat',
        'damaged:damaged',
        'dies:died',
        'enters:entered',
        'leaves:left',
        'tapper:tapped',
    ]);
    assert.equal(events.find(event => event.cardId === 'dies')?.cardName, 'Grizzly Bears');
});
test('classifies Java enum-cased creatures as deaths when they leave', () => {
    const previous = createBattlefieldFeedbackSnapshot(makePlayer([
        makePermanent('dies', { name: 'Runeclaw Bear', cardTypes: ['CREATURE'] }),
    ]), new Map());
    const current = createBattlefieldFeedbackSnapshot(makePlayer([]), new Map());
    const events = diffBattlefieldFeedbackSnapshots(previous, current);
    assert.deepEqual(events.map(event => `${event.cardId}:${event.kind}:${event.cardName}`), [
        'dies:died:Runeclaw Bear',
    ]);
});
