#!/usr/bin/env python3
"""Builds Agent Derby.app (unsigned test build) on any OS.

  python3 build.py --repo ../agent-derby --node-dir /path/with/ex-arm64,ex-x64 --version 0.1.0 [--arch arm64,x64]

The bundle: a bash launcher as the main executable, a JavaScript-for-Automation menu bar script,
the race files from the repo, and Node (unchanged official builds, so their own signatures stay valid).
"""
import argparse, os, plistlib, shutil, stat, time, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
APP_FILES = ['bridge.mjs', 'index.html', 'phone.html', 'phone.webmanifest', 'phone-icon-180.png', 'phone-icon-512.png',
             'hook.sh', 'setup.mjs', 'derby-mcp.mjs', 'derby-run.sh', 'xcode-build-failed.sh', 'xcode-build-succeeded.sh',
             'derby.config.example.json', 'LICENSE']
EXEC = {'hook.sh', 'setup.mjs', 'derby-mcp.mjs', 'derby-run.sh', 'xcode-build-failed.sh', 'xcode-build-succeeded.sh', 'bridge.mjs'}


def chmod_x(p):
    os.chmod(p, os.stat(p).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def build(repo, node_dir, version, arches, out):
    app = os.path.join(out, 'Agent Derby.app')
    if os.path.exists(app):
        shutil.rmtree(app)
    c = os.path.join(app, 'Contents')
    for d in ['MacOS', 'Resources/app', 'Resources/node']:
        os.makedirs(os.path.join(c, d))

    info = {
        'CFBundleName': 'Agent Derby',
        'CFBundleDisplayName': 'Agent Derby',
        'CFBundleIdentifier': 'com.agentderby.app',
        'CFBundleExecutable': 'Agent Derby',
        'CFBundleIconFile': 'AppIcon',
        'CFBundlePackageType': 'APPL',
        'CFBundleSignature': '????',
        'CFBundleShortVersionString': version,
        'CFBundleVersion': version,
        'CFBundleInfoDictionaryVersion': '6.0',
        'CFBundleDevelopmentRegion': 'en',
        'LSMinimumSystemVersion': '13.5',
        'LSUIElement': True,
        'LSApplicationCategoryType': 'public.app-category.developer-tools',
        'NSHighResolutionCapable': True,
        'NSHumanReadableCopyright': 'MIT License. Includes Node.js (MIT).',
    }
    with open(os.path.join(c, 'Info.plist'), 'wb') as f:
        plistlib.dump(info, f)
    with open(os.path.join(c, 'PkgInfo'), 'w') as f:
        f.write('APPL????')

    exe = os.path.join(c, 'MacOS', 'Agent Derby')
    shutil.copy(os.path.join(SRC, 'launcher.sh'), exe)
    chmod_x(exe)
    res = os.path.join(c, 'Resources')
    for f in ['menu.js', 'derbyctl.sh', 'AppIcon.icns', 'MenuIcon.png', 'MenuIcon@2x.png']:
        shutil.copy(os.path.join(SRC, f), os.path.join(res, f))
    chmod_x(os.path.join(res, 'derbyctl.sh'))

    for f in APP_FILES:
        dst = os.path.join(res, 'app', f)
        shutil.copy(os.path.join(repo, f), dst)
        if f in EXEC:
            chmod_x(dst)
    with open(os.path.join(res, 'app', 'APP-VERSION'), 'w') as f:
        f.write(version + '\n')

    for a in arches:
        src = [os.path.join(node_dir, f'ex-{a}', d) for d in os.listdir(os.path.join(node_dir, f'ex-{a}'))][0]
        os.makedirs(os.path.join(res, 'node', a))
        shutil.copy2(os.path.join(src, 'bin', 'node'), os.path.join(res, 'node', a, 'node'))
        chmod_x(os.path.join(res, 'node', a, 'node'))
        shutil.copy(os.path.join(src, 'LICENSE'), os.path.join(res, 'node', 'NODE-LICENSE'))
    return app


def zip_app(app, zpath):
    """Zip like Finder does: keeps the folder name and the executable bits."""
    base = os.path.dirname(app)
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for root, dirs, files in os.walk(app):
            dirs.sort()
            rel_root = os.path.relpath(root, base)
            zi = zipfile.ZipInfo(rel_root + '/', date_time=time.localtime(os.stat(root).st_mtime)[:6])
            zi.external_attr = (0o40755 << 16) | 0x10
            zi.create_system = 3
            z.writestr(zi, '')
            for fn in sorted(files):
                p = os.path.join(root, fn)
                zi = zipfile.ZipInfo.from_file(p, os.path.relpath(p, base))
                zi.create_system = 3
                mode = 0o755 if os.access(p, os.X_OK) else 0o644
                zi.external_attr = ((0o100000 | mode) << 16)
                zi.compress_type = zipfile.ZIP_DEFLATED
                with open(p, 'rb') as fh:
                    z.writestr(zi, fh.read(), compresslevel=9)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--node-dir', required=True)
    ap.add_argument('--version', default='0.1.0')
    ap.add_argument('--arch', default='arm64,x64')
    ap.add_argument('--out', default=os.path.join(HERE, 'dist'))
    ap.add_argument('--zip', default='')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    app = build(a.repo, a.node_dir, a.version, a.arch.split(','), a.out)
    print('built', app)
    if a.zip:
        zip_app(app, a.zip)
        print('zipped', a.zip, os.path.getsize(a.zip) // (1 << 20), 'MB')
