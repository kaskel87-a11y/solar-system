// Song-structured procedural radio stations (PIT 66.6, DUST 98.3). A station built with songStation() plays a rotating
// set of original "tracks": each track is a list of sections (intro, verse, breakdown...) with its own tempo, key and
// meter, generated from a seed. All sound is Web Audio oscillators + noise; no samples, no lyrics, no vocals.
// Runs through radio.js createRadio(): step(x, t, s, bar, spb) is called once per 16th note, in order.
import { midi } from './synth.js';
export { midi };

// Small seeded PRNG so every track is the same every time it comes round (and unit tests are repeatable)
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (r, xs) => xs[Math.floor(r() * xs.length) % xs.length];

// Shuffled play order with no track twice in a row (also across deck refills)
export function nextTrack(deck, count, r = Math.random) {
  if (count <= 1) return 0;
  if (!deck.order || !deck.order.length) {
    const o = Array.from({ length: count }, (_, i) => i);
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    if (o[o.length - 1] === deck.last) [o[0], o[o.length - 1]] = [o[o.length - 1], o[0]];
    deck.order = o;
  }
  const i = deck.order.pop(); deck.last = i; return i;
}
export const sectionSteps = (track, sec) => Math.max(1, sec.bars | 0) * (track.meter || 4) * 4;
export const trackSteps = track => track.sections.reduce((n, s) => n + sectionSteps(track, s), 0);

// Advance a play cursor one 16th: returns { track, sec, n, startTrack, startSec } for the step to play now.
export function advance(p, tracks, r = Math.random) {
  let startTrack = false, startSec = false;
  if (p.ti == null) { p.ti = nextTrack(p.deck ||= {}, tracks.length, r); p.si = 0; p.n = 0; startTrack = startSec = true; }
  let track = tracks[p.ti], sec = track.sections[p.si];
  if (p.n >= sectionSteps(track, sec)) {
    p.si++; p.n = 0; startSec = true;
    if (p.si >= track.sections.length) { p.ti = nextTrack(p.deck, tracks.length, r); p.si = 0; startTrack = true; track = tracks[p.ti]; }
    sec = track.sections[p.si];
  }
  const out = { track, sec, n: p.n, startTrack, startSec }; p.n++; return out;
}

// ---------- audio helpers: real nodes when x.out is a Web Audio node, else plain x.osc()/x.hit() (unit tests) ----------
const CHAINS = new WeakMap();
function curve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const v = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * v) / Math.tanh(k); } return c; }
// Amp-ish chain per station bus: pre-gain -> waveshaper (fuzz) -> cab lowpass -> mid scoop -> out
export function ampChain(out, gain = 34, cab = 3400) {
  const a = out?.context; if (!a || !a.createWaveShaper) return null;
  let m = CHAINS.get(out); if (!m) CHAINS.set(out, (m = {}));
  const key = gain + ':' + cab; if (m[key]) return m[key];
  const pre = a.createGain(), sh = a.createWaveShaper(), lp = a.createBiquadFilter(), sc = a.createBiquadFilter(), post = a.createGain();
  pre.gain.value = 1; sh.curve = curve(gain); sh.oversample = 'none'; lp.type = 'lowpass'; lp.frequency.value = cab; lp.Q.value = 0.9;
  sc.type = 'peaking'; sc.frequency.value = 750; sc.Q.value = 0.8; sc.gain.value = -6; post.gain.value = 0.17;
  pre.connect(sh).connect(lp).connect(sc).connect(post).connect(out); return (m[key] = pre);
}
// Oscillator with optional vibrato + slide-in, straight into a node (fiddle, pedal steel, feedback, leads)
export function voice(x, dest, { type = 'sawtooth', f, t, dur, vol, f1, attack = 0.01, vib = 0, rate = 5.5, slide = 0, lp = 0, q = 0.8 }) {
  const a = dest?.context || x.out?.context;
  if (!a || !a.createOscillator) { x.osc(type, f, t, dur, vol, f1); return; }
  const o = a.createOscillator(), g = a.createGain(); o.type = type;
  if (slide) { o.frequency.setValueAtTime(f * Math.pow(2, -slide / 12), t); o.frequency.linearRampToValueAtTime(f, t + Math.min(0.12, dur * 0.4)); } else o.frequency.setValueAtTime(f, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  let lfo = null; if (vib) { lfo = a.createOscillator(); const lg = a.createGain(); lfo.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * vib, t + Math.min(0.35, dur * 0.6)); lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n = o; if (lp) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; n = o.connect(fl); }
  n.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
}

// Build a station def from { id, name, tag, dj, tracks, play(k) } where play(k) gets one 16th:
// k = { x, t, spb, track, sec, n (16th in section), b (16th in bar), bar (bar in section), beats, startSec, startTrack }
export function songStation(def) {
  const tracks = def.tracks;
  return {
    id: def.id, name: def.name, tag: def.tag, dj: def.dj || [], bpm: tracks[0].bpm, tracks, mars: def.mars,
    step(x, t, s, barIdx, spb) {
      const p = (this.__p ||= { deck: {} }), r = this.__r ||= rng(def.seed || 7);
      const c = advance(p, tracks, r), tr = c.track, per = (tr.meter || 4) * 4;
      if (c.startTrack) { this.bpm = tr.bpm; this.nowPlaying = tr.title; try { this.onTrack?.(tr, this); } catch (e) { /* */ } }
      def.play({ x, t, spb, track: tr, sec: c.sec, n: c.n, b: c.n % per, bar: Math.floor(c.n / per), beats: tr.meter || 4, startSec: c.startSec, startTrack: c.startTrack });
    }
  };
}
