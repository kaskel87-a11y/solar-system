// Night car meets for the Mars dealership add-on (see dealership.js). From 21:00 to 03:00 colony time (garagecore clock)
// NPC cars roll into the lot on the south road out of Ares Junction. Drive your ride in and tap 📸 Show off for rep, or walk
// or drive up to a car and tap 🏁 Race to challenge its driver to a quarter-mile drag on the strip. The drag itself runs on
// race.js (startRace with a two-gate sprint def: grid hold, 3-2-1, GO, timer chip, rival car, finish, purse + result card);
// this file adds the wager, the rival's pace from its car's stats, and rep. Phone cap: 8 cars + 3 spectators (≤ 12 NPCs).
import { startRace } from './race.js?v=7.5.1';

const NAMES = ['Nix Calder', 'Tamsin Vey', 'Big Oyelaran', 'Juno Park', 'Rustbucket Ray', 'Kira Sol', 'Dex Marlow', 'Fen Oduya', 'Bo Okafor', 'Sister Volt', 'Lalo Brandt', 'Marisol Quan'];
const LINES = ['"Nice paint. Shame about the driver."', '"You lost, tourist? Meet’s for real cars."', '"Quarter mile. Loser buys the drinks and the tow."', '"I’ve seen faster ore haulers."', '"Line up or shut up."', '"My grandma’s hab heater has more horsepower."'];
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const KINDS = ['dust_runner', 'red_comet', 'ares_brute', 'olympus_gt', 'phobos_phantom', 'buggy'];

