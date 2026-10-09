# XMage WebSocket API

The web client talks to the server over a WebSocket bridge that runs next to the desktop client's JBoss remoting port.
It uses the same server sessions, users and tables as desktop clients, so both kinds of clients can play together.

## Connection

- **URL**: `ws://<server>:17172` (`websocketPort` in `config.xml`). Put the server behind a TLS reverse proxy for `wss://` in production.
- **Protocol**: JSON-RPC 2.0 with positional `params`.
- **Allowed browser origins**: `websocketAllowedOrigins` in `config.xml`, comma separated (for example `https://play.example.com`). Empty or `*` allows any origin. Clients without an `Origin` header (tests, tools) are always allowed.
- **Limits**: 4 MB per message, about 40 requests per second per connection (bursts of 120). Messages are compressed with permessage-deflate when the client supports it.
- Requests of one connection run in order; different connections run in parallel.

### Server settings (Java system properties, `-Dname=value`)

| Property | Default | Meaning |
|----------|---------|---------|
| `xmage.web.trustedProxies` | empty (trust nothing) | Comma separated IPs / CIDR ranges of reverse proxies, e.g. `127.0.0.1,::1,172.16.0.0/12`. Only when the TCP peer is in this list does the server read `X-Forwarded-For` (the client is the right-most address that is not a trusted proxy) or, without it, `X-Real-IP`. The resulting client IP is the session's host (anonymous users are recognized by it on reconnect), the key of the per-IP limits and what the logs show. Behind a proxy this **must** be set, or every client looks like the proxy. |
| `xmage.web.maxConnectionsPerIp` | `16` | Open WebSocket connections per client IP; more are closed with code 1008. `0` = unlimited. Loopback clients are not limited. |
| `xmage.web.maxOutgoingBytes` | `16777216` (16 MB) | Unsent data queued for one connection; a client that stops reading is dropped once it is exceeded. `0` = unlimited. |
| `xmage.adminPassword` (or `-adminPassword=` argument) | empty | Server admin password. `connectAdmin` over WebSocket is refused while it is empty. |

## Sessions

The server issues the session. Logging in (`connectUser`, `connectAdmin`, `authRegister`, `authSendTokenToEmail`, `authResetPassword`) creates a new server session bound to the connection, and every later request on that connection acts as that session.

Methods still take a `sessionId` parameter in the documented position for compatibility, but **the server ignores the value and uses the connection's own session**. A client can never act on another session by sending its id.

Closing the socket counts as a lost connection: the user keeps their tables for a few minutes and can come back from a new connection with `connectUser`, passing the **server-issued restore token** as `restoreSessionId`. Get the token with `sessionGetRestoreToken` right after every successful login (it changes with each login) and keep it client side. A wrong or empty token never takes over another user's seat. Without authentication, a user with the same name from the same client IP is still treated as a reconnect (desktop compatibility).

Access levels in the method table:

- `public`: works before login.
- `login`: creates the connection's session.
- `session`: requires a logged in connection.

## Message format

### Request

```json
{"jsonrpc": "2.0", "id": 1, "method": "roomGetAllTables", "params": ["room-uuid"]}
```

A request without `id` is a notification: it runs, but gets no response.

### Response

```json
{"jsonrpc": "2.0", "id": 1, "result": [ ... ]}
```

### Error

```json
{"jsonrpc": "2.0", "id": 1, "error": {"code": -32602, "message": "Parameter 'roomId' (#0) must be a UUID"}}
```

| Code | Meaning |
|------|---------|
| -32700 | Request is not JSON |
| -32600 | Malformed request (no method, params not an array) |
| -32601 | Unknown method |
| -32602 | Missing or invalid parameter |
| -32603 | Unexpected server error |
| -32000 | The server rejected the request |
| -32001 | Not logged in, or not allowed (wrong admin password, chat not joined) |
| -32003 | Too many requests, or locked out after failed admin logins |
| -32004 | Server busy |
| -32005 | Deck import failed; `data.reason` says why (see Deck import) |

### Server events

The server pushes events as plain objects (no `jsonrpc` field):

