// v7.5.76 📜 Contacts: personal mission chains for your four crew members (Dex, Vee, Soren, Mags; crewcore.js ROSTER).
// Rules, objectives and rewards live in mars/crewficcore.js. A chain opens once that person is on your crew (crew.js; the
// lifetime-⭐ hiring gates are crewcore's and untouched). One chain active at a time; pausing never loses progress.
// - ☰ → 📜 Contacts: every character, blurb, 3 beats, lock state, every beat's reward. Tap one for the full checklist +
//   explicit Accept / Not now / Pause buttons. Black buttons, white text, 44px+, window.__onTap, one caption at a time.
// - Active chain: a phone-sized strip below the minimap (the #jobHud slot): chain, ✓ marks, the current objective, distance +
//   compass to its beam. Tap = the Contacts card. Hidden while a 💼 job runs (that HUD owns the slot) or indoors.
// - Rewards: cr + ⭐ through game.reward (⭐ = lifetime, so rank only goes up; SSX.stars balance follows), claimed once per beat
//   (crewficcore.claim + a busy lock + 300 ms dedupe). Beat-3 perks are real mechanics: Dex boosts crew payoffs (crew.js
//   collect), Soren cuts crew bust odds (crew.js job roll), Vee widens the safe dial (SSX.heist.safeCrack), Mags adds +10% to
//   every front wash (SSX.empire.launder). window.SSX.crewfic: open close state perks accept pause choose act on debug.
// Save: ssx.crewfic.v1 (in savecode.js KNOWN, so 💾 Save Code carries it).
import * as THREE from 'three';
import * as K from './crewficcore.js';
import { SAFE_TIERS } from '../heistcore.js';
import { ROSTER } from '../crewcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const SSX = () => window.SSX;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const NAME = id => ROSTER.find(r => r.id === id)?.name || id, FIRST = id => NAME(id).split(' ')[0];
let D = K.fresh();
function load() { try { D = K.load(localStorage.getItem(K.KEY)); } catch (e) { D = K.fresh(); } }
function save() { try { localStorage.setItem(K.KEY, JSON.stringify(D)); } catch (e) { /* private mode */ } }
const subs = new Set();
function emit(type, ev = {}) { const e = { type, ...ev }; for (const f of subs) { try { f(e); } catch (x) { console.warn('crewfic on', x); } } }
const hired = () => { try { return (SSX()?.crew?.state?.().crew || []).map(m => m.id); } catch (e) { return []; } };
const RT = { hold: 0, holdKey: '', near: null, busyT: 0, lastAct: '', lastActT: 0, cracking: false, beam: null, beamKey: '', note: '', view: null, heatKey: '' };
function toast(m, ms = 3000) { if (!m) return; if (panelOn()) { RT.note = m; render(); return; } try { app()?.toast?.(m, ms); } catch (e) { /* */ } }
// one action at a time: busy lock + 300 ms dedupe on the same action key (double taps, tap + ghost click)
function guarded(key, fn) {
  const now = performance.now(); if (RT.busyT > now) return { ok: false, why: 'busy' };
  if (RT.lastAct === key && now - RT.lastActT < 300) return { ok: false, why: 'dup' };
  RT.lastAct = key; RT.lastActT = now; RT.busyT = now + 250; try { return fn(); } finally { RT.busyT = 0; }
}

// ---------- rewards (once per beat) ----------
function payout(id) {
  const r = K.claim(D, id); if (!r) return null; save(); // claimed flag is saved before any cr / ⭐ moves
  const g = game(); try { g?.reward?.(r.stars, r.cr); } catch (e) { console.warn('crewfic reward', e); }
  emit('reward', r); RT.hold = 0; RT.holdKey = '';
  const C = K.CHAINS[id];
  toast(r.beat === 3 ? `📜 ${C.title} done. ${r.line}` : `📜 ${FIRST(id)}: ${C.beats[r.beat - 1].title} done. +${r.cr.toLocaleString()} cr · +${r.stars}⭐. Next: ${C.beats[r.beat].title}.`, 5200);
  RT.lastReward = r; return r;
}
function settle() { const c = K.current(D); if (c && c.i < 0) return payout(c.id); return null; }

