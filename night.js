// Seedier night mix for the Mars district soundscapes. Only active when a day/night clock exists
// (SSX.time.isNight(), from the day/night cycle); without one this does nothing. Sparse one-shots on top of
// ambience.js's beds, weighted by district: far sirens and dogs, bottle smashes, shouting, a rattling shutter, bass
// thumping out of a club, a hover-cop sweep. Follows the Ambience slider, Master and Mute.
import { tone, burst, swell, babble } from './synth.js';

// per-district event weights (district profiles from ambience.js mixWeights)
export const NIGHT_EVENTS = {
  flats: { siren: 3, dog: 3, bottle: 3, shout: 3, shutter: 2, bass: 1 },
  downtown: { siren: 2, bass: 3, shout: 1, sweep: 2, bottle: 1 },
  heights: { dog: 1, sweep: 2, siren: 1 },
  junction: { siren: 2, dog: 1, shout: 1, sweep: 1 },
  highway: { siren: 3, sweep: 2 }
};
export const isNight = () => { try { return !!window.SSX?.time?.isNight?.(); } catch (e) { return false; } };
// Pick an event for the current district weights (w: { flats: 0..1, ... }); null when nowhere seedy enough
export function pickNightEvent(w, r = Math.random) {
  const tally = {};
  for (const [prof, k] of Object.entries(w || {})) { if (!(k > 0.05) || !NIGHT_EVENTS[prof]) continue; for (const [e, n] of Object.entries(NIGHT_EVENTS[prof])) tally[e] = (tally[e] || 0) + n * k; }
  const tot = Object.values(tally).reduce((a, b) => a + b, 0); if (!tot) return null;
  let x = r() * tot; for (const [e, n] of Object.entries(tally)) { x -= n; if (x <= 0) return e; } return Object.keys(tally)[0];
}
export function playNightEvent(a, out, e, vol = 1) {
  const t = a.currentTime + 0.05, v = vol;
  if (e === 'siren') { for (let k = 0; k < 4; k++) tone(a, out, 'sine', 640, t + k * 0.9, 0.45, 0.025 * v, 900), tone(a, out, 'sine', 900, t + k * 0.9 + 0.45, 0.45, 0.025 * v, 640); }
  else if (e === 'dog') { for (let k = 0; k < 3; k++) { tone(a, out, 'sawtooth', 420, t + k * 0.32, 0.12, 0.03 * v, 260); burst(a, out, t + k * 0.32, 0.08, 0.03 * v, 900, 2); } }
  else if (e === 'bottle') { burst(a, out, t, 0.25, 0.08 * v, 5200, 2); for (let k = 0; k < 4; k++) tone(a, out, 'sine', 2600 + k * 700, t + 0.03 * k, 0.12, 0.02 * v); }
  else if (e === 'shout') babble(a, out, t, { pitch: 150 + Math.random() * 60, syll: 5, rate: 7, vol: 0.035 * v, angry: true, lp: 1800 });
  else if (e === 'shutter') { for (let k = 0; k < 10; k++) burst(a, out, t + k * 0.05, 0.05, 0.04 * v, 1400, 4); }
  else if (e === 'bass') { for (let k = 0; k < 8; k++) tone(a, out, 'sine', 60, t + k * 0.48, 0.25, 0.08 * v, 45); }
  else if (e === 'sweep') swell(a, out, t, 3, 0.04 * v, 300, 1600, 1.2);
}
export function createNightMix(app, ctx) {
  let next = 6;
  return {
    tick(dt) {
      const ma = app.marsAudio, a = ctx?.(); if (!ma || !a || a.state !== 'running' || !app.state?.onSurface || !isNight()) return null;
      next -= dt; if (next > 0) return null; next = 5 + Math.random() * 9;
      const st = ma.state; const e = pickNightEvent(st.weights); if (!e) return null;
      const m = ma.mix.get(); const inside = !!app.surface?.info?.inside; // destination is the Master bus (mars-audio shadows it)
      playNightEvent(a, a.destination, e, m.amb * (inside ? 0.35 : 1)); return e;
    }
  };
}