```json
{"method": "GAME_UPDATE", "objectId": "game-uuid", "messageId": 12, "data": { ... }}
```

`method` is the `ClientCallbackMethod` enum name. `messageId` increases per session; it restarts at 0 after a new login.

### Value conventions

- UUIDs are strings.
- Dates are epoch milliseconds.
- Java views are serialized field by field; `null` fields are omitted.
- `SimpleCardView` objects also carry the card `name`.
- Card views carry `cardId` (the physical card, stable from hand to stack to battlefield), `ownerId` and `controllerId`.

## Methods

Generated from the server's method registry (`mage.server.websocket.api`). Do not edit the table by hand.

<!-- BEGIN GENERATED: methods -->
| Method | Params | Result | Access | Description |
|--------|--------|--------|--------|-------------|
| `ping` | `sessionId?: string`, `pingInfo?: string` | `boolean` | public | Keep-alive. Extends the logged in user's session; always succeeds before login. |
| `connectUser` | `userName: string`, `password: string`, `sessionId: string`, `restoreSessionId?: string`, `clientVersion?: string`, `userIdStr?: string` | `boolean` | login | Log in. Creates the connection's session; restoreSessionId reattaches a user that lost its connection. |
| `connectAdmin` | `password: string`, `sessionId: string` | `boolean` | login | Log in as server admin. Disabled unless the server was started with a non-empty admin password (-adminPassword=... or -Dxmage.adminPassword=...). After a wrong password the caller's IP is locked out for 1, 2, 4... seconds (at most 5 minutes). |
| `sessionGetRestoreToken` | `sessionId: string` | `string` | session | Token that reattaches this user (and its tables) from a later connection: pass it as connectUser's restoreSessionId. It changes on every login, so fetch it again after each one. |
| `authRegister` | `sessionId: string`, `userName: string`, `password: string`, `email: string` | `boolean` | login | Register a new account (servers with authentication enabled). With a password it becomes the account's password; without one the server emails a generated password. Fails with the reason. |
| `authSendTokenToEmail` | `sessionId: string`, `email: string` | `boolean` | login | Email a password reset code to an account's address. Succeeds whether or not an account has the address, so addresses can't be probed; fails only when the server can't send mail. |
| `authResetPassword` | `sessionId: string`, `email: string`, `authToken: string`, `password: string` | `boolean` | login | Set a new password with an emailed code (valid 30 minutes, 5 tries). Fails with the reason. |
| `disconnectSession` | `sessionId: string`, `keepGames?: boolean` | `boolean` | session | Log out. With keepGames the user's active tables survive for a later reconnect. |
| `playerLogout` | `sessionId: string`, `keepGames?: boolean` | `boolean` | session | Alias of `disconnectSession`. |
| `connectSetUserData` | `userName?: string`, `sessionId: string`, `userData: UserData`, `clientVersion?: string`, `userIdStr?: string` | `boolean` | session | Store user preferences (avatar, flag, auto-pass settings). userName is ignored; the session identifies the user. |
| `sendFeedback` | `sessionId: string`, `userName: string`, `title: string`, `type: string`, `message: string`, `email?: string` | `boolean` | session | Send feedback to the server admin. |
| `serverGetMainRoomId` | - | `UUID` | public | Id of the main lobby room. |
| `serverGetPromotionMessages` | `sessionId?: string` | `unknown` | public | Server news shown after login. |
| `getServerState` | - | `ServerState` | public | Server version and every game, tournament, player and deck type. Also used as a status probe. |
| `getGameTypes` | - | `GameTypeView[]` | public | Match game types. |
| `getTournamentGameTypes` | - | `GameTypeView[]` | public | Game types usable in tournaments. |
| `getTournamentTypes` | - | `TournamentTypeView[]` | public | Tournament types. |
| `getPlayerTypes` | - | `string[]` | public | Seat types (human and AI players). |
| `getDeckTypes` | - | `string[]` | public | Deck formats. |
| `getDraftCubes` | - | `string[]` | public | Cubes available for cube drafts. |
| `getExpansionSets` | - | `ExpansionSetInfo[]` | public | All card sets. |
| `getBasicLandSets` | - | `BasicLandSetInfo[]` | public | Sets with basic lands, newest first. |
| `searchCards` | `criteria: CardCriteria`, `filters?: WebCardFilters` | `CardView[]` | session | Search the card database (paged with start/count, at most 1000 per page). filters.colorIdentity (letters of WUBRG, "" for colorless) keeps cards a commander of those colors allows. |
| `lookupCards` | `cards: DeckCardInfo[]` | `CardView[]` | public | Card details for deck entries (by set and number, falling back to name), in the same order; null for unknown cards. At most 500 per call. |
| `deckValidate` | `deckType: string`, `deck: DeckCardLists` | `DeckValidationResult` | session | Check a deck against a format, with EDH power level and Commander brackets. |
| `deckImportFromUrl` | `url: string` | `ImportedDeck` | session | Read the deck behind a deck website link. Ten imports a minute per session; results are cached for five minutes. Fails with code -32005 and data {reason}: private, not_found, blocked, rate_limited, site_changed, unsupported, too_large, timeout or unavailable. |
| `deckImportSources` | - | `DeckSourceStatus[]` | public | Deck websites the server imports from by link, and whether each works right now (ok or degraded). |
| `roomGetUsers` | `roomId: UUID` | `RoomUsersView[]` | session | Users and server statistics of a room. |
| `roomGetAllTables` | `roomId: UUID` | `TableView[]` | session | All open and running tables of a room. |
| `roomGetTableById` | `roomId: UUID`, `tableId: UUID` | `TableView \| null` | session | One table of a room. |
| `roomGetFinishedMatches` | `roomId: UUID` | `MatchView[]` | session | Recently finished matches of a room. |
| `roomCreateTable` | `sessionId: string`, `roomId: UUID`, `options: WebMatchOptions` | `TableView` | session | Create a match table. The creator still has to join a seat. |
| `roomJoinTable` | `sessionId: string`, `roomId: UUID`, `tableId: UUID`, `name: string`, `playerType: string`, `skill: number`, `deck: DeckCardLists`, `password?: string` | `boolean` | session | Take a seat at a table (yourself or an AI player). |
| `roomLeaveTableOrTournament` | `sessionId: string`, `roomId: UUID`, `tableId: UUID` | `boolean` | session | Leave a table or tournament before it starts. |
| `roomWatchTable` | `sessionId: string`, `roomId: UUID`, `tableId: UUID` | `boolean` | session | Spectate a running match. |
| `matchStart` | `sessionId: string`, `roomId: UUID`, `tableId: UUID` | `boolean` | session | Start a match once all seats are filled (table owner only). |
| `tableSwapSeats` | `sessionId: string`, `roomId: UUID`, `tableId: UUID`, `seatNum1: number`, `seatNum2: number` | `boolean` | session | Reorder seats (table owner only). |
| `tableRemove` | `sessionId: string`, `roomId: UUID`, `tableId: UUID` | `boolean` | session | Remove a table (table owner only). |
| `tableIsOwner` | `sessionId: string`, `roomId: UUID`, `tableId: UUID` | `boolean` | session | Whether the caller owns the table. |
| `deckSubmit` | `sessionId: string`, `tableId: UUID`, `deck: DeckCardLists` | `boolean` | session | Submit a deck for a table in construction or sideboarding. |
| `submitDeck` | `sessionId: string`, `tableId: UUID`, `deck: DeckCardLists` | `boolean` | session | Alias of `deckSubmit`. |
| `deckSave` | `sessionId: string`, `tableId: UUID`, `deck: DeckCardLists` | `boolean` | session | Save the in-progress limited deck without submitting it. |
| `chatJoin` | `chatId: UUID`, `sessionId: string`, `userName?: string` | `boolean` | session | Subscribe to a chat. |
| `chatLeave` | `chatId: UUID`, `sessionId: string` | `boolean` | session | Unsubscribe from a chat. |
| `chatSendMessage` | `chatId: UUID`, `userName?: string`, `message: string` | `boolean` | session | Post to a chat as the logged in user, who must have joined it (chatJoin; the lobby chat is joined on login). userName is ignored; the session decides the author. |
| `chatSetIgnored` | `names: string[]` | `boolean` | session | Players this user ignores, by name, for as long as the session lasts (the client keeps the list and sends it after each login): their table chat doesn't reach the user and their whispers are refused. At most 500 names; an empty list clears it. |
| `chatFindByGame` | `gameId: UUID` | `UUID \| null` | session | Chat of a game. |
| `chatFindByTable` | `tableId: UUID` | `UUID \| null` | session | Chat of a table. |
| `chatFindByTournament` | `tournamentId: UUID` | `UUID \| null` | session | Chat of a tournament. |
| `chatFindByRoom` | `roomId: UUID` | `UUID \| null` | session | Chat of a room. |
| `gameJoin` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Join a started game as a player (after START_GAME). Also used to resync after a reconnect. |
| `gameResync` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Send this connection the game's open question again, when a reply or the question seems lost. Returns false when nothing is waiting for the player's answer. |
| `matchQuit` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Concede the whole match. |
| `gameWatchStart` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Start spectating a game. |
| `replayList` | - | `ReplayInfo[]` | session | Recorded games available for replay, newest first. Games are recorded as a spectator sees them (xmage.replays, on by default) and kept for xmage.replays.retentionDays (30). |
| `replayPage` | `gameId: UUID`, `start: number`, `count: number` | `ReplayPage \| null` | session | Events of a recorded game, in order: board snapshots ({t, view, myHand?}) and game log lines ({t, log}). At most 200 per page; myHand is the caller's own hand in games they played. Null when there is no such replay. |
| `gameWatchers` | `gameId: UUID` | `string[]` | session | Names of the users spectating a running game (empty when the game is over or unknown). |
| `gameWatchStop` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Stop spectating a game. |
| `sendPlayerUUID` | `gameId: UUID`, `sessionId: string`, `data?: UUID` | `boolean` | session | Answer a prompt with an object or player id (targets, choices, attackers, blockers). |
| `sendPlayerString` | `gameId: UUID`, `sessionId: string`, `data: string` | `boolean` | session | Answer a prompt with text (choices, "special" mana payment). |
| `sendPlayerBoolean` | `gameId: UUID`, `sessionId: string`, `data: boolean` | `boolean` | session | Answer a yes/no prompt, pass priority (false) or cancel mana payment (any value). |
| `sendPlayerInteger` | `gameId: UUID`, `sessionId: string`, `data: number` | `boolean` | session | Answer an amount prompt. |
| `sendPlayerManaType` | `gameId: UUID`, `playerId: UUID`, `sessionId: string`, `manaType: ManaType` | `boolean` | session | Pay from the mana pool with one mana type. |
| `sendPlayerAction` | `action: PlayerAction`, `gameId: UUID`, `sessionId: string`, `data?: unknown` | `boolean` | session | Send a player action: pass modes (F-keys), concede, undo, rollback, auto-answer and trigger-order settings. |
| `cheatShow` | `gameId: UUID`, `sessionId: string`, `playerId: UUID` | `boolean` | session | Test mode only: reveal a player's library. |
| `replayInit` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Open a saved game for replay. |
| `replayStart` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Start the replay. |
| `replayStop` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Stop the replay. |
| `replayNext` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Step forward. |
| `replayPrevious` | `gameId: UUID`, `sessionId: string` | `boolean` | session | Step back. |
| `replaySkipForward` | `gameId: UUID`, `sessionId: string`, `moves: number` | `boolean` | session | Skip several steps forward. |
| `roomCreateTournament` | `sessionId: string`, `roomId: UUID`, `options: WebTournamentOptions` | `TableView` | session | Create a tournament table. |
| `roomJoinTournament` | `sessionId: string`, `roomId: UUID`, `tableId: UUID`, `name: string`, `playerType: string`, `skill: number`, `deck: DeckCardLists`, `password?: string` | `boolean` | session | Join a tournament (yourself or an AI player). |
| `roomWatchTournament` | `sessionId: string`, `tableId: UUID` | `boolean` | session | Spectate a tournament. |
| `tournamentStart` | `sessionId: string`, `roomId: UUID`, `tableId: UUID` | `boolean` | session | Start a tournament (owner only). |
| `tournamentJoin` | `tournamentId: UUID`, `sessionId: string` | `boolean` | session | Open a started tournament (after START_TOURNAMENT). |
| `tournamentQuit` | `tournamentId: UUID`, `sessionId: string` | `boolean` | session | Leave a running tournament. |
| `tournamentFindById` | `tournamentId: UUID` | `TournamentView \| null` | session | Tournament standings and rounds. |
| `draftJoin` | `draftId: UUID`, `sessionId: string` | `boolean` | session | Open a started draft (after START_DRAFT). |
| `draftQuit` | `draftId: UUID`, `sessionId: string` | `boolean` | session | Leave a running draft. |
| `sendDraftCardPick` | `draftId: UUID`, `sessionId: string`, `cardId: UUID`, `hiddenCards?: UUID[]` | `DraftPickView \| null` | session | Pick a card from the current booster. |
| `sendDraftCardMark` | `draftId: UUID`, `sessionId: string`, `cardId?: UUID` | `boolean` | session | Mark (or unmark with null) the card to auto-pick when the timer runs out. |
| `draftSetBoosterLoaded` | `draftId: UUID`, `sessionId: string` | `boolean` | session | Tell the server the booster is on screen, so the pick timer may start. |
| `adminGetUsers` | `sessionId: string` | `UserView[]` | session | Admin: all connected users. |
| `adminDisconnectUser` | `sessionId: string`, `userSessionId: string` | `boolean` | session | Admin: disconnect a user. |
| `adminEndUserSession` | `sessionId: string`, `userSessionId: string` | `boolean` | session | Admin: end a user's session and remove them from tables. |
| `adminMuteUser` | `sessionId: string`, `userName: string`, `durationMinutes: number` | `boolean` | session | Admin: mute a user in chats. |
| `adminLockUser` | `sessionId: string`, `userName: string`, `durationMinutes: number` | `boolean` | session | Admin: lock a user out. |
| `adminActivateUser` | `sessionId: string`, `userName: string`, `active: boolean` | `boolean` | session | Admin: activate or deactivate an account. |
| `adminToggleActivateUser` | `sessionId: string`, `userName: string` | `boolean` | session | Admin: toggle an account's active state. |
| `adminTableRemove` | `sessionId: string`, `tableId: UUID` | `boolean` | session | Admin: remove any table. |
| `adminSendBroadcastMessage` | `sessionId: string`, `message: string` | `boolean` | session | Admin: message every connected user. |
| `adminServerStats` | - | `ServerStats` | session | Admin: load and traffic: users, tables, games, memory, CPU, and the size of messages sent to web clients (with the heaviest callbacks and every one over 256 KB). |
| `adminGetReports` | `openOnly?: boolean` | `PlayerReport[]` | session | Admin: player reports, newest first; only the open ones unless openOnly is false. |
| `adminCloseReport` | `reportId: number`, `resolution: string` | `boolean` | session | Admin: close a report with a note about what was done. False when it was closed already. |
| `adminClientErrors` | - | `ClientError[]` | session | Admin: the latest crash reports from web clients, newest first. |
| `testEndGame` | `sessionId: string`, `tableId: UUID` | `boolean` | session | Test mode only: end the running game of a table you own. |
| `testConcedeMatch` | `sessionId: string`, `tableId: UUID`, `losingPlayerIndex?: number` | `boolean` | session | Test mode only: make one player of a table you own concede the match. |
| `serverInfo` | - | `ServerInfo` | public | Whether the server has accounts and mail, and its name and password rules. Callable before login. |
| `deckSyncList` | - | `DeckSyncEntry[]` | session | Every deck kept on the server for the signed-in account, without the deck data, deleted ones included (as tombstones, for 90 days). Only on servers with accounts. |
| `deckSyncGet` | `deckId: string` | `DeckSyncEntry \| null` | session | One deck of the signed-in account with its data, or null when there is none. |
| `deckSyncPut` | `deckId: string`, `name: string`, `updatedAt: number`, `data: string` | `DeckPutResult` | session | Store a deck for the signed-in account. The newer change wins: when the server's copy is newer, nothing is stored and its updatedAt comes back. Up to 500 decks of 256 KB each. |
| `deckSyncDelete` | `deckId: string`, `deletedAt: number` | `DeckPutResult` | session | Delete a deck of the signed-in account, unless the server has a change newer than the deletion. |
| `reportPlayer` | `userName: string`, `reason: string`, `details: string`, `gameId?: string` | `number` | session | Report a player to the server's moderators. Reasons: abuse, cheating, spam, stalling, other. A player can have 5 open reports at a time. Returns the report id. |
| `clientReportError` | `report: ClientError` | `boolean` | public | A crash report from the web client: kept in the server log and the admin console, never sent elsewhere. Limited per connection; extra reports are dropped. |
<!-- END GENERATED: methods -->

