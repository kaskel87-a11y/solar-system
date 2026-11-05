// Hostage (Pumpkin): pure logic for snatching a rival gang lieutenant and hauling him to Frostbite Benny's lane.
// No THREE, no DOM: the runtime (mars/hostage.js) and tests/test-hostage-unit.mjs both import this.
//
// Who: rival lieutenants. citydata.js is the source of truth for where gang muscle stands (Red Tape Flats
// DISTRICT_DATA.rough.spawns.gang_spawn, origin_aj) and for its own named lieutenants (contacts whose blurb says
// "lieutenant"). Named citydata lieutenants that give story missions (Marrow) are never snatchable, so a haul can't
// break a mission chain; the crews' road lieutenants (the same three Frostbite Benny knows, icecapcore LIEUTENANTS)
// fill the roster.
import { DISTRICT_DATA, CITY_MISSIONS } from '../citydata.js';
import { LIEUTENANTS } from './icecapcore.js';

export const FLATS_ID = 'mars-rough';
export const FLATS = DISTRICT_DATA.rough;
export const FLATS_AJ = FLATS.coords.origin_aj.slice();
export const GANG_SPOTS = (FLATS.spawns.gang_spawn || []).map(p => p.slice());
const GIVERS = new Set(CITY_MISSIONS.map(m => m.giver));

// citydata contacts that are lieutenants: [{ name, gang, story }] (story = gives missions -> off limits)
export function citydataLieutenants(data = DISTRICT_DATA, missions = CITY_MISSIONS) {
  const givers = missions === CITY_MISSIONS ? GIVERS : new Set(missions.map(m => m.giver)), out = [];
  for (const [k, d] of Object.entries(data)) for (const c of d.contacts || []) if (/lieutenant/i.test(c.blurb || '')) out.push({ name: c.name, faction: c.faction, district: k, at: c.at, story: givers.has(c.name) });
  return out;
}
const GANG_OF = f => /saltblood/i.test(f) ? 'saltblood' : /dustjaw/i.test(f) ? 'dustjaws' : /saint/i.test(f) ? 'saints' : 'free';
const COL = { saltblood: 0xe0282e, dustjaws: 0xffa020, saints: 0xb07cff, free: 0x777777 };
// the snatchable roster: free citydata lieutenants first, then the crews' road lieutenants; each one gets a citydata gang spot
export function roster(data = DISTRICT_DATA, missions = CITY_MISSIONS, road = LIEUTENANTS) {
  const free = citydataLieutenants(data, missions).filter(l => !l.story).map(l => ({ id: l.name.toLowerCase().replace(/\W+/g, ''), name: l.name, gang: GANG_OF(l.faction), gangName: l.faction, col: COL[GANG_OF(l.faction)], src: 'citydata' }));
  const spots = ((data.rough || FLATS).spawns.gang_spawn || GANG_SPOTS);
  return [...free, ...road.map(l => ({ ...l, src: 'road' }))].map((l, i) => ({ ...l, spot: spots[i % spots.length].slice() }));
}
export const ROSTER = roster();

