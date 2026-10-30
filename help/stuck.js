// Stuck? on the mission card (Collin, Oct 2026): a black "Stuck?" button on the 📜 card (story missions, side jobs, Mars jobs)
// and on the farm guide. Tap (or key 6: H is "fly to the ship") = ONE plain-word hint for the step you're on (what, which way,
// how far, the target's name) and a re-ping of the ◆ / red foe marks. If the step hasn't moved in 3 min, or its target is gone
// or can't be reached, the pop-up also offers Skip this step / Quit job, no penalty. One pop-up at a time.
// Ticked from activities/runner.js (activityTick runs every surface frame on every world). Logic + copy: help/stuckcore.js.
import * as THREE from 'three';
import { foesTick, foes, ping as pingFoes, markerState, foesOff } from './foes.js';
import { hint, markerKind, createStall, stallTick, offerOut, actionsFor, STALL_S, KEY, KEY_LABEL } from './stuckcore.js';
import { SITES } from '../mars/farmcore.js';

const app = () => window.__app, surf = () => app()?.surface;
let C = null, clock = 0, btn = null, pop = null, popKey = null, popT = 0, uiT = 0, beacon = null, beaconT = 0, pingMapT = 0, stall = createStall(), last = null;
const toast = (t, ms = 3200) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tapOn = (el, fn) => {
  if (window.__onTap) return window.__onTap(el, fn); // index.html: pointerdown -> pointerup, same pointerId, < 14 px drift (no scroll / swipe taps)
  let id = null, x = 0, y = 0, lastT = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; id = e.pointerId; x = e.clientX; y = e.clientY; });
  const up = e => { if (e.pointerId !== id) return; id = null; if (e.type !== 'pointerup' || Math.hypot(e.clientX - x, e.clientY - y) > 14) return; e.preventDefault(); lastT = performance.now(); fn(e); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('click', e => { if (performance.now() - lastT > 700) fn(e); });
};

const CSS = `
#hxStuck{display:none;flex:none;align-self:flex-start;min-width:44px;min-height:44px;padding:2px 4px;border-radius:9px;background:#000;color:#fff;border:2px solid #fff;font:800 10px/1.1 system-ui,sans-serif;touch-action:manipulation;pointer-events:auto;-webkit-tap-highlight-color:transparent}
#hxStuck.vis{display:block} #hxStuck.hot{border-color:#ffd400} body.hidehud #hxStuck,body.cinematic #hxStuck{display:none!important}
#farmGuide #hxStuck{width:auto;height:44px;font:800 12px/1 system-ui,sans-serif;background:#000;color:#fff}
#stuckPop{position:fixed;z-index:30;display:none;box-sizing:border-box;max-width:min(340px,calc(100vw - 16px));padding:10px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 15px/1.35 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.6);pointer-events:auto}
#stuckPop.on{display:block} #stuckPop .t{margin:0 0 8px} #stuckPop .row{display:flex;flex-wrap:wrap;gap:6px}
#stuckPop button{min-height:44px;padding:4px 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px/1.1 system-ui,sans-serif;touch-action:manipulation}
#stuckPop button.ok{margin-left:auto} #stuckPop .why{display:block;color:#ffd400;font-size:12px;margin:-4px 0 8px}
`;

