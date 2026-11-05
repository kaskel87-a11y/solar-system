// v7.4 street danger: the pure logic (no THREE, no DOM) behind danger.js and pursuit.js, so it runs under plain node
// for unit tests. Encounter director (spawn rates by district + time of day, cooldowns, wanted escalation), the knife
// mugging state machine and its outcomes, ambient fights, street (non-police) chase tiers + the Red Tape Run set-piece,
// intercept steering, line of sight and the phone NPC budget. Police/wanted stays in world.js (v7.4 security combat).
// Design doc: solar-system-story/STREET-DANGER.md (copied to docs in the PR body).

// ---------- districts ----------
// Live Ares Junction is one ring colony. The Mars city pack (solar-system-story/mars-city, mirrored in streetdata.js)
// places Olympus Row (downtown), Red Tape Flats (rough) and Helios Heights (gated) AJ-relative, joined by the Ares
// Beltway polyline. districtAt checks those first (colony.districts, or opts.city = MARS_CITY), then the beltway
// (driving within ~14 m of it = highway), then falls back to the AJ ring: core = downtown, shanty ring = rough.
export const DISTRICTS = ['downtown', 'rough', 'gated', 'highway', 'wastes'];
export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], sx = bx - ax, sz = bz - az, L2 = sx * sx + sz * sz;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / L2)) : 0;
    best = Math.min(best, Math.hypot(ax + sx * t - x, az + sz * t - z));
  }
  return best;
}
export function districtAt(x, z, colony, opts = {}) {
  if (!colony) return 'wastes';
  const city = opts.city, ax = x - colony.x, az = z - colony.z; // AJ-relative
  const list = Array.isArray(colony.districts) ? colony.districts.map(d => ({ ...d, x: d.x - colony.x, z: d.z - colony.z })) : city?.districts || [];
  let best = null, bd = Infinity;
  for (const d of list) { const k = Math.hypot(ax - d.x, az - d.z); if (k < d.r && k < bd) { bd = k; best = d.id; } }
  if (best) return best;
  const d = Math.hypot(ax, az);
  if (d < (opts.core ?? 58)) return 'downtown';
  if (city?.beltway && opts.driving && distToPolyline(ax, az, city.beltway) < (opts.lane ?? 14)) return 'highway';
  if (d < (opts.ring ?? 175)) return 'rough';
  return opts.driving && (opts.speed || 0) > 14 ? 'highway' : 'wastes';
}

// ---------- time of day ----------
// No world clock yet (engine_need): a "Mars hour" runs off the wall clock, 1 game hour = 2 real minutes, so a session
// sees dusk and night. Tests pin it with setClock().
let clockOverride = null;
export function setClock(h) { clockOverride = h == null ? null : ((h % 24) + 24) % 24; }
export function marsHour(nowMs = Date.now()) { return clockOverride ?? ((nowMs / 120000) % 24); }
// game clock from Steve's SSX.time (optional): hour() -> float [0,24) is the source when it exists; else isNight() overrides
// the night flag; else our own clock. marsHour() stays the raw clock on purpose (SSX.time seeds from it, so no recursion).
// readHour -> number | null, readNight -> true | false | null (absent / throws / junk). setClock() (tests) still wins.
export function readHour(root = typeof window !== 'undefined' ? window : null) { try { const T = root?.SSX?.time, f = T?.hour; if (typeof f !== 'function') return null; const v = +f.call(T); return Number.isFinite(v) ? ((v % 24) + 24) % 24 : null; } catch (e) { return null; } }
export function readNight(root = typeof window !== 'undefined' ? window : null) { try { const T = root?.SSX?.time, f = T?.isNight; if (typeof f !== 'function') return null; const v = f.call(T); return typeof v === 'boolean' ? v : null; } catch (e) { return null; } }
// keep the hour unless it disagrees with the night flag, then swap in 23 (night) or 12 (day) so timeBand/ratePerMin/ambient gates agree
export function nightHour(h, night) { if (night !== true && night !== false) return h; return night === (timeBand(h) === 'night') ? h : night ? 23 : 12; }
export function gameHour(root, nowMs) { if (clockOverride != null) return clockOverride; const h = readHour(root); return h != null ? h : nightHour(marsHour(nowMs), readNight(root)); }
export function isNight(root, nowMs) { return timeBand(gameHour(root, nowMs)) === 'night'; }
export function nightSource(root) { return clockOverride != null ? 'setClock' : readHour(root) != null ? 'SSX.time.hour' : readNight(root) != null ? 'SSX.time.isNight' : 'clock'; }
export function timeBand(h) { return h >= 21 || h < 5 ? 'night' : h >= 17 ? 'dusk' : h < 8 ? 'dawn' : 'day'; }
const BAND_K = {
  mugging: { day: 0.5, dawn: 0.8, dusk: 1.2, night: 1.9 },
  fight: { day: 0.7, dawn: 0.6, dusk: 1.2, night: 1.6 },
  robbery: { day: 0.3, dawn: 0.6, dusk: 1.0, night: 1.6 },
  carjack: { day: 0.6, dawn: 0.8, dusk: 1.1, night: 1.5 },
  ambush: { day: 0.6, dawn: 0.8, dusk: 1.2, night: 1.5 },
  gangChase: { day: 0.6, dawn: 0.7, dusk: 1.2, night: 1.6 }
};

