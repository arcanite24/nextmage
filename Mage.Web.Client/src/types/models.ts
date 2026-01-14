/**
 * Lobby, Table, Tournament, and Deck Models
 */

import { UUID, TableState, SkillLevel } from './api';

// === Lobby/Table Models ===

export interface SeatView {
    seatNum: number;
    name: string;
    playerType: string;
}


export interface TableView {
    tableId: UUID;
    tableName: string;
    controllerName: string;
    gameType: string;
    deckType: string;
    spectatorsAllowed: boolean;
    createTime: string;
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
    startTime: string;
    endTime: string;
    replayAvailable: boolean;
    isTournament: boolean;
    isRated: boolean;
}

// === Users ===

export interface UserView {
    name: string;
    matchHistory: string;
    matchQuitRatio: number;
    tourneyHistory: string;
    tourneyQuitRatio: number;
    flagName: string;
    generalRating: number;
    constructedRating: number;
    limitedRating: number;
}

export interface UsersView {
    users: UserView[];
}

export interface RoomUsersView {
    usersView: UsersView;
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

export interface DeckCardLists {
    name?: string;
    author?: string;
    cards: DeckCardInfo[];
    sideboard: DeckCardInfo[];
    cardLayout?: DeckCardLayout;
    sideboardLayout?: DeckCardLayout;
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
    customStartLifeEnabled?: boolean;
    customStartLife?: number;
    customStartHandSizeEnabled?: boolean;
    customStartHandSize?: number;
    mulliganType?: string;
    quitRatio?: number;
    minimumRating?: number;
    edhPowerLevel?: string;
}


// === Draft Models ===

export interface DraftPlayerView {
    playerId: UUID;
    name: string;
    picks: number;
}

export interface DraftView {
    draftId: UUID;
    players: DraftPlayerView[];
    boosterNum: number;
    cardNum: number;
}

export interface DraftPickView {
    booster: Record<UUID, unknown>;
    picks: Record<UUID, unknown>;
    timeout: number;
    message: string;
}

// === Tournament Models ===

export interface TournamentGameView {
    tableId: UUID;
    matchId?: UUID;
    players: string;
    state: string;
    result: string;
}

export interface RoundView {
    roundNumber: number;
    games: TournamentGameView[];
}

export interface TournamentPlayerView {
    playerId: UUID;
    name: string;
    state: string;
    points: number;
    results: string;
    isQuit: boolean;
}

export interface TournamentView {
    tournamentId: UUID;
    tournamentName: string;
    tournamentType: string;
    startTime: string;
    endTime?: string;
    rounds: RoundView[];
    players: TournamentPlayerView[];
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
    numSeats: number;
    isElimination: boolean;
    isLimited: boolean;
    isDraft: boolean;
    isSealed: boolean;
    isCubeBooster: boolean;
    isRandomPoolsBooster: boolean;
}

export interface MageVersion {
    major: number;
    minor: number;
    patch: number;
    info: string;
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
