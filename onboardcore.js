// v7.5.x "First Day on Mars": pure logic for the guided tour + the ☰ → 📖 How to play codex.
// No DOM, no three.js: onboard.js feeds it the game state and draws the one prompt line.
// Every control named here exists in the game (index.html key map / touch buttons, or the add-on's own panel).
// Missions: a few short steps each, one plain sentence at a time. Text has a phone version and a keyboard version.

export const SAVE_KEY = 'ssx.onboard.v1';

// Keys other systems write once you've actually played. Any of them with content means "returning player".
export const PLAYED_KEYS = ['ssx.discoveries.v1', 'ssx.turf.v1', 'ssx.contraband.v1', 'ssx.jobs.v1', 'ssx.mars.act.v1', 'ssx.r2r.v1',
  'ssx.planets.v1', 'ssx.fight.v1', 'ssx.base.v1', 'ssx.empire.v1', 'ssx.bribes.v1', 'ssx.rep.v1'];
export const PROGRESS_KEY = 'ssx.progress.v1';

const parse = s => { if (s == null || s === '') return null; try { return JSON.parse(s); } catch (e) { return null; } };
const hasContent = v => v != null && (Array.isArray(v) ? v.length > 0 : typeof v === 'object' ? Object.keys(v).length > 0 : !!v);

// get(key) -> raw string | null (localStorage.getItem). True when this save has real progress in it.
export function isReturningPlayer(get) {
  const p = parse(get(PROGRESS_KEY));
  if (p && typeof p === 'object') {
    if ((+p.xp || 0) > 0 || (+p.credits || 0) > 0 || (+p.level || 1) > 1) return true;
    if (hasContent(p.quests) || hasContent(p.done) || hasContent(p.badges) || hasContent(p.owned) || hasContent(p.flags)) return true;
  }
  for (const k of PLAYED_KEYS) if (hasContent(parse(get(k)))) return true;
  return false;
}

export function freshState() { return { v: 1, status: 'new', m: 0, s: 0, paid: [], at: 0 }; }

// Decide the starting state. stored = parsed ssx.onboard.v1 (or null). force: 'on' | 'off' | null (from ?onboard=1/0).
export function initialState(stored, returning, force = null) {
  if (force === 'on') return { ...freshState(), status: 'active' };
  if (stored && stored.v === 1 && typeof stored.status === 'string') {
    const st = { ...freshState(), ...stored, paid: Array.isArray(stored.paid) ? stored.paid.slice() : [] };
    if (force === 'off' && st.status === 'active') st.status = 'paused';
    return st;
  }
  if (force === 'off') return { ...freshState(), status: 'paused' };
  if (returning) return { ...freshState(), status: 'skipped', auto: true };
  return { ...freshState(), status: 'active' };
}