// ---------- encounter director ----------
// expected encounters per minute of exposure, by district (before the time-of-day multiplier)
export const RATES = {
  mugging: { downtown: 0.18, rough: 0.7, gated: 0.03, highway: 0, wastes: 0.12 },
  fight: { downtown: 0.35, rough: 0.8, gated: 0.05, highway: 0, wastes: 0.05 },
  robbery: { downtown: 0.05, rough: 0.25, gated: 0.02, highway: 0, wastes: 0.05 },
  carjack: { downtown: 0.08, rough: 0.3, gated: 0.02, highway: 0.25, wastes: 0.08 },
  ambush: { downtown: 0, rough: 0.12, gated: 0, highway: 0, wastes: 0 },
  gangChase: { downtown: 0.03, rough: 0.35, gated: 0, highway: 0.15, wastes: 0.04 },   // Saltblood cars come for you
  ambient: { downtown: 0.5, rough: 0.4, gated: 0.45, highway: 0.35, wastes: 0 }        // random-events.json vignettes (ambient.js picks which)
};
export const IMPLEMENTED = ['mugging', 'fight', 'gangChase', 'ambient']; // the rest are designed (STREET-DANGER.md) and wait on engine_needs
export const COOLDOWN = { global: 40, mugging: 110, fight: 55, robbery: 240, carjack: 150, ambush: 300, gangChase: 180, ambient: 90 }; // ambient = random-events.json spawn_rules.global_cooldown_s
export const GRACE = 25; // seconds after landing / respawn before anything can happen
// situation: { district, hour, onFoot, driving, wanted, inside, busy (quest combat, race, menu, down), questActive }
export function eligible(type, s) {
  if (s.inside || s.busy || s.inDuel) return false;   // never jump a player mid-duel (world.inDuel)
  if (type === 'mugging' || type === 'robbery') return s.onFoot && s.wanted === 0; // nobody mugs you with sirens on you
  if (type === 'fight') return s.wanted <= 1;
  if (type === 'carjack') return s.driving && s.wanted === 0 && (s.speed || 0) < 6; // stopped or crawling
  if (type === 'ambush') return s.wanted <= 2 && s.district === 'rough' && (s.saltbloodHeat || 0) >= 1;
  if (type === 'gangChase') return s.driving && s.wanted <= 2 && (s.speed || 0) > 4;  // gangs don't care about stars
  if (type === 'ambient') return !!s.ambientReady && (s.wanted || 0) < 4;              // some random-events.json event fits right here
  return false;
}
export function ratePerMin(type, s) {
  const base = RATES[type]?.[s.district] ?? 0; if (!base) return 0;
  let k = BAND_K[type]?.[timeBand(s.hour ?? 12)] ?? 1;
  if (s.questActive) k *= 0.5;                // story missions get the stage
  if (type === 'gangChase') k *= 1 + Math.min(2, s.saltbloodHeat || 0); // you killed their boys: they come looking
  if (type === 'fight' && s.wanted === 1) k *= 0.5;
  if (type === 'mugging' && s.dust) k *= 1.5;  // carrying glow-dust: junkies can smell it
  return base * k;
}
export function createDirector({ rng = Math.random, types = IMPLEMENTED, cooldown = COOLDOWN, grace = GRACE } = {}) {
  const D = { t: 0, since: {}, last: -1e9, grace, active: 0, log: [] };
  D.reset = (g = grace) => { D.grace = g; };
  D.tick = (dt, s) => {
    D.t += dt; if (D.grace > 0) { D.grace -= dt; return null; }
    if (D.active > 0 || D.t - D.last < cooldown.global) return null;
    for (const type of types) {
      if (D.t - (D.since[type] ?? -1e9) < (cooldown[type] ?? 60)) continue;
      if (!eligible(type, s)) continue;
      const p = 1 - Math.exp(-ratePerMin(type, s) / 60 * dt);
      if (rng() < p) { D.since[type] = D.t; D.last = D.t; D.log.push({ type, t: D.t, district: s.district }); return type; }
    }
    return null;
  };
  D.force = type => { D.since[type] = D.t; D.last = D.t; D.log.push({ type, t: D.t, forced: true }); return type; };
  return D;
}

