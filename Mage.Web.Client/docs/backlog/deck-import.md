# Backlog: deck import from deck websites

Status: **implemented 2026-10-07** (DI-0 to DI-5) on `phase-0-foundation`. DX-1 (Moxfield direct import) stays deferred until Playmat is public. See "Implementation notes" at the end for where the build differs from this plan.

Players paste a link from one of the ten most-used deck websites, or a deck list, or drop a file, and the deck lands on their shelf ready to play. Import must feel like part of Playmat, not a utility dialog: one surface, instant site recognition, a preview of the deck box before saving, inline fixes for unknown cards, and a "Save and play" path.

## Decisions (made)

- Product name: **Playmat** (`APP_NAME` in `src/app/brand.ts`). Used in the bookmarklet label and the server User-Agent.
- Order: ship the import sheet on today's parsers first (DI-1), then URL import. The sheet is the UX core every later epic plugs into, and it exposes the card-fix report that already exists but is never shown.
- Fetching happens on the server, in the bridge, not in the browser. Only Scryfall sends permissive CORS headers. A typed server API is a smaller attack surface than a generic proxy.
- Sites that block automated fetches use an assisted paste flow, plus an optional "Send to Playmat" bookmarklet. Approved.
- Commanders go into the sideboard (the XMage convention). The client keeps a `commander` flag for display. Maybeboard is dropped, and the preview says so.

## Site reference (tested with curl 2026-10-07)

| Site | Tier | Deck URL | Endpoint | Notes |
|---|---|---|---|---|
| Archidekt | A | `archidekt.com/decks/{id}/{slug}` | `https://archidekt.com/api/decks/{id}/` | Richest JSON: name, owner, `deckFormat` (numeric), `featured`, per-card `categories`, `companion`, `edition.editioncode`, `collectorNumber`. Commander and sideboard come from category names; skip categories with `includedInDeck:false`. |
| TCGplayer Infinite | A | `infinite.tcgplayer.com/magic-the-gathering/deck/{slug}/{id}` | `https://infinite-api.tcgplayer.com/deck/magic/{id}/?subDecks=true&cards=true` | `subDecks`: `maindeck`, `sideboard`, `commandzone`. Has set but **no collector number**; resolve by name and set. |
| MTGTop8 | A | `mtgtop8.com/event?e={e}&d={id}` | `https://mtgtop8.com/dec?d={id}` (.dec with `[SET]`), or `/mtgo?d={id}` | No name or format in the export; scrape the event page title with jsoup. |
| Scryfall | A | `scryfall.com/@{user}/decks/{uuid}` | `https://api.scryfall.com/decks/{uuid}/export/csv` | Undocumented. `section` column (`commanders`, `outside`), `set_code`, `collector_number`. No deck name; read the page title. **Verify against a real deck first.** |
| ManaBox | A | `manabox.app/decks/{22-char id}` | `https://cloud.manabox.app/decks/{id}` | JSON; check the shape against a real deck. |
| Moxfield | B | `moxfield.com/decks/{publicId}` | `https://api2.moxfield.com/v3/decks/all/{id}` | Hard 403 from Cloudflare. Stays tier B until Playmat is public; see "Deferred". Export: More → Export → Copy for MTG Arena. |
| MTGGoldfish | B | `mtggoldfish.com/deck/{id}` | `/deck/download/{id}` (`?type=arena` for set codes) | Cloudflare challenge. Export: "Copy for Arena" button on the deck page. |
| AetherHub | B | `aetherhub.com/Deck/...` | `/Deck/FetchMtgaDeckJson?deckId={id}&langId=0&simple=false` | Cloudflare challenge. Export: "Export to MTGA". |
| TappedOut | B | `tappedout.net/mtg-decks/{slug}/` | `{url}?fmt=txt` | Cloudflare challenge. The `?fmt=txt` link opened in the user's own tab works as the export view. |
| Deckstats | B | `deckstats.net/decks/{user}/{id}-{slug}` | `{url}?export_mtgarena=1&include_comments=0` | Cloudflare challenge. Same trick as TappedOut. |

Later, outside the ten: Melee.gg (HTML only), Cubecobra (`/cube/download/xmage/{id}` returns XMage format, useful for cube drafts), EDHREC deck previews (`json.edhrec.com/pages/deckpreview/{hash}.json`).

