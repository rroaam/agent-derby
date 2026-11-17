#!/usr/bin/env node
// Agent Derby bridge: a tiny local server that the screensaver page polls.
// - Serves the page at http://127.0.0.1:4777/ and live status at /status.
// - Takes events at POST /event from Claude Code hooks, Cursor hooks, Xcode behaviors or any curl.
// - Watches for Xcode builds on its own (macOS process list).
// - Optional: reads TestFlight build status from App Store Connect (read-only GET requests) if derby.config.json has a key.
// Listens on 127.0.0.1 only, unless you turn on Wi-Fi sharing ("shareOnWifi": true in derby.config.json,
// or DERBY_SHARE=1). Then other devices on your home network can open the page and read /status,
// but only this Mac can post events. No dependencies. Node 18+.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'derby.config.json'), 'utf8')); } catch { return {}; } })();
const PORT = Number(process.env.DERBY_PORT || CONFIG.port || 4777);
const SHARE = process.env.DERBY_SHARE ? process.env.DERBY_SHARE === '1' : CONFIG.shareOnWifi === true;
const SPRINT_PER_MIN = Number(CONFIG.sprintToolCallsPerMinute || 12); // tool calls in the last minute that count as a full sprint
const KEEP_DONE_MIN = Number(CONFIG.keepDoneMinutes || 30);           // how long a finished agent keeps its lane
const STALE_MIN = Number(CONFIG.staleMinutes || 10);                  // busy with no events this long counts as done

const agents = new Map();
const base = p => (p ? path.basename(String(p)) : '');
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

function touch(id, name, task) {
  let a = agents.get(id);
  if (!a) {
    a = { id, name, task: task || '', busy: false, forced: null, hits: [], last: Date.now(), state: 'rest', since: Date.now(), note: '', pinned: false };
    agents.set(id, a);
    log('+', name, a.task);
  }
  if (task) a.task = task;
  a.last = Date.now();
  return a;
}
function remove(id) { const a = agents.get(id); if (a) { agents.delete(id); log('-', a.name, a.task); } }

/* ---------- events ---------- */
function handle(src, e) {
  const ev = String(e.hook_event_name || e.event || '');

  if (src === 'claude' && e.session_id) {
    const id = 'claude:' + e.session_id;
    if (ev === 'SessionEnd') return remove(id);
    const a = touch(id, 'Claude Code', base(e.cwd));
    if (ev === 'UserPromptSubmit' || ev === 'PreToolUse') { a.busy = true; a.note = ''; }
    else if (ev === 'PostToolUse' || ev === 'PostToolUseFailure') { a.busy = true; a.note = ''; a.hits.push(Date.now()); }
    else if (ev === 'Notification') { a.busy = false; a.note = 'waiting on you'; }
    else if (ev === 'Stop') { a.busy = false; a.note = ''; }
    return;
  }

  if (src === 'cursor' && e.conversation_id) {
    const id = 'cursor:' + e.conversation_id;
    if (ev === 'sessionEnd') return remove(id);
    const root = Array.isArray(e.workspace_roots) ? e.workspace_roots[0] : e.cwd;
    const a = touch(id, 'Cursor', base(root));
    if (ev === 'beforeSubmitPrompt') { a.busy = true; a.note = ''; }
    else if (['postToolUse', 'afterFileEdit', 'afterShellExecution', 'afterMCPExecution'].includes(ev)) { a.busy = true; a.hits.push(Date.now()); }
    else if (ev === 'stop') { a.busy = false; a.note = e.status === 'error' ? 'stopped on an error' : ''; }
    return;
  }

  // Generic: {"agent":"my-bot","name":"My Bot","task":"ops","state":"work|sprint|done|end","note":"..."}
  if (e.agent) {
    const id = e.agent === 'xcode' ? 'xcode' : 'x:' + String(e.agent).slice(0, 60);
    const s = String(e.state || '').toLowerCase();
    if (s === 'end') return remove(id);
    const a = touch(id, String(e.name || e.agent).slice(0, 28), String(e.task || '').slice(0, 40));
    if (e.name) a.name = String(e.name).slice(0, 28);
    a.forced = s === 'sprint' || s === 'work' ? s : 'rest';
    a.note = e.note ? String(e.note).slice(0, 24) : '';
  }
}

