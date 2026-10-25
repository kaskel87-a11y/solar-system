// Mars city ambience: per-district soundscapes that crossfade with the player's position.
// Districts are AJ-relative (Ares Junction centre = origin, x east, z south), from the mars-city pack. When v7.5 registers
// real districts (SSX.registerDistrict / districtsOf('Mars')), their centre/radius override these defaults by id or name.
import { tone, burst, swell, babble, noiseBuf } from './synth.js?v=7.5';

export const AMBIENCE_CONFIG = {
  world: 'Mars',
  zones: [
    { id: 'ares-junction', name: 'Ares Junction', centre: [0, 0], r: 70, profile: 'junction', match: /ares.?junction|^aj$/i },
    { id: 'olympus-row', name: 'Olympus Row', centre: [0, -430], r: 95, profile: 'downtown', match: /olympus|downtown/i },
    { id: 'red-tape-flats', name: 'Red Tape Flats', centre: [-280, -40], r: 85, profile: 'flats', match: /red.?tape|flats|rough/i },
    { id: 'helios-heights', name: 'Helios Heights', centre: [320, 80], r: 70, profile: 'heights', match: /helios|gated|heights/i }
  ],
  // Ares Beltway polyline (highway.json polyline_aj); band = half-width in metres of "on the highway"
  beltway: { id: 'ares-beltway', name: 'Ares Beltway', profile: 'highway', band: 18,
    pts: [[0, -55], [-30, -50], [0, -220], [0, -390], [0, -430], [60, -430], [180, -200], [280, 40], [320, 80], [120, 160], [80, 40], [0, 60], [-140, 20], [-240, -20], [-280, -40], [-200, -120], [-80, -160], [0, -55]] },
  inner: 0.55, outer: 1.3 // full level inside r*inner, silent past r*outer
};
export const PROFILES = ['junction', 'downtown', 'flats', 'heights', 'highway'];

