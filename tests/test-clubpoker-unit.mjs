// v7.5.33 unit test: the Velvet Airlock is 4x bigger and has a Hold'em room (clubpoker.js) reusing activities/poker.js.
// node tests/test-clubpoker-unit.mjs
import { readFileSync } from 'fs';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cp = src('clubpoker.js'), poker = src('activities/poker.js'), ints = src('interiors.js'), world = src('world.js'), html = src('index.html'), sw = src('sw.js'), surf = src('surface.js');

// interior: 44 x 32 (4x of 22 x 16), off-centre so the old room keeps its coordinates
const m = /name: 'The Velvet Airlock', w: (\d+), d: (\d+), cx: (-?\d+), cz: (-?\d+)/.exec(ints);
ok('club def 44 x 32 off-centre', m && +m[1] === 44 && +m[2] === 32);
const [W, D, CX, CZ] = m ? m.slice(1).map(Number) : [0, 0, 0, 0];
ok('interior area 4x the old 22 x 16', W * D === 4 * 22 * 16);
ok('old room (x -11..11, z -8..8) is the north-east quarter', CX - W / 2 === -33 && CX + W / 2 === 11 && CZ - D / 2 === -8 && CZ + D / 2 === 24);
ok('club build keeps the legacy 22 x 16 layout', /const \{ box, mat \} = api, w = 22, d = 16,/.test(ints));
ok('roomKit offsets the shell + leave spot', /ox = def\.cx \|\| 0, oz = def\.cz \|\| 0/.test(ints) && /id: 'leave', x: ox, z: oz \+ d \/ 2 - 0\.9/.test(ints));
ok('buildRoom exposes cx/cz; world uses them for spawn, light, bounds', /cx: def\.cx \|\| 0, cz: def\.cz \|\| 0/.test(ints) && /spawn: \{ x: cx \+ room\.cx/.test(world) && /x0: inside\.ax \+ inside\.room\.cx - inside\.room\.w \/ 2/.test(world));
ok('debugInside is anchor-relative (old test coords still valid)', /player\.x = \(b\.ax \?\? /.test(surf));
ok('club build adds the poker room', /addPokerRoom\(api, \{ x: -22, z: 0 \}, \{ sit: sitPose, idle \}\)/.test(ints) && /import \{ addPokerRoom \} from '\.\/clubpoker\.js'/.test(ints));
// poker room fits in the west wing, clear of the old room
const T = { x: -22, z: 0 };
ok('table inside the west wing with room to walk round', T.x - 5 > CX - W / 2 && T.x + 5 < -11 && T.z - 4 > CZ - D / 2);
// exterior: 4x footprint, same front face + door, no overlap with Ares Junction's other blocks / domes
const blk = [...world.matchAll(/\[(-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?), '([^']+)'/g)].map(a => ({ x: +a[1], z: +a[2], w: +a[3], d: +a[4], name: a[6] }));
const mars = world.slice(world.indexOf('Mars: {'), world.indexOf('guards:', world.indexOf('Mars: {')));
const marsBlocks = blk.filter(b => mars.includes(`'${b.name}'`));
const club = marsBlocks.find(b => b.name === 'THE VELVET AIRLOCK');
ok('exterior 24 x 14 (4x of 12 x 7)', club && club.w === 24 && club.d === 14);
ok('front face (door) unchanged at z -32.5', club && club.z + club.d / 2 === -32.5 && club.x === -30);
const ov = (a, b, pad = 1) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad;
ok('no overlap with other Ares Junction blocks', club && marsBlocks.filter(b => b !== club).every(b => !ov(club, b)));
const domes = [...(/domes: \[(.*?)\],\n/.exec(mars)?.[1] || '').matchAll(/\[(-?\d+), (-?\d+), (\d+)/g)].map(a => ({ x: +a[1], z: +a[2], r: +a[3] }));
ok('no overlap with the domes', club && domes.length >= 3 && domes.every(d => Math.max(Math.abs(d.x - club.x) - club.w / 2, 0) ** 2 + Math.max(Math.abs(d.z - club.z) - club.d / 2, 0) ** 2 > (d.r + 1) ** 2));
const pad = /pad: \[(-?\d+), (-?\d+), (\d+)\]/.exec(mars), crates = [...(/crates: \[(.*?)\],/.exec(mars)?.[1] || '').matchAll(/\[(-?\d+), (-?\d+)\]/g)].map(a => [+a[1], +a[2]]);
ok('clear of pad + crates', club && pad && !ov(club, { x: +pad[1], z: +pad[2], w: 2 * +pad[3], d: 2 * +pad[3] }) && crates.every(([x, z]) => !ov(club, { x: x + 0.65, z: z + 0.65, w: 2.6, d: 2.6 })));
ok('perimeter lamps step out of blocks', /a lamp that would stand inside a block/.test(world));
// poker: reused engine, re-themed, black/white buttons, routed from the hotspot
ok('clubpoker reuses activities/poker.js', /import \{ openPokerTable, pokerIsOpen \} from '\.\/activities\/poker\.js'/.test(cp) && /openPokerTable\(\{ \.\.\.opts, theme: VELVET_THEME \}\)/.test(cp));
ok('engine accepts a theme', /TH = \{ \.\.\.THEME0, \.\.\.\(opts\.theme \|\| \{\}\) \}/.test(poker) && /\$\{TH\.title\}/.test(poker) && /TH\.buyIns \|\| BUYINS/.test(poker));
ok('Nyx table keeps its defaults', /title: "Static Hold'em", host: 'Nyx'/.test(poker));
ok('buttons black with white text', /#pokerPanel button, [^{]*\{ background: #000; color: #fff;/.test(poker));
ok('buttons bound with panelTap (tap-safe)', /panelTap\(el, on\)/.test(poker));
ok('credit buy-ins, 3 seated regulars', /buyIns: \[100, 250, 600\]/.test(cp) && /nAi: 3/.test(cp));
ok('poker spot + seated NPCs + dealer', /act: 'poker'/.test(cp) && /poses\.sit\?\.\(h\)/.test(cp) && /Mags, the dealer/.test(cp));
ok('index routes act poker', /s\.act === 'poker'\) \{ try \{ const r = openVelvetPoker\(\)/.test(html) && /import \{ openVelvetPoker \} from '\.\/clubpoker\.js'/.test(html));
ok('sw precaches clubpoker.js', /`clubpoker\.js\$\{q\}`/.test(sw));
ok('importmap has clubpoker', /"\.\/clubpoker\.js": "\.\/clubpoker\.js\?v=/.test(html));
console.log(fails ? `${fails} FAIL` : 'all ok'); process.exit(fails ? 1 : 0);
