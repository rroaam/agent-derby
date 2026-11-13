# Start prompt

Open Terminal in this folder, start Claude Code with Fable, and paste everything below the line.

```
claude --model claude-fable-5-2
```

If it says it doesn't know that model, use `claude --model fable` instead, or type `/model` inside Claude Code to pick it.

---

You're the art director and motion designer on Agent Derby. The current horse looks are below the bar. Pixels is the only one close. Your job is to make this look like premium generative art.

1. Read CLAUDE.md, docs/STYLE.md and docs/MOTION.md. Then read index.html end to end.
2. Run the QA loop once as a baseline (`npm install`, then ask me before installing Playwright's Chromium, then `npm run qa`). Look at every image and have design-critic and motion-reviewer judge them.
3. Show me a short plan before you change anything: what's wrong with the silhouette, the pixel look, the dots look and the motion, and how you'll fix each. Wait for my go.
4. Work on a branch. Rebuild the pixel look to the STYLE.md bar first (silhouette and grid before effects), then fix motion to MOTION.md, then bring dots up to the bar. Hide dither, ASCII and classic from the V cycle until they pass.
5. After each pass: `npm run qa`, view the images yourself, run both reviewers, fix, repeat until both say PASS.
6. Stop and report: the final images in docs/qa/ (pixels and dots, wide and TV, plus filmstrips), what changed, and anything still short of the bar. Commit locally; don't push.
