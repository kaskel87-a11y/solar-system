// Umbra Hold (v7.5.119). Pure rules for the lunar prison in Nadir Crater. No DOM, no three.js.
// Fiction only: invented people, a made-up mineral called glint-salt, no real drugs, no borrowed names.
// moon/prison.js drives this. tests/test-umbra-unit.mjs locks it.
export const KEY = 'ssx.umbra.v1';
export const VERSION = 1;
export const NAME = 'Umbra Hold';
export const CRATER = 'Nadir Crater';
export const BRIBE = 350;
export const GUARD_BRIBE = 200;
export const PAROLE = 800;
export const OFFICE = 600;
export const TRADE_PAY = 90;
export const INCOME = 180;
export const INCOME_MS = 3 * 60 * 1000;
export const NEAR = 8;

// Colony-local metres on the Moon (x east, z south). Freeport Tranquility is the origin.
// Interactive spots stay at least 12 m apart so one button shows at a time.
export const SPOTS = {
  gate: [-150, 46],
  inside: [-150, 58],
  guard: [-138, 50],
  trustee: [-138, 64],
  juno: [-162, 62],
  sato: [-138, 78],
  moss: [-162, 78],
  nim: [-150, 90],
  pool: [-124, 58],
  beacon: [-108, 102],
  terminal: [-176, 58],
  mast: [-176, 96],
  laundry: [-124, 84],
  fence: [-176, 78],
  ring: [-150, 104],
  office: [-150, 118],
  generator: [-176, 44],
  shuttle: [-124, 40],
  yard: [-150, 74]
};

export const RANKS = [
  { id: 'out', name: 'Outsider' },
  { id: 'visitor', name: 'Visitor' },
  { id: 'newcomer', name: 'Newcomer' },
  { id: 'trusted', name: 'Trusted' },
  { id: 'hand', name: 'Block hand' },
  { id: 'captain', name: 'Yard captain' },
  { id: 'warden', name: 'Warden' }
];

export const INMATES = [
  { id: 'juno', name: 'Juno Keel', role: 'driver', short: 'Juno',
    blurb: 'Impatient. She talks in distances.',
    perk: 'Your rides top out a little faster.',
    line: 'I drove ore skiffs until they parked me here. Get me rolling and I will put you ahead of the patrols.' },
  { id: 'sato', name: 'Sato Lin', role: 'hacker', short: 'Sato',
    blurb: 'Quiet. Counts cameras out loud.',
    perk: 'Wanted stars cool off faster.',
    line: 'The yard cameras blink on a loop I wrote. With me on your crew, heat fades quicker.' },
  { id: 'moss', name: 'Moss Kade', role: 'muscle', short: 'Moss',
    blurb: 'Big. Loyal once you stand in the ring.',
    perk: 'Your punches hit harder.',
    line: 'Bram Holt and the Kiln Ring run this yard. Stand with me once and I hit for you after.' },
  { id: 'nim', name: 'Nim Ore', role: 'smuggler', short: 'Nim',
    blurb: 'Smooth. Always counting.',
    perk: 'Street goods sell for more.',
    line: 'Crates, lids, a pinch of glint-salt. Buyers pay me extra. They will pay you too.' }
];

const FAVORS = {
  juno: {
    title: "Juno's spare key",
    intro: 'Juno Keel: My buggy key is in the motor pool. Plant it at the rim beacon.',
    steps: [
      ['pool', 'Walk to the motor pool and pick up Juno\'s spare key.'],
      ['beacon', 'Take the key to the rim beacon.']
    ]
  },
  sato: {
    title: "Sato's camera loop",
    intro: 'Sato Lin: Walk the yard terminal, then cut my loop in at the camera mast.',
    steps: [
      ['terminal', 'Walk to the yard terminal Sato marked.'],
      ['mast', 'Cut Sato\'s loop at the camera mast.']
    ]
  },
  moss: {
    title: 'Moss in the ring',
    intro: 'Moss Kade: Meet me in the yard ring and drop the Kiln man.',
    steps: [
      ['ring', 'Walk to the yard ring and meet Moss.'],
      ['ring', 'Drop the Kiln man in the yard ring.', 'defeat', { wave: ['goon'] }]
    ]
  },
  nim: {
    title: "Nim's crate",
    intro: 'Nim Ore: A glint-salt crate is at the laundry. Drop it at the fence slot.',
    steps: [
      ['laundry', 'Pick up the glint-salt crate at the laundry.'],
      ['fence', 'Drop the crate at the fence slot.']
    ]
  }
};

