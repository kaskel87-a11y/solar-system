// v7.6 Velvet Airlock: a private dance from ANY of the stage dancers (Danny keeps her own show in privateshow.js).
// Walk up to the stage in front of Rhea Nebula or Kiara Quasar: the action button reads 'Private dance' (black button,
// white text; E on desktop). Pay, and she takes you up to the same sealed VIP booth Danny uses, for one short song.
// Same house rules as Danny's show: adults only, GTA-style suggestive but non-explicit, outfits stay on, no nudity,
// no contact. Tips buy extra time; touching her gets you thrown out by Tiny.
// Hooks (both guarded, so a failure here never breaks the club): interiors.js calls addDancerSpots(api, ...) while
// building the club; index.html calls clubPrivate(...) once and routes the 'privdance' hotspot to cp.offer(spot).
import * as THREE from 'three';
import { spawn } from './clubdancers.js';

export const PRICE = 120, TIP = 20, TIP_SEC = 6, SONG_SEC = 28;
// original fictional stage names (adult performers in a fictional Mars club)
export const GIRLS = {
  rhea: { name: 'Rhea Nebula', rim: 0x8a60ff, sign: '#e6dcff',
    offer: '“One song, my booth, my rules. Outfit stays on, your hands stay on the chair.”',
    open: ['Sit back, stargazer. Tonight you only get to look at one.', 'Hands on the armrests. I’ll know if they wander.'],
    mid: ['You’re staring. Good. That’s the job.', 'Slow down, spacer. The song isn’t going anywhere.', 'Gravity’s lower up here. Your jaw still dropped.'],
    tip: ['Mm. That bought you another chorus.', 'Generous. I like generous.'],
    end: 'The song fades. Rhea waves from the doorway. “Come find me under the lights.”' },
  kiara: { name: 'Kiara Quasar', rim: 0x30e0d0, sign: '#d6fff8',
    offer: '“You picked me. Smart. One song upstairs: you look, I lead, nobody touches.”',
    open: ['You picked me. Smart choice. Now sit still.', 'Rule of the booth, cowboy: you look, I lead.'],
    mid: ['Don’t blink. You’ll miss the good part.', 'Red hair, red lights, red face. You match.', 'Careful. People fall in love up here.'],
    tip: ['Now we’re talking. Keep the meter running.', 'Big spender. Another verse it is.'],
    end: 'The lights come up. Kiara pulls her jacket on and winks. “Same booth next time, spacer.”' },
};
const first = n => n.split(' ')[0];
const pick = a => a[Math.floor(Math.random() * a.length)];
const booths = new Set();

// interiors.js (club build): one hotspot on the stage edge in front of each non-Danny dancer; booth = privateshow's addBooth() result
export function addDancerSpots(api, { booth = null, dancers = [] } = {}) {
  if (booth) booths.add(booth);
  for (const d of dancers) {
    const G = GIRLS[d.id]; if (!G) continue; // Danny (or any unknown dancer) gets no spot here
    api.spot({ id: 'privdance:' + d.id, x: d.x, z: d.z, r: d.r || 0.95, label: `💃 Private dance · ${first(G.name)} ${PRICE}`, act: 'privdance', who: G.name });
  }
}