// ---------- what are we on? ----------
function colonyAt(a) {
  if (!a) return null; const p = Array.isArray(a) ? a : [a.x, a.z];
  try { const w = C?.world?.colonyAt?.(p); if (w && Number.isFinite(w.x)) return { x: w.x, z: w.z }; } catch (e) { /* */ }
  const c = surf()?.info?.colony; return c ? { x: c.x + p[0], z: c.z + p[1] } : null;
}
const shown = sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
const blocked = (x, z) => { try { return !!C?.world?.collide?.(x, z, 0.35); } catch (e) { return false; } };
export function current() {
  const g = C?.game; if (!g) return null;
  let md = null; try { md = surf()?.mapData?.(); } catch (e) { /* */ }
  const me = md ? { x: md.x, z: md.z, yaw: md.yaw || 0 } : { x: C.player?.x || 0, z: C.player?.z || 0, yaw: 0 };
  const plain = (t, ty) => { try { return window.SSX?.hudx?.plainStep?.(t, ty) || { text: t, how: '' }; } catch (e) { return { text: t, how: '' }; } };
  let q = null; try { q = g.info?.quest; } catch (e) { /* */ }
  const act = window.__activities?.active;
  if (q) {
    const st = g.debug?.step?.() || {}, type = st.type || 'goto', kind = markerKind(type), p = plain(q.text, type);
    const m = /\((\d+)\s*\/\s*(\d+)\)\s*$/.exec(q.text || ''), wave = type === 'defeat' && !!m;
    const f = kind === 'foes' ? foes() : [];
    let target = null; const tg = g.debug?.target?.();
    if (kind === 'gate') target = md?.gate || null; else if (md?.wp) target = md.wp; else if (tg && tg.r > 0) target = { x: tg.x, z: tg.z };
    let missing = false, unreachable = false;
    if (kind === 'place') missing = !target || (!!tg && tg.r === 0 && (type === 'enter' || type === 'crack'));
    if (kind === 'gate') missing = !target;
    if (kind === 'items') missing = !(g.debug?.items?.() || []).some(i => i.collect) && !target;
    if (kind === 'foes' && wave) { const left = (+m[2]) - (+m[1]); missing = left > 0 && !f.length; unreachable = f.length > 0 && f.every(o => blocked(o.x, o.z)); }
    if (kind === 'place' && target && type !== 'enter' && type !== 'crack' && !md?.indoors) unreachable = blocked(target.x, target.z);
    return { src: act && act.mode !== 'poker' ? 'side' : 'quest', id: q.id, title: q.title, step: q.step, type, kind, what: p.text, how: p.how, me, target,
      foes: f, left: wave ? (+m[2]) - (+m[1]) : null, name: st.building || null, missing, unreachable, key: `q:${q.id}:${q.step}:${q.text}` };
  }
  try { const j = window.SSX?.jobs?.active?.(); if (j) { const t = j.target ? colonyAt(j.target) : null; return { src: 'job', kind: 'place', what: j.text || 'Finish the job', how: '', me, target: t, name: null, missing: !t, unreachable: false, key: `j:${j.type}:${j.stage}:${j.text}` }; } } catch (e) { /* */ }
  try { const f = window.SSX?.turf?.fight?.(); if (f) { const b = window.SSX.turf.blocks().find(b => b.id === f.block); const t = b && colonyAt(b.flag); return { src: 'turf', kind: 'place', what: `Defend ${b?.name || 'your turf'}`, how: '', me, target: t, name: b?.name || null, missing: !t, unreachable: false, key: `t:${f.block}` }; } } catch (e) { /* */ }
  try { const fg = window.SSX?.farm?.guide?.status?.(); if (fg?.shown && fg.step) { const site = SITES[fg.to], t = site && colonyAt(site.at);
    return { src: 'farm', kind: 'farm', what: fg.text, how: '', me, target: t, name: site?.name || null, missing: !t, unreachable: false, key: `f:${fg.step}` }; } } catch (e) { /* */ }
  return null;
}

