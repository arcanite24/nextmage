#!/bin/sh
# Starts the XMage server with settings from the environment:
#   XMAGE_ALLOWED_ORIGINS  comma-separated browser origins allowed to connect (e.g. https://play.example.com)
#   XMAGE_MEMORY           Java heap (default 2g)
set -eu
config=/opt/xmage/config/config.xml
if [ -n "${XMAGE_ALLOWED_ORIGINS:-}" ]; then
  if grep -q 'websocketAllowedOrigins=' "$config"; then
    sed -i "s|websocketAllowedOrigins=\"[^\"]*\"|websocketAllowedOrigins=\"${XMAGE_ALLOWED_ORIGINS}\"|" "$config"
  else
    sed -i "s|<server |<server websocketAllowedOrigins=\"${XMAGE_ALLOWED_ORIGINS}\" |" "$config"
  fi
fi
exec java -Xmx"${XMAGE_MEMORY:-2g}" -Dxmage.testMode=false -jar lib/mage-server-*.jar
