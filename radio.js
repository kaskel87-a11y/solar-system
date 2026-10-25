// Mars city ambience: four more procedural car-radio stations. They join audio7.js STATIONS (after "Radio off", so the
// saved station index of older saves still means the same thing), and play through their own scheduler while audio7's
// in-car radio is "on" and tuned to one of them. All music is generated with Web Audio; no samples, no licences needed.
import { midi as N, tone, burst, babble } from './synth.js?v=7.5.1';

// ---------- station definitions (pure data + a step() pattern) ----------
// step(x, t, s, bar, spb): x = { out, osc(type, f, t, dur, vol, f1), hit(t, dur, vol, freq, q, type) }, s = 16th step 0..63
export const MARS_STATIONS = [
  { id: 'rust', name: 'RUST 103.5', tag: 'Red Tape Hip-Hop', bpm: 88, mars: 'flats',
    dj: ['RUST 103.5. Red Tape radio. Snitches get static.', 'This one goes out to the Saltblood boys. Pay your water bill.',
      'If ColSec is behind you, turn this up and floor it.', 'Chop shop on Ninth is hiring. Bring your own crowbar.',
      'Marrow says the Flats are a family. A very armed family.', 'Spit Valve on the mic. Your rover is stolen. Mine too.'],
    step(x, t, s, bar, spb) {
      const root = [38, 38, 41, 36][bar], sw = s % 2 ? spb * 0.18 : 0; // lazy swing
      if (s % 16 === 0 || s % 16 === 10 || (s % 32 === 7 && bar % 2)) x.osc('sine', 115, t, 0.28, 0.6, 38);
      if (s % 8 === 4) { x.hit(t, 0.2, 0.32, 1700, 0.7); x.osc('triangle', 190, t, 0.08, 0.12, 120); }
      if (s % 2 === 0 || s % 8 === 7) x.hit(t + sw, 0.035, s % 4 === 2 ? 0.09 : 0.05, 7500, 1, 'highpass');
      if (s % 16 === 0 || s % 16 === 6 || s % 16 === 11) x.osc('square', N(root - 12), t, spb * 2.4, 0.09);
      if (s % 32 === 14) { x.osc('square', 1240, t, 0.07, 0.035, 760); x.hit(t, 0.12, 0.08, 3200, 9); } // pipe clank
      if (s % 32 === 0) [0, 3, 7].forEach(k => x.osc('triangle', N(root + 24 + k), t, spb * 3, 0.035));
      if (s % 64 === 48) x.osc('sawtooth', N(root + 31), t, spb * 6, 0.025, N(root + 29));
    } },
  { id: 'olympus', name: 'OLYMPUS 90.1', tag: 'Meridian Talk & News', bpm: 72, talk: true, mars: 'downtown',
    dj: ['OLYMPUS 90.1, news you can afford.', 'Dana and Mo, keeping Mars informed and mildly terrified.'],
    // talk segments, read out as small captions while a TTS-free babble voice "speaks" (65-char-ish lines, iPhone-friendly)
    segs: [
      'News: First Junction Trust says the vault is "totally fine."', 'News: ColSec says crime is down 40%. ColSec stopped counting.',
      'News: hauler fire on the Ares Beltway. Cargo "evaporated."', 'News: Helios Heights votes to fence off the sky. Motion passes.',
      'News: Red Tape water tower tagged again. Saltblood denies it.', 'News: Meridian profits up. Meridian funerals also up.',
      'Weather: dust. Tomorrow: more dust. Long-range: guess.',
      'Ad: Lungful canned air. Breathe like you mean it. Now in Mint.', 'Ad: Meridian Extraction. We dig deeper. Don\u2019t ask what we hit.',
      'Ad: ColSec is hiring! Protect. Serve. Collect. BYO armor.', 'Ad: Gus\u2019s Rovers. Low miles! Hardly stolen! We do repos.',
      'Ad: Ozzie\u2019s Iron. If it jams, you bought it wrong.', 'Ad: First Junction Trust. Your money is safe. Probably.',
      'Ad: The Velvet Airlock. Two-drink minimum, zero-fight maximum.',
      'Mo: A caller says the Flats are safe now. The caller is lying.', 'Dana: We\u2019re legally required to say Meridian is great.',
      'Caller: Some asshole just stole my rover! Mo: Classic Mars.', 'Mo: Beltway\u2019s moving. Mostly away from ColSec.',
      'Dana: Helios folks, lock your doors. Mo: They have butlers.', 'Caller: Is the dust supposed to glow? Dana: ...Next caller.'],
    step(x, t, s, bar) { // soft news bed under the talk
      if (s % 32 === 0) { const ch = [[50, 57, 62], [48, 55, 60], [46, 53, 58], [45, 52, 57]][bar]; ch.forEach(n => x.osc('sine', N(n), t, 3.4, 0.03)); }
      if (s % 8 === 0) x.hit(t, 0.03, 0.025, 6000, 1, 'highpass');
    } },
  { id: 'helios', name: 'HELIOS 107.7', tag: 'Quiet Money Lounge', bpm: 84, mars: 'heights',
    dj: ['HELIOS 107.7. Smooth music for people with private security.', 'You\u2019re listening to Quiet Money. Sit up straight.',
      'This hour is brought to you by gated communities. Keep out.', 'Relax. Somebody else is doing the crimes. You fund them.',
      'If you can hear this, your air filter is premium. Congrats.'],
    step(x, t, s, bar, spb) {
      const ch = [[50, 53, 57, 60, 64], [55, 59, 62, 65], [48, 52, 55, 59, 62], [45, 48, 52, 55, 60]][bar];
      const sw = s % 4 === 2 ? spb * 0.33 : 0;
      if (s % 16 === 0 || s % 16 === 10) ch.forEach((n, i) => { x.osc('sine', N(n), t + i * 0.012, spb * 6, 0.028); x.osc('triangle', N(n) * 1.004, t, spb * 5, 0.012); });
      if (s % 4 === 0) x.osc('triangle', N(ch[0] - 12 + [0, 7, 5, 3][(s / 4) % 4]), t, spb * 3.6, 0.09); // walking bass
      if (s % 4 === 0 || s % 4 === 2) x.hit(t + sw, 0.09, s % 8 === 4 ? 0.06 : 0.03, 4200, 0.6); // brushes
      if (s % 16 === 0 && bar !== 2) x.osc('sine', 95, t, 0.25, 0.25, 50);
      if (s % 32 === 22) x.osc('sine', N(ch[ch.length - 1] + 12), t, spb * 4, 0.03); // vibes
    } },
  { id: 'beltway', name: 'BELTWAY 99.9', tag: 'Outrun Darksynth', bpm: 132, mars: 'highway',
    dj: ['BELTWAY 99.9. Gas, brakes, no brakes.', 'Checkpoint at the ridge. Boost or bribe. We don\u2019t judge.',
      'If you see blue lights, that\u2019s just the bass. Probably.', 'Night drive mix. Lights off, headlights on, morals optional.',
      'Kestrel holds the Beltway record. Kestrel holds a grudge too.'],
    step(x, t, s, bar, spb) {
      const root = [40, 40, 36, 38][bar];
      if (s % 4 === 0) x.osc('sine', 140, t, 0.2, 0.6, 42);
      if (s % 8 === 4) { x.hit(t, 0.16, 0.26, 1500, 0.6); x.hit(t, 0.05, 0.12, 5000, 1, 'highpass'); }
      if (s % 2 === 1) x.hit(t, 0.03, 0.05, 9000, 1, 'highpass');
      x.osc('sawtooth', N(root - 12 + (s % 2 ? 12 : 0)), t, spb * 0.8, 0.07);
      if (s % 2 === 0) x.osc('square', N(root + 24 + [0, 3, 7, 10, 12, 10, 7, 3][(s / 2) % 8]), t, spb * 1.6, 0.03);
      if (s % 64 === 0) x.hit(t, 1.6, 0.1, 7000, 0.4, 'highpass');
    } }
];

