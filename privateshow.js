// v7.5.4 Velvet Airlock: Danny Nova's private show in the upstairs VIP booth (adults only).
// GTA-style and non-explicit: her costume stays on, there is no nudity, no sexual act and no contact. The player sits,
// she dances a short teasing routine (CMU mocap: salsa sway 61_05, modern dance 05_12) and the camera does the rest.
// Tips buy extra time and, after enough of them, her (fictional) number. Touching her gets you thrown out by Tiny.
// Hooks: interiors.js calls addBooth(api, ...) while building the club; index.html calls privateShow(...) once and
// routes the 'show' hotspot to show.offer(spot). Phone buttons use window.__onTap (one finger per button on iOS).
import * as THREE from 'three';
import { spawn, DANNY_NAME } from './clubdancers.js';
const DF = DANNY_NAME.split(' ')[0]; // first name for captions; the full display name lives in clubdancers.js (DANNY_NAME)

export const SHOW_PRICE = 150, LAP_PRICE = 250, TIP = 20, TIPS_FOR_NUMBER = 3, SHOW_SEC = 34, LAP_SEC = 26, TIP_SEC = 6;
const NUMBER = '555-0142'; // 555-01xx: reserved for fiction
const booths = new Set();

// ---------- the booth: a sealed little room right above the club ceiling, so nobody downstairs ever sees it ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function addBooth(api, { x = 0, z = 0, sit = null } = {}) {
  const g = new THREE.Group(); g.position.set(x, api.h + 0.4, z); g.visible = false; api.g.add(g);
  const W = 3.6, D = 4.0, H = 2.8, own = [];
  const keep = o => (own.push(o), o);
  // walls + floor + ceiling: one inside-out box, tufted velvet walls painted in a canvas (one draw call)
  const wallT = keep(canvasTex(128, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#12040c'); gr.addColorStop(0.55, '#3a0a22'); gr.addColorStop(1, '#170610');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let y = 18; y < h; y += 32) for (let xx = (y / 32 | 0) % 2 ? 16 : 0; xx <= w; xx += 32) { // diamond tufting
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(xx, y, 3, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,120,190,0.08)'; c.beginPath(); c.moveTo(xx - 16, y - 16); c.lineTo(xx, y); c.lineTo(xx + 16, y - 16); c.stroke(); }
    c.fillStyle = '#ff3cc8'; c.fillRect(0, h - 10, w, 3); c.fillStyle = '#ffd040'; c.fillRect(0, 22, w, 2);
  }));
  wallT.wrapS = wallT.wrapT = THREE.RepeatWrapping; wallT.repeat.set(4, 1);
  const room = new THREE.Mesh(keep(new THREE.BoxGeometry(W, H, D)), keep(new THREE.MeshBasicMaterial({ map: wallT, side: THREE.BackSide })));
  room.position.y = H / 2; g.add(room);
  const floorT = keep(canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#0c0a10'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,208,64,0.25)'; c.lineWidth = 2; c.strokeRect(10, 10, w - 20, h - 20);
    const r = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,60,200,0.22)'); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); }));
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(W - 0.02, D - 0.02)), keep(new THREE.MeshBasicMaterial({ map: floorT })));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; g.add(floor);
  const box = keep(new THREE.BoxGeometry(1, 1, 1)), velvet = keep(new THREE.MeshBasicMaterial({ color: 0x4a0c2a })), gold = keep(new THREE.MeshBasicMaterial({ color: 0xffd040 })), neon = keep(new THREE.MeshBasicMaterial({ color: 0xff3cc8 }));
  const add = (m, px, py, pz, sx, sy, sz) => { const o = new THREE.Mesh(box, m); o.position.set(px, py, pz); o.scale.set(sx, sy, sz); g.add(o); return o; };
  // the club chair (player sits here facing -z), a neon strip behind her, a little gold side table
  const chair = [add(velvet, 0, 0.22, 1.35, 0.9, 0.44, 0.8), add(velvet, 0, 0.75, 1.72, 0.9, 0.7, 0.14),
    add(velvet, -0.5, 0.52, 1.35, 0.12, 0.2, 0.75), add(velvet, 0.5, 0.52, 1.35, 0.12, 0.2, 0.75)];
  add(neon, 0, 1.9, -D / 2 + 0.03, 2.6, 0.04, 0.02); add(neon, 0, 0.08, -D / 2 + 0.03, 2.6, 0.03, 0.02);
  add(gold, 1.2, 0.5, 1.3, 0.36, 0.03, 0.36); add(gold, 1.2, 0.25, 1.3, 0.04, 0.5, 0.04);
  // a sign on the back wall
  const signT = keep(canvasTex(512, 96, (c, w, h) => { c.font = 'italic bold 56px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#ff3cc8'; c.shadowBlur = 18; c.fillStyle = '#ffd6f0'; c.fillText(DF, w / 2, h / 2); }));
  const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.6, 0.3)), keep(new THREE.MeshBasicMaterial({ map: signT, transparent: true, depthWrite: false })));
  sign.position.set(0, 2.2, -D / 2 + 0.05); g.add(sign);
  // the seated player (blocky, like the rest of the club crowd)
  const p = api.person({ top: 0x16161e, bottom: 0x22222e, shoes: 0x0a0a0a, hair: 0x2a1a10, hairStyle: 'short', skin: 0xc89070 }, 0, 0, Math.PI, ph => { if (sit) sit(ph); });
  api.g.remove(p.group); p.group.position.set(0, 0.0, 1.32); p.group.rotation.y = Math.PI; g.add(p.group);
  const b = { api, g, W, D, H, seat: new THREE.Vector3(0, 0, 1.32), player: p, chair, own };
  booths.add(b); api.disposables?.push(...own);
  return b;
}