// ---------- barks (65 chars max; profane on purpose, M-rated) ----------
export const BARKS = {
  junkieApproach: ['Hey. HEY. Spaceman. C\u2019mere a sec.', 'Yo, you got a minute? Just a minute, man.', 'Psst. Hey buddy. Hey. Don\u2019t walk away from me.', 'You\u2019re new, huh? Fresh off the boat. C\u2019mere.'],
  junkieDemand: ['Gimme your fuckin\u2019 credits! {n}, NOW!', 'Wallet. Now. {n} credits or I open you up.', '{n} credits, asshole. Don\u2019t make me do this.', 'Don\u2019t fuckin\u2019 move. {n} cr. My hands are shaking, man.'],
  junkiePaid: ['Pleasure doin\u2019 business. Don\u2019t follow me.', 'Yeah. Yeah! Dust tonight, baby!', 'Smart. Real smart. Now fuck off.'],
  junkieBroke: ['You\u2019re BROKE? The FUCK is wrong with you?', 'Zero? You walk round with ZERO?'],
  junkieFight: ['Oh you wanna DANCE? Let\u2019s dance!', 'Big mistake, big mistake!', 'I\u2019ll cut your fuckin\u2019 visor off!'],
  junkieHit: ['AGH! Fuck!', 'You hit me! You actually hit me!', 'Shit shit shit!'],
  junkieChase: ['Get back here!', 'RUN, you little bitch!', 'I\u2019ll find you, spaceman!'],
  junkieGiveUp: ['Yeah, keep running! ...fuck, my lungs.', 'Whatever. Plenty more tourists.'],
  junkieTalked: ['...Fuck it. Not worth it.', 'Okay, okay. I\u2019m going. Christ.', 'You\u2019re lucky I like your dog.'],
  junkieTip: ['Look... Saltblood stash, east dunes. Didn\u2019t hear it from me.', 'Rusk takes envelopes Tuesdays. Everybody knows. Shh.'],
  junkieTwitch: ['Don\u2019t you fuckin\u2019 lecture me!', 'You think I\u2019m STUPID?'],
  junkieTimeout: ['Too slow, man!', 'Shoulda paid!'],
  junkieDown: ['...mom?', 'Worth it... wasn\u2019t worth it...', 'Ah, fuck...'],
  fightStart: ['You spilled my fuckin\u2019 drink!', 'That\u2019s for my brother, you piece of shit!', 'Saltblood owns this corner, bitch!', 'You owe me forty credits, Dale!', 'Look at me again. Look at me AGAIN.'],
  fightMid: ['Get off me!', 'Hit him! HIT HIM!', 'My tooth! You knocked out my tooth!', 'Somebody call security! No, don\u2019t!'],
  fightEnd: ['Stay down. STAY DOWN.', 'That\u2019s what you get.', 'Oh shit, is he breathing?'],
  escortArrive: ['Marrow sent us. Point, and we hurt it.', 'Red tape\u2019s got your back, spacer.', 'Who we stomping?'],
  escortFight: ['Get some!', 'Saltblood, motherfucker!', 'Stay down!'],
  escortLeave: ['Clock\u2019s up. Don\u2019t call us, we call you.', 'Marrow says that\u2019s all you paid for.'],
  bystander: ['Holy shit!', 'Not again, man. Not again.', 'Somebody stop them!', 'I\u2019m filming this!'],
  gangChase: ['Saltblood! That\u2019s the motherfucker!', 'Run him off the road!', 'Box him in! BOX HIM IN!', 'You\u2019re in Red Tape now, bitch!'],
  gangLost: ['Where\u2019d he go? WHERE\u2019D HE GO?', 'Fuck! Lost him.', 'Marrow\u2019s gonna skin us.'],
  gangShoot: ['Light him up!', 'Shoot the tyres!', 'Eat it, tourist!'],
  runStart: ['That\u2019s Marrow\u2019s crate! Get it back!', 'Kill him and bring me the box!'],
  getaway: ['That\u2019s the crew from the vault! Get the money back!', 'Nobody robs Vesna\u2019s vault and drives home!', 'Cut him off before the dunes!'],
  runWin: ['Helios gate. They won\u2019t follow you in here.'],
  rusk: ['Rusk: Your wanted level? Lost the paperwork. Paper\u2019s expensive.']
};
export function pick(list, rng = Math.random) { return list?.length ? list[Math.floor(rng() * list.length) % list.length] : ''; }
export function fill(line, vars = {}) { return String(line).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m); }

