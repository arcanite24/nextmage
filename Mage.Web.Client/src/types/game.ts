/**
 * Game State Types
 * 
 * These types represent the game state models sent by the XMage server.
 */

import {
    UUID,
    Zone,
    TurnPhase,
    PhaseStep,
    MageObjectType,
    Rarity,
    ObjectColor,
} from './api';

// === Card Views ===

export interface PlayableObjectStats {
    playableAmount: number;
}

export interface SimpleCardView {
    id: UUID;
    expansionSetCode: string;
    cardNumber: string;
    usesVariousArt: boolean;
    gameObject: boolean;
    isChoosable: boolean;
    isSelected: boolean;
    playableStats: PlayableObjectStats;
}

export interface CardView extends SimpleCardView {
    parentId?: UUID;
    name: string;
    displayName: string;
    displayFullName: string;
    rules: string[];
    power: string;
    toughness: string;
    loyalty: string;
    defense: string;
    startingLoyalty?: string;
    startingDefense?: string;
    cardTypes: string[];
    subTypes: string[];
    superTypes: string[];
    color: ObjectColor;
    frameColor: ObjectColor;
    frameStyle: string;
    manaCostLeftStr?: string[];
    manaCostRightStr?: string[];
    manaValue: number;
    rarity: Rarity;
    mageObjectType: MageObjectType;
    isToken: boolean;
    isAbility: boolean;
    abilityType?: string;

    // Transform/Flip info
    transformable: boolean;
    transformed: boolean;
    secondCardFace?: CardView;
    flipCard: boolean;
    faceDown: boolean;
    alternateName?: string;

    // Double-faced / Split card data
    isSplitCard: boolean;
    leftSplitName?: string;
    leftSplitCostsStr?: string;
    leftSplitRules?: string[];
    leftSplitTypeLine?: string;
    rightSplitName?: string;
    rightSplitCostsStr?: string;
    rightSplitRules?: string[];
    rightSplitTypeLine?: string;
    isDoubleFacedCard: boolean;

    // Interactive state
    targets?: UUID[];
    paid: boolean;
    counters?: CounterView[];
    controlledByOwner: boolean;
    zone?: Zone;
    rotate: boolean;
    hideInfo: boolean;
    canAttack: boolean;
    canBlock: boolean;
    inViewerOnly: boolean;
}

export interface PermanentView extends CardView {
    tapped: boolean;
    flipped: boolean;
    phasedIn: boolean;
    summoningSickness: boolean;
    damage: number;
    attachments: UUID[];
    original?: CardView;
    copy: boolean;
    nameOwner: string;
    nameController: string;
    controlled: boolean;
    attachedTo?: UUID;
    attachedToPermanent: boolean;
    attachedControllerDiffers: boolean;

    // Face-down states
    morphed: boolean;
    manifested: boolean;
    disguised: boolean;
    cloaked: boolean;
}

export interface StackAbilityView extends CardView {
    sourceCard: CardView;
}

// === Supporting Views ===

export interface CounterView {
    name: string;
    count: number;
}

export interface ManaPoolView {
    red: number;
    green: number;
    blue: number;
    white: number;
    black: number;
    colorless: number;
}

export interface ExileView {
    id: UUID;
    name: string;
    cards: CardsView;
}

export interface RevealedView {
    name: string;
    cards: CardsView;
}

export type LookedAtView = RevealedView;

export interface CombatGroupView {
    defenders: UUID[];
    attackers: CardsView;
    blockers: CardsView;
    isBlocked: boolean;
    defenderName: string;
    defenderId: UUID;
}

export interface CommandObjectView {
    id: UUID;
    name: string;
    expansionSetCode: string;
    imageFileName: string;
    imageNumber: number;
    rules: string[];
}

// === Map Types ===

export type CardsView = Record<UUID, CardView>;
export type SimpleCardsView = Record<UUID, SimpleCardView>;
export type PermanentsView = Record<UUID, PermanentView>;

// === Player View ===

export interface PlayerView {
    playerId: UUID;
    name: string;
    controlled: boolean;
    isHuman: boolean;
    life: number;
    counters: CounterView[];
    wins: number;
    winsNeeded: number;
    libraryCount: number;
    handCount: number;
    manaPool: ManaPoolView;
    graveyard: CardsView;
    exile: CardsView;
    sideboard: CardsView;
    battlefield: PermanentsView;
    topCard?: CardView;
    userData: UserData;
    commandObjectList: CommandObjectView[];
    attachments: UUID[];

