#!/bin/bash
# Agent Derby: start the bridge at login and restart it if it stops.
#   ./autostart.sh on       turn it on (and start it now)
#   ./autostart.sh off      turn it off (and stop it now)
#   ./autostart.sh status   is it on, and is the page answering?
# macOS only. It writes ~/Library/LaunchAgents/com.agentderby.bridge.plist and logs to bridge.log in this folder.
# It never touches derby.config.json.
LABEL=com.agentderby.bridge
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$DIR/bridge.log"
DOMAIN="gui/$(id -u)"
[ "$(uname)" = Darwin ] || { echo "This uses macOS login items (launchd), so it only works on a Mac."; exit 1; }

port() {
  "${NODE:-node}" -e 'try{const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(Number(c.port)||4777)}catch(e){console.log(4777)}' "$DIR/derby.config.json" 2>/dev/null || echo 4777
}
loaded() { launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; }
stop_job() {
  launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1
  launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1
  for _ in 1 2 3 4 5 6 7 8 9 10; do loaded || return 0; sleep 0.5; done
}
answering() { curl -s -o /dev/null -m 2 "http://127.0.0.1:$1/status"; }
xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

case "$1" in
  on)
    NODE="$(command -v node)"
    if [ -z "$NODE" ]; then echo "I can't find node. Install Node 18 or newer, then run this again."; exit 1; fi
    if [ -f "$DIR/bridge.mjs" ]; then :; else echo "bridge.mjs isn't in $DIR. Run this from your agent-derby folder."; exit 1; fi
    PORT="$(port)"
    stop_job
    if answering "$PORT" || { command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }; then
      echo "Port $PORT is still in use, probably by the bridge in another Terminal tab."
      echo "Go to that tab, press Control+C, then run this again."
      exit 1
    fi
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml "$NODE")</string>
    <string>$(xml "$DIR/bridge.mjs")</string>
  </array>
  <key>WorkingDirectory</key><string>$(xml "$DIR")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(xml "$(dirname "$NODE")"):/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$(xml "$LOG")</string>
  <key>StandardErrorPath</key><string>$(xml "$LOG")</string>
</dict>
</plist>
EOF
    if command -v plutil >/dev/null 2>&1; then
      plutil -lint "$PLIST" >/dev/null || { echo "The login file came out wrong, so I stopped. Nothing was started."; rm -f "$PLIST"; exit 1; }
    fi
    : > "$LOG"
    launchctl bootstrap "$DOMAIN" "$PLIST" || { echo "macOS wouldn't start it. Run this again in a few seconds."; exit 1; }
    for _ in 1 2 3 4 5 6 7 8 9 10; do answering "$PORT" && break; sleep 1; done
    if answering "$PORT"; then
      echo "Agent Derby is on. It starts at login and restarts if it stops."
      echo "Open http://127.0.0.1:$PORT/"
      echo "To turn it off: $DIR/autostart.sh off"
    else
      echo "It's set to start at login, but the page isn't answering yet. The last lines of $LOG:"
      tail -n 15 "$LOG"
      exit 1
    fi
    ;;
  off)
    stop_job
    rm -f "$PLIST"
    echo "Agent Derby autostart is off. The bridge won't start at login anymore."
    echo "To run it by hand: node $DIR/bridge.mjs"
    ;;
  status)
    PORT="$(port)"
    if [ -f "$PLIST" ]; then echo "Autostart: on"; else echo "Autostart: off"; fi
    if answering "$PORT"; then echo "Page: answering at http://127.0.0.1:$PORT/"; else echo "Page: not answering"; fi
    ;;
  *)
    echo "Use: $DIR/autostart.sh on | off | status"; exit 1
    ;;
esac
