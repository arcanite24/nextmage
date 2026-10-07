import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createCardIconSignature,
    getCardIconSummary,
    normalizeCardIcons,
} from './CardIconService.js';

test('normalizes Java card icon payloads into short battlefield labels with useful titles', () => {
    const icons = normalizeCardIcons([
        { iconType: 'ABILITY_FLYING', hint: 'Flying' },
        { iconType: 'ABILITY_DEATHTOUCH', hint: 'Deathtouch' },
        { iconType: 'COMMANDER', hint: 'Card is commander' },
    ]);

    assert.deepEqual(icons.map(icon => icon.label), ['Fly', 'DT', 'Cmd']);
    assert.deepEqual(icons.map(icon => icon.category), ['ability', 'ability', 'commander']);
    assert.deepEqual(icons.map(icon => icon.title), ['Flying', 'Deathtouch', 'Card is commander']);
});

test('prefers icon text overlays and can derive icon types from Java resource names', () => {
    const icons = normalizeCardIcons([
        { iconType: 'prepared/square-fill.svg', text: 'x=4', hint: 'Announced X = 4' },
        { iconType: { resourceName: 'prepared/child-reaching.svg', category: 'ABILITY' }, hint: 'Reach' },
    ]);

    assert.equal(icons[0].type, 'OTHER_COST_X');
    assert.equal(icons[0].label, 'x=4');
    assert.equal(icons[0].title, 'Announced X = 4');
    assert.equal(icons[1].type, 'ABILITY_REACH');
    assert.equal(icons[1].label, 'Rch');
    assert.equal(icons[1].category, 'ability');
});

test('summarizes and signatures card icon state without depending only on count', () => {
    const first = [
        { iconType: 'ABILITY_TRAMPLE', hint: 'Trample' },
        { iconType: 'ABILITY_LIFELINK', hint: 'Lifelink' },
    ];
    const second = [
        { iconType: 'ABILITY_TRAMPLE', hint: 'Trample' },
        { iconType: 'ABILITY_VIGILANCE', hint: 'Vigilance' },
    ];

    assert.equal(getCardIconSummary(first), 'Trample; Lifelink');
    assert.notEqual(createCardIconSignature(first), createCardIconSignature(second));
});

test('falls back to readable labels for unknown icon payloads', () => {
    const icons = normalizeCardIcons([
        { iconType: 'ABILITY_SPACE_WALK', hint: '<b>Space walk</b><br>Cannot be blocked by Astronauts.' },
    ]);

    assert.equal(icons[0].label, 'SW');
    assert.equal(icons[0].title, 'Space walk, Cannot be blocked by Astronauts.');
    assert.equal(icons[0].category, 'other');
});
