// Mars city ambience: pedestrian barks. Short context lines (NPC_BARKS.md + district flavour) shown as small speech
// captions above nearby NPCs. Everything here is pure (selection, rate limiting, caption placement) and unit-tested;
// mars-audio.js does the DOM + the triggers. Lines stay at 65 characters max for iPhone portrait.
export const BARKS = {
  street: ["Dome 2's leaking again. Breathe shallow, it's free.", 'Paid forty credits for water. Forty. It tasted like the pipe.',
    "You see that guy's eyes? Blue. Glowing. Dust, man.", 'My cousin went to Europa. Now he owes Halvorsen his kidneys.',
    "Security took my bike. Said it was 'evidence.' Of what?", "Don't go past the dunes after dark. Things dig up there.",
    "The Velvet Airlock's got a new DJ. Bass shook my fillings loose.", "Meridian's hiring. Meridian's always hiring. Wonder why.",
    "Who parks a Starship there? Who does that?", "I'm not drunk. The gravity's just low.",
    "Saltblood boys outside the Cantina again. Red tape, big guns.", "Rook was asking about you. That's never good.",
    'Tycho bookies have Kestrel at 3-to-1. Fix is in.', "If you see Rusk, I wasn't here.", 'Hey, you dropped something. Oh. Your dignity.'],
  downtown: ['Meridian bonus season. Buy something ugly and expensive.', "Don't touch the glass. It costs more than you.",
    'My broker says dust futures are up. My broker is high.', 'ColSec on every corner and I still got pickpocketed.',
    "Transit ring's late. The transit ring is always late.", 'Walk faster. Some of us bill by the minute.',
    'The Trust HQ has a vault the size of a dome. Allegedly.'],
  flats: ['Saltblood turf. Keep your eyes on your boots.', 'Buy, sell or keep walking, friend.',
    "Water tower's tagged again. Marrow's gonna lose it.", 'Chop shop pays cash. No questions. No receipts.',
    'You lost? You look lost. Lost costs extra here.', "Funeral bar's got a two-for-one. Grim, but cheap.",
    "Hey! That's my dog's spot. Move, asshole."],
  heights: ["Are you on the guest list? You don't look listed.", 'Private security, darling. Smile for the drones.',
    "The fountain runs on imported water. Don't drink it.", 'Ugh. Who let a rover with dents in here?',
    'We pay extra so people like you stay out.', 'Lovely day for minding your own business.'],
  bump: ['Hey, watch where you\u2019re walking!', 'Personal space, pal. Look it up.', 'Excuse YOU.', 'Touch me again and lose the hand.', 'Do I look like a doorway?'],
  hit: ['Ow! What the hell?!', "You're gonna regret that, pal.", 'Are you insane?! Security!', 'My teeth! Those were rentals!'],
  gun: ['Whoa, whoa, put it away!', 'Not again. Not in the dome.', 'Gun! Everybody down!', 'Holy shit, get down!'],
  stolen: ["That's my ride, you asshole!", 'Hey! HEY! Security!', 'I just made a payment on that!'],
  wanted: ["That's them! That's the one on the screens!", 'Security! Over here!', "I didn't see nothing. I swear."],
  flashy: ['Damn! That paint job is filthy!', "Nice wheels. Who'd you kill for those?", 'Ooh, underglow. Very subtle. Very cop-bait.',
    'Rev it again, I dare you.', "That ride's hotter than the reactor."],
  speeding: ['Slow down, maniac! People live here!', 'Watch it! You almost flattened me!', 'Learn to drive, dust-for-brains!', 'Are you blind or just stupid?!'],
  dog: ['Is he friendly?', "He's judging me. The dog is judging me.", 'Is that a dog in a helmet? Hey, buddy! Hey!'],
  security1: ['Hold it right there.', 'Citizen, stop. Now.'],
  security2: ['Shots fired, shots fired!', 'Suspect is armed. Weapons free.'],
  security3: ['Ram them! Box them in!', 'Patrol 3, cut them off at the loop!'],
  security4: ['Requesting armed squad, Ares Junction.', 'All units, lethal force.'],
  security5: ['Deploying APC. Clear the dome.', 'This is a lockdown. Nobody leaves.'],
  search: ['Lost visual.', 'Check behind the hauler.', 'They went north. Probably.'],
  lost: ['Suspect lost. Back to patrol.', 'Forget it. Paperwork\u2019s worse.']
};
// Priority (higher interrupts the global gap sooner) and per-category gap in seconds
export const CATS = {
  gun: { p: 5, gap: 4 }, hit: { p: 5, gap: 2 }, stolen: { p: 4, gap: 4 }, wanted: { p: 3, gap: 6 }, security: { p: 3, gap: 5 },
  search: { p: 2, gap: 8 }, lost: { p: 3, gap: 6 }, speeding: { p: 3, gap: 5 }, bump: { p: 3, gap: 3 }, flashy: { p: 2, gap: 8 },
  dog: { p: 1, gap: 20 }, street: { p: 1, gap: 9 }, downtown: { p: 1, gap: 9 }, flats: { p: 1, gap: 9 }, heights: { p: 1, gap: 9 }
};
export const BARK_CFG = { globalGap: 3.5, urgentGap: 1.2, npcGap: 12, maxVisible: 2, life: 2.6, perChar: 0.035, recent: 6 };
export const catKey = c => (/^security\d$/.test(c) ? 'security' : c);

