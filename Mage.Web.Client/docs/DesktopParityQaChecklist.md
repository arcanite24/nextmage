# Desktop Parity QA Checklist

Use this checklist before declaring the web client feature-complete against the Java client. The goal is not to make the web UI look like Swing; it is to prove every desktop capability remains reachable while the web app presents it through the Arena-style shell.

## Reference Sources

Use these Java client files as the source of truth when resolving behavior questions:

| Area | Java source |
| --- | --- |
| App shell, menus, panel switching | `Mage.Client/src/main/java/mage/client/MageFrame.java` |
| Session actions and callbacks | `Mage.Client/src/main/java/mage/client/SessionHandler.java` |
| Login and server connection | `Mage.Client/src/main/java/mage/client/dialog/ConnectDialog.java` |
| Preferences | `Mage.Client/src/main/java/mage/client/dialog/PreferencesDialog.java` |
| Lobby tables | `Mage.Client/src/main/java/mage/client/table/TablesPanel.java` |
| Create table | `Mage.Client/src/main/java/mage/client/dialog/NewTableDialog.java` |
| Create tournament | `Mage.Client/src/main/java/mage/client/dialog/NewTournamentDialog.java` |
| Match screen | `Mage.Client/src/main/java/mage/client/game/GamePanel.java` |
| Battlefield/player panels | `Mage.Client/src/main/java/mage/client/game/PlayAreaPanel.java`, `Mage.Client/src/main/java/mage/client/game/PlayerPanelExt.java` |
| Deck editing | `Mage.Client/src/main/java/mage/client/deckeditor/DeckEditorPanel.java` |
| Card viewer | `Mage.Client/src/main/java/mage/client/deckeditor/collection/viewer/CollectionViewerPanel.java` |
| Chat | `Mage.Client/src/main/java/mage/client/chat/ChatPanelBasic.java` |
| Tournament view | `Mage.Client/src/main/java/mage/client/tournament/TournamentPanel.java` |
| Draft view | `Mage.Client/src/main/java/mage/client/draft/DraftPanel.java` |

## Entry Gates

- [ ] `npm test` passes in `Mage.Web.Client`.
- [ ] `npm run build` passes in `Mage.Web.Client`.
- [ ] Known lint backlog is either fixed or explicitly documented with no new lint errors in changed files.
- [ ] Callback fixture replay covers the scenario family being certified.
- [ ] Browser testing includes current desktop Chrome plus one narrow viewport check for responsive overflow.
- [ ] QA evidence folder or ticket includes screenshots/videos, debug export, callback fixture export, server log excerpt, and browser console state for every failed scenario.

## Shell, Session, And Recovery

- [ ] Login with a saved server URL, disconnect, reconnect, and restore session without losing user identity or main-room state.
- [ ] Switch between lobby, active game, deck manager, settings, watched game, replay, tournament, draft, sideboard, and construction activities without dropping callbacks.
- [ ] Return to lobby while a match continues, then reopen the match from the activity switcher with the latest game view.
- [ ] Receive stale callback payloads out of order and verify update callbacks are ignored while dialog/message callbacks still render.
- [ ] Handle bad connection/reconnect notifications with user-visible status and no duplicated callback subscriptions.
- [ ] Run full disconnect, keep-games disconnect, exit, reconnect, and resource-download user requests through the shared request modal.
- [ ] Verify About/version, What's New, feedback, resource/download, reconnect, and debug/advanced actions are reachable from web toolbar surfaces.

## Lobby And Tables

- [ ] Show active and finished tables with desktop-equivalent fields: owner, seats, players, game type, deck type, status, password, created/started time, skill, rated, quit ratio, and minimum rating.
- [ ] Sort and filter tables, persist selected table and table visibility, and keep selection stable during refresh.
- [ ] Create a normal match with every Java `MatchOptions` field that the server exposes.
- [ ] Validate Commander, Freeform Commander, Brawl, Tiny Leaders, Momir Basic, Oathbreaker, limited, and custom option combinations with clear inline errors.
- [ ] Join a password table, add/remove/swap seats, add all supported computer player types, submit decks, leave table, remove table, and start match as host.
- [ ] Use table chat and lobby chat during table setup and confirm unread/status behavior survives navigation.
- [ ] Watch an active table and open replay/watch actions from finished matches.

## Decks, Card Browser, And Resources

- [ ] Import decks from clipboard and files in all supported formats, including unresolved-card fixups and set alias/card-number edge cases.
- [ ] Save, load, rename, create, delete, export, and clipboard-copy decks with unsaved-change confirmations.
- [ ] Exercise collection filters: name, type, rules, unique, color, rarity, set/format, Penny Dreadful, mana value, card-grid/list view, sorting, piles, and persisted settings.
- [ ] Move cards by drag/drop, double-click, Alt+double-click, exact count entry, and main/sideboard transfer.
- [ ] Run Add Lands and deck generator flows in free-build, limited construction, and sideboard contexts.
- [ ] Verify card legality labels, deck analytics, format errors, sideboard counts, and selected-card behavior.
- [ ] Open standalone card viewer with cards/tokens/emblems/planes toggles, paging, format selection, search, and large-card preview.
- [ ] Confirm card images, symbols, cache trim/clear, missing-image fallback, language/source settings, and browser-cache replacement for desktop downloads.