// ---------- pure helpers (unit-tested) ----------
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
export function distToPolyline(x, z, pts) { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSegment(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return d; }
// Merge registered districts (world.js DISTRICTS, via districtsOf) into the config zones. Unknown registered districts
// with a centre get a zone of their own (profile from def.ambience / def.soundscape, else guessed from the name, else 'junction').
export function zonesFrom(registered = [], cfg = AMBIENCE_CONFIG) {
  const zones = cfg.zones.map(z => ({ ...z }));
  for (const d of registered || []) {
    const c = d && (d.centre || d.center); if (!Array.isArray(c) || c.length < 2 || !isFinite(c[0]) || !isFinite(c[1])) continue;
    const key = `${d.id || ''} ${d.name || ''}`;
    let z = zones.find(q => q.id === d.id) || zones.find(q => q.match && q.match.test(key));
    const r = +(d.radius || d.r || d.flatten) || 0, prof = d.ambience || d.soundscape;
    if (z) { z.centre = [+c[0], +c[1]]; if (r > 10) z.r = r; if (PROFILES.includes(prof)) z.profile = prof; z.registered = true; }
    else zones.push({ id: d.id, name: d.name || d.id, centre: [+c[0], +c[1]], r: r > 10 ? r : 80, registered: true,
      profile: PROFILES.includes(prof) ? prof : (cfg.zones.find(q => q.match && q.match.test(key))?.profile || 'junction') });
  }
  return zones;
}
// Weights 0..1 per profile at AJ-relative (x, z). Districts fade by distance; the highway fills the gaps between them
// (scaled down inside a district). The sum never exceeds 1, so total loudness stays constant while crossfading.
export function mixWeights(x, z, zones = AMBIENCE_CONFIG.zones, beltway = AMBIENCE_CONFIG.beltway, cfg = AMBIENCE_CONFIG) {
  const w = Object.fromEntries(PROFILES.map(p => [p, 0])); let near = null, best = 0;
  for (const q of zones) {
    const d = Math.hypot(x - q.centre[0], z - q.centre[1]), a = q.r * cfg.inner, b = q.r * cfg.outer;
    const v = d <= a ? 1 : d >= b ? 0 : smooth(1 - (d - a) / (b - a));
    w[q.profile] = Math.max(w[q.profile] || 0, v); if (v > best) { best = v; near = q; }
  }
  const zoneMax = Math.max(0, ...PROFILES.filter(p => p !== 'highway').map(p => w[p]));
  if (beltway?.pts?.length > 1) {
    const d = distToPolyline(x, z, beltway.pts), bd = beltway.band;
    w.highway = Math.max(w.highway, (d <= bd ? 1 : d >= bd * 3 ? 0 : smooth(1 - (d - bd) / (bd * 2))) * (1 - zoneMax));
  }
  const sum = PROFILES.reduce((s, p) => s + w[p], 0); if (sum > 1) for (const p of PROFILES) w[p] /= sum;
  return { w, district: near && best > 0.5 ? near : null, top: PROFILES.reduce((a, p) => (w[p] > (w[a] || 0) ? p : a), 'junction') };
}

// ---------- engine ----------
// Beds: one looped noise chain (+ optional tone) per profile, created on demand and torn down when silent.
// Events: sparse one-shots per profile, rate and level scaled by the profile weight, capped by the shared voice pool.
const EVENTS = {
  junction: [
    { every: [16, 30], len: 1.2, fn: (a, o, t, v) => [784, 988, 1319].forEach((f, i) => tone(a, o, 'sine', f, t + i * 0.22, 0.7, 0.05 * v)) }, // PA chime
    { every: [9, 18], len: 1.6, fn: (a, o, t, v) => babble(a, o, t, { pitch: 120 + Math.random() * 90, syll: 7, rate: 6, vol: 0.02 * v, lp: 1400 }) }
  ],
  downtown: [
    { every: [5, 11], len: 0.5, fn: (a, o, t, v) => { const f = 330 + Math.random() * 120; tone(a, o, 'square', f, t, 0.28, 0.025 * v); tone(a, o, 'square', f * 1.26, t, 0.28, 0.02 * v); } }, // horn
    { every: [4, 9], len: 2.6, fn: (a, o, t, v) => swell(a, o, t, 2.6, 0.12 * v, 300, 1300, 0.7) }, // car pass
    { every: [20, 40], len: 1.4, fn: (a, o, t, v) => [659, 523, 392].forEach((f, i) => tone(a, o, 'triangle', f, t + i * 0.3, 0.5, 0.04 * v)) }, // transit ring
    { every: [7, 14], len: 1.8, fn: (a, o, t, v) => babble(a, o, t, { pitch: 150 + Math.random() * 80, syll: 9, rate: 7, vol: 0.022 * v, lp: 1800 }) }
  ],
  flats: [
    { every: [14, 30], len: 5, fn: (a, o, t, v) => { // distant siren wail
      const s = a.createOscillator(), l = a.createOscillator(), lg = a.createGain(), g = a.createGain(), f = a.createBiquadFilter();
      s.type = 'sawtooth'; s.frequency.value = 820; l.frequency.value = 0.45; lg.gain.value = 260; f.type = 'lowpass'; f.frequency.value = 1300;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * v, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      l.connect(lg).connect(s.frequency); s.connect(f).connect(g).connect(o); s.start(t); l.start(t); s.stop(t + 5.1); l.stop(t + 5.1);
    } },
    { every: [6, 14], len: 1, fn: (a, o, t, v) => { for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) { const st = t + i * 0.24; tone(a, o, 'square', 560, st, 0.12, 0.04 * v, 260); burst(a, o, st, 0.1, 0.05 * v, 900, 1.5); } } }, // dog
    { every: [10, 20], len: 2.6, fn: (a, o, t, v) => { babble(a, o, t, { pitch: 125, syll: 8, rate: 8, vol: 0.035 * v, angry: true, lp: 1500 }); babble(a, o, t + 1.1, { pitch: 190, syll: 7, rate: 8, vol: 0.035 * v, angry: true, lp: 1500 }); } }, // argument
    { every: [30, 60], len: 0.6, fn: (a, o, t, v) => { for (let i = 0; i < 2; i++) { burst(a, o, t + i * 0.18, 0.25, 0.12 * v, 700, 0.6, 'lowpass'); tone(a, o, 'sine', 90, t + i * 0.18, 0.2, 0.08 * v, 40); } } }, // far-off shots
    { every: [8, 16], len: 0.5, fn: (a, o, t, v) => { tone(a, o, 'square', 1100 + Math.random() * 500, t, 0.08, 0.02 * v, 700); burst(a, o, t, 0.3, 0.04 * v, 3000, 8); } } // metal clank
  ],
  heights: [
    { every: [1.2, 3.5], len: 0.4, fn: (a, o, t, v) => tone(a, o, 'sine', 1600 + Math.random() * 1600, t, 0.12, 0.012 * v, 1200 + Math.random() * 800) }, // fountain plinks
    { every: [7, 15], len: 3, fn: (a, o, t, v) => [0, 2, 4].forEach(i => tone(a, o, 'sine', [1047, 1175, 1319, 1568, 1760][Math.random() * 5 | 0], t + i * 0.5, 2.2, 0.018 * v)) }, // wind chimes
    { every: [18, 34], len: 4, fn: (a, o, t, v) => { tone(a, o, 'sawtooth', 190, t, 4, 0.012 * v, 165, 1.8); tone(a, o, 'sine', 380, t, 4, 0.01 * v, 330, 1.8); } } // security drone flyby
  ],
  highway: [
    { every: [2.5, 6], len: 2.2, fn: (a, o, t, v) => swell(a, o, t, 2.2, 0.16 * v, 260, 1600, 0.8) }, // pass-by
    { every: [25, 50], len: 1.2, fn: (a, o, t, v) => { tone(a, o, 'sawtooth', 196, t, 1, 0.025 * v); tone(a, o, 'sawtooth', 247, t, 1, 0.02 * v); } } // hauler horn
  ]
};
const BEDS = { // [filter type, freq, Q, gain, lfoHz, lfoDepth, tone?]
  junction: { f: ['lowpass', 260, 0.7], g: 0.12, lfo: [0.05, 80], hum: [60, 0.012] },
  downtown: { f: ['lowpass', 420, 0.6], g: 0.26, lfo: [0.08, 160], f2: ['bandpass', 900, 0.8, 0.07] },
  flats: { f: ['bandpass', 520, 0.5], g: 0.16, lfo: [0.11, 260], hum: [49, 0.02] },
  heights: { f: ['highpass', 2400, 0.4], g: 0.05, lfo: [0.3, 600] },
  highway: { f: ['bandpass', 700, 0.6], g: 0.26, lfo: [0.07, 300] }
};
export const EVENT_TABLE = EVENTS;

