// Agent Derby menu bar icon (JavaScript for Automation, runs with /usr/bin/osascript -l JavaScript).
// The launcher starts the race server and passes everything this needs in environment variables.
ObjC.import('Cocoa');

const ENV = ObjC.deepUnwrap($.NSProcessInfo.processInfo.environment) || {};
const PORT = ENV.DERBY_PORT || '4777';
const RES = ENV.DERBY_RES || '';
const APP_PATH = ENV.DERBY_APP || '';
const SUPPORT = ENV.DERBY_SUPPORT || '';
const NODE = ENV.DERBY_NODE || '';
const BASE = 'http://127.0.0.1:' + PORT + '/';

const app = $.NSApplication.sharedApplication;
app.setActivationPolicy(1); // accessory: menu bar only, no Dock icon

function run(args) {
  try {
    const t = $.NSTask.alloc.init;
    t.setLaunchPath('/bin/bash');
    t.setArguments($(args));
    const pipe = $.NSPipe.pipe;
    t.setStandardOutput(pipe);
    t.setStandardError($.NSFileHandle.fileHandleWithNullDevice);
    t.launch;
    const data = pipe.fileHandleForReading.readDataToEndOfFile;
    t.waitUntilExit;
    const s = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, 4));
    return (s || '').trim();
  } catch (e) {
    return '';
  }
}
const ctl = (...a) => run([RES + '/derbyctl.sh', ...a]);

function openURL(u) {
  $.NSWorkspace.sharedWorkspace.openURL($.NSURL.URLWithString(u));
}

function appIcon() {
  const img = $.NSImage.alloc.initWithContentsOfFile(RES + '/AppIcon.icns');
  return img;
}

function say(title, text, buttons) {
  app.activateIgnoringOtherApps(true);
  const a = $.NSAlert.alloc.init;
  a.setMessageText(title);
  a.setInformativeText(text);
  const icon = appIcon();
  if (icon && !icon.isNil()) a.setIcon(icon);
  (buttons || ['OK']).forEach(b => a.addButtonWithTitle(b));
  return Number(a.runModal) - 1000; // 0 = first button
}

const GAIT = { sprint: 'galloping', work: 'trotting', rest: 'resting' };
function readStatus() {
  const out = ctl('agents', PORT);
  if (!out || out === 'none') return null;
  try { return JSON.parse(out); } catch (e) { return null; }
}

let handler, menu, statusItem;

function item(title, action, key) {
  const mi = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(title, action || null, key || '');
  if (action) mi.setTarget(handler); else mi.setEnabled(false);
  menu.addItem(mi);
  return mi;
}

function build() {
  menu.removeAllItems;
  const st = readStatus();
  if (!st) {
    item("Race server isn't answering");
  } else {
    const list = Array.isArray(st.agents) ? st.agents : [];
    const running = list.filter(a => a.state === 'sprint' || a.state === 'work').length;
    if (!list.length) item('No horses yet. Start Claude Code or Cursor.');
    else item([running && running + ' running', list.length - running && (list.length - running) + ' resting'].filter(Boolean).join(' · '));
    list.slice(0, 8).forEach(a => {
      const bits = [a.name, a.task, a.note || GAIT[a.state] || a.state].filter(Boolean);
      item('    ' + bits.join(' · '));
    });
    if (list.length > 8) item('    and ' + (list.length - 8) + ' more');
  }
  menu.addItem($.NSMenuItem.separatorItem);
  item('Open Race', 'openRace:', 'r');
  item('Open Phone View', 'openPhone:', '');
  menu.addItem($.NSMenuItem.separatorItem);
  const login = item('Open at Login', 'toggleLogin:', '');
  login.setState(ctl('login', 'status') === 'on' ? 1 : 0);
  item('Connect Agents Again', 'setupAgents:', '');
  menu.addItem($.NSMenuItem.separatorItem);
  item('Quit Agent Derby', 'quit:', 'q');
}

const safe = fn => function (x) { try { fn(x); } catch (e) { console.log('Menu error: ' + e); } };

ObjC.registerSubclass({
  name: 'AgentDerbyHandler',
  superclass: 'NSObject',
  protocols: ['NSMenuDelegate'],
  methods: {
    'menuNeedsUpdate:': { types: ['void', ['id']], implementation: safe(function (m) { build(); }) },
    'openRace:': { types: ['void', ['id']], implementation: safe(function (s) { openURL(BASE); }) },
    'openPhone:': { types: ['void', ['id']], implementation: safe(function (s) { openURL(BASE + 'phone'); }) },
    'toggleLogin:': {
      types: ['void', ['id']],
      implementation: safe(function (s) {
        if (ctl('login', 'status') === 'on') ctl('login', 'off');
        else ctl('login', 'on', APP_PATH);
      }),
    },
    'setupAgents:': {
      types: ['void', ['id']],
      implementation: safe(function (s) {
        const r = ctl('setup', NODE);
        if (r === 'ok') say('Agents connected', 'Claude Code and Cursor are hooked up. Restart any open Claude Code sessions and Cursor so their horses show up.');
        else say("Couldn't connect your agents", 'Details are in setup.log in ~/Library/Application Support/agent-derby.');
      }),
    },
    'quit:': { types: ['void', ['id']], implementation: safe(function (s) { app.terminate(null); }) },
    'afterLaunch:': {
      types: ['void', ['id']],
      implementation: safe(function (timer) {
        if (ENV.DERBY_FIRST_RUN === '1') {
          const ok = ENV.DERBY_SETUP !== 'failed';
          const text = ok
            ? 'Look for the horse in your menu bar. Claude Code and Cursor are hooked up, so restart any open sessions and their horses will show up.\n\nAgent Derby also opens when you log in. You can turn that off in the menu.'
            : "It couldn't hook up your agents. Try Connect Agents Again in the menu. Details are in setup.log in ~/Library/Application Support/agent-derby.";
          const pick = say('Agent Derby is running', text, ['Open the Race', 'Later']);
          if (pick === 0) openURL(BASE);
        } else if (ENV.DERBY_OPEN_RACE === '1') {
          openURL(BASE);
        }
      }),
    },
  },
});

handler = $.AgentDerbyHandler.alloc.init;
menu = $.NSMenu.alloc.initWithTitle('Agent Derby');
menu.setAutoenablesItems(false);
menu.setDelegate(handler);
build();

statusItem = $.NSStatusBar.systemStatusBar.statusItemWithLength(-1);
try {
  const icon = $.NSImage.alloc.initWithContentsOfFile(RES + '/MenuIcon@2x.png');
  icon.setSize($.NSMakeSize(27, 16));
  icon.setTemplate(true);
  statusItem.button.setImage(icon);
} catch (e) {
  console.log('Menu icon image failed, using text: ' + e);
  statusItem.button.setTitle('Derby');
}
statusItem.button.setToolTip('Agent Derby');
statusItem.setMenu(menu);

$.NSTimer.scheduledTimerWithTimeIntervalTargetSelectorUserInfoRepeats(0.5, handler, 'afterLaunch:', null, false);
app.run;