// ---------- actions ----------
function accept(id) { return guarded('accept:' + id, () => { const r = K.accept(D, id, hired()); if (r.ok && !r.already) { save(); emit('accept', { id }); const B = K.CHAINS[id].beats[D.c[id].beat]; toast(B.say, 5200); } return r; }); }
function pause() { return guarded('pause', () => { const id = D.active; if (!K.pause(D)) return { ok: false, why: 'Nothing active.' }; save(); RT.hold = 0; emit('pause', { id }); return { ok: true }; }); }
function choose(opt) { return guarded('choose:' + opt, () => { const c = K.current(D); if (!c || !K.choose(D, c.id, opt)) return { ok: false, why: 'Not now.' }; save(); emit('tick', { id: c.id, i: c.i }); settle(); return { ok: true }; }); }
function tickCur(c) { if (!K.tick(D, c.id, c.beat, c.i)) return false; save(); RT.hold = 0; emit('tick', { id: c.id, beat: c.beat, i: c.i }); settle(); return true; }
// the context button at an act / pay / crack objective
function act() {
  const c = K.current(D), o = c?.obj; if (!o || !RT.near) return { ok: false, why: 'Get to the beam first.' };
  return guarded(`act:${c.id}:${c.beat}:${c.i}`, () => {
    if (o.t === 'act') { tickCur(c); return { ok: true }; }
    if (o.t === 'pay') {
      const g = game(); if ((g?.progress?.credits | 0) < o.cr) { toast(`Need ${o.cr.toLocaleString()} cr.`); return { ok: false, why: 'cr' }; }
      if (!g?.spend?.(o.cr)) return { ok: false, why: 'Payment failed.' }; tickCur(c); return { ok: true };
    }
    if (o.t === 'crack') {
      const H = SSX()?.heist; if (RT.cracking) return { ok: false, why: 'busy' };
      if (!H?.safeCrack) { tickCur(c); return { ok: true, fallback: true }; } // heist.js failed to load: don't strand the chain
      RT.cracking = true; const key = `${c.id}:${c.beat}:${c.i}`;
      Promise.resolve(H.safeCrack({ tier: o.tier, title: o.label.replace(/^\S+\s/, '') })).then(r => {
        RT.cracking = false; const now = K.current(D); if (!now || `${now.id}:${now.beat}:${now.i}` !== key) return;
        if (r?.success || r?.ok) tickCur(now); else { if (r?.reason === 'noise' || r?.reason === 'timeout') { try { H.alarm?.(2, 'safe alarm'); } catch (e) { /* */ } } toast('🚨 The dial got away from you. Try again.', 2600); }
      }, () => { RT.cracking = false; });
      return { ok: true, pending: true };
    }
    return { ok: false };
  });
}

// ---------- perks wired into real systems ----------
function wire() {
  // Vee: wider notch + more time on every safe dial (heist.safeCrack takes overrides through to heistcore.createSafe)
  const H = SSX()?.heist; if (H?.safeCrack && !H.safeCrack.__crewfic) {
    const orig = H.safeCrack.bind(H);
    const wrapped = (opts = {}) => { const o = { ...opts }, pk = K.perks(D);
      if (!o.tier && Number.isFinite(o.difficulty)) o.tier = ['easy', 'easy', 'medium', 'hard'][o.difficulty] || 'vault';
      const ov = K.safeOverrides(SAFE_TIERS[o.tier] || SAFE_TIERS.medium, pk); if (ov) { o.overrides = { ...(o.overrides || {}), ...ov }; if (o.time) o.time += pk.time; }
      return orig(o); };
    wrapped.__crewfic = true; H.safeCrack = wrapped;
  }
  // Mags: +10% on every front wash (crew cash, fronts) through empire.launder
  const E = SSX()?.empire; if (E?.launder && !E.launder.__crewfic) {
    const orig = E.launder.bind(E);
    const wrapped = (n, prefer) => { const w = K.perks(D).wash; return orig(w > 0 && n > 0 ? Math.round(n * (1 + w)) : n, prefer); };
    wrapped.__crewfic = true; E.launder = wrapped;
  }
  return !!(H?.safeCrack && E?.launder);
}

