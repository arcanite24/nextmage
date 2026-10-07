#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLIENT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_DIR=$(CDPATH= cd -- "$CLIENT_DIR/.." && pwd)

source "$SCRIPT_DIR/dev-server-cleanup.sh"

server_pid=""
client_pid=""
cleanup_started=0

set -m 2>/dev/null || true

terminate_dev_processes() {
  local signal="$1"

  if is_running "$client_pid"; then
    kill_process_tree "$client_pid" "$signal"
  fi

  if is_running "$server_pid"; then
    kill_process_tree "$server_pid" "$signal"
  fi

  terminate_stale_server_processes "$signal"
}

cleanup() {
  local exit_code=$?

  if [ "$cleanup_started" -eq 1 ]; then
    exit "$exit_code"
  fi

  cleanup_started=1
  trap - INT TERM EXIT

  if is_running "$client_pid" || is_running "$server_pid"; then
    echo "Stopping Mage dev processes..."
    terminate_dev_processes TERM
    sleep 2
    terminate_dev_processes KILL
  fi

  if [ -n "$client_pid" ]; then
    wait "$client_pid" 2>/dev/null || true
  fi

  if [ -n "$server_pid" ]; then
    wait "$server_pid" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

terminate_stale_server_processes TERM
sleep 1
terminate_stale_server_processes KILL

(
  cd "$REPO_DIR/Mage.Server/release"
  mvn -f ../../pom.xml -pl Mage.Server -am -DskipTests install
  exec mvn -f ../../pom.xml -pl Mage.Server -Dexec.mainClass=mage.server.Main -Dexec.cleanupDaemonThreads=false exec:java
) &
server_pid=$!

sleep 2
if ! is_running "$server_pid"; then
  echo "Mage server failed to start."
  wait "$server_pid"
fi

(
  cd "$CLIENT_DIR"
  exec npm run dev -- "$@"
) &
client_pid=$!

while true; do
  if ! is_running "$server_pid"; then
    wait "$server_pid"
    exit $?
  fi

  if ! is_running "$client_pid"; then
    wait "$client_pid"
    exit $?
  fi

  sleep 1
done