// ---------- missions ----------
// step.kind: 'go' = reach a target (target id, radius r); 'do' = a check onboard.js evaluates (check id); 'tell' = read, auto-advances.
// text: { touch, desk } or a single string for both. alt: shown instead when the runtime says the normal way isn't possible.
export const MISSIONS = [
  { id: 'feet', title: 'Find your feet', reward: 25, steps: [
    { kind: 'go', target: 'walk', r: 4, label: 'Walk here',
      text: { touch: 'Walk to the blue marker: push the left stick. Hold Run to go faster.', desk: 'Walk to the blue marker with W A S D. Hold Shift to run.' } },
    { kind: 'do', check: 'jump', text: { touch: 'Now jump: tap Jump.', desk: 'Now jump: press Space.' } }
  ] },
  { id: 'wheels', title: 'Wheels', reward: 40, steps: [
    { kind: 'go', target: 'rover', r: 5, check: 'driving', label: 'Your rover',
      text: { touch: 'Walk up to your rover and tap 🚙 Drive.', desk: 'Walk up to your rover and press E to drive.' },
      alt: { touch: 'Your rover is far away: tap ☰, then 🚙 Summon rover here.', desk: 'Your rover is far away: press R to call it.' } },
    { kind: 'go', target: 'taxi', r: 10, label: 'Taxi stand',
      text: { touch: 'Drive to the 🚕 Taxi stand in Ares Junction. Hold ⚡ Boost to go faster.', desk: 'Drive to the 🚕 Taxi stand in Ares Junction. Hold Shift to boost.' } }
  ] },
  { id: 'phone', title: 'Your phone & jobs', reward: 40, steps: [
    { kind: 'do', check: 'jobsOpen',
      text: { touch: 'The black buttons on the right are your phone. Tap 💼 Jobs.', desk: 'Press J to open 💼 Jobs.' },
      alt: { touch: 'Your phone apps are in the ☰ menu. Tap ☰, then 💼 Jobs.', desk: 'Tap ☰, then 💼 Jobs.' } },
    { kind: 'do', check: 'panelsClosed', text: 'Taxi, Paramedic and Vigilante shifts pay cash. Close Jobs to go on.' }
  ] },
  { id: 'street', title: 'Street business', reward: 50, steps: [
    { kind: 'go', target: 'blue', r: 9, label: 'Blue',
      text: 'Drive to Blue, the dealer at The Blue Room in Red Tape Flats.' },
    { kind: 'do', check: 'blueOpen', text: { touch: 'Tap 💊 Blue to see what Blue sells.', desk: 'Press B to see what Blue sells.' } },
    { kind: 'do', check: 'panelsClosed', text: 'Buy cheap, sell to buyers for more. Selling where cops see you adds ★ wanted stars. Close to go on.' }
  ] },
  { id: 'flats', title: 'Turf & the Pit', reward: 60, steps: [
    { kind: 'go', target: 'turfmap', r: 8, label: 'Turf map',
      text: 'Walk to the 🗺️ TURF MAP sign in Red Tape Flats.' },
    { kind: 'do', check: 'turfOpen', text: { touch: 'Tap 🚩 Turf to see which gang owns each block.', desk: 'Press K to see which gang owns each block.' },
      alt: { touch: 'Tap ☰, then 🚩 Turf to see which gang owns each block.', desk: 'Press K to see which gang owns each block.' } },
    { kind: 'do', check: 'panelsClosed', text: 'Walk up to a gang’s 🚩 flag to attack it. Hold it and it pays you cash. Close to go on.' },
    { kind: 'go', target: 'pit', r: 12, label: 'The Pit', variant: true,
      text: { touch: 'Walk to The Pit, the fight ring. Tap 📋 The Pit there to fight for cash.', desk: 'Walk to The Pit, the fight ring. Click 📋 The Pit there to fight for cash.' },
      fight: { touch: 'Walk to the Rust Pit cage. Tap 🥊 there to fight for cash.', desk: 'Walk to the Rust Pit cage. Press ] there to fight for cash.' } },
    { kind: 'tell', ms: 6000, text: 'Fists only in the Pit. Win rounds for cash; you can come back any time.' }
  ] },
  { id: 'night', title: 'Night out', reward: 100, steps: [
    { kind: 'go', target: 'club', r: 7, label: 'Velvet Airlock',
      text: 'Head back to Ares Junction, to the door of the Velvet Airlock club.' },
    { kind: 'do', check: 'inClub', text: { touch: 'Tap 🚪 Enter The Velvet Airlock to go in.', desk: 'Press E to go in.' } }
  ] }
];
export const TOTAL_REWARD = MISSIONS.reduce((a, m) => a + m.reward, 0);
export const DONE_TEXT = `Tour done! That’s ${TOTAL_REWARD} cr. Tap ☰, then 📖 How to play any time.`;
export const SPACE_TEXT = { touch: 'Tap Mars in the bottom row, then 🛬 Land here.', desk: 'Click Mars in the bottom row, then 🛬 Land here.' };
export const AWAY_TEXT = { touch: 'The tour is on Mars. Tap ☰, then 🚀 Take off, and land on Mars.', desk: 'The tour is on Mars. Press T to take off, then land on Mars.' };

export function textOf(t, touch) { return t == null ? '' : typeof t === 'string' ? t : (touch ? t.touch : t.desk) || t.touch || t.desk || ''; }

export function stepAt(st) { const m = MISSIONS[st.m]; return m ? { mission: m, step: m.steps[st.s], mi: st.m, si: st.s } : null; }

// Text for the current step. opt: { touch, alt (use alt), fight (SSX.fight present) }
export function stepText(st, opt = {}) {
  const c = stepAt(st); if (!c || !c.step) return '';
  const s = c.step; const t = opt.alt && s.alt ? s.alt : opt.fight && s.fight ? s.fight : s.text;
  return textOf(t, !!opt.touch);
}

// Advance one step. Returns { state, paid } where paid = reward credits to hand out now (mission finished) or 0.
export function advance(st) {
  const n = { ...st, paid: st.paid.slice(), at: 0 }; const m = MISSIONS[n.m]; if (!m || n.status !== 'active') return { state: n, paid: 0, done: false };
  n.s++;
  if (n.s < m.steps.length) return { state: n, paid: 0, done: false };
  let paid = 0; if (!n.paid.includes(m.id)) { n.paid.push(m.id); paid = m.reward; }
  n.m++; n.s = 0;
  if (n.m >= MISSIONS.length) { n.status = 'done'; return { state: n, paid, done: true, finished: m }; }
  return { state: n, paid, done: false, finished: m };
}

