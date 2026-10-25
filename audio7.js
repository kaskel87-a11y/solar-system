// v7 audio: procedural in-vehicle radio (three stations + off, with DJ blurbs), eerie surface ambience,
// motion-tracker pings and gritty one-shots. Pure Web Audio; nothing is downloaded.
export const STATIONS = [
  { id: 'kred', name: 'KRED 88.1', tag: 'Red Dust Rock', bpm: 124,
    dj: ['KRED 88.1, the only station still broadcasting from inside a dust storm.', 'That was a song. This is another one. Stay pressurized.', 'Traffic: hauler jackknifed on the junction loop. Again. Drive around the body.', 'Security reminds you that stealing vehicles is a crime. We remind you that security is slow.', 'Requests? Send them to the relay. We will ignore them personally.'] },
  { id: 'void', name: 'VOID 101.3', tag: 'Deep Space Ambient', bpm: 60,
    dj: ['VOID 101.3. Breathe slowly. Your oxygen is metered.', 'If you hear clicking in the walls, that is just the hull cooling. Probably.', 'Ambient for long drives and short life expectancies.', 'The next piece is called "Nobody Is Coming". It is very calming.'] },
  { id: 'ceres', name: 'CERES 94.7', tag: 'Belt Synthwave', bpm: 104,
    dj: ['Ceres 94.7. Neon, chrome and questionable decisions.', 'Weather on Mars: red. On the Moon: none. You are welcome.', 'Shout-out to whoever stole my bike. I know where you live. It is a dome.', 'Rook says hi. Rook says nothing else, which is how you know it is Rook.'] },
  { id: 'off', name: 'Radio off', tag: '', dj: [] }
];

