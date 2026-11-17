#!/bin/bash
# Small helpers the Agent Derby menu calls.
#   derbyctl.sh login on <app path>   open Agent Derby when you log in
#   derbyctl.sh login off             stop opening it at login
#   derbyctl.sh login status          prints on or off
#   derbyctl.sh setup <node path>     hook up Claude Code, Cursor and the Claude app again
#   derbyctl.sh agents <port>         prints one line about who is racing
LABEL=com.agentderby.app
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SUPPORT="$HOME/Library/Application Support/agent-derby"
xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

case "$1:$2" in
  login:on)
    APP="$3"
    [ -d "$APP" ] || { echo "no app path"; exit 1; }
    mkdir -p "$HOME/Library/LaunchAgents"
    cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-a</string>
    <string>$(xml "$APP")</string>
    <string>--args</string>
    <string>--login</string>
  </array>
  <key>AssociatedBundleIdentifiers</key><string>com.agentderby.app</string>
  <key>RunAtLoad</key><true/>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
</dict>
</plist>
EOF
    /usr/bin/plutil -lint "$PLIST" >/dev/null 2>&1 || { rm -f "$PLIST"; echo "failed"; exit 1; }
    echo on
    ;;
  login:off)
    /bin/launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1
    rm -f "$PLIST"
    echo off
    ;;
  login:status)
    if [ -f "$PLIST" ]; then echo on; else echo off; fi
    ;;
  setup:*)
    NODE="$2"
    if "$NODE" "$SUPPORT/setup.mjs" >>"$SUPPORT/setup.log" 2>&1; then
      printf '%s' "$NODE" >"$SUPPORT/.setup-node"; echo ok
    else
      echo failed
    fi
    ;;
  agents:*)
    /usr/bin/curl -s -m 1 "http://127.0.0.1:$2/status" || echo none
    ;;
  *)
    echo "Use: derbyctl.sh login on <app>|off|status, setup <node>, agents <port>"; exit 1
    ;;
esac
