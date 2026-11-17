#!/bin/bash
# Runs the real launcher on Linux with fake macOS tools and a fake home folder.
set -u
T=/tmp/claude-0/apptest
rm -rf "$T"; mkdir -p "$T/home"
cp -R "/home/user/mac-app/dist/arm/Agent Derby.app" "$T/Agent Derby.app"
APP="$T/Agent Derby.app"
mkdir -p "$APP/Contents/Resources/node/x64"
ln -sf "$(command -v node)" "$APP/Contents/Resources/node/x64/node"
H="$T/home"
mkdir -p "$H/agent-derby" "$H/Library/LaunchAgents" "$H/.claude"
echo '{"port":4791,"watch":[]}' >"$H/agent-derby/derby.config.json"
echo '<plist/>' >"$H/Library/LaunchAgents/com.agentderby.bridge.plist"
cat >"$H/.claude/settings.json" <<J
{"model":"opus","hooks":{"Stop":[{"hooks":[{"type":"command","command":"say done"}]},{"hooks":[{"type":"command","command":"\"$H/agent-derby/hook.sh\" claude"}]}]}}
J
export HOME="$H"
echo "=== first launch"
"$APP/Contents/MacOS/Agent Derby"
echo "exit $?"