export function createAudio7(getCtx) {
  let radioBus = null, ambBus = null, station = 0, playing = false, nextT = 0, step = 0, timer = 0, amb = null, trackerNext = 0;
  const noiseBuf = { b: null };
  function noise(a) {
    if (noiseBuf.b) return noiseBuf.b;
    const b = a.createBuffer(1, a.sampleRate * 1.5, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf.b = b);
  }
  function osc(a, dest, type, f, t, dur, vol, f1) {
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(a, dest, t, dur, vol, freq = 2000, q = 0.8, type = 'bandpass') {
    const s = a.createBufferSource(); s.buffer = noise(a); const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  // ---- radio ----
  function bus(a) {
    if (radioBus) return radioBus;
    const g = a.createGain(); g.gain.value = 0.0001; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
    g.connect(lp).connect(hp).connect(a.destination); return (radioBus = g);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  function schedule() {
    const a = getCtx(); if (!a || !playing) return;
    const S = STATIONS[station]; if (S.id === 'off') return;
    const out = bus(a), spb = 60 / S.bpm / 4; // 16th notes
    if (nextT < a.currentTime) nextT = a.currentTime + 0.05;
    while (nextT < a.currentTime + 0.35) {
      const t = nextT, s = step % 64, bar = Math.floor(step / 16) % 4;
      if (S.id === 'kred') {
        const root = [40, 40, 43, 38][bar];
        if (s % 8 === 0 || s % 16 === 10) osc(a, out, 'sine', 120, t, 0.18, 0.5, 40);
        if (s % 8 === 4) hiss(a, out, t, 0.16, 0.35, 1800, 0.6);
        if (s % 2 === 0) hiss(a, out, t, 0.03, 0.08, 8000, 1, 'highpass');
        if (s % 2 === 0) osc(a, out, 'sawtooth', N(root + (s % 8 === 6 ? 7 : 0)), t, spb * 1.8, 0.14);
        if (s % 16 === 0) [0, 7, 12].forEach(k => osc(a, out, 'square', N(root + 24 + k), t, spb * 7, 0.03));
      } else if (S.id === 'void') {
        if (s % 16 === 0) { const ch = [[50, 57, 62, 65], [48, 55, 60, 63], [46, 53, 58, 62], [45, 52, 57, 60]][bar]; ch.forEach(n => { osc(a, out, 'sine', N(n), t, spb * 15, 0.06); osc(a, out, 'triangle', N(n) * 1.003, t, spb * 15, 0.025); }); }
        if (s % 16 === 8 && Math.random() < 0.5) osc(a, out, 'sine', N(74 + [0, 3, 7, 10][Math.floor(Math.random() * 4)]), t, spb * 6, 0.04);
        if (s % 32 === 0) hiss(a, out, t, 2.5, 0.05, 600, 0.4);
      } else if (S.id === 'ceres') {
        const root = [45, 41, 43, 40][bar], arp = [0, 7, 12, 15, 12, 7, 3, 7];
        if (s % 4 === 0) osc(a, out, 'sine', 110, t, 0.2, 0.45, 45);
        if (s % 8 === 4) hiss(a, out, t, 0.22, 0.25, 1500, 0.5);
        osc(a, out, 'square', N(root + 24 + arp[s % 8]), t, spb * 0.9, 0.045);
        if (s % 4 === 0) osc(a, out, 'sawtooth', N(root), t, spb * 3.5, 0.12);
        if (s % 16 === 0) osc(a, out, 'triangle', N(root + 36), t, spb * 12, 0.04);
      }
      nextT += spb; step++;
    }
  }
  function setPlaying(on) {
    const a = getCtx(); playing = !!on && STATIONS[station].id !== 'off';
    if (a) { const g = bus(a).gain; g.cancelScheduledValues(a.currentTime); g.setTargetAtTime(playing ? 0.22 : 0.0001, a.currentTime, 0.15); }
    clearInterval(timer); if (playing) { step = 0; nextT = 0; timer = setInterval(schedule, 90); schedule(); }
  }
  function tuneStatic() { const a = getCtx(); if (a) hiss(a, a.destination, a.currentTime, 0.35, 0.05, 3000, 0.3); }
  // ---- ambience: low detuned drone + filtered wind, slow swells; sparse metallic groans ----
  function startAmbient(level = 1) {
    const a = getCtx(); if (!a || amb) return;
    const g = a.createGain(); g.gain.value = 0.0001; g.connect(a.destination);
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.connect(g);
    const o1 = a.createOscillator(), o2 = a.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 43.65; o2.frequency.value = 44.1;
    const og = a.createGain(); og.gain.value = 0.25; o1.connect(og); o2.connect(og); og.connect(lp);
    const w = a.createBufferSource(); w.buffer = noise(a); w.loop = true; const wf = a.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.7; const wg = a.createGain(); wg.gain.value = 0.35; w.connect(wf).connect(wg).connect(g);
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 260; lfo.connect(lg).connect(wf.frequency);
    [o1, o2, w, lfo].forEach(n => n.start());
    g.gain.setTargetAtTime(0.05 * level, a.currentTime, 1.5);
    amb = { g, nodes: [o1, o2, w, lfo], groan: 6 + Math.random() * 10 };
  }
  function stopAmbient() { const a = getCtx(); if (!amb || !a) { amb = null; return; } const x = amb; amb = null; x.g.gain.setTargetAtTime(0.0001, a.currentTime, 0.3); setTimeout(() => x.nodes.forEach(n => { try { n.stop(); } catch (e) { /* */ } }), 1200); }
  function tick(dt, { trackerDist = 1e9, hostiles = true, driving = false } = {}) {
    const a = getCtx(); if (!a) return null;
    let ping = null;
    if (amb) {
      amb.g.gain.setTargetAtTime((driving && playing ? 0.02 : 0.05), a.currentTime, 0.8);
      amb.groan -= dt; if (amb.groan <= 0 && hostiles) { amb.groan = 12 + Math.random() * 18; osc(a, amb.g, 'sawtooth', 70 + Math.random() * 30, a.currentTime, 2.2, 0.5, 38); hiss(a, amb.g, a.currentTime + 0.3, 1.6, 0.3, 900, 3); }
    }
    // motion tracker: pings faster and higher as contacts close in (inside 60 m)
    trackerNext -= dt;
    if (trackerDist < 60 && trackerNext <= 0) {
      const k = trackerDist / 60; trackerNext = 0.28 + k * 1.3;
      osc(a, a.destination, 'sine', 1900 - k * 700, a.currentTime, 0.09, 0.07); osc(a, a.destination, 'sine', (1900 - k * 700) * 0.5, a.currentTime + 0.1, 0.12, 0.035);
      ping = trackerDist;
    }
    return ping;
  }
  // ---- gritty one-shots ----
  const fx = {
    squelch(big) { const a = getCtx(); if (!a) return; const t = a.currentTime; hiss(a, a.destination, t, big ? 0.9 : 0.4, big ? 0.5 : 0.3, 500, 1.5); osc(a, a.destination, 'sawtooth', big ? 90 : 160, t, big ? 0.7 : 0.3, 0.14, 35); if (big) osc(a, a.destination, 'square', 60, t + 0.1, 1.0, 0.1, 25); },
    shotgun() { const a = getCtx(); if (!a) return; const t = a.currentTime; hiss(a, a.destination, t, 0.35, 0.55, 900, 0.5, 'lowpass'); osc(a, a.destination, 'sine', 110, t, 0.3, 0.35, 40); },
    screech() { const a = getCtx(); if (!a) return; const t = a.currentTime; osc(a, a.destination, 'sawtooth', 1400, t, 0.35, 0.05, 600); hiss(a, a.destination, t, 0.3, 0.12, 3500, 4); },
    slash() { const a = getCtx(); if (!a) return; hiss(a, a.destination, a.currentTime, 0.18, 0.3, 2500, 1.2); },
    spit() { const a = getCtx(); if (!a) return; hiss(a, a.destination, a.currentTime, 0.2, 0.15, 1200, 2); },
    enemyShot() { const a = getCtx(); if (!a) return; osc(a, a.destination, 'square', 700, a.currentTime, 0.12, 0.035, 200); },
    siren() { const a = getCtx(); if (!a) return; const t = a.currentTime; for (let k = 0; k < 3; k++) { osc(a, a.destination, 'square', 680, t + k * 0.5, 0.25, 0.03, 980); osc(a, a.destination, 'square', 980, t + k * 0.5 + 0.25, 0.25, 0.03, 680); } },
    wanted() { const a = getCtx(); if (!a) return; const t = a.currentTime; osc(a, a.destination, 'square', 520, t, 0.15, 0.06); osc(a, a.destination, 'square', 390, t + 0.17, 0.25, 0.06); },
    lost() { const a = getCtx(); if (!a) return; const t = a.currentTime; osc(a, a.destination, 'triangle', 520, t, 0.2, 0.08); osc(a, a.destination, 'triangle', 780, t + 0.15, 0.35, 0.08); },
    crash() { const a = getCtx(); if (!a) return; hiss(a, a.destination, a.currentTime, 0.5, 0.45, 400, 0.6, 'lowpass'); osc(a, a.destination, 'square', 80, a.currentTime, 0.3, 0.12, 30); },
    thud() { const a = getCtx(); if (!a) return; osc(a, a.destination, 'sine', 120, a.currentTime, 0.2, 0.25, 50); },
    dry() { const a = getCtx(); if (!a) return; osc(a, a.destination, 'square', 1800, a.currentTime, 0.03, 0.05); },
    cash() { const a = getCtx(); if (!a) return; const t = a.currentTime; [1568, 2093].forEach((f, i) => osc(a, a.destination, 'triangle', f, t + i * 0.07, 0.2, 0.09)); hiss(a, a.destination, t, 0.08, 0.05, 6000, 1); },
    whoosh() { const a = getCtx(); if (!a) return; hiss(a, a.destination, a.currentTime, 0.12, 0.12, 1400, 0.8); },
    punch() { const a = getCtx(); if (!a) return; const t = a.currentTime; osc(a, a.destination, 'sine', 95, t, 0.14, 0.35, 45); hiss(a, a.destination, t, 0.06, 0.22, 900, 0.7, 'lowpass'); },
    blade() { const a = getCtx(); if (!a) return; const t = a.currentTime; hiss(a, a.destination, t, 0.22, 0.32, 3200, 2.5); osc(a, a.destination, 'sawtooth', 240, t, 0.18, 0.08, 70); hiss(a, a.destination, t + 0.04, 0.25, 0.25, 600, 1.5); },
    crate() { const a = getCtx(); if (!a) return; const t = a.currentTime; osc(a, a.destination, 'square', 300, t, 0.05, 0.06); osc(a, a.destination, 'square', 420, t + 0.07, 0.08, 0.06); hiss(a, a.destination, t, 0.1, 0.08, 2000, 1); },
    door() { const a = getCtx(); if (!a) return; hiss(a, a.destination, a.currentTime, 0.4, 0.12, 700, 1); osc(a, a.destination, 'sine', 180, a.currentTime, 0.25, 0.06, 90); }
  };
  return {
    fx, startAmbient, stopAmbient, tick, tuneStatic,
    get station() { return STATIONS[station]; }, get stationIndex() { return station; }, get playing() { return playing; },
    setStation(i, on) { station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length; tuneStatic(); setPlaying(on); return STATIONS[station]; },
    next(on) { return this.setStation(station + 1, on); },
    radio(on) { setPlaying(on); },
    dj() { const S = STATIONS[station]; return S.dj.length ? S.dj[Math.floor(Math.random() * S.dj.length)] : null; }
  };
}
