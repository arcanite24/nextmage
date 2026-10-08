#!/usr/bin/env bash

MAGE_DEV_SERVER_PORTS=(17171 17172)
MAGE_CLEANUP_SHELL_PGID=$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')

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
  if [ -n "$pgid" ] && [ "$pgid" != "$MAGE_CLEANUP_SHELL_PGID" ]; then
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

matching_server_command_pids() {
  ps -axo pid=,comm=,command= | awk -v repo="$REPO_DIR" '
    $2 == "java" && index($0, repo) && index($0, "exec.mainClass=mage.server.Main") {
      print $1
    }
  '
}

matching_server_listener_pids() {
  local port=""

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  for port in "${MAGE_DEV_SERVER_PORTS[@]}"; do
    lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  done
}

matching_dev_server_pids() {
  {
    matching_server_command_pids
    matching_server_listener_pids
  } | awk 'NF && !seen[$1]++ { print $1 }'
}

terminate_stale_server_processes() {
  local signal="${1:-TERM}"
  local pid=""

  while read -r pid; do
    if [ -n "$pid" ] && [ "$pid" != "$$" ] && is_running "$pid"; then
      kill_process_tree "$pid" "$signal"
    fi
  done < <(matching_dev_server_pids)
}
