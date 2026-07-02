import test from 'node:test';
import assert from 'node:assert/strict';
import { MageObjectType, PhaseStep, Rarity, SkillLevel, TableState, TurnPhase, Zone, } from '../types/api.js';
const GAME_ID = '00000000-0000-0000-0000-000000000001';
const PLAYER_ID = '00000000-0000-0000-0000-000000000002';
const OPPONENT_ID = '00000000-0000-0000-0000-000000000003';
const CARD_ID = '00000000-0000-0000-0000-000000000004';
const PERMANENT_ID = '00000000-0000-0000-0000-000000000005';
const TABLE_ID = '00000000-0000-0000-0000-000000000006';
const ROOM_ID = '00000000-0000-0000-0000-000000000007';
const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000008';
const DRAFT_ID = '00000000-0000-0000-0000-000000000009';
const CHAT_ID = '00000000-0000-0000-0000-000000000010';
const COLORLESS = {
    white: false,
    blue: false,
    black: false,
    red: false,
    green: false,
};
const RED = {
    white: false,
    blue: false,
    black: false,
    red: true,
    green: false,
};
const EMPTY_MANA_POOL = {
    red: 0,
    green: 0,
    blue: 0,
    white: 0,
    black: 0,
    colorless: 0,
};
const USER_DATA = {
    groupId: 0,
    avatarId: 51,
    allowRequestShowHandCards: false,
    confirmEmptyManaPool: true,
    userSkipPrioritySteps: {
        yourTurn: {
            upkeep: false,
            draw: false,
            main1: true,
            beforeCombat: false,
            endOfCombat: false,
            main2: true,
            endOfTurn: false,
        },
        opponentTurn: {
            upkeep: false,
            draw: false,
            main1: false,
            beforeCombat: false,
            endOfCombat: false,
            main2: false,
            endOfTurn: false,
        },
        stopOnDeclareAttackers: true,
        stopOnDeclareBlockersWithZeroPermanents: false,
        stopOnDeclareBlockersWithAnyPermanents: true,
        stopOnAllMainPhases: true,
        stopOnAllEndPhases: true,
        stopOnStackNewObjects: true,
    },
    flagName: 'world.png',
    askMoveToGraveOrder: false,
    manaPoolAutomatic: true,
    manaPoolAutomaticRestricted: false,
    passPriorityCast: false,
    passPriorityActivation: false,
    autoOrderTrigger: true,
    autoTargetLevel: 0,
    useSameSettingsForReplacementEffects: true,
    useFirstManaAbility: false,
};
const CARD_VIEW = {
    id: CARD_ID,
    expansionSetCode: 'M11',
    cardNumber: '149',
    usesVariousArt: false,
    gameObject: true,
    isChoosable: false,
    isSelected: false,
    playableStats: { playableAmount: 1 },
    name: 'Lightning Bolt',
    displayName: 'Lightning Bolt',
    displayFullName: 'Lightning Bolt',
    rules: ['Lightning Bolt deals 3 damage to any target.'],
    power: '',
    toughness: '',
    loyalty: '',
    defense: '',
    cardTypes: ['INSTANT'],
    subTypes: [],
    superTypes: [],
    color: RED,
    frameColor: RED,
    frameStyle: 'M15_NORMAL',
    manaCostLeftStr: ['{R}'],
    manaCostRightStr: [],
    manaValue: 1,
    rarity: Rarity.COMMON,
    mageObjectType: MageObjectType.CARD,
    isToken: false,
    isAbility: false,
    imageFileName: '',
    imageNumber: 0,
    extraDeckCard: false,
    transformable: false,
    transformed: false,
    flipCard: false,
    faceDown: false,
    isSplitCard: false,
    isDoubleFacedCard: false,
    artRect: 'NORMAL',
    targets: [],
    paid: false,
    counters: [],
    controlledByOwner: true,
    zone: Zone.HAND,
    rotate: false,
    hideInfo: false,
    canAttack: false,
    canBlock: false,
    inViewerOnly: false,
    cardIcons: [],
    originalPower: null,
    originalToughness: null,
    originalColorIdentity: null,
    originalIsCopy: false,
};
const PERMANENT_VIEW = {
    ...CARD_VIEW,
    id: PERMANENT_ID,
    name: 'Mountain',
    displayName: 'Mountain',
    displayFullName: 'Mountain',
    rules: ['{T}: Add {R}.'],
    cardTypes: ['LAND'],
    color: COLORLESS,
    frameColor: COLORLESS,
    manaCostLeftStr: [],
    manaValue: 0,
    rarity: Rarity.LAND,
    mageObjectType: MageObjectType.PERMANENT,
    zone: Zone.BATTLEFIELD,
    tapped: false,
    flipped: false,
    phasedIn: true,
    summoningSickness: false,
    damage: 0,
    attachments: [],
    copy: false,
    nameOwner: 'Alice',
    nameController: 'Alice',
    controlled: true,
    attachedToPermanent: false,
    attachedControllerDiffers: false,
    morphed: false,
    manifested: false,
    disguised: false,
    cloaked: false,
};
const PLAYER_VIEW = {
    playerId: PLAYER_ID,
    name: 'Alice',
    controlled: true,
    isHuman: true,
    life: 20,
    counters: [],
    wins: 0,
    winsNeeded: 2,
    libraryCount: 53,
    handCount: 7,
    manaPool: EMPTY_MANA_POOL,
    graveyard: {},
    exile: {},
    sideboard: {},
    helperCards: {},
    battlefield: {
        [PERMANENT_ID]: PERMANENT_VIEW,
    },
    userData: USER_DATA,
    commandList: [],
    attachments: [],
    statesSavedSize: 0,
    priorityTimeLeftSecs: 600,
    bufferTimeLeft: 120,
    timerActive: true,
    isActive: true,
    hasPriority: true,
    hasLeft: false,
    passedTurn: false,
    passedUntilEndOfTurn: false,
    passedUntilNextMain: false,
    passedUntilStackResolved: false,
    passedAllTurns: false,
    passedUntilEndStepBeforeMyTurn: false,
    monarch: false,
    initiative: false,
    designationNames: [],
};
const GAME_VIEW = {
    priorityTime: 600,
    bufferTime: 120,
    players: [
        PLAYER_VIEW,
        {
            ...PLAYER_VIEW,
            playerId: OPPONENT_ID,
            name: 'Bob',
            controlled: false,
            isActive: false,
            hasPriority: false,
            handCount: 7,
            battlefield: {},
        },
    ],
    myPlayerId: PLAYER_ID,
    myHand: {
        [CARD_ID]: CARD_VIEW,
    },
    myHelperEmblems: {},
    canPlayObjects: {
        objects: {
            [CARD_ID]: { playableAmount: 1 },
        },
    },
    opponentHands: {},
    watchedHands: {},
    stack: {},
    exiles: [],
    revealed: [],
    lookedAt: [],
    companion: [],
    combat: [],
    phase: TurnPhase.PRECOMBAT_MAIN,
    step: PhaseStep.PRECOMBAT_MAIN,
    activePlayerId: PLAYER_ID,
    activePlayerName: 'Alice',
    priorityPlayerName: 'Alice',
    turn: 1,
    special: false,
    rollbackTurnsAllowed: true,
    attackOption: 'MULTIPLE',
    rangeOfInfluence: 'ALL',
    totalErrorsCount: 0,
    totalEffectsCount: 0,
    gameCycle: 12,
};
const API_SIMPLE_CARD = {
    id: CARD_ID,
    expansionSetCode: 'M11',
    cardNumber: '149',
    usesVariousArt: false,
    gameObject: false,
    isChoosable: false,
    isSelected: false,
    playableStats: { playableAmount: 0 },
};
const DECK_VIEW = {
    name: 'Java Simple Deck',
    cards: {
        [CARD_ID]: API_SIMPLE_CARD,
    },
    sideboard: {},
};
const TABLE_VIEW = {
    tableId: TABLE_ID,
    tableName: 'Best of 3',
    controllerName: 'Alice',
    gameType: 'Two Player Duel',
    deckType: 'Modern',
    spectatorsAllowed: true,
    createTime: 'Jun 20, 2026, 12:00:00 PM',
    tableState: TableState.WAITING,
    tableStateText: 'WAITING (1/2)',
    seats: [
        { seatNum: 0, name: 'Alice', playerType: 'Human' },
        { seatNum: 1, name: '', playerType: 'Human' },
    ],
    games: [],
    seatsInfo: '1/2',
    isTournament: false,
    additionalInfoShort: 'Wins: 2, SP',
    additionalInfoFull: 'Wins required: 2<br>Spectators allowed (SP)',
    skillLevel: SkillLevel.CASUAL,
    quitRatio: '0',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
};
const TOURNAMENT_VIEW = {
    tournamentName: 'Friday Draft',
    tournamentType: 'Booster Draft',
    tournamentState: 'Drafting',
    startTime: 'Jun 20, 2026, 12:10:00 PM',
    stepStartTime: 'Jun 20, 2026, 12:12:00 PM',
    serverTime: 'Jun 20, 2026, 12:13:00 PM',
    constructionTime: 1200,
    watchingAllowed: true,
    rounds: [
        {
            roundNumber: 1,
            games: [
                {
                    tableId: TABLE_ID,
                    matchId: GAME_ID,
                    players: 'Alice - Bob',
                    state: 'Dueling',
                    result: '',
                },
            ],
        },
    ],
    players: [
        {
            playerId: PLAYER_ID,
            name: 'Alice',
            state: 'Dueling',
            points: 3,
            results: '1-0',
            isQuit: false,
        },
    ],
    runningInfo: 'booster/card: 1/3',
};
const DRAFT_VIEW = {
    draftId: DRAFT_ID,
    players: [
        { playerId: PLAYER_ID, name: 'Alice', picks: 3 },
    ],
    boosterNum: 1,
    cardNum: 3,
};
const DRAFT_PICK_VIEW = {
    booster: {
        [CARD_ID]: API_SIMPLE_CARD,
    },
    picks: {},
    picking: true,
    timeout: 45,
};
const ROOM_USERS_VIEW = {
    numberActiveGames: 4,
    numberGameThreads: 2,
    numberMaxGames: 10,
    usersView: [
        {
            flagName: 'world.png',
            userName: 'Alice',
            matchHistory: '10-2',
            matchQuitRatio: 0,
            tourneyHistory: '3-1',
            tourneyQuitRatio: 0,
            infoGames: 'In lobby',
            infoPing: '21 ms',
            generalRating: 1600,
            constructedRating: 1650,
            limitedRating: 1500,
        },
    ],
};
const USER_REQUEST = {
    title: 'Concede match?',
    message: 'Are you sure you want to concede the match?',
    windowSizeRatio: 1.1,
    gameId: GAME_ID,
    tableId: TABLE_ID,
    roomId: ROOM_ID,
    tournamentId: TOURNAMENT_ID,
    button2Text: 'Cancel',
    button2Action: null,
    button1Text: 'Concede',
    button1Action: 'CLIENT_CONCEDE_MATCH',
};
const CHAT_MESSAGE = {
    username: 'SERVER',
    time: 'Jun 20, 2026, 12:15:00 PM',
    turnInfo: 'Turn 1',
    message: 'Alice joined the table.',
    color: 'ORANGE',
    soundToPlay: 'PlayerSubmittedDeck',
    messageType: 'STATUS',
};
const CHAT_CALLBACK = {
    messageId: 30,
    method: 'chatMessage',
    objectId: CHAT_ID,
    data: CHAT_MESSAGE,
};
test('accepts Java Gson-shaped view fixtures for core web models', () => {
    const tournamentView = TOURNAMENT_VIEW;
    assert.equal(GAME_VIEW.myHand[CARD_ID].name, 'Lightning Bolt');
    assert.equal(GAME_VIEW.players[0].commandList.length, 0);
    assert.equal(DECK_VIEW.cards[CARD_ID].usesVariousArt, false);
    assert.equal(TABLE_VIEW.tableState, TableState.WAITING);
    assert.equal(tournamentView.tournamentId, undefined);
    assert.equal(DRAFT_VIEW.players[0].picks, 3);
    assert.equal(DRAFT_PICK_VIEW.picking, true);
    assert.equal(ROOM_USERS_VIEW.usersView[0].userName, 'Alice');
    assert.equal(ROOM_USERS_VIEW.numberMaxGames, 10);
    assert.equal(USER_REQUEST.button1Action, 'CLIENT_CONCEDE_MATCH');
    assert.equal(CHAT_MESSAGE.username, 'SERVER');
    assert.equal(CHAT_CALLBACK.data.messageType, 'STATUS');
});
