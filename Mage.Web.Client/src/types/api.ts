/**
 * XMage Web Client API Types
 * 
 * These TypeScript interfaces mirror the Java classes serialized by the XMage server.
 * All Java objects are serialized via Gson: Maps become JSON objects with string keys,
 * Lists become JSON arrays, and enums are serialized as their string names.
 */

// === Core Types ===

export type UUID = string;

export enum Zone {
  HAND = "HAND",
  GRAVEYARD = "GRAVEYARD",
  LIBRARY = "LIBRARY",
  BATTLEFIELD = "BATTLEFIELD",
  STACK = "STACK",
  EXILED = "EXILED",
  ALL = "ALL",
  OUTSIDE = "OUTSIDE",
  COMMAND = "COMMAND"
}

export enum TurnPhase {
  BEGINNING = "BEGINNING",
  PRECOMBAT_MAIN = "PRECOMBAT_MAIN",
  COMBAT = "COMBAT",
  POSTCOMBAT_MAIN = "POSTCOMBAT_MAIN",
  END = "END"
}

export enum PhaseStep {
  UNTAP = "UNTAP",
  UPKEEP = "UPKEEP",
  DRAW = "DRAW",
  PRECOMBAT_MAIN = "PRECOMBAT_MAIN",
  BEGIN_COMBAT = "BEGIN_COMBAT",
  DECLARE_ATTACKERS = "DECLARE_ATTACKERS",
  DECLARE_BLOCKERS = "DECLARE_BLOCKERS",
  FIRST_COMBAT_DAMAGE = "FIRST_COMBAT_DAMAGE",
  COMBAT_DAMAGE = "COMBAT_DAMAGE",
  END_COMBAT = "END_COMBAT",
  POSTCOMBAT_MAIN = "POSTCOMBAT_MAIN",
  END_TURN = "END_TURN",
  CLEANUP = "CLEANUP"
}

export enum MageObjectType {
  ABILITY_STACK_FROM_CARD = "ABILITY_STACK_FROM_CARD",
  ABILITY_STACK_FROM_TOKEN = "ABILITY_STACK_FROM_TOKEN",
  CARD = "CARD",
  COPY_CARD = "COPY_CARD",
  TOKEN = "TOKEN",
  SPELL = "SPELL",
  PERMANENT = "PERMANENT",
  DUNGEON = "DUNGEON",
  EMBLEM = "EMBLEM",
  COMMANDER = "COMMANDER",
  DESIGNATION = "DESIGNATION",
  PLANE = "PLANE",
  NULL = "NULL"
}

export enum Rarity {
  LAND = "LAND",
  COMMON = "COMMON",
  UNCOMMON = "UNCOMMON",
  RARE = "RARE",
  MYTHIC = "MYTHIC",
  SPECIAL = "SPECIAL",
  BONUS = "BONUS"
}

export enum ManaType {
  WHITE = "WHITE",
  BLUE = "BLUE",
  BLACK = "BLACK",
  RED = "RED",
  GREEN = "GREEN",
  COLORLESS = "COLORLESS"
}

export enum TableState {
  WAITING = "WAITING",
  READY_TO_START = "READY_TO_START",
  STARTING = "STARTING",
  DRAFTING = "DRAFTING",
  SIDEBOARDING = "SIDEBOARDING",
  CONSTRUCTING = "CONSTRUCTING",
  DUELING = "DUELING",
  FINISHED = "FINISHED"
}

export enum SkillLevel {
  BEGINNER = "BEGINNER",
  CASUAL = "CASUAL",
  SERIOUS = "SERIOUS"
}

export interface ObjectColor {
  white: boolean;
  blue: boolean;
  black: boolean;
  red: boolean;
  green: boolean;
}

// === Deck / Table Messages ===
export enum DeckEditorMode {
  SIDEBOARDING = "SIDEBOARDING",
  LIMITED_BUILDING = "LIMITED_BUILDING",
  LIMITED_SIDEBOARD_BUILDING = "LIMITED_SIDEBOARD_BUILDING",
  VIEW_LIMITED_DECK = "VIEW_LIMITED_DECK"
}

export interface SimpleCardView {
  id: UUID;
  expansionSetCode: string; // e.g. "M21"
  cardNumber: string; // e.g. "100"
  usesVariousArt: boolean;
  gameObject: boolean;
  isChoosable: boolean;
  isSelected: boolean;
  playableStats?: {
    playableAmount: number;
  };
  cardTypes?: CardType[];
  subTypes?: SubType[];
  superTypes?: SuperType[];
  color?: ObjectColor;
  manaCostLeftStr?: string[];
  manaCostRightStr?: string[];
  manaValue?: number;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  rarity?: Rarity;
  isSplitCard?: boolean;
  isDoubleFacedCard?: boolean;
  name?: string;
  displayName?: string;
  rules?: string[];
}

export interface SimpleCardsView extends Record<UUID, SimpleCardView> { }

export interface DeckView {
  name: string;
  cards: SimpleCardsView;
  sideboard: SimpleCardsView;
}

