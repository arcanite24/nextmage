# XMage Web Client Data Models

This document defines the TypeScript interfaces and types required to interact with the XMage WebSocket API. These models mirror the Java classes serialized by the server.

> **Note:** All Java objects are serialized via Gson. Maps become JSON objects with string keys, Lists become JSON arrays, and enums are serialized as their string names.

---

## 1. Core Types

```typescript
// Java UUIDs are serialized as strings
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
```

---

## 2. Server Callback (ClientCallback)

The main envelope for push messages from the server. Sent automatically when game state changes or events occur.

```typescript
export interface ClientCallback {
  messageId: number;
  method: ClientCallbackMethod;  // e.g. "gameInit", "gameUpdate", "gameAsk", "chatMessage"
  objectId: UUID | null;         // gameId, playerId, roomId, tableId depending on context
  data: unknown;                 // Polymorphic - see method-specific types below
}

// Method names correspond to ClientCallbackMethod enum values
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
  | "gameSelectMultiAmount"
  | "gameOver"
  | "endGameInfo"
  // Replay
  | "replayGame"
  | "replayInit"
  | "replayUpdate"
  | "replayDone";
```

---

## 3. Game State Models

### GameView

The root object representing the current state of a game. Sent with `gameInit`, `gameUpdate`, `gameInform`, and other game-related callbacks.

```typescript
export interface GameView {
  priorityTime: number;
  bufferTime: number;
  players: PlayerView[];
  myPlayerId: UUID | null;           // null for watchers
  myHand: CardsView;                 // Map<UUID, CardView>
  myHelperEmblems: CardsView;        // Helper emblems like Radiation
  canPlayObjects?: PlayableObjectsList;
  opponentHands: Record<string, SimpleCardsView>;  // playerName -> cards
  watchedHands: Record<string, SimpleCardsView>;   // playerName -> cards
  stack: CardsView;                  // Map<UUID, CardView>
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
  special: boolean;                  // Special actions available (Quenchable Fire, etc.)
  rollbackTurnsAllowed: boolean;
  
  // Debug info
  totalErrorsCount: number;
  totalEffectsCount: number;
  gameCycle: number;
}

// CardsView is a Map<UUID, CardView> serialized as an object
export type CardsView = Record<UUID, CardView>;
export type SimpleCardsView = Record<UUID, SimpleCardView>;
```

### PlayerView

Details about a player in the game.

```typescript
export interface PlayerView {
  playerId: UUID;
  name: string;
  controlled: boolean;           // Is this the viewing player?
  isHuman: boolean;
  life: number;
  counters: CounterView[];
  wins: number;
  winsNeeded: number;
  libraryCount: number;
  handCount: number;
  manaPool: ManaPoolView;
  graveyard: CardsView;          // Map<UUID, CardView>
  exile: CardsView;
  sideboard: CardsView;
  battlefield: Record<UUID, PermanentView>;  // Map<UUID, PermanentView>
  topCard?: CardView;            // If library top is revealed
  userData: UserData;
  commandObjectList: CommandObjectView[];  // Commanders, emblems, dungeons
  attachments: UUID[];           // Curses attached to player
  
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
```

### CardView & SimpleCardView

The atomic unit for representing Magic cards.

```typescript
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

export interface PlayableObjectStats {
  playableAmount: number;
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
  cardTypes: string[];           // e.g. ["Creature", "Artifact"]
  subTypes: string[];            // e.g. ["Human", "Wizard"]
  superTypes: string[];          // e.g. ["Legendary", "Basic"]
  color: ObjectColor;
  frameColor: ObjectColor;
  frameStyle: string;            // FrameStyle enum name
  manaCostLeftStr?: string[];    // Left side mana symbols
  manaCostRightStr?: string[];   // Right side mana symbols (split cards)
  manaValue: number;
  rarity: Rarity;
  mageObjectType: MageObjectType;
  isToken: boolean;
  isAbility: boolean;
  abilityType?: string;          // AbilityType enum name
  
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
  targets?: UUID[];              // Objects this card is targeting
  paid: boolean;
  counters?: CounterView[];
  controlledByOwner: boolean;
  zone?: Zone;
  rotate: boolean;               // For plane cards
  hideInfo: boolean;             // Hide card details
  canAttack: boolean;
  canBlock: boolean;
  inViewerOnly: boolean;
  
  // Card icons (complex nested structure)
  // cardIcons: CardIcon[];
}
```

### PermanentView

Extends CardView with battlefield-specific state.