const inmate = id => INMATES.find(i => i.id === id) || null;
const favorCount = s => Object.keys(s.favors || {}).length;
export const rankName = s => RANKS[Math.max(0, Math.min(RANKS.length - 1, s.rank | 0))].name;

function bumpHand(s) {
  if ((s.rank | 0) === 3 && favorCount(s) >= 2 && ((s.guards | 0) >= 1 || (s.trades | 0) >= 1)) s.rank = 4;
}

export function fresh() {
  return {
    v: VERSION, entry: null, met: [], favors: {}, crew: [], how: {},
    guards: 0, trades: 0, bram: false, office: false,
    incomeAt: 0, earned: 0, rank: 0, pending: null, heard: false
  };
}

function asId(x) { return typeof x === 'string' && INMATES.some(i => i.id === x) ? x : null; }

export function load(raw) {
  let o = raw;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || typeof o !== 'object' || o.v !== VERSION) return fresh();
  const s = fresh();
  s.entry = o.entry === 'bribe' || o.entry === 'arrest' ? o.entry : null;
  s.met = Array.isArray(o.met) ? [...new Set(o.met.filter(x => x === 'trustee' || asId(x)))] : [];
  s.favors = {};
  if (o.favors && typeof o.favors === 'object') for (const id of Object.keys(o.favors)) if (asId(id) && o.favors[id]) s.favors[id] = 1;
  s.crew = Array.isArray(o.crew) ? [...new Set(o.crew.map(asId).filter(Boolean))] : [];
  s.how = {};
  if (o.how && typeof o.how === 'object') for (const id of Object.keys(o.how)) if (asId(id) && (o.how[id] === 'parole' || o.how[id] === 'break')) s.how[id] = o.how[id];
  s.guards = Math.max(0, o.guards | 0);
  s.trades = Math.max(0, o.trades | 0);
  s.bram = !!o.bram;
  s.office = !!o.office;
  s.incomeAt = Number.isFinite(+o.incomeAt) ? +o.incomeAt : 0;
  s.earned = Math.max(0, o.earned | 0);
  s.rank = Math.max(0, Math.min(6, o.rank | 0));
  s.pending = asId(o.pending);
  s.heard = !!o.heard;
  if (!s.entry) s.rank = 0;
  if (s.office) s.rank = 6;
  else if (s.bram && s.rank < 5) s.rank = 5;
  return s;
}

export function enter(s, kind) {
  if (s.entry) return { ok: true, already: true, kind: s.entry };
  if (kind !== 'bribe' && kind !== 'arrest') return { ok: false, why: 'Bribe the sentry, or turn yourself in.' };
  s.entry = kind;
  if (s.rank < 1) s.rank = 1;
  return { ok: true, kind, cost: kind === 'bribe' ? BRIBE : 0 };
}

export function meet(s, id) {
  if (!s.entry) return { ok: false, why: 'Get inside Umbra Hold first.' };
  if (id !== 'trustee' && !inmate(id)) return { ok: false, why: 'Nobody by that name.' };
  if (!s.met.includes(id)) s.met.push(id);
  if (s.rank < 2) s.rank = 2;
  return { ok: true, rank: s.rank };
}

