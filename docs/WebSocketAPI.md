# XMage WebSocket API Documentation

This document describes the WebSocket API for connecting custom clients (e.g., web frontends) to the XMage Server.

## Connection Details

- **Default URL**: `ws://<server_address>:17172`
- **Protocol**: JSON-RPC 2.0 (Simplified)

## Message Format

### Client → Server (Request)

```json
{
  "method": "methodName",
  "params": ["arg1", "arg2", ...],
  "id": 1
}
```

**Notes:**
- `method`: The API method to call (case-sensitive)
- `params`: Array of parameters in the order specified by the method signature
- `id`: Request ID for correlating responses (integer)

### Server → Client (Response)

```json
{
  "jsonrpc": "2.0",
  "result": <resultData>,
  "id": 1
}
```

### Server → Client (Error)

```json
{
  "jsonrpc": "2.0",
  "error": "Error message description",
  "id": 1
}
```

### Server → Client (Callback/Push)

The server pushes events to clients using `ClientCallback` objects:

```json
{
  "messageId": 123,
  "method": "gameUpdate",
  "objectId": "uuid-string-or-null",
  "data": <polymorphic-data>
}
```

**Note:** The `data` field is polymorphic and varies based on the `method` field. See [WebClientDataModels.md](./WebClientDataModels.md) for type definitions.

---

## Supported Methods

### Connection & Authentication

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `ping` | `[]` | `true` | Heartbeat to keep connection alive. |
| `authRegister` | `[sessionId, userName, password, email]` | `boolean` | Register a new user account. |
| `connectUser` | `[userName, password, sessionId, restoreSessionId?, version?, userIdStr?]` | `boolean` | Connect an existing user. Server uses its own version if not provided. |
| `connectSetUserData` | `[userName, sessionId, userData, clientVersion, userIdStr]` | `boolean` | Set user preferences after login. `userData` is a `UserData` JSON object. |
| `serverGetMainRoomId` | `[]` | `UUID` | Get the main lobby room ID. |

### Lobby / Room

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `roomGetUsers` | `[roomId]` | `List<RoomUsersView>` | Get users in a specific room. |
| `roomGetAllTables` | `[roomId]` | `List<TableView>` | Get all tables in a room. |
| `roomGetFinishedMatches` | `[roomId]` | `List<MatchView>` | Get finished matches in a room. |
| `roomGetTableById` | `[roomId, tableId]` | `TableView` | Get a specific table by ID. |
| `roomCreateTable` | `[sessionId, roomId, matchOptions]` | `TableView` | Create a new match table. `matchOptions` is a `MatchOptions` JSON object. |
| `roomJoinTable` | `[sessionId, roomId, tableId, name, playerType, skill, deckList, password?]` | `boolean` | Join an existing table. `playerType` is a string like `"Human"`. `deckList` is `DeckCardLists`. |
| `roomWatchTable` | `[sessionId, roomId, tableId]` | `boolean` | Watch a game at a table. |
| `roomWatchTournament` | `[sessionId, tableId]` | `boolean` | Watch a tournament. |
| `roomLeaveTableOrTournament` | `[sessionId, roomId, tableId]` | `boolean` | Leave a table or tournament. |

### Table Utilities

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `tableSwapSeats` | `[sessionId, roomId, tableId, seatNum1, seatNum2]` | `true` | Swap seats in a table (host only). |
| `tableRemove` | `[sessionId, roomId, tableId]` | `true` | Remove a table (host only). |
| `tableIsOwner` | `[sessionId, roomId, tableId]` | `boolean` | Check if session owns the table. |

### Tournament

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `roomCreateTournament` | `[sessionId, roomId, tournamentOptions]` | `TableView` | Create a new tournament table. |
| `roomJoinTournament` | `[sessionId, roomId, tableId, name, playerType, skill, deckList, password?]` | `boolean` | Join a tournament table. |
| `tournamentStart` | `[sessionId, roomId, tableId]` | `boolean` | Start a tournament (host only). |
| `tournamentJoin` | `[draftId, sessionId]` | `true` | Join an active tournament. |
| `tournamentFindById` | `[tournamentId]` | `TournamentView` | Get tournament details by ID. |
| `tournamentQuit` | `[tournamentId, sessionId]` | `true` | Quit an active tournament. |

