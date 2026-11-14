// Empire prompts and repeatable crime (v7.5.108). Pure: no DOM, no three.js.
// Every few game hours an owned front or a crew member asks for you. One note at a time.
// Ignoring a crew member lowers loyalty. Low loyalty skims a little of a till.
import { hoursBetween } from '../empirecore.js';

export const GAP = 3; // game hours between notes
export const IGNORE = 6; // game hours away before loyalty falls
export const SKIM_AT = 40;
export const SKIM = 0.1;
export const REACH = 14;
export const PAY = { racket: 650, truck: 1600, chop: 900, smuggle: 1100, defend: 750, skim: 1400 };

export function fresh() {
  return { v: 1, hour: null, wait: 0, n: 0, prompt: null, job: null, crew: {} };
}
export function load(raw) {
  let o = raw;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  const f = fresh();
  if (!o || o.v !== 1) return f;
  f.hour = Number.isFinite(+o.hour) ? +o.hour : null;
  f.wait = Math.max(0, +o.wait || 0);
  f.n = Math.max(0, +o.n || 0);
  f.prompt = o.prompt && o.prompt.kind ? o.prompt : null;
  f.job = o.job && o.job.kind ? o.job : null;
  f.crew = o.crew && typeof o.crew === 'object' ? o.crew : {};
  return f;
}

export function loyaltyOf(state, id) {
  const c = state.crew[id] || { loyalty: 70, since: 0 };
  return c;
}

function decay(state, gap, fronts) {
  const skims = [];
  if (!(gap > 0)) return skims;
  for (const id of Object.keys(state.crew)) {
    const c = state.crew[id];
    c.since = (c.since || 0) + gap;
    if (c.since >= IGNORE) c.loyalty = Math.max(0, (c.loyalty ?? 70) - 5);
    // a sulking hand skims a tenth, and not again until another long stretch
    if ((c.loyalty ?? 70) < SKIM_AT && c.since >= IGNORE && fronts.length && (c.since - (c.skimSince || 0) >= IGNORE)) {
      const fr = fronts[0];
      const take = Math.floor((fr.pending || 0) * SKIM);
      if (take >= 10) { skims.push({ id: fr.id, take, who: id }); c.skimSince = c.since; }
    }
  }
  return skims;
}

export function visit(state, id) {
  const c = state.crew[id] || { loyalty: 70, since: 0 };
  c.loyalty = Math.min(100, (c.loyalty ?? 70) + 12);
  c.since = 0;
  state.crew[id] = c;
  return c;
}

const CRIME = ['racket', 'truck', 'chop', 'smuggle', 'defend', 'skim'];

export function noteText(kind, name) {
  const n = name || 'your place';
  switch (kind) {
    case 'till': return `${n} till is full. Come collect.`;
    case 'crew': return `${n} wants to talk at the Velvet office.`;
    case 'shakedown':
    case 'defend': return `A rival crew is shaking down ${n}.`;
    case 'escort':
    case 'smuggle': return `A shipment needs an escort.`;
    case 'racket': return `Protection money is due. Go collect it.`;
    case 'truck': return `An armored truck is on the belt. Hit it.`;
    case 'chop': return `A ride is sitting. Chop it before patrol does.`;
    case 'skim': return `The cage at the Velvet is fat. Skim it.`;
    default: return `Come check ${n}.`;
  }
}

export function pick(state, world) {
  const n = state.n || 0;
  const fronts = world.fronts || [];
  const crew = world.crew || [];
  const full = fronts.find(f => f.cap > 0 && f.pending / f.cap >= 0.7);
  const lonely = crew.find(c => (state.crew[c.id]?.since || 0) >= IGNORE || (state.crew[c.id]?.loyalty ?? 70) < 55);
  if (n % 3 === 0 && full) return { kind: 'till', from: full.name, text: noteText('till', full.name), x: full.x, z: full.z, job: null };
  if (n % 3 === 2 && lonely && world.velvet) return { kind: 'crew', from: lonely.name, text: noteText('crew', lonely.name), x: world.velvet.x, z: world.velvet.z, who: lonely.id, job: null };
  const kind = CRIME[n % CRIME.length];
  const job = startJob(kind, world.spots || {}, world);
  if (!job) {
    if (full) return { kind: 'till', from: full.name, text: noteText('till', full.name), x: full.x, z: full.z, job: null };
    if (lonely && world.velvet) return { kind: 'crew', from: lonely.name, text: noteText('crew', lonely.name), x: world.velvet.x, z: world.velvet.z, who: lonely.id, job: null };
    return null;
  }
  const from = fronts[0]?.name || 'Empire';
  return { kind, from, text: noteText(kind, from), x: job.steps[0].x, z: job.steps[0].z, job };
}