export interface TableClientMessage {
  roomId?: UUID;
  currentTableId: UUID;
  parentTableId?: UUID;
  gameId?: UUID;
  playerId?: UUID;
  deck?: DeckView;
  time?: number;
  flag?: boolean; // generic flag, usage depends on method
}

export interface UserRequestMessage {
  title: string;
  message: string;
  windowSizeRatio?: number;
  relatedUserId?: UUID;
  relatedUserName?: string;
  matchId?: UUID;
  tournamentId?: UUID;
  gameId?: UUID;
  roomId?: UUID;
  tableId?: UUID;
  button1Text?: string;
  button1Action?: PlayerAction | null;
  button2Text?: string;
  button2Action?: PlayerAction | null;
  button3Text?: string;
  button3Action?: PlayerAction | null;
}

// === Server Callback ===


export interface ClientCallback {
  messageId: number;
  method: ClientCallbackMethod;
  objectId: UUID | null;
  data: unknown;
}

export type ClientCallbackMethod =
  // Messages
  | "chatMessage"
  | "showUserMessage"
  | "serverMessage"
  // Table
  | "joinedTable"
  // Tournament
  | "startTournament"
  | "tournamentInit"
  | "tournamentUpdate"
  | "tournamentOver"
  // Draft/Sideboard
  | "startDraft"
  | "SIDEBOARD"
  | "sideboard"
  | "construct"
  | "draftOver"
  | "draftInit"
  | "draftPick"
  | "draftUpdate"
  // Watch
  | "showTournament"
  | "watchGame"
  // In-game actions
  | "viewLimitedDeck"
  | "viewSideboard"
  // Other
  | "userRequestDialog"
  | "gameRedrawGUI"
  // Game
  | "startGame"
  | "gameInit"
  | "gameInform"
  | "gameUpdateAndInform"
  | "gameInformPersonal"
  | "gameError"
  | "gameUpdate"
  | "gameTarget"
  | "gameChooseAbility"
  | "gameChoosePile"
  | "gameChooseChoice"
  | "gameAsk"
  | "gameSelect"
  | "gamePlayMana"
  | "gamePlayXMana"
  | "gameSelectAmount"
  | "gameGetAmount"
  | "gameSelectMultiAmount"
  | "gameGetMultiAmount"
  | "gameOver"
  | "endGameInfo"
  // Replay
  | "replayGame"
  | "replayInit"
  | "replayUpdate"
  | "replayDone";

// === JSON-RPC Messages ===

export interface JsonRpcRequest {
  method: string;
  params: unknown[];
  id: number;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  result?: T;
  error?: string;
  id: number;
}

// === Player Actions ===

export type PlayerAction =
  // Priority Control
  | "PASS_PRIORITY_UNTIL_MY_NEXT_TURN"
  | "PASS_PRIORITY_UNTIL_TURN_END_STEP"
  | "PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE"
  | "PASS_PRIORITY_UNTIL_NEXT_TURN"
  | "PASS_PRIORITY_UNTIL_NEXT_TURN_SKIP_STACK"
  | "PASS_PRIORITY_UNTIL_STACK_RESOLVED"
  | "PASS_PRIORITY_UNTIL_END_STEP_BEFORE_MY_NEXT_TURN"
  | "PASS_PRIORITY_CANCEL_ALL_ACTIONS"
  | "HOLD_PRIORITY"
  | "UNHOLD_PRIORITY"
  // Game Actions
  | "UNDO"
  | "CONCEDE"
  | "ROLLBACK_TURNS"
  // Mana Pool
  | "MANA_AUTO_PAYMENT_ON"
  | "MANA_AUTO_PAYMENT_OFF"
  | "MANA_AUTO_PAYMENT_RESTRICTED_ON"
  | "MANA_AUTO_PAYMENT_RESTRICTED_OFF"
  | "USE_FIRST_MANA_ABILITY_ON"
  | "USE_FIRST_MANA_ABILITY_OFF"
  // Trigger Ordering
  | "TRIGGER_AUTO_ORDER_ABILITY_FIRST"
  | "TRIGGER_AUTO_ORDER_ABILITY_LAST"
  | "TRIGGER_AUTO_ORDER_NAME_FIRST"
  | "TRIGGER_AUTO_ORDER_NAME_LAST"
  | "TRIGGER_AUTO_ORDER_RESET_ALL"
  | "RESET_AUTO_SELECT_REPLACEMENT_EFFECTS"
  // Permissions
  | "REQUEST_PERMISSION_TO_SEE_HAND_CARDS"
  | "ADD_PERMISSION_TO_SEE_HAND_CARDS"
  | "REVOKE_PERMISSIONS_TO_SEE_HAND_CARDS"
  | "PERMISSION_REQUESTS_ALLOWED_ON"
  | "PERMISSION_REQUESTS_ALLOWED_OFF"
  | "REQUEST_PERMISSION_TO_ROLLBACK_TURN"
  | "ADD_PERMISSION_TO_ROLLBACK_TURN"
  | "DENY_PERMISSION_TO_ROLLBACK_TURN"
  // Auto-Answer
  | "REQUEST_AUTO_ANSWER_ID_YES"
  | "REQUEST_AUTO_ANSWER_ID_NO"
  | "REQUEST_AUTO_ANSWER_TEXT_YES"
  | "REQUEST_AUTO_ANSWER_TEXT_NO"
  | "REQUEST_AUTO_ANSWER_RESET_ALL"
  // Client Actions
  | "CLIENT_DOWNLOAD_SYMBOLS"
  | "CLIENT_DOWNLOAD_CARD_IMAGES"
  | "CLIENT_CONCEDE_GAME"
  | "CLIENT_CONCEDE_MATCH"
  | "CLIENT_QUIT_TOURNAMENT"
  | "CLIENT_QUIT_DRAFT_TOURNAMENT"
  | "CLIENT_STOP_WATCHING"
  | "CLIENT_DISCONNECT_FULL"
  | "CLIENT_DISCONNECT_KEEP_GAMES"
  | "CLIENT_EXIT_FULL"
  | "CLIENT_EXIT_KEEP_GAMES"
  | "CLIENT_REMOVE_TABLE"
  | "CLIENT_RECONNECT"
  | "CLIENT_REPLAY_ACTION"
  | "VIEW_LIMITED_DECK"
  | "VIEW_SIDEBOARD"
  | "TOGGLE_RECORD_MACRO";