// ---------- tuning ----------
export const HP = 4;               // punches / shots to put him down (fists do 1, the third combo hit 2)
export const DOWN_S = 14;          // seated with birdies, grabbable, then he gets back up
export const HANDS_S = 10;         // hands up after being cornered, then he bolts again
export const CORNER_R = 2.6, CORNER_T = 1.4; // stay this close this long and he gives up
export const GRAB_R = 2.8, PUNCH_R = 2.6;
export const NOTICE_R = 14;        // walk this close (or hit him) and he runs
export const FLEE_V = 6.2;         // player sprints at 9
export const LEASH = 46;           // he never runs further than this from his spot: the Flats wall corners him
export const CAR_KO_V = 5, CAR_KO_R = 2.4;
export const TELEPORT = 40;        // player moved more than this in one frame: fast travel / district hop / respawn
export const FOLLOW = 1.7;
export const DELIVER_R = 30;       // from Benny's lane (SSX.icecap.place())
export const PAY = { cr: 150, stars: 25 };
export const BACK_S = { delivered: 240, released: 45 };
export const LINES = {
  notice: ['Nope. Not today.', 'You don\u2019t know who I work for!', 'Ha! Catch me first.'],
  hit: ['OW!', 'My nose!', 'Okay, OKAY!', 'Not the face!'],
  down: ['Seeing stars\u2026', 'Mommy?', 'Ugh. Tweet tweet.'],
  hands: ['Fine! Fine! Hands up!', 'Truce! I got a bad knee!'],
  held: ['Where we going?', 'You\u2019re making a big mistake.', 'Can we stop for a snack?', 'My crew\u2019s gonna laugh at you.', 'These ties pinch.'],
  car: ['Not the trunk!', 'At least crack a window.'],
  jet: ['I hate heights! I HATE HEIGHTS!', 'Put me DOWN! Wait, not here!'],
  cold: ['Why is it getting cold?', 'Oh no. Not Benny. Anyone but Benny.'],
  benny: 'Benny: \u201cWell, well. Ten pins and a fella who owes me. Nice haul, kid. Here\u2019s your finder\u2019s fee.\u201d',
  free: 'He hops off, wrists still zip-tied, swearing he\u2019ll get you.'
};

// ---------- geometry ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
// world position of a Flats-local point; flats = the live district {x,z} (colony.districts) or the colony centre + origin_aj
export function flatsWorld(local, flats, colony) {
  if (flats && Number.isFinite(flats.x)) return { x: flats.x + local[0], z: flats.z + local[1] };
  const c = colony || { x: 0, z: 0 }; return { x: c.x + FLATS_AJ[0] + local[0], z: c.z + FLATS_AJ[1] + local[1] };
}
export function dirName(fx, fz, tx, tz) { // compass from (fx,fz) to (tx,tz); -z is north (world.js axes)
  const a = (Math.atan2(tx - fx, -(tz - fz)) * 180 / Math.PI + 360) % 360; return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8];
}
export const fmtDist = m => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : m >= 100 ? `${Math.round(m / 10) * 10} m` : `${Math.round(m)} m`;

// ---------- who is out ----------
// the lieutenant on the street right now: not cooling down, not the one already at Benny's hut
export function pickActive(back, nowS, hutId = null, list = ROSTER) {
  let best = null;
  for (const L of list) { if (L.id === hutId) continue; const b = back?.[L.id] || 0; if (b > nowS) continue; if (!best || b < (back?.[best.id] || 0)) best = L; }
  return best;
}