// ---------- the knife mugging ----------
// phases: approach -> standoff (choice) -> resolved into one of: paid, fight, chase, talked, tip, stabbed (timeout)
export const MUG = { standoff: 9, reach: 2.6, stabRange: 1.9, stabCd: 1.15, hp: 4, giveUp: 20, chaseTime: 7, speed: 5.6, runSpeed: 6.2 };
export function demandFor(credits, rng = Math.random) {
  if (credits <= 0) return 20;
  const want = Math.round(credits * (0.25 + rng() * 0.15) / 5) * 5;
  return Math.max(20, Math.min(150, want));
}
// talk-down odds: rank/XP, a gun already out, Frankie at your side, a rep with the dust crews; desperation (night) hurts
// Saltblood standing for talkChance, in "flag units" (0..3 saturates the +0.15 bonus; negatives cost up to -0.15).
// Source: Marsmania's SSX.rep.get('saltblood') (integer -100..+100, 0 neutral) when it exists, else the vesna-/saltblood flag count.
// REP_PER_FLAG keeps the two scales identical: rep = flagsToRep(count) maps back to the same count, so nothing jumps when rep loads.
export const REP_PER_FLAG = 100 / 3;
export const SALTBLOOD_FLAG = /^vesna-|saltblood/;
export const saltbloodFlagCount = flags => (Array.isArray(flags) ? flags : []).filter(f => typeof f === 'string' && SALTBLOOD_FLAG.test(f)).length;
export const flagsToRep = count => Math.max(0, Math.min(100, Math.round((+count || 0) * REP_PER_FLAG)));
export function repToTalkUnits(rep) { const r = +rep; if (!Number.isFinite(r)) return 0; return Math.max(-100, Math.min(100, r)) / REP_PER_FLAG; }
// rep: number | null | undefined (undefined/null/NaN -> fall back to flags); never throws
export function saltbloodStanding(rep, flags) { return rep != null && Number.isFinite(+rep) ? repToTalkUnits(rep) : saltbloodFlagCount(flags); }
// guarded read of window.SSX.rep (Marsmania, marsmania/rep): returns null when absent or it throws
export function readRep(id, root = typeof window !== 'undefined' ? window : null) { try { const v = root?.SSX?.rep?.get?.(id); return v != null && Number.isFinite(+v) ? +v : null; } catch (e) { return null; } }
export function talkChance({ xp = 0, armed = false, dog = false, saltbloodRep = 0, night = false, tries = 0 } = {}) {
  const sr = Number.isFinite(+saltbloodRep) ? +saltbloodRep : 0;
  let p = 0.32 + Math.min(0.25, xp / 4000) + (armed ? 0.18 : 0) + (dog ? 0.1 : 0) + Math.max(-0.15, Math.min(0.15, sr * 0.05)) - (night ? 0.08 : 0) - tries * 0.25;
  return Math.max(0.05, Math.min(0.9, p));
}
// what happens when the player picks. Returns a plain outcome; the runtime applies it (credits, damage, heat, barks).
export function resolveChoice(choice, m, env = {}, rng = Math.random) {
  const credits = env.credits ?? 0;
  if (choice === 'pay') {
    // empty pockets is still a way out: he shoves you, spits, and goes looking for a better mark
    if (credits <= 0) return { result: 'shoved', why: 'broke', bark: 'junkieBroke', dmg: 4 };
    const paid = Math.min(credits, m.demand);
    return { result: 'paid', paid, bark: 'junkiePaid', comeback: rng() < 0.2 };
  }
  if (choice === 'fight') return { result: 'fight', bark: 'junkieFight', lunge: false };
  if (choice === 'run') return { result: 'chase', bark: 'junkieChase' };
  if (choice === 'talk') {
    const p = talkChance({ ...env, tries: m.talks || 0 });
    const r = rng();
    if (r < p * 0.35) return { result: 'tip', bark: 'junkieTip', xp: 15, p };
    if (r < p) return { result: 'talked', bark: 'junkieTalked', xp: 10, p };
    return { result: 'fight', why: 'twitch', bark: 'junkieTwitch', lunge: true, p };
  }
  if (choice === 'timeout') return { result: 'stabbed', bark: 'junkieTimeout', paid: Math.min(credits, Math.round(m.demand / 2)), dmg: 16 };
  throw new Error('unknown choice ' + choice);
}
// heat for hurting/killing the mugger. Self-defense is legal; shooting a man in the back near the cameras isn't.
// phase: approach | standoff | fight | chase | fleeing (after you paid / talked him down)
export function heatForMugger({ phase, killed, gun, witnessed, inColony }) {
  if (phase === 'fight' || phase === 'chase' || phase === 'standoff') {
    // he pulled a knife on you: nobody cares, unless you emptied a gun next to the colony cameras
    return gun && inColony && killed ? { min: 1, why: 'discharging a weapon in the colony' } : null;
  }
  if (!witnessed) return null;
  if (phase === 'fleeing') return { min: killed ? 2 : 1, why: killed ? 'shot a man in the back' : 'assault' };
  return { min: killed ? 2 : 1, why: killed ? 'murder' : 'assault' }; // approach: he hadn't done anything yet
}
export function muggerLoot(rng = Math.random, paid = 0) { return { credits: paid + 8 + Math.floor(rng() * 30), dust: rng() < 0.6 ? 1 : 0 }; }

