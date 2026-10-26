// Red Tape Flats street life: violence (Snuffles). Street NPCs (dealers, junkies, barrel crowds, rockheads) become hittable
// through the same world wrapper pattern danger.js uses (dangerhooks.patchWorld): world.hitWorld / targets / meleeTarget /
// meleeWorld / blast are wrapped once per world object, so bullets, melee combos and explosions from game.js reach them.
// Hits bleed (instanced ground blood + game.gore spray), deaths crumple and tip over (a tween, no physics), bodies drop
// cash or product (walk over it to take it; product goes into SSX.contraband, guarded), shooting or killing adds heat through
// the existing wanted system, and anyone nearby runs and screams.
import { HURT } from './street-rant.js';
const WITNESS = ['He\u2019s fuckin\u2019 SHOOTING! Run!', 'Oh shit oh shit oh shit!', 'Not my face! Not my FACE!', 'Somebody call ColSec! Actually don\u2019t!',
  'Jesus Christ, he killed him!', 'Every man for himself!', 'I didn\u2019t see SHIT! I\u2019m blind! Born blind!', 'Fuck this, fuck you, fuck Mars!'];
const DYING = ['Mama...', 'Ghhk... not like... this...', 'Tell Gary... it was... ghk...', 'Aw, fuck...'];
const CORE = ['glowdust', 'lowg', 'redstatic', 'voidhoney'];
const R = () => Math.random();