export function finishFavor(s, id) {
  if (!inmate(id)) return { ok: false, why: 'No such inmate.' };
  if (!s.entry) return { ok: false, why: 'Get inside first.' };
  if (s.favors[id]) return { ok: false, why: 'You already did that favor.' };
  if (!s.met.includes(id)) s.met.push(id);
  if (s.rank < 2) s.rank = 2;
  s.favors[id] = 1;
  if (s.rank < 3) s.rank = 3;
  bumpHand(s);
  return { ok: true, rank: s.rank };
}

export function bribeGuard(s) {
  if ((s.rank | 0) < 3) return { ok: false, why: 'Do a favor for an inmate first. The guard will not deal with a stranger.' };
  s.guards = (s.guards | 0) + 1;
  bumpHand(s);
  return { ok: true, cost: GUARD_BRIBE, rank: s.rank };
}

export function tradeSalt(s) {
  if ((s.rank | 0) < 3) return { ok: false, why: 'The fence will not trade until the yard knows you.' };
  s.trades = (s.trades | 0) + 1;
  bumpHand(s);
  return { ok: true, pay: TRADE_PAY, rank: s.rank };
}

export function beatBram(s) {
  if (s.bram) return { ok: true, already: true, rank: s.rank };
  if ((s.rank | 0) < 4) return { ok: false, why: 'The yard will not back you yet. Do another favor, and bribe a guard or move glint-salt.' };
  s.bram = true;
  if (s.rank < 5) s.rank = 5;
  return { ok: true, rank: s.rank };
}

export function takeOffice(s, now) {
  if (s.office) return { ok: true, already: true, rank: s.rank };
  if ((s.rank | 0) < 5) return { ok: false, why: 'Drop Bram Holt in the yard ring first.' };
  s.office = true;
  s.rank = 6;
  s.incomeAt = now;
  return { ok: true, cost: OFFICE, stipend: INCOME };
}

export function canMove(s, id) {
  if (!inmate(id)) return { ok: false, why: 'No such inmate.' };
  if (!s.favors[id]) return { ok: false, why: 'Do their favor first.' };
  if (s.crew.includes(id)) return { ok: false, why: 'They are already on Mars.' };
  return { ok: true };
}

export function board(s, id, how) {
  const c = canMove(s, id);
  if (!c.ok) return c;
  if (how !== 'parole' && how !== 'break') return { ok: false, why: 'Parole them, or break them out.' };
  s.how[id] = how;
  s.pending = id;
  return { ok: true, how, cost: how === 'parole' ? PAROLE : 0, quest: `umbra-out-${id}-${how}` };
}

export function arrived(s, id) {
  if (!inmate(id)) return { ok: false, why: 'No such inmate.' };
  if (!s.crew.includes(id)) s.crew.push(id);
  if (!s.how[id]) s.how[id] = 'parole';
  if (s.pending === id) s.pending = null;
  return { ok: true, crew: s.crew.slice() };
}

export function incomeDue(s, now) {
  if ((s.rank | 0) < 6 || !s.office) return 0;
  const last = s.incomeAt || 0;
  if (!(now > last)) return 0;
  const n = Math.floor((now - last) / INCOME_MS);
  if (n <= 0) return 0;
  return Math.min(6, n) * INCOME;
}

export function collectIncome(s, now) {
  const pay = incomeDue(s, now);
  if (!pay) {
    const wait = s.office ? Math.max(0, INCOME_MS - (now - (s.incomeAt || now))) : 0;
    return { ok: false, pay: 0, wait };
  }
  const steps = pay / INCOME;
  s.incomeAt = (s.incomeAt || now) + steps * INCOME_MS;
  s.earned = (s.earned | 0) + pay;
  return { ok: true, pay };
}

export function perks(s) {
  const on = id => s.crew.includes(id);
  return {
    drive: on('juno') ? 1.12 : 1,
    heat: on('sato') ? 0.65 : 1,
    melee: on('moss') ? 1.3 : 1,
    sell: on('nim') ? 1.2 : 1
  };
}

