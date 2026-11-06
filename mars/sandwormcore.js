// Sandworm rules (pure, unit-tested by tests/test-sandworm-unit.mjs). The fight follows /workspace/story/worm-mission.md:
// phase 1 dust plumes (hit 3 surfacings), phase 2 the 40 m worm (pop 4 gill sacs, dodge lunges + acid spit, it eats a plot
// every 20 s), phase 3 it dives and charges the silo (ram it with a rover/harvester or torch it to stun, then shoot the maw).
// Fiction only. Losses are partial: it can eat at most half the plots, then it goes back under.
export const SAVE_KEY = 'ssx.sandworm.v1';
export const WHO = 'Tully';
export const LINES = {
  intro: "Ground's shakin', boss! Somethin' big under the rows, it's eatin' the crop!",
  win: "Worm's down! Hell of a fertilizer.",
  lose: "It's gone back under, and so's half the farm."
};
export const P = { PLUMES: 1, SACS: 2, CHARGE: 3 };
export const TUNE = {
  surfacings: 3, plumeHits: 2, plumeAutoS: 22,            // phase 1
  sacs: 4, sacHp: 6, eatEveryS: 20,                       // phase 2 (v7.5.74: HP in bullet damage; a rifle bolt is 1.1)
  lungeEveryS: 7, lungeWindS: 1.1, lungeR: 4, lungeDmg: 22,
  spitEveryS: 4.5, spitFlightS: 1.4, spitR: 2.4, spitDmg: 10,
  chargeFrom: 42, chargeSpeed: 6.5, ramSpeed: 6, ramR: 4.5, // phase 3
  flameNeedS: 1.2, flameR: 9, flameCos: 0.75, stunS: 6, mawHp: 20,
  // v7.5.74 aim pays (Collin: it took forever): weak-point hits crit, the armoured body only chips; a shot to the charging
  // plume head builds a stun too, so plain guns can open the maw (ram + flamethrower still stun at once)
  crit: { sac: 3, maw: 4 }, chip: 0.12, headStun: 4.4, minDmg: 0.5, maxDmg: 12,
  length: 40, leaveR: 140, atFarmR: 40,
  triggerDays: 3, triggerChance: 0.06, storyHarvests: 2
};
export const PAY = { cr: 1500, stars: 150, tooth: 800 };
export const STAR_RATE = 1;

export const fresh = () => ({ v: 1, lastDay: -99, harvests: 0, story: false, teeth: 0, eaten: [], stats: { spawns: 0, kills: 0, losses: 0, eaten: 0, sold: 0 } });
export function migrate(raw) {
  const s = fresh(); let o = null;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  if (!o || typeof o !== 'object') return s;
  const n = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  s.lastDay = n(o.lastDay, -99); s.harvests = Math.max(0, n(o.harvests) | 0); s.story = o.story === true; s.teeth = Math.max(0, Math.min(99, n(o.teeth) | 0));
  if (Array.isArray(o.eaten)) s.eaten = o.eaten.filter(e => e && (e.farm === 'farm' || e.farm === 'farm2') && Number.isFinite(+e.day)).slice(0, 24);
  if (o.stats && typeof o.stats === 'object') for (const k of Object.keys(s.stats)) s.stats[k] = Math.max(0, n(o.stats[k]) | 0);
  return s;
}

// at most half the plots (rounded down, at least 1) before it gives up: "so's half the farm"
export const eatCap = nPlots => Math.max(1, Math.floor(Math.max(0, nPlots | 0) / 2));
// the next plot to eat: ripe first, then growing; skip ones already eaten this fight; nearest to `from`
export function pickPlot(plots, eatenKeys, from) {
  const ok = (plots || []).filter(p => p && p.crop && !(eatenKeys && eatenKeys.has(p.key)));
  if (!ok.length) return null;
  const d = p => (from ? Math.hypot(p.x - from.x, p.z - from.z) : 0);
  ok.sort((a, b) => (b.ripe - a.ripe) || (d(a) - d(b)));
  return ok[0];
}
export function canTrigger(s, day, roll, chance = TUNE.triggerChance) { return Number.isFinite(day) && day - s.lastDay >= TUNE.triggerDays && roll < chance; }
export const storyDue = s => !s.story && s.harvests >= TUNE.storyHarvests;