// Extra DJ lines for the stock stations (NPC_BARKS.md). Added without editing audio7.js: see addDjLines().
export const STOCK_DJ = {
  kred: ['KRED 88.1. Louder than the dust storm. Barely.', 'Traffic: two haulers, one buggy, zero brakes. Avoid the loop.',
    'Shout-out to the maniac drilling the bank last night. Rock on.', 'Saltblood says their prices are fair. Saltblood lies.',
    'If your rover\u2019s on fire, turn it up. Then get out.', 'Meridian sponsors this hour. They made us say that.'],
  void: ['VOID 101.3. Count your breaths. They\u2019re numbered.', 'This next piece is called \u2018Pressure Drop.\u2019 Relax.',
    'The hull is groaning. So are we. Together.', 'You are a small warm thing in a large cold place.', 'Ambient for heists, hearses and long drives home.'],
  ceres: ['Ceres 94.7. Buy low, sell high, stay pressurized.', 'Somebody robbed the Exchange. I\u2019m not saying who. I\u2019m saying wow.',
    'The Quiet doesn\u2019t like this song. Volume up.', 'Request line\u2019s open. Requests are ignored lovingly.', 'Weather on Ceres: salty. Like me.']
};

// ---------- pure helpers (unit-tested) ----------
// Validate + normalise a station def for registerStation()
export function normStation(def) {
  if (!def || typeof def.id !== 'string' || !def.id || !def.name) throw new Error('registerStation({ id, name, tag, bpm, dj: [], step(x, t, s, bar, spb) })');
  return { tag: '', bpm: 100, dj: [], ...def, bpm: Math.max(40, Math.min(200, +def.bpm || 100)), dj: Array.isArray(def.dj) ? def.dj.slice() : [] };
}
// Add stations to the shared STATIONS array: after the existing ones (never re-ordering), skipping ids already there.
export function appendStations(list, defs) {
  const added = [];
  for (const d of defs) { const s = normStation(d); const i = list.findIndex(x => x.id === s.id); if (i >= 0) { added.push(i); continue; } list.push(s); added.push(list.length - 1); }
  return added;
}
// Which index to tune on entering a vehicle: the saved id wins (stable if mods add stations in another order),
// then the saved index (older saves), else 0.
export function resolveStation(list, settings = {}) {
  if (settings.radioId) { const i = list.findIndex(s => s.id === settings.radioId); if (i >= 0) return i; }
  const n = settings.radio | 0; return n >= 0 && n < list.length ? n : 0;
}
// Write the station into the save's settings (both forms). Returns true when anything changed.
export function rememberStation(settings, list, index) {
  const s = list[index]; if (!s || !settings) return false;
  const changed = settings.radio !== index || settings.radioId !== s.id; settings.radio = index; settings.radioId = s.id; return changed;
}
// Talk-station segment order: shuffled deck, no repeats until the deck is used up, never the same line twice in a row
export function nextSegment(deck, segs, rng = Math.random) {
  if (!deck.order || !deck.order.length) {
    const o = segs.map((_, i) => i); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    if (o.length > 1 && o[o.length - 1] === deck.last) [o[0], o[o.length - 1]] = [o[o.length - 1], o[0]];
    deck.order = o;
  }
  const i = deck.order.pop(); deck.last = i; return segs[i];
}
// Stock-station DJ lines that survive planets/index.js resetting s.dj on every world change: dj becomes base + extra.
export function addDjLines(station, lines) {
  if (!station || !lines?.length) return;
  const d = Object.getOwnPropertyDescriptor(station, 'dj');
  if (d && d.get && station.__djExtra) { station.__djExtra.push(...lines); return; }
  let base = Array.isArray(station.dj) ? station.dj : []; const extra = [...lines];
  Object.defineProperty(station, '__djExtra', { value: extra, enumerable: false });
  Object.defineProperty(station, 'dj', { configurable: true, enumerable: true, get: () => base.concat(extra), set: v => { base = Array.isArray(v) ? v : []; } });
}

