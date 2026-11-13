#!/bin/sh
# Agent Derby hook. Forwards the agent's hook JSON to the local bridge and never blocks the agent.
# Usage: hook.sh <claude|cursor> [prompt|json]
SRC="${1:-generic}"
curl -s -m 1 -o /dev/null -H 'X-Derby: 1' -H 'Content-Type: application/json' \
  --data-binary @- "http://127.0.0.1:${DERBY_PORT:-4777}/event?src=$SRC" 2>/dev/null
case "$2" in
  prompt) echo '{"continue":true}' ;;
  json) echo '{}' ;;
esac
exit 0