export function skip(st) { return { ...st, status: 'skipped', auto: false }; }
export function restart(st) { return { ...freshState(), status: 'active', paid: (st?.paid || []).slice() }; }
export function resume(st) { return st.status === 'done' ? restart(st) : { ...st, status: 'active' }; }
export function progressLabel(st) { const c = stepAt(st); return c ? `${c.mi + 1}/${MISSIONS.length} · ${c.mission.title}` : ''; }

// distance + 8-way arrow from player (x,z, facing yaw) to target. yaw: radians, 0 = facing -z (three.js camera default).
export function bearing(px, pz, tx, tz, yaw = 0) {
  const dx = tx - px, dz = tz - pz, d = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, -dz) + yaw; // + yaw: player turned left (positive yaw) moves the target right on screen
  const a = ((ang % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const arrows = ['⬆', '↗', '➡', '↘', '⬇', '↙', '⬅', '↖'];
  const i = Math.round(((a + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4)) % 8;
  return { d: Math.round(d), arrow: arrows[i], ang: a };
}
export function fmtDist(d) { return d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'; }

// ---------- codex ----------
// need: SSX key that must exist (optional add-ons), or null for things on main. Text: 1-2 plain sentences.
export const CODEX = [
  { sec: 'Basics', items: [
    { id: 'move', t: '🚶 Moving', d: { touch: 'Left stick walks, hold Run to sprint, tap Jump to jump.', desk: 'W A S D walks, Shift runs, Space jumps. V changes the camera.' } },
    { id: 'drive', t: '🚙 Driving', d: { touch: 'Walk up to your rover and tap 🚙 Drive; ⚡ Boost goes faster and Jump becomes Thrust. Walk up to other cars and tap Take to steal them.', desk: 'Walk up to your rover and press E; Shift boosts and Space thrusts. Press E by other cars to steal them.' } },
    { id: 'rover', t: '📍 Lost your rover?', d: { touch: 'Tap ☰, then 🚙 Summon rover here.', desk: 'Press R to call your rover, or Shift+R to jump to it.' } },
    { id: 'fight', t: '🔫 Fighting', d: { touch: 'FIRE shoots, 👊 punches. Medkits heal when you tap the health bar.', desk: 'F or click fires, C punches, Q swaps weapon, X uses a medkit.' } },
    { id: 'menu', t: '☰ Menu & phone', d: { touch: 'The ☰ button holds fast travel, shops, settings and every app. The black buttons on the right edge are phone shortcuts: 🎒 Stash, 💼 Jobs, 🚩 Turf.', desk: 'M or Tab opens the ☰ menu. B is your stash, J jobs, K turf, ? shows every key.' } },
    { id: 'radio', t: '📻 Radio & Control', d: { touch: 'Control radios you jobs; tap the radio line to read, Accept or Later. 📻 Next changes the music station.', desk: 'Control radios you jobs: Enter accepts, Backspace skips. N changes the music station.' } },
    { id: 'roll', t: '🌀 Barrel rolls', d: { touch: 'When your car is in the air, flick the stick sideways twice (or swipe across Thrust) to barrel roll.', desk: 'When your car is in the air, press Q or E to barrel roll. In space, double-tap A or D.' } },
    { id: 'space', t: '🚀 Space', d: { touch: 'Tap ☰, then 🚀 Take off to leave a planet. Tap a planet in the bottom row, then 🛬 Land here.', desk: 'Press T to take off. In space W A S D flies, L lands on the planet you picked.' } }
  ] },
  { sec: 'Mars streets', items: [
    { id: 'heat', t: '★ Wanted stars (heat)', d: 'Crimes near cops give you stars; more stars, more cops. Get far away from them or hide indoors until the stars clear.' },
    { id: 'jobs', t: '💼 Jobs', d: { touch: 'Taxi, Paramedic and Vigilante shifts pay cash. Tap 💼 Jobs, or walk to a 🚕 stand or clinic and tap the start button.', desk: 'Taxi, Paramedic and Vigilante shifts pay cash. Press J, or walk to a 🚕 stand or clinic and press G.' } },
    { id: 'blue', t: '💊 Contraband', d: { touch: 'Buy from Blue in Red Tape Flats, then sell to buyers for more. Tap 🎒 Stash to see what you carry.', desk: 'Buy from Blue in Red Tape Flats, then sell to buyers for more. Press B for your stash.' } },
    { id: 'turf', t: '🚩 Turf', d: 'Gangs own the blocks of Red Tape Flats. Take a block at its 🚩 flag, survive the waves, and it pays you every minute.' },
    { id: 'pit', t: '🥊 The Pit', d: { touch: 'The Pit is a fist-fight ring. Walk up and tap 📋 The Pit to fight rounds for cash.', desk: 'The Pit is a fist-fight ring. Walk up and click 📋 The Pit to fight rounds for cash.' } },
    { id: 'side', t: '📋 Side jobs', d: 'Tap ☰, then 📋 Mars side jobs for small gigs around the colony. Walk to one to see its button.' },
    { id: 'races', t: '🏁 Street races', d: 'Tap ☰, then 🏁 Street races to find a start line. Drive through the gates; 🛠 Track builder makes your own.' },
    { id: 'rides', t: '🚗 Rides & meets', d: 'Buy, tune and show off cars: tap ☰, then 🚗 Rides & meets.' },
    { id: 'danger', t: '🔪 Street danger', d: 'Tap ☰, then 🔪 Street danger to turn rough streets (muggers, gang fights) on or off.' },
    { id: 'club', t: '🍸 Velvet Airlock', d: 'The club in Ares Junction. Walk in through the front door; some rooms are 18+.' },
    { id: 'travel', t: '🏙 Getting around', d: 'Tap ☰, then 🏙 Districts to fast travel, or 🌍 Colonies for other towns.' },
    { id: 'rags', t: '🧱 Rags to Riches', d: 'A new game that starts you broke: tap ☰, then 🧱 New Game: Rags to Riches.' }
  ] },
  { sec: 'Add-ons (if available)', items: [
    { id: 'heists', need: 'heist', menu: '🕵️', t: '🕵️ Heists', d: 'Case a target, plan, then pull the job. Find them in ☰ → 🕵️ Heists when one is in town.' },
    { id: 'fightclub', need: 'fight', t: '🥊 Rust Pit fight club', d: { touch: 'A cage fight ring in Red Tape Flats: walk in and tap 🥊 to fight bouts.', desk: 'A cage fight ring in Red Tape Flats: walk in and press ] to fight bouts.' } },
    { id: 'rep', need: 'rep', t: '🩸 Rep', d: 'What the gangs think of you. Jobs and fights change it; see ☰ → 🩸 Rep.' },
    { id: 'bribes', need: 'bribes', t: '💰 Bribes', d: 'Pay Rusk to drop your wanted stars. The more stars, the higher the price.' },
    { id: 'gravity', need: 'gravity', t: '🌍 Gravity modes', d: { touch: 'Switch between Mars, low and zero gravity with the 🌍 button.', desk: 'Press Z on the ground (or 2) to switch between Mars, low and zero gravity.' } },
    { id: 'arsenal', need: 'arsenal', t: '🔫 Arsenal', d: { touch: 'More guns and ammo types; pick weapons from the weapon wheel.', desk: 'Hold Q for the weapon wheel, I reloads, . swaps ammo type, , scopes in.' } },
    { id: 'pursuit', need: 'pursuit', t: '🚓 Police chases', d: 'Break the cops’ line of sight, then hide or respray your car to lose them.' },
    { id: 'base', need: 'base', t: '🏠 Mars base', d: 'Your own base to build up: ☰ → 🏠 Mars base.' },
    { id: 'empire', need: 'empire', t: '🏢 Empire', d: 'Buy businesses that earn while you play: ☰ → 🏢 Empire.' },
    { id: 'storms', need: 'storm', t: '🌪 Dust storms', d: 'Dust storms roll in now and then and cut how far you can see. They pass after a few minutes.' },
    { id: 'carjack', need: 'beltway', t: '✊ Carjacking', d: { touch: 'Walk up to a car with a driver and hold ✊ Carjack.', desk: 'Walk up to a car with a driver and hold I.' } }
  ] }
];

// has(key) -> bool (is SSX[key] there?). Returns [{ sec, items:[{id,t,d(text),opt}] }] with missing add-ons dropped.
export function codexFor(touch, has = () => false) {
  return CODEX.map(s => ({ sec: s.sec, items: s.items.filter(i => !i.need || has(i.need)).map(i => ({ id: i.id, t: i.t, d: textOf(i.d, touch), opt: !!i.need })) }))
    .filter(s => s.items.length);
}
