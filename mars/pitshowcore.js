// v7.5.29 The Pit as a show (Collin: "when a fight starts make it more of a show with flashing lights, a crowd comes over
// and the fight lasts longer ... when you win/lose make it a big deal, like a star exploding or the character glows up").
// Pure (no DOM, no three.js): shared by world.js (the pit fighter's AI and damage), mars/pitshow.js (lights, crowd, finale)
// and tests/test-pit-unit.mjs (which simulates rounds to check their length).
// Rounds: the best-of-3 series lives in activities/pitseries.js (Ben, v7.5.x); each round is one world.js duel that ends on
// a knockdown. Pit duels pass opts.pit to world.challenge, which swaps the stock 'walk in and swing' AI for aiStep below.

// ---------- fight tuning (fists, a matched opponent; aim 20-40 s a round, 45-120 s a match) ----------
export const TUNE = {
  hp: 100,          // both fighters, reset (healed) every round
  hit: 20,          // DUEL_TYPES.fists.hit: a clean punch from you before toughness
  tough: 5.4,       // pit fighters soak: 20 / 5.4 = ~3.7 hp a clean punch, ~27 clean punches a knockdown
  slip: 0.3,        // share of your punches they slip (bob and weave) while pressing or circling; never mid-flurry
  guardMul: 0.25,   // a punch into a raised guard does a quarter
  oppDmg: 7.6,       // their landed punch (before the per-fighter dmgK)
  oppCd: 1.05,      // their swing interval when pressing (flurry: 0.5)
  hitP: 0.66,       // share of their swings that land
  reach: 1.7,       // their reach (yours is the melee range, 2.6 m with fists)
  walk: 3.3, circle: 3.0, stagger: 0.3, knock: 0.55, // a clean punch shoves them back
  count1: 4.6,      // round 1 count-in (room for the announcer), later rounds 3 s
};
export const MODES = { press: [2.0, 3.6], guard: [1.2, 2.2], circle: [1.6, 2.6], flurry: [1.3, 1.6] };

// small seeded RNG so a round is reproducible in the test
export function rng(seed = 1) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function aiInit(seed = 1) { const r = rng(seed); return { mode: 'press', mt: 2.5, cd: 0.9, stagger: 0, recent: 0, recentT: 0, dir: r() < 0.5 ? 1 : -1, r, swings: 0, guards: 0 }; }
function pick(ai, them) {
  const rally = them < 35, w = rally ? { press: 0.36, guard: 0.16, circle: 0.18, flurry: 0.30 } : { press: 0.38, guard: 0.26, circle: 0.24, flurry: 0.12 };
  let x = ai.r(); let m = 'press'; for (const k of Object.keys(w)) { if ((x -= w[k]) <= 0) { m = k; break; } }
  if (m === ai.mode && m !== 'press') m = 'press';
  const [a, b] = MODES[m]; ai.mode = m; ai.mt = a + ai.r() * (b - a); if (m === 'circle') ai.dir = ai.r() < 0.5 ? 1 : -1; if (m === 'guard') ai.guards++;
}
// one step. d = distance to you. Returns { move: 'in'|'circle'|'hold', swing, guard }
export function aiStep(ai, dt, d, them = 100) {
  ai.cd -= dt; ai.mt -= dt; ai.stagger -= dt; ai.recentT -= dt; if (ai.recentT <= 0) ai.recent = 0;
  if (ai.stagger > 0) return { move: 'hold', swing: false, guard: false };
  if (ai.mt <= 0) pick(ai, them);
  const guard = ai.mode === 'guard';
  if (guard) return { move: d > TUNE.reach + 0.6 ? 'in' : 'hold', swing: false, guard: true };
  if (ai.mode === 'circle') return { move: 'circle', swing: false, guard: false };
  if (d > TUNE.reach) return { move: 'in', swing: false, guard: false };
  if (ai.cd <= 0) { ai.cd = ai.mode === 'flurry' ? 0.5 : TUNE.oppCd * (0.85 + 0.3 * ai.r()); ai.swings++; return { move: 'hold', swing: true, guard: false, land: ai.r() < TUNE.hitP }; }
  return { move: 'hold', swing: false, guard: false };
}
// you landed a punch: how much it does, and the fighter's reaction (stagger; three in a row and they cover up or back off)
export function aiHit(ai) {
  if ((ai.mode === 'press' || ai.mode === 'circle') && ai.stagger <= 0 && ai.r() < TUNE.slip) return { dmg: 0, blocked: false, slipped: true };
  const blocked = ai.mode === 'guard' && ai.stagger <= 0;
  const dmg = TUNE.hit / TUNE.tough * (blocked ? TUNE.guardMul : 1);
  if (!blocked) { ai.stagger = TUNE.stagger; ai.recent++; ai.recentT = 1.6;
    if (ai.recent >= 3 && ai.r() < 0.6) { ai.recent = 0; ai.stagger = 0; ai.mode = ai.r() < 0.5 ? 'guard' : 'circle'; const [a, b] = MODES[ai.mode]; ai.mt = a + ai.r() * (b - a); ai.dir = ai.r() < 0.5 ? 1 : -1; } }
  return { dmg, blocked, slipped: false };
}
export const oppDamage = (dmgK = 1) => TUNE.oppDmg * (dmgK || 1);
export const countIn = round => (round > 1 ? 3 : TUNE.count1);

