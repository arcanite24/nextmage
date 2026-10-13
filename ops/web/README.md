# Web deployment

Runs the XMage server and the web client together:

- **xmage**: the XMage server. Its WebSocket bridge listens on 17172 inside the network, and only the proxy can reach it.
- **web**: Caddy serves the built client with automatic HTTPS, forwards `/ws` to the server and `/img` to the image cache. It also sets the security headers and per-address rate limits.
- **imgcache**: nginx caching proxy for Scryfall card pictures and lookups (see [Card image cache](#card-image-cache)).
- **backup**: dumps the user databases every night into the `xmage-backups` volume.

Under HTTPS, the client connects to `wss://<your domain>/ws` by default, so players never type a server address.

## Run

```bash
cp ops/web/.env.example ops/web/.env      # set DOMAIN, XMAGE_ADMIN_PASSWORD, XMAGE_AUTH, mail
docker compose -f ops/web/docker-compose.yml up -d --build
```

Before you start:

- Point `DOMAIN` at the machine first; Caddy fetches the certificate on first start.
- The first server image build compiles the whole card database (expect tens of minutes). Later builds reuse the Maven cache.
- The first server start builds the card database before the game port opens, which takes a few minutes. The web container waits until the server is healthy, so the site comes up after that.

## Private server on a LAN

For a group on one home network, with no public domain:

```bash
DOMAIN=multivac.local            # the host's mDNS name
LAN_IP=192.168.1.156             # the host's address, for devices that can't resolve .local names
HTTPS_PORT=8443                  # when another proxy already owns 443
HTTP_PORT=8088
XMAGE_ALLOWED_ORIGINS=https://multivac.local:8443,https://192.168.1.156:8443
COMPOSE_PROJECT_NAME=xmage
```

Caddy can't get a public certificate for a `.local` name, so it signs one with its own local CA. Each player accepts the browser warning once, or installs Caddy's root certificate (`docker compose cp web:/data/caddy/pki/authorities/local/root.crt .`). Players then open `https://multivac.local:8443`, or `https://192.168.1.156:8443` on devices that don't resolve `.local` names (Android, some Windows setups); typing `http://` or leaving the scheme out redirects to HTTPS. Reserve the address for the host in the router's DHCP settings so it doesn't change. Nothing is reachable from the internet unless the router forwards the port.

## Behind another reverse proxy

When the host already runs a public reverse proxy that holds certificates (Multivac's main Caddy serves `playmat.multivac.club`), let it terminate TLS and forward the name to this stack's HTTP port:

```bash
PROXIED_HOST=playmat.multivac.club
UPSTREAM_PROXIES=172.17.0.1/32     # where that proxy's requests come from (Docker Desktop's bridge gateway)
XMAGE_ALLOWED_ORIGINS=https://multivac.local:8443,https://192.168.1.156:8443,https://playmat.multivac.club
XMAGE_PUBLIC_URL=https://playmat.multivac.club
```

```caddyfile
playmat.multivac.club {
	reverse_proxy host.docker.internal:8088
}
```

The front proxy replaces `X-Forwarded-For` with the visitor's address, and this stack believes it only from `UPSTREAM_PROXIES`, so rate limits and the server's per-address caps see each player. Only forward ports 80 and 443 to the front proxy: `HTTP_PORT` must not be reachable from the internet. A publicly trusted certificate also makes the app installable on Android, which refuses to install from the local CA.

## Settings

Set these in `ops/web/.env` (Compose reads it automatically) or in the environment. An empty value uses the default. The server renders `config/config.xml` from the shipped config and these variables on every start, so removing a variable restores its default. You never edit `config.xml` and you don't need to rebuild to change settings: `docker compose -f ops/web/docker-compose.yml up -d` applies them.

| Variable | Default | Meaning |
|---|---|---|
| `DOMAIN` | required | Public host name. It becomes the only allowed browser origin. |
| `PROXIED_HOST`, `UPSTREAM_PROXIES` | none (a name that matches nothing), `127.0.0.1/32` | A public name served over plain HTTP on `HTTP_PORT` for a reverse proxy in front that holds its certificate, and the range that proxy connects from, whose `X-Forwarded-For` names the client. See [Behind another reverse proxy](#behind-another-reverse-proxy). |
| `LAN_IP` | empty | The host's LAN address, served too (Caddy signs a certificate for it) for devices that can't resolve `DOMAIN`. Add `https://<LAN_IP>:<HTTPS_PORT>` to `XMAGE_ALLOWED_ORIGINS`. |
| `XMAGE_ADMIN_PASSWORD` | unset | Admin password (`-Dxmage.adminPassword`). Unset: admin login is disabled. |
| `XMAGE_AUTH` | `false` | `authenticationActivated`. `true` makes players register and log in with a password. Use it on a public server. |
| `APP_NAME` | `Playmat` | Product name shown in the web client and its page title. A build argument: rebuild the `web` image (`up -d --build web`) after changing it. |
| `XMAGE_SAVE_GAMES` | `false` | `saveGameActivated`. Upstream marks game saving as unreliable. |
| `XMAGE_REPLAYS` | `true` | Record finished games with at least one human player for the web client's replays (`-Dxmage.replays`). |
| `XMAGE_REPLAY_DAYS` | `30` | Replays older than this many days are deleted. |
| `XMAGE_REPLAY_MAX` | `300` | At most this many replays are kept; the oldest go first. A replay is gzipped, about 10 kB per turn (a six-turn duel was 59 kB), so 300 replays usually take tens of megabytes. |
| `XMAGE_MEMORY` | sized to the machine | Java heap, e.g. `2g`. Empty: `XMAGE_HEAP_PERCENT` of the memory the container sees (its limit, else the host's), between 256 MB and 1 GB. The server logs the size it chose at start. |
| `XMAGE_HEAP_PERCENT` | `40` | Share of the machine's memory the heap gets when `XMAGE_MEMORY` is empty. The rest is the JVM's own memory (classes, threads, code; about 400 MB) and the system's. |
| `XMAGE_GC` | `auto` | Garbage collector: `serial` on one or two CPUs (less CPU per game there), else `g1`, which hands unused memory back while the server idles. Or `serial`, `g1`, `parallel`. |
| `XMAGE_METASPACE` | `512m` | Cap on the JVM's class memory (`-XX:MaxMetaspaceSize`). The card classes take about 260 MB. |
| `XMAGE_CDS` | `true` | `false` stops using the class archive recorded when the image was built (it makes starts faster and shares class memory). |
| `XMAGE_COMPACT_HEADERS` | `true` | Only for an image built on JDK 25 (`--build-arg JAVA_RUNTIME=25`): 8-byte object headers instead of 12 (JEP 519). `false` turns them off (the class archive then goes unused). The default image runs on JDK 17, which used less memory on a 1 GB box. |
| `XMAGE_MAX_GAME_THREADS` | `4` | `maxGameThreads`: games that run at the same time. |
| `XMAGE_MAX_AI_OPPONENTS` | `4` | `maxAiOpponents`: AI players in use at once (draft bots don't count). |
| `XMAGE_MAX_SECONDS_IDLE` | `600` (shipped) | `maxSecondsIdle`: an idle player concedes after this many seconds. |
| `XMAGE_MAX_POOL_SIZE` | `300` (shipped) | `maxPoolSize`: desktop-protocol worker threads. |
| `XMAGE_SERVER_NAME` | `mage-server` | `serverName`, shown to desktop clients. |
| `XMAGE_SERVER_ADDRESS` | `0.0.0.0` | `serverAddress`. Only matters for desktop clients. |
| `XMAGE_PORT` | `17171` | `port`: the desktop client port. It isn't published by default. |
| `XMAGE_MONTE_CARLO` | `true` | `false` takes the Monte Carlo AI off the server (and out of the web client's AI choices). It keeps every core busy for its whole think time. |
| `XMAGE_AI_THREADS` | `5`, or the CPUs when fewer | AI searches running at once for all AI players (`-Dxmage.ai.threads`). A search waiting for a thread doesn't lose think time. |
| `XMAGE_AI_NODE_SCALE` | `1` | Scales every AI skill's search budget (`-Dxmage.ai.nodeScale`), e.g. `0.5` on a slow server: faster turns, slightly weaker play. |
| `XMAGE_DB_CACHE` | an eighth of the heap, 16–150 MB | Card database cache in MB (`-Dxmage.db.cacheSizeKB`). It lives in the heap. |
| `XMAGE_DESKTOP` | `true` | `false` leaves the desktop protocol off (`-Dxmage.remoting=false`): web clients only, with fewer threads and less memory. |
| `XMAGE_SECONDARY_PORT` | `-1` (shipped) | `secondaryBindPort` for the desktop protocol. |
| `XMAGE_TRUSTED_PROXIES` | `CADDY_IP` | IPs and CIDR ranges, comma separated, whose `X-Forwarded-For` / `X-Real-IP` the bridge believes (`-Dxmage.web.trustedProxies`). The default is Caddy's fixed address on the Compose network, so no other container can claim a client address. Without it, every player appears to come from Caddy's address, and per-address login limits would hit everyone at once. |
| `XMAGE_SUBNET` | `10.89.17.0/24` | Subnet of the stack's Compose network. Change it if it overlaps another Docker network on the host (`docker network inspect`). |
| `CADDY_IP` | `10.89.17.10` | Caddy's fixed address inside `XMAGE_SUBNET`. |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` | Host ports Caddy publishes. Change them when another web server already owns 80/443. |
| `XMAGE_ALLOWED_ORIGINS` | `https://$DOMAIN` | Browser origins the bridge accepts. Include the port when `HTTPS_PORT` isn't 443. |
| `XMAGE_ALLOWED_ORIGINS` | `https://$DOMAIN` | Set by Compose. Browser origins allowed to open a game connection. |
| `XMAGE_MAILGUN_API_KEY`, `XMAGE_MAILGUN_DOMAIN` | empty | Mailgun account for registration and password-reset mail. |
| `XMAGE_MAIL_SMTP_HOST`, `XMAGE_MAIL_SMTP_PORT`, `XMAGE_MAIL_USER`, `XMAGE_MAIL_PASSWORD`, `XMAGE_MAIL_FROM` | empty | SMTP instead of Mailgun. The server uses SMTP when `XMAGE_MAIL_USER` is set. |
| `XMAGE_DISCORD_WEBHOOK` | empty | Discord webhook address (`-Dxmage.discordWebhook`). Set: public tables, events starting and matches starting are posted to that channel (see [Discord notifications](#discord-notifications)). A secret: anyone with it can post to the channel. |
| `XMAGE_DISCORD_STAFF_WEBHOOK` | empty | A second webhook for staff news: access requests, player reports and staff role changes (`-Dxmage.discordStaffWebhook`). Empty: those go to `XMAGE_DISCORD_WEBHOOK`. A secret. |
| `XMAGE_CAREER` | `on` | `off` turns the optional single-player Career off. It needs accounts either way: without them nobody's collection would be safe. Progress is kept in `career.db`. |
| `XMAGE_ACCESS` | `open` | Who may play (`-Dxmage.access`): `open`, or `allowlist` for a contributors server. Read on the first boot only, then switched in `/admin`. `allowlist` needs `XMAGE_AUTH=true`. See [Contributors server](#contributors-server). |
| `XMAGE_OWNER` | empty | The owner's account name (`-Dxmage.owner`), always let in. |
| `XMAGE_ALLOWLIST` | empty | The first boot's allowlist (`-Dxmage.allowlist`): account names and emails, comma separated, or `@/path` to a file in the container with one per line (`#` starts a comment). |
| `XMAGE_GITHUB_CLIENT_ID`, `XMAGE_GITHUB_CLIENT_SECRET` | empty | An OAuth app for Sign in with GitHub (`-Dxmage.github.*`). Its callback URL is `XMAGE_PUBLIC_URL/auth/github`. Both set: the sign-in screen offers GitHub. The secret is a secret. |
| `XMAGE_GITHUB_REPO`, `XMAGE_GITHUB_TOKEN` | empty | `owner/name` of a repository whose people get in to a contributors server by signing in with GitHub, fetched every 6 hours: its collaborators when the token can read them, its public contributors without a token. |
| `XMAGE_PUBLIC_URL` | `https://$DOMAIN` | The web client's public address (`-Dxmage.publicUrl`), for join links in Discord posts. Include the port when `HTTPS_PORT` isn't 443. Empty: posts without links. |
| `XMAGE_JAVA_OPTS` | empty | Extra JVM flags. |
| `BACKUP_AT` | `03:30` | Time of the daily backup, as `HH:MM` in `TZ`. |
| `BACKUP_KEEP` | `14` | Number of backups to keep. |
| `TZ` | `UTC` | Time zone for `BACKUP_AT`. |
| `WS_RATE_LIMIT` / `WS_RATE_WINDOW` | `30` / `1m` | New game connections (`/ws` requests) Caddy lets one client address open per window. Over it: `429` with `Retry-After`. |
| `IMG_API_RATE_LIMIT` / `IMG_API_RATE_WINDOW` | `300` / `1m` | Scryfall lookups (`/img/api/*`) per client address per window. Pictures (`/img/cards/*`, `/img/backs/*`) are not limited. |
| `IMGCACHE_IMAGES_MAX_SIZE` | `20g` | Disk cap of the picture cache. The least recently used files go first. |
| `IMGCACHE_API_MAX_SIZE` | `1g` | Disk cap of the lookup cache. |
| `IMGCACHE_API_RATE` / `IMGCACHE_API_BURST` | `10r/s` / `20` | Requests per second the image cache sends to `api.scryfall.com` for the whole site (cache misses only), and how many more may queue before it answers `429`. |

Secrets can also come from files: `XMAGE_ADMIN_PASSWORD_FILE`, `XMAGE_MAIL_PASSWORD_FILE`, `XMAGE_MAILGUN_API_KEY_FILE`, `XMAGE_DISCORD_WEBHOOK_FILE`, `XMAGE_DISCORD_STAFF_WEBHOOK_FILE`, `XMAGE_GITHUB_CLIENT_SECRET_FILE` and `XMAGE_GITHUB_TOKEN_FILE` take precedence over the plain variables. To use them, mount the file and add the variable to the `xmage` service. The JVM gets its flags through a private argument file, so the admin password and the webhook address don't show up in `ps`.

Invalid values (for example `XMAGE_AUTH=yes`) stop the server at start with a message that names the variable.

**Why these defaults.** They target a small box, 2 vCPU and 2–4 GB RAM. Every running game and every AI opponent takes CPU, and AI turns can spike it, so 4 games and 4 AI players at once keep the server responsive. The heap follows the machine's memory on its own. Raise the game and AI limits on bigger hardware.

### Small VPS (1 vCPU, 1 GB)

The server runs a group's evening on a 1 vCPU / 1 GB VPS. Start from the preset, which lowers the limits to what one CPU keeps responsive and shrinks the picture cache to fit a small disk:

```bash
cat ops/web/small-vps.env >> ops/web/.env
```

- The image ships its card database and a class archive, so the first start takes seconds and no memory goes to building the database.
- The heap comes out at about 400 MB and the GC at Serial; the server uses about 700 MB in all.
- Add 1 GB of swap as a cushion (`fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`, plus a line in `/etc/fstab`). The server shouldn't need it, but a Docker build on the same box does.
- Build the images on another machine and push them, or build with nothing else running. A build needs more than 1 GB.
- When every game slot is busy, a new game waits for one, and its players are told so in the game chat. The web client's home screen says when the server is full.

### Building on another machine (ARM boxes)

The card build takes minutes and gigabytes even on a fast machine, so a small box is better off receiving built images. Both Dockerfiles build for another architecture with their heavy stages native (`--platform=$BUILDPLATFORM`): the jars, the card database and the web client are the same everywhere, and Go cross-compiles Caddy. An Apple Silicon Mac builds ARM images (an Oracle Cloud Ampere box) natively; an x86 machine with `docker buildx` emulates only the runtime stage.

From a clean clone (the build context is the whole tree, so a working copy with build output sends gigabytes):

```bash
git clone --depth 1 https://github.com/arcanite24/playmat build-src && cd build-src
podman build --platform linux/arm64 -f ops/web/Dockerfile.server -t xmage-web-server:local .
podman build --platform linux/arm64 -f ops/web/Dockerfile.web -t xmage-web:local .
ops/web/ship-images.sh <ssh-host> podman
```

`ship-images.sh` loads both images on the host over SSH and restarts it with `up -d --no-build`. The host keeps a checkout of the repository with its `.env` in `~/xmage-server`.

## Accounts and moderation

With `XMAGE_AUTH=true`, players register in the web client with a name, an email address and a password they choose. A forgotten password is reset with a six-digit code sent by mail: it works for 30 minutes and 5 tries. Configure Mailgun or SMTP (above), or players can't reset passwords. The web client asks the server (`serverInfo`) whether accounts and mail are on and shows only the forms that work.

Signed-in players' decks sync to their account (`web_decks.db`), so they follow the player to another browser. Without accounts, decks stay in each browser.

The admin console is at `https://DOMAIN/admin`. Sign in with `XMAGE_ADMIN_PASSWORD`. It shows players online, tables and games, CPU, memory and the size of messages sent to web clients, and lets you mute, lock out, deactivate or disconnect a player, remove a table and send a message to everyone. Players report each other from the lobby's player menu or a profile. Reports wait in the console's Reports tab until an admin closes them. Every admin action is recorded in the Audit tab (`db/web_admin.db`). Web client crashes appear under Client errors and in the server log (logger `mage.web.clientErrors`).

## Contributors server

A contributors server lets in only the people on its allowlist: for builds from `master` that aren't ready for everyone. Start one closed, so it is never open by accident:

```sh
XMAGE_AUTH=true
XMAGE_ACCESS=allowlist
XMAGE_OWNER=yourname
XMAGE_ALLOWLIST=alice,bob@example.com
```

The mode and the starting list are read on the very first boot only (they live in `db/web_admin.db` after that), so editing `.env` later changes nothing: use the console's Access tab. There you can:

- switch between open and allowlist. Switching to allowlist lists who would be signed out first, and asks for a reason.
- add people by account name or by email (any account registered with that address), with a note such as a GitHub handle. Taking someone off signs them out.
- make invite links (`https://DOMAIN/join?invite=...`) with a number of uses and an expiry. An invite registers the account and puts it on the list. Invites can be revoked.
- approve or decline requests. Without an invite, people ask from the sign-in screen with a name, an email and a note, three times an hour per address at most. Each request is posted to the staff Discord channel (`XMAGE_DISCORD_STAFF_WEBHOOK`, or `XMAGE_DISCORD_WEBHOOK` without one). Approving allowlists the email address and, when mail is set up, tells the person.
- set a notice shown on sign-in and Home, such as "builds from master, data may be reset".

With Sign in with GitHub set up (`XMAGE_GITHUB_CLIENT_ID` and `XMAGE_GITHUB_CLIENT_SECRET`, an OAuth app made at github.com/settings/developers with the callback URL `https://DOMAIN/auth/github`), players can sign in with their GitHub account instead of a password. The first time, the server makes them an account named after their GitHub login (or one they pick when that name is taken), with their verified GitHub email; an existing account with that email is used instead. With `XMAGE_GITHUB_REPO` set too, the repository's people are let in without being listed. The Access tab shows when that list was last fetched.

The owner and the admin console are always let in. The check runs at registration, sign-in, on a remembered device and on a restored session. Every change is in the console's Audit tab.

To run a contributors server next to an open one on the same host, give it its own Compose project and ports, for example `docker compose -p playmat-dev -f ops/web/docker-compose.yml --env-file ops/web/.env.dev up -d` with a different `DOMAIN`, `HTTP_PORT`/`HTTPS_PORT`, `XMAGE_SUBNET` and `CADDY_IP`. The volumes are named after the project, so the two servers don't share accounts or data.

## Staff

Staff sign in with their own player accounts and find **Admin** in the account menu. Each account has a role, and each role can do what the ones below it can:

| Role | Can |
|---|---|
| moderator | see who is online, mute and sign players out, watch any running game, work through reports and client errors, read the audit log and server stats |
| admin | also lock and deactivate accounts, remove tables, broadcast, run Access (mode, allowlist, invites, requests, notice) and change Settings |
| owner | also give and take staff roles, and plan maintenance |

`XMAGE_OWNER` is always an owner and can't be changed from the console; give roles from the console's Staff tab. Roles need accounts (`XMAGE_AUTH=true`). A role is checked on every action, so taking it away works at once. Staff are always let in on a contributors server.

The shared admin password (`XMAGE_ADMIN_PASSWORD`) still opens the console as an owner, for when no owner can sign in: use **Console sign-in** at the bottom of `/admin`. It is a break-glass key; once staff have roles, it can be left unset. Admin sign-in is refused when no password is set, and the password file the entrypoint writes for the JVM is deleted 20 seconds after start.

Every staff action that changes something is in the Audit tab, with the staff member's name and the reason they gave.

The Accounts tab lists every registered account (search by name or email). An account's page shows its sessions, stats, reports by and about it, the feedback it sent and what staff did to it; moderators see neither email nor IP addresses. From there admins can mute, lock and deactivate offline accounts, make a **reset code** (a one-time code the player enters under Forgot password; emailed too when mail works, otherwise shown once for you to pass on, valid 24 hours), **export** everything the server keeps about the account as JSON, and **delete** it with its decks, Career, reports, stats and feedback. The audit log keeps the record of the deletion.

Players send feedback from the account menu (five an hour each); it lands in the Feedback tab to mark seen or done, with a note.

Password sign-ins are throttled per address and per account name: after five failures each further try waits longer, doubling up to five minutes. Remembered devices don't count.

**Watch** in the Tables tab opens any running game for staff on their own player session, whatever its spectator settings and the players' ignore lists; the game chat says who started watching, and the audit log records it.

**Client errors** groups crash reports from web clients by kind (message, source and top stack frame), with how often and how recently each happened. Mark one resolved when it is fixed; it opens again by itself if it comes back. Each address sends at most 20 reports a minute, and visitors who aren't signed in share 60 a minute between them.

### Settings

The Settings tab (admins) changes these at once, without a restart; they are kept in `web_admin.db` and survive restarts. Back to config returns one to what the environment and `config.xml` say.

| Setting | Values |
|---|---|
| New accounts | anyone can register, or invite only: an invite link, a place on the allowlist, or an approved access request |
| Career | on or off; `XMAGE_CAREER=off` turns it off for good |
| AI opponents per table | 0 to 15, or empty for the config's `maxAiOpponents` |
| Time to answer | 30 to 3600 seconds, or the config's `maxSecondsIdle` |
| Discord posts | tables, events, matches and staff news, each on or off |

The Discord part also says whether each webhook is set (the address stays on the server) and posts a test message on request.

### Maintenance

Owners announce maintenance from Settings: now or in up to a day, with an optional message. From the announcement on, no new tables can start, everyone online is warned (again 30, 10, 5 and 1 minutes before), the sign-in screen and the app's top bar show it, and the staff channel hears about it. With **restart** checked, the server exits once the time has come and no game is running; `restart: unless-stopped` brings it back, on a new image if one was built (`docker compose build xmage` first). The plan is kept in memory, so a restart ends it. Calling it off opens tables again.

## Discord notifications

With `XMAGE_DISCORD_WEBHOOK` set (Discord: channel settings, Integrations, Webhooks, New Webhook, Copy Webhook URL), the server posts to that channel when:

- a table opens in the lobby, with its name, game, format, host, seats and a join link (`https://DOMAIN/join/<table>`; events link to the Events screen),
- an event (tournament) starts,
- a standalone match starts: the players are seated and the first game is dealt. An event's own matches are not posted.

Only tables with at least two human seats are posted: AI-only tables and one player against the AI are practice, not news. Password-protected tables are never posted. Posts never mention anyone (`allowed_mentions` is empty), and player-chosen names are shown as typed, without Discord formatting.

Posting never holds up a game: posts wait in a small queue (20) for one background thread, with a 5-second timeout each. At most 30 go out per minute, Discord's limit for one webhook; anything over the limit or the queue is dropped with a warning in the server log (logger `mage.server.notify.DiscordNotifier`). The log never contains the webhook address.

## Health

- `xmage` answers `GET /healthz` on `127.0.0.1:17173` inside its container (`-Dxmage.healthPort`, 0 turns it off): its version and commit, uptime, players online, games running, planned maintenance and any backup problem, as JSON. It is healthy once that answers, which is after the card database is loaded; the first start gets 15 minutes for that. `docker compose exec xmage bash -c 'exec 3<>/dev/tcp/127.0.0.1/17173; printf "GET /healthz HTTP/1.0\r\n\r\n" >&3; cat <&3'` shows it.
- The admin Overview shows the same version, the commit (the image build reads it from the checkout's `.git`), and the last backup.
- `web` checks Caddy's admin API on `localhost:2019`. It starts only after `xmage` and `imgcache` are healthy.
- `imgcache` answers `/healthz` on port 8080 inside the network.
- `docker compose -f ops/web/docker-compose.yml ps` shows both states.
- If `up` stops with "dependency failed to start: container ... is unhealthy" after a failed earlier start, the server usually becomes healthy a little later: run `up -d` again once `ps` shows `xmage` healthy.

## Capacity

Measured on 2026-10-09 on the LAN server (16 cores, Docker on Windows), using the web client's bot load test (`Mage.Web.Client/src/core/headless/loadTest.live.test.ts`).
- Each table was a scripted web client playing the server's AI at skill 2. The client answers as soon as it's asked, so games run faster than with people.
- 14 games running at once used about 11% of the CPU on average, with a peak of 19%.
- On that hardware, CPU is not the limit for a casual server. Games against the AI cost the most, because the AI thinks on the server's cores, and Hard or Expert AIs think longer.

To repeat the test against your own server:

```
cd Mage.Web.Client
MAGE_LOAD_TEST=1 MAGE_SERVER_URL=wss://your.host/ws MAGE_ADMIN_PASSWORD=... MAGE_LOAD_GAMES=14 MAGE_LOAD_WAVES=1 npx vitest run src/core/headless/loadTest --silent=false
```

Caddy allows one address 30 new `/ws` connections a minute (`WS_RATE_LIMIT`). A load test from a single machine therefore needs waves smaller than that, or a raised limit while it runs. Each scripted game opens one connection.

## Logs

- `docker compose -f ops/web/docker-compose.yml logs -f xmage` shows the server's console output.
- `mageserver.log` is also written to the `xmage-logs` volume (`/opt/xmage/logs`). It rotates at 20 MB and keeps 10 old files. To read it, run `docker compose -f ops/web/docker-compose.yml exec xmage tail -f /opt/xmage/logs/mageserver.log`.

## Data and volumes

| Volume | Mounted at | Holds | Back up? |
|---|---|---|---|
| `xmage-db` | `/opt/xmage/db` | `authorized_user.h2` (accounts), `feedback.h2`, `user_stats.db` (player stats), `table_record.db` (finished tables), `web_decks.db` (decks synced to accounts), `web_reports.db` (player reports), `career.db` (Career collections and progress) | yes, nightly |
| `xmage-cards` | `/opt/xmage/cards-db` | `cards.h2`, the card database | no: a cache built from the image |
| `xmage-saved` | `/opt/xmage/saved` | saved games (`XMAGE_SAVE_GAMES`) and web client replays (`saved/replays`) | optional |
| `xmage-logs` | `/opt/xmage/logs` | `mageserver.log*` | no |
| `xmage-backups` | `/backups` (backup service) | nightly dumps | copy off the machine |
| `xmage-imgcache` | `/var/cache/nginx/scryfall` (imgcache) | cached Scryfall pictures and lookups | no: a cache |
| `caddy-data`, `caddy-config` | Caddy | certificates | optional |

XMage opens every database under `./db`. Only user data stays on `xmage-db`. The entrypoint replaces `db/cards.h2.*` with symlinks into `xmage-cards`. It wipes that volume whenever the image build changes, so a card database from an older image can't shadow the new card pool. An existing `xmage-db` volume from the earlier single-volume layout migrates on its own: the old card database files in it are deleted on first start.

## Backups and restore

The `backup` service runs daily at `BACKUP_AT` and writes `/backups/<UTC timestamp>/` into the `xmage-backups` volume:

- `authorized_user.h2.sql.gz` and `feedback.h2.sql.gz`: H2 SQL dumps. They're taken online by joining the running server's database through H2's auto-server mode, so each dump is consistent.
- `user_stats.db`, `table_record.db`, `web_decks.db`, `web_reports.db`, `career.db` and `web_admin.db`: SQLite copies made with SQLite's online backup API.

Every run writes `db/backup-status.json` (when, whether it worked, its size and the last good one). The admin Overview shows it, and once an hour the server checks it: a failed run, or no good backup for 36 hours, is posted to the staff channel (once a day at most).

The newest `BACKUP_KEEP` backups are kept. The card database is not backed up because the image rebuilds it.

```bash
C="docker compose -f ops/web/docker-compose.yml"
$C exec backup xmage-backup once          # take a backup now
$C exec backup xmage-backup list          # list backups
# copy one off the box
$C cp backup:/backups/20261007T033000Z ./xmage-backup-20261007
```

Restore (the server must be stopped; the script refuses otherwise):

```bash
$C stop xmage web
$C run --rm --no-deps backup restore 20261007T033000Z
$C up -d
```

The restore replaces the accounts and feedback databases (rebuilt from the dumps) and the SQLite files. Databases missing from the backup are left alone. To restore from a copy kept off the machine, first copy the directory back into the volume: `$C cp ./xmage-backup-20261007 backup:/backups/20261007T033000Z`.

## Upgrade

```bash
git pull
docker compose -f ops/web/docker-compose.yml up -d --build
```

- Volumes are kept. The first start after an upgrade rebuilds the card database (a few minutes); the site comes up when the server reports healthy.
- Take a backup first (`xmage-backup once`) when the release notes mention database changes.
- Settings live in `.env`, so an upgrade never overwrites them.

## Card image cache

The client shows card pictures from Scryfall. The `imgcache` service (nginx, `imgcache.conf.template`) keeps a copy, so
each picture and lookup leaves the box once instead of once per player:

| Path | Upstream | Cached for |
|---|---|---|
| `/img/cards/...` | `https://cards.scryfall.io/...` (pictures) | 30 days (404s: 1 day) |
| `/img/backs/...` | `https://backs.scryfall.io/...` (the classic card back setting) | 30 days (404s: 1 day) |
| `/img/api/...` (GET) | `https://api.scryfall.com/...` (per-card image links, which redirect to `/img/cards/...`) | 24 hours (404s: 1 hour) |
| `/img/api/cards/collection` (POST) | batch lookups of up to 75 printings, keyed on the request body | 24 hours |

- The web image is built with `VITE_IMAGE_PROXY=/img`, so the client uses these paths. Build with
  `--build-arg VITE_IMAGE_PROXY=` to send players straight to Scryfall instead. A client built without the setting
  (e.g. `npm run dev`) talks to Scryfall directly; links it has cached in the browser keep working either way.
- Requests to Scryfall carry the `User-Agent` and `Accept` headers Scryfall asks for. Cookies and client addresses
  are not passed on. Lookups that miss the cache are held to `IMGCACHE_API_RATE` for the whole site.
- When Scryfall is down or rate limits, expired copies are served (`proxy_cache_use_stale`).
- Responses carry `X-Cache-Status` (`HIT`, `MISS`, `STALE`...) for checking.
- Sizes: a `normal` picture is roughly 100 kB, so the 20 GB default holds around 200,000 pictures; lookups are small.
  Change `IMGCACHE_IMAGES_MAX_SIZE` / `IMGCACHE_API_MAX_SIZE` and `up -d`. nginx evicts the least recently used files.
- Clear it (players' browsers keep their own copies):

```bash
C="docker compose -f ops/web/docker-compose.yml"
$C exec imgcache sh -c 'rm -rf /var/cache/nginx/scryfall/images/* /var/cache/nginx/scryfall/api/*'
$C restart imgcache
# or drop the volume: $C stop imgcache web && $C rm -f imgcache && docker volume rm <project>_xmage-imgcache && $C up -d
```

## Without Docker on a LAN

For the Compose stack on a LAN, see [Private server on a LAN](#private-server-on-a-lan). Without Docker you don't need the proxy at all. Build the client with `npm run build`, serve `Mage.Web.Client/dist` from any static server, and run the server as usual. Over plain HTTP the client connects to `ws://<page host>:17172`.

Add the page origin to `websocketAllowedOrigins` in `config.xml` on the `<server>` element, for example `http://192.168.1.20:8080`.

## Security notes

- Leave port 17172 unpublished. The bridge expects the proxy in front of it, for TLS, the origin check and the client address.
- Only publish 17171 (the desktop client's port) if desktop players should join the same server.
- Set `XMAGE_AUTH=true` on a public server, so names need passwords. Configure mail too, so players can reset their passwords.
- Caddy sends a `Content-Security-Policy`: scripts only from the site itself, styles from the site plus inline
  styles (React), pictures from the site, `data:`/`blob:` and Scryfall (a client built without the image proxy loads
  them from Scryfall directly), connections to the site, any `wss:` server and `api.scryfall.com`, and no framing
  (`frame-ancestors 'none'`). Adding a third-party script or host to the client means adding it there too.
- Rate limits per client address exist twice. Caddy limits how fast an address opens game connections
  (`WS_RATE_LIMIT` per `WS_RATE_WINDOW`) and Scryfall lookups (`IMG_API_RATE_LIMIT`), answering `429` with
  `Retry-After`. The server separately caps concurrent game connections per address
  (`-Dxmage.web.maxConnectionsPerIp`, 16 by default; set it through `XMAGE_JAVA_OPTS`). Players behind one NAT
  share both limits.
- The Caddy binary is built with [caddy-ratelimit](https://github.com/mholt/caddy-ratelimit), pinned to a commit in
  `Dockerfile.web`. Check `caddy validate` after bumping `CADDY_VERSION` or the module.
- Caddy sets `X-Forwarded-For` to the real client address and drops any value the client sent, because Caddy itself trusts no upstream proxies. It also adds `X-Real-IP`. The server only trusts those headers from `XMAGE_TRUSTED_PROXIES`. It defaults to `CADDY_IP`, so changing `XMAGE_SUBNET` and `CADDY_IP` together is enough.
