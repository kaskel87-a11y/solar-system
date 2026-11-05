// Planum Australe ice cap: pure logic (Pumpkin). No DOM, no three.js, so tests/test-icecap-unit.mjs runs it in node.
// Zone shape + snow height, snowboard physics (carve, ollie, kickers, spins, grabs, wipeouts), the bowling sim
// (frozen boulder vs 9 ice pins + a zip-tied rival as the head pin), 3-frame scoring and the "Strike Season" payouts
// from story/snow-bowling.md, swipe -> aim/spin/power, and the real-tap check.
// World coords: +z is south (screen-down on the map). The landing pad is (0, 0); Ares Junction sits at (0, -200).

export const CX = 40;              // centre line of the run and the lane
export const Z_TOP = 560;          // start gate (summit)
export const Z_BOT = 960;          // finish line, the run ends at Benny's lane
export const H = 52;               // summit height over the lane (m)
export const FOUL = 975;           // bowling foul line (z)
export const PIN0 = 26;            // head pin, metres past the foul line
export const LANE_HALF = 2.6;      // playable lane half-width; gutters out to GUTTER
export const GUTTER = 3.1;
export const KICKS = [650, 735, 815, 890]; // kicker lips (z)
export const KICK_LEN = 10, KICK_H = 2.4, KICK_HALF = 7;
export const BOUNDS = { x0: CX - 175, x1: CX + 175, z0: Z_TOP - 165, z1: 1115 };
export const SPOTS = {
  start: { x: CX, z: Z_TOP - 6 },
  finish: { x: CX, z: Z_BOT },
  benny: { x: CX + 7, z: 966 },
  hut: { x: CX + 11, z: 962 },
  rival: { x: CX - 13, z: 962 },
  arrive: { x: CX + 4, z: 948 },
  foul: { x: CX, z: FOUL - 1.2 },
  lift: { x: CX - 26, z: 952 }
};
export const RENT = 50, RUN_SECS = 90, TRICK_STARS = 5, AIR_CR_PER_S = 20;
export const PAY = { pin: 10, head: 300, strike: 500, perfectCr: 2000, perfectStars: 200 };
// v7.5.59 (m1 balance): the ice isn't perfect. Each roll drifts up to ±WOBBLE rad (a bit more at full power), so a
// dead-straight roll still strikes most of the time but not every time; and Benny pays the Perfect Cold bonus in full
// once per PERFECT_COOL_S. Inside that window a Perfect Cold pays PERFECT_REPEAT (bragging rights, a few stars).
export const WOBBLE = 0.02, PERFECT_COOL_S = 1800, PERFECT_REPEAT = { cr: 0, stars: 25 };
export const wobble = (power, r) => (r * 2 - 1) * WOBBLE * (0.6 + 0.4 * clamp(power ?? 0.7, 0, 1));
export const perfectPay = (lastAt, now) => (!lastAt || now - lastAt >= PERFECT_COOL_S * 1000) ? { cr: PAY.perfectCr, stars: PAY.perfectStars, full: true } : { ...PERFECT_REPEAT, full: false };
export const RIVAL_BACK_S = 90; // he limps off and is back at the hut after this
export const LIEUTENANTS = [
  { id: 'rusty', name: 'Rusty Vane', gang: 'saltblood', gangName: 'Saltblood', col: 0xe0282e },
  { id: 'jawbone', name: 'Jawbone Pike', gang: 'dustjaws', gangName: 'Dustjaw Boys', col: 0xffa020 },
  { id: 'deacon', name: 'Deacon Hollow', gang: 'saints', gangName: 'Vacuum Saints', col: 0xb07cff }
];
export const LINES = {
  benny: 'Ten pins, one lane, and one fella who owes me. Pick your target.',
  bennyNoRival: 'No fella, no head pin. Grab that lieutenant by the hut and drag him over.',
  bennyTie: 'Hold still, sunshine. Benny ties a lovely knot.',
  bennyRetie: 'Up you get. Same spot, same knot.',
  bennyRent: 'Board\u2019s 50 cr. Lift takes you to the top. Ninety seconds, try not to die.',
  rival: ['You\u2019re insane!', 'This ain\u2019t regulation!'],
  hit: ['OOF!', 'My spine!', 'Not the face!', 'I felt that in my teeth!'],
  limp: ['You\u2019ll pay for this, Benny!', 'I\u2019m telling my crew!', 'Next time I\u2019m the bowler!']
};

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const inBounds = (x, z) => x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1;