// ---------- the lieutenant (state machine) ----------
// state: idle (smoking by his spot) | flee | hands (cornered, hands up) | down (KO, stars) | held | gone
export function fresh(L, home) { return { id: L.id, state: 'idle', x: home.x, z: home.z, hx: home.x, hz: home.z, yaw: 0, hp: HP, t: 0, corner: 0, spooked: false, hits: 0 }; }
export function hit(n, dmg = 1) {
  if (!n || n.state === 'held' || n.state === 'gone' || n.state === 'down') return null;
  n.hp -= Math.max(0.5, dmg); n.hits++; n.spooked = true;
  if (n.hp <= 0) { n.state = 'down'; n.t = DOWN_S; n.hp = 0; return 'down'; }
  if (n.state === 'idle' || n.state === 'hands') { n.state = 'flee'; n.t = 0; }
  return 'hit';
}
export function carHit(n, carSpeed, d) { if (!n || !['idle', 'flee', 'hands'].includes(n.state) || Math.abs(carSpeed) < CAR_KO_V || d > CAR_KO_R) return false; n.state = 'down'; n.t = DOWN_S; n.hp = 0; n.hits++; return true; }
// one AI step. p = player {x,z}; solid(x,z) -> true where he can't step; returns an event name or null
export function step(n, p, dt, solid = () => false) {
  if (!n) return null; const d = dist(n.x, n.z, p.x, p.z);
  if (n.state === 'down') { n.t -= dt; if (n.t <= 0) { n.state = 'flee'; n.hp = 2; n.corner = 0; return 'up'; } return null; }
  if (n.state === 'hands') { n.t -= dt; n.yaw = Math.atan2(-(p.x - n.x), -(p.z - n.z)); if (n.t <= 0 && d > CORNER_R) { n.state = 'flee'; n.corner = 0; return 'bolt'; } return null; }
  if (n.state === 'idle') { n.t += dt; if (d < NOTICE_R) { n.state = 'flee'; n.spooked = true; return 'notice'; } return null; }
  if (n.state !== 'flee') return null;
  // run directly away, sliding along walls; the leash pulls him back toward home so he ends up pinned at the edge
  let ax = n.x - p.x, az = n.z - p.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  const hd = dist(n.x, n.z, n.hx, n.hz); if (hd > LEASH * 0.7) { const k = clamp((hd - LEASH * 0.7) / (LEASH * 0.3), 0, 1), hx = (n.hx - n.x) / hd, hz = (n.hz - n.z) / hd; ax = ax * (1 - k) + hx * k * 0.6; az = az * (1 - k) + hz * k * 0.6; }
  const v = d > 30 ? FLEE_V * 0.35 : FLEE_V; let moved = false;
  for (const [rx, rz] of [[ax, az], [az, -ax], [-az, ax]]) { const nx = n.x + rx * v * dt, nz = n.z + rz * v * dt; if (!solid(nx, nz) && dist(nx, nz, n.hx, n.hz) <= LEASH) { n.x = nx; n.z = nz; n.yaw = Math.atan2(-rx, -rz); moved = true; break; } }
  if (d < CORNER_R) n.corner += dt * (moved ? 1 : 2); else n.corner = Math.max(0, n.corner - dt * 0.5);
  if (n.corner >= CORNER_T) { n.state = 'hands'; n.t = HANDS_S; n.corner = 0; return 'hands'; }
  if (d > 60) { n.state = 'idle'; n.x = n.hx; n.z = n.hz; return 'calm'; } // lost you: back to his spot
  return null;
}
export const grabbable = (n, d) => !!n && (n.state === 'down' || n.state === 'hands') && d < GRAB_R;
export function grab(n) { if (!n || !(n.state === 'down' || n.state === 'hands')) return false; n.state = 'held'; n.t = 0; return true; }

// ---------- hauling ----------
// where the captive goes this frame. mode: foot | car | jet. returns { x, z, lift (m above ground), yaw, pose }
export function follow(c, p, mode, dt, car = null) {
  if (mode === 'car' && car) { const yaw = car.yaw || 0, bx = Math.sin(yaw), bz = Math.cos(yaw), back = car.back ?? 1.3; return { x: car.x + bx * back, z: car.z + bz * back, lift: (car.top ?? 1.05) + (car.alt || 0), yaw: yaw + Math.PI / 2, pose: 'trunk' }; } // across the roof / trunk, measured by the runtime
  if (mode === 'jet') return { x: p.x, z: p.z, lift: Math.max(0, (p.alt || 0) - 3.4), yaw: c.yaw, pose: 'dangle', abs: (p.y ?? 0) - 1.7 - 3.4 };
  const d = dist(c.x, c.z, p.x, p.z); let x = c.x, z = c.z;
  if (d > FOLLOW) { const k = (d - FOLLOW) / d; x += (p.x - c.x) * k; z += (p.z - c.z) * k; }
  const yaw = d > 0.05 ? Math.atan2(-(p.x - x), -(p.z - z)) : c.yaw; return { x, z, lift: 0, yaw, pose: d > FOLLOW + 0.02 ? 'hop' : 'stand' };
}
export const teleported = (prev, p) => !!prev && dist(prev.x, prev.z, p.x, p.z) > TELEPORT;
export function canDeliver(p, benny) { return !!benny && dist(p.x, p.z, benny.x, benny.z) < DELIVER_R; }
export function captiveOf(L) { return { id: L.id, name: L.name, gang: L.gang, gangName: L.gangName, col: L.col }; }
export function afterHaul(back, id, nowS, how = 'delivered') { return { ...(back || {}), [id]: nowS + (BACK_S[how] ?? 60) }; }

// ---------- taps ----------
export const TAP_PX = 10;
export function isRealTap(down, up, maxMove = 0) { return !!down && !!up && down.id === up.id && Math.max(maxMove, Math.hypot(up.x - down.x, up.y - down.y)) < TAP_PX; }