function compute(a, now) {
  a.hits = a.hits.filter(t => now - t < 60000);
  let s;
  if (a.forced) {
    s = a.forced;
    if (s !== 'rest' && now - a.last > STALE_MIN * 60000) { a.forced = 'rest'; s = 'rest'; }
  } else if (a.busy && now - a.last > STALE_MIN * 60000) { a.busy = false; s = 'rest'; }
  else if (!a.busy) s = 'rest';
  else {
    const n = a.hits.length;
    s = a.state === 'sprint' ? (n >= SPRINT_PER_MIN * 0.6 ? 'sprint' : 'work') : (n >= SPRINT_PER_MIN ? 'sprint' : 'work');
  }
  if (s !== a.state) { a.state = s; a.since = now; log('~', a.name, a.task, '→', s); }
}
function snapshot() {
  const now = Date.now();
  for (const a of agents.values()) {
    compute(a, now);
    if (!a.pinned && a.state === 'rest' && now - a.last > KEEP_DONE_MIN * 60000) remove(a.id);
  }
  const rank = { sprint: 0, work: 1, rest: 2 };
  const list = [...agents.values()].sort((x, y) => rank[x.state] - rank[y.state] || y.last - x.last)
    .map(a => ({ id: a.id, name: a.name, task: a.task, state: a.state, since: a.since, note: a.note, rate: a.hits.length, last: a.last }));
  return { now, agents: list };
}

/* ---------- Xcode: watch the process list (macOS) ---------- */
const BUILD_PROCS = new Set(['xcodebuild', 'swift-frontend', 'swift-driver', 'clang', 'clang++', 'ld', 'ibtool', 'actool', 'swiftc']);
let xcodeQuietSince = 0;
function watchXcode() {
  if (process.platform !== 'darwin' || CONFIG.xcode === false) return;
  execFile('ps', ['-axo', 'comm='], { maxBuffer: 4 << 20 }, (err, out) => {
    setTimeout(watchXcode, 3000);
    if (err) return;
    const names = out.split('\n').map(l => path.basename(l.trim()));
    const xcodeOpen = names.includes('Xcode');
    const compiles = names.filter(n => BUILD_PROCS.has(n)).length;
    const cli = names.includes('xcodebuild');
    const id = 'xcode';
    const a = agents.get(id);
    if (!xcodeOpen && !cli && !a) return;
    const x = a || touch(id, 'Xcode', 'builds');
    x.pinned = xcodeOpen;
    if (compiles > 0 && (xcodeOpen || cli)) {
      x.last = Date.now(); xcodeQuietSince = 0;
      x.forced = compiles >= 3 ? 'sprint' : 'work';
      if (x.note === 'build failed' || x.note === 'build succeeded') x.note = '';
    } else if (x.forced && x.forced !== 'rest') {
      if (!xcodeQuietSince) xcodeQuietSince = Date.now();
      if (Date.now() - xcodeQuietSince > 6000) { x.forced = 'rest'; if (!x.note) x.note = 'build finished'; }
    } else if (!x.forced) x.forced = 'rest';
  });
}

/* ---------- Watched processes (bots, scripts, anything else on this Mac) ----------
   Each entry becomes one horse. It trots while matching processes use some CPU, gallops when they use a lot,
   and stands when they go quiet. Nothing is watched until you add a "watch" entry. */
const WATCH = (Array.isArray(CONFIG.watch) ? CONFIG.watch : [])
  .filter(w => w && w.match).map(w => ({ agent: String(w.agent || w.match), name: String(w.name || w.match).slice(0, 28), task: String(w.task || '').slice(0, 40),
    match: String(w.match).toLowerCase(), workCpu: Number(w.workCpu ?? 3), sprintCpu: Number(w.sprintCpu ?? 40), quiet: 0 }));