// ---------- UI ----------
function ensureUI() {
  if (btn) return;
  const st = document.createElement('style'); st.id = 'stuckCss'; st.textContent = CSS; document.head.appendChild(st);
  btn = document.createElement('button'); btn.id = 'hxStuck'; btn.type = 'button'; btn.textContent = 'Stuck?';
  btn.setAttribute('aria-label', `Stuck? Get a hint (key ${KEY_LABEL})`); btn.title = `Stuck? Get a hint (${KEY_LABEL})`;
  tapOn(btn, () => toggle());
  pop = document.createElement('div'); pop.id = 'stuckPop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Stuck? hint'); document.body.appendChild(pop);
  addEventListener('keydown', e => {
    if (e.code !== KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (window.SSX?.base?.building || document.body.classList.contains('danger-standoff') || document.getElementById('dzEvChoices')?.classList.contains('on')) return; // their number keys win
    if (!btn.classList.contains('vis')) return;
    e.preventDefault(); toggle();
  });
}
function place() {
  const card = document.getElementById('hxCard'), fgd = document.getElementById('farmGuide'), qt = document.getElementById('questTrack');
  let host = null, before = null;
  if (card && card.classList.contains('on')) host = card;
  else if (!card && qt && qt.style.display === 'block' && qt.parentNode) { host = qt.parentNode; before = qt.nextSibling; }
  else if (fgd && fgd.classList.contains('on')) { host = fgd; before = document.getElementById('farmGuideX'); }
  const cur = host ? last : null, on = !!host && !!cur && surf() && app()?.state?.onSurface;
  if (on && btn.parentNode !== host) host.insertBefore(btn, before || null);
  btn.classList.toggle('vis', !!on); // not 'on': index.html's onTap uses .on as the pressed state
  if (!on && pop.classList.contains('on')) close();
  return on;
}
function otherPopup() {
  return !!document.querySelector('body.hxMapOpen, #roverMenu.show, [id$="Panel"].show, [id$="Panel"].on, [id$="Sheet"].show, [id$="Sheet"].on, #controlsSheet.show, #menuSheet.show, #pauseMenu.show');
}
function popAt() {
  const r = (btn.parentNode?.getBoundingClientRect?.() || btn.getBoundingClientRect()), W = innerWidth, pw = Math.min(340, W - 16);
  let left = Math.min(Math.max(8, r.right - pw), W - pw - 8), top = r.bottom + 6;
  if (top > innerHeight * 0.6) top = Math.max(8, r.top - 6 - (pop.offsetHeight || 160));
  pop.style.left = `${left}px`; pop.style.top = `${top}px`; pop.style.width = `${pw}px`;
}
export function open(why = 'tap') {
  ensureUI(); const cur = current(); if (!cur || !btn.classList.contains('vis')) return { ok: false, why: 'no step' };
  if (otherPopup()) return { ok: false, why: 'another pop-up is open' };
  const stillS = stallTick(stall, cur.key, clock), out = offerOut({ stillS, missing: cur.missing, unreachable: cur.unreachable }), A = actionsFor(cur.src);
  const text = hint(cur), skip = out && A.skip, quit = out && A.quit;
  const why2 = !out ? '' : cur.missing ? 'The target is missing.' : cur.unreachable ? 'The target is somewhere you can’t reach.' : `No progress for ${Math.floor(stillS / 60)} min.`;
  pop.innerHTML = `<p class="t">${esc(text)}</p>${out && (skip || quit) ? `<span class="why">${esc(why2)} No penalty either way.</span>` : ''}<div class="row">${skip ? '<button type="button" class="skip">Skip this step</button>' : ''}${quit ? `<button type="button" class="quit">${esc(A.quitLabel)}</button>` : ''}<button type="button" class="ok">OK</button></div>`;
  const b = s => pop.querySelector(s);
  tapOn(b('.ok'), () => close());
  if (skip) tapOn(b('.skip'), () => doSkip());
  if (quit) tapOn(b('.quit'), () => doQuit());
  pop.classList.add('on'); popAt(); popKey = cur.key; popT = out ? 40 : 14; btn.classList.add('hot');
  reping(cur);
  return { ok: true, text, skip, quit, stillS, missing: cur.missing, unreachable: cur.unreachable, via: why };
}
export function close() { pop?.classList.remove('on'); btn?.classList.remove('hot'); popKey = null; }
function toggle() { if (pop?.classList.contains('on')) close(); else open(); }

