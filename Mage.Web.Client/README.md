# Mage Web Client

The browser client for this XMage fork: sign in, build decks, play the AI or other players, draft and run events, in a Playmat-styled table that aims for MTG Arena-level ease of play. It talks to the server over the JSON-RPC WebSocket bridge in `Mage.Server`.

- What it is for and who it serves: [PRODUCT.md](PRODUCT.md)
- The Playmat design system (tokens, components, rules): [DESIGN.md](DESIGN.md)
- The WebSocket protocol: [../docs/WebSocketAPI.md](../docs/WebSocketAPI.md)
- Deploying the client and server: [../ops/web/README.md](../ops/web/README.md)
- Backlog: the tracker at https://claude.ai/artifact/DAHwcrRiJseP94iUjjhR5A (the old `TODO.md` is archived in [docs/archive](docs/archive/TODO-2026-legacy.md))

## Stack

| Concern | Used |
|---|---|
| UI | React 19, TypeScript, Vite |
| Routing | react-router (data router, lazy routes for the heavier screens) |
| State | Zustand v5 stores; TanStack Query for server lookups (server state, tables, card search) |
| Primitives | Radix (dialog, dropdown menu, tabs, tooltip), lucide icons |
| Styling | CSS Modules on the Playmat tokens in `src/app/styles/tokens.css` |
| Sound | Web Audio (`src/app/match/sound.ts`) |
| Card images | Scryfall, cached in IndexedDB (`src/core/images`) |
| Tests | Vitest (unit), an accessibility script, Playwright (e2e and visual, not in CI) |

## Layout

```text
src/
├── app/            the new app (index.html, served at /)
│   ├── main.tsx    routes, global error hooks
│   ├── screens/    login, home (Play), decks, events, tables, game route
│   ├── match/      the match stage: board, hand, stack, prompts, overlays, card detail
│   ├── decks/      deck builder
│   ├── events/     draft, deck construction, event (tournament) screens
│   ├── stores/     the app's Zustand stores (session, games, decks, play, events, settings, toasts)
│   ├── ui/         shared primitives (Button, Dialog, Field, CardFace, Toaster...)
│   └── styles/     tokens and base CSS
├── core/           framework-free logic, unit tested
│   ├── rpc/        WebSocket JSON-RPC client and event bus
│   ├── game/       game session, interaction model, auto-pass and auto-pay, leaving games
│   ├── decks/      deck types, serializer (.dck/.txt/... import and export), local deck storage
│   ├── images/     card image resolution and cache
│   ├── telemetry/  error reporter (console by default, ring buffer of recent errors)
│   └── headless/   a headless game driver for live tests
└── protocol/generated/   types and API generated from the server's RPC registry (do not edit)
```

`src/app` and `src/core` never import the legacy client. The legacy client (`src/components`, `src/services`, `src/stores`, `src/types`, `legacy.html`) and the visual harness (`visual.html`) remain until every screen is replaced; legacy imports deck code from `src/core/decks`.

The protocol files are regenerated from the server: `mvn -pl Mage.Server test -Dtest=WebClientApiDocsTest -Dxmage.updateWebApiDocs=true`.

## Bringing a deck

Players bring decks they already have through one import sheet (`src/app/decks/import`), opened from the Decks
shelf, Home, the deck builder's "From a list…" menu, or `/import`:

- **A link** from Archidekt, TCGplayer, MTGTop8, Scryfall or ManaBox: the server reads the deck (`deckImportFromUrl`).
- **A link** from Moxfield, MTGGoldfish, AetherHub, TappedOut or Deckstats: these sites block other apps, so the sheet opens the deck on its site, says where its export is, and finishes when the player pastes the list.
- **A list** in Arena, MTGO, XMage `.dck`, MTGTop8 `.dec` or a site's text export, or a deck file dropped on the shelf.
- **"Send to Playmat"**, a bookmarklet from Settings → Import: on a deck page it reads the deck in the player's own browser and opens `/import#deck=…`. The deck travels in the URL fragment, which no server sees.

⌘V / Ctrl+V anywhere on Decks, Home or the builder (outside a text field) opens the sheet with whatever is on the
clipboard, and dropping a file, link or text on the shelf does the same.

The sheet previews the deck box as it will sit on the shelf, with its curve, card list and a live legality check.
Cards that don't match the card database become amber rows to fix (with a fuzzy printing search) or leave out;
fixes are remembered for the next import. Commanders go into the sideboard, the XMage convention. Imported
decks remember their site, so the Decks screen offers "Update from <site>" with a diff of what changed.

The parsing and matching live in `src/core/deckImport` (pure, unit tested); the site table is
`src/core/deckImport/sites.ts`, and the server's sources are in `Mage.Server/.../websocket/service/deckimport`
(see "Deck import" in `docs/WebSocketAPI.md`).

## Dev loop

```bash
npm install
npm run dev:all   # builds and starts the Mage server (HTTP 17171, WebSocket 17172) and Vite
```

- New app: http://localhost:5173/
- Legacy client: http://localhost:5173/legacy.html (until it is deleted)
- `Ctrl-C` stops both. If a server survives a failed shutdown, `npm run dev:kill` frees ports 17171 and 17172.
- `npm run dev` starts Vite alone, against a server you run yourself (default `ws://localhost:17172`).

To debug errors in the browser, `window.__mageErrors()` lists the last 50 reported errors.

## Scripts and gates

CI (`.github/workflows/web-client.yml`) runs the four gates on every change under `Mage.Web.Client/`:

```bash
npm run typecheck   # tsc -b
npm run lint        # ESLint; zero errors, warnings capped by --max-warnings
npm test            # Vitest unit tests, then the accessibility check
npm run build       # tsc -b and the Vite production bundle (new app, legacy, visual harness)
```

The lint warning cap only goes down: lower `--max-warnings` in `package.json` whenever you remove warnings.

Other scripts:

```bash
npm run test:watch          # Vitest in watch mode
npm run test:e2e            # Playwright specs (browser-only, mocked server)
npm run test:e2e:local      # Playwright against a running local server (MAGE_E2E_SERVER_URL, MAGE_E2E_USERNAME, MAGE_E2E_PASSWORD)
npm run test:visual         # Playwright visual baselines (macOS only, predate the rebuild, not in CI)
npm run preview             # serve the production bundle
```

Playwright's bundled browsers may not match the installed `@playwright/test`; set `PLAYWRIGHT_CHANNEL=chrome` to use the local Chrome.

## Conventions

- Zustand v5: a selector that returns a new array or object on every call loops renders. Select raw slices and derive with `useMemo`.
- Colors, spacing, type and layers come from the tokens (`--z-overlay`, `--z-dialog`, `--z-toast`...), never raw values.
- Pure logic goes in `src/core` with a unit test next to it.

## License

Part of the Mage/XMage project. See the root license files for project terms.