export function createCombat(K) {
  const { THREE } = K;
  let root = null, drops = [], dbg = { hits: 0, kills: 0, kos: 0, drops: 0, taken: 0, witnesses: 0, patched: 0 };
  const patched = new WeakSet();
  const all = () => { const out = []; for (const p of K.hittables) { try { for (const h of p()) if (h.alive) out.push(h); } catch (e) { /* provider gone */ } } return out; };
  const segD = (p0, p1, c) => { const sx = p1.x - p0.x, sy = p1.y - p0.y, sz = p1.z - p0.z, L2 = sx * sx + sy * sy + sz * sz;
    const t = L2 ? Math.max(0, Math.min(1, ((c.x - p0.x) * sx + (c.y - p0.y) * sy + (c.z - p0.z) * sz) / L2)) : 0;
    return Math.hypot(p0.x + sx * t - c.x, p0.y + sy * t - c.y, p0.z + sz * t - c.z); };
  function patch(w) {
    if (!w || patched.has(w) || typeof w.hitWorld !== 'function') return; patched.add(w); dbg.patched++;
    const oHit = w.hitWorld, oT = w.targets, oMT = w.meleeTarget, oMW = w.meleeWorld, oB = w.blast;
    w.hitWorld = (p0, p1, b) => { if (!K.D) return oHit(p0, p1, b); let best = null, bd = 1e9; for (const h of all()) { const d = segD(p0, p1, h); if (d < h.r) { const k = Math.hypot(h.x - p0.x, h.z - p0.z); if (k < bd) { bd = k; best = h; } } }
      if (best) { best.hit(b?.dmg ?? 1, 'shot', p0); return true; } return oHit(p0, p1, b); };
    if (oT) w.targets = () => { const o = oT(); if (!K.D) return o; return [...o, ...all().filter(h => h.hostile).map(h => ({ x: h.x, y: h.y, z: h.z, kind: h.kind }))]; };
    if (oMT) w.meleeTarget = (x, z, yaw, range) => { const t = oMT(x, z, yaw, range); if (!K.D) return t; let best = null, bd = t ? Math.hypot(t.x - x, t.z - z) : range; for (const h of all()) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = { x: h.x, z: h.z, kind: h.kind }; } } return best || t; };
    if (oMW) w.meleeWorld = (x, z, fx, fz, range, dmg, knock) => { if (K.D) for (const h of all()) { const dx = h.x - x, dz = h.z - z, d = Math.hypot(dx, dz); if (d < range + 0.5 && dx * fx + dz * fz > -0.3) { h.hit(dmg, 'melee', { x, z }, knock); return true; } } return oMW(x, z, fx, fz, range, dmg, knock); };
    if (oB) w.blast = (c, Rr, dmg, emp) => { let n = 0; if (K.D) for (const h of all()) { const d = Math.hypot(h.x - c.x, h.z - c.z); if (d < Rr) { n++; h.hit(emp ? 0.5 : dmg * (1 - d / Rr), emp ? 'emp' : 'blast', c); } } return n + oB(c, Rr, dmg, emp); };
  }
  // ---------- shared bits: blood, gore, crumple ----------
  function bleed(x, z, dmg, from, big = false) {
    const y = K.hgt(x, z); let ox = 0, oz = 0; if (from) { const d = Math.hypot(x - from.x, z - from.z) || 1; ox = (x - from.x) / d * 0.6; oz = (z - from.z) / d * 0.6; } // spatter lands behind the victim
    K.blood?.splat(x + ox + (R() - 0.5) * 0.3, z + oz + (R() - 0.5) * 0.3, Math.min(1.1, 0.35 + dmg * 0.12));
    if (big) K.blood?.pool(x + ox * 0.3, z + oz * 0.3);
    try { K.game()?.gore?.(x, y + 1.25, z, { n: Math.min(0.6, 0.18 + dmg * 0.05), spray: true }); } catch (e) { /* gore optional */ }
  }
  // crumple then tip over; u 0..1 over ~1.1 s. Group euler order YXZ so the fall happens in the body's own frame.
  function crumple(h, s, u, dir) {
    h.group.rotation.order = 'YXZ'; const e = u * u * (3 - 2 * u), k = Math.min(1, u / 0.45), tip = Math.max(0, (u - 0.3) / 0.7), te = tip * tip;
    h.hips.position.y = h.base * (1 - 0.35 * k * (1 - tip)); h.legs[0].rotation.x = -0.9 * k * (1 - tip * 0.6); h.legs[1].rotation.x = -0.5 * k * (1 - tip * 0.4);
    h.torso.rotation.x = 0.35 * k * dir; h.head.rotation.x = 0.5 * e * dir; h.arms[0].rotation.x = 0.4 + 1.2 * e; h.arms[1].rotation.z = -0.7 * e; h.arms[0].rotation.z = 0.5 * e;
    h.group.rotation.x = dir * (Math.PI / 2) * te; h.group.position.set(s.x, K.hgt(s.x, s.z) + 0.14 * te, s.z); h.group.rotation.y = s.yaw;
  }
  function witnesses(x, z, from, r = 22, except = null) {
    let n = 0, first = null;
    for (const s of K.slots()) { if (s === except || !s.on || s.dead || !s.h) continue; if (Math.hypot(s.x - x, s.z - z) > r) continue;
      if (!s.flee) { s.flee = { t: 7 + R() * 5, from: { x: from?.x ?? x, z: from?.z ?? z } }; s.fight && (s.fight.over = true); n++; first ||= s; } }
    if (first) { K.yell(first, first.name, K.pick(WITNESS), 2); dbg.witnesses += n; } return n;
  }
  // ---------- drops ----------
  function drop(x, z, { cash = 0, item = null, qty = 1, who = '' } = {}) {
    if (!root) return null; if (drops.length >= 6) { const o = drops.shift(); root.remove(o.g); }
    const g = new THREE.Group(), y = K.hgt(x, z); g.position.set(x, y + 0.08, z);
    const mCash = K.mat('st_cashwad', { color: 0x5a6a4a, roughness: 0.8, emissive: 0x223018, emissiveIntensity: 0.6 }), mBag = K.mat('st_baggie', { color: 0xe8e8e8, roughness: 0.3, transparent: true, opacity: 0.85, emissive: 0x444444, emissiveIntensity: 0.5 });
    if (cash) { K.box(g, mCash, 0, 0.04, 0, 0.32, 0.08, 0.16, R() * 3); K.box(g, mCash, 0.06, 0.1, 0.03, 0.3, 0.06, 0.15, R() * 3); }
    if (item) K.box(g, mBag, -0.2, 0.05, 0.1, 0.16, 0.06, 0.12, R() * 3);
    root.add(g); const d = { g, x, z, cash, item, qty, who, t: 0 }; drops.push(d); dbg.drops++; K.emit('drop', { x, z, cash, item, qty, who }); return d;
  }
  function take(d) {
    const parts = []; if (d.cash) { K.pay(d.cash); parts.push(`${d.cash} cr`); }
    if (d.item) { let ok = false; try { const c = K.X().contraband; if (typeof c?.add === 'function' && c.items?.().some(i => i.id === d.item)) { const r = c.add(d.item, d.qty); ok = r !== false && r?.ok !== false; if (ok) parts.push(`${d.qty}\u00d7 ${c.items().find(i => i.id === d.item)?.name || d.item}`); } } catch (e) { ok = false; }
      if (!ok) { const v = 25 * d.qty; K.pay(v); parts.push(`${v} cr (sold the baggie on the spot)`); } }
    root?.remove(d.g); drops = drops.filter(x => x !== d); dbg.taken++; K.ST.stats.looted = (K.ST.stats.looted || 0) + 1; K.save();
    K.toast(`\ud83d\udcb0 You go through ${d.who || 'the body'}\u2019s pockets: ${parts.join(', ') || 'lint'}.`, 2600); K.emit('loot', { cash: d.cash, item: d.item, qty: d.qty });
  }
  const lootFor = s => s.role === 'dealer' ? { cash: 60 + ((R() * 90) | 0), item: CORE[((R() * 2) | 0) + (R() < 0.3 ? 2 : 0)], qty: 1 + ((R() * 3) | 0) } : s.role === 'junkie' ? { cash: 3 + ((R() * 12) | 0), item: R() < 0.3 ? 'glowdust' : null, qty: 1 } : { cash: 5 + ((R() * 30) | 0) };
  // ---------- street slot damage (dealers / junkies / barrel crowd) ----------
  function hurt(s, dmg, how, from, knock = 0) {
    if (!s.on || s.dead || !s.h) return true; s.hp ??= s.role === 'dealer' ? 4 : 3; s.hp -= dmg; dbg.hits++;
    if (from && knock) { const d = Math.hypot(s.x - from.x, s.z - from.z) || 1; s.x += (s.x - from.x) / d * knock * 0.5; s.z += (s.z - from.z) / d * knock * 0.5; }
    bleed(s.x, s.z, dmg, from); if (s.fight) s.fight.over = true;
    const P = K.player || from;
    if (!s.assaulted) { s.assaulted = true; K.crime(1, how === 'melee' ? `assault in Red Tape Flats (${s.name})` : `shooting at ${s.name} in Red Tape Flats`); }
    if (s.hp <= 0) return kill(s, how, from), true;
    s.flee = { t: 9 + R() * 4, from: { x: P?.x ?? s.x, z: P?.z ?? s.z } }; K.yell(s, s.name, K.pick(HURT), 2); witnesses(s.x, s.z, P, 20, s); K.emit('hurt', { who: s.key, hp: s.hp, how });
    return true;
  }
  function kill(s, how, from) {
    const P = K.player || from, dir = P ? (Math.sign((s.x - P.x) * Math.sin(s.yaw) + (s.z - P.z) * Math.cos(s.yaw)) || 1) : 1; // fall away from the shooter
    s.dead = { t: 0, dir, how }; s.flee = null; s.fight = null; s.st = 'dead'; dbg.kills++; K.ST.stats.kills = (K.ST.stats.kills || 0) + 1; K.save();
    bleed(s.x, s.z, 3, from, true); K.yell(s, s.name, K.pick(DYING), 0);
    K.crime(1, `killed ${s.name} in Red Tape Flats`); if (s.role === 'junkie') K.rep('junkies', -3, 'killed a junkie');
    const L = lootFor(s); setTimeout(() => { if (s.dead) drop(s.x + 0.6, s.z + 0.3, { ...L, who: s.name }); }, 900);
    witnesses(s.x, s.z, P, 26, s); K.emit('kill', { who: s.key, role: s.role, how });
  }
  // per-frame override for dead / fleeing slots; returns true when it drove the actor
  function drive(s, h, dt, t, P) {
    if (s.dead) { const d = s.dead; d.t += dt; K.posePlain(h); crumple(h, s, Math.min(1, d.t / 1.1), d.dir);
      if (d.t > 60) { s.dead = null; s.hp = null; s.assaulted = false; s.st = 'idle'; s.on = false; s.gone = K.T + 300; h.group.visible = false; h.group.rotation.set(0, 0, 0); h.group.position.y = K.hgt(s.x, s.z); } return true; }
    if (s.flee) { const f = s.flee; f.t -= dt; const dx = s.x - f.from.x, dz = s.z - f.from.z, L = Math.hypot(dx, dz) || 1, v = 3.6 * dt; let nx = s.x + dx / L * v, nz = s.z + dz / L * v; const c = K.collide(nx, nz, 0.4); if (c) { nx = c.x + (R() - 0.5) * 0.2; nz = c.z + (R() - 0.5) * 0.2; }
      s.x = nx; s.z = nz; s.yaw = Math.atan2(-dx, -dz) + Math.PI; K.posePlain(h); K.walkAnim(h, t * 1.6, 1.3); h.torso.rotation.x = 0.3; h.arms[0].rotation.x = 2.6; h.arms[1].rotation.x = 2.4; // hands over the head
      h.group.position.set(s.x, K.hgt(s.x, s.z), s.z); h.group.rotation.set(0, s.yaw, 0);
      if (f.t <= 0) { s.flee = null; if (s.role === 'junkie') { s.st = 'wander'; s.t = 4; s.tx = null; } else { s.on = false; s.gone = K.T + 150; h.group.visible = false; s.st = 'idle'; s.hp = null; s.assaulted = false; } }
      return true; }
    return false;
  }
  function hittable(s) {
    return s.hitObj ||= { get x() { return s.x; }, get y() { return K.hgt(s.x, s.z) + (s.st === 'down' ? 0.35 : 1.15); }, get z() { return s.z; }, r: 0.62, kind: 'street_' + s.role,
      get alive() { return !!(s.on && !s.dead && s.h && s.h.group.visible); }, hostile: false, hit: (d, how, from, knock) => hurt(s, d, how, from, knock) };
  }
  return {
    build(g) { root = g; drops = []; },
    dispose() { root = null; drops = []; },
    always(dt, c) { if (c?.world) patch(c.world); },
    tick(dt, t, P) {
      for (const d of [...drops]) { d.t += dt; d.g.rotation.y += dt * 0.6; if (d.t > 90) { root?.remove(d.g); drops = drops.filter(x => x !== d); continue; }
        if (!P.driving && d.t > 0.6 && Math.hypot(P.x - d.x, P.z - d.z) < 1.5) take(d); }
    },
    acts: () => [],
    hurt, kill, drive, hittable, bleed, crumple, witnesses, drop,
    drops: () => drops.map(d => ({ x: +d.x.toFixed(2), z: +d.z.toFixed(2), cash: d.cash, item: d.item, qty: d.qty, who: d.who })),
    debug: () => ({ ...dbg, drops: drops.length })
  };
}
