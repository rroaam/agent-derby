// QA loop for Agent Derby: headless stills and motion contact sheets of the demo race.
// Usage: npm run qa            (pixels and dots, the looks on show)
//        npm run qa -- dither  (one or more looks by name; dither, ascii and classic still open this way)
// Writes PNGs to docs/qa/. Uses the page's seeded demo data and a frozen clock, so runs are repeatable.
// Per look and screen:
//   <look>-<screen>.png             the whole screen, mixed states
//   <look>-<screen>-crops.png       every horse from that still at 1:1, so the grid can be judged cell by cell
//   <look>-<screen>-film.png        the whole screen, 12 frames over half a second
//   <look>-<screen>-rest-film.png   one horse at 1:1, 12 frames over one breath
//   <look>-<screen>-work-film.png   one horse at 1:1, 12 frames over one trot stride
//   <look>-<screen>-sprint-film.png one horse at 1:1, 12 frames over one gallop stride
//   <look>-<screen>-change-film.png one horse at 1:1 through done > working > full sprint > done, 12 frames over 1.5 s each
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'docs/qa');
mkdirSync(out, { recursive: true });
const pageFile = ['index.html', 'agent-derby.html'].map(f => resolve(root, f)).find(existsSync);
const page0 = pathToFileURL(pageFile).href;

const LOOKS = process.argv.slice(2).length ? process.argv.slice(2) : ['pixels', 'dots'];
const SCREENS = [
  { name: 'wide', w: 5120, h: 1440, q: 'layout=wide' },  // 49-inch 32:9
  { name: 'tv', w: 1024, h: 768, q: 'layout=4x3' },      // tube TV / Pi 4
];
const SETTLE_MS = 2400;      // with the 2 s the page takes to open, the demo is 4.4 s in: settled, and no lane changes state before 6 s
const FILM = { frames: 12, stepMs: 1000 / 24 };
// one full cycle per state: a 3.4 s breath, a trot stride at 1.4 per second, a gallop stride at 2.25 per second
const CYCLE_MS = { rest: 3400, work: 1000 / 1.4, sprint: 1000 / 2.25 };

const browser = await chromium.launch();
const made = [];
const loose = []; let frames = 0;   // connection check: every close-up frame should show the horse as one connected piece
const img = (b, w, h, label) => `<div style="position:relative"><img style="display:block;width:${w}px;height:${h}px" src="data:image/png;base64,${b}"><span style="position:absolute;left:6px;top:4px;font:12px monospace;color:#888">${label}</span></div>`;