export function createMeet(D) {
  const { THREE, GC } = D;
  let lotG = null, crowd = null, spawned = null, drag = null, cheer = 0, flashes = [], expo = null, orbit = 0, dragClassT = 0;
  const C = () => D.ctx();
  const S = () => D.spots();
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const now = () => Date.now();
  const meetOn = () => GC.isMeetHour(GC.colonyHour(now(), D.garage().clock));
  const curMeet = () => GC.meetId(now(), D.garage().clock);

  function buildLot() {
    const a = D.assets(), s = S(), root = D.root();
    lotG = new THREE.Group(); lotG.position.set(s.meet.x, D.H(s.meet.x, s.meet.z), s.meet.z); root.add(lotG);
    lotG.add(D.put(a.box, a.mConc, 40, 0.3, 26, 0, -0.06, 0));
    for (const sx of [-1, 1]) { lotG.add(D.put(a.box, a.mSteel, 0.4, 6.5, 0.4, sx * 7, 3.25, 13)); lotG.add(D.put(a.box, a.mSteel, 0.3, 9, 0.3, sx * 19, 4.5, -10)); lotG.add(D.put(a.box, a.mFlood, 1.2, 0.35, 0.6, sx * 19, 9, -9.5)); lotG.add(D.put(a.disc, a.mPool, 9, 1, 9, sx * 12, 0.13, -4)); }
    lotG.add(D.put(a.box, a.mDark, 14.4, 0.6, 0.5, 0, 6.5, 13));
    const sign = D.signMesh('CAR MEET · 21:00–03:00', 0xff2ad0, 13, 1.8); sign.position.set(0, 7.9, 13); lotG.add(sign);
    const st = D.signMesh('DRAG STRIP · ¼ MILE ↓', 0x38e1ff, 8, 1); st.position.set(0, 4.8, 13.05); lotG.add(st);
    // cone rows at the start and finish (the race gates themselves come from race.js during a drag)
    const cone = new THREE.ConeGeometry(0.28, 0.75, 8); cone.userData.shared = true; const cm = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    for (const p of [s.stripFrom, s.stripTo]) for (const sx of [-8, -6, 6, 8]) { const c = new THREE.Mesh(cone, cm); c.position.set(p.x + sx, D.H(p.x + sx, p.z) + 0.37, p.z); root.add(c); }
  }
  function reset() { despawn(); lotG = null; drag = null; restoreExposure(); }

  // ---------- NPCs ----------
  function spawn(id) {
    const r = rng(id * 7919 + 13), s = S(), mobile = D.isMobile, nCars = mobile ? 8 : 10, nPeople = mobile ? 3 : 4, G = D.garage();
    spawned = { id, cars: [], people: [], t: 0 };
    const names = NAMES.slice().sort(() => r() - 0.5);
    for (let i = 0; i < nCars; i++) {
      const kind = KINDS[Math.floor(r() * (G.rep >= 60 ? KINDS.length : KINDS.length - 1))];
      const tier = GC.MODELS[kind]?.tier || 1, ride = GC.newRide('npc' + i, kind), lvMax = Math.min(3, 1 + Math.floor(G.rep / 60) + (r() < 0.3 ? 1 : 0));
      for (const k of Object.keys(ride.up)) ride.up[k] = Math.floor(r() * (lvMax + 1));
      ride.paint = Object.keys(GC.PAINTS)[Math.floor(r() * 8)]; ride.kit = Object.keys(GC.KITS)[Math.floor(r() * 4)]; ride.wheels = Object.keys(GC.WHEELS)[Math.floor(r() * 5)]; ride.glow = Object.keys(GC.GLOWS)[1 + Math.floor(r() * 5)];
      let v = null; try { v = D.buildVehicle(kind); } catch (e) { v = null; } if (!v) continue;
      if (kind in GC.MODELS) D.decorate(v, ride); else D.decorate(v, { ...ride, paint: 'factory', kit: 'stock' }, { paint: false });
      // two rows facing the centre aisle
      const row = i % 2, k = Math.floor(i / 2), x = (k - (Math.ceil(nCars / 2) - 1) / 2) * 6.2, z = row ? 7 : -7, yaw = row ? 0 : Math.PI;
      const tx = s.meet.x + x, tz = s.meet.z + z, from = { x: s.stripFrom.x + (row ? 4 : -4), z: s.stripFrom.z - 40 - k * 14 };
      v.group.position.set(from.x, D.H(from.x, from.z), from.z); D.root().add(v.group);
      const spec = D.specOf(ride), skill = 0.95 + r() * 0.16;
      spawned.cars.push({ v, kind, ride, tier, spec, skill, name: names[i % names.length], line: LINES[Math.floor(r() * LINES.length)], x: tx, z: tz, yaw, from, delay: i * 0.7, at: 0, done: false });
    }
    const body = new THREE.CapsuleGeometry(0.3, 0.9, 3, 8), headG = new THREE.SphereGeometry(0.24, 10, 8); body.userData.shared = headG.userData.shared = true;
    for (let i = 0; i < nPeople; i++) {
      const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: [0x8a3a2a, 0x3a4a6a, 0x5a5a3a, 0x6a2a5a][i % 4], roughness: 0.8 });
      const b = new THREE.Mesh(body, m); b.position.y = 0.75; g.add(b); const h = new THREE.Mesh(headG, new THREE.MeshStandardMaterial({ color: 0xc8a888 })); h.position.y = 1.55; g.add(h);
      const x = s.meet.x + (i - (nPeople - 1) / 2) * 4.5 + (r() - 0.5), z = s.meet.z + (r() - 0.5) * 3;
      g.position.set(x, D.H(x, z), z); g.rotation.y = r() * 6.28; D.root().add(g); spawned.people.push({ g, ph: r() * 6, y0: g.position.y });
    }
  }
  function despawn() {
    if (!spawned) return;
    for (const c of spawned.cars) { c.v.group.parent?.remove(c.v.group); c.v.group.traverse(o => { if (o.isMesh && !o.material.userData?.shared) o.material.dispose?.(); }); }
    for (const p of spawned.people) p.g.parent?.remove(p.g);
    for (const f of flashes) f.m.parent?.remove(f.m); flashes = [];
    spawned = null;
  }
  const npcCount = () => spawned ? spawned.cars.length + spawned.people.length : 0;

  function tick(dt, me) {
    const c = C(); if (!lotG) return;
    const s = S(), on = meetOn(), dMeet = dist(me, s.meet);
    if (on && dMeet < 320 && (!spawned || spawned.id !== curMeet()) && !drag) { despawn(); spawn(curMeet()); }
    else if (spawned && !drag && (!on || dMeet > 420)) despawn();
    if (spawned) {
      spawned.t += dt;
      for (const car of spawned.cars) {
        if (!car.done) { // roll in from the strip, staggered
          const k = Math.max(0, Math.min(1, (spawned.t - car.delay) / 6)), e = 1 - Math.pow(1 - k, 3);
          const x = car.from.x + (car.x - car.from.x) * e, z = car.from.z + (car.z - car.from.z) * e, yaw = k < 0.85 ? Math.atan2(-(car.x - car.from.x), -(car.z - car.from.z)) : car.yaw;
          car.v.group.position.set(x, D.H(x, z) + (car.spec.hover || 0) * 0.6, z); car.v.group.rotation.y += (yaw - car.v.group.rotation.y) * Math.min(1, dt * 4);
          for (const w of car.v.wheels || []) w.spin.rotation.x -= (k < 1 ? 8 : 0) * dt;
          if (k >= 1) { car.done = true; car.v.group.rotation.y = car.yaw; }
        }
      }
      for (const p of spawned.people) { p.ph += dt * (cheer > 0 ? 9 : 1.5); p.g.position.y = p.y0 + (cheer > 0 ? Math.abs(Math.sin(p.ph)) * 0.6 : Math.sin(p.ph) * 0.03); }
      cheer = Math.max(0, cheer - dt);
    }
    // camera flashes
    for (const f of flashes) { f.t -= dt; f.m.material.opacity = Math.max(0, f.t * 3); } flashes = flashes.filter(f => { if (f.t > 0) return true; f.m.parent?.remove(f.m); f.m.material.dispose(); return false; });
    // show-off orbit cam
    if (orbit > 0 && c.car) { orbit -= dt; const a = orbit * 0.9; c.camera.position.set(c.car.x + Math.sin(a) * 9, c.car.y + 3.2, c.car.z + Math.cos(a) * 9); c.camera.lookAt(c.car.x, c.car.y + 0.8, c.car.z); }
    // night: the lot runs darker under the floodlights while the meet is on
    const want = on && dMeet < 160 ? 0.62 : null; const R = D.app()?.renderer;
    if (R) { if (want != null) { if (expo == null) expo = R.toneMappingExposure; R.toneMappingExposure += (want - R.toneMappingExposure) * Math.min(1, dt * 2); } else if (expo != null) { R.toneMappingExposure += (expo - R.toneMappingExposure) * Math.min(1, dt * 3); if (Math.abs(R.toneMappingExposure - expo) < 0.01) restoreExposure(); } }
    // drag race bookkeeping (race.js runs the race itself)
    if (drag && !window.__race?.state && performance.now() - drag.t0 > 400) settle();
    if (dragClassT > 0 && (dragClassT -= dt) <= 0) document.body.classList.remove('ssx-drag');
  }
  function restoreExposure() { const R = D.app()?.renderer; if (R && expo != null) R.toneMappingExposure = expo; expo = null; }

  function ctxAction(me) {
    if (!spawned || drag) return null; const c = C(), s = S();
    if (dist(me, s.meet) > 34) return null;
    let best = null, bd = c.car ? 9 : 7;
    for (const car of spawned.cars) { if (!car.done) continue; const d = Math.hypot(car.v.group.position.x - me.x, car.v.group.position.z - me.z); if (d < bd) { bd = d; best = car; } }
    if (best) return { label: `🏁 Race ${best.name.split(' ')[0]}`, act: () => openChallenge(best) };
    if (c.car && c.car === c.rover) return { label: '📸 Show off', act: () => showOffNow() };
    return null;
  }
  function showOffNow() {
    const G = D.garage(), ride = D.activeRide(), r = GC.showOff(G, ride, D.tierOf(ride), curMeet()); D.save();
    if (r.repeat) { D.toast('📸 They’ve seen this one tonight. Bring something else, or come back tomorrow night.', 3000); return r; }
    cheer = 2.2; orbit = 3.2; const c = C();
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const a = Math.random() * 6.28; m.position.set(c.car.x + Math.sin(a) * 5, c.car.y + 1.5 + Math.random(), c.car.z + Math.cos(a) * 5); m.lookAt(c.camera.position); D.root().add(m); flashes.push({ m, t: 0.25 + i * 0.12 }); }
    D.toast(`📸 The crowd loses it over your ${D.rideName(ride)}. +${r.rep} rep · ${Math.round(G.rep)} (${GC.repTitle(G.rep)})`, 3400);
    return r;
  }

  // ---------- challenge sheet + drag race ----------
  let pick = { car: null, w: 50 };
  function openChallenge(car) {
    pick.car = car; if (pick.w > D.credits()) pick.w = 0;
    D.openSheet('challenge', renderChallenge, () => car.v.group);
  }
  function renderChallenge() {
    const car = pick.car, mine = D.activeRide(), ms = D.specOf(mine), est = GC.dragTime(car.spec) * car.skill, my = GC.dragTime(ms);
    const ws = [0, 50, 100, 250, 500];
    return `<button class="close" data-close="1">✕</button><h3>🏁 ${D.esc(car.name)}</h3><div class="sub">💰 ${D.credits()} cr · ⭐ ${Math.round(D.garage().rep)} rep</div>
      <div class="blurb">${D.esc(car.line)}</div>
      <div>Their ride: <b>${D.esc(D.rideName(car.ride))}</b> · PI ${GC.perfIndex(car.spec)} · ~${est.toFixed(1)} s</div>
      <div>Your ride: <b>${D.esc(D.rideName(mine))}</b> · PI ${GC.perfIndex(ms)} · ~${my.toFixed(1)} s flat out</div>
      <div class="sub">Quarter mile down the south strip. Hold ⚡ Boost the whole way. Your wager is matched. Win and the purse pays both stakes + 30 cr. Usual ${GC_BUYIN} cr buy-in at GO.</div>
      <div class="row">${ws.map(w => `<button data-wager="${w}" class="${pick.w === w ? 'on' : ''}" ${w > D.credits() ? 'disabled' : ''}>${w ? '💰 ' + w : 'No bet'}</button>`).join('')}</div>
      <div class="row"><button class="go" data-drag="1">🏁 Line up</button></div>`;
  }
  const GC_BUYIN = 20;
  D.handlers = null;
  function onTap(key, val) {
    if (key === 'wager') { pick.w = +val; return true; }
    if (key === 'drag') { const r = startDrag(pick.car, pick.w); D.toast(r.msg, 3000); return 'close'; }
    return false;
  }
  function startDrag(car, wager = 0) {
    const c = C(); if (!car || !spawned) return { ok: false, msg: 'No one to race.' };
    if (drag || window.__race?.state) return { ok: false, msg: 'Already racing.' };
    if (c.car && c.car !== c.rover) return { ok: false, msg: '🚫 Not in a stolen ride. Bring your own.' };
    if (wager > 0 && !D.spend(wager)) return { ok: false, msg: `💸 You don’t have ${wager} cr.` };
    const cfg = D.cfg(), s = S();
    const def = { id: 'meet-drag', world: cfg.world, name: `Drag · ${car.name}`, loop: false, laps: 1, anchor: cfg.anchor, gates: [cfg.strip.from, cfg.strip.to],
      rival: { name: car.name, kind: car.kind }, par: Math.max(4, GC.dragTime(car.spec) * car.skill - 1.0), purse: wager * 2 + 30, props: [], blurb: 'Quarter mile.' };
    const r = startRace(def);
    if (!r.ok) { if (wager) { const P = D.app()?.game?.progress; if (P) P.credits += wager; } D.save(); return { ok: false, msg: `🚫 ${r.why}` }; }
    D.save(); car.v.group.visible = false; drag = { car, wager, t0: performance.now() }; document.body.classList.add('ssx-drag'); dragClassT = 0;
    return { ok: true, msg: `🏁 ${car.name} rolls up beside you. ${wager ? `${wager} cr each on the line. ` : ''}Hold Boost on GO.` };
  }
  function settle() {
    const d = drag; drag = null; d.car.v.group.visible = true; const res = window.__race?.result, G = D.garage();
    if (!res || res.id !== 'meet-drag') { dragClassT = 0.1; return; }
    G.races++; const won = !!res.won; if (won) G.wins++;
    const rep = GC.dragRep(won, d.wager, d.car.tier); G.rep += rep; D.save(); dragClassT = 13;
    D.toast(won ? `🏆 You smoked ${d.car.name}. ${d.wager ? `Wager +${d.wager * 2} cr in the purse. ` : ''}+${rep} rep.` : `🥈 ${d.car.name} takes it${d.wager ? ` and your ${d.wager} cr` : ''}. +${rep} rep for showing up.`, 3600);
    lastDrag = { won, wager: d.wager, rep, name: d.car.name, credits: res.credits, time: res.time, rivalTime: res.rivalTime };
  }
  let lastDrag = null;
  return { buildLot, reset, tick, ctxAction, onTap, onSheetClosed() {},
    debug: { get on() { return meetOn(); }, get spawned() { return spawned ? { id: spawned.id, cars: spawned.cars.length, people: spawned.people.length, arrived: spawned.cars.filter(c => c.done).length } : null; }, npcCount,
      cars: () => spawned ? spawned.cars.map(c => ({ name: c.name, kind: c.kind, x: c.x, z: c.z, done: c.done, pi: GC.perfIndex(c.spec) })) : [], arriveAll() { if (spawned) spawned.t = 999; },
      showOff: () => showOffNow(), startDrag: (i, w) => startDrag(spawned?.cars[i], w), openChallenge: i => openChallenge(spawned.cars[i]), get drag() { return drag ? { name: drag.car.name, wager: drag.wager } : null; }, get last() { return lastDrag; } } };
}
