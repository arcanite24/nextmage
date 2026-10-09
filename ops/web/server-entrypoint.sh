#!/bin/sh
# Starts the XMage server. Settings come from the environment (see ops/web/README.md and .env.example).
#
# config/config.xml is rendered on every start from config/config.template.xml (the file shipped in the
# release), so removing a variable really restores the default. Unset or empty variables keep the
# defaults below. Variables ending in _FILE are read from a file instead (Docker secrets).
set -eu

APP=${XMAGE_HOME:-/opt/xmage}
TEMPLATE=$APP/config/config.template.xml
CONFIG=$APP/config/config.xml
DB_DIR=$APP/db          # volume: user data only (accounts, stats, table records, feedback)
CARDS_DIR=$APP/cards-db # volume: card database cache, rebuilt when the image changes

die() { echo "xmage-server: $*" >&2; exit 1; }

# VAR_FILE wins over VAR, so secrets can come from mounted files
from_file() {
  eval "file=\${${1}_FILE:-}"
  if [ -n "$file" ]; then
    [ -r "$file" ] || die "${1}_FILE=$file is not readable"
    eval "$1=\$(cat \"\$file\")"
  fi
}
for secret in XMAGE_ADMIN_PASSWORD XMAGE_MAIL_PASSWORD XMAGE_MAILGUN_API_KEY; do
  from_file "$secret"
done

is_bool() { [ "$1" = true ] || [ "$1" = false ]; }
is_uint() { case "$1" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }

# set (or add) an attribute on <server>; xmlstarlet escapes the value, so any characters are safe
set_attr() {
  if [ "$(xmlstarlet sel -t -v "count(/config/server/@$1)" "$CONFIG")" = 0 ]; then
    xmlstarlet ed -L -i /config/server -t attr -n "$1" -v "$2" "$CONFIG"
  else
    xmlstarlet ed -L -u "/config/server/@$1" -v "$2" "$CONFIG"
  fi
}

# --- config.xml ---------------------------------------------------------------------------------
cp "$TEMPLATE" "$CONFIG"

# name: variable, attribute, default ("" = keep the template's value), check (uint/bool/any)
render() {
  eval "val=\${$1:-$3}"
  [ -n "$val" ] || return 0
  case "$4" in
    uint) is_uint "$val" || die "$1 must be a whole number (got '$val')" ;;
    bool) is_bool "$val" || die "$1 must be true or false (got '$val')" ;;
  esac
  set_attr "$2" "$val"
}
render XMAGE_SERVER_NAME        serverName              "mage-server" any
render XMAGE_SERVER_ADDRESS     serverAddress           "0.0.0.0"     any
render XMAGE_PORT               port                    "17171"       uint
render XMAGE_SECONDARY_PORT     secondaryBindPort       ""            any
render XMAGE_MAX_GAME_THREADS   maxGameThreads          "4"           uint
render XMAGE_MAX_AI_OPPONENTS   maxAiOpponents          "4"           uint
render XMAGE_MAX_SECONDS_IDLE   maxSecondsIdle          ""            uint
render XMAGE_MAX_POOL_SIZE      maxPoolSize             ""            uint
render XMAGE_AUTH               authenticationActivated "false"       bool
render XMAGE_SAVE_GAMES         saveGameActivated       "false"       bool
render XMAGE_MAILGUN_API_KEY    mailgunApiKey           ""            any
render XMAGE_MAILGUN_DOMAIN     mailgunDomain           ""            any
render XMAGE_MAIL_SMTP_HOST     mailSmtpHost            ""            any
render XMAGE_MAIL_SMTP_PORT     mailSmtpPort            ""            uint
render XMAGE_MAIL_USER          mailUser                ""            any
render XMAGE_MAIL_PASSWORD      mailPassword            ""            any
render XMAGE_MAIL_FROM          mailFromAddress         ""            any
render XMAGE_ALLOWED_ORIGINS    websocketAllowedOrigins ""            any

if [ "${XMAGE_AUTH:-false}" = true ] && [ -z "${XMAGE_MAILGUN_API_KEY:-}${XMAGE_MAIL_USER:-}" ]; then
  echo "xmage-server: warning: XMAGE_AUTH=true without mail settings; password reset mails cannot be sent" >&2
