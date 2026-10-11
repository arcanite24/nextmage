<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/playmat-logo.svg">
    <img alt="Playmat" src="brand/playmat-logo-light.svg" width="440">
  </picture>
</p>

<p align="center">
  <b>Magic in your browser, on your own server.</b><br>
  An Arena-style client for the XMage rules engine: every card, any format, against your friends or the AI.
</p>

<p align="center">
  <a href="https://arcanite24.github.io/playmat/">Website</a> ·
  <a href="#host-your-own-table">Host a server</a> ·
  <a href="#run-it-locally">Run it locally</a> ·
  <a href="docs/WebSocketAPI.md">WebSocket API</a>
</p>

<p align="center">
  <a href="https://github.com/arcanite24/playmat/actions/workflows/web-client.yml"><img alt="Web client" src="https://github.com/arcanite24/playmat/actions/workflows/web-client.yml/badge.svg"></a>
  <a href="LICENSE.txt"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-f0b13d"></a>
  <img alt="Built on XMage" src="https://img.shields.io/badge/engine-XMage-3a5a51">
</p>

![A game against the AI in Playmat](site/assets/screens/match.webp)

## What it is

[XMage](https://github.com/magefree/mage) has the most complete open-source rules engine for Magic: over 32,000 cards,
every format, AI opponents, drafts and tournaments. Its desktop client still looks and plays like 2010.

Playmat is a fork of XMage. It adds a WebSocket bridge to the server and a new browser client built around how people
play today: Arena-style interaction with its own look, a printed neoprene mat with ivory ink and one amber button for
the decision in front of you. The engine stays XMage, merged from upstream every month, so every card it supports
works here.

## Features

- **One click to a game.** Pick a deck and play the AI, or send a friend an invite link. Practice mode gives you a
  goldfish opponent and tools to put any card in hand or on the battlefield.
- **A board you can read mid-combat.** Attack arrows, a visible stack, clear priority and smart auto-pass with stops
  you control, and keyboard shortcuts for passing and answering.
- **Bring your decks.** A deck builder with full card search, and an import sheet that takes a link from Archidekt,
  Moxfield and other deck sites, a pasted list or a `.dck` file. Starter decks are there from the first sign-in,
  Commander ones included.
- **Events.** Booster draft, sealed, Jumpstart and constructed tournaments. Empty seats fill with AI players.
- **Career.** A single-player journey: five colour campaigns with a boss at the end of each, an Academy with a school
  for every format, puzzles, a gauntlet, sealed and draft runs, a weekly challenge, booster packs to open, a collection
  to craft into and 61 achievements, all with painted art.
- **Social.** Lobby chat, players online, profiles, a table browser, spectating, match history and replays.
- **Everywhere you play.** Desktop browsers, tablets, an installable web app and an Android app that keeps card
  pictures on the device. English and Spanish.
- **Yours to host.** One Docker Compose stack: the server, Caddy with automatic HTTPS, a Scryfall picture cache,
  nightly backups and Discord notifications.

<table>
  <tr>
    <td><img alt="Home: pick a deck and play" src="site/assets/screens/home.webp"></td>
    <td><img alt="The deck builder" src="site/assets/screens/deck-builder.webp"></td>
  </tr>
  <tr>
    <td><img alt="Career hub" src="site/assets/screens/career.webp"></td>
    <td><img alt="Opening a booster pack" src="site/assets/screens/pack.webp"></td>
  </tr>
</table>

## Host your own table

You need Docker and a machine your players can reach.

```bash
cp ops/web/.env.example ops/web/.env      # set DOMAIN, XMAGE_ADMIN_PASSWORD, XMAGE_AUTH
docker compose -f ops/web/docker-compose.yml up -d --build
```

Players open `https://<your domain>` and sign in. The first build compiles the card database, which takes a while.
[ops/web/README.md](ops/web/README.md) covers private LAN servers, running behind another reverse proxy, every setting,
accounts and moderation, Discord notifications, backups and capacity.

## Run it locally

Requirements: JDK 17 or later, Maven, and the Node.js version in [`Mage.Web.Client/.nvmrc`](Mage.Web.Client/.nvmrc).

```bash
# 1. build the server (a few minutes the first time)
mvn -T 1C -pl '!Mage.Client,!Mage.Server.Console,!Mage.Tests,!Mage.Verify,!Mage.Reports' install -DskipTests

# 2. start it: the WebSocket bridge listens on ws://localhost:17172
cd Mage.Server/release
mvn -f ../../pom.xml -pl Mage.Server -Dexec.mainClass=mage.server.Main exec:java

# 3. in another terminal, start the client on http://localhost:5173
cd Mage.Web.Client
npm ci
npm run dev
```

Sign in with any name. The client's own guide, [Mage.Web.Client/README.md](Mage.Web.Client/README.md), covers its
architecture, tests and the Android build (`npm run android`).

## Repository map

| Path | What lives there |
|---|---|
| [`Mage.Web.Client`](Mage.Web.Client) | The Playmat client: React 19, TypeScript, Vite. Product brief in [PRODUCT.md](Mage.Web.Client/PRODUCT.md), design system in [DESIGN.md](Mage.Web.Client/DESIGN.md). |
| [`Mage.Server`](Mage.Server) | XMage's server, plus the JSON-RPC WebSocket bridge and Career services (`src/main/java/mage/server/websocket`, `.../career`). |
| [`ops/web`](ops/web) | The Docker Compose deployment kit. |
| [`docs`](docs) | The WebSocket API, data models and the upstream merge recipe. |
| [`brand`](brand) | The Playmat logo, generated from the app's typeface by `build_logo.py`. |
| [`site`](site) | The project website, published to GitHub Pages. |
| Everything else | XMage: the rules engine, card implementations, AI, tests and the original desktop client. |

## Credits

Playmat stands on XMage and the many people who have built it since 2010: the rules engine, tens of thousands of card
implementations and the AI are their work. Card and rules bugs usually live in the engine; XMage's
[issue tracker](https://github.com/magefree/mage/issues) and [wiki](https://github.com/magefree/mage/wiki) are the
places for those. Card pictures and data come from [Scryfall](https://scryfall.com).

Released under the [MIT License](LICENSE.txt), like XMage.

Playmat is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions
of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