// ---------- terrain ----------
// how much of the ice cap is here (0 = plain Mars, 1 = full snow shape)
export function mask(x, z) {
  if (!inBounds(x, z)) return 0;
  return (1 - smooth(120, 170, Math.abs(x - CX))) * smooth(Z_TOP - 160, Z_TOP - 60, z) * (1 - smooth(1050, 1110, z));
}
// the run's own height: summit plateau, concave fall line, side walls, kickers with a sheer lip, soft moguls off-piste
export function shape(x, z) {
  const dx = Math.abs(x - CX), s = (z - Z_TOP) / (Z_BOT - Z_TOP);
  let y = s <= 0 ? H : s >= 1 ? 0 : H * Math.pow(1 - s, 1.4);
  y += 16 * smooth(16, 72, dx) * (1 - 0.6 * smooth(Z_BOT - 10, Z_BOT + 30, z));
  for (const k of KICKS) { const u = z - (k - KICK_LEN); if (u > 0 && u < KICK_LEN) y += KICK_H * Math.pow(u / KICK_LEN, 1.5) * (1 - smooth(KICK_HALF - 2, KICK_HALF, dx)); }
  if (dx > 22) y += 0.45 * Math.sin(x / 6.3) * Math.sin(z / 7.9) * smooth(22, 34, dx);
  return y;
}
// SSX_GROUND hook: blend the plain Mars height h0 into the ice cap
export function groundY(x, z, h0) { const m = mask(x, z); return m <= 0 ? h0 : h0 + (shape(x, z) - h0) * m; }
export const onSnow = (x, z) => mask(x, z) > 0.55;
export const nearZone = (x, z, pad = 250) => x > BOUNDS.x0 - pad && x < BOUNDS.x1 + pad && z > BOUNDS.z0 - pad && z < BOUNDS.z1 + pad;
export const onPiste = (x, z) => Math.abs(x - CX) < 22 && z > Z_TOP - 30 && z < Z_BOT + 8;
export const atLane = (x, z) => Math.abs(x - CX) < 5 && z > FOUL - 7 && z < FOUL + 2;
// rocks: none on the snow (boulders stay in the plain wastes around it)
export const rockFree = (x, z) => mask(x, z) > 0.05;