try {
  for (const look of LOOKS) {
    for (const s of SCREENS) {
      const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      const errors = [];
      const open = async (extra = '') => {
        const page = await ctx.newPage();
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.clock.install({ time: new Date('2026-11-13T12:00:00Z') });
        await page.goto(`${page0}?${s.q}&style=${look}&qa=1${extra}`);
        // stop the clock: from here time moves only when the script runs it, so frame spacing is exact
        await page.clock.pauseAt(new Date('2026-11-13T12:00:02Z'));
        return page;
      };
      // a 1:1 close-up of one horse: the lane around it, from above the ears to just under the ground line
      const crop = async (page, lane, tag = 'still') => {
        const d = await page.evaluate(() => window.__derby());
        const h = d.horses[lane], S = d.S;
        if (h.parts > 1) loose.push(`${look}-${s.name} ${tag} lane ${lane + 1}: silhouette in ${h.parts} pieces`);
        frames++;
        const clip = { x: Math.round(h.x - 2.3 * S), y: Math.round(h.y - 2.35 * S), width: Math.round(4.6 * S), height: Math.round(2.55 * S) };
        clip.x = Math.max(0, Math.min(s.w - clip.width, clip.x)); clip.y = Math.max(0, Math.min(s.h - clip.height, clip.y));
        return { b: (await page.screenshot({ clip })).toString('base64'), w: clip.width, h: clip.height };
      };
      const sheet = async (name, cells, cols) => {
        const p = await ctx.newPage();
        const w = cells[0].w, h = cells[0].h;
        await p.setViewportSize({ width: w * cols, height: h * Math.ceil(cells.length / cols) });
        await p.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${w}px)">${cells.map(c => img(c.b, w, h, c.label)).join('')}</body>`);
        const f = resolve(out, name);
        await p.screenshot({ path: f, fullPage: true });
        await p.close();
        made.push(f);
      };

      // the whole screen: a still, 1:1 crops of every horse, and a short film
      const page = await open();
      await page.clock.runFor(SETTLE_MS);
      const still = resolve(out, `${look}-${s.name}.png`);
      await page.screenshot({ path: still });
      made.push(still);
      const lanes = (await page.evaluate(() => window.__derby())).horses.length;
      const crops = [];
      for (let i = 0; i < lanes; i++) crops.push({ ...(await crop(page, i)), label: `lane ${i + 1}` });
      await sheet(`${look}-${s.name}-crops.png`, crops, s.name === 'wide' ? 3 : 2);

      const shots = [];
      for (let i = 0; i < FILM.frames; i++) {
        shots.push((await page.screenshot({ type: 'jpeg', quality: 85 })).toString('base64'));
        await page.clock.runFor(FILM.stepMs);
      }
      const cols = 3, tw = Math.round(Math.min(1700, s.w) / cols), th = Math.round(tw * s.h / s.w);
      const film = await ctx.newPage();
      await film.setViewportSize({ width: tw * cols, height: th * Math.ceil(FILM.frames / cols) });
      await film.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${tw}px)">${
        shots.map((b, i) => `<div style="position:relative"><img style="display:block;width:${tw}px;height:${th}px" src="data:image/jpeg;base64,${b}"><span style="position:absolute;left:6px;top:4px;font:12px monospace;color:#888">${i + 1}</span></div>`).join('')}</body>`);
      const filmFile = resolve(out, `${look}-${s.name}-film.png`);
      await film.screenshot({ path: filmFile, fullPage: true });
      await film.close();
      made.push(filmFile);
      await page.close();

      // one gait cycle per state, one horse at 1:1
      for (const state of ['rest', 'work', 'sprint']) {
        const p = await open(`&state=${state}`);
        await p.clock.runFor(SETTLE_MS);
        const cells = [];
        for (let i = 0; i < FILM.frames; i++) {
          cells.push({ ...(await crop(p, 1, `${state} ${i + 1}/12`)), label: `${state} ${i + 1}/12` });
          await p.clock.runFor(CYCLE_MS[state] / FILM.frames);
        }
        await sheet(`${look}-${s.name}-${state}-film.png`, cells, s.name === 'wide' ? 4 : 3);
        await p.close();
      }

      // changes of state: done > working > full sprint > done, 12 frames over 1.5 s after each change
      {
        const p = await open('&state=rest');
        await p.clock.runFor(SETTLE_MS);
        const cells = [];
        for (const [key, name] of [['w', 'done to working'], ['s', 'working to sprint'], ['r', 'sprint to done']]) {
          await p.keyboard.press('2'); await p.keyboard.press(key);
          for (let i = 0; i < FILM.frames; i++) {
            await p.clock.runFor(125);
            cells.push({ ...(await crop(p, 1, `${name} ${((i + 1) / 8).toFixed(2)}s`)), label: `${name} ${((i + 1) / 8).toFixed(2)}s` });
          }
          await p.clock.runFor(6000);   // let it settle into the new gait and place before the next change
        }
        await sheet(`${look}-${s.name}-change-film.png`, cells, s.name === 'wide' ? 4 : 3);
        await p.close();
      }

      if (errors.length) { const f = resolve(out, `${look}-${s.name}-errors.txt`); writeFileSync(f, errors.join('\n')); made.push(f); }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(made.map(p => p.replace(root + '/', '')).join('\n'));
console.log(loose.length ? `CONNECTION CHECK: ${loose.length} of ${frames} close-up frames have loose cells\n` + loose.join('\n') : `CONNECTION CHECK: all ${frames} close-up frames are one connected piece`);
