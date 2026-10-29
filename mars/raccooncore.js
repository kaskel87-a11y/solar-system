// Raccoon Rover: pure logic (no DOM, no THREE), unit-tested by tests/test-raccoon-unit.mjs.
// mars/raccoonrover.js does the meshes, the junkyard, the co-pilot, the dock button and the game wiring.
// Fiction only. M-rated: swearing and petty crime yes, nothing sexual.
export const KIND = 'raccoon_rover';
export const PRICE = 1200;
export const COPILOT = 'Rocket';
export const SAVE_KEY = 'ssx.raccoonRover.v1';
export const PICK_KEY = 'Digit5'; // free on main and every remote branch (danger uses 1-4, gravity 2, marsmania I/`/;/[/]/,/.)
// Red Tape Flats (mars-rough) centre is [-280, -40] AJ-relative; junkyard offsets are district-local metres.
export const DISTRICT = 'mars-rough';
export const FLATS = [-280, -40];
export const JUNKYARD = [-30, 38];
export const JUNK_YAW = 0.6;
// dumpsters, AJ-relative: three in the junkyard, two behind Wrench's, two in Ares Junction, one downtown
export const DUMPSTERS = [[-316, -6], [-304, 4], [-318, 8], [-296, -28], [-262, -32], [-26, 18], [30, -18], [-20, -418]].map(([x, z], i) => ({ id: 'd' + i, x, z }));
// driving numbers: a quick, light, slightly sketchy buggy-class junker (buggy is vmax 22, turn 1.75)
export const SPEC = {
  name: 'Raccoon Rover', icon: '🦝', price: PRICE, dealer: false, tier: 1, vmax: 20, boost: 31, acc: 12.5, bacc: 18, turn: 2.05,
  wy: 0.48, wr: 0.48, r: 2.1, airTurn: 1.35, offroad: 0.95,
  blurb: 'Bin lids, zip ties and a raccoon who came with it. He is not for sale.'
};
export const LOOT = { r: 4.5, maxSpeed: 6, gap: 10, dumpsterCd: 180, witness: 0.12 };
export const PICK = { range: 14, maxSpeed: 3, onFootR: 9, cd: 20, runSpeed: 7, grab: 1.2 };
export const BARK = { gap: 6, catGap: 14, idleAfter: 25 };
export const URGENT = new Set(['raccoon_caught', 'raccoon_pick_ok', 'raccoon_pick_fail', 'raccoon_buy', 'raccoon_steal', 'raccoon_loot']);

// co-pilot lines (<= 65 chars for iPhone portrait). Registered at runtime with SSX.registerBarks (no barks.js edit).
export const LINES = {
  raccoon_crash: ['🦝 Who taught you to drive, a fucking rock?', '🦝 My spine. You owe me a new spine.', '🦝 Wall: 1. You: 0. Me: concussed.',
    '🦝 Do that again and I chew the brake lines.', "🦝 Fine. I didn't need that tooth.", '🦝 Insurance? On THIS? Ha.'],
  raccoon_roll: ['🦝 WHEEEE. Okay. Again. Do it again.', '🦝 I saw God. She was a bin.', '🦝 Clean! Somebody film that, damn it.',
    '🦝 Stuck it. I may have pissed the seat.', '🦝 That roll was filthy. Good filthy.'],
  raccoon_rollcrash: ['🦝 You landed on the ROOF. The roof!', '🦝 Physics called. It wants a word.', '🦝 Less spinning, more wheels-down, genius.'],
  raccoon_lowg: ['🦝 Floaty mode. My fur is doing a thing.', '🦝 Low-g. Jump the whole damn junkyard.'],
  raccoon_zerog: ['🦝 ZERO-G? Nobody said ZERO-G. Hold my tail.', '🦝 I am a space raccoon now. Respect it.'],
  raccoon_marsg: ['🦝 Gravity is back. My lunch too.', '🦝 Down we go. Ground, sweet ground.'],
  raccoon_loot: ['🦝 Yoink.', '🦝 Finders keepers, dumbass.', '🦝 Was it locked? It was not locked.', '🦝 Mine now. Drive normal.',
    "🦝 Don't look at me. Look at the road.", '🦝 Five-finger discount. Four fingers. Whatever.'],
  raccoon_caught: ['🦝 Busted! I never met you.', '🦝 I want my lawyer. He is also a raccoon.', "🦝 Great. Now they've got my paw prints."],
  raccoon_heat: ['🦝 Sirens. Oh, shit. Floor it.', '🦝 Cops. Act natural. Natural!', "🦝 That's heat. I hate heat. I'm fur."],
  raccoon_idle: ['🦝 We parked? Wake me when we steal stuff.', '🦝 Bored. Got any bins? Anything?', '🦝 Clock is ticking and so is my stomach.',
    '🦝 Nice view. Rob something.'],
  raccoon_pick_go: ['🦝 Hold my seat. Back in a sec.', "🦝 Watch and learn, sucker.", '🦝 Going in. Tell my kids... nah.'],
  raccoon_pick_ok: ['🦝 Wallet. Got it. Drive. DRIVE.', '🦝 Easy. Humans keep it all in one pocket.', '🦝 Cash and a sticky mint. Sharing the cash.'],
  raccoon_pick_fail: ['🦝 He saw me. RUN. Well, drive.', '🦝 Abort! Abort! Damn, he grabs fast.', '🦝 Okay that was on me. Mostly.'],
  raccoon_buy: ['🦝 You PAID? For this? Sucker. Welcome aboard.', '🦝 Bought fair and square. Weird flex.'],
  raccoon_steal: ['🦝 Hell yeah, grand theft junker. I like you.', '🦝 Stealing my own house. Bold. Respect.']
};