export function objective(s) {
  const r = s.rank | 0;
  if (r <= 0) return { id: 'enter', world: 'Moon', at: 'gate', text: 'Walk to the Umbra Hold gate in Nadir Crater. Bribe the sentry, or turn yourself in.' };
  if (r === 1) return { id: 'meet', world: 'Moon', at: 'trustee', text: 'Talk to Trustee Neeve in the yard. She will tell you who is who.' };
  if (r === 2) return { id: 'favor', world: 'Moon', at: 'juno', text: 'Do a favor for one inmate. Talk to Juno, Sato, Moss, or Nim.' };
  if (r === 3 && favorCount(s) < 2) return { id: 'favor2', world: 'Moon', at: 'sato', text: 'Do a favor for a second inmate so the yard takes you seriously.' };
  if (r === 3) return { id: 'connect', world: 'Moon', at: (s.guards | 0) ? 'fence' : 'guard', text: 'Bribe the yard guard, or move a pinch of glint-salt at the fence.' };
  if (r === 4) return { id: 'bram', world: 'Moon', at: 'ring', text: 'Drop Bram Holt, the Kiln Ring boss, in the yard ring.' };
  if (r === 5) return { id: 'office', world: 'Moon', at: 'office', text: 'Pay Warden Quell and take the chair in the office.' };
  const waiting = INMATES.filter(i => s.favors[i.id] && !s.crew.includes(i.id));
  if (waiting.length) return { id: 'move', world: 'Moon', at: waiting[0].id, text: `Get ${waiting[0].short} out. Parole them, or cut the fence, then walk them to the shuttle pad.` };
  return { id: 'rule', world: 'Moon', at: 'office', text: 'You run Umbra Hold. The till pays on its own. Your crew waits on Mars.' };
}

function goto(key, text, type, extra) {
  const at = SPOTS[key];
  return { type: type || 'goto', at: [at[0], at[1]], r: 6, text, ...(extra || {}) };
}

export function questDefs() {
  const out = [];
  for (const i of INMATES) {
    const f = FAVORS[i.id];
    out.push({
      id: `umbra-favor-${i.id}`, world: 'Moon', contact: i.name, fiction: true,
      title: f.title, intro: f.intro,
      steps: f.steps.map(row => goto(row[0], row[1], row[2], row[3])),
      reward: { xp: 40, credits: 70 }
    });
    out.push({
      id: `umbra-out-${i.id}-parole`, world: 'Moon', contact: i.name, fiction: true,
      title: `Parole ${i.short}`,
      intro: `${i.name}: Papers are stamped. Walk me to the shuttle pad.`,
      steps: [goto('shuttle', `Walk ${i.short} to the Umbra shuttle pad.`)],
      reward: { xp: 50, credits: 100 }
    });
    out.push({
      id: `umbra-out-${i.id}-break`, world: 'Moon', contact: i.name, fiction: true,
      title: `Break ${i.short} out`,
      intro: `${i.name}: Cut the yard power, then run me to the pad.`,
      steps: [
        goto('generator', 'Cut the power at the yard generator.'),
        goto('shuttle', `Run ${i.short} to the shuttle pad.`)
      ],
      reward: { xp: 60, credits: 120 }
    });
  }
  out.push({
    id: 'umbra-bram', world: 'Moon', contact: 'Moss Kade', fiction: true,
    title: 'Drop Bram Holt',
    intro: 'Moss Kade: Bram Holt is in the yard ring. Drop him and the Kiln Ring folds.',
    steps: [
      goto('ring', 'Walk to the yard ring. Bram is waiting.'),
      goto('ring', 'Drop Bram Holt in the yard ring.', 'defeat', { wave: ['goon'] })
    ],
    reward: { xp: 80, credits: 200 }
  });
  return out;
}

export function favorQuestId(id) { return `umbra-favor-${id}`; }
