// v7.5.42 Crew (Collin: "If I get to 10k stars I want a crew member to start working for me. He does basic crime and jobs and
// I increase my cr and stars. Eventually leading to more and more of an enterprise."). Pure rules, no DOM / THREE:
// tests/test-crew-unit.mjs runs it in node, crew.js drives it. Fiction only: invented people and invented crimes.
// Stars = the HUD ⭐ = game.progress.xp (lifetime, never lowered; mars/starshopcore.js). Slots unlock on lifetime stars.
// Jobs run on the real clock (like the grow racks) and keep looping while you're away, but a crew member banks at most
// BANK finished jobs before he waits for you. Cash from a finished job is "washed" through one of your Empire fronts
// (empirecore: it lands in that front's till, +WASH bonus, collect at the counter) or, with no front, paid out from the panel.
export const KEY = 'ssx.crew.v1', VERSION = 1;
export const SLOTS = [10000, 25000, 50000, 100000]; // lifetime ⭐ for crew slots 1..4
export const BANK = 3, WASH = 0.15;
export const ROSTER = [
  { id: 'dex', name: 'Dex "Grit" Malone', look: { body: 0x3b3a36, coat: 0x5a4632, hat: 0x1d1d1d, skin: 0xc49a74 },
    intro: 'Name\'s Dex. Ten grand of stars on your name and nobody watching your back? I run corners, I boost rides, I keep my mouth shut. You get the cut, I get paid.' },
  { id: 'vee', name: 'Vee Okonkwo', look: { body: 0x2c3340, coat: 0x6b2f2f, hat: 0x3a3a3a, skin: 0x7a5236 },
    intro: 'Vee. I hear you\'re building something. I can get into anything with a lock and out before the alarm finishes its first word.' },
  { id: 'soren', name: 'Soren "Static" Pell', look: { body: 0x2f3a2f, coat: 0x444444, hat: 0x5a5a20, skin: 0xd8b08c },
    intro: 'Static. I hear the ColSec bands, I know the shifts. Your people get busted less with me around.' },
  { id: 'mags', name: 'Mags Ferro', look: { body: 0x3a2f3a, coat: 0x1f2a3a, hat: 0x6a1f1f, skin: 0xb07a58 },
    intro: 'Mags. I ran a crew in the Flats before Saltblood ate it. Give me a front and I\'ll make it look legal.' },
];
// tier: crew level needed. min = real minutes per job. bust = base chance a job ends in a bust (lost cut, holding or bail).
export const JOBS = {
  hustle: { tier: 1, icon: '🎲', name: 'Corner hustle', min: 8, cr: 150, xp: 8, bust: 0.06, blurb: 'Dice, card games, a little product on the side.' },
  lift: { tier: 1, icon: '🛍️', name: 'Shoplift run', min: 15, cr: 260, xp: 14, bust: 0.08, blurb: 'Hab-mart shelves to fence buyers.' },
  boost: { tier: 2, icon: '🚗', name: 'Boost rides', min: 25, cr: 600, xp: 30, bust: 0.12, blurb: 'Lifts a rover, drives it to a buyer in the Flats.' },
  front: { tier: 3, icon: '🏢', name: 'Work a front', min: 40, cr: 0, xp: 45, bust: 0.05, front: true, blurb: 'Runs one of your fronts: pays 12 h of its takings. Needs an Empire front.' },
  score: { tier: 3, icon: '💼', name: 'Small score', min: 60, cr: 1800, xp: 90, bust: 0.2, blurb: 'Warehouse jobs, payroll pods. Big cut, real risk.' },
};
export const ORDER = ['hustle', 'lift', 'boost', 'front', 'score'];
export const LEVELS = [null, null, { cr: 2500, xp: 500 }, { cr: 6000, xp: 1500 }]; // cost to reach level 2 / 3 (cr + spendable ⭐)
export const MAXLV = 3, HOLD_MIN = 20, BAIL = 0.4;
export const payMul = (lv, bonus = 0) => 1 + 0.1 * (Math.max(1, lv) - 1) + Math.max(0, Math.min(0.25, +bonus || 0)); // bonus = crime-break payoff buff (0..0.25)
export const bustOf = (job, lv) => Math.max(0.02, (JOBS[job]?.bust || 0) - 0.02 * (Math.max(1, lv) - JOBS[job].tier));
export const slotsFor = stars => SLOTS.filter(s => (+stars || 0) >= s).length;
export const nextSlot = stars => SLOTS.find(s => (+stars || 0) < s) ?? null;
// a front job's cash: 12 game hours of that front's average takings (frontRate = empirecore.avgRate(kind)), 600 if unknown
export const jobCash = (job, lv, frontRate = 0, bonus = 0) => Math.round((JOBS[job].front ? (frontRate > 0 ? frontRate * 12 : 600) : JOBS[job].cr) * payMul(lv, bonus));

