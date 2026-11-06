// v7.5.76 crew mission chains (📜 Contacts): one hand-written 3-beat chain per hired crew member (crewcore.js ROSTER: Dex, Vee,
// Soren, Mags). Pure rules, no DOM / THREE: tests/test-crewfic-unit.mjs runs it in node, mars/crewfic.js drives it.
// Each beat = 2-4 visible objectives + one reward line shown before you accept. Rewards pay exactly once (claimed[] flags),
// beat 3 also unlocks a permanent crew perk wired into crew.js / empire / heist (perks()). Fiction only: invented people,
// invented crimes, no real-world how-to. Places are AJ-relative metres (Ares Junction centre; x east, z south).
export const KEY = 'ssx.crewfic.v1', VERSION = 1;
export const IDS = ['dex', 'vee', 'soren', 'mags']; // crewcore ROSTER order (hire order); nobody else gets a chain here
// objective types: go (reach `at` within r; drive = in a vehicle) · hold (stay within r for sec) · act (tap the button at `at`)
// · pay (pay cr at `at`) · crack (beat the safe dial at `at`, heist.safeCrack tier) · clean (0 wanted stars; heat = raise this
// many stars when it becomes current, the setback) · choice (pick one of beat.choice in the Contacts card)
const P = { // AJ-relative world places these chains visit (all existing landmarks; none at Red Static Gulch)
  crew: [-50, 30], corner: [-42, -26], flats: [-262, -20], flats2: [-296, -32], blue: [-258, -50], kettle: [-302, -58], saltblood: [-266, -66],
  chop: [-300, -85], tenement: [-290, 0], wash: [-60, 20], thinair: [-14, -410], whisper: [42, -448], dorsey: [-30, -414], loft: [45, -460],
  colsec: [-2, -52], beltE: [124, 164], beltW: [-140, 24], silo: [10, 226], post: [-70, 210], helios: [300, 72], helios2: [344, 74], greenhouse: [360, 130]
};
export const PLACES = P;
export const CHAINS = {
  dex: {
    title: 'Clean Hands', icon: '🧱', color: 0xd8a040,
    blurb: 'Dex is sick of corners. He wants one legit door with his name on the lease, and he\u2019ll bleed the street dry to buy it.',
    perk: { payoff: 0.10, line: 'Dex crew payoff +10% (permanent)' },
    beats: [
      { title: 'Dirty corner', where: 'Ares Junction', reward: { cr: 600, stars: 60 },
        say: 'Dex: \u201cOne more summer on Dust Street. Stand where the cameras can\u2019t and look like you own it.\u201d',
        obj: [{ t: 'go', at: P.crew, r: 8, txt: 'Meet Dex by the Red Dust Wash' }, { t: 'go', at: P.corner, r: 8, txt: 'Walk to Dex\u2019s corner on Dust Street' },
          { t: 'hold', at: P.corner, r: 12, sec: 15, txt: 'Hold the corner while Dex works it' }, { t: 'act', at: P.corner, r: 8, label: '💵 Take the cut', txt: 'Take the cut off the runner' }] },
      { title: 'Rogue crew', where: 'Red Tape Flats', reward: { cr: 1200, stars: 120 },
        say: 'Dex: \u201cSome Flats kids are stepping on my product and selling it under my name. Remind them whose name it is.\u201d',
        obj: [{ t: 'go', at: P.flats, r: 10, txt: 'Find the rogue crew in Red Tape Flats' }, { t: 'act', at: P.flats2, r: 8, label: '👊 Lean on them', txt: 'Lean on the crew skimming Dex\u2019s product' },
          { t: 'clean', heat: 1, txt: 'Somebody called it in: lose the heat (0 ★)' }] },
      { title: 'A real front', where: 'Olympus Row → Xen-7', reward: { cr: 2500, stars: 250 },
        say: 'Dex: \u201cGuy at The Thin Air says he can make a lease clean. Pay him. If he runs, we chase. That\u2019s the setback, not the end.\u201d',
        obj: [{ t: 'go', at: P.thinair, r: 9, txt: 'Meet the paper fixer at The Thin Air' }, { t: 'pay', at: P.thinair, r: 9, cr: 1000, label: '💵 Pay the fixer 1,000 cr', txt: 'Pay the fixer for a clean lease' },
          { t: 'go', at: P.post, r: 10, drive: true, txt: 'Setback: he ran. Drive to Xen-7 Trading Post' }, { t: 'act', at: P.post, r: 9, label: '📄 Take the lease back', txt: 'Get Dex\u2019s lease back from the fixer' }] }
    ]
  },
  vee: {
    title: 'The Impossible Lift', icon: '🔐', color: 0xff5a5a,
    blurb: 'Vee has opened every lock in the Junction. Now she wants the one nobody\u2019s cracked: the Meridian vault under Olympus Row.',
    perk: { tolMul: 1.4, time: 8, line: 'Vee: safe dial window +40% wider, +8 s (permanent)' },
    beats: [
      { title: 'Practice lock', where: 'Dustbowl Homestead', reward: { cr: 700, stars: 80 },
        say: 'Vee: \u201cThe silo office has a farm safe older than the dome. Warm-up. Don\u2019t breathe on it.\u201d',
        obj: [{ t: 'go', at: P.silo, r: 10, txt: 'Meet Vee at the Dustbowl silo' }, { t: 'crack', at: P.silo, r: 9, tier: 'easy', label: '🔐 Crack the silo safe', txt: 'Crack the old silo safe' },
          { t: 'clean', txt: 'Leave clean (0 ★)' }] },
      { title: 'Alarms', where: 'Helios Heights', reward: { cr: 1500, stars: 150 },
        say: 'Vee: \u201cHelios wires everything to a box on the corner. Kill the box, then we talk to the safe in Greenhouse Nine.\u201d',
        obj: [{ t: 'go', at: P.helios, r: 10, txt: 'Get into Helios Heights' }, { t: 'act', at: P.helios2, r: 8, label: '📡 Cut the alarm box', txt: 'Cut the street alarm box' },
          { t: 'crack', at: P.greenhouse, r: 9, tier: 'medium', label: '🔐 Crack the back-office safe', txt: 'Crack the Greenhouse Nine back-office safe' }, { t: 'clean', txt: 'Get out clean (0 ★)' }] },
      { title: 'One big score', where: 'Olympus Row → Flats', reward: { cr: 3500, stars: 300 },
        say: 'Vee: \u201cMeridian vault. Four tumblers and a guard who naps at shift change. If the silent alarm trips, we run, we don\u2019t argue.\u201d',
        obj: [{ t: 'hold', at: P.loft, r: 10, sec: 20, txt: 'Drill the Meridian vault door (stay close)' }, { t: 'crack', at: P.loft, r: 9, tier: 'hard', label: '🔐 Crack the Meridian vault', txt: 'Crack the Meridian vault' },
          { t: 'clean', heat: 2, txt: 'Setback: silent alarm. Lose the heat (0 ★)' }, { t: 'go', at: P.tenement, r: 10, drive: true, txt: 'Drive the take to Tenement 9C' }] }
    ]
  },
  soren: {
    title: 'Static', icon: '📻', color: 0x7ad0ff,
    blurb: 'Soren has listened to ColSec so long he hears their bands in his sleep. One last job on the scanner, then he wants out.',
    perk: { bustMul: 0.7, line: 'Soren: crew bust chance −30% (permanent)' },
    beats: [
      { title: 'Scanner taps', where: 'Colony Security → Beltway', reward: { cr: 600, stars: 70 },
        say: 'Soren: \u201cTwo taps. One behind Colony Security, one on the Beltway relay. Then we sit and listen to a shift change.\u201d',
        obj: [{ t: 'act', at: P.colsec, r: 8, label: '📻 Plant the tap', txt: 'Plant a tap behind Colony Security' }, { t: 'act', at: P.beltE, r: 9, label: '📻 Splice the relay', txt: 'Splice the Beltway relay' },
          { t: 'hold', at: P.beltE, r: 14, sec: 15, txt: 'Listen through a ColSec shift change' }] },
      { title: 'The busted informant', where: 'Olympus Row', reward: { cr: 1000, stars: 120 },
        say: 'Soren: \u201cThe taps say Whisper\u2019s been turned. ColSec has a file on our crew. Dorsey can lose files. For a price.\u201d',
        obj: [{ t: 'go', at: P.whisper, r: 9, txt: 'Find Whisper on Olympus Row' }, { t: 'hold', at: P.whisper, r: 10, sec: 10, txt: 'Hear what Whisper told ColSec' },
          { t: 'pay', at: P.dorsey, r: 9, cr: 500, label: '💵 Pay Dorsey 500 cr', txt: 'Pay Sgt. Dorsey to lose the crew file' }] },
      { title: 'The final call', where: 'Red Tape Flats', reward: null,
        say: 'Soren: \u201cWhisper\u2019s hiding in the Flats, scared stupid. Your call, boss. I just want to stop hearing his voice on the band.\u201d',
        choice: [{ id: 'shield', label: '🛡️ Shield him', blurb: 'Hide Whisper. He owes you forever.', reward: { cr: 1500, stars: 300 } },
          { id: 'cut', label: '📞 Cut him loose', blurb: 'Sell his hideout to ColSec. Cash now, colder streets.', reward: { cr: 3000, stars: 150 } }],
        obj: [{ t: 'go', at: P.tenement, r: 10, txt: 'Find Whisper at Tenement 9C' }, { t: 'choice', txt: 'Make the call on Whisper (Contacts card)' },
          { t: 'clean', heat: 1, txt: 'Somebody saw you. Lose the heat (0 ★)' }] }
    ]
  },
  mags: {
    title: 'Saltblood Debt', icon: '🩸', color: 0xc070ff,
    blurb: 'Saltblood ate Mags\u2019s old crew in the Flats. She wants their chop shop, their corner and their name off the wall.',
    perk: { wash: 0.10, line: 'Mags: +10% on all front washing (permanent)' },
    beats: [
      { title: 'Rivals', where: 'Red Tape Flats', reward: { cr: 700, stars: 80 },
        say: 'Mags: \u201cWatch the tape corner. Count their runners. Find where they stash. Then we know what we\u2019re eating.\u201d',
        obj: [{ t: 'go', at: P.saltblood, r: 10, txt: 'Scope the Saltblood tape corner' }, { t: 'hold', at: P.saltblood, r: 14, sec: 15, txt: 'Count their runners' },
          { t: 'act', at: P.kettle, r: 8, label: '📸 Mark the stash', txt: 'Mark the Saltblood stash by Kettle\u2019s' }] },
      { title: 'A front', where: 'Flats → Ares Junction', reward: { cr: 1400, stars: 140 },
        say: 'Mags: \u201cRustbucket Parts is Saltblood money. Swap their books, walk the real ones to your Wash. Paper kills slower but surer.\u201d',
        obj: [{ t: 'act', at: P.chop, r: 9, label: '📒 Swap the books', txt: 'Swap the books at Rustbucket Parts' }, { t: 'clean', heat: 1, txt: 'They noticed. Lose the heat (0 ★)' },
          { t: 'go', at: P.wash, r: 9, drive: true, txt: 'Drive the real books to the Red Dust Wash' }] },
      { title: 'Takeover', where: 'Red Tape Flats', reward: { cr: 3000, stars: 280 },
        say: 'Mags: \u201cWe walk in, we take the keys. They\u2019ll torch something on the way out. Let them. We\u2019re buying new locks anyway.\u201d',
        obj: [{ t: 'hold', at: P.chop, r: 12, sec: 25, txt: 'Hold Rustbucket Parts while Saltblood clears out' },
          { t: 'pay', at: P.chop, r: 10, cr: 800, label: '💵 Pay the cleaners 800 cr', txt: 'Setback: they torched the office. Pay the cleaners' },
          { t: 'act', at: P.chop, r: 9, label: '🔑 Change the locks', txt: 'Change the locks. It\u2019s Mags\u2019s shop now' }] }
    ]
  }
};

