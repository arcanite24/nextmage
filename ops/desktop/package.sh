#!/usr/bin/env bash
# Wraps the app from build-app.sh for one operating system, with its own Java runtime (Eclipse Temurin 17 JRE,
# checksum-verified), so players install nothing else.
#
#   ops/desktop/package.sh linux   x64|arm64 <build-dir> <dist-dir>   -> Playmat-Linux-<arch>.tar.gz
#   ops/desktop/package.sh macos   x64|arm64 <build-dir> <dist-dir>   -> Playmat-macOS-<arch>.dmg and .tar.gz (run on macOS)
#   ops/desktop/package.sh windows x64       <build-dir> <dist-dir>   -> Playmat-Setup-Windows-x64.exe (run on Windows,
#                                                                         with Inno Setup 6)
#
# <build-dir> holds app/ from build-app.sh. Needs curl, tar, jq, a JDK (for the icon tool) and unzip or 7z on Windows.
set -euo pipefail

OS=${1:?os}
ARCH=${2:?arch}
BUILD=$(cd "${3:?build dir}" && pwd)
mkdir -p "${4:?dist dir}"
DIST=$(cd "$4" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
ICON_SRC=$ROOT/Mage.Web.Client/public/icon-512.png
VERSION=$(cat "$BUILD/app/VERSION")
JAVA_FEATURE=17

[ -f "$BUILD/app/playmat-launcher.jar" ] || { echo "no app in $BUILD: run build-app.sh first" >&2; exit 1; }

case "$ARCH" in
  x64) JRE_ARCH=x64 ;;
  arm64) JRE_ARCH=aarch64 ;;
  *) echo "unknown arch $ARCH" >&2; exit 1 ;;
esac
case "$OS" in
  linux) JRE_OS=linux ;;
  macos) JRE_OS=mac ;;
  windows) JRE_OS=windows ;;
  *) echo "unknown os $OS" >&2; exit 1 ;;
esac

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# Downloads the latest Temurin JRE for the target and unpacks it; prints the folder holding bin/java.
fetch_jre() {
  local api="https://api.adoptium.net/v3/assets/latest/$JAVA_FEATURE/hotspot?architecture=$JRE_ARCH&image_type=jre&os=$JRE_OS&vendor=eclipse"
  local meta link checksum name
  meta=$(curl -fsSL --retry 4 "$api")
  link=$(printf '%s' "$meta" | jq -r '.[0].binary.package.link')
  checksum=$(printf '%s' "$meta" | jq -r '.[0].binary.package.checksum')
  name=$(printf '%s' "$meta" | jq -r '.[0].binary.package.name')
  [ -n "$link" ] && [ "$link" != null ] || { echo "no Temurin $JAVA_FEATURE JRE for $JRE_OS/$JRE_ARCH" >&2; exit 1; }
  echo "downloading $name" >&2
  curl -fsSL --retry 4 -o "$WORK/$name" "$link"
  [ "$(sha256 "$WORK/$name")" = "$checksum" ] || { echo "checksum mismatch for $name" >&2; exit 1; }
  mkdir -p "$WORK/jre"
  case "$name" in
    *.zip) if command -v unzip >/dev/null 2>&1; then unzip -q "$WORK/$name" -d "$WORK/jre"; else 7z x -y -o"$WORK/jre" "$WORK/$name" >/dev/null; fi ;;
    *) tar -xzf "$WORK/$name" -C "$WORK/jre" ;;
  esac
  local top
  top=$(find "$WORK/jre" -mindepth 1 -maxdepth 1 -type d | head -n1)
  if [ -d "$top/Contents/Home" ]; then echo "$top/Contents/Home"; else echo "$top"; fi
}

# runtime/ + app/ under the given folder
lay_out() {
  local into=$1 jre
  jre=$(fetch_jre)
  mkdir -p "$into"
  mv "$jre" "$into/runtime"
  cp -R "$BUILD/app" "$into/app"
}

case "$OS" in
  linux)
    stage=$WORK/Playmat
    lay_out "$stage"
    java "$HERE/tools/Icons.java" png "$ICON_SRC" "$stage/playmat.png" 256
    cp "$HERE/linux/playmat" "$stage/playmat"
    chmod +x "$stage/playmat"
    out=$DIST/Playmat-Linux-$ARCH.tar.gz
    tar -C "$WORK" -czf "$out" Playmat
    ;;

  macos)
    bundle=$WORK/Playmat.app
    mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
    lay_out "$bundle/Contents/Resources"
    sed "s/@VERSION@/$VERSION/g" "$HERE/macos/Info.plist" > "$bundle/Contents/Info.plist"
    cp "$HERE/macos/Playmat" "$bundle/Contents/MacOS/Playmat"
    chmod +x "$bundle/Contents/MacOS/Playmat"
    java "$HERE/tools/Icons.java" iconset "$ICON_SRC" "$WORK/playmat.iconset"
    iconutil -c icns "$WORK/playmat.iconset" -o "$bundle/Contents/Resources/playmat.icns"
    # Ad-hoc signature for the bundle; the Java runtime inside keeps Eclipse's own signatures. Without an Apple
    # Developer ID, a downloaded app still asks to be opened once from System Settings (the install script
    # doesn't: curl downloads aren't quarantined).
    codesign --force --sign - "$bundle" || echo "warning: codesign failed; the app is unsigned" >&2
    tar -C "$WORK" -czf "$DIST/Playmat-macOS-$ARCH.tar.gz" Playmat.app
    dmg_src=$WORK/dmg
    mkdir -p "$dmg_src"
    cp -R "$bundle" "$dmg_src/"
    ln -s /Applications "$dmg_src/Applications"
    # hdiutil now and then fails with "Resource busy" on CI machines; a retry gets past it
    for attempt in 1 2 3; do
      hdiutil create -volname Playmat -srcfolder "$dmg_src" -ov -format UDZO "$DIST/Playmat-macOS-$ARCH.dmg" >/dev/null && break
      [ "$attempt" = 3 ] && { echo "hdiutil failed" >&2; exit 1; }
      sleep 10
    done
    out="$DIST/Playmat-macOS-$ARCH.dmg and .tar.gz"
    ;;

  windows)
    stage=$WORK/Playmat
    lay_out "$stage"
    java "$HERE/tools/Icons.java" ico "$ICON_SRC" "$stage/playmat.ico"
    iscc=$(command -v iscc || command -v ISCC || true)
    for candidate in "/c/Program Files (x86)/Inno Setup 6/ISCC.exe" "/c/Program Files/Inno Setup 6/ISCC.exe"; do
      [ -n "$iscc" ] || { [ -f "$candidate" ] && iscc=$candidate; }
    done
    [ -n "$iscc" ] || { echo "Inno Setup 6 (iscc) not found" >&2; exit 1; }
    # Windows wants a dotted number for the file version; a dev build gets 0.0.0
    numeric=$(printf '%s' "$VERSION" | grep -Eo '^[0-9]+(\.[0-9]+){0,3}' || echo 0.0.0)
    winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }
    # Git Bash would rewrite the /D... switches as if they were paths
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$iscc" /Q "/DAppVersion=$VERSION" "/DNumericVersion=$numeric" "/DSourceDir=$(winpath "$stage")" \
      "/DOutputDir=$(winpath "$DIST")" "$(winpath "$HERE/windows/Playmat.iss")"
    out=$DIST/Playmat-Setup-Windows-$ARCH.exe
    ;;
esac

echo "packaged $out"