// ---------- round simulation (the test, and the numbers in the release note) ----------
// player styles: 'spam' (chases and punches on every cooldown), 'avg' (misses some chances, steps out of flurries),
// 'idle' (stands there: how long until they put you down)
export function simulateRound({ seed = 1, style = 'spam', dt = 1 / 30, maxT = 240 } = {}) {
  const ai = aiInit(seed), pr = rng(seed * 7 + 3); let t = 0, me = TUNE.hp, them = TUNE.hp, px = 0, ox = 3.2, oz = 0, pz = 0, cd = 0, combo = 0, hits = 0, blocked = 0, taken = 0;
  while (t < maxT && me > 0 && them > 0) {
    t += dt; cd -= dt;
    const d = Math.hypot(ox - px, oz - pz) || 0.01;
    const s = aiStep(ai, dt, d, them);
    if (s.move === 'in') { const k = Math.min(d - 0.9, TUNE.walk * dt) / d; ox -= (ox - px) * k; oz -= (oz - pz) * k; }
    else if (s.move === 'circle') { const tx = -(oz - pz) / d * ai.dir, tz = (ox - px) / d * ai.dir, out = d < 3.2 ? 1 : 0; ox += (tx + (ox - px) / d * out) * TUNE.circle * dt; oz += (tz + (oz - pz) / d * out) * TUNE.circle * dt; }
    if (s.swing && s.land && d <= TUNE.reach + 0.2 && style !== 'dodge') { me = Math.max(0, me - oppDamage(1)); taken++; }
    if (style === 'idle') continue;
    const lazy = style === 'avg' && pr() < 0.03; // a thumb off the button now and then
    const scared = style === 'avg' && ai.mode === 'flurry' && pr() < 0.5;
    if (d > 2.3 || scared) { const sp = 4.5 * dt * (scared ? -0.6 : 1); px += (ox - px) / d * sp; pz += (oz - pz) / d * sp; }
    if (cd <= 0 && d <= 2.6 && !lazy && !scared) { const st = combo++ % 3; cd = st === 2 ? 0.55 : 0.42; if (style === 'avg') cd += 0.12;
      const h = aiHit(ai); them = Math.max(0, them - h.dmg); hits++; if (h.blocked) blocked++;
      if (!h.blocked && !h.slipped) { const dd = Math.hypot(ox - px, oz - pz) || 1; ox += (ox - px) / dd * TUNE.knock; oz += (oz - pz) / dd * TUNE.knock; } }
  }
  return { t: +t.toFixed(1), win: them <= 0 && me > 0, me: Math.round(me), them: Math.round(them), hits, blocked, taken, guards: ai.guards };
}