### Chat

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `chatJoin` | `[chatId, sessionId, userName]` | `true` | Join a chat channel. |
| `chatSendMessage` | `[chatId, userName, message]` | `true` | Send a message to a chat channel. |
| `chatLeave` | `[chatId, sessionId]` | `true` | Leave a chat channel. |
| `chatFindByGame` | `[gameId]` | `UUID` | Get chat channel for a game. |
| `chatFindByTable` | `[tableId]` | `UUID` | Get chat channel for a table. |
| `chatFindByTournament` | `[tournamentId]` | `UUID` | Get chat channel for a tournament. |
| `chatFindByRoom` | `[roomId]` | `UUID` | Get chat channel for a room. |

### Match

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `matchStart` | `[sessionId, roomId, tableId]` | `boolean` | Start a match (host only). |
| `matchQuit` | `[gameId, sessionId]` | `true` | Quit an active match. |

### Game

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `gameJoin` | `[gameId, sessionId]` | `true` | Join a game instance. |
| `gameWatchStart` | `[gameId, sessionId]` | `boolean` | Start watching a game. |
| `gameWatchStop` | `[gameId, sessionId]` | `true` | Stop watching a game. |
| `gameGetView` | `[gameId, sessionId, playerId]` | `GameView` | Get current game state. |
| `sendPlayerAction` | `[playerAction, gameId, sessionId, data?]` | `true` | Send a generic player action. `playerAction` is a `PlayerAction` enum string. `data` can be UUID, String, Integer, or Boolean. |
| `sendPlayerUUID` | `[gameId, sessionId, uuidData]` | `true` | Send a UUID selection (e.g., target selection). |
| `sendPlayerString` | `[gameId, sessionId, stringData]` | `true` | Send a string selection (e.g., mode choice). |
| `sendPlayerBoolean` | `[gameId, sessionId, boolData]` | `true` | Send a boolean selection (e.g., optional trigger). |
| `sendPlayerInteger` | `[gameId, sessionId, intData]` | `true` | Send an integer selection (e.g., X cost amount). |
| `sendPlayerManaType` | `[gameId, playerId, sessionId, manaType]` | `true` | Send a mana color choice. `manaType` is `"WHITE"`, `"BLUE"`, `"BLACK"`, `"RED"`, `"GREEN"`, or `"COLORLESS"`. |
| `cheatShow` | `[gameId, sessionId, playerId]` | `true` | Reveal hand/library (debug/cheat mode). |

### Draft

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `draftJoin` | `[draftId, sessionId]` | `true` | Join a draft. |
| `draftQuit` | `[draftId, sessionId]` | `true` | Quit a draft. |
| `draftSetBoosterLoaded` | `[draftId, sessionId]` | `true` | Signal that client has loaded the booster pack. |
| `sendDraftCardPick` | `[draftId, sessionId, cardId, hiddenCards]` | `DraftPickView` | Pick a card in draft. `hiddenCards` is a JSON array of UUIDs. |
| `sendDraftCardMark` | `[draftId, sessionId, cardId]` | `true` | Mark a card in draft. |

### Deck

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `deckSubmit` | `[sessionId, tableId, deckList]` | `boolean` | Submit a deck for a table. `deckList` is a `DeckCardLists` JSON object. |
| `deckSave` | `[sessionId, tableId, deckList]` | `true` | Save a deck without submitting. |

### Replay

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `replayInit` | `[gameId, sessionId]` | `true` | Initialize replay for a game. |
| `replayStart` | `[gameId, sessionId]` | `true` | Start replay playback. |
| `replayStop` | `[gameId, sessionId]` | `true` | Stop replay playback. |
| `replayNext` | `[gameId, sessionId]` | `true` | Move to next replay action. |
| `replayPrevious` | `[gameId, sessionId]` | `true` | Move to previous replay action. |
| `replaySkipForward` | `[gameId, sessionId, moves]` | `true` | Skip forward by N moves. |

### Server

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `getServerState` | `[]` | `ServerState` | Get server configuration and state. |

---

## PlayerAction Enum Values

The `sendPlayerAction` method accepts a `PlayerAction` enum value as a string. Common values include:

