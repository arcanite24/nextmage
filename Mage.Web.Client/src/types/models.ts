/**
 * Lobby, Table, Tournament, and Deck Models
 */

import { UUID, TableState, SkillLevel } from './api.js';

// === Lobby/Table Models ===

export interface SeatView {
    seatNum?: number;
    name?: string;
    playerName?: string;
    playerId?: UUID | null;
    playerType: string;
    flagName?: string;
    history?: string;
    generalRating?: number;
    constructedRating?: number;
    limitedRating?: number;
}


export interface TableView {
    tableId: UUID;
    tableName: string;
    controllerName: string;
    gameType: string;
    deckType: string;
    spectatorsAllowed: boolean;
    createTime: string | number;
    tableState: TableState;
    tableStateText: string;
    seats: SeatView[];
    games: UUID[];
    seatsInfo: string;
    isTournament: boolean;
    additionalInfoShort: string;
    additionalInfoFull: string;
    skillLevel: SkillLevel;
    quitRatio: string;
    minimumRating: string;
    limited: boolean;
    rated: boolean;
    passworded: boolean;
}

export interface MatchView {
    tableId: UUID;
    matchId: UUID;
    matchName: string;
    gameType: string;
    deckType: string;
    games: UUID[];
    result: string;
    players: string;
    startTime: string | number;
    endTime: string | number;
    replayAvailable: boolean;
    isTournament: boolean;
    isRated: boolean;
}

// === Users ===

export interface UserView {
    userName: string;
    host: string;
    sessionId: string;
    timeConnected: string;
    lastActivity: string;
    gameInfo: string;
    userState: string;
    muteChatUntil: string | null;
    clientVersion: string;
    email: string;
    userIdStr: string;
}

export interface UsersView {
    flagName: string;
    userName: string;
    matchHistory: string;
    matchQuitRatio: number;
    tourneyHistory: string;
    tourneyQuitRatio: number;
    infoGames: string;
    infoPing: string;
    generalRating: number;
    constructedRating: number;
    limitedRating: number;
}

export interface RoomUsersView {
    numberActiveGames: number;
    numberGameThreads: number;
    numberMaxGames: number;
    usersView: UsersView[];
}

// === Deck Models ===

export interface DeckCardInfo {
    cardName: string;
    setCode?: string | null;
    cardNumber?: string | null;
    amount: number;
}

export interface DeckCardLayout {
    // Layout information for deck editor
    [key: string]: unknown;
}

export interface DeckCoverCard {
    setCode: string;
    cardNumber: string;
    name?: string;
}

export interface DeckCardLists {
    id?: string;
    name?: string;
    description?: string;
    author?: string;
    format?: string; // e.g. "Constructed - Standard", syncs with deckType
    cards: DeckCardInfo[];
    sideboard: DeckCardInfo[];
    cardLayout?: DeckCardLayout;
    sideboardLayout?: DeckCardLayout;
    coverCard?: DeckCoverCard;
    colors?: {
        white: boolean;
        blue: boolean;
        black: boolean;
        red: boolean;
        green: boolean;
    };
    createdAt?: number;
    updatedAt?: number;
}

// === Match Options ===

export interface MatchOptions {
    name: string;
    gameType: string;
    deckType: string;
    winsNeeded: number;
    freeMulligans: number;
    matchTimeLimit: string;
    matchBufferTime: string;
    attackOption?: string;
    range?: string;
    password?: string;
    skillLevel?: SkillLevel;
    limited: boolean;
    rated: boolean;
    rollbackTurnsAllowed: boolean;
    spectatorsAllowed: boolean;
    playerTypes?: string[];
    planesToUse?: string[];
    perPlayerEmblemCards?: DeckCardInfo[];
    globalEmblemCards?: DeckCardInfo[];
    customStartLifeEnabled?: boolean;
    customStartLife?: number;
    customStartHandSizeEnabled?: boolean;
    customStartHandSize?: number;
    mulliganType?: string;
    planeChase?: boolean;
    quitRatio?: number;
    minimumRating?: number;
    edhPowerLevel?: number;
    bannedUsers?: string[];
}

export type DraftTimingOption = 'BEGINNER' | 'REGULAR' | 'PROFESSIONAL' | 'NONE';

