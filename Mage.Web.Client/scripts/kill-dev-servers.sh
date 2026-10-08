#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLIENT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_DIR=$(CDPATH= cd -- "$CLIENT_DIR/.." && pwd)

source "$SCRIPT_DIR/dev-server-cleanup.sh"

quiet=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --quiet)
      quiet=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

pid_list() {
  matching_dev_server_pids | tr '\n' ' ' | sed 's/[[:space:]]*$//'
}

pids=$(pid_list)
if [ -z "$pids" ]; then
  if [ "$quiet" -eq 0 ]; then
    echo "No Mage dev server processes found on ports 17171 or 17172."
  fi
  exit 0
fi

if [ "$quiet" -eq 0 ]; then
  echo "Stopping Mage dev server processes: $pids"
fi

terminate_stale_server_processes TERM
sleep 1

remaining_pids=$(pid_list)
if [ -n "$remaining_pids" ]; then
  if [ "$quiet" -eq 0 ]; then
    echo "Force stopping Mage dev server processes: $remaining_pids"
  fi
  terminate_stale_server_processes KILL
  sleep 0.5
fi

remaining_pids=$(pid_list)
if [ -n "$remaining_pids" ]; then
  echo "Mage dev server processes are still running: $remaining_pids" >&2
  exit 1
fi

if [ "$quiet" -eq 0 ]; then
  echo "Stopped Mage dev server processes."
fi