const fmt = n => Math.round(n).toLocaleString('en-US');
export const rewardLine = (r, perk) => [r ? `+${fmt(r.cr)} cr · +${fmt(r.stars)}⭐` : '', perk ? perk.line : ''].filter(Boolean).join(' · ');
// every reward the beat can pay, as shown before you accept (choice beats list both options)
export function beatRewardLines(id, b) {
  const C = CHAINS[id], B = C?.beats[b]; if (!B) return [];
  const perk = b === 2 ? C.perk : null;
  if (B.choice) return [...B.choice.map(o => `${o.label}: ${rewardLine(o.reward)}`), ...(perk ? [`Either way: ${perk.line}`] : [])];
  return [rewardLine(B.reward, perk)];
}
export function fresh() { const c = {}; for (const id of IDS) c[id] = { beat: 0, flags: [], choice: null, heat: false }; return { v: VERSION, active: null, c, claimed: [], paid: { cr: 0, stars: 0 } }; }
const nn = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
export function load(raw) {
  let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  const f = fresh(); if (!o || typeof o !== 'object' || o.v !== VERSION) return f;
  const okClaim = k => { const m = /^(dex|vee|soren|mags):([123])$/.exec(k); return !!m; };
  f.claimed = Array.isArray(o.claimed) ? [...new Set(o.claimed.filter(k => typeof k === 'string' && okClaim(k)))] : [];
  for (const id of IDS) {
    const q = o.c?.[id] || {}, C = CHAINS[id];
    // beat = beats finished; never below what's already claimed (a claimed beat is never replayed or re-paid)
    let beat = Math.min(3, nn(q.beat)); for (let b = 1; b <= 3; b++) if (f.claimed.includes(`${id}:${b}`)) beat = Math.max(beat, b);
    const n = beat < 3 ? C.beats[beat].obj.length : 0;
    const flags = beat < 3 && beat === Math.min(3, nn(q.beat)) && Array.isArray(q.flags) ? q.flags.slice(0, n).map(Boolean) : [];
    const ch = C.beats[2].choice?.some(x => x.id === q.choice) ? q.choice : null;
    f.c[id] = { beat, flags, choice: ch, heat: !!q.heat && beat < 3 };
  }
  f.active = IDS.includes(o.active) && f.c[o.active].beat < 3 ? o.active : null;
  f.paid = { cr: nn(o.paid?.cr), stars: nn(o.paid?.stars) };
  return f;
}
export const done = (s, id) => s.c[id]?.beat >= 3;
// hired = ids on your crew (crew.js state). Lock = not hired; the ⭐ gate is crewcore's, untouched here.
export function status(s, id, hired = []) {
  if (!CHAINS[id]) return 'none'; if (done(s, id)) return 'done'; if (!hired.includes(id)) return 'locked';
  if (s.active === id) return 'active'; const q = s.c[id]; return q.beat > 0 || q.flags.some(Boolean) ? 'progress' : 'ready';
}
export const STATUS_TXT = { locked: '🔒 Locked', ready: 'Ready', progress: 'In progress', active: '▶ Active', done: '✓ Done' };
export function accept(s, id, hired = []) {
  const st = status(s, id, hired);
  if (st === 'locked') return { ok: false, why: 'Hire them first: ☰ → 👥 Crew.' };
  if (st === 'done') return { ok: false, why: 'That chain is finished.' };
  if (st === 'active') return { ok: true, already: true };
  if (s.active && s.active !== id) return { ok: false, why: `Pause ${CHAINS[s.active].title} first. One chain at a time.` };
  s.active = id; const q = s.c[id], n = CHAINS[id].beats[q.beat].obj.length; while (q.flags.length < n) q.flags.push(false);
  return { ok: true };
}
export function pause(s) { if (!s.active) return false; s.active = null; return true; } // progress (beat, flags) stays
export function current(s) {
  const id = s.active; if (!id || done(s, id)) return null; const q = s.c[id], B = CHAINS[id].beats[q.beat];
  const i = B.obj.findIndex((_, k) => !q.flags[k]); return { id, chain: CHAINS[id], beat: q.beat, B, i, obj: i >= 0 ? B.obj[i] : null, flags: q.flags.slice() };
}
// tick objective i of the active chain's current beat. Only the current objective can tick (no skipping, no double ticks).
export function tick(s, id, beat, i) {
  const c = current(s); if (!c || c.id !== id || c.beat !== beat || c.i !== i) return false;
  s.c[id].flags[i] = true; return true;
}
export function choose(s, id, opt) {
  const c = current(s); if (!c || c.id !== id || c.obj?.t !== 'choice') return false;
  if (!c.B.choice?.some(o => o.id === opt)) return false; s.c[id].choice = opt; s.c[id].flags[c.i] = true; return true;
}
// the reward a finished beat pays: null when it isn't finished or was already claimed. Marks it claimed and advances the beat.
// Call once, save, then pay what it returns. Double taps, reloads and re-opened cards all hit the claimed flag.
export function claim(s, id) {
  const q = s.c[id], C = CHAINS[id]; if (!q || q.beat >= 3) return null; const B = C.beats[q.beat], key = `${id}:${q.beat + 1}`;
  if (s.claimed.includes(key)) { q.beat++; q.flags = []; return null; }
  if (B.obj.some((_, k) => !q.flags[k])) return null;
  const r = B.choice ? B.choice.find(o => o.id === q.choice)?.reward : B.reward; if (!r) return null;
  s.claimed.push(key); const beat = ++q.beat; q.flags = []; q.heat = false; s.paid.cr += r.cr; s.paid.stars += r.stars;
  const perk = beat === 3 ? C.perk : null; if (beat === 3) { if (s.active === id) s.active = null; }
  else if (s.active === id) { const n = C.beats[beat].obj.length; q.flags = new Array(n).fill(false); }
  return { id, beat, cr: r.cr, stars: r.stars, perk, line: rewardLine(r, perk) };
}
// permanent perks from finished chains (beat 3 claimed). Read by crew.js (payoff, bustMul), heist.safeCrack (tolMul, time),
// empire.launder (wash). Neutral values when nothing is unlocked.
export function perks(s) {
  const has = id => s.claimed.includes(`${id}:3`);
  return { payoff: has('dex') ? CHAINS.dex.perk.payoff : 0, tolMul: has('vee') ? CHAINS.vee.perk.tolMul : 1, time: has('vee') ? CHAINS.vee.perk.time : 0,
    bustMul: has('soren') ? CHAINS.soren.perk.bustMul : 1, wash: has('mags') ? CHAINS.mags.perk.wash : 0 };
}
// crew jobs bust when rng() < bustOf(job, lv) (crewcore.step). Dividing the roll by bustMul makes P(bust) exactly bustMul x bustOf.
export const scaleRoll = (u, mul = 1) => (mul > 0 && mul < 1 ? Math.min(0.999999, u / mul) : u);
// the safe dial with Vee's perk: wider notch (tol) and more time, from heistcore SAFE_TIERS[tier]
export function safeOverrides(base, pk) { if (!base || !(pk.tolMul > 1 || pk.time > 0)) return null; return { tol: +(base.tol * pk.tolMul).toFixed(2), time: base.time + (pk.time || 0) }; }
export const toWorld = (col, at) => ({ x: col.x + at[0], z: col.z + at[1] });
export const dirTo = (dx, dz) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 / 45) % 8];