### Priority Control
- `PASS_PRIORITY_UNTIL_MY_NEXT_TURN`
- `PASS_PRIORITY_UNTIL_TURN_END_STEP`
- `PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE`
- `PASS_PRIORITY_UNTIL_NEXT_TURN`
- `PASS_PRIORITY_UNTIL_NEXT_TURN_SKIP_STACK`
- `PASS_PRIORITY_UNTIL_STACK_RESOLVED`
- `PASS_PRIORITY_UNTIL_END_STEP_BEFORE_MY_NEXT_TURN`
- `PASS_PRIORITY_CANCEL_ALL_ACTIONS`
- `HOLD_PRIORITY`
- `UNHOLD_PRIORITY`

### Game Actions
- `UNDO`
- `CONCEDE`
- `ROLLBACK_TURNS`

### Mana Pool
- `MANA_AUTO_PAYMENT_ON`
- `MANA_AUTO_PAYMENT_OFF`
- `MANA_AUTO_PAYMENT_RESTRICTED_ON`
- `MANA_AUTO_PAYMENT_RESTRICTED_OFF`
- `USE_FIRST_MANA_ABILITY_ON`
- `USE_FIRST_MANA_ABILITY_OFF`

### Trigger Ordering
- `TRIGGER_AUTO_ORDER_ABILITY_FIRST`
- `TRIGGER_AUTO_ORDER_ABILITY_LAST`
- `TRIGGER_AUTO_ORDER_NAME_FIRST`
- `TRIGGER_AUTO_ORDER_NAME_LAST`
- `TRIGGER_AUTO_ORDER_RESET_ALL`

### Permissions
- `REQUEST_PERMISSION_TO_SEE_HAND_CARDS`
- `ADD_PERMISSION_TO_SEE_HAND_CARDS`
- `REVOKE_PERMISSIONS_TO_SEE_HAND_CARDS`
- `PERMISSION_REQUESTS_ALLOWED_ON`
- `PERMISSION_REQUESTS_ALLOWED_OFF`
- `REQUEST_PERMISSION_TO_ROLLBACK_TURN`
- `ADD_PERMISSION_TO_ROLLBACK_TURN`
- `DENY_PERMISSION_TO_ROLLBACK_TURN`

### Auto-Answer
- `REQUEST_AUTO_ANSWER_ID_YES`
- `REQUEST_AUTO_ANSWER_ID_NO`
- `REQUEST_AUTO_ANSWER_TEXT_YES`
- `REQUEST_AUTO_ANSWER_TEXT_NO`
- `REQUEST_AUTO_ANSWER_RESET_ALL`

### Client Actions
- `CLIENT_CONCEDE_GAME`
- `CLIENT_CONCEDE_MATCH`
- `CLIENT_QUIT_TOURNAMENT`
- `CLIENT_QUIT_DRAFT_TOURNAMENT`
- `CLIENT_STOP_WATCHING`
- `CLIENT_DISCONNECT_FULL`
- `CLIENT_DISCONNECT_KEEP_GAMES`
- `CLIENT_EXIT_FULL`
- `CLIENT_EXIT_KEEP_GAMES`
- `CLIENT_REMOVE_TABLE`
- `CLIENT_RECONNECT`
- `CLIENT_REPLAY_ACTION`
- `VIEW_LIMITED_DECK`
- `VIEW_SIDEBOARD`
- `TOGGLE_RECORD_MACRO`

---

## Server Callback Methods

The server pushes events to clients using `ClientCallback` messages. The `method` field determines the type of callback:

### Messages
| Method | Data Type | Description |
|--------|-----------|-------------|
| `chatMessage` | Various | Chat message received. |
| `showUserMessage` | String | User-facing message. |
| `serverMessage` | String | Server broadcast message. |

### Table/Tournament Events
| Method | Data Type | Description |
|--------|-----------|-------------|
| `joinedTable` | `TableView` | Successfully joined a table. |
| `startTournament` | `TournamentView` | Tournament has started. |
| `tournamentInit` | `TournamentView` | Tournament initialized. |
| `tournamentUpdate` | `TournamentView` | Tournament state updated. |
| `tournamentOver` | `TournamentView` | Tournament has ended. |

### Draft/Sideboard Events
| Method | Data Type | Description |
|--------|-----------|-------------|
| `startDraft` | `DraftView` | Draft has started. |
| `draftInit` | `DraftView` | Draft initialized. |
| `draftPick` | `DraftPickView` | Draft pick required. |
| `draftUpdate` | `DraftView` | Draft state updated. |
| `draftOver` | `DraftView` | Draft has ended. |
| `sideboard` | Various | Sideboard required. |
| `construct` | Various | Deck construction required. |