// ---------- snowboard ----------
export const BOARD = { G: 9.81, GA: 9.0, DRAG: 0.0024, FRIC: 0.25, TURN: 1.9, SPIN: 6.2, VMAX: 34, OLLIE: 4.3, PUSH0: 6, SKATE: 3, SKATE_V: 7 };
export function freshBoard(x, z, head = Math.PI) { return { x, z, y: 0, vy: 0, v: 0, head, spin: 0, spinAcc: 0, air: false, airT: 0, grabT: 0, wip: 0, lean: 0 }; }
// one physics step. inp: { steer -1..1 (right +), tuck 0..1, brake 0..1, jump (pressed this frame), hold (jump held) }
// ground(x, z) -> height. Returns null or a landing event { ok, tricks:[names], stars, cr, airT } / { wipe:true }.
export function boardStep(b, inp, dt, ground) {
  const K = BOARD; let ev = null;
  const steer = clamp(inp.steer || 0, -1, 1);
  if (b.wip > 0) { // wiped out: slide to a stop, get up
    b.wip -= dt; b.v *= Math.exp(-2.5 * dt);
    b.x += -Math.sin(b.head) * b.v * dt; b.z += -Math.cos(b.head) * b.v * dt; b.y = ground(b.x, b.z); b.vy = 0; b.air = false;
    if (b.wip <= 0) { b.wip = 0; b.spin = 0; }
    return null;
  }
  const fx = -Math.sin(b.head), fz = -Math.cos(b.head);
  if (!b.air) {
    const g0 = ground(b.x, b.z), g1 = ground(b.x + fx * 0.6, b.z + fz * 0.6), grade = (g0 - g1) / 0.6;
    const drag = K.DRAG * (1 - 0.45 * clamp(inp.tuck || 0, 0, 1));
    let a = K.G * grade * 0.85 - drag * b.v * b.v - K.FRIC - 7 * clamp(inp.brake || 0, 0, 1) - Math.abs(steer) * b.v * 0.1;
    if (b.v < K.SKATE_V) a += K.SKATE * clamp(inp.tuck || 0, 0, 1); // forward on the flat = skate push
    b.v = clamp(b.v + a * dt, 0, K.VMAX);
    if (b.v < 0.4 && grade < 0.02) { // stalled facing uphill / flat: drift round towards the fall line
      const dh = wrap(Math.PI - b.head); b.head += clamp(dh, -1, 1) * dt * 0.8;
    }
    b.head = wrap(b.head - steer * K.TURN * dt * (0.55 + 0.45 * Math.min(1, b.v / 8)));
    b.lean += (steer - b.lean) * Math.min(1, dt * 8);
    const nx = b.x + -Math.sin(b.head) * b.v * dt, nz = b.z + -Math.cos(b.head) * b.v * dt, gN = ground(nx, nz);
    if (inp.jump) { b.x = nx; b.z = nz; b.vy = K.OLLIE + b.v * 0.04; b.y = Math.max(b.y, gN) + b.vy * dt; b.air = true; b.airT = 0; b.grabT = 0; b.spinAcc = 0; return null; }
    const yb = b.y + b.vy * dt - 0.5 * K.GA * dt * dt;
    b.x = nx; b.z = nz;
    if (gN < yb - 0.04 && b.v > 4) { b.air = true; b.y = yb; b.vy -= K.GA * dt; b.airT = 0; b.grabT = 0; b.spinAcc = 0; }
    else { b.vy = clamp((gN - b.y) / Math.max(dt, 1e-3), -20, 20); b.y = gN; }
    return null;
  }
  // in the air: keep the line, steer spins you, jump held = grab
  b.x += fx * b.v * dt; b.z += fz * b.v * dt; b.vy -= K.GA * dt; b.y += b.vy * dt; b.airT += dt; b.v *= 1 - 0.02 * dt;
  const sp = steer * K.SPIN * dt; b.spin += sp; b.spinAcc += sp;
  if (inp.hold && b.airT > 0.12) b.grabT += dt;
  const gN = ground(b.x, b.z);
  if (b.y <= gN) { b.y = gN; b.vy = 0; b.air = false; ev = landing(b); }
  return ev;
}
export function trickNames(spinAcc, grabT) {
  const out = [], half = Math.round(Math.abs(spinAcc) / Math.PI);
  if (half >= 1) out.push(`${spinAcc < 0 ? 'Frontside' : 'Backside'} ${half * 180}`);
  if (grabT >= 0.35) out.push(grabT >= 0.9 ? 'Method grab' : 'Indy grab');
  return out;
}
export function landing(b) {
  const rel = wrap(b.spin), ok = Math.abs(rel) < 0.8 || Math.abs(rel) > Math.PI - 0.8, airT = b.airT;
  if (!ok) { b.wip = 1.6; b.v *= 0.3; b.spin = 0; b.spinAcc = 0; return { wipe: true, airT }; }
  b.spin = Math.abs(rel) > Math.PI / 2 ? Math.PI : 0; // switch landing rides on backwards
  const tricks = trickNames(b.spinAcc, b.grabT); b.spinAcc = 0; b.grabT = 0;
  const cr = airT >= 0.5 ? Math.round(airT * AIR_CR_PER_S) : 0;
  return { ok: true, tricks, stars: tricks.length * TRICK_STARS, cr, airT, sw: b.spin !== 0 };
}

