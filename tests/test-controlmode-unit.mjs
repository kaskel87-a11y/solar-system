// v7.5.3 control mode unit test: default, toggle, persistence, hooks, hotkey guard, no conflicts with existing keys.
// node tests/test-controlmode-unit.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const mem = {}; globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
const C = await import('../controlmode.js?a');
assert.equal(C.getMode(), 'kbm'); assert.equal(C.kbOnly(), false); assert.equal(C.modeName(), 'Keyboard + Mouse');
let seen = []; const off = C.onMode(m => seen.push(m));
assert.equal(C.toggleMode(), 'kb'); assert.equal(mem['ssx.controlMode'], 'kb'); assert.equal(C.kbOnly(), true); assert.deepEqual(seen, ['kb']);
assert.equal(C.setMode('kb'), true); assert.deepEqual(seen, ['kb'], 'no event when unchanged');
assert.equal(C.setMode('joystick'), false); assert.equal(C.getMode(), 'kb');
assert.match(C.toastText(), /Keyboard only/); assert.match(C.toastText('kbm'), /Keyboard \+ Mouse/);
off(); C.toggleMode(); assert.deepEqual(seen, ['kb']); assert.equal(mem['ssx.controlMode'], 'kbm');
mem['ssx.controlMode'] = 'kb'; const C2 = await import('../controlmode.js?b'); assert.equal(C2.getMode(), 'kb', 'loads saved mode');
mem['ssx.controlMode'] = 'garbage'; const C3 = await import('../controlmode.js?c'); assert.equal(C3.getMode(), 'kbm', 'bad value -> default');
// hotkey guard
assert.equal(C.isToggleKey({ code: 'KeyO', target: { tagName: 'CANVAS' } }), true);
assert.equal(C.isToggleKey({ code: 'KeyO', repeat: true, target: {} }), false);
assert.equal(C.isToggleKey({ code: 'KeyO', ctrlKey: true, target: {} }), false);
assert.equal(C.isToggleKey({ code: 'KeyO', target: { tagName: 'INPUT' } }), false, 'typing a dog name');
// the hotkey / fire key don't collide with anything else (scan every first-party module + index.html)
const files = ['index.html', ...readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/"\.\/[^"]+\.js"(?=: )/g).map(s => s.slice(3, -1))];
const uses = new Set(); for (const f of new Set(files)) { if (f === 'controlmode.js') continue; let t = ''; try { t = readFileSync(new URL('../' + f, import.meta.url), 'utf8'); } catch (e) { continue; } if (/['"]KeyO['"]/.test(t)) uses.add(f); }
assert.deepEqual([...uses], [], 'KeyO is free');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(/keys\['KeyF'\]/.test(html), 'F is the fire key'); assert.ok(/isToggleKey\(e\)/.test(html) && /id="setCtl"/.test(html), 'hotkey + settings row wired');
assert.ok(/if \(CTL\.kbOnly\(\)\) return; \/\/ v7\.5\.3 Keyboard only: the pointer is never captured/.test(html), 'lockPointer guarded');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8'); assert.ok(/kb \? KB_AIM_CONE : Math\.PI/.test(game), 'auto-aim cone narrowed in kb mode');
console.log('control mode: PASS');
