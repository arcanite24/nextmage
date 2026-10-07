import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBattlefieldLayout, createBattlefieldSignature, getBattlefieldZone, JAVA_BATTLEFIELD_STACK_CAP, } from './BattlefieldLayoutService.js';
function makePermanent(id, name, overrides = {}) {
    return {
        id,
        name,
        displayName: name,
        displayFullName: name,
        cardTypes: overrides.cardTypes ?? ['Creature'],
        subTypes: [],
        superTypes: [],
        rules: [],
        power: '1',
        toughness: '1',
        loyalty: '',
        defense: '',
        isToken: false,
        isAbility: false,
        tapped: false,
        flipped: false,
        phasedIn: true,
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
function makePlayer(permanents) {
    return {
        playerId: 'player-a',
        name: 'Alice',
        battlefield: Object.fromEntries(permanents.map(card => [card.id, card])),
    };
}
function getStacks(player, grouping = 'separate') {
    return buildBattlefieldLayout(player, grouping).rows.flatMap(row => row.zones.flatMap(zone => zone.stacks));
}
test('filters phased-out permanents before row and stack layout', () => {
    const phasedIn = makePermanent('in', 'Bear');
    const phasedOut = makePermanent('out', 'Invisible Stalker', { phasedIn: false });
    const layout = buildBattlefieldLayout(makePlayer([phasedIn, phasedOut]), 'separate');
    const stackCards = layout.rows.flatMap(row => row.zones.flatMap(zone => zone.stacks.flatMap(stack => stack.cards)));
    assert.equal(layout.visiblePermanentCount, 1);
    assert.equal(layout.hiddenPhasedCount, 1);
    assert.deepEqual(stackCards.map(card => card.id), ['in']);
});
test('includes server interaction state in the battlefield signature', () => {
    const base = makePermanent('bear', 'Runeclaw Bear', {
        isSelected: false,
        isChoosable: false,
        playableStats: { playableAmount: 0 },
    });
    const selected = makePermanent('bear', 'Runeclaw Bear', {
        isSelected: true,
        isChoosable: true,
        playableStats: { playableAmount: 2 },
    });
    assert.notEqual(createBattlefieldSignature(makePlayer([base])), createBattlefieldSignature(makePlayer([selected])));
});
test('includes card icon payload changes in the battlefield signature', () => {
    const flying = makePermanent('spirit', 'Lingering Spirit', {
        cardIcons: [{ iconType: 'ABILITY_FLYING', hint: 'Flying' }],
    });
    const vigilance = makePermanent('spirit', 'Lingering Spirit', {
        cardIcons: [{ iconType: 'ABILITY_VIGILANCE', hint: 'Vigilance' }],
    });
    assert.notEqual(createBattlefieldSignature(makePlayer([flying])), createBattlefieldSignature(makePlayer([vigilance])));
});
test('keeps non-token non-land permanents in individual desktop-style stacks', () => {
    const firstBear = makePermanent('bear-a', 'Runeclaw Bear', { power: '2', toughness: '2' });
    const secondBear = makePermanent('bear-b', 'Runeclaw Bear', { power: '2', toughness: '2' });
    const stacks = getStacks(makePlayer([firstBear, secondBear]));
    assert.equal(stacks.length, 2);
    assert.deepEqual(stacks.map(stack => stack.cards.map(card => card.id)), [['bear-a'], ['bear-b']]);
});
test('stacks matching lands and splits at the desktop cap', () => {
    const forests = Array.from({ length: JAVA_BATTLEFIELD_STACK_CAP + 2 }, (_, index) => makePermanent(`forest-${index}`, 'Forest', {
        cardTypes: ['Land'],
        power: '',
        toughness: '',
    }));
    const stacks = getStacks(makePlayer(forests));
    assert.equal(stacks.length, 2);
    assert.deepEqual(stacks.map(stack => stack.cards.length), [JAVA_BATTLEFIELD_STACK_CAP, 2]);
    assert.equal(new Set(stacks.map(stack => stack.key)).size, stacks.length);
});
test('uses Java stack equality fields for token and land stacks', () => {
    const baseToken = makePermanent('token-a', 'Wolf Token', {
        isToken: true,
        power: '2',
        toughness: '2',
        rules: ['This creature attacks each combat if able.'],
    });
    const matchingToken = makePermanent('token-b', 'Wolf Token', {
        isToken: true,
        power: '2',
        toughness: '2',
        rules: ['This creature attacks each combat if able.'],
    });
    const counterToken = makePermanent('token-c', 'Wolf Token', {
        isToken: true,
        power: '2',
        toughness: '2',
        rules: ['This creature attacks each combat if able.'],
        counters: [{ name: '+1/+1', count: 1 }],
    });
    const sickToken = makePermanent('token-d', 'Wolf Token', {
        isToken: true,
        power: '2',
        toughness: '2',
        rules: ['This creature attacks each combat if able.'],
        summoningSickness: true,
    });
    const stacks = getStacks(makePlayer([baseToken, matchingToken, counterToken, sickToken]));
    assert.equal(stacks.length, 3);
    assert.deepEqual(stacks.map(stack => stack.cards.length), [2, 1, 1]);
});
test('uses original power and toughness when stacking copied tokens', () => {
    const baseToken = makePermanent('token-a', 'Illusion Token', {
        isToken: true,
        power: '4',
        toughness: '4',
        originalPower: '2',
        originalToughness: '2',
    });
    const boostedMatchingToken = makePermanent('token-b', 'Illusion Token', {
        isToken: true,
        power: '4',
        toughness: '4',
        originalPower: '2',
        originalToughness: '2',
    });
    const differentOriginalToken = makePermanent('token-c', 'Illusion Token', {
        isToken: true,
        power: '4',
        toughness: '4',
        originalPower: '3',
        originalToughness: '3',
    });
    const stacks = getStacks(makePlayer([baseToken, boostedMatchingToken, differentOriginalToken]));
    assert.equal(stacks.length, 2);
    assert.deepEqual(stacks.map(stack => stack.cards.map(card => card.id)), [
        ['token-b', 'token-a'],
        ['token-c'],
    ]);
});
test('excludes attached permanents as row roots and preserves recursive attachment layout', () => {
    const host = makePermanent('host', 'Llanowar Elves', { attachments: ['aura'] });
    const aura = makePermanent('aura', 'Rancor', {
        cardTypes: ['Enchantment'],
        subTypes: ['Aura'],
        power: '',
        toughness: '',
        attachedTo: host.id,
        attachedToPermanent: true,
        attachments: ['equipment'],
    });
    const equipment = makePermanent('equipment', 'Runechanter Pike', {
        cardTypes: ['Artifact'],
        subTypes: ['Equipment'],
        power: '',
        toughness: '',
        attachedTo: aura.id,
        attachedToPermanent: true,
        attachedControllerDiffers: true,
        nameController: 'Bob',
    });
    const layout = buildBattlefieldLayout(makePlayer([host, aura, equipment]), 'separate');
    const stacks = layout.rows.flatMap(row => row.zones.flatMap(zone => zone.stacks));
    assert.equal(layout.rootPermanentCount, 1);
    assert.equal(layout.attachedPermanentCount, 2);
    assert.equal(stacks.length, 1);
    assert.deepEqual(stacks[0].cards.map(card => card.id), ['host']);
    assert.deepEqual(stacks[0].attachedCards.map(attachment => [attachment.card.id, attachment.depth]), [
        ['aura', 1],
        ['equipment', 2],
    ]);
    assert.equal(stacks[0].attachmentCount, 2);
    assert.equal(stacks[0].attachmentColumns, 2);
    assert.equal(stacks[0].hasControllerMismatch, true);
});
test('keeps fortifications attached to fortified lands in the land row', () => {
    const land = makePermanent('land', 'Mountain', {
        cardTypes: ['Land'],
        power: '',
        toughness: '',
        attachments: ['fortification'],
    });
    const fortification = makePermanent('fortification', 'Darksteel Garrison', {
        cardTypes: ['Artifact'],
        subTypes: ['Fortification'],
        power: '',
        toughness: '',
        attachedTo: land.id,
        attachedToPermanent: true,
    });
    const layout = buildBattlefieldLayout(makePlayer([land, fortification]), 'separate');
    const backRow = layout.rows.find(row => row.role === 'back');
    const landZone = backRow?.zones.find(zone => zone.zoneKey === 'LANDS');
    const artifactZone = backRow?.zones.find(zone => zone.zoneKey === 'ARTIFACTS');
    assert.equal(layout.rootPermanentCount, 1);
    assert.equal(layout.attachedPermanentCount, 1);
    assert.ok(landZone);
    assert.equal(artifactZone, undefined);
    assert.equal(landZone.stacks.length, 1);
    assert.deepEqual(landZone.stacks[0].cards.map(card => card.id), ['land']);
    assert.deepEqual(landZone.stacks[0].attachedCards.map(attachment => [attachment.card.id, attachment.depth]), [
        ['fortification', 1],
    ]);
});
test('assigns grouping zones the same way the match setting describes them', () => {
    const artifact = makePermanent('artifact', 'Sol Ring', { cardTypes: ['Artifact'], power: '', toughness: '' });
    const land = makePermanent('land', 'Island', { cardTypes: ['Land'], power: '', toughness: '' });
    const creature = makePermanent('creature', 'Merfolk', { cardTypes: ['Creature'] });
    assert.equal(getBattlefieldZone(artifact, 'separate'), 'ARTIFACTS');
    assert.equal(getBattlefieldZone(artifact, 'nonlands'), 'NONLANDS');
    assert.equal(getBattlefieldZone(artifact, 'creature-land-other'), 'OTHER');
    assert.equal(getBattlefieldZone(land, 'creature-land-other'), 'LANDS');
    assert.equal(getBattlefieldZone(creature, 'creature-land-other'), 'CREATURES');
});
test('recognizes Java enum card type casing when assigning battlefield zones', () => {
    const artifact = makePermanent('artifact', 'Sol Ring', { cardTypes: ['ARTIFACT'], power: '', toughness: '' });
    const land = makePermanent('land', 'Island', { cardTypes: ['LAND'], power: '', toughness: '' });
    const creature = makePermanent('creature', 'Merfolk', { cardTypes: ['CREATURE'] });
    const layout = buildBattlefieldLayout(makePlayer([artifact, land, creature]), 'separate');
    const frontRow = layout.rows.find(row => row.role === 'front');
    const backRow = layout.rows.find(row => row.role === 'back');
    assert.deepEqual(frontRow?.zones.map(zone => zone.zoneKey), ['CREATURES']);
    assert.deepEqual(backRow?.zones.map(zone => zone.zoneKey), ['LANDS', 'ARTIFACTS']);
    assert.equal(getBattlefieldZone(artifact, 'creature-land-other'), 'OTHER');
    assert.equal(getBattlefieldZone(land, 'creature-land-other'), 'LANDS');
    assert.equal(getBattlefieldZone(creature, 'creature-land-other'), 'CREATURES');
});
test('centers populated battlefield zones instead of pinning other permanents to the right', () => {
    const land = makePermanent('land', 'Island', { cardTypes: ['Land'], power: '', toughness: '' });
    const artifact = makePermanent('artifact', 'Sol Ring', { cardTypes: ['Artifact'], power: '', toughness: '' });
    const enchantment = makePermanent('enchantment', 'Omen of the Sea', { cardTypes: ['Enchantment'], power: '', toughness: '' });
    const layout = buildBattlefieldLayout(makePlayer([land, artifact, enchantment]), 'separate');
    const backRow = layout.rows.find(row => row.role === 'back');
    assert.ok(backRow);
    assert.deepEqual(backRow.zones.map(zone => `${zone.zoneKey}:${zone.alignment}:${zone.startsAlignmentGroup}`), [
        'LANDS:center:false',
        'ARTIFACTS:center:false',
        'ENCHANTMENTS:center:false',
    ]);
});
