# Agent Derby.app (test build 0.1.0)

Built on Linux, unsigned. Nothing here is on GitHub yet.

- `build.py` assembles `Agent Derby.app` from a clone of rroaam/agent-derby (main 5aab031) plus official Node v26.13.1 darwin binaries (unchanged, so Node's own signature stays valid).
- `src/launcher.sh` is the app's main executable (bash 3.2). It copies the race files to `~/Library/Application Support/agent-derby`, runs setup.mjs on first launch (or when the app moves), copies `~/agent-derby/derby.config.json` and turns off the old `com.agentderby.bridge` LaunchAgent on first launch, runs bridge.mjs with a restart loop, then runs the menu.
- `src/menu.js` is the menu bar icon in JavaScript for Automation (`osascript -l JavaScript`): status line + live agent list, Open Race, Open Phone View, Open at Login, Connect Agents Again, Quit.
- `src/derbyctl.sh`: login on/off/status (LaunchAgent `com.agentderby.app` that runs `open -a ... --args --login`), setup, agents.
- `test/`: Linux harness with fake macOS tools (`fake-osascript.mjs` fakes the JXA bridge and clicks every item). Not a substitute for a real Mac run.

Rebuild: download node-v26.13.1-darwin-{arm64,x64}.tar.xz, extract to ex-arm64/ ex-x64/, then
`python3 build.py --repo ../agent-derby --node-dir <dir> --arch arm64 --zip out.zip`

Later steps (need Ryan's yes): Developer ID signing with hardened runtime, notarization, DMG via hdiutil on a Mac.
