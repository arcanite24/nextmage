import assert from 'node:assert/strict';
import test from 'node:test';
import {
    areCountersEqual,
    COLLAPSED_STACK_VISIBLE_COUNT,
    createCombatStateLookup,
    createValidTargetLookup,
    getVisibleStackCards,
    isPrioritySelectPrompt,
    shouldCompleteSelectWithBooleanFalse,
} from './BattlefieldPerformanceService.js';
import type { CombatGroupView } from '../types/game.js';

test('caps collapsed battlefield stacks to a small visible tail', () => {
    const stack = Array.from({ length: 12 }, (_, index) => ({ id: `card-${index}` }));
    const visible = getVisibleStackCards(stack, false);

    assert.equal(visible.length, COLLAPSED_STACK_VISIBLE_COUNT);
    assert.deepEqual(visible.map(card => card.id), ['card-8', 'card-9', 'card-10', 'card-11']);
    assert.equal(getVisibleStackCards(stack, true).length, stack.length);
});

test('builds O(1) valid-target lookups without changing prompt semantics', () => {
    const targetAction = {
        type: 'target',
        message: 'Choose target',
        validTargets: ['target-a', 'target-b'],
        gameView: {},
    };

    const selectAction = {
        type: 'select',
        message: 'Choose card',
        required: true,
        min: 1,
        gameView: {},
    };

    const optionalSelectAction = {
        type: 'select',
        message: 'Select attackers',
        required: false,
        min: 0,
        gameView: {},
    };

    const noAction = { type: 'none' };

    const targetLookup = createValidTargetLookup(targetAction);
    assert.equal(targetLookup('target-a'), true);
    assert.equal(targetLookup('target-c'), false);

    assert.equal(createValidTargetLookup(selectAction)('anything'), true);
    assert.equal(createValidTargetLookup(optionalSelectAction)('anything'), false);
    assert.equal(createValidTargetLookup(noAction)('anything'), false);
});

test('limits target and select prompts to card prompt lists when provided', () => {
    const cardsView = {
        'hand-a': {},
        'hand-b': {},
    };

    const targetCardPrompt = {
        type: 'target',
        message: 'Choose target card',
        validTargets: [],
        cardsView,
        gameView: {},
    };

    const selectCardPrompt = {
        type: 'select',
        message: 'Select a card',
        cardsView,
        gameView: {},
    };

    assert.equal(createValidTargetLookup(targetCardPrompt)('hand-a'), true);
    assert.equal(createValidTargetLookup(targetCardPrompt)('battlefield-a'), false);
    assert.equal(createValidTargetLookup(selectCardPrompt)('hand-b'), true);
    assert.equal(createValidTargetLookup(selectCardPrompt)('battlefield-a'), false);
});

test('distinguishes priority GAME_SELECT prompts from card-selection prompts', () => {
    assert.equal(isPrioritySelectPrompt('Play spells and abilities'), true);
    assert.equal(isPrioritySelectPrompt('Play instants and activated abilities'), true);
    assert.equal(isPrioritySelectPrompt('Play spells and abilities (as Alice)'), true);
    assert.equal(isPrioritySelectPrompt('Select a card to discard'), false);
    assert.equal(isPrioritySelectPrompt('Select attackers'), false);
});

test('completes plain GAME_SELECT prompts with boolean false like the desktop feedback panel', () => {
    assert.equal(shouldCompleteSelectWithBooleanFalse({
        type: 'select',
        message: 'Select attackers',
        required: false,
        min: 0,
        gameView: {},
    }), true);

    assert.equal(shouldCompleteSelectWithBooleanFalse({
        type: 'select',
        message: 'Select a card (1 more) to put on the bottom of your library',
        required: true,
        min: 1,
        gameView: {},
    }), false);

    assert.equal(shouldCompleteSelectWithBooleanFalse({
        type: 'select',
        message: 'Choose up to one card from a large prompt list.',
        cardsView: { card: {} },
        gameView: {},
    }), false);

    assert.equal(shouldCompleteSelectWithBooleanFalse({
        type: 'target',
        message: 'Choose target',
        gameView: {},
    }), false);
});

test('indexes combat groups once for per-card battlefield rendering', () => {
    const combat = [{
        attackers: {
            attacker: {},
        },
        blockers: {
            blocker: {},
        },
    }] as unknown as CombatGroupView[];

    const lookup = createCombatStateLookup(combat);

    assert.equal(lookup.get('attacker'), 'attacking');
    assert.equal(lookup.get('blocker'), 'blocking');
    assert.equal(lookup.get('bystander'), undefined);
});

test('compares counters without depending on server array order', () => {
    assert.equal(
        areCountersEqual(
            [{ name: 'shield', count: 1 }, { name: '+1/+1', count: 3 }],
            [{ name: '+1/+1', count: 3 }, { name: 'shield', count: 1 }]
        ),
        true
    );

    assert.equal(
        areCountersEqual(
            [{ name: 'shield', count: 1 }],
            [{ name: 'shield', count: 2 }]
        ),
        false
    );
});
