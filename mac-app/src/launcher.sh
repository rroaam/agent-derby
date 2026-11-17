#!/bin/bash
# Agent Derby.app launcher. macOS runs this when the app opens.
# It keeps the race files in ~/Library/Application Support/agent-derby, hooks up the agents on first launch,
# runs the race server with the Node that ships inside the app, and shows the menu bar icon.
# Quitting from the menu stops the server. Written for the bash that ships with macOS (3.2).

CONTENTS="$(cd "$(dirname "$0")/.." && pwd)"
RES="$CONTENTS/Resources"
APP_PATH="$(cd "$CONTENTS/.." && pwd)"
SUPPORT="$HOME/Library/Application Support/agent-derby"
mkdir -p "$SUPPORT"
LOG="$SUPPORT/app.log"
exec >>"$LOG" 2>&1
echo "---- $(date) opened from $APP_PATH ($*)"

case "$(uname -m)" in
  arm64) NODE="$RES/node/arm64/node" ;;
  *) NODE="$RES/node/x64/node" ;;
esac
[ -x "$NODE" ] || NODE="$(ls "$RES"/node/*/node 2>/dev/null | head -n 1)"

port() {
  "$NODE" -e 'try{const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(Number(c.port)||4777)}catch(e){console.log(4777)}' "$SUPPORT/derby.config.json" 2>/dev/null || echo 4777
}
answering() { /usr/bin/curl -s -o /dev/null -m 2 "http://127.0.0.1:$1/status"; }

LOGIN_LAUNCH=0
for a in "$@"; do [ "$a" = "--login" ] && LOGIN_LAUNCH=1; done

# Already open? Show the race instead of starting a second copy.
PIDFILE="$SUPPORT/app.pid"
if [ -f "$PIDFILE" ]; then
  OLD="$(cat "$PIDFILE" 2>/dev/null)"
  if [ -n "$OLD" ] && [ "$OLD" != "$$" ] && kill -0 "$OLD" 2>/dev/null && ps -p "$OLD" -o command= | grep -q "Contents/MacOS/Agent Derby"; then
    echo "Already open (pid $OLD)."
    [ "$LOGIN_LAUNCH" = 1 ] || /usr/bin/open "http://127.0.0.1:$(port)/"
    exit 0
  fi
fi
echo $$ >"$PIDFILE"

# Race files live outside the app, so the agents' hooks keep working if the app is moved or updated.
/bin/cp -R "$RES/app/." "$SUPPORT/"
/bin/chmod 755 "$SUPPORT"/*.sh "$SUPPORT"/*.mjs 2>/dev/null

FIRST_RUN=0
if [ ! -f "$SUPPORT/.installed" ]; then
  FIRST_RUN=1
  # Coming from the Terminal version? Keep its settings, and let the app take over starting at login.
  if [ ! -f "$SUPPORT/derby.config.json" ] && [ -f "$HOME/agent-derby/derby.config.json" ]; then
    /bin/cp "$HOME/agent-derby/derby.config.json" "$SUPPORT/derby.config.json" && echo "Copied settings from ~/agent-derby."
  fi
  OLDPLIST="$HOME/Library/LaunchAgents/com.agentderby.bridge.plist"
  if [ -f "$OLDPLIST" ]; then
    /bin/launchctl bootout "gui/$(id -u)/com.agentderby.bridge" >/dev/null 2>&1
    /bin/launchctl bootout "gui/$(id -u)" "$OLDPLIST" >/dev/null 2>&1
    /bin/mv "$OLDPLIST" "$SUPPORT/old-terminal-autostart.plist" && echo "Turned off the Terminal version's autostart (saved a copy here)."
    sleep 1
  fi
fi
PORT="$(port)"

# Hook up Claude Code, Cursor and the Claude app on first launch, and again if the app moved.
SETUP="skipped"
if [ "$FIRST_RUN" = 1 ] || [ "$(cat "$SUPPORT/.setup-node" 2>/dev/null)" != "$NODE" ]; then
  if "$NODE" "$SUPPORT/setup.mjs" >>"$SUPPORT/setup.log" 2>&1; then
    SETUP="ok"; printf '%s' "$NODE" >"$SUPPORT/.setup-node"
  else
    SETUP="failed"
  fi
  echo "Agent setup: $SETUP"
fi

if [ "$FIRST_RUN" = 1 ]; then
  /bin/bash "$RES/derbyctl.sh" login on "$APP_PATH"
  date >"$SUPPORT/.installed"
fi

# The race server. Restarts itself if it ever stops. If one is already answering (say, from Terminal), use that.
SUP_PID=""
supervise() {
  child=""
  trap 'if [ -n "$child" ]; then kill "$child" 2>/dev/null; fi; exit 0' TERM INT HUP
  while :; do
    "$NODE" "$SUPPORT/bridge.mjs" >>"$SUPPORT/bridge.log" 2>&1 &
    child=$!
    wait "$child"
    sleep 5
  done
}
if answering "$PORT"; then
  echo "A race server is already answering on $PORT, so the app is using it."
  SERVER="external"
else
  : >"$SUPPORT/bridge.log"
  supervise &
  SUP_PID=$!
  SERVER="app"
  for _ in 1 2 3 4 5 6 7 8 9 10; do answering "$PORT" && break; sleep 0.5; done
fi

cleanup() {
  if [ -n "$SUP_PID" ]; then kill "$SUP_PID" 2>/dev/null; wait "$SUP_PID" 2>/dev/null; fi
  [ "$(cat "$PIDFILE" 2>/dev/null)" = "$$" ] && rm -f "$PIDFILE"
}
trap cleanup EXIT
trap 'exit 0' TERM INT HUP

OPEN_RACE=0
[ "$FIRST_RUN" = 0 ] && [ "$LOGIN_LAUNCH" = 0 ] && OPEN_RACE=1

# Run the menu natively on Apple silicon. Under Rosetta, JavaScript for Automation hangs creating the menu handler.
OSA=/usr/bin/osascript
[ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ] && OSA="/usr/bin/arch -arm64e /usr/bin/osascript"
DERBY_PORT="$PORT" DERBY_NODE="$NODE" DERBY_RES="$RES" DERBY_APP="$APP_PATH" DERBY_SUPPORT="$SUPPORT" \
DERBY_FIRST_RUN="$FIRST_RUN" DERBY_SETUP="$SETUP" DERBY_SERVER="$SERVER" DERBY_OPEN_RACE="$OPEN_RACE" \
  $OSA -l JavaScript "$RES/menu.js" &
MENU_PID=$!
STARTED=$(date +%s)
trap 'kill "$MENU_PID" 2>/dev/null; exit 0' TERM INT HUP
wait "$MENU_PID"
CODE=$?
echo "Menu closed ($CODE)."
if [ "$CODE" != 0 ] && [ $(( $(date +%s) - STARTED )) -lt 5 ]; then
  /usr/bin/osascript -e 'display alert "Agent Derby couldn'"'"'t show its menu bar icon" message "The details are in app.log in ~/Library/Application Support/agent-derby." as critical' >/dev/null 2>&1
fi
exit 0