// ---------- ambient fights ----------
export const FIGHT_KINDS = [
  { id: 'brawl', a: 'thug', b: 'colonist', weapon: 'fists', w: 0.45 },
  { id: 'knife', a: 'junkie', b: 'junkie', weapon: 'knife', w: 0.3 },
  { id: 'beatdown', a: 'thug', b: 'junkie', weapon: 'pipe', w: 0.25, helpers: 1 }
];
export function pickFight(rng = Math.random, district = 'rough') {
  const list = district === 'downtown' ? FIGHT_KINDS.filter(f => f.id !== 'beatdown') : FIGHT_KINDS;
  let t = rng() * list.reduce((s, f) => s + f.w, 0); for (const f of list) { if ((t -= f.w) <= 0) return f; } return list[0];
}
export const WEAPON_DMG = { fists: [0.5, 0.9], knife: [0.9, 1.6], pipe: [0.8, 1.3] };
export function swing(weapon, rng = Math.random) { const [a, b] = WEAPON_DMG[weapon] || WEAPON_DMG.fists; return a + rng() * (b - a); }
// stepping in: hurting the aggressor is fine, hurting the victim is assault
export function heatForFighter({ role, killed, witnessed }) {
  if (!witnessed) return null;
  if (role === 'aggressor') return killed ? { min: 1, why: 'manslaughter' } : null;
  return { min: killed ? 2 : 1, why: killed ? 'murder' : 'assault' };
}

// ---------- street chases (NOT police: v7.4 world.js owns wanted + security) ----------
// gang: Saltblood cars that ram and shoot from the window; junkie: one doped-up driver who only rams;
// setpiece: highway.json chase pursuers (goon, goon, sbuggy). Phones cap pursuers at 3 (highway.json caps).
export function chaseTier(kind = 'gang', mobile = false, n = 0) {
  const T = {
    junkie: { cars: 1, ram: true, shoot: false, vmax: 24, boost: 1.05, sight: 90, loseTime: 4, search: 6, ramDmg: 6 },
    gang: { cars: 2, ram: true, shoot: true, vmax: 28, boost: 1.12, sight: 130, loseTime: 6, search: 9, ramDmg: 8 },
    getaway: { cars: 2, ram: true, shoot: true, vmax: 29, boost: 1.14, sight: 140, loseTime: 7, search: 10, ramDmg: 8 }, // heist:escape (Ben's heist module)
    setpiece: { cars: 3, ram: true, shoot: true, vmax: 30, boost: 1.15, sight: 150, loseTime: 8, search: 10, ramDmg: 9 }
  }[kind] || null;
  if (!T) return null;
  const cars = n > 0 ? n : T.cars;
  return { kind, ...T, cars: Math.min(cars, mobile ? 3 : 5) };
}
// the phone NPC budget: everything walking around (world colonists/guards/contacts + ours + chase drivers) <= cap
export const NPC_CAP = { phone: 12, desktop: 20 };
// "ambient" = what shares the street with you: world people + ColSec (world.securityList()) within AMBIENT_R of the player
export const AMBIENT_R = 90;
export function nearCount(list, x, z, r = AMBIENT_R) { let n = 0; for (const p of list || []) if (Math.hypot(p.x - x, p.z - z) < r) n++; return n; }
export function npcBudget(worldPeople, mine, mobile) { return Math.max(0, (mobile ? NPC_CAP.phone : NPC_CAP.desktop) - worldPeople - mine); }

