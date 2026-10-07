# Web deployment

Runs the XMage server and the web client together:

- **xmage**: the XMage server. Its WebSocket bridge listens on 17172 inside the network, and only the proxy can reach it.
- **web**: Caddy serves the built client with automatic HTTPS and forwards `/ws` to the server.

Under HTTPS, the client connects to `wss://<your domain>/ws` by default, so players never type a server address.

## Run

```bash
DOMAIN=play.example.com docker compose -f ops/web/docker-compose.yml up -d --build
```

Before you start:

- Point `DOMAIN` at the machine first; Caddy fetches the certificate on first start.
- The first server image build compiles the whole card database (expect tens of minutes). Later builds reuse the Maven cache.

## Settings

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `DOMAIN` | both | required | Public host name. It becomes the only allowed browser origin. |
| `XMAGE_MEMORY` | xmage | `2g` | Java heap for the server. |
| `XMAGE_ALLOWED_ORIGINS` | xmage | `https://$DOMAIN` | Browser origins allowed to open a game connection (comma separated). |

Other server settings (accounts, AI limits, mail) live in `Mage.Server/config/config.xml` and are baked into the image. Change them there and rebuild.

## Private group on a LAN

You don't need the proxy for a home network. Build the client with `npm run build`, serve `Mage.Web.Client/dist` from any static server, and run the server as usual. Over plain HTTP the client connects to `ws://<page host>:17172`.

Add the page origin to `websocketAllowedOrigins` in `config.xml` on the `<server>` element, for example `http://192.168.1.20:8080`.

## Security notes

- Leave port 17172 unpublished. The bridge expects the proxy in front of it, for TLS and the origin check.
- Only publish 17171 (the desktop client's port) if desktop players should join the same server.
- Set `authenticationActivated="true"` in `config.xml` for a public server, so names need passwords.
