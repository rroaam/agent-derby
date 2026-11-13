#!/usr/bin/env node
// A tiny local MCP server for the Claude app, so the Agent Derby page on claude.ai can
// show the agents your Mac bridge sees. It has one read-only tool, get_status, which
// reads http://127.0.0.1:4777/status and returns it. It changes nothing.
// The Claude app starts it for you once setup.mjs has added it (node setup.mjs desktop).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
let PORT = 4777;
try { PORT = Number(JSON.parse(fs.readFileSync(path.join(DIR, 'derby.config.json'), 'utf8')).port) || 4777; } catch { /* default */ }
if (process.env.DERBY_PORT) PORT = Number(process.env.DERBY_PORT) || PORT;

const TOOL = {
  name: 'get_status',
  title: 'Agent Derby status',
  description: 'Read which agents on this Mac are working, busy or done, from the local Agent Derby bridge. Read-only.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const send = msg => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function status() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2000);
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/status`, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('bridge answered ' + r.status);
    const j = await r.json();
    return { content: [{ type: 'text', text: JSON.stringify(j) }], structuredContent: j };
  } catch {
    return { content: [{ type: 'text', text: 'The Agent Derby bridge is not running. Start it with: node ~/agent-derby/bridge.mjs' }], isError: true };
  } finally { clearTimeout(t); }
}

async function handle(m) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return;
  const has = Object.prototype.hasOwnProperty.call(m, 'id');
  switch (m.method) {
    case 'initialize':
      return reply(m.id, {
        protocolVersion: (m.params && m.params.protocolVersion) || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'agent-derby', version: '1.0.0' },
      });
    case 'ping': return reply(m.id, {});
    case 'tools/list': return reply(m.id, { tools: [TOOL] });
    case 'tools/call':
      if (!m.params || m.params.name !== TOOL.name) return fail(m.id, -32602, 'Unknown tool');
      return reply(m.id, await status());
    default:
      if (has) fail(m.id, -32601, 'Method not found'); // notifications get no answer
  }
}

let buf = '';
const pending = new Set();
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  if (buf.length > 1 << 20) buf = '';
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    const job = Promise.resolve(handle(m)).catch(() => {});
    pending.add(job); job.finally(() => pending.delete(job));
  }
});
process.stdin.on('end', () => { Promise.allSettled([...pending]).then(() => process.exit(0)); });
