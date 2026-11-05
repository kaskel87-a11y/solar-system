// Hands-on harvest rules (mars/harvestcore.js): swing cuts, carry cap, banking, quick-cut combo, harvester hopper fill/empty,
// hire-a-hand, harvester purchase charged once, save migration. node tests/test-harvest-unit.mjs
import assert from 'node:assert/strict';
import * as H from '../mars/harvestcore.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const rack = (o = {}) => ({ i: 0, planted: 1.5, crop: 'potato', ripe: true, n: 6, ...o });

t('patch shares add up to the rack yield', () => { for (let y = 0; y <= 13; y++) { let s = 0; for (let k = 0; k < H.PATCHES; k++) s += H.share(y, k); assert.equal(s, y); } });
t('swing cuts one patch at a time, last patch flags the rack clear', () => {
  const s = H.fresh(), r = rack();
  const a = H.cutPatch(s, r, 'carry', 0); assert.ok(a.ok); assert.equal(a.got, 2); assert.equal(a.last, false); assert.equal(H.cropLeft(s, r), 1 - 1 / 3);
  const b = H.cutPatch(s, r, 'carry', 10); const c = H.cutPatch(s, r, 'carry', 20);
  assert.ok(b.ok && c.ok && c.last); assert.equal(H.count(s.carry), 6); assert.equal(s.carry.potato, 6); assert.equal(H.cropLeft(s, r), 1); assert.deepEqual(s.cuts, {});
  assert.equal(s.stats.swings, 3); assert.equal(s.stats.cuts, 3);
});
t('unripe / empty racks refuse', () => { const s = H.fresh(); assert.equal(H.cutPatch(s, rack({ ripe: false }), 'carry', 0).ok, false); assert.equal(H.cutPatch(s, rack({ crop: null }), 'carry', 0).ok, false); assert.equal(H.count(s.carry), 0); });
t('peek matches the cut and never mutates', () => { const s = H.fresh(), r = rack(); const before = JSON.stringify(s); const p = H.peek(s, r); assert.equal(JSON.stringify(s), before); assert.deepEqual([p.ok, p.got, p.last], [true, 2, false]);
  H.cutPatch(s, r, 'carry', 0); H.cutPatch(s, r, 'carry', 9); assert.equal(H.peek(s, r).last, true); });