```typescript
export interface PermanentView extends CardView {
  tapped: boolean;
  flipped: boolean;
  phasedIn: boolean;
  summoningSickness: boolean;
  damage: number;
  attachments: UUID[];           // Auras, Equipment attached to this
  original?: CardView;           // Original card before modifications
  copy: boolean;
  nameOwner: string;             // Owner name if different from controller
  nameController: string;
  controlled: boolean;           // Controlled by viewing player
  attachedTo?: UUID;             // What this is attached to
  attachedToPermanent: boolean;
  attachedControllerDiffers: boolean;
  
  // Face-down states
  morphed: boolean;
  manifested: boolean;
  disguised: boolean;
  cloaked: boolean;
}
```

### StackAbilityView

Represents an ability on the stack.

```typescript
export interface StackAbilityView extends CardView {
  sourceCard: CardView;
}
```

---

## 4. Supporting Views

### ManaPoolView

```typescript
export interface ManaPoolView {
  red: number;
  green: number;
  blue: number;
  white: number;
  black: number;
  colorless: number;
}
```

### ExileView

Represents an exile zone. Note: In Java, ExileView extends HashMap, so fields are on the object alongside map entries.

```typescript
export interface ExileView {
  id: UUID;
  name: string;
  [cardId: UUID]: CardView;      // Map entries
}
```

### RevealedView / LookedAtView

```typescript
export interface RevealedView {
  name: string;
  cards: CardsView;              // Map<UUID, CardView>
}

// LookedAtView has the same structure
export type LookedAtView = RevealedView;
```

### CombatGroupView

```typescript
export interface CombatGroupView {
  defenders: UUID[];
  attackers: CardsView;          // Map<UUID, CardView>
  blockers: CardsView;           // Map<UUID, CardView>
  isBlocked: boolean;
  defenderName: string;
  defenderId: UUID;
}
```

### CounterView

```typescript
export interface CounterView {
  name: string;
  count: number;
}
```

### CommandObjectView

For commanders, emblems, dungeons, planes in the command zone.

```typescript
export interface CommandObjectView {
  id: UUID;
  name: string;
  expansionSetCode: string;
  imageFileName: string;
  imageNumber: number;
  rules: string[];
}
```

---

## 5. User Data Models

### UserData

User preferences sent with `connectSetUserData`.

```typescript
export interface UserData {
  groupId: number;               // UserGroup enum ordinal
  avatarId: number;
  allowRequestShowHandCards: boolean;
  confirmEmptyManaPool: boolean;
  userSkipPrioritySteps: UserSkipPrioritySteps;
  flagName: string;              // Country flag filename, e.g. "world.png"
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
```

### UserSkipPrioritySteps

F-key auto-pass settings.

```typescript
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

export interface SkipPrioritySteps {
  upkeep: boolean;
  draw: boolean;
  main1: boolean;
  beforeCombat: boolean;
  endOfCombat: boolean;
  main2: boolean;
  endOfTurn: boolean;
}
```

---

## 6. Lobby/Table Models

### TableView

Represents a table in the lobby.

```typescript
export interface TableView {
  tableId: UUID;
  tableName: string;
  controllerName: string;
  gameType: string;
  deckType: string;
  spectatorsAllowed: boolean;
  createTime: string;            // ISO date string
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
  isLimited: boolean;
  isRated: boolean;
  isPassworded: boolean;
}

export interface SeatView {
  seatNum: number;
  name: string;
  playerType: string;
}
```

### MatchView

Represents a finished or ongoing match.

```typescript
export interface MatchView {
  tableId: UUID;
  matchId: UUID;
  matchName: string;
  gameType: string;
  deckType: string;
  games: UUID[];
  result: string;
  players: string;
  startTime: string;             // ISO date string
  endTime: string;
  replayAvailable: boolean;
  isTournament: boolean;
  isRated: boolean;
}
```

### RoomUsersView

```typescript
export interface RoomUsersView {
  usersView: UsersView;
}

export interface UsersView {
  users: UserView[];
}

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
```

---

## 7. Deck Models

### DeckCardLists

Deck format for submission to tables.

```typescript
export interface DeckCardLists {
  name?: string;
  author?: string;
  cards: DeckCardInfo[];
  sideboard: DeckCardInfo[];
  cardLayout?: DeckCardLayout;
  sideboardLayout?: DeckCardLayout;
}

export interface DeckCardInfo {
  cardName: string;
  setCode: string;
  cardNumber: string;
  quantity: number;
}

export interface DeckCardLayout {
  // Layout information for deck editor
  // Structure varies by UI requirements
}
```

---

