// Mars jetpack (Pumpkin): pure math, no DOM and no THREE (unit-tested in tests/test-jetpack-unit.mjs).
// The surface step (surface.js walk) still owns the on-foot body: it integrates player.vy under Mars gravity (0.38 g) and
// lands you. Each frame after it we add thrust, hand back part of g for the gravity modes, steer in the air, burn and
// refill fuel, and decide whether ColSec shot you down.
export const PRICE = 2000;
export const FUEL_MAX = 100;
export const BURN = 20;           // fuel/s at full thrust (MARS): ~5 s of climb from a full tank
export const REFILL = 40;         // fuel/s back once you're standing on the ground
export const REFILL_DELAY = 0.35; // s on the ground before the refill starts (no hop-to-refill exploit)
export const MIN_START = 6;       // need this much fuel to light up from empty
export const THRUST = 9.5;        // m/s^2 up while thrusting (Mars g is 3.73, so ~+5.8 net)
export const MAX_UP = 7;          // m/s climb cap
export const CEIL = 60;           // m above the ground: no thrust above this
export const AIR_EXTRA = 5;       // m/s of extra air speed on the stick while you're flying (on top of walk speed)
// gravity modes from mars/gravity.js (SSX.gravity.mode). Fraction of Mars gravity you feel while airborne.
export const G_SCALE = { 'MARS': 1, 'LOW-G': 0.4, 'ZERO-G': 0 };
export const BURN_SCALE = { 'MARS': 1, 'LOW-G': 0.75, 'ZERO-G': 0.5 };
export const ZG_SINK = -1.5;      // ZERO-G: let go of Jump and you drift down this fast (m/s)...
export const ZG_DIVE = -7;        // ...or this fast holding ▼
export const ZG_RATE = 2.5;       // 1/s: how fast vy follows the ZERO-G target
// cops: 3 stars or more and a ColSec unit can see you in the air -> they shoot at you
export const SHOOT_STARS = 3;
export const SHOOT_ALT = 2.5;     // m above the ground before they bother aiming at you
export const SHOT_EVERY = 1.2;    // s between hits at 3 stars (faster at 4-5)
export const HITS_TO_DOWN = 3;    // hits until the pack is shot out (2 at 5 stars)
export const DOWN_SECS = 8;       // s the thrusters stay dead after a shoot-down
export const HIT_DMG = 4;         // hp per hit (+1 per star)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const gScale = m => G_SCALE[m] ?? 1;
export const normMode = m => (m in G_SCALE ? m : 'MARS');
export const fresh = () => ({ fuel: FUEL_MAX, ground: 0, lit: false, down: 0, hits: 0, shotT: 0, flying: false });
// what you feel while airborne in this mode, given the planet's g (m/s^2): the extra vy (m/s) to hand back this frame
// (surface.js already pulled g * dt; LOW-G gives back 60% of it, ZERO-G all of it)
export function handBack(mode, g, dt, airborne) { return airborne ? g * (1 - gScale(mode)) * dt : 0; }

// can the thrusters fire this frame?
export function canThrust(s, { jump, alt }) {
  if (!jump || s.down > 0) return false;
  if (alt >= CEIL) return false;
  return s.lit ? s.fuel > 0 : s.fuel >= MIN_START;
}

// one frame of jetpack vertical physics + fuel. Mutates s, returns the new vy.
// inp: { jump, dive, airborne, alt, vy, g, mode, dt }
export function step(s, inp) {
  const { dt } = inp, mode = normMode(inp.mode);
  let vy = inp.vy;
  const shot = s.down > 0; // shot out: no thrust and no float, you drop at full Mars gravity
  if (shot) s.down = Math.max(0, s.down - dt);
  const thrust = canThrust(s, inp);
  s.lit = thrust;
  if (inp.airborne && !shot) vy += handBack(mode, inp.g, dt, true);
  if (thrust) {
    vy = Math.min(MAX_UP, vy + THRUST * dt);
    s.fuel = Math.max(0, s.fuel - BURN * (BURN_SCALE[mode] ?? 1) * dt);
  }
  if (mode === 'ZERO-G' && inp.airborne && !thrust && !shot && s.flying) { // float: ease toward a gentle sink (or a dive on ▼)
    const tgt = inp.dive ? ZG_DIVE : ZG_SINK;
    vy += (tgt - vy) * (1 - Math.exp(-ZG_RATE * dt));
  }
  if (inp.airborne) { s.ground = 0; if (thrust) s.flying = true; }
  else {
    s.ground += dt; s.flying = false;
    if (s.ground >= REFILL_DELAY) s.fuel = Math.min(FUEL_MAX, s.fuel + REFILL * dt);
  }
  return vy;
}

// extra air-steer for this frame: stick/WASD (mx right, mz forward, each -1..1) turned into world dx, dz (yaw like surface.js)
export function airSteer(mx, mz, yaw, dt, flying) {
  if (!flying) return [0, 0];
  let len = Math.hypot(mx, mz); if (len < 0.05) return [0, 0];
  if (len > 1) { mx /= len; mz /= len; len = 1; }
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return [(fx * mz + rx * mx) * AIR_EXTRA * dt, (fz * mz + rz * mx) * AIR_EXTRA * dt];
}

// ColSec fire at a flying jetpack. Mutates s; returns null | 'hit' | 'down'.
// inp: { stars, flying, alt, seen, dt }
export function shootStep(s, { stars, flying, alt, seen, dt }) {
  stars = stars | 0;
  if (stars < SHOOT_STARS || !flying || alt < SHOOT_ALT || seen === false || s.down > 0) { s.shotT = 0; if (stars < SHOOT_STARS) s.hits = 0; return null; }
  s.shotT += dt;
  const every = SHOT_EVERY * (stars >= 5 ? 0.6 : stars >= 4 ? 0.8 : 1);
  if (s.shotT < every) return null;
  s.shotT = 0; s.hits++;
  if (s.hits >= hitsToDown(stars)) { s.hits = 0; s.down = DOWN_SECS; s.lit = false; s.fuel = 0; return 'down'; }
  return 'hit';
}
export const hitsToDown = stars => (stars | 0) >= 5 ? 2 : HITS_TO_DOWN;
export const hitDamage = stars => HIT_DMG + clamp(stars | 0, 0, 5);
export const fuelPct = s => Math.round(clamp(s.fuel / FUEL_MAX, 0, 1) * 100);