Reference implementations: Forge `forge-gui/src/main/java/forge/deck/*DeckUrlProvider.java`, Cockatrice `deck_link_to_api_transformer.cpp`, phase-rs `lobby-worker/src/import-deck.ts`.

Tier A: the server fetches and parses. Tier B: we recognize the link, open the site's export view in a new tab, and finish on paste.

## Shared model

```ts
// src/core/deckImport/types.ts
type DeckSiteId = 'archidekt' | 'tcgplayer' | 'mtgtop8' | 'scryfall' | 'manabox'
  | 'moxfield' | 'mtggoldfish' | 'aetherhub' | 'tappedout' | 'deckstats';

type Recognized =
  | { kind: 'site'; site: DeckSiteId; remoteId: string; url: string }
  | { kind: 'unknownUrl'; url: string }
  | { kind: 'list'; text: string }
  | { kind: 'empty' };

interface DeckSource { site: DeckSiteId; url: string; remoteId: string; importedAt: number; remoteUpdatedAt?: number }

interface ImportDraft {
  deck: DeckCardLists;          // commanders already in the sideboard
  commanders: string[];         // card names, for display
  source?: DeckSource;
  dropped: { maybeboard: number };
  resolution: DeckResolutionResult; // from CardResolverService
}
```

Server error codes (`RpcException` data): `private`, `not_found`, `blocked`, `rate_limited`, `site_changed`, `unsupported`, `too_large`, `timeout`.

---

## DI-0 — Prerequisites

### DI-0.1 Verify the unconfirmed endpoints · S
With a real public deck on each, confirm the Scryfall CSV export and the ManaBox JSON shape. Record sample responses as fixtures (see DI-2.2).
- Done when fixtures exist for all five tier A sites, or a site moves to tier B with the reason written here.

---

## DI-1 — Import sheet on today's parsers (client only)

Goal: one import surface that replaces "Import file" and "Paste a list" and works everywhere, before any server work.

### DI-1.1 `recognize(input)` · S
`src/core/deckImport/recognize.ts`: a pure function that classifies input as site link (with site and id), unknown link, deck list, or empty. One data table of URL patterns per site (hosts, path regex, id group), shared later with the server's allowlist. Strips tracking params and accepts `www.` and mobile hosts.
- Tests: about 40 URL shapes across the ten sites, plus lists that contain URLs in comments, a bare id, and whitespace-only input.

### DI-1.2 `ImportDraft` pipeline · M
`src/core/deckImport/importDeck.ts`: text or file → `DeckSerializer.importDeck` → `cardResolverService.resolveDeckWithReport` → `ImportDraft`. Detects commander headers (`Commander`, `Commanders`, Moxfield's "1 X *CMDR*", Archidekt's `[Commander]`) and maybeboard sections, and fills `commanders` and `dropped`.
- Tests: fixtures for each site's text export format (Moxfield Arena export, MTGGoldfish Arena, TappedOut txt, Deckstats Arena, AetherHub), covering commander, companion, maybeboard and split cards.

### DI-1.3 Import sheet UI · L
`src/app/decks/import/ImportSheet.tsx` (+ module CSS). This is a large sheet, not the 560px dialog.
- **Input step.** One combined field that takes a link, a list or a file (drop or "choose a file"). As soon as the input is recognized, a site chip appears with the site's name, a simple monogram (our own drawing, no site logos) and a tier hint ("1 click" / "copy & paste").
- **Preview step.**
  - Left: the `DeckBox` with cover art and sleeve, exactly as it will look on the shelf.
  - Right: an editable name field, author, the source link, color pips, mana curve (reuse the builder's curve component; extract it if it isn't standalone), and main/side/commander counts.
  - A legality chip from `deckValidate`, with a format picker that defaults to the detected format.
  - Commanders are shown on their own plate.
  - "N maybeboard cards weren't imported" note.
- **Card fixes.** Unresolved and ambiguous cards appear as amber rows above the list ("3 cards need a look"). Each row has a printing picker (reusing `searchAlternates` and `parseAlternateSearch`) and a "leave out" option. The resolver already remembers choices, so the same fix isn't asked again.
- **Printings toggle:** "Keep the site's printings" or "Use my preferred art".
- **Actions:** `Save and play` (decision), `Open in builder`, `Save`. Enter saves. Esc goes back a step, then closes.
- **After save:** the sheet closes, the new deck box animates onto the shelf and is selected, and a toast offers "Undo".
- Copy follows the voice in PRODUCT.md: short, second person, no jargon.