// ---------- Red Tape Run (highway.json "beltway-chase-saltblood") ----------
// route = [[x,z]...] world coords (start, via..., end); r = checkpoint radius. Pure step: the runtime feeds car pos,
// how many pursuers are on your bumper while you crawl, and damage taken by the crate.
export function setPieceNew(def, route, r = 16) { return { id: def.id, title: def.title, route, r, i: 1, t: 0, limit: def.limit_s, crate: 100, pinned: 0, status: 'running' }; }
export function setPieceStep(sp, dt, { x, z, speed = 0, close = 0, crateDmg = 0 }) {
  if (sp.status !== 'running') return sp;
  sp.t += dt; sp.crate = Math.max(0, sp.crate - crateDmg);
  const [cx, cz] = sp.route[sp.i];
  if (Math.hypot(x - cx, z - cz) < sp.r) { sp.i++; sp.hit = true; } else sp.hit = false;
  if (sp.i >= sp.route.length) { sp.status = 'won'; return sp; }
  // boxed in: a pursuer within 6 m while you're doing under 4 m/s for 4 s
  sp.pinned = close > 0 && Math.abs(speed) < 4 ? sp.pinned + dt : Math.max(0, sp.pinned - dt * 2);
  if (sp.crate <= 0) sp.status = 'crate_destroyed';
  else if (sp.pinned > 4) sp.status = 'caught';
  else if (sp.t > sp.limit) sp.status = 'timer';
  return sp;
}
// where to aim: lead the target by the time it takes to close the gap (clamped), like a GTA interceptor
export function interceptPoint(target, tv, from, speed, maxLead = 2.2) {
  const d = Math.hypot(target.x - from.x, target.z - from.z), t = Math.min(maxLead, d / Math.max(4, speed));
  return { x: target.x + tv.x * t, z: target.z + tv.z * t, t };
}
// steer a car-like agent (x, z, yaw, speed) at a point. yaw follows the game's convention: forward = (-sin yaw, -cos yaw).
export function steerTo(a, px, pz, dt, { vmax = 26, acc = 14, turn = 2.2, brakeAngle = 1.4 } = {}) {
  const want = Math.atan2(-(px - a.x), -(pz - a.z));
  let da = Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw));
  const k = Math.max(-1, Math.min(1, da / 0.6)), yr = turn * (0.4 + 0.6 * Math.min(1, Math.abs(a.speed) / 8));
  a.yaw += k * yr * dt;
  const target = Math.abs(da) > brakeAngle ? vmax * 0.35 : vmax * (1 - Math.min(0.5, Math.abs(da) / 3));
  a.speed += Math.max(-acc * 1.6 * dt, Math.min(acc * dt, target - a.speed));
  a.x += -Math.sin(a.yaw) * a.speed * dt; a.z += -Math.cos(a.yaw) * a.speed * dt;
  return da;
}
// line of sight between two points over terrain (+ optional solids test): sample the segment
export function lineOfSight(a, b, height, solidAt = null, steps = 14) {
  for (let i = 1; i < steps; i++) {
    const t = i / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
    if (height(x, z) > y + 0.2) return false;
    if (solidAt && solidAt(x, y, z)) return false;
  }
  return true;
}
// heat state machine for one pursuit: 'chase' while any unit sees you; out of sight for loseTime -> 'search';
// search expires -> 'lost' (they give up). Spotted again during search -> 'chase'.
export function heatStep(h, seen, dt, tier) {
  if (seen) { h.unseen = 0; h.mode = 'chase'; h.search = 0; return h; }
  h.unseen = (h.unseen || 0) + dt;
  if (h.mode === 'chase' && h.unseen > tier.loseTime) { h.mode = 'search'; h.search = 0; }
  if (h.mode === 'search') { h.search = (h.search || 0) + dt; if (h.search > tier.search) h.mode = 'lost'; }
  return h;
}
// a point on your heading (where an ambush car pulls out ahead of you)
export function aheadPoint(x, z, yaw, dist) { return { x: x - Math.sin(yaw) * dist, z: z - Math.cos(yaw) * dist, yaw }; }
// a ram: relative closing speed along the line between the two -> damage + speed loss + a shove
export function ramImpulse(cop, car, carVel) {
  const dx = car.x - cop.x, dz = car.z - cop.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
  const cv = { x: -Math.sin(cop.yaw) * cop.speed, z: -Math.cos(cop.yaw) * cop.speed };
  const closing = (cv.x - carVel.x) * nx + (cv.z - carVel.z) * nz;
  return { closing, nx, nz, hard: closing > 6, shove: Math.max(0, closing) * 0.18 };
}