## Match Screen

- [ ] Start a two-player match and complete core priority actions: F2/F3/F4/F5/F6/F7/F9/F11 equivalents, hold priority, cancel skips, pass until stack resolves, and auto-pass.
- [ ] Play basic card, land, activated ability, triggered ability, target, modal choice, and stack-resolution flows through server callbacks.
- [ ] Verify multiplayer layouts for Commander/free-for-all, watchers, range of influence, and attack option display.
- [ ] Confirm all player HUD fields: avatar, flag, name, active/dead/left state, timer, life, poison, energy, experience, rad, hand, library, graveyard, exile, command zone, mana pool, wins, monarch, initiative, city blessing, designations, and arbitrary counters.
- [ ] Open every visible/hidden zone: graveyard, exile groups, revealed/looked-at cards, companion, command zone, commanders, emblems, dungeons, planes, designations, sideboard, limited deck, library/top card when visible, watched hands, and permitted opponent hands.
- [ ] Validate battlefield grouping, counters, attachments, tapped/attacking/blocking state, summoning sickness, playable indicators, target indicators, tokens, copies, and double-faced/split cards.
- [ ] Check combat visualization: attack/block arrows, target arrows, stack-to-target motion, damage/life-gain feedback, selected-target badges, and reduced-motion behavior.
- [ ] Exercise card hover, right-click/context actions, zoom, card info pane, rules text, ability icons, reminder text, set symbols, and image fallback modes.
- [ ] Export game log/debug data and confirm chat, personal messages, errors, status messages, and turn/phase context are complete.

## Prompts And Dialogs

- [ ] Verify every game prompt callback: ask yes/no/done, target, select, choose ability, choose pile, choose choice, play mana, play X mana, select amount, get amount, select multi amount, get multi amount, sideboard, construct, and user request dialogs.
- [ ] Cover optional and required choices, min/max selections, empty special values, text input, key choices, hint types, search/filter, mana choices, and repeated prompt reuse.
- [ ] Test large card/pile/target prompts with keyboard navigation, selected count, min/max progress, clear/cancel, and no accidental double-submit.
- [ ] Test graveyard ordering and other ordered multi-card movement prompts.
- [ ] Confirm focus traps, Escape/Enter behavior, screen-reader names, high-scale text, and mobile/narrow viewport overflow.

## Chat, Social, Replay, And Events

- [ ] Join lobby, table, game, and tournament chat channels, then navigate away/back without losing unread counts or channel state.
- [ ] Render timestamps, turn info, user/status/game/personal styles, whispers, mana symbols, card popups, clickable links, and ignored/profanity-filtered users.
- [ ] Use `/ignore`, `/unignore`, whisper controls, and social/user-list actions where supported.
- [ ] Watch a live match, request/revoke hand permission, stop watching, and verify watcher-only controls are restricted.
- [ ] Open finished-match replay, run previous/next/skip/autoplay controls, stop replay, and verify replay callbacks stay in order.
- [ ] Receive browser notification/toast equivalents for priority, draft pick ready, match start, reconnect attempts, connection loss, tournament round start, and major server/user messages.

## Tournament, Draft, And Limited

- [ ] Create every tournament type with game type, deck type, rounds, player count, multiplayer flag, time/buffer/construction timers, spectators, rollback, rated, quit ratio, minimum rating, password, player types, and player skills.
- [ ] Configure sealed/draft pools, random draft, rich/reshuffled random draft, cubes, Cube From Deck, Jumpstart packs, and missing-pack validation.
- [ ] Save/load tournament presets and verify default/last/config slots.
- [ ] Open tournament activity with state header, start/end time, running info, timers, standings, match table, watch buttons, tournament chat, close, and quit.
- [ ] Complete draft pick flow: booster grid, picked cards, hidden toggles, card marking, pack/pick number, set names, pass direction/table visualization, player list, countdown, click protection, waiting state, and pick-ready notification.
- [ ] Complete limited construction and sideboarding as full deck-editor modes with timer, submit timer, add lands, live deck updates, autosave, submit, view limited deck, and view sideboard.

## Completion Evidence

- [ ] Each checklist section has one pass/fail owner and date.
- [ ] Every failure has a linked issue/TODO item with reproduction steps and expected Java behavior.
- [ ] Every passed scenario records the browser, server revision, web client revision, test account/deck/table setup, and evidence artifact path.
- [ ] P0/P1 feature-complete sign-off includes at least one clean local-server smoke run from login through completed match and replay.
