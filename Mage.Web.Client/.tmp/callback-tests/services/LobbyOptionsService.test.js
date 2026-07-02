import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultComputerPlayerType, getDefaultDeckType, getDefaultGameTypeName, getHumanPlayerType, isLimitedDeckType, normalizeLobbyServerOptions, resizePlayerTypes, validateDeckGameTypePair, } from './LobbyOptionsService.js';
const SERVER_STATE = {
    gameTypes: [
        {
            name: 'Two Player Duel',
            minPlayers: 2,
            maxPlayers: 2,
            numTeams: 0,
            playersPerTeam: 0,
            useRange: false,
            useAttackOption: false,
        },
        {
            name: 'Commander Free For All',
            minPlayers: 3,
            maxPlayers: 10,
            numTeams: 0,
            playersPerTeam: 0,
            useRange: true,
            useAttackOption: true,
        },
    ],
    deckTypes: [
        'Constructed - Standard',
        'Variant Magic - Commander',
        'Variant Magic - Brawl',
        'Limited',
    ],
    playerTypes: ['HUMAN', 'COMPUTER_MAD', 'Computer - monte carlo'],
    tournamentTypes: [],
    draftCubes: ['Legacy Cube'],
    testMode: true,
    version: {
        major: 1,
        minor: 4,
        release: 58,
    },
    cardsContentVersion: 1,
    expansionsContentVersion: 1,
};
test('normalizes lobby options from Java server state', () => {
    const options = normalizeLobbyServerOptions(SERVER_STATE);
    assert.deepEqual(options.gameTypes.map(gameType => gameType.name), [
        'Two Player Duel',
        'Commander Free For All',
    ]);
    assert.deepEqual(options.deckTypes, [
        'Constructed - Standard',
        'Variant Magic - Commander',
        'Variant Magic - Brawl',
        'Limited',
    ]);
    assert.deepEqual(options.playerTypes.map(type => type.label), [
        'Human',
        'Computer - mad',
        'Computer - monte carlo',
    ]);
    assert.equal(options.playerTypes[1].value, 'Computer - mad');
    assert.equal(options.playerTypes[1].isAI, true);
    assert.equal(options.tournamentGameTypes.length, 1);
    assert.equal(options.tournamentGameTypes[0].name, 'Two Player Duel');
    assert.equal(options.draftCubes[0], 'Legacy Cube');
});
test('selects resilient create-table defaults from server-provided options', () => {
    const options = normalizeLobbyServerOptions(SERVER_STATE);
    assert.equal(getDefaultGameTypeName(options), 'Two Player Duel');
    assert.equal(getDefaultDeckType(options), 'Constructed - Standard');
    assert.equal(getHumanPlayerType(options), 'Human');
    assert.equal(getDefaultComputerPlayerType(options), 'Computer - mad');
    assert.deepEqual(resizePlayerTypes(['Computer - mad'], 3, 'Human'), [
        'Human',
        'Human',
        'Human',
    ]);
});
test('matches Java NewTableDialog deck and game type validation', () => {
    assert.equal(validateDeckGameTypePair('Two Player Duel', 'Variant Magic - Commander'), 'Deck type Commander needs also a Commander game type');
    assert.equal(validateDeckGameTypePair('Commander Free For All', 'Constructed - Standard'), 'Deck type Commander needs also a Commander game type');
    assert.equal(validateDeckGameTypePair('Brawl Two Player Duel', 'Variant Magic - Commander'), 'Deck type Commander needs also a Commander game type');
    assert.equal(validateDeckGameTypePair('Brawl Two Player Duel', 'Variant Magic - Brawl'), null);
    assert.equal(validateDeckGameTypePair('Tiny Leaders Two Player Duel', 'Variant Magic - Tiny Leaders'), null);
});
test('derives limited mode the way the Java table dialog does', () => {
    assert.equal(isLimitedDeckType('Limited'), true);
    assert.equal(isLimitedDeckType('Limited - Sealed'), true);
    assert.equal(isLimitedDeckType('Variant Magic - Freeform Unlimited Commander'), true);
    assert.equal(isLimitedDeckType('Constructed - Standard'), false);
});
