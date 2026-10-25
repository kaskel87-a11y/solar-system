// node tests/test-heist-unit.mjs : pure heist logic (heistcore.js) + Steve's mars-city pack conversion
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../heistcore.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const crack = (s, maxT = 60) => { // ideal player: turn quietly to the notch, then hold still
  let tt = 0; while (!s.done && tt < maxT) { const diff = H.wrap180(s.targets[s.idx] - s.angle), d = Math.sign(diff) * Math.min(Math.abs(diff), 3); s.step(1 / 60, d); tt += 1 / 60; } return s.result;
};
t('tiers', () => { for (const [k, v] of Object.entries(H.SAFE_TIERS)) { const s = H.createSafe({ tier: k, seed: 3 }); assert.equal(s.targets.length, v.tumblers); } });
t('targets spaced and deterministic', () => {
  const a = H.createSafe({ seed: 42, tier: 'vault' }), b = H.createSafe({ seed: 42, tier: 'vault' });
  assert.deepEqual(a.targets, b.targets); for (let i = 1; i < a.targets.length; i++) assert.ok(Math.abs(H.wrap180(a.targets[i] - a.targets[i - 1])) >= 70);
});
t('crack all tiers quietly', () => { for (const k of Object.keys(H.SAFE_TIERS)) { const r = crack(H.createSafe({ tier: k, seed: 11 })); assert.equal(r.success, true, k); assert.equal(r.reason, 'cracked'); assert.ok(r.noise < 1); assert.equal(r.tumblers, H.SAFE_TIERS[k].tumblers); } });
t('spinning fast trips noise', () => { const s = H.createSafe({ tier: 'hard', seed: 5 }); let i = 0; while (!s.done && i++ < 2000) s.step(1 / 60, 25); assert.equal(s.result.success, false); assert.equal(s.result.reason, 'noise'); });
t('timeout', () => { const s = H.createSafe({ tier: 'easy', seed: 5, time: 2 }); for (let i = 0; i < 200 && !s.done; i++) s.step(1 / 60, 0.1); assert.equal(s.result.reason, 'timeout'); });
t('passing through notch fast does not set it', () => { const s = H.createSafe({ tier: 'medium', seed: 9 }); const tg = s.targets[0]; s.angle = H.wrap180(tg - 30); for (let i = 0; i < 20; i++) s.step(1 / 60, 3.5); assert.equal(s.idx, 0); });
t('feedback rises near notch', () => { const s = H.createSafe({ tier: 'medium', seed: 9 }); s.angle = H.wrap180(s.targets[0] - 40); s.step(1 / 60, 0); const f0 = s.feedback; s.angle = H.wrap180(s.targets[0] - 5); s.step(1 / 60, 0); assert.ok(s.feedback > f0); assert.ok(s.inZone); });
t('abort', () => { const s = H.createSafe({}); s.abort(); assert.equal(s.result.reason, 'abort'); assert.equal(s.result.success, false); });

t('camera cone', () => {
  const c = H.normCamera({ id: 'c', x: 0, z: 0, yaw: 0, fov: 60, range: 10, sweep: 0 }); // looks toward -z
  assert.ok(H.inCone(c, 0, -5) > 0); assert.equal(H.inCone(c, 0, 5), 0); assert.equal(H.inCone(c, 0, -11), 0); assert.equal(H.inCone(c, 6, -2), 0);
  const e = H.normCamera({ id: 'e', x: 0, z: 0, yaw: -Math.PI / 2, fov: 60, range: 10, sweep: 0 }); assert.ok(H.inCone(e, 5, 0) > 0, 'yaw -90 looks east (+x)');
});
t('camera meter alert once, hidden/indoors blocks, disable', () => {
  const c = H.normCamera({ id: 'c', x: 0, z: 0, yaw: 0, range: 10, sweep: 0 }); let alerts = 0, tt = 0;
  for (let i = 0; i < 300; i++) { if (H.stepCamera(c, 1 / 60, { x: 0, z: -4 }, tt += 1 / 60) === 'alert') alerts++; } assert.equal(alerts, 1);
  const h = H.normCamera({ id: 'h', x: 0, z: 0, yaw: 0, sweep: 0 }); for (let i = 0; i < 300; i++) H.stepCamera(h, 1 / 60, { x: 0, z: -4, hidden: true }, i / 60); assert.equal(h.meter, 0);
  const d = H.normCamera({ id: 'd', x: 0, z: 0, yaw: 0, sweep: 0 }); d.disabledFor = 5; for (let i = 0; i < 120; i++) assert.notEqual(H.stepCamera(d, 1 / 60, { x: 0, z: -4 }, i / 60), 'alert');
});
t('camera sweeps', () => { const c = H.normCamera({ id: 'c', x: 0, z: 0, yaw: 0, sweep: 40, sweepSpeed: 1 }); H.stepCamera(c, 0.01, null, Math.PI / 2); assert.ok(Math.abs(c.yaw - 40 * Math.PI / 180) < 1e-6); });

