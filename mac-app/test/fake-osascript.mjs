// Linux stand-in for `osascript -l JavaScript menu.js`: a tiny fake of the JXA ObjC bridge, enough to run
// menu.js end to end, click every menu item, and print what would have appeared on screen.
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const file = process.argv[process.argv.length - 1];
const out = (...a) => console.log('[menu]', ...a);
const nil = { isNil: () => true };
const obj = extra => Object.defineProperties({ isNil: () => false }, Object.getOwnPropertyDescriptors(extra));

const classes = {};
let menuItems = [];
let statusTitle = null, statusImage = null, menuObj = null;
const timers = [];

function task() {
  let path, args = [], outBuf = '';
  const t = obj({
    setLaunchPath: p => (path = p),
    setArguments: a => (args = a),
    setStandardOutput: p => (t._pipe = p),
    setStandardError: () => {},
    get launch() { const r = spawnSync(path, args, { encoding: 'utf8' }); outBuf = r.stdout || ''; t._pipe._data = outBuf; return undefined; },
    get waitUntilExit() { return undefined; },
  });
  return t;
}
function menuItem(title, action, key) {
  const mi = obj({ title, action, key, enabled: true, state: 0, target: null,
    setTarget: x => (mi.target = x), setEnabled: e => (mi.enabled = e), setState: s => (mi.state = s) });
  return mi;
}
const alerts = [];
const $ = new Proxy(function (v) { return v; }, {
  get(_, name) {
    switch (name) {
      case 'NSProcessInfo': return { processInfo: { environment: process.env } };
      case 'NSApplication': return { sharedApplication: app };
      case 'NSTask': return { alloc: { get init() { return task(); } } };
      case 'NSPipe': return { get pipe() { const p = obj({}); p.fileHandleForReading = { get readDataToEndOfFile() { return p._data || ''; } }; return p; } };
      case 'NSFileHandle': return { fileHandleWithNullDevice: obj({}) };
      case 'NSString': return { alloc: { initWithDataEncoding: (d) => d } };
      case 'NSWorkspace': return { sharedWorkspace: { openURL: u => out('OPEN URL', u) } };
      case 'NSURL': return { URLWithString: s => s };
      case 'NSImage': return { alloc: { initWithContentsOfFile: p => fs.existsSync(p) ? obj({ path: p, setSize: () => {}, setTemplate: () => {} }) : nil } };
      case 'NSAlert': return { alloc: { get init() {
        const a = obj({ buttons: [], setMessageText: t => (a.title = t), setInformativeText: t => (a.text = t), setIcon: i => (a.icon = i),
          addButtonWithTitle: b => a.buttons.push(b), get runModal() { alerts.push(a); out('ALERT', JSON.stringify(a.title), '|', JSON.stringify(a.text), '| buttons', a.buttons.join(' / '), '| icon', a.icon ? 'yes' : 'no'); return 1000; } });
        return a; } } };
      case 'NSMenuItem': return { alloc: { initWithTitleActionKeyEquivalent: menuItem }, get separatorItem() { return menuItem('---'); } };
      case 'NSMenu': return { alloc: { initWithTitle: t => (menuObj = obj({ title: t, setAutoenablesItems: () => {}, setDelegate: d => (menuObj.delegate = d),
        addItem: i => menuItems.push(i), get removeAllItems() { menuItems = []; return undefined; } })) } };
      case 'NSStatusBar': return { systemStatusBar: { statusItemWithLength: () => obj({ button: { setImage: i => (statusImage = i), setTitle: t => (statusTitle = t), setToolTip: () => {} }, setMenu: () => {} }) } };
      case 'NSMakeSize': return (w, h) => ({ w, h });
      case 'NSTimer': return { scheduledTimerWithTimeIntervalTargetSelectorUserInfoRepeats: (s, target, sel) => timers.push([target, sel]) };
      default:
        if (classes[name]) return { alloc: { get init() { return classes[name]; } } };
        throw new Error('fake $ has no ' + String(name));
    }
  },
});
const ObjC = {
  import: () => {},
  deepUnwrap: x => ({ ...x }),
  unwrap: x => x,
  registerSubclass: def => {
    const inst = obj({ call: sel => def.methods[sel].implementation.call(inst, null) });
    classes[def.name] = inst;
  },
};
function show() {
  out('MENU:');
  for (const i of menuItems) out('   ', i.title === '---' ? '---------' : `${i.title}${i.state ? '  ✓' : ''}${i.enabled ? '' : '  (grey)'}${i.key ? '  ⌘' + i.key.toUpperCase() : ''}`);
}
const app = obj({
  setActivationPolicy: p => out('activation policy', p),
  activateIgnoringOtherApps: () => {},
  terminate: () => { out('TERMINATE'); process.exit(0); },
  get run() {
    out('status icon:', statusImage && !statusImage.isNil() ? 'horse image' : 'title ' + statusTitle);
    for (const [t, sel] of timers) t.call(sel);
    const h = menuObj.delegate;
    h.call('menuNeedsUpdate:'); show();
    const steps = (process.env.FAKE_CLICKS || 'openRace:,openPhone:,toggleLogin:,toggleLogin:,setupAgents:,quit:').split(',');
    for (const s of steps) {
      if (s === 'wait') { spawnSync('sleep', ['2']); continue; }
      if (s === 'post') {
        const r = spawnSync(process.env.DERBY_SUPPORT + '/hook.sh', ['claude'], { input: JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'test1', cwd: '/x/ownwrld' }), env: { ...process.env, DERBY_PORT: process.env.DERBY_PORT } });
        out('posted a fake Claude Code event through hook.sh, exit', r.status); continue;
      }
      const item = menuItems.find(i => i.action === s);
      if (!item || item.target !== h) throw new Error('no clickable item for ' + s);
      out('CLICK', item.title); h.call(s); h.call('menuNeedsUpdate:'); show();
    }
    return undefined;
  },
});
vm.runInNewContext(fs.readFileSync(file, 'utf8'), { $, ObjC, console, Number, JSON, Array }, { filename: file });
