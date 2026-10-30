// Foul-mouthed Mars locals: pure rules (no DOM, no THREE), unit-tested by tests/test-mouth-unit.mjs; mars/mouth.js runs them.
// About 1 in 4 colonists in Red Tape Flats and Olympus Row (downtown) swear at you: a greeting when they spot you on foot,
// an insult when you bump them, honk at them or drive past too close. M-rated swearing only: no slurs (nothing aimed at
// race, ethnicity, religion, sexuality, gender identity or disability), nothing sexual, no real people or brands.
// Lines stay at 65 characters max (barks.js rule for iPhone portrait).
export const GREET = [
  "What's up, bitch",
  'Look who crawled out of the dust. Hey, dumbass.',
  'Oh great, another asshole in a helmet.',
  'Yo, shithead! Nice face. Did the airlock do that?',
  "Morning, jackass. Air's thin. So's your luck.",
  "Hey dumbass, you're blocking my sun. What's left of it.",
  'Well, damn. Look at this sorry piece of shit.',
  'Sup, dipshit? Buying something or just breathing my air?',
  'Keep walking, shit-for-brains.',
  'Hey, hotshot. Who the hell let you in here?',
  'Oh look, fresh meat. Welcome to hell, asshole.',
  "You lost, dumbass? Everybody's lost in this shithole.",
  'What the hell are you looking at?',
  'Hey, bastard! Yeah, you. Nice boots, shit taste.',
  'Damn, you stink worse than the goddamn recycler.',
  'Hey, crater-face. Spare a credit or piss off.',
  "Ah hell, it's you. Make it quick, jackass.",
  "Oh for fuck's sake, not you again.",
  "Smile, asshole. ColSec's cameras love you."
];
export const INSULT = {
  bump: ['Watch it, asshole!', 'Hey! Back the hell off, dipshit!', "You blind, jackass? I'm standing right here!",
    "Touch me again and I'll kick your ass.", 'Personal space, shithead! Look it up!', 'Son of a bitch, that was my foot!'],
  honk: ['Honk at me again, asshole. I dare you.', 'Yeah, I heard you, dumbass!', 'Lay off the goddamn horn!',
    "Hit that horn again and I'll rip it off!", 'Beep at your mother, jackass!'],
  drive: ['Slow the hell down, asshole!', 'You almost flattened me, you son of a bitch!', 'Learn to drive, shit-for-brains!',
    'Get that piece of shit off my street!', 'Goddamn maniac! People live here!', 'Get the fuck outta my street!']
};
export const CFG = {
  rate: 0.25,            // share of colonists in a foul district who swear
  greetDist: 8,          // metres: they spot you on foot inside this and on screen
  bumpDist: 1.4, bumpMove: 0.12, // on foot, this close and you moved since the last check
  driveDist: 5, driveSpeed: 5,   // driving past this close, faster than this (m/s)
  honkDist: 14, honkWindow: 1.5, // a honk reaches this far, and counts for this long
  greetNpc: 25, insultNpc: 20,   // per-character cooldowns (s)
  greetGlobal: 6, insultGlobal: 2.5, // global cooldowns (s): never more than one line at a time from this module
  recent: 6
};
// which districts swear: Red Tape Flats (mars-rough) and downtown (mars-downtown, Olympus Row)
export const FOUL_DISTRICT = /(^|[-_\s])(rough|downtown)$|red.?tape|olympus/i;
export const isFoulDistrict = d => !!d && (FOUL_DISTRICT.test(d.id || '') || FOUL_DISTRICT.test(d.name || '') || /^(rough|downtown)$/.test(d.kind || ''));
export function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// Deterministic pick inside one district: rank its colonists by hash(key) and take the lowest round(n * rate), at least
// one, so every foul district has somebody who swears even with the phone's 3 colonists per district.
export function pickFoul(keys, rate = CFG.rate) {
  if (!keys.length) return new Set();
  const n = Math.max(1, Math.round(keys.length * rate));
  return new Set([...keys].sort((a, b) => hash(a) - hash(b) || (a < b ? -1 : 1)).slice(0, n));
}
// the phone NPC cap (12) parks some colonists; if none of a zone's hash picks is live, promote the lowest-hash live one
// (still deterministic: same NPCs + same live set -> same answer)
export function pickFoulLive(keys, live, rate = CFG.rate) {
  const base = pickFoul(keys, rate), lv = [...live].filter(k => keys.includes(k));
  if (lv.length && !lv.some(k => base.has(k))) for (const k of pickFoul(lv, 0)) base.add(k);
  return base;
}
// per-NPC key: zone + spawn order within the zone's colonists + name (stable across visits, same NPC same answer)
export const npcKey = (zone, i, name) => `${zone}:${i}:${name || ''}`;
// what does the situation call for? ctx: { d, driving, speed, moved, inView, honkAgo }
export function trigger(c, cfg = CFG) {
  if (c.driving) {
    if (c.honkAgo !== undefined && c.honkAgo < cfg.honkWindow && c.d < cfg.honkDist) return 'honk';
    if (c.d < cfg.driveDist && Math.abs(c.speed || 0) > cfg.driveSpeed) return 'drive';
    return null;
  }
  if (c.d < cfg.bumpDist && c.moved > cfg.bumpMove) return 'bump';
  if (c.d < cfg.greetDist && c.inView) return 'greet';
  return null;
}
export const isInsult = t => t === 'bump' || t === 'honk' || t === 'drive';
// cooldowns: per character (greet / insult kept apart so a bump right after a greeting still gets its insult) + global
export function createCooldowns(cfg = CFG) {
  const npc = new Map(); let lastGreet = -1e9, lastInsult = -1e9;
  return {
    can(now, key, type) {
      const ins = isInsult(type), g = npc.get(key) || {};
      if (ins) return now - lastInsult >= cfg.insultGlobal && now - (g.i ?? -1e9) >= cfg.insultNpc;
      return now - lastGreet >= cfg.greetGlobal && now - lastInsult >= cfg.insultGlobal && now - (g.g ?? -1e9) >= cfg.greetNpc;
    },
    mark(now, key, type) {
      const g = npc.get(key) || {}; if (isInsult(type)) { g.i = now; lastInsult = now; } else { g.g = now; lastGreet = now; } npc.set(key, g);
      if (npc.size > 128) npc.delete(npc.keys().next().value);
    },
    get size() { return npc.size; }
  };
}
export function linesFor(type) { return type === 'greet' ? GREET : INSULT[type] || null; }
// pick a line avoiding the last few (recent is mutated)
export function pickLine(type, recent = [], rng = Math.random, max = CFG.recent) {
  const list = linesFor(type); if (!list?.length) return null;
  let opts = list.filter(l => !recent.includes(l)); if (!opts.length) opts = list;
  const line = opts[Math.floor(rng() * opts.length) % opts.length]; recent.push(line); while (recent.length > max) recent.shift(); return line;
}
// a voice per character: pitch 0.75..1.3, rate 0.95..1.15 (text-to-speech), stable by key
export function voiceFor(key) { const h = hash(key); return { pitch: +(0.75 + (h % 56) / 100).toFixed(2), rate: +(0.95 + ((h >>> 8) % 21) / 100).toFixed(2) }; }
// text-to-speech only when sound is on: not muted, master volume up, tab visible, not switched off
export function ttsAllowed({ mute = false, master = 1, hidden = false, off = false, has = true } = {}) { return has && !off && !mute && master > 0.01 && !hidden; }
