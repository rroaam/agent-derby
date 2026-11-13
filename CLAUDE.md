# Agent Derby: rules for Claude Code

Agent Derby is a screensaver page (`index.html`, one file, Canvas 2D, no build step) where each AI agent is a horse: done stands, working trots, full sprint gallops. `bridge.mjs` feeds it live status on the owner's Mac. Read `docs/STYLE.md` and `docs/MOTION.md` before any visual work. They are the bar.

## Hard rules
- **Never** push, merge, deploy, publish, or install anything globally without asking the owner first. Local commits on a branch are fine.
- **Never** read, print or edit `derby.config.json`, `.env`, or any key file (`.p8`, `.p12`, `.pem`, `.mobileprovision`).
- Real data only. Demo horses appear only when no bridge is reachable, and are always labeled DEMO. Never fake a live agent.
- No drop shadows. No copied artwork: references set direction only. The gallop plays silhouettes traced from Muybridge's 1878 photographs (public domain, credited in the README); the trot and stand are drawn by code.
- Keep `index.html` a single self-contained file that works from `file://`, from the bridge, and inside Plash or WebViewScreenSaver.
- Performance budget: 60 fps at 5120x1440 on a Mac mini, and a Raspberry Pi 4 at 1024x768 must stay smooth (degrade, never stutter). Keep the frame-time watchdog working.
- Keep these working: `?layout=`, `?style=`, `?palette=`, `?crt=`, `?lanes=`, `?demo=0`, the V/D/F/C/H keys, and the `page` settings read from the bridge's `/config`.

## Definition of done (every visual change)
1. Run the QA loop: `npm run qa` (first time only: `npm install`, then ask the owner before `npx playwright install chromium`, a ~150 MB local browser download).
2. Open every image in `docs/qa/` and look at it. Use the `design-critic` agent on the stills and `motion-reviewer` on the filmstrips.
3. Fix everything they flag that breaks STYLE.md or MOTION.md, then run the loop again.
4. Done only when both reviewers pass and you have viewed the final images yourself. Report with the image paths, what changed, and anything still below the bar. Never call it done from code alone.

## Where things are
- `index.html` (or `agent-derby.html` in the Mac kit): the page. `GAIT` and the `*Pose` functions are the motion; `renderHorse`, `stylize`, `drawStyled`, `drawCRT` are the rendering.
- `qa/shoot.mjs`: headless screenshots and filmstrips (Playwright).
- `.claude/agents/`: `design-critic`, `motion-reviewer`. They review, they never edit.
