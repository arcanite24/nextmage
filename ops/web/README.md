# Web deployment

Runs the XMage server and the web client together:

- **xmage**: the XMage server. Its WebSocket bridge listens on 17172 inside the network, and only the proxy can reach it.
- **web**: Caddy serves the built client with automatic HTTPS and forwards `/ws` to the server.
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
HTTPS_PORT=8443                  # when another proxy already owns 443
HTTP_PORT=8088
XMAGE_ALLOWED_ORIGINS=https://multivac.local:8443
COMPOSE_PROJECT_NAME=xmage
```

Caddy can't get a public certificate for a `.local` name, so it signs one with its own local CA. Each player accepts the browser warning once, or installs Caddy's root certificate (`docker compose cp web:/data/caddy/pki/authorities/local/root.crt .`). Players then open `https://multivac.local:8443`. Nothing is reachable from the internet unless the router forwards the port.

## Settings

Set these in `ops/web/.env` (Compose reads it automatically) or in the environment. An empty value uses the default. The server renders `config/config.xml` from the shipped config and these variables on every start, so removing a variable restores its default. You never edit `config.xml` and you don't need to rebuild to change settings: `docker compose -f ops/web/docker-compose.yml up -d` applies them.

| Variable | Default | Meaning |
|---|---|---|
| `DOMAIN` | required | Public host name. It becomes the only allowed browser origin. |
| `XMAGE_ADMIN_PASSWORD` | unset | Admin password (`-Dxmage.adminPassword`). Unset: admin login is disabled. |
| `XMAGE_AUTH` | `false` | `authenticationActivated`. `true` makes players register and log in with a password. Use it on a public server. |
| `XMAGE_SAVE_GAMES` | `false` | `saveGameActivated`. Upstream marks game saving as unreliable. |
| `XMAGE_REPLAYS` | `true` | Record finished games with at least one human player for the web client's replays (`-Dxmage.replays`). |
| `XMAGE_REPLAY_DAYS` | `30` | Replays older than this many days are deleted. |
| `XMAGE_REPLAY_MAX` | `300` | At most this many replays are kept; the oldest go first. A replay is gzipped, about 10 kB per turn (a six-turn duel was 59 kB), so 300 replays usually take tens of megabytes. |
| `XMAGE_MEMORY` | `2g` | Java heap. |
| `XMAGE_MAX_GAME_THREADS` | `4` | `maxGameThreads`: games that run at the same time. |
| `XMAGE_MAX_AI_OPPONENTS` | `4` | `maxAiOpponents`: AI players in use at once (draft bots don't count). |
| `XMAGE_MAX_SECONDS_IDLE` | `600` (shipped) | `maxSecondsIdle`: an idle player concedes after this many seconds. |
| `XMAGE_MAX_POOL_SIZE` | `300` (shipped) | `maxPoolSize`: desktop-protocol worker threads. |
| `XMAGE_SERVER_NAME` | `mage-server` | `serverName`, shown to desktop clients. |
| `XMAGE_SERVER_ADDRESS` | `0.0.0.0` | `serverAddress`. Only matters for desktop clients. |
| `XMAGE_PORT` | `17171` | `port`: the desktop client port. It isn't published by default. |
| `XMAGE_SECONDARY_PORT` | `-1` (shipped) | `secondaryBindPort` for the desktop protocol. |
| `XMAGE_TRUSTED_PROXIES` | `CADDY_IP` | IPs and CIDR ranges, comma separated, whose `X-Forwarded-For` / `X-Real-IP` the bridge believes (`-Dxmage.web.trustedProxies`). The default is Caddy's fixed address on the Compose network, so no other container can claim a client address. Without it, every player appears to come from Caddy's address, and per-address login limits would hit everyone at once. |
| `XMAGE_SUBNET` | `10.89.17.0/24` | Subnet of the stack's Compose network. Change it if it overlaps another Docker network on the host (`docker network inspect`). |
| `CADDY_IP` | `10.89.17.10` | Caddy's fixed address inside `XMAGE_SUBNET`. |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` | Host ports Caddy publishes. Change them when another web server already owns 80/443. |
| `XMAGE_ALLOWED_ORIGINS` | `https://$DOMAIN` | Browser origins the bridge accepts. Include the port when `HTTPS_PORT` isn't 443. |
| `XMAGE_ALLOWED_ORIGINS` | `https://$DOMAIN` | Set by Compose. Browser origins allowed to open a game connection. |
| `XMAGE_MAILGUN_API_KEY`, `XMAGE_MAILGUN_DOMAIN` | empty | Mailgun account for registration and password-reset mail. |
| `XMAGE_MAIL_SMTP_HOST`, `XMAGE_MAIL_SMTP_PORT`, `XMAGE_MAIL_USER`, `XMAGE_MAIL_PASSWORD`, `XMAGE_MAIL_FROM` | empty | SMTP instead of Mailgun. The server uses SMTP when `XMAGE_MAIL_USER` is set. |
| `XMAGE_JAVA_OPTS` | empty | Extra JVM flags. |
| `BACKUP_AT` | `03:30` | Time of the daily backup, as `HH:MM` in `TZ`. |
| `BACKUP_KEEP` | `14` | Number of backups to keep. |
| `TZ` | `UTC` | Time zone for `BACKUP_AT`. |

Secrets can also come from files: `XMAGE_ADMIN_PASSWORD_FILE`, `XMAGE_MAIL_PASSWORD_FILE` and `XMAGE_MAILGUN_API_KEY_FILE` take precedence over the plain variables. To use them, mount the file and add the variable to the `xmage` service. The JVM gets its flags through a private argument file, so the admin password doesn't show up in `ps`.

Invalid values (for example `XMAGE_AUTH=yes`) stop the server at start with a message that names the variable.

**Why these defaults.** They target a small box, 2 vCPU and 4 GB RAM. Every running game and every AI opponent takes CPU, and AI turns can spike it, so 4 games and 4 AI players at once keep the server responsive. Raise them together with `XMAGE_MEMORY` on bigger hardware.

## Health

- `xmage` is healthy once its bridge port 17172 accepts connections. It opens only after the card database is loaded, and the first start gets 15 minutes for that.
- `web` checks Caddy's admin API on `localhost:2019`. It starts only after `xmage` is healthy.
- `docker compose -f ops/web/docker-compose.yml ps` shows both states.
- If `up` stops with "dependency failed to start: container ... is unhealthy" after a failed earlier start, the server usually becomes healthy a little later: run `up -d` again once `ps` shows `xmage` healthy.

## Logs

- `docker compose -f ops/web/docker-compose.yml logs -f xmage` shows the server's console output.
- `mageserver.log` is also written to the `xmage-logs` volume (`/opt/xmage/logs`). It rotates at 20 MB and keeps 10 old files. To read it, run `docker compose -f ops/web/docker-compose.yml exec xmage tail -f /opt/xmage/logs/mageserver.log`.

## Data and volumes

| Volume | Mounted at | Holds | Back up? |
|---|---|---|---|
| `xmage-db` | `/opt/xmage/db` | `authorized_user.h2` (accounts), `feedback.h2`, `user_stats.db` (player stats), `table_record.db` (finished tables) | yes, nightly |
| `xmage-cards` | `/opt/xmage/cards-db` | `cards.h2`, the card database | no: a cache built from the image |
| `xmage-saved` | `/opt/xmage/saved` | saved games (`XMAGE_SAVE_GAMES`) and web client replays (`saved/replays`) | optional |
| `xmage-logs` | `/opt/xmage/logs` | `mageserver.log*` | no |
| `xmage-backups` | `/backups` (backup service) | nightly dumps | copy off the machine |
| `caddy-data`, `caddy-config` | Caddy | certificates | optional |

XMage opens every database under `./db`. Only user data stays on `xmage-db`. The entrypoint replaces `db/cards.h2.*` with symlinks into `xmage-cards`. It wipes that volume whenever the image build changes, so a card database from an older image can't shadow the new card pool. An existing `xmage-db` volume from the earlier single-volume layout migrates on its own: the old card database files in it are deleted on first start.

## Backups and restore

The `backup` service runs daily at `BACKUP_AT` and writes `/backups/<UTC timestamp>/` into the `xmage-backups` volume:

- `authorized_user.h2.sql.gz` and `feedback.h2.sql.gz`: H2 SQL dumps. They're taken online by joining the running server's database through H2's auto-server mode, so each dump is consistent.
- `user_stats.db` and `table_record.db`: SQLite copies made with SQLite's online backup API.

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

The restore replaces the accounts and feedback databases (rebuilt from the dumps) and the two SQLite files. Databases missing from the backup are left alone. To restore from a copy kept off the machine, first copy the directory back into the volume: `$C cp ./xmage-backup-20261007 backup:/backups/20261007T033000Z`.

## Upgrade

```bash
git pull
docker compose -f ops/web/docker-compose.yml up -d --build
```

- Volumes are kept. The first start after an upgrade rebuilds the card database (a few minutes); the site comes up when the server reports healthy.
- Take a backup first (`xmage-backup once`) when the release notes mention database changes.
- Settings live in `.env`, so an upgrade never overwrites them.

## Without Docker on a LAN

For the Compose stack on a LAN, see [Private server on a LAN](#private-server-on-a-lan). Without Docker you don't need the proxy at all. Build the client with `npm run build`, serve `Mage.Web.Client/dist` from any static server, and run the server as usual. Over plain HTTP the client connects to `ws://<page host>:17172`.

Add the page origin to `websocketAllowedOrigins` in `config.xml` on the `<server>` element, for example `http://192.168.1.20:8080`.

## Security notes

- Leave port 17172 unpublished. The bridge expects the proxy in front of it, for TLS, the origin check and the client address.
- Only publish 17171 (the desktop client's port) if desktop players should join the same server.
- Set `XMAGE_AUTH=true` on a public server, so names need passwords. Configure mail too, so players can reset their passwords.
- Caddy sets `X-Forwarded-For` to the real client address and drops any value the client sent, because Caddy itself trusts no upstream proxies. It also adds `X-Real-IP`. The server only trusts those headers from `XMAGE_TRUSTED_PROXIES`. It defaults to `CADDY_IP`, so changing `XMAGE_SUBNET` and `CADDY_IP` together is enough.
