// QA loop for Agent Derby: headless stills and motion contact sheets of the demo race.
// Usage: npm run qa            (all looks)
//        npm run qa -- pixels  (one or more looks)
// Writes PNGs to docs/qa/. Uses the page's seeded demo data and a frozen clock, so runs are repeatable.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'docs/qa');
mkdirSync(out, { recursive: true });
const pageFile = ['index.html', 'agent-derby.html'].map(f => resolve(root, f)).find(existsSync);
const page0 = pathToFileURL(pageFile).href;

const LOOKS = process.argv.slice(2).length ? process.argv.slice(2) : ['pixels', 'dots', 'dither', 'ascii', 'classic'];
const SCREENS = [
  { name: 'wide', w: 5120, h: 1440, q: 'layout=wide' },  // 49-inch 32:9
  { name: 'tv', w: 1024, h: 768, q: 'layout=4x3' },      // tube TV / Pi 4
];
const SETTLE_MS = 4400;      // demo has done, working and sprint horses by now
const FILM = { frames: 12, stepMs: 1000 / 24 };

const browser = await chromium.launch();
const made = [];
try {
  for (const look of LOOKS) {
    for (const s of SCREENS) {
      const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.clock.install({ time: new Date('2026-11-13T12:00:00Z') });
      await page.goto(`${page0}?${s.q}&style=${look}`);
      await page.clock.runFor(SETTLE_MS);
      const still = resolve(out, `${look}-${s.name}.png`);
      await page.screenshot({ path: still });
      made.push(still);

      // motion: 12 frames, 1/24 s apart, laid out as a contact sheet
      const shots = [];
      for (let i = 0; i < FILM.frames; i++) {
        shots.push((await page.screenshot({ type: 'jpeg', quality: 85 })).toString('base64'));
        await page.clock.runFor(FILM.stepMs);
      }
      const cols = 3, tw = Math.round(Math.min(1700, s.w) / cols), th = Math.round(tw * s.h / s.w);
      const sheet = await ctx.newPage();
      await sheet.setViewportSize({ width: tw * cols, height: th * Math.ceil(FILM.frames / cols) });
      await sheet.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${tw}px)">${
        shots.map((b, i) => `<div style="position:relative"><img style="display:block;width:${tw}px;height:${th}px" src="data:image/jpeg;base64,${b}"><span style="position:absolute;left:6px;top:4px;font:12px monospace;color:#888">${i + 1}</span></div>`).join('')}</body>`);
      const film = resolve(out, `${look}-${s.name}-film.png`);
      await sheet.screenshot({ path: film, fullPage: true });
      made.push(film);

      if (errors.length) { const f = resolve(out, `${look}-${s.name}-errors.txt`); writeFileSync(f, errors.join('\n')); made.push(f); }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(made.map(p => p.replace(root + '/', '')).join('\n'));