### DI-1.4 Entry points · M
- Decks screen: one `Import` button replaces the two old buttons. The hidden file input moves into the sheet.
- Global paste: ⌘V/Ctrl+V on Decks, Home and the deck builder, when focus isn't in an editable field and the clipboard holds a link or a list (`recognize` ≠ empty), opens the sheet already filled in. Use the `paste` event, not the Clipboard read API, so no permission prompt.
- Drag and drop on the Decks shelf and the Home roster: files, links and text. The shelf shows a stitched drop target while dragging.
- Route `/import` with `?url=` and `#deck=` support. Opening it while signed out goes through login and then returns to the sheet.
- Deck builder footer: a `From a list…` menu with "Replace deck" and "Add to deck" (`appendDeckCardLists`).
- Home: an `Import` action next to `Manage` on the roster.

### DI-1.5 Store and storage · S
- `useDecks.importDraft(draft, { play?: boolean })` replaces `importText`, and the old callers are migrated.
- `DeckCardLists` gets an optional `source?: DeckSource`, stored as part of the deck in localStorage (`DeckStorageService`). No migration is needed because the field is optional. `DeckSummary` exposes `source.site` for the detail pane.

### DI-1.6 Tests and a11y · S
- Vitest for the store and the pipeline.
- Playwright: paste a list → fix one card → Save and play → the game starts (live-server spec).
- Add the sheet (both steps) to `e2e/app-accessibility.spec.ts`. Fix results are announced in a live region, and focus moves to the first card that needs a fix.

DI-1 exit: all gates green (`typecheck`, `lint`, `test`, `build`, axe), plus screenshots in `.impeccable/review/` for the input, preview and fix states.

---

## DI-2 — Server URL import: Archidekt, MTGTop8, Scryfall

### DI-2.1 `deckimport` service · L
New Java package `mage.server.websocket.service.deckimport`:
- `DeckSource` interface: `id()`, `tier()`, `matches(URI)`, `fetch(URI, Fetcher) → ImportedDeck`.
- `ImportedDeck`: name, author, format (mapped to XMage deck types), main, side, commanders, companion, cover (`setCode` + `cardNumber`), `remoteUpdatedAt`, canonical URL, maybeboard count.
- `Fetcher`: `java.net.http.HttpClient` with these rules:
  - Exact host allowlist taken from the registered sources; redirects followed by hand and only to allowlisted hosts. Reject IP literals, non-443 ports and non-https.
  - GET only, no cookies. User-Agent `Playmat/<version> (+<url>)`.
  - 8 s timeout, 2 MB cap enforced while streaming.
- Errors map to the codes in "Shared model". A parse failure becomes `site_changed`, never a stack trace.
- Cache: in memory, by canonical URL, 5 minutes, at most 200 entries.
- Health: count consecutive `site_changed`/`blocked` errors per site; 3 in a row marks the site degraded for 30 minutes.
- jsoup and gson come from `Mage/pom.xml`; no new dependencies.

### DI-2.2 Sources and fixtures · M
`ArchidektSource`, `MtgTop8Source`, `ScryfallSource`. Each has JUnit tests that run against recorded responses in `Mage.Server/src/test/resources/deckimport/<site>/` (no network in CI). Cover a commander deck, a 60-card deck with a sideboard, a companion, split and DFC names, and a private/404 response.

### DI-2.3 `DeckImportApi` · S
New `api/DeckImportApi.java`, registered next to `CatalogApi`:
- `deckImportFromUrl(url)` → `ImportedDeck`. Requires a session. Limited to 10 calls a minute per session (reuse the `ConnectionState` strike pattern).
- `deckImportSources()` → `{ site, tier, status: 'ok' | 'degraded' }[]`. Public.
- Regenerate the client types: `mvn -pl Mage.Server test -Dtest=WebClientApiDocsTest -Dxmage.updateWebApiDocs=true`. `WebClientApiContractTest` must pass.

