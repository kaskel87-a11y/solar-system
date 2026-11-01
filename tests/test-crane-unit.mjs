// v7.5.22 unit test for mars/cranecore.js (magnet crane truck rules) + its wiring. node tests/test-crane-unit.mjs
import * as C from '../mars/cranecore.js';
import { readFileSync } from 'fs';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// spec + placement
ok('spec drivable, not in the dealer list, priced', C.SPEC.vmax > 0 && C.SPEC.dealer === false && C.SPEC.price === C.PRICE && C.PRICE > 0);
ok('parks outside Lou\u2019s yard (south of the gate, not inside the fence)', C.PARK[1] > 28.5 && C.PARK[0] > 40 && C.PARK[0] < 56);
ok('NPC rides are dealer kinds with positions', C.NPC_RIDES.length >= 2 && C.NPC_RIDES.every(r => typeof r[0] === 'string' && r.length === 4));
// save
const s0 = C.loadState(null); ok('fresh state', !s0.owned && s0.lifts === 0 && s0.v === 1);
ok('garbage save -> fresh', !C.loadState('{nope').owned && !C.loadState({ v: 9, owned: true }).owned);
const s1 = C.loadState(JSON.stringify({ v: 1, owned: true, how: 'stole', lifts: 3.7, sold: -2, cr: 'x' }));
ok('round trip + sanitised', s1.owned && s1.how === 'stole' && s1.lifts === 3 && s1.sold === 0 && s1.cr === 0);
ok('bad how dropped', C.loadState({ v: 1, owned: true, how: 'magic' }).how === null);
// geometry
const w = C.toWorld({ x: 10, y: 2, z: 5, yaw: 0 }, 0, 1, 6); ok('toWorld yaw 0: +z local is +z world', near(w.x, 10) && near(w.z, 11) && near(w.y, 3));
const w2 = C.toWorld({ x: 0, z: 0, yaw: Math.PI / 2 }, 0, 0, -1); ok('toWorld yaw 90\u00b0: forward (-z) is -x', near(w2.x, -1) && near(w2.z, 0));
// targeting
const cars = [{ kind: 'buggy', x: 0, z: 0, parked: true, spec: { r: 2.4 } }, { kind: 'hauler', x: 3, z: 0, parked: true, spec: { r: 3 } },
  { kind: 'buggy', x: 0.5, z: 0, parked: true, traffic: {}, spec: { r: 2.4 } }, { kind: C.KIND, x: 0.2, z: 0, parked: true, spec: { r: 3 } },
  { kind: 'buggy', x: 0.1, z: 0, parked: false, spec: { r: 2.4 } }, { kind: 'buggy', x: 0.1, z: 0.1, parked: true, carried: true, spec: { r: 2.4 } }];
ok('picks nearest liftable ride', C.pickTarget(0.4, 0, cars) === cars[0]);
ok('skips traffic, cranes, moving and carried cars', C.pickTarget(0.4, 0, cars.slice(2)) === null);
ok('skip = the truck itself', C.pickTarget(0.4, 0, cars, { skip: cars[0] }) === cars[1]);
ok('out of reach -> none', C.pickTarget(30, 30, cars) === null);
ok('plain r works too', C.pickTarget(0, 0, [{ kind: 'x', x: 4, z: 0, parked: true, r: 2 }])?.kind === 'x');
// modes + labels
ok('on foot near unowned crane = buy', C.mode({ driving: false, nearForSale: true, owned: false }) === 'buy');
ok('on foot owned = nothing', C.mode({ driving: false, nearForSale: true, owned: true }) === '');
ok('driving another car = nothing', C.mode({ driving: true, aboard: false }) === '');
ok('grab / empty / busy / drop / sell', C.mode({ driving: true, aboard: true, target: {} }) === 'grab' && C.mode({ driving: true, aboard: true }) === 'empty'
  && C.mode({ driving: true, aboard: true, busy: true }) === 'busy' && C.mode({ driving: true, aboard: true, held: true }) === 'drop' && C.mode({ driving: true, aboard: true, held: true, inYard: true }) === 'sell');
