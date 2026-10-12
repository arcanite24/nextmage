#!/bin/sh
# Installs (or updates) Playmat on macOS or Linux and starts it:
#
#   curl -fsSL https://github.com/arcanite24/playmat/releases/latest/download/install.sh | sh
#
# macOS: ~/Applications/Playmat.app.  Linux: ~/.local/opt/Playmat, with an applications menu entry.
# No administrator password, and nothing else to install: Playmat brings its own Java.
# Your data (accounts, decks, Career) is kept across updates.
set -eu

REPO=arcanite24/playmat
BASE=${PLAYMAT_DOWNLOAD_BASE:-https://github.com/$REPO/releases/latest/download}

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf 'Playmat install failed: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is needed"
command -v tar >/dev/null 2>&1 || fail "tar is needed"

case "$(uname -m)" in
  x86_64|amd64) ARCH=x64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) fail "this computer's processor ($(uname -m)) isn't supported" ;;
esac

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

case "$(uname -s)" in
  Darwin)
    ASSET=Playmat-macOS-$ARCH.tar.gz
    say "Downloading Playmat for macOS ($ARCH)…"
    curl -fL --progress-bar --retry 3 -o "$TMP/$ASSET" "$BASE/$ASSET" || fail "download failed, check your internet connection"
    tar -xzf "$TMP/$ASSET" -C "$TMP"
    DEST=$HOME/Applications
    mkdir -p "$DEST"
    pkill -f "$DEST/Playmat.app/Contents/Resources/runtime" 2>/dev/null || true
    sleep 1
    rm -rf "$DEST/Playmat.app"
    mv "$TMP/Playmat.app" "$DEST/Playmat.app"
    say "Playmat is installed in $DEST. Starting it…"
    open "$DEST/Playmat.app"
    ;;
  Linux)
    ASSET=Playmat-Linux-$ARCH.tar.gz
    say "Downloading Playmat for Linux ($ARCH)…"
    curl -fL --progress-bar --retry 3 -o "$TMP/$ASSET" "$BASE/$ASSET" || fail "download failed, check your internet connection"
    tar -xzf "$TMP/$ASSET" -C "$TMP"
    DEST=$HOME/.local/opt
    mkdir -p "$DEST"
    pkill -f "$DEST/Playmat/runtime/bin/java" 2>/dev/null || true
    sleep 1
    rm -rf "$DEST/Playmat"
    mv "$TMP/Playmat" "$DEST/Playmat"
    say "Playmat is installed in $DEST/Playmat. Starting it…"
    if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
      nohup "$DEST/Playmat/playmat" >/dev/null 2>&1 &
      say "Look for Playmat in your applications menu next time."
    else
      say "No desktop found. Run it with: $DEST/Playmat/playmat --headless"
    fi
    ;;
  *)
    fail "use the Windows installer from https://github.com/$REPO/releases/latest"
    ;;
esac
