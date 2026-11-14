// Boss lounge (v7.5.95). Pure rules: once you own the Velvet, the east-wing office chair is where hired crew
// pitch jobs. No DOM, no THREE. Crew ids are Marsmania's roster (crewcore.js). This file does not hire anyone.
// tests/test-bosslounge-unit.mjs
import { ROSTER } from '../crewcore.js';

export const KEY = 'ssx.bosslounge.v1';
export const VERSION = 1;
export const HEIST_ID = 'boss-lounge-bank';
export const BANK_WANTED = 2;
export const TOSS_HITS = 3;
export const TOSS_PAY = 80;
export const PUNCH_RANGE = 2.55;
export const TROUBLE_FIRST = 16; // seconds in the owned club before the first troublemaker
export const TROUBLE_GAP = 50;

// Room-local metres inside the Velvet. The booth is the west wall of Ines's office (velvetwing WING.office).
export const BOOTH = { x: 19.25, z: -3.55 };
export const SEAT = { x: 20.2, z: -3.55, r: 1.15 };
export const CREW_AT = { x: 21.45, z: -3.15 };
export const OFFICE_DOOR = { x: 21.25, z: 0.55 }; // just inside the staff door, where a crew member walks in from
export const LEAVE = { x: -11, z: 21 }; // just inside the club door (interiors leave spot is -11, 22)

export const JOBS = {
  bank: { id: 'bank', icon: '🏦', name: 'Rob the bank', pay: 2200, wanted: BANK_WANTED },
  floor: { id: 'floor', icon: '🥃', name: 'A situation in the club', pay: 450, wanted: 0 },
  marker: { id: 'marker', icon: '💵', name: 'Collect a marker', pay: 700, wanted: 0 }
};
export const ORDER = ['bank', 'floor', 'marker'];

export const FLOOR = {
  rowdy: { id: 'rowdy', name: 'Bram', x: -24, z: 2.2, label: 'Rowdy',
    step: 'Punch Bram at the bar. Fists. The 👊 button shows when you are close. No stars for a fair fight.' },
  rival: { id: 'rival', name: 'Jace', x: 2.4, z: -2.1, label: 'Rivals',
    step: 'Jace is shaking down the floor. Punch him off the dance floor. Fists only.' },
  thief: { id: 'thief', name: 'Remy', x: 14.5, z: -4.2, label: 'Thief',
    step: 'Remy is in the cashier cage. Punch him off the till. Fists.' }
};
export const FLOOR_ORDER = ['rowdy', 'rival', 'thief'];

export const TROUBLE = [
  { id: 'cole', name: 'Cole', x: -23.2, z: 0.4, step: 'Cole is loud at the bar. Throw him out. Punch him.' },
  { id: 'pete', name: 'Pete', x: 3.2, z: -1.4, step: 'Pete will not leave the floor. Throw him out. Punch him.' },
  { id: 'nix', name: 'Nix', x: -1.2, z: -2.6, step: 'Nix is starting something by the stage. Throw him out. Punch him.' }
];

const LINE = {
  dex: {
    bank: 'The Trust is fat tonight. You crack the vault at First Junction. I keep the car warm.',
    floor: {
      rowdy: 'Bram is drunk at your bar and will not shut up. Walk over and put him out. Fists.',
      rival: 'Jace from the Static is leaning on the floor. Throw him out before the room takes his side.',
      thief: 'Someone is in the cashier cage who does not work here. He is grabbing the till.'
    },
    marker: 'A marker is waiting outside the door. He pays cash. Quiet. Nobody calls ColSec.'
  },
  vee: {
    bank: 'First Junction Trust. Door, vault, out. I already walked the cameras. You turn the dial.',
    floor: {
      rowdy: 'The loud one at the bar is bad for the room. Fists. Do not pull a gun in your own club.',
      rival: 'Rival crew, dance floor. One of them. You drop him, the rest remember whose house this is.',
      thief: 'Till is open and the hands on it are not ours. He is at the cashier cage.'
    },
    marker: 'Short walk out the front. He owes the house. Tap Collect. He pays. You walk back.'
  },
  soren: {
    bank: 'ColSec watches that bank. You will pick up 2 stars when the alarm trips. Lose them after, or the job does not pay.',
    floor: {
      rowdy: 'Bram again. Bar. A fair fight in here does not bring heat. A gun does.',
      rival: 'Jace is on the floor bothering the dancers. Punch him out. Keep it fists.',
      thief: 'Remy is at the till. He thinks the cage makes him safe. It does not.'
    },
    marker: 'The marker is just outside. No cameras on that corner. Collect and come back.'
  },
  mags: {
    bank: 'The Trust job pays the chair. Crack it clean, get off the block, lose the stars. Then the money is yours.',
    floor: {
      rowdy: 'A drunk is bad for the books. Bram, at the bar. Show him the door with your hands.',
      rival: 'Jace is taxing the floor like he owns it. He does not. You do. Punch him out.',
      thief: 'The cage is short. Remy. Go get him before the count is wrong.'
    },
    marker: 'Seven hundred on a marker standing outside. Collect it. I will write it up as a private game.'
  }
};