// ---------- the show ----------
export const ANNOUNCER = {
  intro: ['LADIES AND LOWLIFES', 'WELCOME TO THE PIT'],
  round: r => (r >= 3 ? 'FINAL ROUND' : `ROUND ${r}`),
  fight: 'FIGHT!',
};
// round tally for the HUD: two pips each, filled for rounds won (first to 2)
export const pips = (n, of = 2) => '●'.repeat(Math.min(n, of)) + '○'.repeat(Math.max(0, of - n));
export function tallyLine(S) { if (!S) return ''; return `R${Math.min(S.round, 3)} · YOU ${pips(S.me)} ${pips(S.them)} THEM`; }
// a round banner after a knockdown / the match banner at the end
export function roundBanner(o, S) { return o === 'win' ? { big: 'KNOCKDOWN!', small: `Round to you · ${pips(S.me)} ${pips(S.them)}`, tone: 'win' } : { big: 'YOU\u2019RE DOWN!', small: `Round to them · ${pips(S.me)} ${pips(S.them)}`, tone: 'lose' }; }
export function matchBanner(pay) {
  const win = pay && pay.result !== 'lose' && pay.result !== 'forfeit';
  return { win, big: win ? (pay.result === 'sweep' ? 'FLAWLESS!' : 'WINNER!') : 'DEFEATED', small: `${pay?.me ?? 0}\u2013${pay?.them ?? 0} · ${win ? 'Purse' : 'Pity cash'} +${pay?.credits ?? 0} cr`, tone: win ? 'win' : 'lose' };
}
// crowd: idle spot -> packed spot. Each spectator walks in along its own ray until it is PACK[row] m (Chebyshev, i.e. on a
// square) from the centre: right up against the ropes (half-side 6.6), never inside them.
export const PACK = [7.35, 8.3];
export function packSpot(c) { const m = Math.max(Math.abs(c.x), Math.abs(c.z)) || 1, k = Math.min(1, PACK[c.row ? 1 : 0] / m); return { x: c.x * k, z: c.z * k }; }
// late arrivals that run in from the street when the bell rings (they start out of sight, 24-34 m out)
export function rushers(phone = false) {
  const n = phone ? 10 : 22, out = [], r = rng(99);
  for (let i = 0; i < n; i++) { let a = -Math.PI + (i + 0.5) / n * Math.PI * 2; if (Math.abs(a) < 0.75) a += a < 0 ? -0.8 : 0.8; // keep the east entry open
    const R = 24 + r() * 10, row = i % 2, end = PACK[row] + 0.55 + r() * 0.4, m = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    out.push({ sx: Math.cos(a) * R, sz: Math.sin(a) * R, x: +(Math.cos(a) * end / m).toFixed(2), z: +(Math.sin(a) * end / m).toFixed(2), row, pose: i % 2, seed: r(), delay: r() * 1.4, yaw: Math.atan2(Math.cos(a), Math.sin(a)) }); }
  return out;
}
// strobe colours of the fight lights and their beat (per light, per beat)
export const STROBE = [0xff2d55, 0x22d3ee, 0xf97316, 0xa855f7, 0xfde047];
export const strobeColor = (t, i, bpm = 128) => STROBE[(Math.floor(t * bpm / 60) + i * 2) % STROBE.length];
export const strobeOn = (t, i, bpm = 128) => ((t * bpm / 60 * 2 + i * 0.5) % 1) < 0.55;
// finale timings (s): slow-mo window, burst, glow, banner
export const FINALE = { slowmo: 1.6, slowK: 0.3, burst: 2.2, glow: 6, banner: 5.5, pillar: 6, confetti: 6 };
// particle budget (one pooled Points + one instanced confetti mesh, built and shader-warmed at load)
export const BUDGET = { desktop: { sparks: 420, confetti: 160, rushers: 22 }, phone: { sparks: 180, confetti: 70, rushers: 10 } };
