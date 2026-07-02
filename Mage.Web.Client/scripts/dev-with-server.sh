#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLIENT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_DIR=$(CDPATH= cd -- "$CLIENT_DIR/.." && pwd)
SHELL_PGID=$(ps -o pgid= -p $$ | tr -d ' ')

server_pid=""
client_pid=""
cleanup_started=0

set -m 2>/dev/null || true

is_running() {
  local pid="${1:-}"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

kill_process_group() {
  local pid="${1:-}"
  local signal="${2:-TERM}"
  local pgid=""

  if ! is_running "$pid"; then
    return 0
  fi

  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
  if [ -n "$pgid" ] && [ "$pgid" != "$SHELL_PGID" ]; then
    kill "-$signal" "-$pgid" 2>/dev/null || true
  fi
}

kill_process_tree() {
  local pid="${1:-}"
  local signal="${2:-TERM}"
  local children=""
  local child=""

  if ! is_running "$pid"; then
    return 0
  fi

  if command -v pgrep >/dev/null 2>&1; then
    children=$(pgrep -P "$pid" 2>/dev/null || true)
    for child in $children; do
      kill_process_tree "$child" "$signal"
    done
  fi

  kill_process_group "$pid" "$signal"
  kill "-$signal" "$pid" 2>/dev/null || true
}

matching_server_pids() {
  ps -axo pid=,comm=,command= | awk -v repo="$REPO_DIR" '
    $2 == "java" && index($0, repo) && index($0, "exec.mainClass=mage.server.Main") {
      print $1
    }
  '
}

terminate_stale_server_processes() {
  local signal="$1"
  local pid=""

  while read -r pid; do
    if [ -n "$pid" ] && [ "$pid" != "$$" ] && is_running "$pid"; then
      kill_process_tree "$pid" "$signal"
    fi
  done < <(matching_server_pids)
}

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
