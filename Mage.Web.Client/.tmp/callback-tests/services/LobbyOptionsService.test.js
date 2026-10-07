import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultComputerPlayerType, getDefaultDeckType, getDefaultGameTypeName, getDefaultTournamentTypeName, getHumanPlayerType, isLimitedDeckType, isTournamentTypeCubeBooster, isTournamentTypeDraft, isTournamentTypeJumpstart, isTournamentTypeLimited, isTournamentTypeRandom, isTournamentTypeReshuffled, isTournamentTypeRichMan, normalizeLobbyServerOptions, resizePlayerTypes, validateDeckGameTypePair, } from './LobbyOptionsService.js';
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
    tournamentTypes: [
        {
            name: 'Booster Draft Swiss',
            minPlayers: 4,
            maxPlayers: 8,
            numBoosters: 3,
            draft: true,
            limited: true,
            cubeBooster: false,
            random: false,
            reshuffled: false,
            richMan: false,
            jumpstart: false,
            elimination: false,
        },
        {
            name: 'Rich Man Cube Draft Swiss',
            minPlayers: 4,
            maxPlayers: 8,
            numBoosters: 3,
            draft: true,
            limited: true,
            cubeBooster: true,
            random: false,
            reshuffled: false,
            richMan: true,
            jumpstart: false,
            elimination: false,
        },
        {
            name: 'Jumpstart Elimination (Custom)',
            minPlayers: 2,
            maxPlayers: 2,
            numBoosters: 2,
            draft: false,
            limited: true,
            cubeBooster: false,
            random: false,
            reshuffled: false,
            richMan: false,
            jumpstart: true,
            elimination: true,
        },
    ],
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
    assert.equal(options.tournamentTypes[0].name, 'Booster Draft Swiss');
    assert.equal(options.tournamentTypes[0].isDraft, true);
    assert.equal(options.tournamentTypes[1].isCubeBooster, true);
    assert.equal(options.tournamentTypes[1].isRichMan, true);
    assert.equal(options.tournamentTypes[2].isJumpstart, true);
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
test('normalizes Java tournament type flags for create tournament flows', () => {
    const options = normalizeLobbyServerOptions(SERVER_STATE);
    const draft = options.tournamentTypes[0];
    const richCube = options.tournamentTypes[1];
    const jumpstart = options.tournamentTypes[2];
    assert.equal(getDefaultTournamentTypeName(options), 'Booster Draft Swiss');
    assert.equal(isTournamentTypeLimited(draft), true);
    assert.equal(isTournamentTypeDraft(draft), true);
    assert.equal(isTournamentTypeCubeBooster(draft), false);
    assert.equal(isTournamentTypeCubeBooster(richCube), true);
    assert.equal(isTournamentTypeRichMan(richCube), true);
    assert.equal(isTournamentTypeRandom(richCube), false);
    assert.equal(isTournamentTypeReshuffled(richCube), false);
    assert.equal(isTournamentTypeJumpstart(jumpstart), true);
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