// loot tables: credits weighted, plus small junk items for progress.raccoonStash
export const ITEMS = ['half a sandwich', 'a bent wrench', 'a cracked visor', 'three batteries', 'a lucky dice', 'a mixtape', 'a spark plug', 'shiny bottle caps'];
export function rollLoot(src, rng = Math.random) {
  const car = src === 'car', r = rng();
  if (r < (car ? 0.25 : 0.4)) return { credits: 0, item: ITEMS[Math.floor(rng() * ITEMS.length) % ITEMS.length], witness: rng() < LOOT.witness };
  const lo = car ? 30 : 10, hi = car ? 120 : 60;
  return { credits: Math.round(lo + rng() * (hi - lo)), item: null, witness: rng() < LOOT.witness };
}
// pickpocket odds by target kind; guards are hard and pay more
export const PICK_ODDS = { colonist: 0.7, contact: 0.5, guard: 0.3 };
export function rollPick(kind, rng = Math.random) {
  const p = PICK_ODDS[kind] ?? 0.55, ok = rng() < p;
  if (!ok) return { ok, credits: 0 };
  const guard = kind === 'guard';
  return { ok, credits: Math.round((guard ? 60 : 20) + rng() * (guard ? 90 : 60)) };
}
export const pickable = p => !!p && p.on !== false && (p.kind in PICK_ODDS) && isFinite(p.x) && isFinite(p.z);
// nearest pickable NPC to (x, z) inside range; returns { i, p, d } or null
export function pickTarget(x, z, people, range = PICK.range) {
  let best = null;
  (people || []).forEach((p, i) => { if (!pickable(p)) return; const d = Math.hypot(p.x - x, p.z - z); if (d <= range && (!best || d < best.d)) best = { i, p, d }; });
  return best;
}
// why loot / pickpocket are paused (null = allowed). s: { floating, race, job, inside, onMars }
export function blocked(s = {}) {
  if (!s.onMars) return 'Mars only';
  if (s.inside) return 'not indoors';
  if (s.race) return 'not during a race';
  if (s.job) return 'not during a job';
  if (s.floating) return 'not while floating';
  return null;
}
// what the raccoon may rob while you crawl past: nearest target within r of the car, below maxSpeed, off cooldown
// targets: [{ id, x, z, kind: 'car'|'dumpster', r? }]; seen: Map id -> last looted time; now: seconds
export function lootPick(car, targets, seen, now, lastLoot = -1e9, cfg = LOOT) {
  if (!car || Math.abs(car.speed || 0) > cfg.maxSpeed || now - lastLoot < cfg.gap) return null;
  let best = null;
  for (const t of targets || []) {
    const d = Math.hypot(t.x - car.x, t.z - car.z) - (t.r || 0);
    if (d > cfg.r) continue;
    const last = seen.get(t.id);
    if (last != null && (t.kind === 'car' || now - last < cfg.dumpsterCd)) continue; // cars once each, dumpsters refill
    if (!best || d < best.d) best = { ...t, d };
  }
  return best;
}
// heat: what wanted level should be after getting into the junker. prev = wanted before you got in, cur = wanted now
// (core already adds +1 if a witness saw the theft). owned -> undo the core's car-theft heat; stolen -> at least prev + 1.
export function wantedOnEnter(owned, prev, cur) {
  prev = prev | 0; cur = cur | 0;
  if (owned) return Math.min(cur, prev);
  return Math.min(5, Math.max(cur, prev + 1));
}
export const bump = (w, n = 1) => Math.min(5, Math.max(0, (w | 0) + n));
// co-pilot bark rate limiter: global gap + per-category gap; urgent categories only need half the global gap
export function createBarker(cfg = BARK) {
  let last = -1e9; const cat = new Map();
  return {
    can(now, c) { const g = URGENT.has(c) ? cfg.gap / 2 : cfg.gap; if (now - last < g) return false; return now - (cat.get(c) ?? -1e9) >= (URGENT.has(c) ? 0 : cfg.catGap); },
    mark(now, c) { last = now; cat.set(c, now); },
    reset() { last = -1e9; cat.clear(); }
  };
}
export function gravityCat(mode) { return mode === 'ZERO-G' ? 'raccoon_zerog' : mode === 'LOW-G' ? 'raccoon_lowg' : 'raccoon_marsg'; }
// raccoon runner: move from (x, z) toward (tx, tz) at speed for dt; returns { x, z, arrived }
export function stepToward(x, z, tx, tz, speed, dt, reach = 0.6) {
  const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
  if (d <= reach) return { x, z, arrived: true };
  const s = Math.min(d, speed * dt); return { x: x + dx / d * s, z: z + dz / d * s, arrived: d - s <= reach };
}
// save: tolerant of missing / corrupt data
export function loadState(raw) {
  let o = null; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  o = o && typeof o === 'object' ? o : {};
  return { owned: !!o.owned, how: o.how === 'stole' || o.how === 'bought' ? o.how : null, garage: !!o.garage, loot: o.loot | 0, picks: o.picks | 0, busts: o.busts | 0, cr: o.cr | 0 };
}
export const world2aj = (x, z, colony) => [x - (colony?.x || 0), z - (colony?.z || 0)];
export const aj2world = (x, z, colony) => [x + (colony?.x || 0), z + (colony?.z || 0)];
export const junkAJ = () => [FLATS[0] + JUNKYARD[0], FLATS[1] + JUNKYARD[1]];
