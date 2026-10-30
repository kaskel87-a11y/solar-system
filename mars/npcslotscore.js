// Reserved NPC slots (pure; runtime in mars/npcslots.js).
// Mission-critical NPCs (heist guards, Kessa Vane the mark, Pit fighters, the bar contact) get their slots no matter
// how full the street is. While any critical slot is held, world.js may trim ambient pedestrians below its usual
// floor of 4 (one guarded hook line in updateZones), so the phone total stays at or under 12.
export const PHONE_CAP = 12, DESK_CAP = 40, AMBIENT_FLOOR = 4;

export const createSlots = () => ({ res: new Map() });
// reserve n slots under key. o.critical: ignore the free budget. o.active(): watchdog, the slot is let go once it
// turns false (mission end, fail or quit). o.keep: when active() ends, keep the count but drop critical (the body stays,
// back on the normal budget).
export function setRes(S, key, n, o = {}) {
  n = Math.max(0, n | 0);
  if (!n) { S.res.delete(key); return 0; }
  S.res.set(key, { n, critical: !!o.critical, active: typeof o.active === 'function' ? o.active : null, keep: !!o.keep });
  return n;
}
export const total = S => [...S.res.values()].reduce((a, r) => a + r.n, 0);
export const criticalSum = S => [...S.res.values()].reduce((a, r) => a + (r.critical ? r.n : 0), 0);
export const anyCritical = S => criticalSum(S) > 0;
// the ambient floor world.js uses: 0 while a mission NPC holds a slot, else the usual 4
export const floor = S => (anyCritical(S) ? 0 : AMBIENT_FLOOR);
// mirror of world.js updateZones: how many ambient pedestrians may show
export function ambientCap({ mobile = true, foot = 0, hum = 0, resv = 0, floor: f = AMBIENT_FLOOR }) {
  return mobile ? Math.max(f, PHONE_CAP - foot - hum - resv) : DESK_CAP - resv;
}
// how many of `want` a spawner may have: critical gets all of them, others only what's free (plus what it already holds)
export function grant(budget, key, want, critical) {
  if (critical || !budget || !Number.isFinite(budget.free)) return want;
  const mine = budget.reserved?.[key] || 0;
  const room = Number.isFinite(budget.cap) && Number.isFinite(budget.used) ? budget.cap - budget.used + mine : budget.free + mine; // over the cap (ambient floor) counts against us
  return Math.max(0, Math.min(want, room));
}
// watchdog: returns [{ key, n }] changes to push to the world (n = 0 releases). When a mission ends the slot stops
// being critical at once (the ambient floor comes back) and the count goes GRACE_S later: every world.npcReserve call
// re-fires world.js's zone toast, which would otherwise cover the purse / fail toast.
export const GRACE_S = 5;
export function sweep(S, now = 0, grace = GRACE_S) {
  const out = [];
  for (const [key, r] of [...S.res]) {
    if (r.releaseAt != null) { if (now >= r.releaseAt) { S.res.delete(key); out.push({ key, n: 0 }); } continue; }
    let alive = true; try { alive = !r.active || !!r.active(); } catch (e) { alive = false; }
    if (alive) continue;
    r.critical = false; r.active = null;
    if (!r.keep) r.releaseAt = now + grace;
  }
  return out;
}
export const list = S => Object.fromEntries([...S.res].map(([k, r]) => [k, { n: r.n, critical: r.critical }]));
