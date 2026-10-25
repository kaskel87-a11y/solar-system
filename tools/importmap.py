#!/usr/bin/env python3
"""Single-version module loading (v7.5.2).
Source files import each other with plain relative paths ('./world.js', no ?v=).
index.html's import map remaps every first-party module URL (and an 'ssx/<path>' alias)
to '<path>.js?v=<VERSION>', so each module loads exactly once per release.
Usage: python3 tools/importmap.py [VERSION]   (rewrites stray ?v= imports and regenerates the map)"""
import os, re, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'tests', 'tools', 'vendor', 'shots', '.git', 'node_modules', 'textures', 'icons', 'data'}
idx = open(os.path.join(ROOT, 'index.html')).read()
V = sys.argv[1] if len(sys.argv) > 1 else re.search(r"sw\.js\?v=([0-9.]+)", idx).group(1)
mods = []
for d, ds, fs in os.walk(ROOT):
    ds[:] = sorted(x for x in ds if x not in SKIP)
    for f in sorted(fs):
        if f.endswith('.js') and f != 'sw.js':
            mods.append(os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/'))
# 1) strip ?v= from relative import specifiers (static, dynamic, export-from)
spec = re.compile(r"""((?:\bfrom|\bimport)\s*\(?\s*)(['"])(\.{1,2}/[^'"?]+?\.js)\?v=[0-9.]+\2""")
changed = []
for m in mods + ['index.html']:
    p = os.path.join(ROOT, m); s = open(p).read(); t = spec.sub(lambda g: g.group(1) + g.group(2) + g.group(3) + g.group(2), s)
    if t != s: open(p, 'w').write(t); changed.append(m)
# 2) regenerate the import map
imap = {"three": "./vendor/three/build/three.module.min.js", "three/addons/": "./vendor/three/addons/"}
for m in mods:
    url = f"./{m}?v={V}"; imap[f"./{m}"] = url; imap["ssx/" + m[:-3]] = url
block = '<script type="importmap">\n' + json.dumps({"imports": imap}, indent=1) + '\n</script>'
idx = open(os.path.join(ROOT, 'index.html')).read()
idx, n = re.subn(r'<script type="importmap">.*?</script>', lambda _: block, idx, count=1, flags=re.S)
assert n == 1
# keep the versioned bits in step: module script srcs + sw registration
idx = re.sub(r'(src="\./[^"?]+\.js\?v=)[0-9.]+(")', lambda g: g.group(1) + V + g.group(2), idx)
idx = re.sub(r"(sw\.js\?v=)[0-9.]+", lambda g: g.group(1) + V, idx)
open(os.path.join(ROOT, 'index.html'), 'w').write(idx)
print(f"v={V}: {len(mods)} modules mapped; stripped ?v= in {len(changed)} files: {' '.join(changed)}")