### DI-2.4 Client wiring · M
- `importDeck` routes tier A links to `deckImportFromUrl` and maps `ImportedDeck` into an `ImportDraft` with `source`.
- The sheet's input step shows a fetching state on the deck box (the plate shimmers, no spinner overlay). It can be cancelled.
- Each error code has its own message and next step, and every one ends with a way forward, usually paste. For example:
  - `private`: "This deck is private. Make it public or unlisted on Archidekt, or paste its list."
  - `site_changed` / `blocked`: "Archidekt changed how its decks load. Paste the list for now." The sheet then switches to the assisted flow (DI-4).
  - `rate_limited`: "Too many imports at once. Try again in a minute."
- The site chip reads `deckImportSources` (cached for the session), so a degraded site shows as "copy & paste" straight away.

DI-2 exit: paste an Archidekt, MTGTop8 or Scryfall link → preview within 2 s on a warm server → save. A live-server Playwright spec uses one known public deck per site but is tagged `@network` and skipped in CI.

---

## DI-3 — TCGplayer, ManaBox, re-sync

### DI-3.1 `TcgplayerSource`, `ManaboxSource` · M
Fixtures and tests as in DI-2.2. TCGplayer cards come without collector numbers; send name and set, and let the client resolver choose the printing.

### DI-3.2 Update from source · M
- Decks detail pane: "From Archidekt · updated 3 days ago", a link to the source, and an `Update from Archidekt` button (tier A only; tier B shows "Paste a new list").
- Update fetches again, then shows a diff sheet (+ rows in sage, − rows in oxblood, count changes). `Update deck` keeps the deck id, sleeve, cover choice and name (unless the user hasn't renamed it).
- The deck builder footer shows the same source line.
- Tests: diff function unit tests; Playwright with a stubbed RPC.

---

## DI-4 — Assisted flow for blocked sites, and the bookmarklet

### DI-4.1 Site guides table · S
`src/core/deckImport/siteGuides.ts`: for each tier B site (and any degraded tier A site), the export URL to open (built from the deck URL when the site has one, e.g. `?fmt=txt`) and one sentence of instructions in the site's own words. This is the single file to change when a site moves its buttons.

### DI-4.2 Assisted step in the sheet · M
For a tier B link, the sheet shows the deck box placeholder with the site chip, the one-sentence instruction, and `Open <Site> export` (opens a new tab with `noopener`).
- When the window regains focus, the sheet shows "Press ⌘V to finish" next to a pulsing paste target. The paste event fills the list. If the clipboard holds a link rather than a list, it shows a hint instead.
- The pasted list is matched to the remembered link, so the deck keeps `source` (name from the paste if the export carries one, otherwise the URL slug, prettified).
- Tests: Playwright simulates focus and paste events.

### DI-4.3 "Send to Playmat" bookmarklet · M
- `public/bookmarklet.js`, a small script loaded by a one-line bookmarklet. On a supported deck page, it fetches the deck from that page's own API in the user's session (Moxfield v3, AetherHub JSON, MTGGoldfish download, TappedOut `?fmt=txt`, Deckstats Arena export; same-origin or the site's own CORS). It then opens `https://<playmat host>/import#deck=<base64url JSON of {site, url, text}>`. The fragment is never sent to any server.
- `/import` reads the fragment, clears it from the address bar, and opens the sheet at the preview step.
- Settings → "Import": a draggable "Send to Playmat" link, with three lines on how to install it and a note that it only reads the deck page it runs on.
- Limits: stop at 200 KB of payload, and show a message on unsupported pages instead of failing silently.
- Tests: a unit test for the payload codec; a Playwright test that loads a fixture page standing in for a deck site and runs the script.

---

## DI-5 — Hardening

- **DI-5.1 Live canary · S.** A script, `Mage.Server` test tagged `network` and not run in CI, that imports one known public deck per tier A site and fails loudly. Document running it weekly (or as a scheduled task) in `docs/WebSocketAPI.md`.
- **DI-5.2 Telemetry-free diagnostics · S.** The server logs per-site counts of successes and errors at INFO, never with deck contents or user names.
- **DI-5.3 Docs · S.** Add the `deckImport*` methods to `docs/WebSocketAPI.md`. Add a "Bringing a deck" section to the web client README. Update DESIGN.md with the import sheet, site chip and drop target.
- **DI-5.4 Finish review · S.** Run the impeccable finish review over the import surfaces and fix what it finds.

## Deferred until Playmat is public

### DX-1 Moxfield direct import · S request, M code
Deferred 2026-10-07: wait until Playmat has a public host. Until then, Moxfield uses the assisted flow (DI-4.2) and the bookmarklet (DI-4.3), which covers it fully.
1. Email Moxfield support asking them to approve the User-Agent `Playmat/<version> (+https://<public host>)` for read-only fetches of public decks a user pastes in, at a low request rate and with caching. Moxfield publishes no policy; they approve agents case by case.
2. If they approve, add `MoxfieldSource` as in DI-3.1: v3 endpoint, `boards.mainboard/sideboard/commanders/companions`, `main` as the cover, fixtures and tests. Then move Moxfield to tier A in the site table and `siteGuides.ts`.

## Out of scope

Collection or ownership import, Arena log parsing, exporting to sites, cube imports, account linking with any site.

## Implementation notes (2026-10-07)

Everything in DI-0 to DI-5 shipped. Where the build differs from the plan above:

- **DI-0.1**: recorded fixtures for all five tier A sites live in `Mage.Server/src/test/resources/deckimport/` (trimmed to the fields we read). Scryfall uses `/decks/{id}/export/json` instead of the CSV: it carries the deck name, format and author, which the CSV doesn't. ManaBox boards: 0 deck, 1 sideboard, 2 commander; anything else is treated as maybeboard. ManaBox format 4 is Commander.
- **Server**: the bridge targets Java 8, so the fetcher uses `HttpURLConnection`, not `java.net.http`. Card names, set codes and collector numbers come back as the site wrote them; the client matches them with `lookupCards`. Failures are RPC error `-32005` with `data.reason`; a ninth reason, `unavailable` (site down), was added.
- **Matching** (`core/deckImport/resolve.ts`): batched `lookupCards` (one or two round trips per deck) instead of a search per card. Accents are folded ("Andúril" → "Anduril"), double-faced names written in full fall back to the front face, and "Find it" is a fuzzy search (each word, a prefix, ranked by letter-pair similarity) with the server's preferred printing first and art thumbnails. Fixes are remembered in `playmat.cardFixes`.
- **Commander decks**: the sideboard holds only the commanders; other sideboard cards and the companion are left out, and the preview says how many.
- **Entry points**: paste and drop also work on Home's roster. The builder's "From a list…" offers Replace deck and Add to deck; the sheet then hides name, format and legality, since the cards aren't a deck of their own.
- **Bookmarklet** (DI-4.3): the source is `src/app/decks/import/bookmarklet.source.js`, not `public/`. Settings inlines it into the `javascript:` link, because deck sites' content security policies would block a script loaded from Playmat's host.
- **Re-sync**: an imported deck keeps `source` (site, link, id, import time, remote update time, imported name). "Update from <site>" shows a diff and keeps the deck id, sleeve, cover, and the player's own name if they renamed it. Assisted sites show "Paste a new list", which replaces the cards.
- **Tests**: `npm test` covers recognition (about 40 links), parsing of every site's text export, matching, drafts, payloads and diffs. Server: `DeckImportSourcesTest` and `DeckImportServiceTest` (fixtures, allowlist, cache, rate limit, health). Live checks: `npm run test:e2e:local:deck-import` (add `MAGE_E2E_NETWORK=1` for a real Archidekt deck), the axe spec covers the sheet's three steps, and `DeckImportLiveCanaryTest` (`-Dxmage.deckImportCanary=true`) imports one real deck per site.
- **Review shots**: `node e2e/import-review-shots.mjs` (BASE, NETWORK=1, TABLET=1) writes `.impeccable/review/import-*.png`.
- **Finish review** (DI-5.4): two rounds with the impeccable finish reviewer. Applied: one amber per screen (footer rules above, shelf Import is print), second-person legality lines (`src/app/decks/legality.ts`), printed site row with a legend, the sheet on `ui/Dialog` (`width="xl"`, `onBack`) with `Button`/`ButtonLink` primitives, a one-line empty-shelf hint, scroll fades, top-aligned loading with Cancel focused, matched button sizes in the Decks detail, and a Mat Print of the cover behind the preview's deck box.
