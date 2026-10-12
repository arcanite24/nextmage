#!/usr/bin/env bash
# Assembles the platform-independent part of the desktop app: the XMage server release, the built web client and
# the launcher. package.sh then adds a Java runtime and wraps it for one operating system.
#
#   ops/desktop/build-app.sh <version> <out-dir>
#
# Needs, already built:
#   Mage.Server/target/mage-server.zip   mvn -pl Mage.Server -am install -DskipTests
#                                         cd Mage.Server && mvn package assembly:single -DskipTests
#   Mage.Web.Client/dist                  npm ci && npm run build   (without VITE_IMAGE_PROXY: pictures come
#                                         straight from Scryfall, there's no image cache on a desktop)
# and a JDK 17 or later (javac, jar).
set -euo pipefail

VERSION=${1:?usage: build-app.sh <version> <out-dir>}
OUT=${2:?usage: build-app.sh <version> <out-dir>}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
HERE=$ROOT/ops/desktop

SERVER_ZIP=$ROOT/Mage.Server/target/mage-server.zip
CLIENT_DIST=$ROOT/Mage.Web.Client/dist
[ -f "$SERVER_ZIP" ] || { echo "missing $SERVER_ZIP: build the server first" >&2; exit 1; }
[ -f "$CLIENT_DIST/index.html" ] || { echo "missing $CLIENT_DIST: build the web client first" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/app/server"

# the server: jars, plugins and the shipped config; its own start scripts aren't used
unzip -q "$SERVER_ZIP" -d "$OUT/app/server"
rm -f "$OUT/app/server"/startServer* "$OUT/app/server/readme.html" "$OUT/app/server/readme.md"

cp -R "$CLIENT_DIST" "$OUT/app/web"

# the launcher
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
javac --release 17 -encoding UTF-8 -d "$build/classes" $(find "$HERE/launcher/src" -name '*.java')
printf 'Main-Class: playmat.launcher.Main\n' > "$build/manifest.txt"
jar --create --file "$OUT/app/playmat-launcher.jar" --manifest "$build/manifest.txt" -C "$build/classes" .

printf '%s\n' "$VERSION" > "$OUT/app/VERSION"
cp "$ROOT/LICENSE.txt" "$OUT/app/LICENSE.txt"

echo "app $VERSION in $OUT/app ($(du -sh "$OUT/app" | cut -f1))"