fi

# --- databases ----------------------------------------------------------------------------------
# XMage opens every database under ./db. Only user data should live on the db volume; the card
# database is a cache that belongs to the image. cards.h2.* in ./db are symlinks into the cards
# volume, which is wiped whenever the image build changes, so an old card DB never outlives an upgrade.
build_id=$(cat "$APP/.build-id")
if [ "$(cat "$CARDS_DIR/.build-id" 2>/dev/null || true)" != "$build_id" ]; then
  echo "xmage-server: new image build, the card database will be rebuilt (takes a few minutes)"
  rm -f "$CARDS_DIR"/cards.h2.*
  printf '%s\n' "$build_id" > "$CARDS_DIR/.build-id"
fi
for part in mv.db trace.db; do
  link=$DB_DIR/cards.h2.$part
  # a real file here is a card DB from the old single-volume layout (or one H2 rewrote in place): drop it
  if [ -e "$link" ] && [ ! -L "$link" ]; then rm -f "$link"; fi
  ln -sfn "$CARDS_DIR/cards.h2.$part" "$link"
done
rm -f "$DB_DIR/cards.h2.lock.db" "$DB_DIR/cards.h2.mv.db.tempFile"
# H2 resolves a symlink to an existing file to its real path, but keeps the link path for a missing
# one. Right after a wipe, the server's two openings of the card DB then look like two databases on
# one file and the second fails ("file is locked", OverlappingFileLockException). An empty file is
# a valid new store and makes every opening resolve to the same path.
[ -e "$CARDS_DIR/cards.h2.mv.db" ] || : > "$CARDS_DIR/cards.h2.mv.db"

# --- replays (web client) ---------------------------------------------------------------------
# Finished games are recorded to saved/replays (the xmage-saved volume) for the web client's History.
REPLAYS=${XMAGE_REPLAYS:-true}
is_bool "$REPLAYS" || die "XMAGE_REPLAYS must be true or false (got '$REPLAYS')"
REPLAY_DAYS=${XMAGE_REPLAY_DAYS:-30}
is_uint "$REPLAY_DAYS" || die "XMAGE_REPLAY_DAYS must be a whole number (got '$REPLAY_DAYS')"
REPLAY_MAX=${XMAGE_REPLAY_MAX:-300}
is_uint "$REPLAY_MAX" || die "XMAGE_REPLAY_MAX must be a whole number (got '$REPLAY_MAX')"

# --- JVM ----------------------------------------------------------------------------------------
# Arguments go through a private @argfile so the admin password does not show up in `ps`.
umask 077
args=$(mktemp /tmp/xmage-jvm.XXXXXX)
{
  echo "-Xmx${XMAGE_MEMORY:-2g}"
  echo "-Dxmage.testMode=false"
  echo "-Dlog4j.configuration=file:$APP/config/log4j-docker.properties"
  echo "-Dxmage.replays=$REPLAYS"
  echo "-Dxmage.replays.dir=$APP/saved/replays"
  echo "-Dxmage.replays.retentionDays=$REPLAY_DAYS"
  echo "-Dxmage.replays.maxCount=$REPLAY_MAX"
  if [ -n "${XMAGE_ADMIN_PASSWORD:-}" ]; then
    # quoted for the argfile format: backslashes and double quotes escaped
    printf '"-Dxmage.adminPassword=%s"\n' "$(printf '%s' "$XMAGE_ADMIN_PASSWORD" | sed 's/[\\"]/\\&/g')"
  fi
  if [ -n "${XMAGE_TRUSTED_PROXIES:-}" ]; then
    echo "-Dxmage.web.trustedProxies=$XMAGE_TRUSTED_PROXIES"
  fi
} > "$args"
umask 022

[ -n "${XMAGE_ADMIN_PASSWORD:-}" ] || echo "xmage-server: XMAGE_ADMIN_PASSWORD is not set; admin login is disabled"

cd "$APP"
# XMAGE_JAVA_OPTS: extra JVM flags, split on spaces
# shellcheck disable=SC2086
exec java @"$args" ${XMAGE_JAVA_OPTS:-} -jar lib/mage-server-*.jar