// ---------- heist:escape payload (Ben's PR #8) ----------
// { id, title, world, pos:{x,z}, site:{x,z,r}, heat 0-5, evading, security, alarm, loot:{credits,item}|null, t, vehicle }
// -> a getaway request, or null if the payload is garbage or not for this world. The fence's crew wants the loot back:
// 1 car, +1 if the alarm went, +1 at 3★+ or a big score (≥ 1500 cr). Max 3.
export function escapeRequest(d, worldName) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.world === 'string' && worldName && d.world.toLowerCase() !== String(worldName).toLowerCase()) return null;
  const heat = Number.isFinite(+d.heat) ? Math.max(0, Math.min(5, +d.heat)) : 0, cr = d.loot && Number.isFinite(+d.loot.credits) ? +d.loot.credits : 0;
  let n = 1 + (d.alarm ? 1 : 0) + (heat >= 3 || cr >= 1500 ? 1 : 0);
  if (Number.isFinite(+d.pursuers) && +d.pursuers > 0) n = Math.round(+d.pursuers); // explicit override (older drafts)
  const pos = d.pos && Number.isFinite(+d.pos.x) && Number.isFinite(+d.pos.z) ? { x: +d.pos.x, z: +d.pos.z } : null;
  return { id: typeof d.id === 'string' ? d.id.slice(0, 40) : null, title: typeof d.title === 'string' ? d.title.slice(0, 60) : null, n: Math.max(1, Math.min(3, n)),
    heat, alarm: !!d.alarm, loot: cr, item: d.loot && typeof d.loot.item === 'string' ? d.loot.item : null, vehicle: typeof d.vehicle === 'string' ? d.vehicle : null, pos, world: typeof d.world === 'string' ? d.world : null };
}

// ---------- public mugging API (SSX.danger.startMugging / isMugging / mugging) ----------
export const MUG_WEAPONS = ['knife', 'pipe', 'fists'];
export const MUG_HIT = { knife: [9, 15], pipe: [7, 12], fists: [4, 7] };
export function mugHit(weapon, rng = Math.random) { const [a, b] = MUG_HIT[weapon] || MUG_HIT.knife; return a + rng() * (b - a); }
// normalise caller opts: { force?, near?:{x,z}, dist?, armed?, night? } (unknown keys such as grime's district/src are ignored)
export function mugOpts(o) {
  o = o && typeof o === 'object' ? o : {};
  const nx = +o.near?.x, nz = +o.near?.z, near = o.near && typeof o.near === 'object' && Number.isFinite(nx) && Number.isFinite(nz) ? { x: nx, z: nz } : null;
  const dist = Number.isFinite(+o.dist) && o.dist !== null && o.dist !== '' ? Math.max(4, Math.min(40, +o.dist)) : null;
  return { force: o.force === true, near, dist, armed: MUG_WEAPONS.includes(o.armed) ? o.armed : 'knife', night: typeof o.night === 'boolean' ? o.night : null };
}
// s: { ready, mugging, enabled, car, inside, duel, heist }. Not ready / already mugging always refuse; force skips the rest.
export function mugGuard(s, force = false) {
  s = s || {};
  if (!s.ready) return { ok: false, why: 'not-ready' };
  if (s.mugging) return { ok: false, why: 'busy' };
  if (!force) { for (const [k, why] of [['enabled', 'off'], ['car', 'vehicle'], ['inside', 'inside'], ['duel', 'duel'], ['heist', 'heist']]) if (k === 'enabled' ? s.enabled === false : s[k]) return { ok: false, why }; }
  return { ok: true, why: null };
}
// SSX.heist.active is null when idle, else a callable/object; guarded
export function heistActive(root = typeof window !== 'undefined' ? window : null) { try { return !!root?.SSX?.heist?.active; } catch (e) { return false; } }

