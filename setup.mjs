#!/usr/bin/env node
// Adds (or removes) the Agent Derby hooks in Claude Code and Cursor, and the read-only
// Agent Derby server in the Claude app (so the claude.ai page can show your Mac agents).
//   node setup.mjs            add all three
//   node setup.mjs claude     Claude Code only
//   node setup.mjs cursor     Cursor only
//   node setup.mjs desktop    Claude app only
//   node setup.mjs remove     take every Agent Derby entry out again
// It backs up each file first, keeps everything already in it, and only prints what it changed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(DIR, 'hook.sh');
const MARK = 'agent-derby';
const args = process.argv.slice(2).map(a => a.toLowerCase());
const removing = args.includes('remove');
const only = args.find(a => a === 'claude' || a === 'cursor' || a === 'desktop');

for (const f of ['hook.sh', 'derby-run.sh', 'derby-mcp.mjs', 'xcode-build-failed.sh', 'xcode-build-succeeded.sh']) {
  try { fs.chmodSync(path.join(DIR, f), 0o755); } catch { /* fine */ }
}
if (!HOOK.includes(MARK)) {
  console.log(`Keep this folder named "${MARK}" so the hooks can be found and removed later. Stopping.`);
  process.exit(1);
}

function load(file, fallback) {
  if (!fs.existsSync(file)) return { data: fallback, existed: false };
  const text = fs.readFileSync(file, 'utf8');
  try { return { data: text.trim() ? JSON.parse(text) : fallback, existed: true }; }
  catch { console.log(`${file} isn't valid JSON, so I left it alone. Fix it and run again.`); process.exit(1); }
}
function save(file, data, existed) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (existed) fs.copyFileSync(file, `${file}.derby-backup-${Date.now()}`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
const ours = cmd => typeof cmd === 'string' && cmd.includes(MARK) && cmd.includes('hook.sh');

function claude() {
  const file = path.join(os.homedir(), '.claude', 'settings.json');
  const { data, existed } = load(file, {});
  data.hooks = data.hooks || {};
  const events = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
  let changed = 0;
  for (const ev of Object.keys(data.hooks)) {
    const groups = data.hooks[ev];
    if (!Array.isArray(groups)) continue;
    const before = JSON.stringify(groups);
    data.hooks[ev] = groups.map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !ours(h.command)) })).filter(g => g.hooks.length);
    if (JSON.stringify(data.hooks[ev]) !== before) changed++;
    if (!data.hooks[ev].length) delete data.hooks[ev];
  }
  if (!removing) {
    for (const ev of events) {
      (data.hooks[ev] = data.hooks[ev] || []).push({ hooks: [{ type: 'command', command: `"${HOOK}" claude`, timeout: 5 }] });
    }
  }
  save(file, data, existed);
  console.log(removing ? `Claude Code: removed Agent Derby hooks (${changed} events touched).` : `Claude Code: hooks on ${events.join(', ')}. Restart open Claude Code sessions to pick them up.`);
}

function cursor() {
  const file = path.join(os.homedir(), '.cursor', 'hooks.json');
  const { data, existed } = load(file, { version: 1, hooks: {} });
  data.version = data.version || 1;
  data.hooks = data.hooks || {};
  for (const ev of Object.keys(data.hooks)) {
    if (!Array.isArray(data.hooks[ev])) continue;
    data.hooks[ev] = data.hooks[ev].filter(h => !ours(h.command));
    if (!data.hooks[ev].length) delete data.hooks[ev];
  }
  const events = { beforeSubmitPrompt: 'prompt', postToolUse: 'json', afterFileEdit: 'json', afterShellExecution: 'json', stop: 'json', sessionEnd: 'json' };
  if (!removing) {
    for (const [ev, mode] of Object.entries(events)) {
      (data.hooks[ev] = data.hooks[ev] || []).push({ command: `"${HOOK}" cursor ${mode}`, timeout: 5 });
    }
  }
  save(file, data, existed);
  console.log(removing ? 'Cursor: removed Agent Derby hooks.' : `Cursor: hooks on ${Object.keys(events).join(', ')}. Restart Cursor to pick them up.`);
}

function desktop() {
  if (process.platform !== 'darwin') { console.log('Claude app: skipped (macOS only).'); return; }
  const file = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  const { data, existed } = load(file, {});
  data.mcpServers = data.mcpServers && typeof data.mcpServers === 'object' ? data.mcpServers : {};
  delete data.mcpServers[MARK];
  if (!removing) data.mcpServers[MARK] = { command: process.execPath, args: [path.join(DIR, 'derby-mcp.mjs')] };
  save(file, data, existed);
  console.log(removing ? 'Claude app: removed the Agent Derby server.' : 'Claude app: added the read-only Agent Derby server. Quit and reopen the Claude app to pick it up.');
}

if (!only || only === 'claude') claude();
if (!only || only === 'cursor') cursor();
if (!only || only === 'desktop') desktop();
