/**
 * XMage Web Client API Types
 *
 * These TypeScript interfaces mirror the Java classes serialized by the XMage server.
 * All Java objects are serialized via Gson: Maps become JSON objects with string keys,
 * Lists become JSON arrays, and enums are serialized as their string names.
 */
export var Zone;
(function (Zone) {
    Zone["HAND"] = "HAND";
    Zone["GRAVEYARD"] = "GRAVEYARD";
    Zone["LIBRARY"] = "LIBRARY";
    Zone["BATTLEFIELD"] = "BATTLEFIELD";
    Zone["STACK"] = "STACK";
    Zone["EXILED"] = "EXILED";
    Zone["ALL"] = "ALL";
    Zone["OUTSIDE"] = "OUTSIDE";
    Zone["COMMAND"] = "COMMAND";
})(Zone || (Zone = {}));
export var TurnPhase;
(function (TurnPhase) {
    TurnPhase["BEGINNING"] = "BEGINNING";
    TurnPhase["PRECOMBAT_MAIN"] = "PRECOMBAT_MAIN";
    TurnPhase["COMBAT"] = "COMBAT";
    TurnPhase["POSTCOMBAT_MAIN"] = "POSTCOMBAT_MAIN";
    TurnPhase["END"] = "END";
})(TurnPhase || (TurnPhase = {}));
export var PhaseStep;
(function (PhaseStep) {
    PhaseStep["UNTAP"] = "UNTAP";
    PhaseStep["UPKEEP"] = "UPKEEP";
    PhaseStep["DRAW"] = "DRAW";
    PhaseStep["PRECOMBAT_MAIN"] = "PRECOMBAT_MAIN";
    PhaseStep["BEGIN_COMBAT"] = "BEGIN_COMBAT";
    PhaseStep["DECLARE_ATTACKERS"] = "DECLARE_ATTACKERS";
    PhaseStep["DECLARE_BLOCKERS"] = "DECLARE_BLOCKERS";
    PhaseStep["FIRST_COMBAT_DAMAGE"] = "FIRST_COMBAT_DAMAGE";
    PhaseStep["COMBAT_DAMAGE"] = "COMBAT_DAMAGE";
    PhaseStep["END_COMBAT"] = "END_COMBAT";
    PhaseStep["POSTCOMBAT_MAIN"] = "POSTCOMBAT_MAIN";
    PhaseStep["END_TURN"] = "END_TURN";
    PhaseStep["CLEANUP"] = "CLEANUP";
})(PhaseStep || (PhaseStep = {}));
export var MageObjectType;
(function (MageObjectType) {
    MageObjectType["ABILITY_STACK_FROM_CARD"] = "ABILITY_STACK_FROM_CARD";
    MageObjectType["ABILITY_STACK_FROM_TOKEN"] = "ABILITY_STACK_FROM_TOKEN";
    MageObjectType["CARD"] = "CARD";
    MageObjectType["COPY_CARD"] = "COPY_CARD";
    MageObjectType["TOKEN"] = "TOKEN";
    MageObjectType["SPELL"] = "SPELL";
    MageObjectType["PERMANENT"] = "PERMANENT";
    MageObjectType["DUNGEON"] = "DUNGEON";
    MageObjectType["EMBLEM"] = "EMBLEM";
    MageObjectType["COMMANDER"] = "COMMANDER";
    MageObjectType["DESIGNATION"] = "DESIGNATION";
    MageObjectType["PLANE"] = "PLANE";
    MageObjectType["NULL"] = "NULL";
})(MageObjectType || (MageObjectType = {}));
export var Rarity;
(function (Rarity) {
    Rarity["LAND"] = "LAND";
    Rarity["COMMON"] = "COMMON";
    Rarity["UNCOMMON"] = "UNCOMMON";
    Rarity["RARE"] = "RARE";
    Rarity["MYTHIC"] = "MYTHIC";
    Rarity["SPECIAL"] = "SPECIAL";
    Rarity["BONUS"] = "BONUS";
})(Rarity || (Rarity = {}));
export var ManaType;
(function (ManaType) {
    ManaType["WHITE"] = "WHITE";
    ManaType["BLUE"] = "BLUE";
    ManaType["BLACK"] = "BLACK";
    ManaType["RED"] = "RED";
    ManaType["GREEN"] = "GREEN";
    ManaType["COLORLESS"] = "COLORLESS";
})(ManaType || (ManaType = {}));
export var TableState;
(function (TableState) {
    TableState["WAITING"] = "WAITING";
    TableState["READY_TO_START"] = "READY_TO_START";
    TableState["STARTING"] = "STARTING";
    TableState["DRAFTING"] = "DRAFTING";
    TableState["SIDEBOARDING"] = "SIDEBOARDING";
    TableState["CONSTRUCTING"] = "CONSTRUCTING";
    TableState["DUELING"] = "DUELING";
    TableState["FINISHED"] = "FINISHED";
})(TableState || (TableState = {}));
export var SkillLevel;
(function (SkillLevel) {
    SkillLevel["BEGINNER"] = "BEGINNER";
    SkillLevel["CASUAL"] = "CASUAL";
    SkillLevel["SERIOUS"] = "SERIOUS";
})(SkillLevel || (SkillLevel = {}));
// === Deck / Table Messages ===
export var DeckEditorMode;
(function (DeckEditorMode) {
    DeckEditorMode["SIDEBOARDING"] = "SIDEBOARDING";
    DeckEditorMode["LIMITED_BUILDING"] = "LIMITED_BUILDING";
    DeckEditorMode["LIMITED_SIDEBOARD_BUILDING"] = "LIMITED_SIDEBOARD_BUILDING";
    DeckEditorMode["VIEW_LIMITED_DECK"] = "VIEW_LIMITED_DECK";
})(DeckEditorMode || (DeckEditorMode = {}));