ok('labels', C.label('grab', { name: 'Dust Runner' }).includes('Grab Dust Runner') && C.label('buy').includes('1,800') && C.label('sell').includes('Lou') && C.label('') === '');
// heat
ok('lift seen by a cop right there = 1 star if clean, never stacks', C.heatOnGrab(true, 0) === 1 && C.heatOnGrab(true, 2) === 2 && C.heatOnGrab(true, 5) === 5);
ok('lift with no cop close = no heat', C.heatOnGrab(false, 0) === 0 && C.heatOnGrab(false, 2) === 2);
ok('stealing the crane = no forced stars (v7.5.28)', C.wantedOnEnter(false, 0, 0) === 0 && C.wantedOnEnter(false, 0, 3) === 3);
ok('owned crane restores previous heat', C.wantedOnEnter(true, 1, 2) === 1 && C.wantedOnEnter(true, 0, 0) === 0);
ok('owner call: only if close, ~60%', C.ownerCalls(0.1, true) && !C.ownerCalls(0.9, true) && !C.ownerCalls(0.1, false));
// cable
ok('carry length leaves belly clearance', near(C.TIP.y - C.MAG_H - C.carryLen(2.3) - 2.3, C.CARRY_GAP) && C.carryLen(9) === C.STOW_L);
ok('reach length touches the roof', near(C.TIP.y - C.MAG_H - C.reachLen(2.5), 2.5));
ok('crosswise picks the nearest side', C.crosswise(0.3) === Math.PI / 2 && C.crosswise(-0.3) === -Math.PI / 2 && C.crosswise(3.1) === Math.PI / 2);
// swing
let th = 0, om = 0; for (let i = 0; i < 30; i++) [th, om] = C.swingStep(th, om, 6, 3, 1 / 60);
ok('truck accelerates +axis -> load lags (negative)', th < -0.01);
for (let i = 0; i < 60 * 40; i++) [th, om] = C.swingStep(th, om, 0, 3, 1 / 60);
ok('swing damps out', Math.abs(th) < 0.01 && Math.abs(om) < 0.01);
[th] = C.swingStep(0, 50, 0, 3, 1); ok('swing clamped', Math.abs(th) <= C.SWING.maxA + 1e-9);
let a = 0.4, b = 0; for (let i = 0; i < 600; i++) { [a, b] = C.swingStep(a, b, 1e9, 0.01, 1 / 60); ok._x = Number.isFinite(a); } ok('swing stable with crazy input', Number.isFinite(a) && Math.abs(a) <= C.SWING.maxA);
// fence fallback
ok('fallback quotes', C.fallbackQuote('hauler', undefined) === 340 && C.fallbackQuote('ares_brute', 2600) === 780 && C.fallbackQuote('buggy', 0, 0, true) === 115);
ok('fallback heat cut', C.fallbackQuote('hauler', 0, 3) < C.fallbackQuote('hauler', 0, 0) && C.fallbackQuote('hauler', 0, 9) === 170);
// lines: M-rated, no sexual content
const all = Object.values(C.LINES).flat().join(' ').toLowerCase();
ok('owner + lou + call lines', C.LINES.crane_owner.length >= 4 && C.LINES.crane_lou.length >= 2 && C.LINES.crane_call.length >= 2);
ok('no sexual content', !/\b(sex|nude|naked|tits|porn|strip ?club)\b/.test(all));

// wiring
const rd = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const idx = rd('../index.html'), sw = rd('../sw.js'), src = rd('../mars/crane.js'), tow = rd('../mars/street-tow.js'), street = rd('../mars/street.js');
ok('index loads crane.js', /<script type="module" src="\.\/mars\/crane\.js\?v=[0-9.]+"><\/script>/.test(idx));
ok('import map has both', idx.includes('"./mars/crane.js"') && idx.includes('"./mars/cranecore.js"'));
ok('sw precaches both', sw.includes('`mars/crane.js${q}`') && sw.includes('`mars/cranecore.js${q}`'));
ok('no ?v= in imports', !/from\s+'[^']+\?v=/.test(src));
ok('save key listed for save codes', rd('../savecode.js').includes(`'${C.SAVE_KEY}'`));
ok('keys: G owned by craneBtn', rd('../hud/keys.js').includes("craneBtn: 'G'"));
ok('fence reuses street-tow payout', /function fence\(kind, strip\)/.test(tow) && /function payout\(/.test(tow) && street.includes('fence: (kind, strip) => TOW.fence('));
ok('keep reuses garage.grantVehicle', src.includes('grantVehicle?.(v.kind'));
ok('heat reuses world.take / crime', src.includes('w?.take?.(v)') && src.includes('w?.crime?.('));
ok('world exposes raw parked cars', rd('../world.js').includes('parkedVehicles: () =>'));
ok('button is black and white', /#craneBtn\{[^}]*background:#000!important;color:#fff!important/.test(src));
const stepSrc = src.slice(src.indexOf('function stepMagnet'), src.indexOf('// ---------- sell / keep panel'));
ok('no THREE allocations in the magnet step', !/new THREE\./.test(stepSrc));
console.log(fails ? `\n${fails} FAILED` : '\ncrane unit OK'); process.exit(fails ? 1 : 0);