// segment p0->p1 vs sphere (c, r): the hit fraction 0..1, or -1
export function segHit(p0, p1, c, r) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z, L2 = dx * dx + dy * dy + dz * dz;
  let t = L2 > 0 ? ((c.x - p0.x) * dx + (c.y - p0.y) * dy + (c.z - p0.z) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
  const x = p0.x + dx * t - c.x, y = p0.y + dy * t - c.y, z = p0.z + dz * t - c.z;
  return x * x + y * y + z * z <= r * r ? t : -1;
}
export function bez(a, b, c, t) { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y, z: u * u * a.z + 2 * u * t * b.z + t * t * c.z }; }
// bullet damage -> weak-point hits (heavy rounds count double)
export const hitsOf = b => (b && (b.heavy || (Number.isFinite(b.dmg) && b.dmg >= 40)) ? 2 : 1);
// v7.5.74 damage: the bullet's own dmg (rifle 1.1, SMG 0.7, rail 8...), clamped; weak points multiply it, the body chips
export const dmgOf = b => { if (b?.heavy) return TUNE.maxDmg; const d = Number.isFinite(+b?.dmg) ? +b.dmg : 1; return Math.max(TUNE.minDmg, Math.min(TUNE.maxDmg, d)); };
export const critDmg = (b, where) => dmgOf(b) * (TUNE.crit[where] || 1);
export const chipDmg = b => dmgOf(b) * TUNE.chip;

