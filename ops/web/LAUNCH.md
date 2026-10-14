# Launch checklist: playmat.deimos.studio

What has to be true before we tell strangers about the public server, how each item was checked, and what is still open. Re-run [Checking it again](#checking-it-again) before any big push (a Reddit post, a Discord announcement) and after moving hosts.

Last assessed 2026-10-14 on the Hetzner CAX21 (4 Ampere cores, 8 GB, Falkenstein), running master 433d5d2 (M20 to M22) from the published images.

## Verdict

**Go for the invited soft launch (B257). Not yet for the public announcement:** six owner steps are left, listed in [Before the announcement](#before-the-announcement). None of them needs code. Everything else in this list has been checked on the live server.

## Status

| Area | State | How it was checked |
|---|---|---|
| Network exposure | ok | Only 22, 80 and 443 answer, on IPv4 and IPv6 (Hetzner Cloud Firewall plus `nc -z` probes). The Health listener (17173) and the hooks listener (17174) are reachable only inside the compose network. |
| TLS | ok | Let's Encrypt, renews automatically (valid to Jan 2027). TLS 1.2 and 1.3 only; 1.0 and 1.1 are refused. HTTP redirects to HTTPS. HSTS one year. |
| Headers | ok | CSP (`default-src 'self'`, `frame-ancestors 'none'`, no inline scripts), `nosniff`, Referrer-Policy, Permissions-Policy. Unknown paths (`/.env`, `/admin`) return the app shell, never files. |
| WebSocket | ok | `/ws` accepts only allowed origins; another origin gets 404. 30 new connections a minute per address (Caddy), 16 open connections per address (server). |
| SSH | ok | Keys only. Root logs in only through forced commands (the off-site backup pull). Admin user `neri` with sudo. GitHub deploys use `deploy`, whose key runs `playmat-deploy` and nothing else. |
| Accounts | ok | Sign-in throttle, registration limit (3 an hour, 10 a day per address), email confirmation, unconfirmed names released after 48 hours, self-service export and deletion. Owner set by `XMAGE_OWNER`; no other staff yet. |
| Bot protection | partial | Registration limits are live. Cloudflare Turnstile is wired but needs the owner's widget keys. |
| Mail | **missing** | Code supports Purelymail on 587 (STARTTLS); no credentials yet, so confirmation and reset codes can't be sent. |
| Privacy and terms | partial | `/privacy` and `/terms` are live and sign-up requires agreeing. `XMAGE_CONTACT_EMAIL` is unset, so the pages point to in-app Feedback, which people without an account can't use. |
| Capacity | ok | 12 bot games at once finished with CPU p95 85% and a 465 MB heap (ops/web/README.md, Capacity). The heap may grow to 2 GB. |
| Backups | ok | Nightly online dumps (fixed 2026-10-14: H2 dumps had been empty), a daily off-site copy pulled to Multivac (30 kept), and a restore drill that brought back an account. A snapshot is also taken before every deploy. |
| Monitoring | partial | Host watchdog every 5 minutes and the external Uptime workflow every 15. Both post to Discord, but the webhooks don't exist yet; until then failures show up only in the journal and as failed workflow runs (GitHub emails). |
| Deploys | ok | Release → approval → deploy with snapshot, drain, health gate and automatic rollback. First deploy took 22 s from restart to healthy. Rollback: `sudo -u deploy playmat-deploy rollback`. |
| Staging | ok | Multivac pulls master's images hourly and runs them for the group before a release. |
| Funding | ready, off | The ledger, the Ko-fi and GitHub Sponsors webhooks, the $40 goal and the supporter cosmetics are deployed. A throwaway server on the live image accepted a Ko-fi-shaped payment (200), ignored its repeat, refused a wrong token (401), malformed data (400) and GET (405), and served `/public/support.json` with CORS and a 5-minute cache. The listener stays off, and the support UI hidden, until the owner sets up Ko-fi (B255). |
| Link previews | ok | Open Graph and Twitter card tags; robots.txt keeps crawlers out of `/admin` and `/hooks/`. |
| Moderation | **open** | Reports, mutes and locks exist in /admin, but there are no moderators besides the owner (B260). |

## Findings fixed during the assessment

- **Backups of the H2 databases were empty.** With `AUTO_SERVER=TRUE`, `SCRIPT TO` runs inside the server process and wrote the dump into the server container, not the backup container. Multivac's backups had failed since about 2026-10-09. The dump now goes through the shared db volume (PR #56), and the running containers were patched before the new images shipped.
- **The watchdog watched the old checkout** after the stack moved to `/srv/playmat` (PR #58).
- **`pull-images.ps1` failed on Windows PowerShell 5.1**, which drops the inner quotes of a docker `--format` argument (PR #58).
- **The bundle grew past its budget** when M20 and M21 merged; the email banner and the Turnstile widget now load lazily (PR #57).
- **No link previews**: a shared link showed no card (PR #58).

## Before the announcement

The owner's steps, in order of importance:

1. **Mail** (B228). Create `noreply@deimos.studio` in Purelymail, then in `/srv/playmat/.env` set `XMAGE_MAIL_SMTP_HOST=smtp.purelymail.com`, `XMAGE_MAIL_SMTP_PORT=587`, `XMAGE_MAIL_USER`, `XMAGE_MAIL_PASSWORD` and `XMAGE_MAIL_FROM=noreply@deimos.studio`, then run `sudo playmat-compose up -d --no-build`. Add DMARC at Cloudflare: TXT `_dmarc` = `v=DMARC1; p=quarantine; rua=mailto:<you>@deimos.studio`.
2. **Contact address** (B231). `XMAGE_CONTACT_EMAIL=<an address you read>` in `/srv/playmat/.env`.
3. **Discord webhooks** (B236). Create a public channel and a staff channel, put their webhooks in `XMAGE_DISCORD_WEBHOOK` and `XMAGE_DISCORD_STAFF_WEBHOOK`, run `sudo playmat-compose up -d --no-build`, then `sudo playmat-watchdog test`. Add the staff webhook as the repository secret `UPTIME_DISCORD_WEBHOOK` too.
4. **Turnstile** (B230). In Cloudflare, Turnstile, add a widget for `playmat.deimos.studio` (Managed), then set `XMAGE_TURNSTILE_SITE_KEY` and `XMAGE_TURNSTILE_SECRET`.
5. **Ko-fi** (B255). Create the page in USD, with one-off donations and $3 and $5 memberships. In Ko-fi, Settings, API, Webhooks, set `https://playmat.deimos.studio/hooks/kofi`, put the verification token in `/srv/playmat/.env` as `XMAGE_KOFI_TOKEN`, restart, and press Send Single Donation Test. It shows up in /admin, Support, Unmatched; revoke it there. Then set the Ko-fi page and turn support on in /admin, Settings, Support. GitHub Sponsors works the same way (ops/web/README.md, Support and the monthly goal).
6. **Moderators** (B260). At least two, in different time zones, added in /admin, Staff.

Nice to have: Sign in with GitHub (B238: an OAuth app with callback `https://playmat.deimos.studio/auth/github`), restic to Cloudflare R2 for a second off-site copy, and Hetzner's own backups (20% of the server price) for whole-disk restores.

## Known limits

- **One box, one region.** A Hetzner outage takes the server down. Restore onto a new box from the Multivac copy (ops/web/README.md, Backups and restore) is the plan. It was drilled for the databases, not timed end to end.
- **Shared addresses.** 16 open connections per address. A school or a mobile carrier's CGNAT could reach that with many players; raise `-Dxmage.web.maxConnectionsPerIp` through `XMAGE_JAVA_OPTS` if reports come in.
- **DNS only.** The origin's address is public, so a flood reaches the box directly. CLOUDFLARE.md describes the switch to proxying, which takes minutes.
- **Drain and rollback.** Snapshots and the health gate ran on the first deploy; draining live games and an automatic rollback have only run in `test-deploy.sh`.

## Checking it again

From any machine:

```bash
curl -sI https://playmat.deimos.studio/ | grep -iE "^HTTP|strict-transport|content-security"
echo | openssl s_client -connect playmat.deimos.studio:443 -servername playmat.deimos.studio 2>/dev/null | openssl x509 -noout -enddate
for p in 21 22 25 80 443 3306 5432 8080 17171 17172 17173 17174; do nc -z -G 3 46.224.105.107 $p 2>/dev/null && echo "open $p"; done
```

On the host:

```bash
sudo -u deploy playmat-deploy status
sudo playmat-compose exec backup xmage-backup list | tail -3
ls -lt /var/backups/playmat/offsite | head -3
systemctl list-timers 'playmat-*'
sudo sshd -T | grep -E '^(permitrootlogin|passwordauthentication) '
```

Expect only 22, 80 and 443 open, a certificate more than 14 days from expiry, healthy services, a backup from the last night, and `permitrootlogin forced-commands-only`.