t('alarmAction', () => {
  assert.deepEqual(H.alarmAction(2, 0), { op: 'setWanted', n: 2 });
  assert.deepEqual(H.alarmAction(2, 1), { op: 'setWanted', n: 2 });
  assert.deepEqual(H.alarmAction(2, 2), { op: 'crime', n: 3 });
  assert.deepEqual(H.alarmAction(2, 3, { escalate: false }), { op: 'none', n: 3 });
  assert.deepEqual(H.alarmAction(3, 5), { op: 'none', n: 5 });
  assert.deepEqual(H.alarmAction(0, 1), { op: 'none', n: 1 });
});
t('heist flow + escape payload', () => {
  assert.throws(() => H.normHeist({ id: 'x' })); assert.ok(H.validateHeist({ id: 'x', site: { x: 0, z: 0 }, door: { x: 0, z: 1 }, safe: { x: 0, z: 0, tier: 'nope' } }).length);
  const d = H.normHeist({ id: 'h', site: { x: 1, z: 2, r: 10 }, door: { x: 1, z: 12 }, safe: { x: 1, z: 0 } });
  assert.equal(d.escapeR, 30); assert.equal(d.safe.tier, 'medium'); assert.equal(d.alarm.wanted, 2);
  const r = H.createRun(d); assert.equal(r.stage, 'case'); r.advance(); assert.equal(r.stage, 'breakin'); r.tBreak = 0; r.t = 5; r.advance('crack'); assert.equal(r.advance('case'), false);
  r.advance('escape'); r.loot = { credits: 300 }; r.alarm = true; r.t = 12.345;
  const p = H.escapePayload(r, { x: 40.123, z: 2, wanted: 3, evading: false, security: 2, vehicle: 'buggy' });
  assert.deepEqual(Object.keys(p).sort(), ['alarm', 'evading', 'heat', 'id', 'loot', 'pos', 'security', 'site', 't', 'title', 'vehicle', 'world'].sort());
  assert.equal(p.heat, 3); assert.equal(p.pos.x, 40.12); assert.equal(p.t, 12.35); assert.equal(p.loot.credits, 300); assert.doesNotThrow(() => JSON.stringify(p));
  r.failWith('x'); assert.equal(r.stage, 'failed'); assert.equal(r.advance(), false);
});
t('Steve mars-city pack -> 4 mansion heists', () => {
  const f = '/workspace/solar-system-story/mars-city/gated-community.json';
  if (!fs.existsSync(f)) { console.log('  (pack not on this machine, skipped)'); return; }
  const g = JSON.parse(fs.readFileSync(f, 'utf8')), ms = g.buildings.filter(b => b.type === 'mansion'); assert.equal(ms.length, 4);
  for (const b of ms) {
    const d = H.normHeist(H.heistFromMansion(b, g.coords.origin_aj)); assert.equal(d.rel, 'colony');
    assert.deepEqual([d.site.x, d.site.z], b.at_aj); assert.equal(d.cameras.length, 4); assert.equal(d.alarm.responseS, b.alarm_response_s);
    for (const c of d.cameras) { const cc = H.normCamera(c), dx = cc.x - d.site.x, dz = cc.z - d.site.z; assert.ok(H.inCone(cc, cc.x + dx * 0.5, cc.z + dz * 0.5) > 0, 'faces outward'); }
  }
});
t('informant tips: schema, safe ease, unknown ignored', () => {
  assert.equal(H.normTip({ type: 'bribe' }), null); assert.equal(H.normTip(null), null); assert.equal(H.normTip('cameras'), null);
  assert.deepEqual(H.normTip({ type: 'cameras', extra: 1 }), { type: 'cameras' });
  assert.equal(H.normTip({ type: 'safe', ease: 5 }).ease, 0.6); assert.equal(H.normTip({ type: 'safe' }).ease, 0.25);
  const tips = {}; H.applyTipTo(tips, { type: 'safe', ease: 0.3 }); H.applyTipTo(tips, { type: 'safe', ease: 0.1 }); H.applyTipTo(tips, { type: 'patrol' });
  assert.equal(tips.safeEase, 0.3); assert.equal(tips.patrol, true); assert.equal(H.applyTipTo(tips, { type: 'nope' }), null);
  const o = H.tipSafeOpts('medium', 40, tips); assert.equal(o.time, 52); assert.ok(o.overrides.tol > H.SAFE_TIERS.medium.tol);
  assert.deepEqual(H.tipSafeOpts('medium', 40, {}), { time: 40 });
});
console.log(`\n${n} unit tests passed`);