// ---------- the fight (plain data; mars/sandworm.js drives the visuals) ----------
export function newFight(nPlots) {
  return { phase: P.PLUMES, surf: 0, plumeHp: TUNE.plumeHits, autoT: TUNE.plumeAutoS, sacs: Array(TUNE.sacs).fill(TUNE.sacHp), maw: TUNE.mawHp,
    stun: 0, flame: 0, head: 0, eaten: 0, cap: eatCap(nPlots), eatT: TUNE.eatEveryS, lungeT: TUNE.lungeEveryS, spitT: TUNE.spitEveryS, over: null };
}
// a plume took hits: true when it surfaces (3 surfacings ends phase 1)
export function hitPlume(f, n = 1) {
  if (f.phase !== P.PLUMES || f.over) return false;
  f.plumeHp -= n; if (f.plumeHp > 0) return false;
  return surface(f);
}
export function surface(f) { f.surf++; f.plumeHp = TUNE.plumeHits; f.autoT = TUNE.plumeAutoS; if (f.surf >= TUNE.surfacings) { f.phase = P.SACS; f.eatT = TUNE.eatEveryS; } return true; }
export const sacsLeft = f => f.sacs.filter(h => h > 0).length;
// a gill sac took damage (already crit-scaled by the caller): 'pop' when it bursts, 'phase' when the last one goes
export function hitSac(f, i, n = 1) {
  if (f.phase !== P.SACS || f.over || !(f.sacs[i] > 0)) return null;
  f.sacs[i] = Math.max(0, f.sacs[i] - n); if (f.sacs[i] > 1e-6) return 'hit'; f.sacs[i] = 0;
  if (sacsLeft(f) === 0) { f.phase = P.CHARGE; f.stun = 0; f.flame = 0; return 'phase'; }
  return 'pop';
}
// flame on the charging worm (seconds of cone time) or a ram: stun it so the maw opens
export function flameOn(f, dt) { if (f.phase !== P.CHARGE || f.stun > 0 || f.over) return false; f.flame += dt; if (f.flame >= TUNE.flameNeedS) { stun(f); return true; } return false; }
export function ram(f, speed) { if (f.phase !== P.CHARGE || f.stun > 0 || f.over || !(Math.abs(speed) >= TUNE.ramSpeed)) return false; stun(f); return true; }
export function stun(f) { f.stun = TUNE.stunS; f.flame = 0; f.head = 0; }
// a bullet on the charging plume head (plain guns): true when that stuns it
export function hitHead(f, n = 1) { if (f.phase !== P.CHARGE || f.stun > 0 || f.over) return false; f.head = (f.head || 0) + n; if (f.head >= TUNE.headStun - 1e-6) { stun(f); return true; } return false; }
export function hitMaw(f, n = 1) { if (f.phase !== P.CHARGE || !(f.stun > 0) || f.over) return null; f.maw = Math.max(0, f.maw - n); if (f.maw > 1e-6) return 'hit'; f.maw = 0; f.over = 'win'; return 'win'; }
// the armoured body: a stray shot chips the nearest live sac (phase 2) or the maw while it's stunned (phase 3)
export function chip(f, n, sacI = -1) {
  if (f.over) return null;
  if (f.phase === P.SACS) { let i = sacI; if (!(f.sacs[i] > 0)) i = f.sacs.findIndex(h => h > 0); return i >= 0 ? hitSac(f, i, n) : null; }
  if (f.phase === P.CHARGE && f.stun > 0) return hitMaw(f, n);
  return null;
}
// it ate a plot: 'lose' at the cap (half the farm)
export function ate(f) { f.eaten++; if (f.eaten >= f.cap && !f.over) { f.over = 'lose'; return 'lose'; } return 'ate'; }
// 1 = full health, 0 = dead (phase 1 is 20% of the bar, the sacs 50%, the maw 30%)
export function health(f) {
  const s1 = Math.min(1, f.surf / TUNE.surfacings), s2 = 1 - f.sacs.reduce((a, h) => a + h, 0) / (TUNE.sacs * TUNE.sacHp), s3 = 1 - f.maw / TUNE.mawHp;
  return Math.max(0, Math.min(1, 1 - (0.2 * s1 + 0.5 * s2 + 0.3 * s3)));
}
export function hint(f) {
  if (f.over === 'win') return 'Worm down!'; if (f.over === 'lose') return 'It went back under.';
  if (f.phase === P.PLUMES) return `Shoot or tap the dust plume to make it surface (${f.surf}/${TUNE.surfacings}).`;
  if (f.phase === P.SACS) return `Shoot the glowing gill sacs (${sacsLeft(f)} left). Dodge lunges and acid.`;
  return f.stun > 0 ? 'Stunned! Shoot the open mouth!' : 'It\u2019s charging the silo! Shoot its head, ram it or torch it.';
}
// regrow: after a win, eaten plots come back the next game day
export function due(s, day) { return s.eaten.filter(e => e.regrow && day > e.day); }
export function finish(s, f, day) { for (const e of s.eaten) if (e.fight === s.stats.spawns && e.regrow == null) e.regrow = f.over === 'win' || e.kind === 'chew'; s.lastDay = day; if (f.over === 'win') s.stats.kills++; else s.stats.losses++; s.eaten = s.eaten.filter(e => e.regrow); }
export function payout(s) { s.teeth = Math.min(99, s.teeth + 1); return { cr: PAY.cr, stars: PAY.stars, tooth: 1 }; }
export function sellTooth(s) { if (!(s.teeth > 0)) return { ok: false, why: 'No Worm Tooth to sell.' }; s.teeth--; s.stats.sold++; return { ok: true, cr: PAY.tooth }; }
export function makeActGuard(now, ms = 300) { let busy = false, last = {}; return { run(k, fn) { const t = now(); if (busy || (k in last && t - last[k] < ms)) return { ok: false, dup: true }; busy = true; last[k] = t; try { return fn(); } finally { busy = false; } }, reset() { busy = false; last = {}; } }; }