// ---------- bowling ----------
// lane coords: u = across (x - CX, right of the bowler = -x when facing +z, but the sim only cares about u), w = past the foul line
export const BALL_R = 0.55, PIN_R = 0.26, DOWN_R = 0.42, RIVAL_R = 0.34;
export function rack() { // index 0 = head pin (the rival), then the 9 ice pins
  const out = [], ROW = 0.9;
  for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) out.push({ u: (i - r / 2) * 1.0, w: PIN0 + r * ROW });
  return out;
}
// simulate one roll. t: { aim (rad, + = towards +u), power 0..1, spin -1..1 (hook towards +u), u0 }. standing: bool[10]
// Returns { knocked:[i], count, headHit, gutter, frames:[{ t, b:[u,w], p:[[u,w,down]...] }], fall:[[du,dw]|null], headV:[du,dw]|null }
export function simulate(t, standing = null, opts = {}) {
  const P = rack().map((p, i) => ({ ...p, vu: 0, vw: 0, down: false, gone: !(standing ? standing[i] : true), m: i === 0 ? 2.6 : 1, r: i === 0 ? RIVAL_R : PIN_R, fall: null, hitV: null }));
  const aim = clamp(t.aim || 0, -0.12, 0.12), pw = clamp(t.power ?? 0.7, 0, 1), spin = clamp(t.spin || 0, -1, 1);
  const v0 = 7 + 9 * pw, B = { u: clamp(t.u0 || 0, -LANE_HALF + BALL_R, LANE_HALF - BALL_R), w: 0, vu: Math.sin(aim) * v0, vw: Math.cos(aim) * v0, m: 4, r: BALL_R };
  const dt = 1 / 240, frames = [], every = opts.every || 8; let gutter = false, time = 0, headHit = false, quiet = 0;
  for (let step = 0; step < 240 * 7; step++) {
    time += dt;
    // ball: ice friction, hook grows down the lane
    if (!gutter && B.w < PIN0 + 4) {
      B.vu += spin * 1.7 * clamp(B.w / PIN0, 0, 1.2) * dt;
      const sp = Math.hypot(B.vu, B.vw); if (sp > 0) { const k = Math.max(0, sp - 0.22 * dt) / sp; B.vu *= k; B.vw *= k; }
    }
    B.u += B.vu * dt; B.w += B.vw * dt;
    if (!gutter && Math.abs(B.u) > LANE_HALF && B.w < PIN0 - 1.2) { gutter = true; }
    if (gutter) { B.u = Math.sign(B.u) * (GUTTER - 0.1); B.vu = 0; }
    // pins slide on the ice
    for (const p of P) { if (p.gone) continue; const sp = Math.hypot(p.vu, p.vw); if (sp > 0) { const k = Math.max(0, sp - 1.6 * dt) / sp; p.vu *= k; p.vw *= k; p.u += p.vu * dt; p.w += p.vw * dt; }
      if (p.w > PIN0 + 5 || Math.abs(p.u) > GUTTER + 0.4) { p.gone = true; p.down = true; } }
    // ball vs pins
    if (!gutter) for (let i = 0; i < P.length; i++) { const p = P[i]; if (p.gone) continue; if (collide(B, p)) { if (i === 0 && !headHit) { headHit = true; } knock(p); } }
    // pins vs pins
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j]; if (a.gone || b.gone) continue; if (collide(a, b)) { knock(a); knock(b); } }
    if (step % every === 0) frames.push({ t: +time.toFixed(4), b: [B.u, B.w], p: P.map(p => [p.u, p.w, p.down ? 1 : 0]) });
    const moving = P.some(p => !p.gone && Math.hypot(p.vu, p.vw) > 0.05);
    if (B.w > PIN0 + 6 || (gutter && B.w > PIN0 + 6)) { quiet = moving ? 0 : quiet + dt; if (quiet > 0.3 || B.w > PIN0 + 30) break; }
  }
  frames.push({ t: +time.toFixed(4), b: [B.u, B.w], p: P.map(p => [p.u, p.w, p.down ? 1 : 0]) });
  const knocked = []; P.forEach((p, i) => { if (p.down && (standing ? standing[i] : true)) knocked.push(i); });
  return { knocked, count: knocked.length, headHit: headHit || knocked.includes(0), gutter, frames, fall: P.map(p => p.fall), headV: P[0].hitV, time };
}
function knock(p) { const sp = Math.hypot(p.vu, p.vw); if (!p.down && sp > 0.7) { p.down = true; p.r = p === undefined ? p.r : Math.max(p.r, DOWN_R); p.fall = [p.vu / sp, p.vw / sp]; if (!p.hitV) p.hitV = [p.vu, p.vw]; } }
function collide(a, b) {
  const du = b.u - a.u, dw = b.w - a.w, d = Math.hypot(du, dw), m = a.r + b.r; if (d >= m || d < 1e-6) return false;
  const nu = du / d, nw = dw / d, rel = (a.vu - b.vu) * nu + (a.vw - b.vw) * nw;
  const push = (m - d) / 2; a.u -= nu * push; a.w -= nw * push; b.u += nu * push; b.w += nw * push;
  if (rel <= 0) return true;
  const e = 0.72, j = (1 + e) * rel / (1 / a.m + 1 / b.m);
  a.vu -= j * nu / a.m; a.vw -= j * nw / a.m; b.vu += j * nu / b.m; b.vw += j * nw / b.m;
  return true;
}