const CSS = `
body.cpNear #driveBtn{background:#000!important;color:#fff!important;border:1.5px solid #fff!important}
#cpOffer{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6)}
#cpOffer .w{max-width:340px;margin:16px;padding:16px;border-radius:14px;background:#000;color:#fff;border:1px solid #fff;font:14px/1.4 system-ui,sans-serif}
#cpOffer h3{margin:0 0 6px;font-size:17px} #cpOffer .r{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.cpBtn{flex:1;min-height:46px;border-radius:10px;border:1.5px solid #fff;background:#000;color:#fff;font:600 15px system-ui,sans-serif;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.cpBtn:active{background:#fff;color:#000}
#cpShow{position:fixed;left:0;right:0;bottom:0;z-index:54;display:none;flex-direction:column;align-items:center;gap:8px;padding:0 12px calc(12px + env(safe-area-inset-bottom));pointer-events:none}
#cpShow .cap{max-width:560px;min-height:2.8em;padding:6px 12px;border-radius:8px;background:rgba(0,0,0,.72);color:#fff;font:italic 15px/1.4 system-ui,sans-serif;text-align:center;text-shadow:0 1px 2px #000}
#cpShow .cap:empty{visibility:hidden} #cpShow .r{display:flex;gap:8px;width:100%;max-width:420px;pointer-events:auto} #cpShow .hint{color:#bbb;font:11px system-ui,sans-serif}
body.touch #cpShow .hint{display:none}
`;
// opts: { surface, toast, onTap, fx, hud }
export function clubPrivate({ surface, toast = () => {}, onTap = (el, fn) => el.addEventListener('click', fn), fx = {}, hud = () => {} } = {}) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const offerEl = document.createElement('div'); offerEl.id = 'cpOffer'; offerEl.setAttribute('role', 'dialog');
  offerEl.innerHTML = `<div class="w"><h3 id="cpName"></h3><div id="cpPitch"></div><div class="r"><button class="cpBtn" id="cpYes">Private dance · ${PRICE} cr</button><button class="cpBtn" id="cpNo">Not now</button></div></div>`;
  const ui = document.createElement('div'); ui.id = 'cpShow';
  ui.innerHTML = `<div class="cap" id="cpCap"></div><div class="r"><button class="cpBtn" id="cpTip">💸 Tip ${TIP}</button><button class="cpBtn" id="cpTouch">✋ Touch</button><button class="cpBtn" id="cpLeave">Leave</button></div><div class="hint">T tip · E touch · Esc leave</div>`;
  document.body.append(offerEl, ui);
  const $ = id => document.getElementById(id), cap = $('cpCap'), fade = () => document.getElementById('fadeBlack');
  let S = null, capT = 0, unreg = null, pending = null;
  const say = (msg, sec = 3.6) => { cap.textContent = msg; capT = sec; };
  const line = (G, a) => first(G.name) + ': ' + (Array.isArray(a) ? pick(a) : a);
  const dannyBusy = () => !!window.__pshow?.active;

  // the black/white prompt: style the action button while the nearest hotspot is a private dance
  const near = () => { try { const sp = surface.info?.spot; document.body.classList.toggle('cpNear', !S && sp?.act === 'privdance'); } catch (e) {} };
  surface.registerTick?.(near);

  function offer(spot) {
    if (S || dannyBusy()) return; const id = String(spot?.id || '').split(':')[1], G = GIRLS[id]; if (!G) return;
    if (document.pointerLockElement) document.exitPointerLock();
    pending = id; $('cpName').textContent = '💃 ' + G.name; $('cpPitch').textContent = G.offer; offerEl.style.display = 'flex';
  }
  onTap($('cpNo'), () => { offerEl.style.display = 'none'; const G = GIRLS[pending]; if (G) toast(line(G, 'Your loss, sugar.'), 2000); pending = null; });
  onTap($('cpYes'), () => buy());
  function buy(id = pending) {
    offerEl.style.display = 'none'; pending = null; const G = GIRLS[id]; if (!G || S || dannyBusy()) return false;
    if (!boothNow()) { toast(line(G, 'The booth’s being cleaned. Rain check.'), 2400); return false; } // check before taking the money
    if (!surface.game.spend(PRICE)) { toast(line(G, `A song is ${PRICE}. Come back when you’re liquid.`), 2600); fx.dry?.(); return false; }
    fx.cash?.(); hud(); return start(id);
  }
  onTap($('cpTip'), () => tip()); onTap($('cpTouch'), () => touch()); onTap($('cpLeave'), () => end('leave'));
  window.addEventListener('keydown', e => {
    if (!S) return;
    if (e.code.startsWith('Key') || e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'KeyT') tip(); else if (e.code === 'KeyE') touch(); else if (e.code === 'Escape') end('leave');
  }, true);

  function boothNow() { for (const b of booths) { if (!b.g.parent) { booths.delete(b); continue; } let o = b.g.parent, vis = true; while (o) { if (!o.visible) { vis = false; break; } o = o.parent; } if (vis) return b; } return null; }
  // her name on the booth's back wall (Danny's own sign is hidden for the song, then put back)
  function signFor(G) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    x.font = 'italic bold 56px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#' + G.rim.toString(16).padStart(6, '0'); x.shadowBlur = 18; x.fillStyle = G.sign; x.fillText(first(G.name), 256, 48);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    return m;
  }

  function start(id) {
    const G = GIRLS[id], b = boothNow(); if (!G || !b) return false;
    const h = spawn({ dancer: id, outfit: 'bikini', look: { key: [0.35, 0.8, 1.0], keyCol: 0xffeee4, keyInt: 2.1, rim: [-0.3, 0.4, -1.0], rimCol: G.rim, rimInt: 1.25, fill: 0xd0d4e8, fillInt: 0.45, scene: 0.12 } });
    h.group.position.set(0, 0, 0.1); b.g.add(h.group);
    const dSign = b.g.children.find(c => c.isMesh && c.geometry?.parameters?.width === 1.6 && c.geometry?.parameters?.height === 0.3) || null;
    const sign = signFor(G); sign.position.set(0, 2.2, -b.D / 2 + 0.05); sign.visible = false; b.g.add(sign);
    S = { id, G, b, h, t: 0, left: SONG_SEC, tips: 0, shot: 0, shotT: 0, z: 0.1, hidden: [], ending: false, fovSaved: null, pl: null, ln: 0, sign, dSign, on: false };
    h.ready.then(() => { if (S?.h === h) h.play(/salsa/i, 0); });
    document.body.classList.remove('cpNear');
    const f = fade(); f.textContent = ''; f.classList.add('on');
    setTimeout(() => { if (!S || S.h !== h) return; b.g.visible = true; S.on = true; if (dSign) dSign.visible = false; sign.visible = true;
      for (const c of b.api.g.children) if (c !== b.g && c.visible) { c.visible = false; S.hidden.push(c); }
      let root = b.g; while (root.parent) root = root.parent; // sealed booth: hide the street too (lights stay on), like Danny's show
      const path = new Set(); for (let o = b.g; o; o = o.parent) path.add(o);
      const hideOut = n => { for (const c of n.children) { if (c === b.g || !c.visible || c.isLight) continue;
        let lit = false; c.traverse(x => { if (x.isLight) lit = true; });
        if (path.has(c) || lit) hideOut(c); else { c.visible = false; S.hidden.push(c); } } };
      hideOut(root);
      document.body.classList.add('pshow', 'cinebars', 'cpshow'); ui.style.display = 'flex'; say(line(G, G.open), 4); f.classList.remove('on'); }, 650);
    unreg = surface.registerTick?.(tick) || null;
    return true;
  }

  // routine: [seconds, clip, distance from the chair front, arms on hips] (the same moves Danny's show uses)
  const ROUTINE = [[6, /salsa/i, 1.15, false], [5, /modern/i, 1.25, false], [6, /salsa/i, 0.9, false], [4, /idle/i, 1.0, true], [6, /modern/i, 1.05, false]];
  const routineAt = t => { const tot = ROUTINE.reduce((a, r) => a + r[0], 0); let u = t % tot; for (const r of ROUTINE) { if (u < r[0]) return r; u -= r[0]; } return ROUTINE[0]; };
  const _p = new THREE.Vector3(), _l = new THREE.Vector3();
  function tick(dt, ctx) {
    if (!S) return;
    if (!(ctx.world || surface.world)?.inside) { stop(); return; } // left the club some other way
    const { b, h, G } = S; S.t += dt;
    if (!S.pl) S.pl = { x: ctx.player.x, z: ctx.player.z };
    ctx.player.x = S.pl.x; ctx.player.z = S.pl.z; ctx.player.vy = 0; // seated
    for (const c of S.hidden) c.visible = false;
    for (const o of [...b.chair, b.player.group]) o.visible = true;
    if (S.on && S.dSign) S.dSign.visible = false;
    if (!S.ending) { S.left -= dt; if (S.left <= 0) end('song'); }
    const r = routineAt(S.t); h.play(r[1], 0.5); h.armsIdle(r[3]);
    const goal = b.seat.z - 0.45 - r[2]; S.z += (goal - S.z) * Math.min(1, dt * 0.8);
    h.group.position.set(Math.sin(S.t * 0.5) * 0.12, 0, S.z); h.group.rotation.y = Math.PI + Math.sin(S.t * 0.35) * 0.35;
    h.update(dt);
    if ((capT -= dt) <= 0 && !S.ending && S.t - S.ln > 7) { S.ln = S.t; say(line(G, G.mid), 4); } if (capT <= 0 && S.t - S.ln > 4.5) cap.textContent = '';
    const cam = ctx.camera; if (S.fovSaved == null) { S.fovSaved = cam.fov; S.cam = cam; }
    const portrait = innerWidth < innerHeight;
    if ((S.shotT -= dt) <= 0) { S.shot = (S.shot + 1) % 4; S.shotT = S.shot === 0 || S.shot === 2 ? 8 : 5; }
    const u = 1 - S.shotT / (S.shot === 0 || S.shot === 2 ? 8 : 5), hz = h.group.position.z, hx = h.group.position.x;
    if (S.shot === 0 || S.shot === 2) { _p.set(Math.sin(S.t * 0.4) * 0.03, 1.12, b.seat.z + 0.08); _l.set(hx * 0.6, 1.0 + Math.sin(S.t * 0.5) * 0.08, hz); cam.fov = portrait ? 72 : 52; } // seated POV
    else if (S.shot === 1) { _p.set(1.55 - u * 0.25, 1.5, b.seat.z + 0.15); _l.set(hx, 1.05, hz); cam.fov = portrait ? 66 : 46; } // over the shoulder
    else { _p.set(-1.3 + u * 0.3, 0.75, hz + 1.0); _l.set(hx, 1.15, hz); cam.fov = portrait ? 70 : 50; } // low side angle
    S.camLocal = _p.clone(); b.g.localToWorld(_p); b.g.localToWorld(_l); cam.position.copy(_p); cam.lookAt(_l); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  function tip() {
    if (!S || S.ending) return false;
    if (!surface.game.spend(TIP)) { say(line(S.G, `Tips are ${TIP}, sugar. Your wallet says no.`)); fx.dry?.(); return false; }
    fx.cash?.(); S.tips++; S.left += TIP_SEC; hud(); say(line(S.G, S.G.tip)); return true;
  }
  function touch() {
    if (!S || S.ending) return; S.ending = true; S.h.play(/idle/i, 0.35); S.h.armsIdle(true);
    say(line(S.G, 'Ah-ah.'), 1.2); setTimeout(() => say('TINY: That’s the one rule, genius.', 2), 900);
    setTimeout(() => { const f = fade(); f.textContent = ''; f.classList.add('on'); setTimeout(() => { f.textContent = 'Tiny carries you down the back stairs and drops you on the street. Your pride stays upstairs.'; }, 600); }, 2000);
    setTimeout(() => { stop(); surface.leaveBuilding?.(); }, 4200);
    setTimeout(() => { fade().classList.remove('on'); hud(); }, 6200);
  }
  function end(why) {
    if (!S || S.ending) return; S.ending = true; const G = S.G;
    const f = fade(); f.textContent = ''; f.classList.add('on');
    setTimeout(() => { f.textContent = why === 'leave' ? `You thank ${first(G.name)} and head back downstairs.` : G.end; }, 650);
    setTimeout(() => { stop(); f.classList.remove('on'); hud(); }, why === 'leave' ? 2000 : 3400);
  }
  function stop() {
    if (!S) return; const { b, h, sign, dSign } = S;
    unreg?.(); unreg = null;
    for (const c of S.hidden) c.visible = true; b.g.visible = false;
    b.g.remove(sign); sign.geometry.dispose(); sign.material.map?.dispose(); sign.material.dispose(); if (dSign) dSign.visible = true;
    if (S.cam) { S.cam.fov = S.fovSaved; S.cam.updateProjectionMatrix(); }
    h.release(); b.g.remove(h.group);
    document.body.classList.remove('pshow', 'cinebars', 'cpshow'); ui.style.display = 'none'; cap.textContent = '';
    S = null;
  }
  const api = { offer, buy, start, tip, touch, end, girls: GIRLS, price: PRICE,
    get active() { return !!S; },
    get state() { return S ? { id: S.id, name: S.G.name, t: S.t, left: S.left, tips: S.tips, shot: S.shot, ready: !!S.h.md, signName: S.on && S.sign.visible, dannySignHidden: !!S.dSign && !S.dSign.visible,
      camInBooth: !!S.camLocal && Math.abs(S.camLocal.x) < S.b.W / 2 && Math.abs(S.camLocal.z) < S.b.D / 2 + 0.6 && S.camLocal.y > 0 && S.camLocal.y < S.b.H } : null } };
  window.__cprivate = api; // tests / modding
  queueMicrotask(() => { if (window.SSX) window.SSX.clubPrivate = api; });
  return api;
}
