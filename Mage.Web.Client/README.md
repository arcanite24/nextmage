# Mage Web Client

A Vite + React web client for the Mage/XMage server fork. The client talks to the server through the JSON-RPC WebSocket bridge and provides a Magic Arena-inspired play surface for lobby, deck, chat, and match interactions.

## Features

- WebSocket session/login flow with callback dispatch into Zustand stores
- Lobby, table creation/joining, waiting room, chat, deck manager, and deck editor
- Arena-style game screen with battlefield zones, stack, hand fan, priority controls, phase display, and player HUDs
- Interactive game prompts for targeting, choices, amounts, piles, sideboarding, mana payment, and visible zones
- Framer Motion-backed hand and combat animations with configurable speed
- Persistent client settings for animation behavior, image preloading, image-cache trimming, and mana automation
- Scryfall image loading with IndexedDB caching and card-back fallbacks
- Debug mode with board state, action history, image cache, and export tools

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Vite + React 19 |
| Language | TypeScript |
| State Management | Zustand with Immer |
| Styling | Vanilla CSS with shared design tokens |
| Animation | Framer Motion |
| WebSocket | Native WebSocket JSON-RPC |
| Validation | Zod |
| Image Cache | IndexedDB |

## Getting Started

### Prerequisites

- Node.js 18+
- Mage/XMage server with the WebSocket bridge enabled
- Default server URL: `ws://localhost:17172`

### Installation

```bash
cd Mage.Web.Client
npm install
```

### Development

```bash
npm run dev
```

The development server starts at `http://localhost:5173`.

To run the web client and a local Mage server together:

```bash
npm run dev:all
```

Use `Ctrl-C` in that terminal to stop both Vite and the Mage server.
If the Mage server or WebSocket listener survives a failed shutdown, run `npm run dev:kill` from `Mage.Web.Client` to clear the local server listeners on ports `17171` and `17172`.

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```text
src/
├── components/
│   ├── common/       Shared buttons, modals, card, mana, and navbar UI
│   ├── login/        Login and registration screen
│   ├── lobby/        Tables, table creation, deck selection, waiting room
│   ├── deck/         Deck manager and editor
│   ├── chat/         Match/lobby chat panel
│   ├── debug/        Match debugging and export tools
│   ├── settings/     Client settings and cache management
│   └── game/         Arena game UI, prompts, battlefield, hand, stack, HUDs
├── services/         WebSocket, image cache, config, keybinds, cards, debug export
├── stores/           Zustand stores for session, lobby, deck, game, chat, animation, settings
├── types/            API, game, model, and debug types
└── config/           Animation constants and helpers
```

## WebSocket Integration

The client uses `WebSocketService` for JSON-RPC requests and server callbacks. `initializeCallbackDispatcher()` normalizes callback names such as `GAME_UPDATE`, `GAME_TARGET`, and `START_GAME`, then routes them into the session, lobby, game, and chat stores.

Common match actions are sent through the game store:

- `sendPlayerAction` for priority, concede, undo, auto-mana, and similar actions
- `sendPlayerUUID` for targets, cards, players, and other UUID selections
- `sendPlayerBoolean`, `sendPlayerInteger`, and `sendPlayerString` for prompt responses
- `sendPlayerManaType` for paying mana from the pool

## Client Settings

The Settings page persists browser-local preferences through `AppConfigService`, which is intentionally adapter-based so a future Electron shell can replace `localStorage` without changing React components.

Current settings include:

- Enable/disable animations
- Animation speed multiplier
- Preload visible match images into the IndexedDB image cache
- Auto-pay mana and use-first-mana-ability toggles
- Cache trim age, cache trim, and cache clear actions

## Scripts

```bash
npm run dev      # Start Vite dev server
npm run dev:all  # Start the Mage server and Vite dev server together
npm run dev:kill # Stop leftover local Mage server/WebSocket listeners
npm run build    # TypeScript project build plus Vite production bundle
npm test         # Node service tests plus accessibility gate
npm run test:visual        # Playwright visual regression screenshots
npm run test:visual:update # Regenerate visual screenshot baselines
npm run test:e2e -- --list # List browser workflow specs and local-server smoke flows
npm run test:e2e -- e2e/deck-editor-workflows.spec.ts # Browser-only deck editor save/load, legality, zone-move, selected-remove, import/export, import fixing, Add Lands, Generate, search/filter, and analytics workflows
npm run test:e2e:local     # Run local-server smoke flows; requires Mage server and credentials
npm run test:e2e:local:foundation   # Login, deck import, create/join table
npm run test:e2e:local:normal-match # Add AI, start match, priority shortcut, zone dialog
npm run test:e2e:local:replay-watch # Sideboard/watch/finished-match opt-in fixtures; replay fixture needs saveGameActivated=true
npm run test:e2e:local:tournament   # Constructed tournament opt-in fixture
npm run test:e2e:local:draft        # Booster-draft first-pick and Sealed construction opt-in fixtures
npm run lint     # ESLint
npm run preview  # Serve the production bundle locally
```

