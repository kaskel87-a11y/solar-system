// PIT 66.6: heavy station for the Mars radio: metalcore / deathcore / hardcore energy. Down-tuned palm-muted chugs
// through a waveshaper amp, two-step and groove riffs, blast beats, half-time and slam breakdowns with a bass drop,
// dissonant tremolo leads, pinch squeals and amp feedback. Fully instrumental: no vocals, no lyrics.
// Every riff is generated from a seed (songs.js rng): original material, no melodies or riffs from real songs.
import { rng, pick, midi as N, songStation, ampChain, voice } from './songs.js';

// riff cell: null = rest, { o: semitones over the low root, len: 16ths, m: 'p' palm mute | 'o' open chord | 'q' pinch squeal | 'd' dive }
function riff(r, kind) {
  const out = Array(16).fill(null), dis = [0, 0, 0, 0, 1, 0, 3, 6, 0, 7];
  const set = (i, o, len, m) => { if (i < 16) out[i] = { o, len, m }; };
  if (kind === 'verse') { // hardcore two-step: driving 8ths with breaths
    for (let i = 0; i < 16; i += 2) if (r() < 0.82) set(i, i % 8 === 6 && r() < 0.5 ? pick(r, [1, 3, 6]) : 0, 1, 'p');
    set(0, 0, 2, 'o'); if (r() < 0.6) set(15, 0, 1, 'p');
  } else if (kind === 'groove') { // syncopated 16th bounce, accented open hits
    for (let i = 0; i < 16; i++) if (r() < (i % 4 === 0 ? 0.95 : 0.5)) set(i, pick(r, dis), 1, 'p');
    const acc = pick(r, [3, 6, 10, 11, 14]); set(acc, pick(r, [0, 1, 6, 12]), 2, 'o');
  } else if (kind === 'half') { // half-time breakdown: ring, chug-chug, ring, squeal
    set(0, 0, 4, 'o'); [5, 6, 7, 10, 11].forEach(i => { if (r() < 0.75) set(i, 0, 1, 'p'); }); set(8, pick(r, [0, 1, 6]), 2, 'o');
    if (r() < 0.6) set(13, 0, 1, 'p'); set(14, pick(r, [12, 13, 18]), 2, 'q');
  } else if (kind === 'slam') { // slam: sparse, heavy, the low string dives under the snare
    set(0, 0, 3, 'o'); set(3, 0, 1, 'p'); if (r() < 0.6) set(5, 0, 1, 'p'); set(6, pick(r, [1, 0]), 2, 'p');
    set(8, 0, 4, 'd'); if (r() < 0.7) set(13, 0, 1, 'p'); set(14, pick(r, [1, 6]), 1, 'p');
  }
  return out;
}
const TITLES = ['Regolith Grinder', 'Oxygen Debt', 'Ninth Street Pit Call', 'Saltblood Stomp', 'ColSec Can Eat It', 'Dust Lung',
  'Crater Floor Two-Step', 'Pressure Hull Collapse', 'Red Tape Riot', 'Bleed The Beltway'];
export function heavyTrack(seed, title) {
  const r = rng(seed), bpm = Math.round(pick(r, [150, 160, 170, 180, 190]) + r() * 8), root = pick(r, [28, 29, 30, 31, 33]); // E1..A1: drop tunings
  const T = { title, bpm, root, meter: 4, seed,
    riffs: { verse: riff(r, 'verse'), groove: riff(r, 'groove'), groove2: riff(r, 'groove'), half: riff(r, 'half'), slam: riff(r, 'slam') },
    lead: Array.from({ length: 8 }, () => pick(r, [0, 1, 6, 7, 11, 13, 12, 18])), tremolo: [0, pick(r, [1, 6]), pick(r, [3, 7]), pick(r, [1, 13])] };
  const body = pick(r, [
    [['feed', 1], ['verse', 4], ['groove', 4], ['verse', 4], ['blast', 2], ['half', 4], ['groove2', 4], ['slam', 4], ['gap', 1]],
    [['feed', 1], ['groove', 4], ['blast', 2], ['groove2', 4], ['verse', 4], ['half', 4], ['blast', 2], ['slam', 4], ['gap', 1]],
    [['feed', 2], ['verse', 4], ['verse', 4], ['groove', 4], ['half', 4], ['blast', 2], ['groove2', 4], ['half', 2], ['slam', 4], ['gap', 1]],
    [['feed', 1], ['blast', 2], ['groove', 4], ['groove2', 4], ['slam', 4], ['verse', 4], ['half', 4], ['slam', 2], ['gap', 1]]
  ]);
  T.sections = body.map(([type, bars]) => ({ type, bars: type === 'feed' || type === 'gap' ? bars : bars * 2 })); return T; // ~1-1.5 min songs
}
export const PIT_TRACKS = TITLES.slice(0, 7).map((t, i) => heavyTrack(6660 + i * 97, t));