export function fresh() { return { v: VERSION, crew: [], stats: { jobs: 0, busts: 0, cr: 0, xp: 0, bail: 0 }, met: [] }; }
const n0 = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);
export function member(o = {}) {
  const r = ROSTER.find(q => q.id === o.id); if (!r) return null;
  return { id: r.id, lv: Math.min(MAXLV, Math.max(1, o.lv | 0 || 1)), job: JOBS[o.job] ? o.job : null, front: o.front ? String(o.front) : null, at: n0(o.at), held: n0(o.held),
    bank: Array.isArray(o.bank) ? o.bank.filter(b => b && JOBS[b.job]).slice(0, BANK).map(b => ({ job: b.job, cr: n0(b.cr) | 0, xp: n0(b.xp) | 0, bust: !!b.bust, bail: n0(b.bail) | 0, front: b.front || null })) : [] };
}
export function load(raw) {
  let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || typeof o !== 'object' || o.v !== VERSION) return fresh();
  const f = fresh(), crew = (Array.isArray(o.crew) ? o.crew : []).map(member).filter(Boolean).filter((m, i, a) => a.findIndex(q => q.id === m.id) === i).slice(0, SLOTS.length);
  return { v: VERSION, crew, stats: { ...f.stats, ...(o.stats || {}) }, met: Array.isArray(o.met) ? o.met.filter(x => typeof x === 'string').slice(0, 8) : [] };
}
// who's free to hire now (slots by lifetime stars, roster order)
export function canHire(s, stars) { const free = slotsFor(stars) - s.crew.length; const next = ROSTER.find(r => !s.crew.some(m => m.id === r.id)); return free > 0 && next ? next : null; }
export function hire(s, stars) { const r = canHire(s, stars); if (!r) return null; const m = member({ id: r.id, lv: 1 }); s.crew.push(m); return m; }
export function canAssign(m, job, fronts = []) {
  const J = JOBS[job]; if (!m || !J) return { ok: false, why: 'No such job.' };
  if (m.lv < J.tier) return { ok: false, why: `Needs crew level ${J.tier}.` };
  if (J.front && !fronts.length) return { ok: false, why: 'Buy a front first (☰ → 🏢 Empire).' };
  return { ok: true };
}
export function assign(m, job, now, front = null) { m.job = job; m.at = now; m.front = JOBS[job]?.front ? front : null; return m; }
export const busy = (m, now) => m.held > now ? 'held' : m.bank.length >= BANK ? 'full' : m.job ? 'working' : 'idle';
// advance one member to `now`: finish as many whole jobs as fit (bank cap, holding). rng() -> [0,1). frontRate(id) -> cr/h
export function step(m, now, rng = Math.random, frontRate = () => 0, bonus = 0) {
  const done = [];
  for (let guard = 0; guard < 50 && m.job; guard++) {
    if (m.held > now) break; if (m.held && m.held <= now) { m.at = Math.max(m.at, m.held); m.held = 0; }
    if (m.bank.length >= BANK) { m.at = now; break; } // waits for you: no free jobs while the bank is full
    const J = JOBS[m.job], end = m.at + J.min * 60000; if (end > now) break;
    const cr = jobCash(m.job, m.lv, frontRate(m.front), bonus), bust = rng() < bustOf(m.job, m.lv);
    const r = { job: m.job, cr: bust ? 0 : cr, xp: bust ? 0 : Math.round(J.xp * payMul(m.lv, bonus)), bust, bail: bust ? Math.round(cr * BAIL / 10) * 10 : 0, front: m.front };
    m.bank.push(r); done.push(r); m.at = end; if (bust) { m.held = end + HOLD_MIN * 60000; break; }
  }
  return done;
}
// bail him out of holding now
export function bail(m, now) { if (!(m.held > now)) return 0; const b = m.bank.slice().reverse().find(x => x.bust); const cost = b?.bail || 200; m.held = 0; m.at = now; return cost; }
// collect his bank: { cr, xp, busts, jobs }
export function collect(s, m) { let cr = 0, xp = 0, busts = 0; for (const b of m.bank) { cr += b.cr; xp += b.xp; if (b.bust) busts++; } const jobs = m.bank.length; m.bank = []; s.stats.jobs += jobs; s.stats.busts += busts; s.stats.cr += cr; s.stats.xp += xp; return { cr, xp, busts, jobs }; }
export function canLevel(m) { if (!m || m.lv >= MAXLV) return null; return LEVELS[m.lv + 1]; }
export function progress(m, now) { if (!m.job) return 0; if (m.held > now) return 0; return Math.max(0, Math.min(1, (now - m.at) / (JOBS[m.job].min * 60000))); }