t('carry cap: a full bale refuses the next cut and keeps the rack', () => {
  const s = H.fresh(); s.carry = { algae: 11 }; const r = rack({ crop: 'algae', n: 8 });
  const a = H.cutPatch(s, r, 'carry', 0); assert.equal(a.ok, false); assert.ok(a.full); assert.match(a.why, /Drop it at the silo/); assert.equal(H.count(s.carry), 11); assert.deepEqual(s.cuts, {});
  assert.equal(H.peek(s, r).full, true);
});
t('combo: every 3rd quick cut adds 1 crop; a slow cut resets', () => {
  const s = H.fresh(); const rs = [rack({ i: 0 }), rack({ i: 1 })];
  const c1 = H.cutPatch(s, rs[0], 'carry', 0), c2 = H.cutPatch(s, rs[0], 'carry', 1), c3 = H.cutPatch(s, rs[0], 'carry', 2);
  assert.deepEqual([c1.combo, c2.combo, c3.combo], [1, 2, 3]); assert.deepEqual([c1.bonus, c2.bonus, c3.bonus], [0, 0, 1]); assert.equal(s.carry.potato, 7); assert.equal(s.stats.bonus, 1);
  const slow = H.cutPatch(s, rs[1], 'carry', 2 + H.COMBO_S + 0.1); assert.equal(slow.combo, 1); assert.equal(s.combo.best, 3);
  assert.match(H.comboText(0), /Every 3rd quick cut in a row adds 1 extra crop/); assert.match(H.comboText(2), /1 more quick cut for \+1 extra crop/); assert.match(H.comboText(3), /\+1 extra crop!/);
  H.breakCombo(s); assert.equal(s.combo.n, 0);
});
t('combo bonus never overfills the bale', () => { const s = H.fresh(); s.carry = { potato: 8 }; const r = rack(); H.cutPatch(s, r, 'carry', 0); H.cutPatch(s, r, 'carry', 1); assert.equal(H.count(s.carry), 12); const r2 = rack({ i: 1, n: 0 }); const c = H.cutPatch(s, r2, 'carry', 2); assert.ok(c.ok); assert.equal(c.bonus, 0); assert.equal(H.count(s.carry), 12); });
t('banking takes what the silo has room for and leaves the rest on your back', () => {
  const s = H.fresh(); s.carry = { potato: 5, algae: 4 };
  const t1 = H.takeFrom(s, 'carry', 7); assert.equal(t1.n, 7); assert.deepEqual(t1.items, { potato: 5, algae: 2 });
  assert.equal(H.settle(s, 'carry', t1.items), 7); assert.deepEqual(s.carry, { algae: 2 }); assert.equal(s.stats.banked, 7);
  assert.equal(H.takeFrom(s, 'carry', 0).n, 0); H.settle(s, 'carry', H.takeFrom(s, 'carry', 99).items); assert.equal(H.count(s.carry), 0);
});
t('harvester hopper fills to its cap (no combo) and empties at the silo', () => {
  const s = H.fresh(); let cuts = 0;
  for (let i = 0; i < 10; i++) for (let k = 0; k < H.PATCHES; k++) { const r = H.cutPatch(s, rack({ i, crop: 'algae', n: 8 }), 'hopper', i); if (r.ok) { cuts++; assert.equal(r.bonus, 0); } }
  assert.ok(H.count(s.hopper) <= H.HOPPER_CAP && H.count(s.hopper) >= H.HOPPER_CAP - 3); assert.equal(H.count(s.carry), 0); assert.equal(s.stats.roverCuts, cuts); assert.equal(s.combo.n, 0);
  const full = H.cutPatch(s, rack({ i: 11, crop: 'algae', n: 8 }), 'hopper', 0); assert.equal(full.ok, false); assert.match(full.why, /hopper is full/);
  const tk = H.takeFrom(s, 'hopper', 120); H.settle(s, 'hopper', tk.items); assert.equal(H.count(s.hopper), 0); assert.equal(s.stats.emptied, tk.n);
});
t('hire a hand: charged once per rack, due after HIRE.secs, remaining = uncut patches', () => {
  const s = H.fresh(), r = rack(), now = 1e6;
  const a = H.canHire(s, r, 100, now); assert.ok(a.ok); assert.equal(a.cost, H.HIRE.fee); H.addJob(s, a.job);
  const b = H.canHire(s, r, 100, now); assert.equal(b.ok, false); assert.ok(b.dup);
  assert.equal(H.canHire(H.fresh(), r, H.HIRE.fee - 1, now).ok, false); assert.equal(H.canHire(H.fresh(), rack({ ripe: false }), 100, now).ok, false);
  assert.equal(H.dueJobs(s, now + 1000).length, 0); assert.equal(H.dueJobs(s, now + H.HIRE.secs * 1000).length, 1); assert.equal(s.jobs.length, 0); assert.equal(s.stats.hires, 1);
  assert.equal(H.remaining(s, r), 6); H.cutPatch(s, r, 'carry', 0); assert.equal(H.remaining(s, r), 4);
});
t('harvester purchase: 4,000 cr, refused when owned or short', () => {
  const s = H.fresh(); assert.equal(H.ROVER_PRICE, 4000);
  assert.equal(H.canBuyRover(s, 3999).ok, false); const v = H.canBuyRover(s, 5000); assert.ok(v.ok); assert.equal(v.cost, 4000);
  // the caller's flow: check, charge once, own. A second tap is refused before any charge.
  let cr = 5000; const buy = () => { const c = H.canBuyRover(s, cr); if (!c.ok) return c; cr -= c.cost; H.ownRover(s, 'r9'); return { ok: true }; };
  assert.ok(buy().ok); const again = buy(); assert.equal(again.ok, false); assert.ok(again.owned); assert.equal(cr, 1000); assert.deepEqual(s.rover, { owned: true, ride: 'r9', paid: 4000 });
  assert.equal(H.canBuyRover(H.fresh(), 9999, true).owned, true); // already in the garage
});
t('prune drops partial cuts of replanted racks', () => { const s = H.fresh(); H.cutPatch(s, rack(), 'carry', 0); assert.equal(Object.keys(s.cuts).length, 1); assert.equal(H.prune(s, [rack()]), 0); assert.equal(H.prune(s, [rack({ planted: 9 })]), 1); assert.deepEqual(s.cuts, {}); });
t('nearestRipe picks the closest ripe rack in reach', () => { const sp = [{ i: 0, x: 0, z: 0, ripe: true }, { i: 1, x: 2, z: 0, ripe: true }, { i: 2, x: 1, z: 0, ripe: false }]; assert.equal(H.nearestRipe(sp, { x: 1.8, z: 0 }).i, 1); assert.equal(H.nearestRipe(sp, { x: 9, z: 0 }), null); });
t('save migration: own key, survives garbage, keeps carry/hopper/cuts/jobs/rover', () => {
  assert.equal(H.SAVE_KEY, 'ssx.harvest.v1'); assert.deepEqual(H.migrate('nope'), H.fresh()); assert.deepEqual(H.migrate(null), H.fresh());
  const s = H.fresh(); s.carry = { potato: 3 }; s.hopper = { algae: 9 }; H.cutPatch(s, rack(), 'carry', 0); s.jobs.push({ i: 1, planted: 2, due: 5, fee: 6 }); H.ownRover(s, 'r3');
  const m = H.migrate(JSON.stringify(s)); assert.deepEqual(m.carry, { potato: 5 }); assert.deepEqual(m.hopper, s.hopper); assert.deepEqual(m.cuts, s.cuts); assert.deepEqual(m.jobs, s.jobs); assert.deepEqual(m.rover, s.rover);
  const bad = H.migrate({ carry: { potato: -4, 'x y': 3, algae: 1e9 } }); assert.deepEqual(bad.carry, { algae: 999 });
});
console.log(`harvest unit OK (${n} checks)`);
