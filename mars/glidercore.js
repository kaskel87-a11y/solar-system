// v7.5.99 hang glider. Pure numbers. A fast glide, plus jets that climb.
export const PRICE = 1400;
export const JET_PRICE = 1900;
export const SPEED = 28;        // m/s, well above a sprint
export const BOOST_SPEED = 40;  // m/s while the jets are lit
export const SINK = -2.4;       // m/s settled descent
export const LAUNCH_VY = 5.6;   // hop off a running start
export const RUN_SPEED = 6;     // m/s on the ground counts as a running start
export const ALT_MIN = 2.2;     // metres of air you can catch a fall from
export const TURN = 1.7;        // rad/s at full left/right
export const THRUST = 13;       // m/s^2 up with jets
export const MAX_UP = 9;
export const CEIL = 90;
export const FUEL = 100;
export const BURN = 14;         // fuel/s, about 7 s of climb
export const REFILL = 36;
export const HOW = 'Buy it from ☰ → Hang glider. Run and tap Glide, or tap Glide while you fall. Left and Right steer. Jets are on that same page: hold Boost to climb.';

export const fresh = () => ({ flying: false, fuel: FUEL, vx: 0, vz: 0 });

export function canLaunch({ grounded, running, alt, vy, held, flying }) {
  if (!held || flying) return false;
  if (!grounded && alt >= ALT_MIN && vy <= 0.8) return true;
  if (grounded && running) return true;
  return false;
}

// one frame. Mutates s. Returns the pose the player should take.
export function step(s, inp) {
  const dt = Math.max(0, Math.min(0.05, inp.dt || 0));
  let yaw = inp.yaw || 0;
  let vy = inp.vy || 0;
  let launched = false;
  if (canLaunch({ grounded: inp.grounded, running: inp.running, alt: inp.alt, vy, held: inp.held, flying: s.flying })) {
    s.flying = true; launched = true;
    if (inp.grounded) vy = LAUNCH_VY;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    s.vx = fx * SPEED; s.vz = fz * SPEED;
  }
  let thrusting = false;
  if (s.flying) {
    yaw += (inp.steer || 0) * TURN * dt;
    thrusting = !!(inp.jets && inp.boost && s.fuel > 0 && (inp.alt || 0) < CEIL);
    const spd = thrusting ? BOOST_SPEED : SPEED;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const cur = Math.hypot(s.vx, s.vz) || SPEED;
    const nxt = cur + (spd - cur) * Math.min(1, dt * 4);
    s.vx = fx * nxt; s.vz = fz * nxt;
    if (thrusting) { vy = Math.min(MAX_UP, vy + THRUST * dt); s.fuel = Math.max(0, s.fuel - BURN * dt); }
    else vy += (SINK - vy) * Math.min(1, dt * 0.9);
    if (inp.grounded && !launched) { s.flying = false; s.vx = 0; s.vz = 0; vy = 0; }
  } else if (inp.grounded) s.fuel = Math.min(FUEL, s.fuel + REFILL * dt);
  return { flying: s.flying, yaw, vx: s.vx, vz: s.vz, vy, launched, thrusting, fuel: s.fuel };
}
