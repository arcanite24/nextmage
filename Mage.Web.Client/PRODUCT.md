# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Magic: The Gathering players who want to play on an XMage server from a browser. Two audiences, served in this order:

1. A small private group on a self-hosted server: casual sessions, playing each other and the server's AI, with as little setup friction as possible.
2. Players on an open community server: browsing and joining tables with strangers, tournaments and drafts, chat, and the moderation and rating features the server already has.

Players are expected to know Magic's rules. Many will already know MTG Arena and expect its interaction patterns.

## Product Purpose

A complete browser client for a fork of the XMage rules engine and server. Its reason to exist is the experience: the stock XMage desktop client is functional but dated, and this client should make playing on XMage feel as smooth and readable as MTG Arena, while keeping every XMage capability reachable.

Success: a player can open the client, log in, and be in a game against the AI or a friend in a few clicks, then play a full game without fighting the interface.

## Positioning

Arena-quality interaction on top of XMage's unrestricted card pool and formats: every printed card, any format (including Commander, Freeform, Pauper, cubes), self-hostable, free, with real people or the built-in AI. Arena can't offer the card pool or self-hosting; the XMage desktop client can't offer the experience.

## Operating Context

- Desktop browsers first (1280x720 and up); tablets later. The match screen is not designed for phones.
- Sessions last from a single 15-minute game to multi-hour drafts and tournaments.
- The server is the XMage fork in this repository, reached over the WebSocket bridge (`docs/WebSocketAPI.md`).
- Card images come from Scryfall.

## Capabilities and Constraints

- First priority: 1v1 constructed play (against the AI or people) with the player's own decks. Commander/multiplayer, draft/sealed and tournaments follow, and must remain reachable.
- Everything the desktop client can do must stay possible (table options, deck formats and import formats, sideboarding, spectating, replays, admin tools), even when presented differently.
- Rules and prompts come from the server; the client never decides legality.
- No Wizards of the Coast proprietary assets: no Beleren typeface, no Arena art, sounds or UI chrome. Card images from Scryfall are allowed for a free, non-commercial client.
- Product name: **Playmat** (chosen 2026-10-07). It replaces "XMage" in the web client UI.

## Brand Commitments

- The product is called Playmat. Use `APP_NAME` from `src/app/brand.ts`, never a hard-coded string.
- Interaction model: Arena-like. Visual identity: the product's own.

## Evidence on Hand

- Real card data and images (server card database, Scryfall).
- Sample decks shipped with the desktop client: `../Mage.Client/release/sample-decks`.
- No users, testimonials, ratings or press exist; do not invent any.

## Product Principles

1. The game is the product: the board, cards and decisions get the space and the polish; everything else stays out of the way.
2. One click from intent to play: playing a game must never require understanding XMage's table system first.
3. Nothing is lost: every XMage capability stays reachable, behind progressive disclosure if needed.
4. The server is the source of truth: the client shows what the server says and asks exactly what the server asks.
5. Readable under pressure: state, priority and choices must be clear at a glance, mid-combat, on a full board.

## Accessibility & Inclusion

- Keyboard play for every game action; visible focus.
- Respect reduced motion; animations never carry information alone.
- Color is never the only signal for card state (tapped, attacking, targetable).
