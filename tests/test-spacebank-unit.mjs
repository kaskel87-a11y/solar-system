// Cinder Vault rules (spacebankcore.js). Run: node tests/test-spacebank-unit.mjs
import * as C from '../spacebankcore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } else console.log('PASS', name); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

ok('stationOffLane', C.BANK.pos[2] > 100 && C.len(C.BANK.pos) > 100);
ok('threeBuoys', C.BUOYS.length === 3 && new Set(C.BUOYS.map(b => b.id)).size === 3);
ok('nixClearOfPad', Math.hypot(C.NIX[0] + 38, C.NIX[1] - 10) > 13 + C.NIX_R);

const p = C.BUOYS[0].pos;
ok('onBuoy', C.nearBuoy(p, C.BUOYS[0]));
ok('gatherOne', C.gather([], p).join(',') === 'cams');
ok('gatherAll', C.gather(['cams', 'shift', 'timer'], [0, 0, 0]).length === 3);
ok('missBuoy', !C.nearBuoy([0, 0, 0], C.BUOYS[0]));

const cam = C.CAMS[0], inside = cam.at.map((v, i) => v + C.norm(cam.rest)[i] * 10);
ok('inCone', C.inCone(cam.at, C.norm(cam.rest), inside));
let dockSafe = true;
for (let t = 0; t < 14; t += 0.25) for (const c of C.CAMS) {
  const dir = C.beamDir(c.rest, t, 0);
  if (C.inCone(c.at, dir, C.BANK.dock) || C.BUOYS.some(b => C.inCone(c.at, dir, b.pos))) dockSafe = false;
}
ok('dockAndBuoysClear', dockSafe);
ok('marsBlocks', C.blocked([-30, 0, 0], [30, 0, 0], [{ c: [0, 0, 0], r: 3.4 }]));

let s = { v: 0, ghost: 0 }, t = 0;
while (!s.flagged && t < 8) { s = C.scanStep(s, 0.05, { seen: true }); t += 0.05; }
ok('scanFlags', s.flagged && t < C.SCAN.fill / C.SCAN.rate + 0.1, t);
const cut = C.scanStep({ v: 0.8, ghost: 0 }, 0.05, { seen: true, rolled: true });
ok('rollCutsScan', cut.dodged && cut.v < 0.8 && cut.ghost > 0);

let steady = C.freshDrill(), alarmed = false;
for (let i = 0; i < 40 && !steady.done && !steady.failed; i++) { steady = C.drillStep(steady, 0.1, true); if (steady.alarm) alarmed = true; }
ok('steadyHoldTrips', alarmed && steady.done, JSON.stringify(steady));
const pulsed = C.pulseDrill();
ok('pulseClean', pulsed.done && !pulsed.hot && !pulsed.alarm, JSON.stringify(pulsed));

ok('price', C.priceOf('hack', []).cost === 500 && C.priceOf('drill', ['vee']).free && C.priceOf('drill', ['vee']).cost === 0);
ok('priceWheel', C.priceOf('wheel', ['mags']).free && C.priceOf('nope', []) === null);

const cold = C.vaultPlan({ crew: [], alarm: false });
const hot = C.vaultPlan({ crew: [], alarm: true });
const hack = C.vaultPlan({ crew: ['hack', 'drill'], alarm: false });
ok('vaultTiers', cold.tier === 'medium' && hot.tier === 'hard' && hack.tier === 'easy' && hack.ease === 0.35 && hack.time > cold.time);

const clean = C.score({ loot: true, crew: ['hack'], alarm: false }, 0);
const dirty = C.score({ loot: true, crew: ['hack'], alarm: true }, 0);
const broke = C.score({ loot: false, crew: ['hack'], alarm: true }, 0);
ok('cleanPays', clean.cash === 3420 && clean.stars === 55, JSON.stringify(clean));
ok('hotPaysMoreBase', dirty.cash > C.PAY.base && dirty.cash !== clean.cash);
ok('blownPaysNothing', broke.cash === 0);
ok('bonus', C.score({ loot: true, crew: [], alarm: false }, 0.1).cash > C.score({ loot: true, crew: [], alarm: false }, 0).cash);

ok('cutters', C.cutterCount(true) === 1 && C.cutterCount(false) === 2);
const w = C.chaseTune(true), nrm = C.chaseTune(false);
ok('wheelEasier', w.lose < nrm.lose && w.hit < nrm.hit && w.speed < nrm.speed);

const lk = C.lockStep({ v: 0, ghost: 0 }, 0.2, { d: 5, rolled: false });
ok('lockBuilds', lk.v > 0 && !lk.hit);
const br = C.lockStep({ v: 1, ghost: 0 }, 0.05, { d: 5, rolled: true });
ok('rollBreaksLock', br.broke && br.v < 1);

ok('save', C.loadState('{"runs":2,"earned":10}').runs === 2 && C.loadState('nope').runs === 0);
ok('phases', C.PHASES.includes('getaway') && C.newRun(1).phase === 'scout');

console.log(fails ? `FAILED ${fails}/${n}` : `OK ${n}`);
process.exit(fails ? 1 : 0);