function reping(cur) {
  pingFoes(4);
  const t = cur.kind === 'foes' && cur.foes?.length ? null : cur.target; // foes ping themselves (bigger red ◆ + dots)
  if (!t) return;
  try { window.SSX?.minimap?.addMarks?.('stuck-ping', [{ x: t.x, z: t.z, color: cur.kind === 'farm' ? '#ffd400' : '#38e1ff', r: 7, ring: true, clamp: true }]); pingMapT = 4; } catch (e) { /* */ }
  if (C?.scene) {
    if (!beacon) { beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 80, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); beacon.name = 'stuck-ping-beacon'; beacon.renderOrder = 998; }
    if (beacon.parent !== C.scene) C.scene.add(beacon);
    const y = C.height ? C.height(t.x, t.z) : 0; beacon.position.set(t.x, y + 40, t.z); beacon.material.color.set(cur.kind === 'farm' ? 0xffd400 : 0x38e1ff); beacon.visible = true; beaconT = 4;
  }
}
function doSkip() {
  const g = C?.game, st = g?.debug?.step?.(); close();
  if (!g?.advanceStep) return false;
  if (st?.type === 'defeat') { try { for (let i = 0; i < 2; i++) g.debug?.clear?.(); } catch (e) { /* */ } } // the leftover wave goes with the step
  g.advanceStep(); stall = createStall(); toast('⏭ Step skipped. No penalty.'); return true;
}
function doQuit() {
  const cur = current(); close(); if (!cur) return false;
  try {
    if (cur.src === 'side') { const A = window.__activities; A?.quit ? A.quit('🏳️ Quit the job. No penalty: take it again any time.') : A?.abandon?.(); }
    else if (cur.src === 'quest') { C.game.abandon?.(); toast('🏳️ Mission dropped. No penalty: pick it up again any time.'); }
    else if (cur.src === 'job') { window.SSX?.jobs?.stop?.(); toast('🏳️ Quit the job. No penalty.'); }
    else if (cur.src === 'turf') window.SSX?.turf?.retreat?.();
    else if (cur.src === 'farm') window.SSX?.farm?.guide?.hide?.();
  } catch (e) { console.warn('stuck quit', e); return false; }
  stall = createStall(); return true;
}

// ---------- tick (from activities/runner.js activityTick, every surface frame) ----------
export function missionHelpTick(dt, ctx) {
  C = ctx; attach(); dt = Number.isFinite(dt) ? Math.min(dt, 0.25) : 0; clock += dt;
  try { foesTick(dt, ctx); } catch (e) { console.warn('quest foes', e); }
  if (pingMapT > 0 && (pingMapT -= dt) <= 0) { try { window.SSX?.minimap?.clear?.('stuck-ping'); } catch (e) { /* */ } }
  if (beacon?.visible && (beaconT -= dt) <= 0) beacon.visible = false;
  if (pop?.classList.contains('on') && (popT -= dt) <= 0) close();
  if ((uiT -= dt) > 0) return;
  uiT = 0.25; ensureUI();
  last = current();
  const stillS = last ? stallTick(stall, last.key, clock) : stallTick(stall, null, clock);
  place();
  btn.classList.toggle('hot', !!pop.classList.contains('on') || (!!last && offerOut({ stillS, missing: last.missing, unreachable: last.unreachable }) && actionsFor(last.src).quit));
  if (pop.classList.contains('on')) {
    if (!last || last.key !== popKey || otherPopup()) close(); // the step moved on / another pop-up took over
    else popAt();
  }
}
export function missionHelpOff() { close(); foesOff(); }

const api = { open, close, current, hint: () => { const c = current(); return c ? hint(c) : null; }, markers: markerState, foes, stall: () => ({ key: stall.key, stillS: stall.key == null ? 0 : clock - stall.since, limit: STALL_S }),
  debugStall(s) { stall.since -= s; return clock - stall.since; }, key: KEY, version: 1, popOpen: () => !!pop?.classList.contains('on'), text: () => pop?.querySelector('.t')?.textContent || '' };
const attach = () => { const X = window.SSX; if (X && X.missionHelp !== api) X.missionHelp = api; };
if (typeof window !== 'undefined') { attach(); window.__missionHelp = api; }