// ---------- the world: one beam on the current objective ----------
function labelTex(text, col) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(250, x.measureText(text).width + 26);
  x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(128 - w / 2, 8, w, 48); x.fillStyle = col; x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeBeam(col, text, r) {
  const g = new THREE.Group(); g.name = 'crewfic-beam';
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 80, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 20; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(1, r - 0.5), r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, '#' + col.toString(16).padStart(6, '0')), transparent: true, depthWrite: false })); sp.position.y = 3.6; sp.scale.set(3.8, 0.95, 1); g.add(sp);
  return g;
}
function dropBeam() { if (!RT.beam) return; RT.beam.parent?.remove(RT.beam); RT.beam.traverse(o => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } }); RT.beam = null; RT.beamKey = ''; }
const isMars = tc => /mars/i.test(tc?.name || '') && !!surf()?.info?.colony;
function tick(dt, tc) {
  const c = K.current(D), info = surf()?.info, col = info?.colony;
  if (!c || !isMars(tc) || !col) { dropBeam(); RT.near = null; renderHud(); return; }
  if (c.i < 0) { settle(); renderHud(); return; }
  const o = c.obj, key = `${c.id}:${c.beat}:${c.i}`, px = info.x, pz = info.z;
  // the beam sits on the current objective's place (clean / choice objectives have none)
  if (o.at) { const p = K.toWorld(col, o.at);
    if (RT.beamKey !== key + tc.scene.uuid) { dropBeam(); RT.beam = makeBeam(c.chain.color, `${c.chain.icon} ${FIRST(c.id).toUpperCase()}`, o.r || 8); tc.scene.add(RT.beam); RT.beamKey = key + tc.scene.uuid; }
    RT.beam.position.set(p.x, tc.height ? tc.height(p.x, p.z) : 0, p.z); RT.dist = Math.hypot(px - p.x, pz - p.z); RT.dir = K.dirTo(p.x - px, p.z - pz);
  } else { dropBeam(); RT.dist = null; }
  const inR = o.at && RT.dist <= (o.r || 8);
  RT.near = (o.t === 'act' || o.t === 'pay' || o.t === 'crack') && inR && !info.inside ? key : null;
  if (o.t === 'go' && inR && (!o.drive || info.driving)) tickCur(c);
  else if (o.t === 'hold') { if (RT.holdKey !== key) { RT.holdKey = key; RT.hold = 0; } if (inR) { RT.hold += Math.min(dt, 0.25); if (RT.hold >= o.sec) tickCur(c); } else RT.hold = Math.max(0, RT.hold - dt * 2); }
  else if (o.t === 'clean') { const w = world(); if (w) {
    if (o.heat && !D.c[c.id].heat) { D.c[c.id].heat = true; save(); try { if ((w.wanted | 0) < o.heat) w.setWanted?.(o.heat, 'tripped an alarm'); } catch (e) { /* */ } }
    else if ((w.wanted | 0) === 0) tickCur(c); } }
  renderHud();
}