// Advance the clock. Returns { prompt, skims }. One prompt at a time.
export function tickHour(state, hour, world = {}) {
  const fronts = world.fronts || [];
  if (state.hour == null) { state.hour = hour; for (const c of world.crew || []) if (!state.crew[c.id]) state.crew[c.id] = { loyalty: 70, since: 0 }; return { prompt: null, skims: [] }; }
  const gap = hoursBetween(state.hour, hour);
  state.hour = hour;
  for (const c of world.crew || []) if (!state.crew[c.id]) state.crew[c.id] = { loyalty: 70, since: 0 };
  const skims = decay(state, gap, fronts);
  if (state.prompt || state.job) return { prompt: null, skims };
  state.wait = (state.wait || 0) + gap;
  if (state.wait < GAP) return { prompt: null, skims };
  const prompt = pick(state, world);
  if (!prompt) return { prompt: null, skims };
  state.wait = 0;
  state.n = (state.n || 0) + 1;
  state.prompt = prompt;
  if (prompt.job) state.job = prompt.job;
  return { prompt, skims };
}

export function dismiss(state) { state.prompt = null; }

function step(text, x, z, hold = 0) { return { text, x, z, hold }; }

export function startJob(kind, spot = {}, world = {}) {
  const f = (world.fronts || [])[0];
  const v = world.velvet || f;
  const drop = spot.drop || (f ? { x: f.x + 40, z: f.z + 20 } : v ? { x: v.x + 40, z: v.z + 20 } : null);
  const truck = spot.truck || (f ? { x: f.x - 50, z: f.z + 30 } : v ? { x: v.x - 50, z: v.z + 30 } : null);
  if (!drop || !truck) return null;
  if (!f && kind !== 'skim' && kind !== 'crew') return null;
  if (!v && (kind === 'skim' || kind === 'crew')) return null;
  const here = f || v;
  const key = kind === 'shakedown' ? 'defend' : kind === 'escort' ? 'smuggle' : kind;
  const pay = PAY[key] || 500;
  const money = `Pays ${pay.toLocaleString('en-US')} cr.`;
  let steps = [];
  if (kind === 'racket') steps = [step(`Collect the protection money. ${money}`, here.x, here.z), step('Take the envelope to the drop.', drop.x, drop.z)];
  else if (kind === 'truck') steps = [step(`Hit the armored truck. ${money}`, truck.x, truck.z), step('Haul the take to the wash.', here.x, here.z)];
  else if (kind === 'chop') steps = [step(`Strip the parked ride. ${money}`, truck.x, truck.z), step(`Drop the parts at ${here.name}.`, here.x, here.z)];
  else if (kind === 'smuggle' || kind === 'escort') steps = [step(`Pick up the shipment. ${money}`, truck.x, truck.z), step('Hand the shipment over at the drop.', drop.x, drop.z)];
  else if (kind === 'defend' || kind === 'shakedown') steps = [step(`Hold the door at ${here.name}. ${money}`, here.x, here.z, 8)];
  else if (kind === 'skim') steps = [step(`Skim the Velvet cage. ${money}`, v.x, v.z), step('Walk the skim out to the drop.', drop.x, drop.z)];
  else return null;
  return { kind: key, step: 0, held: 0, steps, pay };
}

export function nearJob(job, x, z, dt = 0, reach = REACH) {
  if (!job) return null;
  const s = job.steps[job.step];
  if (!s) return { ...job, done: true, advanced: false, paid: 0 };
  if (Math.hypot((s.x || 0) - x, (s.z || 0) - z) > reach) return { ...job, held: 0, done: false, advanced: false, paid: 0, text: s.text };
  const held = (job.held || 0) + (s.hold ? Math.max(0, dt) : 0);
  if (s.hold && held < s.hold) return { ...job, held, done: false, advanced: false, paid: 0, text: s.text };
  const step = job.step + 1;
  const done = step >= job.steps.length;
  const next = job.steps[Math.min(step, job.steps.length - 1)];
  return { ...job, step, held: 0, done, advanced: true, paid: done ? job.pay : 0, text: done ? `Paid ${job.pay} cr.` : next.text };
}

export function mapMarks(state) {
  const out = [];
  const j = state.job;
  if (j && j.steps[j.step]) {
    const s = j.steps[j.step];
    const icon = { racket: '💵', truck: '🚛', chop: '🔧', smuggle: '📦', defend: '🛡️', skim: '🎰' }[j.kind] || '💰';
    out.push({ id: 'crime:' + j.kind, icon, name: noteText(j.kind).replace(/\.$/, ''), sub: 'crime · ' + s.text, x: s.x, z: s.z, cat: 'crime', empire: true });
  } else if (state.prompt && Number.isFinite(state.prompt.x)) {
    const p = state.prompt;
    out.push({ id: 'emp:' + p.kind, icon: '📱', name: p.from || 'Empire', sub: 'crime · ' + p.text, x: p.x, z: p.z, cat: 'crime', empire: true });
  }
  return out;
}