// ---------- instruments ----------
const kick = (x, t, v = 0.55) => { x.osc('sine', 165, t, 0.11, v, 46); x.hit(t, 0.012, v * 0.35, 3500, 0.8, 'highpass'); };
const snare = (x, t, v = 0.32) => { x.hit(t, 0.15, v, 1900, 0.7); x.osc('triangle', 230, t, 0.06, v * 0.45, 165); };
const hat = (x, t, v = 0.06) => x.hit(t, 0.03, v, 8500, 1, 'highpass');
const crash = (x, t, v = 0.12) => x.hit(t, 0.9, v, 5200, 0.5, 'highpass');
const china = (x, t, v = 0.13) => x.hit(t, 0.4, v, 4300, 2.2);
const tom = (x, t, f) => x.osc('sine', f, t, 0.16, 0.35, f * 0.62);
function gtr(x, amp, T, c, t, spb) {
  if (!c) return; const f = N(T.root + c.o), d = c.len * spb;
  if (c.m === 'p') { voice(x, amp, { f, t, dur: Math.min(0.13, d * 0.9), vol: 0.5 }); voice(x, amp, { type: 'square', f: f * 2, t, dur: Math.min(0.1, d * 0.8), vol: 0.12 }); }
  else if (c.m === 'o') { voice(x, amp, { f, t, dur: d * 1.15, vol: 0.45 }); voice(x, amp, { f: f * 1.4983, t, dur: d * 1.1, vol: 0.32 }); }
  else if (c.m === 'q') voice(x, amp, { type: 'sawtooth', f: N(T.root + 24 + c.o), t, dur: d * 1.3, vol: 0.22, f1: N(T.root + 31 + c.o), vib: 0.02, rate: 7 });
  else if (c.m === 'd') { voice(x, amp, { f, t, dur: d * 1.2, vol: 0.5, f1: f * 0.7 }); x.osc('sine', 95, t, d * 1.3, 0.35, 32); }
  if (c.m !== 'q') x.osc('square', f * 2, t, Math.min(d, 0.3), 0.05); // bass guitar doubling
}

export function playHeavy(k) {
  const { x, t, spb, track: T, sec, b, bar, startSec } = k, amp = ampChain(x.out) || x.out, last = bar === sec.bars - 1;
  switch (sec.type) {
    case 'gap': return; // breath between songs: the DJ station ID plays here
    case 'feed': // amp feedback swell + count-in
      if (k.n === 0) voice(x, amp, { type: 'sine', f: N(T.root + 43 + (T.seed % 3)), t, dur: spb * 16 * sec.bars, vol: 0.12, attack: spb * 8, vib: 0.008, rate: 6 });
      if (last && b % 4 === 0) hat(x, t, 0.1);
      return;
    case 'blast': { // blast beat + dissonant tremolo picking
      if (b % 2 === 0) kick(x, t, 0.4); else snare(x, t, 0.22);
      if (b % 4 === 0) crash(x, t, 0.07);
      const o = T.tremolo[bar % 4]; voice(x, amp, { f: N(T.root + 12 + o), t, dur: spb * 0.9, vol: 0.3 }); if (b % 2 === 0) voice(x, amp, { f: N(T.root + 12 + o) * 1.4983, t, dur: spb * 0.9, vol: 0.18 });
      if (b % 4 === 0) voice(x, x.out, { type: 'square', f: N(T.root + 36 + T.lead[(bar * 4 + b / 4) % 8]), t, dur: spb * 3.6, vol: 0.025 });
      return;
    }
    case 'verse': { // hardcore two-step
      const c = T.riffs.verse[b]; gtr(x, amp, T, c, t, spb);
      if (b === 0 || b === 6 || b === 10 || (b === 14 && bar % 2)) kick(x, t); if (b === 4 || b === 12) snare(x, t);
      if (b % 2 === 0) hat(x, t, b % 4 ? 0.04 : 0.07); if (b === 0 && bar % 4 === 0) crash(x, t);
      break;
    }
    case 'groove': case 'groove2': { // double-kick under the chugs, snare on 2 and 4
      const c = T.riffs[sec.type][b]; gtr(x, amp, T, c, t, spb);
      if (c && c.m === 'p') kick(x, t, 0.42); if (b === 4 || b === 12) snare(x, t); if (b % 4 === 0) hat(x, t, 0.07);
      if (bar % 2 === 1 && b % 2 === 0) voice(x, x.out, { type: 'square', f: N(T.root + 36 + T.lead[b / 2]), t, dur: spb * 1.8, vol: 0.022 }); // dissonant lead
      if (b === 0 && bar % 2 === 0) crash(x, t, 0.09);
      break;
    }
    case 'half': { // half-time breakdown: snare on 3, china on the quarters
      if (startSec) { crash(x, t, 0.16); x.osc('sine', 85, t, 1.4, 0.5, 30); }
      const c = T.riffs.half[b]; gtr(x, amp, T, c, t, spb);
      if (c && c.m !== 'q') kick(x, t, 0.5); if (b === 8) snare(x, t, 0.38); if (b % 4 === 0) china(x, t, 0.1);
      break;
    }
    case 'slam': { // slam: quarter-time snare, china 8ths, a dive bomb into the drop
      if (startSec) { x.osc('sine', 120, t - spb * 0, 2.2, 0.55, 26); crash(x, t, 0.18); }
      const c = T.riffs.slam[b]; gtr(x, amp, T, c, t, spb);
      if (c) kick(x, t, 0.55); if (b === 8 && bar % 2 === 1) snare(x, t, 0.42); if (b % 2 === 0) china(x, t, b % 4 ? 0.05 : 0.09);
      break;
    }
  }
  if (last && b >= 12 && sec.type !== 'slam') tom(x, t, [190, 160, 130, 105][b - 12]); // fill into the next section
}

export const PIT_STATION = songStation({
  id: 'pit', name: 'PIT 66.6', tag: 'Metalcore · Deathcore', seed: 666, tracks: PIT_TRACKS, play: playHeavy, mars: 'flats',
  dj: ['PIT 66.6. If your rover isn\u2019t shaking, you\u2019re doing it wrong.', 'PIT 66.6, heavy as a fucking dust storm.',
    'Two-step in traffic. ColSec can\u2019t stop all of us.', 'This one\u2019s for whoever torched the Meridian depot. Legend.',
    'Breakdowns, blast beats, bad decisions. PIT 66.6.', 'Spin-kick responsibly. Or don\u2019t. We\u2019re not your mom.',
    'Helios Heights called to complain. Volume up, you rich bastards.', 'Pit Boss on the board. Mosh hard, breathe canned air.']
});