export function createAmbience(getCtx, out, { voices, maxBeds = 3 } = {}) {
  const beds = {}, timers = {}; let busOut = null, cabin = null, last = { w: {} };
  for (const p of PROFILES) timers[p] = EVENTS[p].map(e => e.every[0] * (0.3 + Math.random() * 0.7));
  function bus(a) {
    if (busOut) return busOut;
    cabin = a.createBiquadFilter(); cabin.type = 'lowpass'; cabin.frequency.value = 14000; busOut = a.createGain(); busOut.gain.value = 1; busOut.connect(cabin).connect(typeof out === 'function' ? out() : out); return busOut;
  }
  function makeBed(a, p) {
    const B = BEDS[p], g = a.createGain(); g.gain.value = 0.0001; g.connect(bus(a));
    const s = a.createBufferSource(); s.buffer = noiseBuf(a); s.loop = true; const f = a.createBiquadFilter(); [f.type, f.frequency.value, f.Q.value] = B.f;
    s.connect(f).connect(g); const nodes = [s];
    if (B.lfo) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = B.lfo[0]; lg.gain.value = B.lfo[1]; l.connect(lg).connect(f.frequency); nodes.push(l); }
    if (B.f2) { const f2 = a.createBiquadFilter(), g2 = a.createGain(); [f2.type, f2.frequency.value, f2.Q.value] = B.f2; g2.gain.value = B.f2[3] / B.g; s.connect(f2).connect(g2).connect(g); }
    if (B.hum) { const o = a.createOscillator(), og = a.createGain(); o.frequency.value = B.hum[0]; og.gain.value = B.hum[1] / B.g; o.connect(og).connect(g); nodes.push(o); }
    nodes.forEach(n => n.start()); return { g, nodes, f, idle: 0 };
  }
  function kill(p) { const b = beds[p]; if (!b) return; delete beds[p]; const a = getCtx(); if (a) b.g.gain.setTargetAtTime(0.0001, a.currentTime, 0.2); setTimeout(() => b.nodes.forEach(n => { try { n.stop(); } catch (e) { /* */ } }), 900); }
  return {
    get beds() { return Object.keys(beds); }, get last() { return last; },
    // weights from mixWeights().w; opts { driving, speed, indoors, level }
    update(dt, weights, { driving = false, speed = 0, indoors = false, level = 1 } = {}) {
      const a = getCtx(); if (!a) return; bus(a); last = { w: weights };
      const t = a.currentTime, duck = (indoors ? 0.12 : driving ? 0.55 : 1) * level;
      cabin.frequency.setTargetAtTime(indoors ? 700 : driving ? 1100 : 14000, t, 0.3);
      const want = PROFILES.filter(p => weights[p] > 0.02).sort((x, y) => weights[y] - weights[x]).slice(0, maxBeds);
      for (const p of PROFILES) {
        const v = want.includes(p) ? weights[p] : 0;
        if (v > 0 && !beds[p]) beds[p] = makeBed(a, p);
        const b = beds[p]; if (!b) continue;
        let g = BEDS[p].g * v * duck; if (p === 'highway') { g *= 0.6 + Math.min(1, Math.abs(speed) / 30) * 0.8; b.f.frequency.setTargetAtTime(600 + Math.min(1, Math.abs(speed) / 30) * 900, t, 0.4); }
        b.g.gain.setTargetAtTime(Math.max(0.0001, g), t, 0.6);
        if (v <= 0) { b.idle += dt; if (b.idle > 3) kill(p); } else b.idle = 0;
        if (v < 0.15 || indoors) continue;
        EVENTS[p].forEach((e, i) => {
          timers[p][i] -= dt * (0.4 + v * 0.6); if (timers[p][i] > 0) return;
          timers[p][i] = e.every[0] + Math.random() * (e.every[1] - e.every[0]);
          if (voices && !voices.try(e.len)) return;
          try { e.fn(a, bus(a), t + 0.02, v * duck * (0.6 + Math.random() * 0.4)); } catch (err) { /* */ }
        });
      }
    },
    stop() { for (const p of Object.keys(beds)) kill(p); }
  };
}