Browser-only E2E specs run against Vite with seeded browser storage and mocked server calls where appropriate. The deck editor workflow spec currently verifies metadata Save, Save As into a distinct stored copy, New, dirty-change confirmation, dirty app-navigation cancel/accept behavior, Load from the saved-deck picker, browser-equivalent last import/export file history, legality warning labels and issue-to-row highlighting, Alt+double-click movement, deck-row drag/drop movement between main deck and sideboard, temporary source-row preservation during drag, selected-row bulk removal, import-source chooser options, file import through editor replace and manager new-deck flows, stale DCK set/card-number auto-fix through manager import, Cockatrice `.cod`, OCTGN `.o8d`, MTGJSON `.json`, and XMage `.draft` log imports through the manager, clipboard import through manager new-deck and editor replace/append chooser flows, editor and manager file export downloads, editor and manager clipboard export serialization, unresolved import-fixer search/apply/remember behavior across editor dropped-text, editor dropped-file, manager dropped-text, and manager file imports, Add Lands searchable set/printing-option controls including free-building versus limited snow-basic behavior, Generate dialog deck replacement/settings persistence, card search/filter persistence with modifier-key exclusions, and rendered analytics counts from resolved card metadata without requiring a Mage server.

For local-server E2E, start a Mage server with the WebSocket bridge enabled and set `MAGE_E2E_SERVER_URL`, `MAGE_E2E_USERNAME`, and `MAGE_E2E_PASSWORD` as needed. The default server URL is `ws://127.0.0.1:17172`, and the default credentials use a short per-run `web_<runid>` username with password `testpass`, which is suitable for the auth-disabled local developer server. Set explicit credentials when testing against a server that requires registered users.

The local-server specs are split by feature area and the aggregate `test:e2e:local` command forces `--workers=1` so the same smoke user is not logged in by multiple Playwright workers. The harness tracks created tables, leaves visible games/waiting rooms through the UI, and opens a cleanup websocket session to remove leftover tables when the server still exposes them. Passing coverage currently includes login, deck-manager import-source chooser visibility, deck file import against a real server session, stale DCK set/card-number and stale-name auto-fixes, Cockatrice `.cod`, OCTGN `.o8d`, MTGJSON `.json`, and XMage `.draft` imports through live card data, unresolved deck import fixing through live alternate search, remembered import-fix reuse in the editor, unresolved editor replace/append fixing, imported-deck file export content, imported-deck clipboard export content, deck-editor import-source chooser visibility, editor file replace import with unsaved-change confirmation, editor clipboard append import through live card resolution, connected Add Lands set search and sideboard insertion, connected legality warning rendering and issue-to-row selection, connected card search/filter rendering and persistence, connected deck generation through live card search, connected analytics rendering from server-resolved imported decks, connected deck editor count edit, drag/drop movement, temporary source-row preservation during drag, Alt+double-click movement, double-click removal, selected-row bulk removal, connected deck metadata Save, Save As, New, dirty-load confirmation, saved-deck Load, create/join table, deck selection, add AI, start a normal match, send the F2 priority shortcut, and open a zone.

Sideboard/watch/replay, tournament, and draft flows remain explicit `fixme` specs by default. Their specs contain opt-in fixture contracts behind `MAGE_E2E_ADVANCED_FLOWS=1`: direct websocket fixture sessions can seed sideboard-capable tables, watchable normal matches, finished normal matches, constructed tournament tables, booster-draft tables, a first-pick Booster Draft command flow that marks a real card, reports booster-loaded, and submits that pick, and a Sealed Swiss construction table that receives `CONSTRUCT`, submits a limited deck, and advances to an in-game tournament round. A separate `MAGE_E2E_REPLAY_FLOWS=1 npm run test:e2e:local:replay-watch` gate verifies a saved-game replay fixture (`REPLAY_GAME -> REPLAY_INIT -> REPLAY_UPDATE/REPLAY_DONE`) when the local server is started with `saveGameActivated=true`. The default dev server has saved-game replay disabled, so keep replay opt-in out of required gates until the dev server exposes a first-class replay config and the replay UI controls are wired to live payload state.

The visual harness also includes a selector-only promotion contract for future activity flows: replay, tournament, draft, sideboard, and limited-construction workspaces expose stable command selectors while their buttons remain disabled until live callback payloads are wired. Run `npm run test:e2e -- visual/core-screens.spec.ts --grep "activity workspace promotion selectors"` to verify that contract without requiring a local Mage server.

## Notes

`npm run build` is the primary verification target for this client today. `npm run lint` currently reports a broad existing lint backlog across debug, deck, game, lobby, service, store, and type files; cleanups should be handled in focused follow-up work.

## License

Part of the Mage/XMage project. See the root license files for project terms.