// === Constants (duplicated from Java) ===

// Card Types
export type CardType = "ARTIFACT" | "CREATURE" | "ENCHANTMENT" | "INSTANT" | "LAND" | "PLANESWALKER" | "SORCERY" | "TRIBAL" | "CONSPIRACY" | "DUNGEON" | "BATTLE";

// Super Types
export type SuperType = "BASIC" | "LEGENDARY" | "ONGOING" | "SNOW" | "WORLD";

// Sub Types (Partial list, as there are hundreds)
export type SubType = string;

// === Deck Editor / Card Search ===

export interface CardSearchCriteria {
  // name?: string; // Exact match not supported via this interface correctly in all cases??
  nameContains?: string;
  searchText?: string;
  searchNames?: boolean;
  searchTypes?: boolean;
  searchRules?: boolean;
  uniqueNames?: boolean;
  format?: string;
  rules?: string;
  type?: string;
  setCodes?: string[];
  types?: CardType[];
  notTypes?: CardType[];
  supertypes?: SuperType[];
  subtypes?: SubType[];
  rarities?: Rarity[];
  excludedRarities?: Rarity[];
  webColors?: string[];
  webExcludedColors?: string[];
  colorMatch?: "any" | "include" | "exact";
  minCardNumber?: number;
  maxCardNumber?: number;
  manaValue?: number;
  manaValueOperator?: "eq" | "lte" | "gte";
  black?: boolean;
  blue?: boolean;
  green?: boolean;
  red?: boolean;
  white?: boolean;
  colorless?: boolean;
  start?: number;
  count?: number;
  sortBy?: "name" | "cardNumber" | "rarity" | "color" | "manaValue";
}

// Simplified definition of CardView as returned by searchCards
export interface SearchSimpleCardView {
  id: UUID;
  name: string;
  displayName: string;
  rules: string[];
  power: string;
  toughness: string;
  loyalty: string;
  defense: string;
  cardTypes: CardType[];
  subTypes: SubType[];
  superTypes: SuperType[];
  expansionSetCode: string;
  cardNumber: string;
  imageFileName: string;
  imageNumber: number;
  color: ObjectColor;
  frameColor: ObjectColor;
  manaValue: number;
  rarity: Rarity;
  isSplitCard: boolean;
  isDoubleFacedCard: boolean;
  manaCostLeftStr?: string[];
  manaCostRightStr?: string[];
}

export interface SearchCardView extends SearchSimpleCardView {
  // Full CardView has more fields, but for deck editor search results, 
  // the backend is sending a View created from a MockCard which has limited data.
  // We can extend this as needed.
}

export interface ExpansionSetInfo {
  setCode: string;
  name: string;
  blockName?: string | null;
  releaseDate: number;
  type?: string | null;
  hasBoosters?: boolean;
  hasBasicLands: boolean;
}

export interface BasicLandSetInfo extends ExpansionSetInfo {
  hasSnowBasics: boolean;
}

export type DeckValidationErrorType = 'PRIMARY' | 'DECK_SIZE' | 'BANNED' | 'WRONG_SET' | 'OTHER' | string;

export interface DeckValidationErrorView {
  type: DeckValidationErrorType;
  group: string;
  message: string;
  cardName?: string | null;
}

export interface DeckValidationResultView {
  deckType: string;
  name: string;
  shortName: string;
  valid: boolean;
  partlyValid: boolean;
  errors: DeckValidationErrorView[];
  edhPowerLevel?: number;
  edhPowerCards?: string[];
  edhPowerDetails?: string[];
  commanderBrackets?: CommanderBracketView[];
}

export interface CommanderBracketGroupView {
  name: string;
  count: number;
  max: number;
  cards: string[];
}

export interface CommanderBracketView {
  level: number;
  name: string;
  shortName: string;
  valid: boolean;
  badCards: string[];
  groups: CommanderBracketGroupView[];
}
