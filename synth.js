// Mars city ambience: tiny shared WebAudio helpers (radio.js, ambience.js, barks.js). Nothing is downloaded and nothing
// runs at import, so the pure logic in those files can be unit-tested in Node (tests/test-ambience-unit.mjs).
export const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// A voice budget so phones never stack dozens of one-shots: try() reserves a slot for `dur` seconds (false = skip).
export function createVoicePool(max, now = () => performance.now() / 1000) {
  let ends = [];
  return {
    get max() { return max; }, set max(v) { max = v; },
    active() { const t = now(); ends = ends.filter(e => e > t); return ends.length; },
    try(dur) { if (this.active() >= max) return false; ends.push(now() + Math.max(0.05, dur)); return true; }
  };
}

const NOISE = new WeakMap();
export function noiseBuf(a) {
  let b = NOISE.get(a); if (b) return b;
  b = a.createBuffer(1, Math.floor(a.sampleRate * 2), a.sampleRate); const d = b.getChannelData(0);
  let br = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; br = (br + 0.02 * w) / 1.02; d[i] = w * 0.55 + br * 2.4; }
  NOISE.set(a, b); return b;
}
export function tone(a, dest, type, f, t, dur, vol, f1, attack = 0.01) {
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
}
export function burst(a, dest, t, dur, vol, freq = 2000, q = 0.8, type = 'bandpass', f1) {
  const s = a.createBufferSource(); s.buffer = noiseBuf(a); const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(Math.max(0.0002, vol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s;
}
// Swell: a noise band that fades in and out (traffic pass-bys, crowd swells, wind gusts)
export function swell(a, dest, t, dur, vol, f0, f1, q = 0.9, type = 'bandpass') {
  const s = a.createBufferSource(); s.buffer = noiseBuf(a); s.loop = true; const f = a.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5); f.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05); return s;
}
// TTS-free "voice": a sawtooth through a moving formant, one short syllable at a time. It reads as speech under a caption.
// opts: { pitch (Hz), syll (count), rate (syll/s), vol, angry, lp }
export function babble(a, dest, t, { pitch = 140, syll = 6, rate = 7, vol = 0.05, angry = false, lp = 2600 } = {}) {
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.connect(dest);
  const step = 1 / rate;
  for (let i = 0; i < syll; i++) {
    const st = t + i * step + (Math.random() - 0.5) * step * 0.25, d = step * (0.55 + Math.random() * 0.35);
    const o = a.createOscillator(), bp = a.createBiquadFilter(), g = a.createGain();
    o.type = 'sawtooth'; const p = pitch * (angry ? 1.15 + Math.random() * 0.35 : 0.9 + Math.random() * 0.25) * (i === syll - 1 ? 0.85 : 1);
    o.frequency.setValueAtTime(p, st); o.frequency.linearRampToValueAtTime(p * (0.9 + Math.random() * 0.2), st + d);
    bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(350 + Math.random() * 600, st); bp.frequency.linearRampToValueAtTime(900 + Math.random() * 1300, st + d);
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(vol * (angry ? 1.4 : 1), st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + d);
    o.connect(bp).connect(g).connect(f); o.start(st); o.stop(st + d + 0.03);
  }
  return syll * step;
}