function watchProcesses() {
  if (!WATCH.length || process.platform === 'win32') return;
  execFile('ps', ['-axo', 'pid=,pcpu=,args='], { maxBuffer: 8 << 20 }, (err, out) => {
    setTimeout(watchProcesses, 3000);
    if (err) return;
    const rows = out.split('\n').map(l => l.trim().match(/^(\d+)\s+([\d.]+)\s+(.*)$/)).filter(Boolean)
      .filter(m => Number(m[1]) !== process.pid && !/agent-derby|\bgrep\b|\bps -axo\b/i.test(m[3]));
    for (const w of WATCH) {
      const hits = rows.filter(m => m[3].toLowerCase().includes(w.match));
      const id = 'watch:' + w.agent;
      const a = agents.get(id);
      if (!hits.length) { if (a) { a.pinned = false; if (a.forced !== 'rest') { a.forced = 'rest'; a.note = 'not running'; } } continue; }
      const cpu = hits.reduce((s, m) => s + Number(m[2]), 0);
      const x = a || touch(id, w.name, w.task);
      x.pinned = true; x.note = ''; x.last = Date.now();
      if (cpu >= w.sprintCpu) { x.forced = 'sprint'; w.quiet = 0; }
      else if (cpu >= w.workCpu) { x.forced = 'work'; w.quiet = 0; }
      else { if (!w.quiet) w.quiet = Date.now(); if (Date.now() - w.quiet > 8000 || !x.forced) x.forced = 'rest'; }
    }
  });
}

/* ---------- TestFlight: App Store Connect, read-only ---------- */
const TF = CONFIG.testflight || null;
let tfAppId = null;
const b64u = b => Buffer.from(b).toString('base64url');
function ascToken() {
  const key = fs.readFileSync(TF.keyPath.replace(/^~(?=$|\/)/, process.env.HOME || ''), 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: TF.keyId, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: TF.issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}
async function asc(pathAndQuery) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + pathAndQuery, { headers: { Authorization: 'Bearer ' + ascToken() } });
  if (!r.ok) throw new Error('App Store Connect said ' + r.status);
  return r.json();
}
async function watchTestFlight() {
  if (!TF || !TF.issuerId || !TF.keyId || !TF.keyPath || !TF.bundleId) return;
  try {
    if (!tfAppId) {
      const apps = await asc(`/v1/apps?filter[bundleId]=${encodeURIComponent(TF.bundleId)}&fields[apps]=bundleId&limit=1`);
      tfAppId = apps.data && apps.data[0] && apps.data[0].id;
      if (!tfAppId) throw new Error('no app found for ' + TF.bundleId);
    }
    const res = await asc(`/v1/builds?filter[app]=${tfAppId}&sort=-uploadedDate&limit=1&include=buildBetaDetail` +
      `&fields[builds]=version,processingState,uploadedDate,buildBetaDetail&fields[buildBetaDetails]=internalBuildState,externalBuildState`);
    const b = res.data && res.data[0];
    const a = touch('testflight', 'TestFlight', TF.label || TF.bundleId);
    a.pinned = true;
    if (!b) { a.forced = 'rest'; a.note = 'no builds yet'; }
    else {
      const detail = (res.included || []).find(i => i.type === 'buildBetaDetails');
      const p = b.attributes.processingState, ext = detail && detail.attributes.externalBuildState, int = detail && detail.attributes.internalBuildState;
      a.task = `${TF.label || 'build'} ${b.attributes.version || ''}`.trim();
      if (p === 'PROCESSING') { a.forced = 'sprint'; a.note = ''; }
      else if (p === 'FAILED' || p === 'INVALID') { a.forced = 'rest'; a.note = 'processing failed'; }
      else if (ext === 'IN_BETA_REVIEW' || ext === 'WAITING_FOR_BETA_REVIEW') { a.forced = 'work'; a.note = ''; }
      else { a.forced = 'rest'; a.note = (int === 'IN_BETA_TESTING' || int === 'READY_FOR_BETA_TESTING') ? 'ready to test' : ''; }
    }
  } catch (err) { log('TestFlight check failed:', err.message); }
  setTimeout(watchTestFlight, Number(TF.everySeconds || 120) * 1000);
}