// ---------- the show ----------
const LINES = {
  open: [DF + ': Rule of the room, cowboy. You look, I lead.', DF + ': Sit back. Hands on the armrests. Good boy.', DF + ': You paid for a song. Let’s see if you can survive it.'],
  mid: [DF + ': Breathe. It’s only a song… mostly.', DF + ': Closer? Nah. The wanting is the whole show.', DF + ': I can tell when you’re thinking about it. Stop thinking.', DF + ': Every one of these tattoos has a story. You haven’t earned one yet.', DF + ': Eyes up here, spacer. …Okay, fine. Everywhere.', DF + ': You’re blushing. On Mars. That’s a first.'],
  tip: [DF + ': Ooh, generous. That bought you another verse.', DF + ': Now we’re talking. Keep the meter running.', DF + ': Big spender. I might start remembering your name.'],
  broke: [DF + ': Tips are twenty, sugar. Your wallet says no.'],
  number: DF + ' leans in, close but not touching: “Fine. You earned it.”',
  touch: [DF + ': Ah-ah.', 'TINY: That’s the one rule, genius.'],
  out: 'Tiny carries you down the back stairs and drops you on the street. Your pride stays upstairs.',
  lap: [DF + ': Hands on the armrests. I’ll know if they move.', DF + ': Close enough to feel the bass. Not close enough to touch.', DF + ': Look all you want. That’s the whole game.', DF + ': Don’t move. I’m working.', DF + ': You’re holding your breath. Cute.'],
  end: ['The song fades. ' + DF + ' blows you a kiss from the doorway. “Same booth next time, spacer.”', 'The lights come up. ' + DF + ' pulls her cover-up on and winks. “Don’t fall in love. It’s bad for business.”'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const CSS = `
#pshowOffer{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6)}
#pshowOffer .w{max-width:340px;margin:16px;padding:16px;border-radius:14px;background:#000;color:#fff;border:1px solid #fff;font:14px/1.4 system-ui,sans-serif}
#pshowOffer h3{margin:0 0 6px;font-size:17px} #pshowOffer .r{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px} #pshowOffer .r .pshowBtn{flex:1 1 40%}
.pshowBtn{flex:1;min-height:46px;border-radius:10px;border:1.5px solid #fff;background:#000;color:#fff;font:600 15px system-ui,sans-serif;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.pshowBtn.on,.pshowBtn:active{background:#fff;color:#000} .pshowBtn.alt{background:#fff;color:#000}
#pshow{position:fixed;left:0;right:0;bottom:0;z-index:54;display:none;flex-direction:column;align-items:center;gap:8px;padding:0 12px calc(12px + env(safe-area-inset-bottom));pointer-events:none}
#pshow .cap{max-width:560px;min-height:2.8em;padding:6px 12px;border-radius:8px;background:rgba(0,0,0,.72);color:#fff;font:italic 15px/1.4 system-ui,sans-serif;text-align:center;text-shadow:0 1px 2px #000}
#pshow .cap:empty{visibility:hidden} #pshow .r{display:flex;gap:8px;width:100%;max-width:420px;pointer-events:auto} #pshow .hint{color:#bbb;font:11px system-ui,sans-serif}
body.touch #pshow .hint{display:none}
body.pshow #surfHud,body.pshow #joy,body.pshow #toast,body.pshow #ssxDock{visibility:hidden!important}
`;
// opts: { surface, toast, onTap, fx, hud }
export function privateShow({ surface, toast = () => {}, onTap = (el, fn) => el.addEventListener('click', fn), fx = {}, hud = () => {} } = {}) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const offerEl = document.createElement('div'); offerEl.id = 'pshowOffer'; offerEl.setAttribute('role', 'dialog');
  offerEl.innerHTML = '<div class="w"><h3>💋 ' + DANNY_NAME + '</h3><div>“Private show, upstairs. One song, my booth, my rules: costume stays on, your hands stay on the chair.”</div><div class="r"><button class="pshowBtn alt" id="pshowYes">Private show · 150 cr</button><button class="pshowBtn alt" id="pshowLap">Lap dance · 250 cr</button><button class="pshowBtn" id="pshowNo">Not now</button></div></div>';
  const ui = document.createElement('div'); ui.id = 'pshow';
  ui.innerHTML = '<div class="cap" id="pshowCap"></div><div class="r"><button class="pshowBtn" id="pshowTip">💸 Tip 20</button><button class="pshowBtn" id="pshowTouch">✋ Touch</button><button class="pshowBtn" id="pshowLeave">Leave</button></div><div class="hint">T tip · E touch · Esc leave</div>';
  document.body.append(offerEl, ui);
  const $ = id => document.getElementById(id), cap = $('pshowCap'), fade = () => document.getElementById('fadeBlack');
  let S = null, capT = 0, unreg = null;
  const say = (msg, sec = 3.6) => { cap.textContent = msg; capT = sec; };
  const contacts = () => { try { return JSON.parse(localStorage.getItem('ssx.contacts') || '{}'); } catch (e) { return {}; } };
  const hasNumber = () => !!contacts()[DANNY_NAME];

  function offer(spot) {
    if (S) return; if (document.pointerLockElement) document.exitPointerLock();
    offerEl.style.display = 'flex';
  }
  onTap($('pshowNo'), () => { offerEl.style.display = 'none'; toast(DF + ': Your loss, sugar.', 2000); });
  const buy = (mode) => {
    offerEl.style.display = 'none'; const price = mode === 'lap' ? LAP_PRICE : SHOW_PRICE;
    if (!surface.game.spend(price)) { toast(DF + ': ' + (mode === 'lap' ? 'The chair dance is ' + LAP_PRICE : 'Upstairs is ' + SHOW_PRICE) + '. Come back when you’re liquid.', 2600); fx.dry?.(); return; }
    fx.cash?.(); hud(); start(mode);
  };
  onTap($('pshowYes'), () => buy('show')); onTap($('pshowLap'), () => buy('lap'));
  onTap($('pshowTip'), () => tip()); onTap($('pshowTouch'), () => touch()); onTap($('pshowLeave'), () => end('leave'));
  const onKey = e => {
    if (!S) return;
    if (e.code === 'KeyT' || e.code === 'KeyE' || e.code === 'Escape' || e.code.startsWith('Key') || e.code.startsWith('Arrow') || e.code === 'Space') { e.stopImmediatePropagation(); e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'KeyT') tip(); else if (e.code === 'KeyE') touch(); else if (e.code === 'Escape') end('leave');
  };
  window.addEventListener('keydown', onKey, true);

  function boothNow() { for (const b of booths) { if (!b.g.parent) { booths.delete(b); continue; } let o = b.g.parent, vis = true; while (o) { if (!o.visible) { vis = false; break; } o = o.parent; } if (vis) return b; } return null; }

  function start(mode = 'show') {
    const b = boothNow(); if (!b) { toast(DF + ': The booth’s being cleaned. Rain check.', 2400); return; }
    const visits = +(localStorage.getItem('ssx.dannyShows') || 0); localStorage.setItem('ssx.dannyShows', visits + 1);
    const outfit = ['aqua', 'crop', 'string'][visits % 3]; // aqua crochet, pink ribbed, white string + cover-up
    const h = spawn({ dancer: 'danny', outfit, look: { key: [0.35, 0.8, 1.0], keyCol: 0xffeee4, keyInt: 2.1, rim: [-0.3, 0.4, -1.0], rimCol: 0xff3cc8, rimInt: 1.25, fill: 0xd0d4e8, fillInt: 0.45, scene: 0.12 } });
    h.group.position.set(0, 0, 0.1); b.g.add(h.group);
    S = { b, h, mode, lt: 0, beat: null, t: 0, left: mode === 'lap' ? LAP_SEC : SHOW_SEC, tips: 0, shot: 0, shotT: 0, z: 0.1, hidden: [], ending: false, fovSaved: null, pl: null, last: 0, ln: 0 };
    h.ready.then(() => { if (S?.h === h) h.play(/salsa/i, 0); });
    const f = fade(); f.textContent = ''; f.classList.add('on');
    setTimeout(() => { if (!S) return; b.g.visible = true; for (const c of b.api.g.children) if (c !== b.g && c.visible) { c.visible = false; S.hidden.push(c); }
      // the booth is sealed: also hide what is outside the club group (street, traffic, crowds) all the way up to the scene, so
      // the cinematic angles never pay for draw calls behind the walls (lights stay on)
      let root = b.g; while (root.parent) root = root.parent;
      const path = new Set(); for (let o = b.g; o; o = o.parent) path.add(o);
      const hideOut = n => { for (const c of n.children) { if (c === b.g || !c.visible || c.isLight) continue;
        let lit = false; c.traverse(x => { if (x.isLight) lit = true; });
        if (path.has(c) || lit) hideOut(c); else { c.visible = false; S.hidden.push(c); } } };
      hideOut(root);
      document.body.classList.add('pshow', 'cinebars'); ui.style.display = 'flex'; say(mode === 'lap' ? LINES.lap[0] : pick(LINES.open), 4); f.classList.remove('on'); }, 650);
    unreg = surface.registerTick?.(tick) || null;
  }

  // routine: [seconds, clip, distance from the chair front, arms on hips]
  const ROUTINE = [[6, /salsa/i, 1.15, false], [5, /modern/i, 1.25, false], [6, /salsa/i, 0.85, false], [4, /idle/i, 0.95, true], [6, /modern/i, 1.05, false], [5, /salsa/i, 0.8, false]];
  const routineAt = t => { const tot = ROUTINE.reduce((a, r) => a + r[0], 0); let u = t % tot; for (const r of ROUTINE) { if (u < r[0]) return r; u -= r[0]; } return ROUTINE[0]; };
  const _p = new THREE.Vector3(), _l = new THREE.Vector3();
  function tick(dt, ctx) {
    if (!S) return;
    if (!(ctx.world || surface.world)?.inside) { stop(); return; } // left the club some other way
    const { b, h } = S; S.t += dt;
    if (!S.pl) S.pl = { x: ctx.player.x, y: ctx.player.y, z: ctx.player.z };
    ctx.player.x = S.pl.x; ctx.player.z = S.pl.z; ctx.player.vy = 0; // seated: no walking off
    for (const c of S.hidden) c.visible = false;
    for (const o of [...b.chair, b.player.group]) o.visible = !S.dbg;
    if (!S.ending && !S.dbg) { S.left -= dt; if (S.left <= 0) end('song'); }
    if (S.mode === 'lap' && !S.dbg) { lapTick(dt, ctx); return; }
    // her routine
    const r = S.dbg ? [1, /idle/i, 1.0, true] : routineAt(S.t); h.play(r[1], S.dbg ? 0 : 0.5, r[4] || 1); h.armsIdle(r[3]); if (S.dbg) h.pose({});
    const goal = b.seat.z - 0.45 - r[2]; S.z += (goal - S.z) * Math.min(1, dt * 0.8);
    h.group.position.set(Math.sin(S.t * 0.5) * 0.12, 0, S.z); h.group.rotation.y = Math.PI + Math.sin(S.t * 0.35) * 0.35; // the model faces -z; turn her to the chair
    h.update(dt);
    if ((capT -= dt) <= 0 && !S.ending && S.t - S.ln > 7) { S.ln = S.t; say(pick(LINES.mid), 4); } if (capT <= 0 && S.t - S.ln > 4.5) cap.textContent = '';
    // camera: seated POV most of the time, with slow cinematic cuts
    const cam = ctx.camera; if (S.fovSaved == null) { S.fovSaved = cam.fov; S.cam = cam; }
    const portrait = innerWidth < innerHeight;
    if ((S.shotT -= dt) <= 0) { S.shot = (S.shot + 1) % 4; S.shotT = S.shot === 0 || S.shot === 2 ? 8 : 5; }
    const u = 1 - S.shotT / (S.shot === 0 || S.shot === 2 ? 8 : 5), hz = h.group.position.z, hx = h.group.position.x;
    if (S.shot === 0 || S.shot === 2) { _p.set(Math.sin(S.t * 0.4) * 0.03, 1.12 + Math.sin(S.t * 0.7) * 0.01, b.seat.z + 0.08); _l.set(hx * 0.6, 1.0 + Math.sin(S.t * 0.5) * 0.08, hz); cam.fov = portrait ? 72 : 52; }
    else if (S.shot === 1) { _p.set(1.55 - u * 0.25, 1.5, b.seat.z + 0.15); _l.set(hx, 1.05, hz); cam.fov = portrait ? 66 : 46; } // over-the-shoulder dolly
    else { _p.set(-1.3 + u * 0.3, 0.75, hz + 1.0); _l.set(hx, 1.15, hz); cam.fov = portrait ? 70 : 50; } // low side angle
    if (S.dbg) { const d = { front: [0, 1.0, 3.1, 0.92, 44, 66], side: [3.1, 1.0, 0, 0.92, 44, 66], back: [0, 1.0, -1.6, 0.92, 44, 66], face: [0.08, 1.6, 0.62, 1.53, 32, 44] }[S.dbg] || [0, 1, 3.1, 0.92, 44, 66]; // test/screenshot views of her (look-dev)
      _p.set(hx + d[0], d[1], hz + d[2]); _l.set(hx, d[3], hz); cam.fov = portrait ? d[5] : d[4]; h.group.rotation.y = Math.PI; h.group.position.x = hx; }
    b.g.localToWorld(_p); b.g.localToWorld(_l); cam.position.copy(_p); S.camLocal = b.g.worldToLocal(_l.clone().copy(_p)); cam.lookAt(_l); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  // ---------- v3 lap dance: a short scripted chair dance, close to the seated player but never touching him ----------
  // Booth frame: the player sits at seat (0, 0, 1.32) facing -z; the chair front edge is z = 0.95, the armrests are at
  // x = +-0.5 (top y = 0.62, z 0.98..1.72). Her feet stay >= 0.3 m in front of the chair (or beside the armrest when
  // she circles); her hands are only ever on her own body or on the armrest top. Beats: [name, seconds, clip, speed,
  // where (x, z), facing ('chair' | 'away'), lean, hip roll, L hand, R hand, caption?]
  const ARM = (x, z) => new THREE.Vector3(x, 0.66, z); // just above the armrest top (booth frame -> world in lapTick)
  const LAP = [
    ['approach', 3, /salsa/i, 0.8, [0, 0.55], 'chair', 0.05, 0.05, 'hip', 'hip'],
    ['turn', 2, /dance_sway|salsa/i, 0.7, [0, 0.58], 'away', 0, 0.1, 'hair', 'hip'],
    ['tease', 5, /dance_sway|salsa/i, 0.65, [0, 0.6], 'away', 0.08, 0.16, 'hair', 'hair', 1],
    ['turnback', 2, /idle/i, 1, [0, 0.58], 'chair', 0.05, 0.06, 'hip', 'thigh'],
    ['lean', 5, /idle/i, 0.9, [0, 0.6], 'chair', 0.42, 0.1, 'thigh', 'thigh', 2],
    ['circle', 5, /dance_sway|salsa/i, 0.6, [0.88, 1.18], 'chair', 0.12, 0.06, 'hip', 'arm', 3],
    ['return', 2.5, /salsa/i, 0.75, [0, 0.55], 'chair', 0.05, 0.05, 'chest', 'hip'],
    ['finish', 1.5, /idle/i, 1, [0, 0.45], 'chair', 0, 0, 'hip', 'hip'],
  ];
  const LAP_LOOP = 1; // tips loop back to the 'turn' beat while there is time left
  const _w = new THREE.Vector3(), _c = new THREE.Vector3(), _cp = new THREE.Vector3(), _cl = new THREE.Vector3();
  function lapTick(dt, ctx) {
    const { b, h } = S;
    if (!S.beat) { S.bi = 0; S.bt = 0; S.beat = LAP[0]; S.x = 0; S.cx = null; }
    S.bt += dt; S.lt += dt;
    if (S.bt >= S.beat[1] && !S.ending) { // next beat; with tip time left, the finish loops back into the dance
      S.bi++; S.bt = 0;
      const need = LAP.slice(S.bi).reduce((a, r) => a + r[1], 0);
      if (S.bi === LAP.length - 1 && S.left > need + LAP.slice(LAP_LOOP, LAP.length - 2).reduce((a, r) => a + r[1], 0) * 0.6) S.bi = LAP_LOOP;
      if (S.bi >= LAP.length) S.bi = LAP.length - 1;
      S.beat = LAP[S.bi]; if (S.beat[10]) say(LINES.lap[S.beat[10]], 3.6);
    }
    const B = S.beat, [, , clip, speed, at, face, lean, roll, Lh, Rh] = B;
    h.play(clip, 0.5, speed); h.armsIdle(false);
    // position: ease toward the beat's spot; the circle walks an arc around the chair (radius 0.75 about the seat)
    let gx = at[0], gz = at[1];
    const arc = a => { gx = Math.sin(a) * 0.88; gz = b.seat.z - Math.cos(a) * 0.74; }; // wide enough to stay >= 0.15 m off the chair's front corner
    if (B[0] === 'circle') arc(Math.min(1, S.bt / (B[1] * 0.55)) * Math.PI * 0.5); // out along the arc, then a slow sway beside the armrest
    else if (B[0] === 'return' && S.x > 0.05) arc((1 - Math.min(1, S.bt / (B[1] * 0.6))) * Math.PI * 0.5); // and back the same way
    const k = Math.min(1, dt * (B[0] === 'circle' ? 3 : 1.4)); S.x += (gx - S.x) * k; S.z += (gz - S.z) * k;
    // keep clear of the chair and the player's knees whatever the easing does
    if (Math.abs(S.x) < 0.35) S.z = Math.min(S.z, 0.65);
    { const M = 0.2, pz = S.z - (0.95 - M), px = 0.56 + M - Math.abs(S.x); // and >= 0.2 m outside the chair box (front z 0.95, armrests |x| 0.56)
      if (pz > 0 && px > 0) { if (pz < px) S.z = 0.95 - M; else S.x = Math.sign(S.x || 1) * (0.56 + M); } }
    h.group.position.set(S.x, 0, S.z);
    // facing: toward the chair (atan2 of the seat direction; the model faces -z at 0) or her back to it
    const dx = b.seat.x - S.x, dz = b.seat.z - S.z; let ry = Math.atan2(-dx, -dz) + (face === 'away' ? Math.PI : 0);
    ry += Math.sin(S.lt * 0.9) * (face === 'away' ? 0.12 : 0.18);
    if (S.ry == null) S.ry = ry; let d = ry - S.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); S.ry += d * Math.min(1, dt * 2.6); h.group.rotation.y = S.ry;
    // hands: own body, or the right armrest top while she circles past it
    h.group.updateMatrixWorld(true);
    const hand = v => v === 'arm' ? b.g.localToWorld(ARM(0.5, Math.max(1.0, Math.min(1.6, S.z + 0.05)))) : v;
    h.pose({ lean, roll, L: hand(Lh), R: hand(Rh) });
    h.update(dt);
    if ((capT -= dt) <= 0) cap.textContent = '';
    // cinematic camera: a shot per beat, slow dolly/arc inside each, always inside the booth
    const cam = ctx.camera; if (S.fovSaved == null) { S.fovSaved = cam.fov; S.cam = cam; }
    const portrait = innerWidth < innerHeight, u = Math.min(1, S.bt / B[1]), e = u * u * (3 - 2 * u), hx = S.x, hz = S.z;
    const sz = b.seat.z; let fov;
    switch (B[0]) {
      case 'approach': case 'finish': _cp.set(0.02, 1.12, sz + 0.1); _cl.set(hx * 0.5, 1.05 + e * 0.08, hz); fov = portrait ? 70 - e * 6 : 50 - e * 6; break; // seated POV, slow push
      case 'turn': case 'tease': { const a0 = B[0] === 'turn' ? -0.9 : -0.55, a = a0 + e * 0.5; _c.set(hx * 0.5, 0, (hz + sz) * 0.5); // low arc around her and the chair
        _cp.set(_c.x + Math.sin(a) * 1.55, 0.62 + e * 0.18, _c.z - Math.cos(a) * 1.0); _cl.set(hx, 0.95, hz + 0.1); fov = portrait ? 70 : 48; break; }
      case 'turnback': case 'lean': _cp.set(0.38 + e * 0.06, 1.45, sz + 0.38); _cl.set(hx, 1.2 - e * 0.12, hz); fov = portrait ? 64 : 42; break; // over the player's shoulder
      case 'circle': _cp.set(1.55, 0.95, 0.4 + e * 0.6); _cl.set(hx * 0.8, 0.95, hz); fov = portrait ? 68 : 46; break; // side track at chair height
      default: _cp.set(-1.2 + e * 0.3, 0.8, hz + 0.9); _cl.set(hx, 1.1, hz); fov = portrait ? 70 : 50; // 'return': low side
    }
    _cp.x = Math.max(-b.W / 2 + 0.15, Math.min(b.W / 2 - 0.15, _cp.x)); _cp.z = Math.max(-b.D / 2 + 0.15, Math.min(b.D / 2 - 0.15, _cp.z));
    S.shot = S.bi; cam.fov = fov;
    _p.copy(_cp); _l.copy(_cl); b.g.localToWorld(_p); b.g.localToWorld(_l); cam.position.copy(_p); S.camLocal = _cp.clone(); cam.lookAt(_l); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  function tip() {
    if (!S || S.ending) return;
    if (!surface.game.spend(TIP)) { say(pick(LINES.broke)); fx.dry?.(); return; }
    fx.cash?.(); S.tips++; S.left += TIP_SEC; hud();
    if (S.tips >= TIPS_FOR_NUMBER && !hasNumber()) {
      const c = contacts(); c[DANNY_NAME] = NUMBER; localStorage.setItem('ssx.contacts', JSON.stringify(c));
      say(LINES.number + ' 📱 ' + DANNY_NAME + ' added to your contacts.', 5); window.SSX?.emit?.('contact:add', { name: DANNY_NAME, number: NUMBER });
    } else say(pick(LINES.tip));
  }
  function touch() {
    if (!S || S.ending) return; S.ending = true; S.h.play(/idle/i, 0.35); S.h.pose({}); S.h.armsIdle(true);
    say(LINES.touch[0], 1.2); setTimeout(() => say(LINES.touch[1], 2), 900);
    setTimeout(() => { const f = fade(); f.textContent = ''; f.classList.add('on'); setTimeout(() => { f.textContent = LINES.out; }, 600); }, 2000);
    setTimeout(() => { stop(); surface.leaveBuilding?.(); }, 4200);
    setTimeout(() => { fade().classList.remove('on'); hud(); }, 6200);
  }
  function end(why) {
    if (!S || S.ending) return; S.ending = true; const S0tips = S.tips;
    const f = fade(); f.textContent = ''; f.classList.add('on');
    setTimeout(() => { f.textContent = why === 'leave' ? 'You thank ' + DF + ' and head back downstairs.' : pick(LINES.end); }, 650);
    setTimeout(() => { stop(); f.classList.remove('on'); hud(); if (hasNumber() && S0tips >= TIPS_FOR_NUMBER) toast(`📱 ${DANNY_NAME} · ${NUMBER} is in your contacts.`, 3000); }, why === 'leave' ? 2000 : 3400);
  }
  function stop() {
    if (!S) return; const { b, h } = S;
    unreg?.(); unreg = null;
    for (const c of S.hidden) c.visible = true; b.g.visible = false;
    if (S.cam) { S.cam.fov = S.fovSaved; S.cam.updateProjectionMatrix(); }
    h.release(); b.g.remove(h.group);
    document.body.classList.remove('pshow', 'cinebars'); ui.style.display = 'none'; cap.textContent = '';
    S = null;
  }
  const api = { offer, start, tip, touch, end, debugView: v => { if (S) S.dbg = v || null; }, lapBeat: n => { if (S?.mode !== 'lap') return false; const i = LAP.findIndex(r => r[0] === n); if (i < 0) return false; S.bi = i; S.bt = 0; S.beat = LAP[i]; return true; }, get active() { return !!S; }, get state() { return S ? { mode: S.mode, beat: S.beat?.[0] || null, t: S.t, left: S.left, tips: S.tips, shot: S.shot, popX: S.h.popX, popN: S.h.popN, herZ: S.h.group.position.z, herX: S.h.group.position.x, ready: !!S.h.md, stats: S.h.stats(), camInBooth: !!S.camLocal && Math.abs(S.camLocal.x) < S.b.W / 2 && Math.abs(S.camLocal.z) < S.b.D / 2 + 0.6 && S.camLocal.y > 0 && S.camLocal.y < S.b.H } : null }, hasNumber };
  window.__pshow = api; // tests / modding (SSX.privateShow once the modding API exists)
  queueMicrotask(() => { if (window.SSX) window.SSX.privateShow = api; });
  return api;
}