## Server events

Generated from `ClientCallbackMethod`. Do not edit the table by hand.

<!-- BEGIN GENERATED: callbacks -->
| Method | Data | Delivery | Description |
|--------|------|----------|-------------|
| `CHATMESSAGE` | `ChatMessage` | MESSAGE (may be dropped when outdated) | Message for the player or a log. |
| `SHOW_USERMESSAGE` | `string[]` | MESSAGE (may be dropped when outdated) | Message for the player or a log. |
| `SERVER_MESSAGE` | `ChatMessage` | MESSAGE (may be dropped when outdated) | Message for the player or a log. |
| `JOINED_TABLE` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `START_TOURNAMENT` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `TOURNAMENT_INIT` | `TournamentView` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `TOURNAMENT_UPDATE` | `TournamentView` | UPDATE (may be dropped when outdated) | State snapshot; newer ones replace older ones. |
| `TOURNAMENT_OVER` | `string` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `START_DRAFT` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `SIDEBOARD` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `CONSTRUCT` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `DRAFT_OVER` | `null` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `DRAFT_INIT` | `DraftClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `DRAFT_PICK` | `DraftClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `DRAFT_UPDATE` | `DraftClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `SHOW_TOURNAMENT` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `WATCHGAME` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `VIEW_LIMITED_DECK` | `TableClientMessage` | MESSAGE (may be dropped when outdated) | Message for the player or a log. |
| `VIEW_SIDEBOARD` | `TableClientMessage` | MESSAGE (may be dropped when outdated) | Message for the player or a log. |
| `USER_REQUEST_DIALOG` | `UserRequestMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_REDRAW_GUI` | `null` | CLIENT_SIDE_EVENT (may be dropped when outdated) | Not sent by the server. |
| `START_GAME` | `TableClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `GAME_INIT` | `GameView` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `GAME_UPDATE_AND_INFORM` | `GameClientMessage` | UPDATE (may be dropped when outdated) | State snapshot; newer ones replace older ones. |
| `GAME_INFORM_PERSONAL` | `GameClientMessage` | MESSAGE (may be dropped when outdated) | Message for the player or a log. |
| `GAME_ERROR` | `string` | MESSAGE (may be dropped when outdated) | Message for the player or a log. |
| `GAME_UPDATE` | `GameView` | UPDATE (may be dropped when outdated) | State snapshot; newer ones replace older ones. |
| `GAME_TARGET` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_CHOOSE_ABILITY` | `AbilityPickerView` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_CHOOSE_PILE` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_CHOOSE_CHOICE` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_ASK` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_SELECT` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_PLAY_MANA` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_PLAY_XMANA` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_GET_AMOUNT` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_GET_MULTI_AMOUNT` | `GameClientMessage` | DIALOG (ordered) | Prompt: the player must answer with a sendPlayer* call. |
| `GAME_OVER` | `GameClientMessage` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `END_GAME_INFO` | `GameEndView` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `REPLAY_GAME` | `null` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `REPLAY_INIT` | `GameView` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
| `REPLAY_UPDATE` | `GameView` | UPDATE (may be dropped when outdated) | State snapshot; newer ones replace older ones. |
| `REPLAY_DONE` | `string` | TABLE_CHANGE (ordered) | Lifecycle event: open, switch or close a screen. |
<!-- END GENERATED: callbacks -->

### Pre-game prompt markers

The bridge names the questions asked before the first turn, so clients don't have to recognize them by their text.
The marker is added to the JSON prompt only (the desktop client is unaffected), as `data.options.webPrompt`:

| Marker | Event | Question |
|--------|-------|----------|
| `mulligan` | `GAME_ASK` | Keep or mulligan the opening hand (`true` = mulligan). |
| `mulliganBottom` | `GAME_TARGET` | London mulligan: choose a card from hand to put on the bottom of the library. |
| `startingPlayer` | `GAME_TARGET` | Choose the player who takes the first turn. |

Markers are only set while `gameView.step` is absent (before the first turn). Clients should keep a fallback for
servers without the bridge marker.

## Deck import

`deckImportFromUrl(url)` reads a deck from a deck website link and returns an `ImportedDeck`: the site's card names
with set codes and, where the site has them, collector numbers, split into `main`, `side`, `commanders` and
`companion`, plus name, author, format (as an XMage deck type), cover card and when the deck last changed on the site.
The web client matches the cards against the card database itself (`lookupCards`), so a site's spelling never
decides what the server accepts.

The server reads Archidekt, TCGplayer Infinite, MTGTop8, Scryfall and ManaBox (`mage.server.websocket.service.deckimport`,
one `DeckSource` per site). Moxfield, MTGGoldfish, AetherHub, TappedOut and Deckstats block automated reads; the client
handles them by copy and paste, or with its "Send to Playmat" bookmarklet.

Rules the server keeps:

- It fetches only from the sites' own hosts, over https on port 443, following redirects only to those hosts. GET only, no cookies, an 8 second deadline and a 2 MB cap.
- Ten imports a minute per session. Results are cached for five minutes, and cached reads don't count.
- A site that fails three times in a row in a way that means it changed or blocks the server (`site_changed`, `blocked`) is reported as `degraded` by `deckImportSources` for 30 minutes; the client sends players to copy and paste instead.
- The log keeps per-site success and failure counts only, never links, deck contents or user names.

Failures come back as error `-32005` with `data: {"reason": ...}`:

| Reason | Meaning |
|---|---|
| `private` | The deck exists but isn't shared. |
| `not_found` | No deck at that link. |
| `blocked` | The site turned the server away (bot protection). |
| `rate_limited` | Too many imports from this session, or the site asked us to slow down. |
| `site_changed` | The site answered in a shape the server doesn't read. |
| `unsupported` | Not a deck link the server reads. |
| `too_large` | More than 2 MB. |
| `timeout` | The site didn't answer in time. |
| `unavailable` | The site is down or unreachable. |

Recorded responses from every site live in `Mage.Server/src/test/resources/deckimport` and back the unit tests.
To find out whether a site changed, run the live canary weekly (it imports one known public deck per site over
the network, and is skipped in normal builds):

```
mvn -pl Mage.Server test -Dtest=DeckImportLiveCanaryTest -Dxmage.deckImportCanary=true
```

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

## Example Flows

### Login Flow

```json
// 1. Connect user
{"jsonrpc": "2.0", "method": "connectUser", "params": ["myuser", "mypass", "any-id", "", "", ""], "id": 1}
// Response: {"jsonrpc": "2.0", "result": true, "id": 1}

// 2. Remember the restore token for a later reconnect (pass it as connectUser's 4th param)
{"jsonrpc": "2.0", "method": "sessionGetRestoreToken", "params": [""], "id": 4}
// Response: {"jsonrpc": "2.0", "result": "restore-token", "id": 4}

// 3. Set user data
{"method": "connectSetUserData", "params": ["myuser", "session-uuid", {"groupId": 0, "avatarId": 51, "confirmEmptyManaPool": true, "userSkipPrioritySteps": {...}, "flagName": "world.png"}, "1.0", ""], "id": 2}
// Response: {"jsonrpc": "2.0", "result": true, "id": 2}

// 4. Get main room ID
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
