// THE ONE PLACE heist.js / cameras.js talk to core (same shim pattern as planets/hooks.js and racehooks.js).
// Everything goes through the v7.4 world add-on API: world.setWanted(n, why), world.crime(min, why), world.securityList(),
// world.wanted / evading / inDuel / inside / colony, world.colonyAt([x, z]). No police/security AI lives in the heist code:
// alarms only raise the wanted level and Grok Bot's security (world.js) answers it.
// Import with plain relative paths (no ?v=): index.html's import map adds the version, so every module loads once.
import { alarmAction } from './heistcore.js';
export { addMenuItem, tap } from './racehooks.js';

// raise heat for an alarm. Returns what it did ({ op, n }) so callers / tests can see it.
export function raiseAlarm(world, level, why, opts) {
  if (!world) return { op: 'none', n: 0 };
  const act = alarmAction(level, world.wanted | 0, opts);
  if (act.op === 'setWanted') world.setWanted(act.n, why);
  else if (act.op === 'crime') { const before = world.wanted; world.crime(Math.min(5, level), why); if (world.wanted === before) world.setWanted(act.n, why); } // crime() has a 2.5 s cooldown and needs a colony
  return act;
}
export const heat = world => world ? { wanted: world.wanted | 0, evading: !!world.evading, inDuel: !!world.inDuel } : { wanted: 0, evading: false, inDuel: false };
export function securityNear(world, x, z, r = 80) {
  const list = world?.securityList?.() || [];
  return list.filter(s => Math.hypot(s.x - x, s.z - z) < r).length;
}
// def coords -> world coords. rel:'colony' = relative to the current world's colony centre (Ares Junction on Mars;
// Steve's pack at_aj values are exactly this). Returns null until the colony exists (player not landed yet).
export function toWorld(world, p, rel) {
  if (rel !== 'colony') return { x: p.x, z: p.z };
  const w = world?.colonyAt?.([p.x, p.z]); return w ? { x: w.x, z: w.z } : null;
}
export const isIndoors = world => !!world?.inside;
// payout for self-contained heists (missions normally pay through their own reward block)
export function payout(game, credits) { if (credits > 0 && typeof game?.bonus === 'function') game.bonus(credits); }

// v7.5.4 guards: make our guards hittable by the player's shots / melee / blasts and auto-aim, by wrapping the world's
// hit functions once per world object (same pattern as dangerhooks.patchWorld; the two wrappers chain).
// provider() -> [{ x, y, z, r, alive, hostile, kind, hit(dmg, kind, from) }]
const hitPatched = new WeakMap();
export function patchHittables(world, provider) {
  if (!world || typeof world.hitWorld !== 'function') return false;
  const prev = hitPatched.get(world); if (prev) { prev.provider = provider; return true; }
  const st = { provider }; hitPatched.set(world, st);
  const all = () => (st.provider?.() || []).filter(h => h.alive);
  const oHit = world.hitWorld, oTargets = world.targets, oMW = world.meleeWorld, oMT = world.meleeTarget, oBlast = world.blast;
  const segD = (p0, p1, c) => { const sx = p1.x - p0.x, sy = p1.y - p0.y, sz = p1.z - p0.z, L2 = sx * sx + sy * sy + sz * sz;
    const t = L2 ? Math.max(0, Math.min(1, ((c.x - p0.x) * sx + (c.y - p0.y) * sy + (c.z - p0.z) * sz) / L2)) : 0;
    return Math.hypot(p0.x + sx * t - c.x, p0.y + sy * t - c.y, p0.z + sz * t - c.z); };
  world.hitWorld = (p0, p1, b) => { let best = null, bd = 1e9; for (const h of all()) { if (segD(p0, p1, h) < h.r) { const k = Math.hypot(h.x - p0.x, h.z - p0.z); if (k < bd) { bd = k; best = h; } } }
    if (best) { best.hit(b?.dmg ?? 1, 'shot', p0); return true; } return oHit.call(world, p0, p1, b); };
  if (oTargets) world.targets = () => [...oTargets.call(world), ...all().filter(h => h.hostile).map(h => ({ x: h.x, y: h.y, z: h.z, kind: h.kind }))];
  if (oMT) world.meleeTarget = (x, z, yaw, range) => { const w = oMT.call(world, x, z, yaw, range); let best = null, bd = w ? Math.hypot(w.x - x, w.z - z) : range;
    for (const h of all()) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = { x: h.x, z: h.z, kind: h.kind }; } } return best || w; };
  if (oMW) world.meleeWorld = (x, z, fx, fz, range, dmg, knock) => { for (const h of all()) { const dx = h.x - x, dz = h.z - z, d = Math.hypot(dx, dz);
    if (d < range + 0.5 && dx * fx + dz * fz > -0.3) { h.hit(dmg, 'melee', { x, z }, knock); return true; } } return oMW.call(world, x, z, fx, fz, range, dmg, knock); };
  if (oBlast) world.blast = (c, R, dmg, emp) => { let n = 0; for (const h of all()) { const d = Math.hypot(h.x - c.x, h.z - c.z); if (d < R) { n++; h.hit(emp ? 0.5 : dmg * (1 - d / R), emp ? 'emp' : 'blast', c); } } return n + oBlast.call(world, c, R, dmg, emp); };
  return true;
}
// NPC budget (phones stay <= 12 people): read + reserve through world.npcBudget / npcReserve when core has them
export const npcBudget = world => world?.npcBudget?.() || null;
export const ambientOn = world => world?.debug?.livePeople?.() ?? null;
export function npcReserve(world, key, n) { try { return world?.npcReserve?.(key, n) || null; } catch (e) { return null; } }
export const isMobileish = () => typeof document !== 'undefined' && (document.body?.classList.contains('touch') || matchMedia?.('(pointer: coarse)').matches);