## 8. Match Options

### MatchOptions

Options for creating a new table.

```typescript
export interface MatchOptions {
  name: string;
  gameType: string;              // e.g. "Two Player Duel"
  deckType: string;              // e.g. "Constructed - Standard"
  winsNeeded: number;            // Usually 1-3
  freeMulligans: number;
  matchTimeLimit: string;        // MatchTimeLimit enum name
  matchBufferTime: string;       // MatchBufferTime enum name
  attackOption?: string;         // MultiplayerAttackOption enum name
  range?: string;                // RangeOfInfluence enum name
  password?: string;
  skillLevel?: SkillLevel;
  isLimited: boolean;
  isRated: boolean;
  rollbackTurnsAllowed: boolean;
  spectatorsAllowed: boolean;
  planesToUse?: string[];
  customStartLifeEnabled?: boolean;
  customStartLife?: number;
  customStartHandSizeEnabled?: boolean;
  customStartHandSize?: number;
  mulliganType?: string;         // MulliganType enum name
  quitRatio?: number;
  minimumRating?: number;
  edhPowerLevel?: string;
}
```

---

## 9. Draft Models

### DraftView

```typescript
export interface DraftView {
  draftId: UUID;
  players: DraftPlayerView[];
  boosterNum: number;
  cardNum: number;
}

export interface DraftPlayerView {
  playerId: UUID;
  name: string;
  picks: number;
}
```

### DraftPickView

Returned when picking a card in draft.

```typescript
export interface DraftPickView {
  booster: SimpleCardsView;      // Cards available to pick
  picks: CardsView;              // Cards already picked
  timeout: number;               // Time remaining for pick
  message: string;
}
```

---

## 10. Tournament Models

### TournamentView

```typescript
export interface TournamentView {
  tournamentId: UUID;
  tournamentName: string;
  tournamentType: string;
  startTime: string;
  endTime?: string;
  rounds: RoundView[];
  players: TournamentPlayerView[];
}

export interface RoundView {
  roundNumber: number;
  games: TournamentGameView[];
}

export interface TournamentGameView {
  tableId: UUID;
  matchId?: UUID;
  players: string;
  state: string;
  result: string;
}

export interface TournamentPlayerView {
  playerId: UUID;
  name: string;
  state: string;
  points: number;
  results: string;
  isQuit: boolean;
}
```

---

## 11. Server State

### ServerState

Server configuration returned by `getServerState`.

```typescript
export interface ServerState {
  gameTypes: GameTypeView[];
  tournamentTypes: TournamentTypeView[];
  playerTypes: string[];         // PlayerType enum names
  deckTypes: string[];           // Available deck type names
  draftCubes: string[];          // Available draft cube names
  testMode: boolean;             // Server in test mode
  version: MageVersion;
  cardsContentVersion: number;
  expansionsContentVersion: number;
}

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
  numBoosters: number;
  isElimination: boolean;
  isLimited: boolean;
  isCubeBooster: boolean;
  isRandomBooster: boolean;
  isBooster: boolean;
  isJumpstart: boolean;
}

export interface MageVersion {
  major: number;
  minor: number;
  patch: number;
  minorPatch: string;
  buildTime: string;
}
```

---

## 12. Error Handling

The server may send error responses in this format:

```typescript
export interface ErrorResponse {
  jsonrpc: "2.0";
  error: string;
  id?: number;
}
```

For game-specific errors, the `gameError` callback is used:

```typescript
// Callback with method: "gameError"
// data is a string error message
```

---

## 13. Type Guards (Recommended)

For handling polymorphic callback data:

```typescript
export function isGameView(data: unknown): data is GameView {
  return typeof data === 'object' && data !== null && 'players' in data && 'phase' in data;
}

export function isString(data: unknown): data is string {
  return typeof data === 'string';
}

export function isTableView(data: unknown): data is TableView {
  return typeof data === 'object' && data !== null && 'tableId' in data && 'tableState' in data;
}
```

---

## 14. Notes on Serialization

1. **UUIDs**: Always serialized as strings in format `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`.
2. **Maps**: Java `Map<UUID, X>` becomes JSON object with UUID strings as keys.
3. **Enums**: Serialized as their `name()` string (e.g., `TurnPhase.COMBAT` → `"COMBAT"`).
4. **Dates**: Serialized as ISO 8601 strings or epoch milliseconds depending on field.
5. **Null values**: Fields may be absent or explicitly `null`.
6. **Compressed data**: Server may compress large payloads; `WebSocketCallbackHandler` decompresses before sending to WebSocket clients.
