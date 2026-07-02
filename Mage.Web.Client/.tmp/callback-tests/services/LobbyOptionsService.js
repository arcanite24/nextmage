const KNOWN_PLAYER_TYPES = [
    { enumName: 'HUMAN', label: 'Human', isAI: false, isWorkablePlayer: true },
    { enumName: 'COMPUTER_DRAFT_BOT', label: 'Computer - draftbot', isAI: true, isWorkablePlayer: false },
    { enumName: 'COMPUTER_MONTE_CARLO', label: 'Computer - monte carlo', isAI: true, isWorkablePlayer: true },
    { enumName: 'COMPUTER_MAD', label: 'Computer - mad', isAI: true, isWorkablePlayer: true },
];
export const FALLBACK_LOBBY_SERVER_OPTIONS = {
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
    ],
    tournamentGameTypes: [
        {
            name: 'Two Player Duel',
            minPlayers: 2,
            maxPlayers: 2,
            numTeams: 0,
            playersPerTeam: 0,
            useRange: false,
            useAttackOption: false,
        },
    ],
    deckTypes: ['Constructed - Standard'],
    playerTypes: KNOWN_PLAYER_TYPES.map(type => toPlayerTypeOption(type)),
    tournamentTypes: [],
    draftCubes: [],
};
export function normalizeLobbyServerOptions(serverState) {
    const gameTypes = normalizeGameTypes(serverState?.gameTypes);
    const tournamentGameTypes = normalizeGameTypes(serverState?.tournamentGameTypes);
    const deckTypes = normalizeStringList(serverState?.deckTypes);
    const playerTypes = normalizePlayerTypes(serverState?.playerTypes);
    const tournamentTypes = Array.isArray(serverState?.tournamentTypes) ? serverState.tournamentTypes : [];
    const draftCubes = normalizeStringList(serverState?.draftCubes);
    return {
        gameTypes: gameTypes.length > 0 ? gameTypes : FALLBACK_LOBBY_SERVER_OPTIONS.gameTypes,
        tournamentGameTypes: tournamentGameTypes.length > 0
            ? tournamentGameTypes
            : deriveTournamentGameTypes(gameTypes),
        deckTypes: deckTypes.length > 0 ? deckTypes : FALLBACK_LOBBY_SERVER_OPTIONS.deckTypes,
        playerTypes: playerTypes.length > 0 ? playerTypes : FALLBACK_LOBBY_SERVER_OPTIONS.playerTypes,
        tournamentTypes,
        draftCubes,
    };
}
export function getDefaultGameTypeName(options) {
    return options.gameTypes.find(gameType => gameType.name === 'Two Player Duel')?.name
        ?? options.gameTypes[0]?.name
        ?? FALLBACK_LOBBY_SERVER_OPTIONS.gameTypes[0].name;
}
export function getDefaultDeckType(options) {
    const preferredDeckTypes = [
        'Constructed - Standard',
        'Constructed - Pioneer',
        'Constructed - Modern',
        'Constructed - Pauper',
        'Limited',
    ];
    for (const deckType of preferredDeckTypes) {
        if (options.deckTypes.includes(deckType))
            return deckType;
    }
    return options.deckTypes[0] ?? FALLBACK_LOBBY_SERVER_OPTIONS.deckTypes[0];
}
export function getHumanPlayerType(options) {
    return options.playerTypes.find(type => !type.isAI)?.value
        ?? FALLBACK_LOBBY_SERVER_OPTIONS.playerTypes[0].value;
}
export function getDefaultComputerPlayerType(options) {
    return options.playerTypes.find(type => type.label === 'Computer - mad')?.value
        ?? options.playerTypes.find(type => type.isAI && type.isWorkablePlayer)?.value
        ?? options.playerTypes.find(type => type.isAI)?.value
        ?? getHumanPlayerType(options);
}
export function findGameType(options, gameTypeName) {
    return options.gameTypes.find(gameType => gameType.name === gameTypeName)
        ?? FALLBACK_LOBBY_SERVER_OPTIONS.gameTypes[0];
}
export function getClampedPlayerCount(gameType, requestedCount) {
    const minPlayers = Math.max(1, gameType.minPlayers || 2);
    const maxPlayers = Math.max(minPlayers, gameType.maxPlayers || minPlayers);
    if (!Number.isFinite(requestedCount))
        return minPlayers;
    return Math.min(maxPlayers, Math.max(minPlayers, Math.round(requestedCount)));
}
export function resizePlayerTypes(playerTypes, count, humanPlayerType) {
    const next = playerTypes.slice(0, count);
    while (next.length < count) {
        next.push(humanPlayerType);
    }
    next[0] = humanPlayerType;
    return next;
}
export function validateDeckGameTypePair(gameType, deckType) {
    switch (deckType) {
        case 'Variant Magic - Commander':
        case 'Variant Magic - Duel Commander':
        case 'Variant Magic - MTGO 1v1 Commander':
        case 'Variant Magic - Centurion Commander':
        case 'Variant Magic - Penny Dreadful Commander':
            if (!gameType.startsWith('Commander')) {
                return 'Deck type Commander needs also a Commander game type';
            }
            break;
        case 'Variant Magic - Freeform Commander':
            if (!gameType.startsWith('Freeform Commander')) {
                return 'Deck type Freeform Commander needs also a Freeform Commander game type';
            }
            break;
        case 'Variant Magic - Freeform Unlimited Commander':
            if (!gameType.startsWith('Freeform Unlimited Commander')) {
                return 'Deck type Freeform+ Commander needs also a Freeform Unlimited Commander game type';
            }
            break;
        case 'Variant Magic - Brawl':
        case 'Variant Magic - Duel Brawl':
            if (!gameType.startsWith('Brawl')) {
                return 'Deck type Brawl needs also a Brawl game type';
            }
            break;
        case 'Variant Magic - Tiny Leaders':
            if (!gameType.startsWith('Tiny Leaders')) {
                return 'Deck type Tiny Leaders needs also a Tiny Leaders game type';
            }
            break;
        case 'Variant Magic - Momir Basic':
            if (!gameType.startsWith('Momir Basic')) {
                return 'Deck type Momir Basic needs also a Momir Basic game type';
            }
            break;
        case 'Variant Magic - Oathbreaker':
            if (!gameType.startsWith('Oathbreaker')) {
                return 'Deck type Oathbreaker needs also a Oathbreaker game type';
            }
            break;
    }
    switch (gameType) {
        case 'Commander Two Player Duel':
        case 'Commander Free For All':
            if (![
                'Variant Magic - Commander',
                'Variant Magic - Duel Commander',
                'Variant Magic - MTGO 1v1 Commander',
                'Variant Magic - Centurion Commander',
                'Variant Magic - Freeform Commander',
                'Variant Magic - Penny Dreadful Commander',
            ].includes(deckType)) {
                return 'Deck type Commander needs also a Commander game type';
            }
            break;
        case 'Freeform Commander Two Player Duel':
        case 'Freeform Commander Free For All':
            if (deckType !== 'Variant Magic - Freeform Commander') {
                return 'Deck type Freeform Commander needs also a Freeform Commander game type';
            }
            break;
        case 'Freeform Unlimited Commander':
            if (deckType !== 'Variant Magic - Freeform Unlimited Commander') {
                return 'Deck type Freeform Unlimited Commander needs also a Freeform Unlimited Commander game type';
            }
            break;
        case 'Brawl Two Player Duel':
        case 'Brawl Free For All':
            if (!['Variant Magic - Brawl', 'Variant Magic - Duel Brawl'].includes(deckType)) {
                return 'Deck type Brawl needs also a Brawl game type';
            }
            break;
        case 'Tiny Leaders Two Player Duel':
            if (deckType !== 'Variant Magic - Tiny Leaders') {
                return 'Deck type Tiny Leaders needs also a Tiny Leaders game type';
            }
            break;
        case 'Oathbreaker Two Player Duel':
        case 'Oathbreaker Free For All':
            if (deckType !== 'Variant Magic - Oathbreaker') {
                return 'Deck type Oathbreaker needs also a Oathbreaker game type';
            }
            break;
    }
    return null;
}
export function isLimitedDeckType(deckType) {
    return deckType.startsWith('Limited')
        || deckType.startsWith('Variant Magic - Freeform Unlimited Commander');
}
function normalizeGameTypes(value) {
    if (!Array.isArray(value))
        return [];
    return value.map(normalizeGameType).filter((gameType) => gameType !== null);
}
function normalizeGameType(value) {
    if (typeof value === 'string') {
        return {
            name: value,
            minPlayers: 2,
            maxPlayers: value.includes('Free For All') ? 4 : 2,
            numTeams: 0,
            playersPerTeam: 0,
            useRange: value.includes('Free For All'),
            useAttackOption: value.includes('Free For All'),
        };
    }
    if (!value || typeof value !== 'object')
        return null;
    const candidate = value;
    if (typeof candidate.name !== 'string' || !candidate.name.trim())
        return null;
    return {
        name: candidate.name,
        minPlayers: normalizeInteger(candidate.minPlayers, 2),
        maxPlayers: normalizeInteger(candidate.maxPlayers, 2),
        numTeams: normalizeInteger(candidate.numTeams, 0),
        playersPerTeam: normalizeInteger(candidate.playersPerTeam, 0),
        useRange: Boolean(candidate.useRange),
        useAttackOption: Boolean(candidate.useAttackOption),
    };
}
function normalizePlayerTypes(value) {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    const options = [];
    for (const playerType of value) {
        const normalized = normalizePlayerType(playerType);
        if (!normalized || seen.has(normalized.value))
            continue;
        seen.add(normalized.value);
        options.push(normalized);
    }
    return options;
}
function normalizePlayerType(value) {
    if (typeof value !== 'string' || !value.trim())
        return null;
    const rawValue = value.trim();
    const known = findKnownPlayerType(rawValue);
    if (known) {
        return toPlayerTypeOption(known, rawValue);
    }
    const isAI = rawValue.toLowerCase().startsWith('computer');
    return {
        value: rawValue,
        label: rawValue,
        rawValue,
        isAI,
        isWorkablePlayer: !rawValue.toLowerCase().includes('draftbot'),
    };
}
function toPlayerTypeOption(known, rawValue = known.enumName) {
    return {
        value: known.label,
        label: known.label,
        rawValue,
        isAI: known.isAI,
        isWorkablePlayer: known.isWorkablePlayer,
    };
}
function findKnownPlayerType(value) {
    const normalized = value.trim().toLowerCase();
    return KNOWN_PLAYER_TYPES.find(type => type.enumName.toLowerCase() === normalized || type.label.toLowerCase() === normalized) ?? null;
}
function deriveTournamentGameTypes(gameTypes) {
    const tournamentGameTypes = gameTypes.filter(gameType => gameType.minPlayers === 2 && gameType.maxPlayers === 2);
    return tournamentGameTypes.length > 0
        ? tournamentGameTypes
        : FALLBACK_LOBBY_SERVER_OPTIONS.tournamentGameTypes;
}
function normalizeStringList(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value
            .filter((item) => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim()))];
}
function normalizeInteger(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}
