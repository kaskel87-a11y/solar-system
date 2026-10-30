// DUST 98.3: outlaw / red-dirt country for the Mars radio. Acoustic strumming, upright bass, fiddle, pedal-steel style
// slides, brush train beats, shuffles and a waltz. Fully instrumental: no vocals, no lyrics. Chord changes are stock
// I-IV-V style progressions and every melody is generated from a seed (songs.js rng): original, nothing from real songs.
import { rng, pick, midi as N, songStation, voice } from './songs.js';

const CH = { I: [0, 'M'], ii: [2, 'm'], iii: [4, 'm'], IV: [5, 'M'], V: [7, 'M'], vi: [9, 'm'], bVII: [10, 'M'] };
const PROGS = [['I', 'IV', 'I', 'V'], ['I', 'V', 'vi', 'IV'], ['I', 'bVII', 'IV', 'I'], ['vi', 'IV', 'I', 'V'], ['I', 'I', 'IV', 'IV', 'V', 'IV', 'I', 'I'], ['I', 'iii', 'IV', 'V'], ['IV', 'I', 'V', 'V']];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const tones = q => (q === 'm' ? [0, 3, 7] : [0, 4, 7]);
// a 2-bar melodic phrase as [{ at: 16th, d: degree index into PENTA, len: 16ths }], one note per beat-ish
function phrase(r, per, dense) {
  const out = []; let i = 0, d = pick(r, [2, 3, 4]);
  while (i < per * 2) { const len = dense ? pick(r, [2, 2, 4]) : pick(r, [4, 4, 8, 6]); d = Math.max(0, Math.min(PENTA.length - 1, d + pick(r, [-2, -1, -1, 0, 1, 1, 2]))); if (r() > (dense ? 0.1 : 0.2)) out.push({ at: i, d, len }); i += len; }
  return out;
}
const TITLES = ['Rust Belt Hymn', 'Two Moons Over Tharsis', 'Whiskey In The Airlock', 'Long Haul To Hellas', 'Canned Air Waltz',
  'Red Dirt, Red Planet', 'Last Train Out Of Junction', 'Mama Mined The Ridge', 'Dust Devil Shuffle'];
const FEELS = ['train', 'shuffle', 'ballad', 'train', 'waltz', 'shuffle', 'train'];
export function countryTrack(seed, title, feel) {
  const r = rng(seed), meter = feel === 'waltz' ? 3 : 4, per = meter * 4;
  const bpm = { train: 128, shuffle: 108, ballad: 76, waltz: 96 }[feel] + Math.round(r() * 14 - 6), key = pick(r, [40, 43, 45, 38, 42]); // E G A D F#
  const T = { title, bpm, key, meter, feel, seed, verse: pick(r, PROGS), chorus: pick(r, PROGS), lead: r() < 0.5 ? 'fiddle' : 'steel',
    mel: { intro: phrase(r, per, false), chorus: phrase(r, per, false), solo: phrase(r, per, true), fill: phrase(r, per, true) } };
  T.sections = [['intro', 2], ['verse', 8], ['chorus', 8], ['verse', 8], ['solo', 8], ['chorus', 8], ['outro', 2], ['gap', 1]].map(([type, bars]) => ({ type, bars }));
  if (feel === 'ballad') T.sections.splice(4, 1, { type: 'solo', bars: 4 });
  return T;
}
export const DUST_TRACKS = TITLES.slice(0, 7).map((t, i) => countryTrack(983 + i * 131, t, FEELS[i]));

// ---------- instruments ----------
function strum(x, t, root, q, n, up, vol) { // staggered strings, low to high (down) or high to low (up)
  const v = [root, root + 7, root + 12, root + 12 + tones(q)[1], root + 19, root + 24].slice(0, 6), s = up ? v.slice(2, 2 + n).reverse() : v.slice(0, n);
  s.forEach((m, i) => x.osc('triangle', N(m), t + i * 0.011, 0.55, vol * (i ? 0.8 : 1)));
  x.hit(t, 0.04, vol * 0.5, 3200, 0.6); // pick scrape
}
const bass = (x, t, m, d) => { x.osc('triangle', N(m), t, d, 0.2); x.osc('sine', N(m), t, d * 0.7, 0.14); };
const brush = (x, t, v) => x.hit(t, 0.06, v, 3300, 0.7);
const kickS = (x, t, v = 0.32) => x.osc('sine', 120, t, 0.12, v, 50);
const rim = (x, t) => { x.osc('square', 1750, t, 0.025, 0.035); x.hit(t, 0.02, 0.05, 2500, 3); };
function lead(x, T, inst, m, t, d, vol) {
  if (inst === 'fiddle') voice(x, x.out, { type: 'sawtooth', f: N(m), t, dur: d, vol: vol * 0.7, attack: 0.05, vib: 0.006, rate: 5.8, slide: Math.random() < 0.3 ? 1 : 0, lp: 2900, q: 1.2 });
  else { voice(x, x.out, { type: 'triangle', f: N(m), t, dur: d * 1.25, vol, attack: 0.12, vib: 0.0035, rate: 4.5, slide: Math.random() < 0.55 ? 2 : 0, lp: 2400 }); voice(x, x.out, { type: 'sine', f: N(m + 12), t, dur: d, vol: vol * 0.3, attack: 0.15 }); }
}