// ---------- 3-frame scoring (frame 3 plays like a 10th frame: up to 3 balls) ----------
export const FRAMES = 3;
export function score(rolls) {
  const frames = []; let i = 0, total = 0;
  for (let f = 0; f < FRAMES; f++) {
    const last = f === FRAMES - 1, fr = { rolls: [], marks: [], score: null };
    if (i >= rolls.length) { frames.push(fr); continue; }
    if (!last) {
      if (rolls[i] === 10) { fr.rolls = [10]; fr.marks = ['X']; const b1 = rolls[i + 1], b2 = rolls[i + 2]; if (b1 !== undefined && b2 !== undefined) { total += 10 + b1 + b2; fr.score = total; } i += 1; }
      else { const a = rolls[i], b = rolls[i + 1]; fr.rolls = b === undefined ? [a] : [a, b]; fr.marks = [mark(a)]; if (b !== undefined) { fr.marks.push(a + b === 10 ? '/' : mark(b)); if (a + b === 10) { const c = rolls[i + 2]; if (c !== undefined) { total += 10 + c; fr.score = total; } } else { total += a + b; fr.score = total; } } i += b === undefined ? 1 : 2; }
    } else {
      const r = rolls.slice(i, i + 3); fr.rolls = r; let pinsUp = 10;
      r.forEach((v, k) => { if (v === 10 && pinsUp === 10) fr.marks.push('X'); else if (v + (10 - pinsUp) === 10 && pinsUp < 10) fr.marks.push('/'); else fr.marks.push(mark(v)); pinsUp -= v; if (pinsUp <= 0) pinsUp = 10; });
      const need = r[0] === 10 || r[0] + (r[1] || 0) === 10 ? 3 : 2;
      if (r.length >= need) { total += r.reduce((s, v) => s + v, 0); fr.score = total; }
      i += r.length;
    }
    frames.push(fr);
  }
  return { frames, total, done: isDone(rolls) };
}
const mark = v => v === 0 ? '-' : String(v);
// where the game is: { frame (0-based), ball (0-based within frame), fresh (rack all 10), done }
export function position(rolls) {
  let i = 0;
  for (let f = 0; f < FRAMES; f++) {
    const last = f === FRAMES - 1;
    if (!last) {
      if (i >= rolls.length) return { frame: f, ball: 0, fresh: true, done: false };
      if (rolls[i] === 10) { i += 1; continue; }
      if (i + 1 >= rolls.length) return { frame: f, ball: 1, fresh: false, done: false };
      i += 2; continue;
    }
    const r = rolls.slice(i); if (r.length === 0) return { frame: f, ball: 0, fresh: true, done: false };
    if (r.length === 1) return { frame: f, ball: 1, fresh: r[0] === 10, done: false };
    if (r.length === 2) { const bonus = r[0] === 10 || r[0] + r[1] === 10; if (!bonus) return { frame: f, ball: 2, fresh: false, done: true }; return { frame: f, ball: 2, fresh: r[0] === 10 ? r[1] === 10 : true, done: false }; }
    return { frame: f, ball: 3, fresh: false, done: true };
  }
  return { frame: FRAMES - 1, ball: 0, fresh: false, done: true };
}
export const isDone = rolls => position(rolls).done;
// strikes = every ball that knocked a full rack of 10; perfect = the first ball of all 3 frames was a strike ("Perfect Cold")
export function strikeInfo(rolls) {
  let i = 0, firsts = [], strikes = 0, up = 10;
  for (let f = 0; f < FRAMES && i < rolls.length; f++) {
    firsts.push(rolls[i] === 10);
    if (f < FRAMES - 1) { if (rolls[i] === 10) { strikes++; i += 1; } else i += 2; }
    else { for (const v of rolls.slice(i, i + 3)) { if (v === 10 && up === 10) strikes++; up -= v; if (up <= 0) up = 10; } i += 3; }
  }
  return { strikes, perfect: firsts.length === FRAMES && firsts.every(Boolean) };
}
// story payouts: pins 10 cr each, head-pin hit +300 cr, strike +500 cr, Perfect Cold = 2,000 cr + 200 stars
export function payout(rolls, headHits, rival = true) {
  const pins = rolls.reduce((s, v) => s + v, 0), si = strikeInfo(rolls), heads = rival ? headHits : 0;
  const cr = pins * PAY.pin + heads * PAY.head + si.strikes * PAY.strike + (si.perfect ? PAY.perfectCr : 0);
  return { cr, stars: si.perfect ? PAY.perfectStars : 0, pins, heads, strikes: si.strikes, perfect: si.perfect };
}
// one ball's pay, as it happens (pins + head + strike); Perfect Cold is added once at the end
export function ballPay(count, headHit, strike, rival = true) { return count * PAY.pin + (headHit && rival ? PAY.head : 0) + (strike ? PAY.strike : 0); }