// ---------- engine ----------
// getCtx() -> AudioContext|null, out = destination node (the music bus). onCaption(text, station) for talk segments.
export function createRadio(getCtx, out, { onCaption = () => {}, voices } = {}) {
  let cur = null, bus = null, timer = 0, nextT = 0, step = 0, talkT = 4, deck = {}, speaking = 0;
  function ensureBus(a) {
    if (bus) return bus;
    const g = a.createGain(); g.gain.value = 0.0001; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000; const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
    g.connect(lp).connect(hp).connect(typeof out === 'function' ? out() : out); return (bus = g);
  }
  function x(a) {
    const o = ensureBus(a);
    return { out: o, osc: (type, f, t, dur, vol, f1) => tone(a, o, type, f, t, dur, vol, f1), hit: (t, dur, vol, freq, q, type) => burst(a, o, t, dur, vol, freq, q, type) };
  }
  function schedule() {
    const a = getCtx(); if (!a || !cur) return;
    const spb = 60 / cur.bpm / 4, X = x(a);
    if (nextT < a.currentTime) nextT = a.currentTime + 0.05;
    while (nextT < a.currentTime + 0.3) { try { cur.step?.(X, nextT, step % 64, Math.floor(step / 16) % 4, spb); } catch (e) { /* a broken mod pattern stays silent */ } nextT += spb; step++; }
  }
  function talk(dt) {
    if (!cur?.talk || !cur.segs?.length) return;
    talkT -= dt; speaking -= dt; if (talkT > 0) return;
    const a = getCtx(); if (!a) return;
    const line = nextSegment(deck, cur.segs); const ad = /^Ad:/.test(line), host = /^(Mo|Dana|Caller):/.exec(line)?.[1];
    const dur = Math.min(4.2, 1.2 + line.length * 0.045); talkT = dur + 5 + Math.random() * 4; speaking = dur;
    onCaption(line, cur);
    if (ad) [880, 1175, 1568].forEach((f, i) => tone(a, ensureBus(a), 'sine', f, a.currentTime + i * 0.09, 0.3, 0.05));
    if (!voices || voices.try(dur)) babble(a, ensureBus(a), a.currentTime + (ad ? 0.35 : 0.05), { pitch: host === 'Dana' ? 205 : host === 'Caller' ? 165 : 118, syll: Math.round(dur * 5.5), rate: 5.5, vol: 0.06, lp: 3000 });
  }
  return {
    get station() { return cur; }, get speaking() { return speaking > 0; },
    play(st) {
      const a = getCtx(); if (!a) return; if (st === cur) return; cur = st; step = 0; nextT = 0; talkT = st?.talk ? 1.2 : 1e9; deck = {};
      const g = ensureBus(a).gain; g.cancelScheduledValues(a.currentTime); g.setTargetAtTime(st ? 0.24 : 0.0001, a.currentTime, 0.12);
      clearInterval(timer); timer = 0; if (st) { timer = setInterval(schedule, 90); schedule(); }
    },
    stop() { this.play(null); },
    tick(dt) { if (cur) talk(dt); },
    test: { deck: () => deck }
  };
}