export function playCountry(k) {
  const { x, t, spb, track: T, sec, b, bar, beats, startSec } = k, per = beats * 4;
  if (sec.type === 'gap') return;
  const prog = sec.type === 'chorus' || sec.type === 'solo' ? T.chorus : T.verse, [ro, q] = CH[prog[bar % prog.length]], root = T.key + ro, br = T.key + 12 + ro;
  const swing = T.feel === 'shuffle' && b % 4 === 2 ? spb * 0.34 : 0, tt = t + swing;
  if (sec.type === 'outro') { if (k.n === 0) { strum(x, t, T.key, 'M', 6, false, 0.06); bass(x, t, T.key + 12, spb * 14); lead(x, T, T.lead, T.key + 24 + 4, t, spb * 14, 0.05); } return; }
  // rhythm guitar + bass + drums
  const full = sec.type !== 'intro', vol = sec.type === 'chorus' ? 0.055 : 0.045;
  if (T.feel === 'train') {
    if (b % 2 === 0) strum(x, t, root, q, b % 4 === 0 ? 5 : 3, b % 4 === 2, vol * (b % 4 ? 0.7 : 1));
    if (full) { brush(x, t, b % 8 === 4 ? 0.1 : 0.035); if (b % 8 === 0) kickS(x, t); }
    if (b % 8 === 0) bass(x, t, b === 0 ? br : br + 7, spb * 3.5);
  } else if (T.feel === 'shuffle') {
    if (b % 8 === 0) bass(x, t, b === 0 ? br : br + 7, spb * 3.5);
    if (b % 8 === 4) strum(x, t, root, q, 5, false, vol); if (b % 8 === 6) strum(x, tt, root, q, 3, true, vol * 0.6);
    if (full) { if (b % 8 === 0) kickS(x, t); if (b % 8 === 4) brush(x, t, 0.11); if (b % 2 === 0) brush(x, tt, 0.03); }
  } else if (T.feel === 'waltz') {
    if (b === 0) bass(x, t, br, spb * 3.5); if (b === 8 && bar % 2) bass(x, t, br + 7, spb * 3);
    if (b === 4 || b === 8) strum(x, t, root, q, 4, b === 8, vol * 0.8);
    if (full) { if (b === 0) kickS(x, t, 0.25); if (b === 4 || b === 8) brush(x, t, 0.06); }
  } else { // ballad: fingerpicked 8ths
    const arp = [0, 12, 7 + 12, 12 + tones(q)[1], 24, 12 + tones(q)[1], 19, 12];
    if (b % 2 === 0) x.osc('triangle', N(root + arp[(b / 2) % 8]), t, spb * 3, 0.05);
    if (b === 0 || b === 8) bass(x, t, b === 0 ? br : br + 7, spb * 6);
    if (full) { if (b === 4 || b === 12) rim(x, t); if (b === 0) kickS(x, t, 0.22); }
  }
  // leads
  const melOf = { intro: T.mel.intro, chorus: T.mel.chorus, solo: T.mel.solo }[sec.type], pos = k.n % (per * 2);
  if (melOf) { for (const nt of melOf) if (nt.at === pos) lead(x, T, sec.type === 'chorus' && T.lead === 'steel' ? 'fiddle' : T.lead, T.key + 24 + PENTA[nt.d], tt, nt.len * spb, sec.type === 'solo' ? 0.06 : 0.045); }
  else if (sec.type === 'verse' && bar % 4 === 3) { for (const nt of T.mel.fill) if (nt.at === b + per) lead(x, T, 'steel', T.key + 24 + PENTA[nt.d], tt, nt.len * spb, 0.035); } // steel fill
  if (startSec && sec.type === 'chorus') x.hit(t, 0.7, 0.05, 6000, 0.5, 'highpass');
}

export const DUST_STATION = songStation({
  id: 'dust', name: 'DUST 98.3', tag: 'Red Dirt Outlaw Country', seed: 983, tracks: DUST_TRACKS, play: playCountry, mars: 'flats',
  dj: ['DUST 98.3. Outlaw country for folks the law gave up on.', 'Red dirt, red planet. Same damn dirt, honey.',
    'If you\u2019re hauling on the Beltway tonight, this one\u2019s for you.', 'DUST 98.3, where every truck has a story and a warrant.',
    'Cold beer, warm air filter, and a long road home.', 'Mama always said don\u2019t steal a rover. Mama ain\u2019t here.',
    'Fiddle, steel and a little bit of trouble. DUST 98.3.']
});