// ---------- swipe pad -> throw ----------
// pts: [{ x, y, t }] in px / ms from pointerdown to pointerup. Up the screen = down the lane.
export function swipeThrow(pts, padH = 300) {
  if (!pts || pts.length < 2) return { ok: false, why: 'Swipe up to roll.' };
  const a = pts[0], b = pts[pts.length - 1], up = a.y - b.y, dx = b.x - a.x;
  if (up < 40) return { ok: false, why: 'Swipe up the pad to roll.' };
  const aim = clamp(Math.atan2(dx, up) * 0.22, -0.1, 0.1);
  const power = clamp(up / Math.max(120, padH * 0.85), 0.15, 1);
  const dirAt = (i0, i1) => Math.atan2(pts[i1].x - pts[i0].x, pts[i0].y - pts[i1].y);
  const n = pts.length, k = Math.max(1, Math.floor(n * 0.35));
  let spin = 0; if (n >= 4) spin = clamp(wrap(dirAt(n - 1 - k, n - 1) - dirAt(0, k)) / 0.7, -1, 1);
  return { ok: true, aim, power, spin: Math.abs(spin) < 0.08 ? 0 : spin };
}
// keyboard / buttons nudge the same three numbers
export function nudge(t, what, d) {
  const o = { aim: t.aim || 0, power: t.power ?? 0.7, spin: t.spin || 0 };
  if (what === 'aim') o.aim = +clamp(o.aim + d * 0.01, -0.1, 0.1).toFixed(3);
  if (what === 'power') o.power = +clamp(o.power + d * 0.05, 0.15, 1).toFixed(3);
  if (what === 'spin') o.spin = +clamp(o.spin + d * 0.25, -1, 1).toFixed(3);
  return o;
}

// ---------- taps ----------
export const TAP_PX = 10;
export function isRealTap(down, up, maxMove = 0) { return !!down && !!up && down.id === up.id && Math.max(maxMove, Math.hypot(up.x - down.x, up.y - down.y)) < TAP_PX; }

// ---------- rival roster ----------
// pick the lieutenant to stand at the hut: the one back the longest; null while all are limping it off
export function nextRival(rivals, now) {
  let best = null;
  for (const L of LIEUTENANTS) { const r = rivals?.[L.id] || {}; if ((r.back || 0) > now) continue; if (!best || (r.back || 0) < (rivals?.[best.id]?.back || 0)) best = L; }
  return best;
}
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