export interface LimitedTournamentOptions {
    sets: string[];
    constructionTime: number;
    draftCubeName?: string | null;
    cubeFromDeck?: DeckCardLists | null;
    jumpstartPacks?: string;
    numberBoosters?: number;
    isRandom?: boolean;
    isReshuffled?: boolean;
    isRichMan?: boolean;
    isJumpstart?: boolean;
    timing?: DraftTimingOption;
}

export interface TournamentOptions {
    name: string;
    tournamentType: string;
    matchOptions: MatchOptions;
    playerTypes: string[];
    playerSkills?: number[];
    watchingAllowed: boolean;
    planeChase?: boolean;
    numberRounds?: number;
    password?: string;
    quitRatio?: number;
    minimumRating?: number;
    singleMultiplayerGame?: boolean;
    limitedOptions?: LimitedTournamentOptions;
}


// === Draft Models ===

export interface DraftView {
    draftId: UUID;
    players: string[];
    setNames?: string[];
    setCodes?: string[];
    boosterNum: number;
    cardNum: number;
    isCube?: boolean;
    cube?: boolean;
}

export interface DraftPickView {
    booster: Record<UUID, unknown>;
    picks: Record<UUID, unknown>;
    picking: boolean;
    timeout: number;
    message?: string;
}

// === Tournament Models ===

export interface TournamentGameView {
    roundNum?: number;
    tableId: UUID;
    matchId?: UUID;
    gameId?: UUID;
    players: string;
    state: string;
    result: string;
}

export interface RoundView {
    roundNumber?: number;
    games: TournamentGameView[];
}

export interface TournamentPlayerView {
    playerId?: UUID;
    name: string;
    state: string;
    points: number;
    results: string;
    flagName?: string;
    history?: string;
    quit?: boolean;
    hasQuit?: boolean;
    isQuit?: boolean;
}

export interface TournamentView {
    tournamentId?: UUID;
    tournamentName: string;
    tournamentType: string;
    tournamentState: string;
    startTime: string | number;
    endTime?: string | number | null;
    stepStartTime?: string | null;
    serverTime?: string | null;
    constructionTime: number;
    watchingAllowed: boolean;
    rounds: RoundView[];
    players: TournamentPlayerView[];
    runningInfo: string;
}

export type ChatMessageColor = 'BLACK' | 'RED' | 'GREEN' | 'BLUE' | 'ORANGE' | 'YELLOW';
export type ChatMessageType = 'USER_INFO' | 'STATUS' | 'GAME' | 'TALK' | 'WHISPER_FROM' | 'WHISPER_TO';
export type ChatSoundToPlay = 'PlayerLeft' | 'PlayerQuitTournament' | 'PlayerSubmittedDeck' | 'PlayerWhispered';

export interface ChatMessageView {
    username: string;
    time: string | null;
    turnInfo: string | null;
    message: string;
    color: ChatMessageColor | null;
    soundToPlay?: ChatSoundToPlay | null;
    messageType: ChatMessageType | null;
}

// === Server State ===

export interface GameTypeView {
    name: string;
    minPlayers: number;
    maxPlayers: number;
    numTeams: number;
    playersPerTeam: number;
    useRange: boolean;
    useAttackOption: boolean;
}

export interface TournamentTypeView {
    name: string;
    minPlayers: number;
    maxPlayers: number;
    numBoosters?: number;
    numSeats?: number;
    isElimination?: boolean;
    elimination?: boolean;
    isLimited?: boolean;
    limited?: boolean;
    isDraft?: boolean;
    draft?: boolean;
    isSealed?: boolean;
    sealed?: boolean;
    isCubeBooster?: boolean;
    cubeBooster?: boolean;
    isRandomPoolsBooster?: boolean;
    isRandom?: boolean;
    random?: boolean;
    isReshuffled?: boolean;
    reshuffled?: boolean;
    isRichMan?: boolean;
    richMan?: boolean;
    isJumpstart?: boolean;
    jumpstart?: boolean;
}

export interface MageVersion {
    major: number;
    minor: number;
    release?: number;
    releaseInfo?: string;
    buildTime?: string;
    patch?: number;
    info?: string;
}

export interface ServerState {
    gameTypes: GameTypeView[];
    tournamentTypes: TournamentTypeView[];
    playerTypes: string[];
    deckTypes: string[];
    draftCubes: string[];
    testMode: boolean;
    version: MageVersion;
    cardsContentVersion: number;
    expansionsContentVersion: number;
}