// ---------- UI ----------
const CSS = `
#cfHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(60px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px 12px;min-height:44px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 13px/1.25 system-ui,sans-serif;pointer-events:auto;touch-action:manipulation}
@media (max-width:640px){#cfHud{top:calc(158px + env(safe-area-inset-top));width:calc(100vw - 16px)}}
body.surface #cfHud.show{display:flex} body.indoors #cfHud{display:none!important} #cfHud .tx{min-width:0;flex:1} #cfHud .l1,#cfHud .l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #cfHud .l1{font-weight:800} #cfHud .l2{font-weight:600}
#cfAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:calc(34% + 64px);display:none;min-height:52px;min-width:130px;max-width:60vw;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
body.surface #cfAct.show{display:block} body.indoors #cfAct{display:none!important}
#cfPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)} #cfPanel.show{display:flex}
#cfPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:12px;border-radius:16px;background:#0b0b0b;color:#fff;border:2px solid #fff;font:13px/1.35 system-ui,sans-serif;box-sizing:border-box}
#cfBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch} #cfPanel h2{margin:0 0 4px;font-size:17px} #cfPanel .sub{margin:0 0 6px;opacity:.85}
#cfPanel .ch{border-top:1px solid rgba(255,255,255,.3);padding:8px 0} #cfPanel .ch b{font-size:14px} #cfPanel .st{float:right;font-weight:800;font-size:12px;padding:2px 8px;border:1px solid #fff;border-radius:8px}
#cfPanel .bl{opacity:.85;margin:3px 0;font-style:italic} #cfPanel .bt{margin:3px 0 0;font-size:12px} #cfPanel .bt.dn{opacity:.5} #cfPanel .rw{font-weight:700}
#cfPanel ol{margin:4px 0 4px 18px;padding:0} #cfPanel li{margin:2px 0} #cfPanel li.dn{text-decoration:line-through;opacity:.5} #cfPanel li.cur{font-weight:800} #cfPanel li.cur::marker{content:'▶ '}
#cfPanel .lk{color:#ffd400;font-weight:700;font-size:12px;margin:3px 0} #cfPanel .say{border-left:3px solid #fff;padding-left:8px;margin:6px 0;opacity:.92}
#cfPanel button{min-height:44px;padding:8px 12px;margin:6px 6px 0 0;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13px system-ui,sans-serif;touch-action:manipulation}
#cfPanel button:disabled{opacity:.45} #cfPanel .note{min-height:1.2em;margin:6px 0 0;font-weight:700} #cfPanel .foot{flex:none;display:flex;gap:8px}`;
let hud, hudL1, hudL2, actBtn, panel, body, noteEl, lastTap = 0;
function onTap(el, fn) { const g = e => { const n = performance.now(); if (n - lastTap < 350) return; lastTap = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function ui() {
  if (panel || typeof document === 'undefined') return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  hud = document.createElement('div'); hud.id = 'cfHud'; hud.setAttribute('role', 'button'); hud.innerHTML = '<div class="tx"><div class="l1"></div><div class="l2"></div></div>'; document.body.appendChild(hud);
  hudL1 = hud.querySelector('.l1'); hudL2 = hud.querySelector('.l2'); onTap(hud, () => open(D.active));
  actBtn = document.createElement('button'); actBtn.id = 'cfAct'; actBtn.type = 'button'; document.body.appendChild(actBtn); onTap(actBtn, () => act());
  panel = document.createElement('div'); panel.id = 'cfPanel';
  panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Contacts"><div id="cfBody"></div><div class="note" id="cfNote"></div><div class="foot"><button id="cfClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#cfBody'); noteEl = panel.querySelector('#cfNote');
  onTap(panel.querySelector('#cfClose'), () => (RT.view ? (RT.view = null, RT.note = '', render()) : close()));
}
const panelOn = () => !!panel?.classList.contains('show');
const jobOn = () => { try { return !!SSX()?.jobs?.active?.(); } catch (e) { return false; } };
let hudKey = '';
function renderHud() {
  if (!hud) return; const c = K.current(D), on = !!c && c.i >= 0 && !jobOn() && !panelOn() && !!app()?.state?.onSurface && isMars({ name: surf()?.info?.name });
  if (!on) { hud.classList.remove('show'); actBtn.classList.remove('show'); hudKey = ''; return; }
  const o = c.obj, n = c.B.obj.length, ticks = c.flags.map(f => (f ? '✓' : '·')).join('');
  const l1 = `${c.chain.icon} ${FIRST(c.id).toUpperCase()} · ${c.B.title} · ${ticks} ${c.flags.filter(Boolean).length}/${n}`;
  const extra = o.t === 'hold' && RT.holdKey === `${c.id}:${c.beat}:${c.i}` && RT.hold > 0 ? ` ${Math.floor(RT.hold)}/${o.sec}s` : '';
  const l2 = `${o.txt}${extra}${o.at && RT.dist != null ? ` · ${Math.round(RT.dist)} m ${RT.dir}` : ''}${o.t === 'clean' ? ` · ${world()?.wanted | 0}★` : ''}`;
  const k = l1 + '|' + l2; if (k !== hudKey) { hudKey = k; hudL1.textContent = l1; hudL2.textContent = l2; }
  hud.classList.add('show');
  const showAct = !!RT.near && !RT.cracking; if (showAct) { const t = o.label || '▶'; if (actBtn.textContent !== t) actBtn.textContent = t; } actBtn.classList.toggle('show', showAct);
}
function open(id = null) { ui(); RT.view = id && K.CHAINS[id] ? id : null; RT.note = ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); renderHud(); return true; }
function close() { panel?.classList.remove('show'); RT.view = null; RT.note = ''; renderHud(); return true; }
function lockWhy(id) { const i = K.IDS.indexOf(id), stars = [10000, 25000, 50000, 100000][i]; return `🔒 Hire ${FIRST(id)} first (☰ → 👥 Crew). Crew slot ${i + 1} opens at ${stars.toLocaleString()} lifetime ⭐.`; }
function beatsHtml(id, full) {
  const C = K.CHAINS[id], q = D.c[id], st = K.status(D, id, hired());
  return C.beats.map((B, b) => {
    const dn = q.beat > b, cur = q.beat === b && st !== 'done', rw = K.beatRewardLines(id, b).map(l => `<div class="rw">🎁 ${esc(l)}</div>`).join('');
    const head = `<div class="bt${dn ? ' dn' : ''}">${dn ? '✓' : b + 1 + '.'} <b>${esc(B.title)}</b> · ${esc(B.where)}</div>`;
    if (!full) return head + rw;
    const items = B.obj.map((o, k) => { const did = dn || (cur && q.flags[k]), now = cur && !did && B.obj.findIndex((_, j) => !q.flags[j]) === k;
      return `<li class="${did ? 'dn' : now ? 'cur' : ''}">${esc(o.txt)}</li>`; }).join('');
    return head + `<ol>${items}</ol>` + rw;
  }).join('');
}
function render() {
  if (!panelOn()) return; const H = hired();
  let html = '';
  if (!RT.view) {
    html = `<h2>📜 Contacts</h2><p class="sub">Your crew\u2019s own jobs. Hire them first, take one chain at a time, rewards pay once.</p>`;
    for (const id of K.IDS) {
      const C = K.CHAINS[id], st = K.status(D, id, H);
      html += `<div class="ch"><span class="st">${K.STATUS_TXT[st]}</span><b>${C.icon} ${esc(NAME(id))}</b> · ${esc(C.title)}<div class="bl">${esc(C.blurb)}</div>${st === 'locked' ? `<div class="lk">${esc(lockWhy(id))}</div>` : ''}${beatsHtml(id, false)}<button type="button" data-a="view" data-id="${id}">${st === 'done' ? '📜 Read' : '📜 Open'} ${esc(FIRST(id))}</button></div>`;
    }
  } else {
    const id = RT.view, C = K.CHAINS[id], st = K.status(D, id, H), q = D.c[id], cur = K.current(D);
    html = `<h2>${C.icon} ${esc(NAME(id))}: ${esc(C.title)}</h2><p class="sub">${K.STATUS_TXT[st]} · beat ${Math.min(3, q.beat + (st === 'done' ? 0 : 1))} of 3</p><div class="bl">${esc(C.blurb)}</div>`;
    if (st !== 'done') html += `<div class="say">${esc(C.beats[q.beat].say)}</div>`;
    if (st === 'locked') html += `<div class="lk">${esc(lockWhy(id))}</div>`;
    html += beatsHtml(id, true);
    if (st === 'ready' || st === 'progress') html += `<div><button type="button" data-a="accept" data-id="${id}" ${D.active ? 'disabled' : ''}>✅ Accept</button><button type="button" data-a="decline">✋ Not now</button></div>${D.active ? `<div class="lk">${esc(`${K.CHAINS[D.active].title} is active. Pause it first.`)}</div>` : ''}`;
    if (st === 'active') {
      if (cur?.obj?.t === 'choice') html += `<div>${cur.B.choice.map(o => `<button type="button" data-a="choose" data-opt="${o.id}">${esc(o.label)}</button>`).join('')}</div>` + cur.B.choice.map(o => `<div class="bt">${esc(o.label)}: ${esc(o.blurb)}</div>`).join('');
      html += `<div><button type="button" data-a="pause">⏸ Pause chain</button></div>`;
    }
    if (st === 'done') html += `<div class="rw">✓ Unlocked: ${esc(C.perk.line)}</div>`;
  }
  body.innerHTML = html; noteEl.textContent = RT.note || '';
  panel.querySelector('#cfClose').textContent = RT.view ? '← Back' : 'Close';
  body.querySelectorAll('button[data-a]').forEach(b => onTap(b, () => {
    if (b.disabled) return; const a = b.dataset.a; let r = null;
    if (a === 'view') { RT.view = b.dataset.id; RT.note = ''; }
    else if (a === 'decline') { RT.view = null; RT.note = 'No rush. Nothing was lost.'; }
    else if (a === 'accept') { r = accept(b.dataset.id); if (r.ok) { close(); return; } }
    else if (a === 'pause') { r = pause(); if (r.ok) RT.note = '⏸ Paused. Progress is saved.'; }
    else if (a === 'choose') { r = choose(b.dataset.opt); }
    if (r && !r.ok && r.why && r.why !== 'busy' && r.why !== 'dup') RT.note = '❌ ' + r.why;
    render();
  }));
}

export const crewfic = {
  version: 1, key: K.KEY, core: K, open, close, get isOpen() { return panelOn(); }, accept, pause, choose, act,
  state: () => JSON.parse(JSON.stringify(D)), perks: () => K.perks(D), current: () => { const c = K.current(D); return c ? { id: c.id, beat: c.beat, i: c.i, obj: c.obj ? { ...c.obj } : null, flags: c.flags, near: !!RT.near, dist: RT.dist ?? null } : null; },
  hired, on: fn => { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); }, reload() { load(); dropBeam(); return true; }, wire,
  // crew.js reads these (guarded): payoff = Dex's boost on collected crew cash; bustRoll = Soren's scaled job roll
  payoffBoost: () => K.perks(D).payoff, bustRoll: u => K.scaleRoll(u, K.perks(D).bustMul),
  debug: {
    goto() { const c = K.current(D), col = surf()?.info?.colony; if (!c?.obj?.at || !col) return false; const p = K.toWorld(col, c.obj.at); surf().debugMove(p.x + 1, p.z + 1, 0); return true; },
    hold(sec) { RT.hold = +sec || 0; return true; }, reset() { D = K.fresh(); save(); dropBeam(); return true; }, settle
  }
};
(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 250); return; }
  if (window.SSX.crewfic) return; load(); window.SSX.crewfic = crewfic; ui();
  try { window.SSX.registerMenuItem({ id: 'rmContacts', label: '📜 Contacts', onTap: () => open() }); } catch (e) { console.warn('crewfic menu', e); }
  try { window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { console.warn('crewfic tick', e); } }); } catch (e) { console.warn('crewfic tick reg', e); }
  let n = 0; const w = setInterval(() => { if (wire() || ++n > 120) clearInterval(w); }, 500); wire();
  settle(); // a finished-but-unclaimed beat (e.g. closed tab mid-save) pays once on load
})();