/* ---------- server ---------- */
const ip = a => String(a || '').replace(/^::ffff:/, '');
const isLocal = a => /^(127\.|::1$)/.test(ip(a));
// Home-network addresses only: 10.x, 172.16-31.x, 192.168.x, link-local, and IPv6 local ranges.
const isHome = a => isLocal(a) || /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip(a));
// agent-derby phone history: every 20 s, note each agent's tool calls in that window and its state; keeps 15 minutes, in memory only
const PHONE_HIST = new Map();
setInterval(() => {
  snapshot();
  const now = Date.now();
  for (const a of agents.values()) {
    let h = PHONE_HIST.get(a.id); if (!h) PHONE_HIST.set(a.id, h = []);
    h.push([now, a.hits.filter(t => now - t < 20000).length, a.state]);
    if (h.length > 45) h.shift();
  }
  for (const id of PHONE_HIST.keys()) if (!agents.has(id)) PHONE_HIST.delete(id);
}, 20000).unref();
// end agent-derby phone history
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const from = req.socket.remoteAddress;
  if (!isHome(from)) { res.writeHead(403); return res.end(); }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    fs.readFile(path.join(DIR, 'index.html'), (err, buf) => {
      if (err) { res.writeHead(500); return res.end('index.html is missing next to bridge.mjs'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(buf);
    });
    return;
  }
  // agent-derby phone routes: the portrait page for phones, its home-screen manifest and icons, and recent activity
  const PHONE = { '/phone': ['phone.html', 'text/html; charset=utf-8'], '/phone.html': ['phone.html', 'text/html; charset=utf-8'],
    '/phone.webmanifest': ['phone.webmanifest', 'application/manifest+json'],
    '/phone-icon-180.png': ['phone-icon-180.png', 'image/png'], '/phone-icon-512.png': ['phone-icon-512.png', 'image/png'] };
  if (req.method === 'GET' && PHONE[url.pathname]) {
    const [file, type] = PHONE[url.pathname];
    fs.readFile(path.join(DIR, file), (err, buf) => {
      if (err) { res.writeHead(404); return res.end(file + ' is missing next to bridge.mjs'); }
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': type.startsWith('image') ? 'max-age=86400' : 'no-store' }); res.end(buf);
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/phone-history') {
    const id = url.searchParams.get('id');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(id ? (PHONE_HIST.get(id) || []) : Object.fromEntries(PHONE_HIST)));
  }
  if (req.method === 'GET' && url.pathname === '/config') {
    // only the page's look (the "page" section), never keys or paths
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(CONFIG.page || {}));
  }
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(snapshot()));
  }
  if (req.method === 'POST' && url.pathname === '/event') {
    // The custom header keeps web pages from posting here: browsers can't send it without a preflight we never answer.
    if (req.headers['x-derby'] !== '1' || !isLocal(from)) { res.writeHead(403); return res.end(); }
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size <= 32 << 20) chunks.push(c); });
    req.on('end', () => {
      try { handle(url.searchParams.get('src') || 'generic', JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { /* ignore bad input */ }
      res.writeHead(204); res.end();
    });
    return;
  }
  res.writeHead(404); res.end();
});
server.listen(PORT, SHARE ? '0.0.0.0' : '127.0.0.1', () => {
  log(`Agent Derby is running: open http://127.0.0.1:${PORT}/`);
  if (SHARE) {
    const name = os.hostname().replace(/\.local$/i, '');
    log(`Wi-Fi sharing is on: other devices on your home network can open http://${name}.local:${PORT}/`);
    log('They can see agent names, project folder names and states. Only this Mac can send events.');
  }
  watchXcode();
  watchProcesses();
  if (WATCH.length) log('Watching processes for:', WATCH.map(w => `${w.name} ("${w.match}")`).join(', '));
  if (TF) watchTestFlight(); else log('TestFlight: off (no testflight section in derby.config.json)');
});