// Which category does the situation call for? ctx: { since: { gun, hit, stolen, bump, lost } (seconds ago),
// wanted, evading, driving, speed, flash (0..1), dog, district ('downtown'|'flats'|'heights'|null), kind ('colonist'|'guard'), dist }
export function chooseCategory(ctx, rng = Math.random) {
  const s = ctx.since || {}, guard = ctx.kind === 'guard', recent = k => s[k] !== undefined && s[k] < 2.5;
  if (guard) {
    if (ctx.wanted > 0) return ctx.evading ? 'search' : 'security' + Math.max(1, Math.min(5, ctx.wanted | 0));
    if (recent('lost')) return 'lost';
    if (recent('gun')) return 'security2';
    return null; // guards stay quiet otherwise
  }
  if (recent('hit') && ctx.dist < 6) return 'hit';
  if (recent('gun') && ctx.dist < 30) return 'gun';
  if (recent('stolen') && ctx.dist < 20) return 'stolen';
  if (ctx.wanted > 0 && ctx.dist < 14) return 'wanted';
  if (ctx.driving) {
    if (Math.abs(ctx.speed) > 15 && ctx.dist < 12) return 'speeding';
    if ((ctx.flash > 0.35 || ctx.boosting) && ctx.dist < 16 && Math.abs(ctx.speed) > 2) return 'flashy';
    return null;
  }
  if (recent('bump') && ctx.dist < 2.5) return 'bump';
  if (ctx.dist > 7) return null;
  if (ctx.dog && rng() < 0.2) return 'dog';
  return ctx.district && BARKS[ctx.district] && rng() < 0.6 ? ctx.district : 'street';
}
// Pick a line from a category, avoiding the last few lines used (recent is a shared array, mutated)
export function pickLine(cat, recent = [], rng = Math.random, pool = BARKS, maxRecent = BARK_CFG.recent) {
  const list = pool[cat]; if (!list || !list.length) return null;
  let opts = list.filter(l => !recent.includes(l)); if (!opts.length) opts = list;
  const line = opts[Math.floor(rng() * opts.length) % opts.length]; recent.push(line); while (recent.length > maxRecent) recent.shift(); return line;
}
// Rate limiter: global gap (shorter for urgent categories), per-NPC gap, per-category gap and a visible cap.
export function createLimiter(cfg = BARK_CFG, cats = CATS) {
  let lastAny = -1e9; const npc = new Map(), cat = new Map(); let shown = []; // shown: end times
  return {
    visible(now) { shown = shown.filter(e => e > now); return shown.length; },
    can(now, key, c) {
      const k = catKey(c), C = cats[k] || { p: 1, gap: 8 };
      if (this.visible(now) >= cfg.maxVisible) return false;
      if (now - lastAny < (C.p >= 4 ? cfg.urgentGap : cfg.globalGap)) return false;
      if (key != null && now - (npc.get(key) ?? -1e9) < (C.p >= 4 ? cfg.npcGap * 0.25 : cfg.npcGap)) return false;
      if (now - (cat.get(k) ?? -1e9) < C.gap) return false;
      return true;
    },
    mark(now, key, c, life = cfg.life) { lastAny = now; if (key != null) npc.set(key, now); cat.set(catKey(c), now); shown.push(now + life); if (npc.size > 64) npc.delete(npc.keys().next().value); }
  };
}
export const lifeFor = (line, cfg = BARK_CFG) => cfg.life + Math.min(2, (line?.length || 0) * cfg.perChar);
// Caption placement: NDC (nx, ny, nz from Vector3.project) -> screen px, kept off the screen centre (crosshair / the
// player), out of the top bar and the bottom control band, and stacked when two captions are close.
export function placeCaption(nx, ny, nz, w, h, others = []) {
  if (!(nz < 1) || !isFinite(nx) || !isFinite(ny)) return null; // behind the camera
  let x = (nx + 1) / 2 * w, y = (1 - ny) / 2 * h;
  if (x < -w * 0.1 || x > w * 1.1 || y < -h * 0.2 || y > h * 1.1) return null; // well off screen: don't show
  const top = h * 0.13, bottom = h * 0.6, cx = w / 2, cy = h / 2, bw = w * 0.17, bh = h * 0.09;
  x = Math.max(w * 0.16, Math.min(w * 0.84, x)); y = Math.max(top, Math.min(bottom, y));
  if (Math.abs(x - cx) < bw && Math.abs(y - cy) < bh) y = cy - bh; // lift above the centre box
  for (const o of others) if (Math.abs(o.x - x) < w * 0.3 && Math.abs(o.y - y) < 26) y = Math.max(top, o.y - 28);
  return { x: Math.round(x), y: Math.round(y) };
}