    // Timer state
    priorityTimeLeftSecs: number;
    bufferTimeLeft: number;
    timerActive: boolean;

    // Game state
    isActive: boolean;
    hasPriority: boolean;
    hasLeft: boolean;

    // Auto-pass state (F-key states)
    passedTurn: boolean;
    passedUntilEndOfTurn: boolean;
    passedUntilNextMain: boolean;
    passedUntilStackResolved: boolean;
    passedAllTurns: boolean;
    passedUntilEndStepBeforeMyTurn: boolean;

    // Designations
    monarch: boolean;
    initiative: boolean;
    designationNames: string[];
}

// === Main Game View ===

export interface PlayableObjectsList {
    objects: Record<UUID, PlayableObjectStats>;
}

export interface GameView {
    priorityTime: number;
    bufferTime: number;
    players: PlayerView[];
    myPlayerId: UUID | null;
    myHand: CardsView;
    myHelperEmblems: CardsView;
    canPlayObjects?: PlayableObjectsList;
    opponentHands: Record<string, SimpleCardsView>;
    watchedHands: Record<string, SimpleCardsView>;
    stack: CardsView;
    exiles: ExileView[];
    revealed: RevealedView[];
    lookedAt: LookedAtView[];
    companion: RevealedView[];
    combat: CombatGroupView[];
    phase: TurnPhase;
    step: PhaseStep;
    activePlayerId: UUID;
    activePlayerName: string;
    priorityPlayerName: string;
    turn: number;
    special: boolean;
    rollbackTurnsAllowed: boolean;

    // Debug info
    totalErrorsCount: number;
    totalEffectsCount: number;
    gameCycle: number;
}

// === Game End View ===

export interface GameEndView {
    winners: string[];
    losers: string[];
    matchWinner?: string;
    matchLosers?: string[];
}

export interface EndGameInfo {
    additionalInfo: string;
    clientPlayer: PlayerView;
    endTime: string;
    gameInfo: string;
    loses: number;
    matchInfo: string;
    // matchView: MatchView; // avoiding circular dependency if possible, or just use any/object for now
    matchView: any;
    players: PlayerView[];
    startTime: string;
    wins: number;
    winsNeeded: number;
    won: boolean;
}

// === User Data ===

export interface SkipPrioritySteps {
    upkeep: boolean;
    draw: boolean;
    main1: boolean;
    beforeCombat: boolean;
    endOfCombat: boolean;
    main2: boolean;
    endOfTurn: boolean;
}

export interface UserSkipPrioritySteps {
    yourTurn: SkipPrioritySteps;
    opponentTurn: SkipPrioritySteps;
    stopOnDeclareAttackers: boolean;
    stopOnDeclareBlockersWithZeroPermanents: boolean;
    stopOnDeclareBlockersWithAnyPermanents: boolean;
    stopOnAllMainPhases: boolean;
    stopOnAllEndPhases: boolean;
    stopOnStackNewObjects: boolean;
}

export interface UserData {
    groupId: number;
    avatarId: number;
    allowRequestShowHandCards: boolean;
    confirmEmptyManaPool: boolean;
    userSkipPrioritySteps: UserSkipPrioritySteps;
    flagName: string;
    askMoveToGraveOrder: boolean;
    manaPoolAutomatic: boolean;
    manaPoolAutomaticRestricted: boolean;
    passPriorityCast: boolean;
    passPriorityActivation: boolean;
    autoOrderTrigger: boolean;
    autoTargetLevel: number;
    useSameSettingsForReplacementEffects: boolean;
    useFirstManaAbility: boolean;
    userIdStr?: string;

    // Statistics (read-only, set by server)
    matchHistory?: string;
    matchQuitRatio?: number;
    tourneyHistory?: string;
    tourneyQuitRatio?: number;
    generalRating?: number;
    constructedRating?: number;
    limitedRating?: number;
}

// === Ability Picker ===

export interface AbilityPickerView {
    message: string;
    abilities: Record<UUID, string>;
}