// ---------- gang backup escorts (barter.json gives.type "gang_backup": {faction, count, durationSec, armed, vehicle?}) ----------
// faction slugs match mars/turf.js GANGS (PR #15): saltblood, dustjaws (Dustjaw Boys: many, cheap), saints (Vacuum Saints: fewer, tougher)
export const BACKUP = { factions: { saltblood: { kind: 'thug', hp: 6 }, dustjaws: { kind: 'thug', hp: 4.5 }, saints: { kind: 'thug', hp: 7.5 } }, maxPhone: 4, maxDesktop: 6, minDur: 20, maxDur: 600, follow: 4.2, leash: 45, engage: 24 };
const ARMED = { pistols: 'pipe', smgs: 'pipe', knives: 'knife', fists: 'fists' }; // NPC ranged attacks need an engine export; escorts melee for now
export function backupPlan(g, room, mobile) {
  if (!g || typeof g !== 'object') return { ok: false, why: 'bad' };
  const faction = String(g.faction || 'saltblood').toLowerCase(), F = BACKUP.factions[faction]; if (!F) return { ok: false, why: 'faction' };
  const want = Math.max(1, Math.round(Number.isFinite(+g.count) ? +g.count : 3)), cap = mobile ? BACKUP.maxPhone : BACKUP.maxDesktop;
  const n = Math.max(0, Math.min(want, cap, room)); if (!n) return { ok: false, why: 'budget' };
  const dur = Math.max(BACKUP.minDur, Math.min(BACKUP.maxDur, Number.isFinite(+g.durationSec) ? +g.durationSec : 180));
  return { ok: true, faction, kind: F.kind, hp: F.hp, n, want, dur, weapon: ARMED[g.armed] || 'pipe', vehicle: g.vehicle || null, trimmed: n < want };
}
// follow slot i of n: flanking you, alternating left/right and fanning back (so the chase camera actually sees them)
// yaw: player facing, forward = (-sin, -cos)
export function escortSlot(i, n, x, z, yaw, r = BACKUP.follow) { const side = i % 2 ? 1 : -1, rank = Math.floor(i / 2), a = yaw + side * (0.42 + rank * 0.3), rr = r + rank * 1.2; /* narrow: a portrait phone has a ~40° horizontal FOV */ return { x: x - Math.sin(a) * rr, z: z - Math.cos(a) * rr }; }
// nearest live hostile within range of the escort or the player
export function escortTarget(e, P, targets, range = BACKUP.engage) {
  let best = null, bd = Infinity; for (const t of targets || []) { if (!t || t.alive === false) continue; const dp = Math.hypot(t.x - P.x, t.z - P.z); if (dp > range) continue; const d = Math.hypot(t.x - e.x, t.z - e.z); if (d < bd) { bd = d; best = t; } } return best;
}

// ---------- ssx:npc-down (Marsmania's paramedic job, PR #12, listens on window) ----------
const DOWN_NAMES = { junkie: 'Junkie', thug: 'Saltblood', colonist: 'Colonist', victim: 'Colonist', escort: 'Saltblood escort' };
const ESCORT_NAMES = { saltblood: 'Saltblood escort', dustjaws: 'Dustjaw escort', saints: 'Vacuum Saint escort' };
// optional faction slug on ssx:npc-down (for SSX.rep): junkies + muggers -> 'junkies', Saltblood thugs/cars/escorts -> 'saltblood',
// other gangs -> their mars/turf.js slug (n.faction). Colonists/victims/unknown -> no faction field.
export const NPC_FACTION = { junkie: 'junkies', thug: 'saltblood' };
export function npcFaction(n) { const f = n?.faction; if (typeof f === 'string' && /^[a-z0-9_-]{1,24}$/i.test(f)) return f.toLowerCase(); if (n?.escort) return 'saltblood'; return NPC_FACTION[n?.kind] || null; }
export function npcDownDetail(n) { const x = +n?.x, z = +n?.z, faction = npcFaction(n);
  const d = { x: Number.isFinite(x) ? x : 0, z: Number.isFinite(z) ? z : 0, name: String(n?.name || (n?.escort ? ESCORT_NAMES[faction] || DOWN_NAMES.escort : DOWN_NAMES[n?.kind] || DOWN_NAMES[n?.role] || n?.kind || 'Someone')) };
  if (faction) d.faction = faction; return d; }
// guarded: never throws into the game loop. tgt defaults to window (absent in node unless a test passes one)
export function emitNpcDown(n, tgt = typeof window !== 'undefined' ? window : null) {
  try { if (!tgt?.dispatchEvent || typeof CustomEvent !== 'function') return false; tgt.dispatchEvent(new CustomEvent('ssx:npc-down', { detail: npcDownDetail(n) })); return true; } catch (e) { return false; }
}