const BRIEF = {
  bank: '1. Leave the Velvet. 2. Walk to First Junction Trust. 3. Tap Break in, then Crack safe. 4. Get away and lose the stars. The alarm is 2 stars.',
  marker: '1. Leave the Velvet. 2. Follow the arrow to the marker. 3. Tap Collect. No stars. He pays 700 cr.',
  floor: 'Follow the arrow. Punch him. The 👊 button shows when you are close. Fists only. No stars.'
};

const first = id => (ROSTER.find(r => r.id === id)?.name || id).split(' ')[0];
export const crewName = first;

export function fresh() {
  return { v: VERSION, jobs: 0, cr: 0, tossed: 0, lastJob: null };
}
export function load(raw) {
  let o = raw;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || typeof o !== 'object' || o.v !== VERSION) return fresh();
  const f = fresh();
  f.jobs = Math.max(0, o.jobs | 0);
  f.cr = Math.max(0, o.cr | 0);
  f.tossed = Math.max(0, o.tossed | 0);
  f.lastJob = JOBS[o.lastJob] ? o.lastJob : null;
  return f;
}

export function pitch(hired, rng = Math.random, { heistBusy = false } = {}) {
  const ids = (hired || []).filter(id => ROSTER.some(r => r.id === id));
  if (!ids.length) return { ok: false, needCrew: true, why: 'Nobody on your crew yet. Hire someone: ☰ → 👥 Crew. The first one shows up at 10,000 stars.' };
  const who = ids[Math.floor(rng() * ids.length) % ids.length];
  let pool = ORDER.slice();
  if (heistBusy) pool = pool.filter(id => id !== 'bank');
  const job = pool[Math.floor(rng() * pool.length) % pool.length];
  const floor = job === 'floor' ? FLOOR_ORDER[Math.floor(rng() * FLOOR_ORDER.length) % FLOOR_ORDER.length] : null;
  const pack = LINE[who] || LINE.dex;
  const line = job === 'floor' ? pack.floor[floor] : pack[job];
  return { ok: true, who, name: first(who), job, floor, line, brief: job === 'floor' ? BRIEF.floor : BRIEF[job], pay: JOBS[job].pay, wanted: JOBS[job].wanted };
}

export function accept(offer) {
  if (!offer?.ok || !JOBS[offer.job]) return null;
  const step = offer.job === 'bank' ? 'leave' : offer.job === 'marker' ? 'walk' : 'fight';
  return { id: offer.job, who: offer.who, name: offer.name || first(offer.who), floor: offer.floor || null, step, hits: 0 };
}

export const floorOf = job => (job?.id === 'floor' && FLOOR[job.floor]) || null;

export function bankStep(step) {
  if (step === 'leave') return 'Leave the Velvet. The arrow is on the door.';
  if (step === 'door') return 'Walk to First Junction Trust. Tap Break in at the door.';
  if (step === 'crack') return 'Go to the vault. Tap Crack safe. Turn the dial.';
  if (step === 'out') return 'Get away from the bank. The arrow points out.';
  if (step === 'clean') return 'Lose the stars. Stay out of sight until they fade. Then you get paid.';
  return 'Follow the arrow.';
}

export function strike(hits) {
  const n = Math.max(0, hits | 0) + 1;
  return { hits: n, down: n >= TOSS_HITS };
}

export function inFront(px, pz, fx, fz, tx, tz, range = PUNCH_RANGE) {
  const dx = tx - px, dz = tz - pz, d = Math.hypot(dx, dz);
  if (d > range) return false;
  return dx * fx + dz * fz > -0.35;
}

export function payOf(job) {
  const J = JOBS[job?.id];
  if (!J) return null;
  return { cr: J.pay, wanted: J.wanted, name: J.name };
}

export function noteToss(s) { s.tossed = (s.tossed | 0) + 1; s.cr = (s.cr | 0) + TOSS_PAY; return { cr: TOSS_PAY, tossed: s.tossed }; }
export function noteJob(s, job) {
  const p = payOf(job); if (!p) return null;
  s.jobs = (s.jobs | 0) + 1; s.cr = (s.cr | 0) + p.cr; s.lastJob = job.id;
  return p;
}

export function logLine(owned) {
  return owned
    ? 'Your boss chair is in the office, west wall. Sit there and your crew brings jobs: the bank, a problem on the floor, a marker outside. Troublemakers show up in the club. Punch them out.'
    : '';
}
