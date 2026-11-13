#!/bin/sh
# Runs any command and shows it as a horse while it runs.
#   derby-run.sh <agent-id> "<Name>" "<task>" -- your command and its arguments
# Example:
#   ~/agent-derby/derby-run.sh my-bot "My Bot" "ops" -- python3 ~/bots/my_bot.py
# The horse trots while the command runs and stands when it ends.
# The command's output and exit code pass straight through. If the bridge is off, nothing changes.

if [ "$#" -lt 5 ] || [ "$4" != "--" ]; then
  echo 'Usage: derby-run.sh <agent-id> "<Name>" "<task>" -- command [args...]' >&2
  exit 64
fi
AGENT=$1; NAME=$2; TASK=$3; shift 4
URL="http://127.0.0.1:${DERBY_PORT:-4777}/event"

esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\000-\037'; }
send() {
  curl -s -m 1 -o /dev/null -H 'X-Derby: 1' -H 'Content-Type: application/json' \
    -d "{\"agent\":\"$(esc "$AGENT")\",\"name\":\"$(esc "$NAME")\",\"task\":\"$(esc "$TASK")\",\"state\":\"$1\",\"note\":\"$(esc "$2")\"}" \
    "$URL" >/dev/null 2>&1 || true
}

send work ""
( while sleep 60; do send work ""; done ) &
BEAT=$!

"$@"
CODE=$?

kill "$BEAT" 2>/dev/null
wait "$BEAT" 2>/dev/null
if [ "$CODE" -eq 0 ]; then send done ""; else send done "exited with $CODE"; fi
exit "$CODE"
