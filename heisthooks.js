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