### Game Events
| Method | Data Type | Description |
|--------|-----------|-------------|
| `startGame` | Various | Game has started. |
| `gameInit` | `GameView` | Game initialized with full state. |
| `gameInform` | `GameView` | Game update with feedback message. |
| `gameInformPersonal` | String | Personal message for the player. |
| `gameError` | String | Game error message. |
| `gameUpdate` | `GameView` | Game state updated. |
| `gameTarget` | `GameView` | Targeting required. |
| `gameChooseAbility` | `AbilityPickerView` | Choose an ability. |
| `gameChoosePile` | Various | Choose a pile. |
| `gameChooseChoice` | Various | Make a choice. |
| `gameAsk` | `GameView` | Yes/No question. |
| `gameSelect` | `GameView` | Selection required. |
| `gamePlayMana` | `GameView` | Mana payment required. |
| `gamePlayXMana` | `GameView` | X mana payment required. |
| `gameSelectAmount` | Various | Amount selection required. |
| `gameSelectMultiAmount` | Various | Multiple amount selection required. |
| `gameOver` | `GameEndView` | Game has ended. |
| `endGameInfo` | `GameEndView` | End game information. |

### Watch Events
| Method | Data Type | Description |
|--------|-----------|-------------|
| `showTournament` | `TournamentView` | Show tournament viewer. |
| `watchGame` | `GameView` | Start watching a game. |

### Other Events
| Method | Data Type | Description |
|--------|-----------|-------------|
| `userRequestDialog` | Various | User request dialog (e.g., hand reveal request). |
| `gameRedrawGUI` | - | Client should redraw the game GUI. |
| `viewLimitedDeck` | `DeckView` | View limited deck. |
| `viewSideboard` | Various | View sideboard. |

---

## Example Flows

### Login Flow

```json
// 1. Connect user
{"method": "connectUser", "params": ["myuser", "mypass", "session-uuid", "", "", ""], "id": 1}
// Response: {"jsonrpc": "2.0", "result": true, "id": 1}

// 2. Set user data
{"method": "connectSetUserData", "params": ["myuser", "session-uuid", {"groupId": 0, "avatarId": 51, "confirmEmptyManaPool": true, "userSkipPrioritySteps": {...}, "flagName": "world.png"}, "1.0", ""], "id": 2}
// Response: {"jsonrpc": "2.0", "result": true, "id": 2}

// 3. Get main room ID
{"method": "serverGetMainRoomId", "params": [], "id": 3}
// Response: {"jsonrpc": "2.0", "result": "room-uuid-string", "id": 3}
```

### Create and Start Game

```json
// 1. Create table
{"method": "roomCreateTable", "params": ["session-uuid", "room-uuid", {"name": "My Game", "gameType": "Two Player Duel", "deckType": "Constructed - Standard", "winsNeeded": 1}], "id": 1}
// Response: {"jsonrpc": "2.0", "result": {...TableView...}, "id": 1}

// 2. Join the table
{"method": "roomJoinTable", "params": ["session-uuid", "room-uuid", "table-uuid", "MyPlayer", "Human", 5, {"name": "MyDeck", "cards": [...], "sideboard": [...]}, ""], "id": 2}
// Response: {"jsonrpc": "2.0", "result": true, "id": 2}

// 3. Start the match (when all players joined)
{"method": "matchStart", "params": ["session-uuid", "room-uuid", "table-uuid"], "id": 3}
// Response: {"jsonrpc": "2.0", "result": true, "id": 3}
```

### Game Actions

```json
// Pass priority until next main phase (F6 equivalent)
{"method": "sendPlayerAction", "params": ["PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE", "game-uuid", "session-uuid", null], "id": 1}

// Select a target
{"method": "sendPlayerUUID", "params": ["game-uuid", "session-uuid", "target-permanent-uuid"], "id": 2}

// Respond Yes to a question
{"method": "sendPlayerBoolean", "params": ["game-uuid", "session-uuid", true], "id": 3}

// Choose an X value
{"method": "sendPlayerInteger", "params": ["game-uuid", "session-uuid", 5], "id": 4}
```
