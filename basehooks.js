// THE ONE PLACE base.js talks to core (same shim pattern as planets/hooks.js, racehooks.js, heisthooks.js).
// Credits and medkits go through game.spend / game.reward / game.progress; heat through the v7.4 world add-on API
// (world.wanted, world.securityList(), world.hitWorld). Import URLs must match the core's ?v= exactly (shared module instances).
export { addMenuItem, tap } from './racehooks.js';

export const credits = game => game?.progress?.credits | 0;
// take credits; false (and nothing changes) if you can't afford it
export function spend(game, n) { if (!(n > 0)) return true; return typeof game?.spend === 'function' ? !!game.spend(n) : false; }
export function give(game, n) { if (!(n > 0)) return; if (typeof game?.reward === 'function') game.reward(0, n); else if (typeof game?.bonus === 'function') game.bonus(n); }
export const medkits = game => game?.progress?.inv?.medkits | 0;
export function addMedkits(game, n) { const P = game?.progress; if (!P?.inv) return false; P.inv.medkits = Math.max(0, (P.inv.medkits | 0) + n); game.save?.(); return true; }
export const heat = world => world ? { wanted: world.wanted | 0, evading: !!world.evading } : { wanted: 0, evading: false };
// colony security units (only exist while you're wanted), world coords
export const security = world => world?.securityList?.() || [];
// one turret round from p0 to p1 (THREE.Vector3s): the core's bolt test (hits the first security unit / person on the line;
// counts as your crime, like your own gunfire would)
export function shoot(world, p0, p1, dmg) { return typeof world?.hitWorld === 'function' ? !!world.hitWorld(p0, p1, { dmg }) : false; }
export const colonyAt = (world, aj) => world?.colonyAt?.(aj) || null;
export const indoors = world => !!world?.inside;
// park a vehicle state object (your rover) at x, z facing yaw
export function parkVehicle(v, x, z, yaw, y) { if (!v) return false; v.x = x; v.z = z; v.yaw = yaw; v.y = y; v.vy = 0; v.speed = 0; v.prevG = null; if ('fuel' in v) v.fuel = 100; return true; }
export const toast = (m, ms) => (typeof window !== 'undefined' && window.__app?.toast?.(m, ms));
