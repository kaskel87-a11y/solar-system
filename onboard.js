// v7.5.x "First Day on Mars": a short guided tour for new players + ☰ → 📖 How to play (a plain-words codex).
// One prompt line at a time, placed on the target (marker + distance), never in the middle of the screen.
// Returning players (any real save) skip it automatically; anyone can skip from the ✕ on the line or from the codex.
// Self-contained add-on: one import line in index.html. Talks to the game only through window.__app and window.SSX,
// every hook feature-detected. Waypoints: Snuffles' SSX.hudx.setWaypoint when it exists, else a small marker of our own
// (a light beam + label on the target, a minimap dot, an arrow + distance on the line). Spawns no NPCs.
// Save: localStorage 'ssx.onboard.v1'. URL ?onboard=1 forces the tour on, ?onboard=0 keeps it off for that load.
import * as THREE from 'three';
import { SAVE_KEY, MISSIONS, DONE_TEXT, SPACE_TEXT, AWAY_TEXT, isReturningPlayer, initialState, stepAt, stepText, advance,
  skip as skipState, restart as restartState, resume as resumeState, progressLabel, bearing, fmtDist, codexFor, textOf } from './onboardcore.js';

const app = () => window.__app, surf = () => app()?.surface, X = () => window.SSX || {};
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const $ = id => document.getElementById(id);
const shown = id => !!$(id)?.classList.contains('show');
const PANELS = ['jobPanel', 'cbPanel', 'turfPanel', 'fcPanel'];

// ---------- save ----------
const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
function load() {
  const q = new URLSearchParams(location.search).get('onboard'); const force = q === '1' ? 'on' : q === '0' ? 'off' : null;
  let stored = null; try { stored = JSON.parse(get(SAVE_KEY) || 'null'); } catch (e) { stored = null; }
  const st = initialState(stored, stored ? false : isReturningPlayer(get), force);
  return { st, persist: force !== 'off' || !!stored };
}
let S = null, lastSave = '';
function save() { const j = JSON.stringify(S); if (j === lastSave) return; lastSave = j; try { localStorage.setItem(SAVE_KEY, j); } catch (e) { /* private mode */ } }
const active = () => S?.status === 'active';

// ---------- taps: pointerdown -> pointerup on the same pointer (window.__onTap when there) ----------
function tap(el, fn) {
  if (window.__onTap) return window.__onTap(el, fn);
  let pid = null, sx = 0, sy = 0;
  el.addEventListener('pointerdown', e => { pid = e.pointerId; sx = e.clientX; sy = e.clientY; });
  el.addEventListener('pointerup', e => { if (e.pointerId !== pid) return; pid = null; if (Math.hypot(e.clientX - sx, e.clientY - sy) > 14) return; e.preventDefault(); fn(e); });
  el.addEventListener('pointercancel', () => { pid = null; });
}

// ---------- UI ----------
const CSS = `
#obLine{pointer-events:auto;align-self:stretch;margin-left:auto;max-width:min(330px,100%);box-sizing:border-box;display:flex;align-items:center;gap:6px;
 padding:6px 6px 6px 9px;border-radius:10px;background:rgba(6,14,26,.88);border:1px solid rgba(56,225,255,.55);color:#e8f6ff;font:600 12.5px/1.3 system-ui,-apple-system,sans-serif;
 box-shadow:0 2px 10px rgba(0,0,0,.35)}
#obLine[hidden]{display:none!important}
#obLine .ob-t{flex:1 1 auto;min-width:0;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
#obLine .ob-k{display:block;font:700 10px/1.2 system-ui,sans-serif;letter-spacing:.04em;color:#38e1ff;text-transform:uppercase;margin-bottom:1px}
#obLine .ob-d{flex:none;font:700 12px/1 system-ui,sans-serif;color:#38e1ff;white-space:nowrap;text-align:center;min-width:34px}
#obLine .ob-d i{display:block;font-style:normal;font-size:17px;line-height:1;margin-bottom:2px}
#obLine button{flex:none;font:700 12px/1 system-ui,sans-serif;color:#e8f6ff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:8px;
 min-height:32px;padding:0 9px;touch-action:manipulation;-webkit-user-select:none;user-select:none}
#obLine .ob-x{min-width:32px;padding:0;font-size:14px;color:#9fb3c8}
#obLine.ob-done{border-color:rgba(74,222,128,.7)}
#obLine.ob-space{position:fixed;z-index:9;left:50%;transform:translateX(-50%);bottom:calc(64px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 16px));max-width:none;margin:0}
#obCodex{position:fixed;inset:0;z-index:70;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
#obCodex.show{display:flex}
#obCodex .ob-w{width:min(520px,calc(100vw - 12px));max-height:calc(100% - 20px - env(safe-area-inset-top,0px));display:flex;flex-direction:column;
 margin:0 6px calc(8px + env(safe-area-inset-bottom,0px));border-radius:14px;background:rgba(10,14,24,.97);border:1px solid rgba(255,255,255,.14);color:#e8eef6;
 font:14px/1.4 system-ui,-apple-system,sans-serif;overflow:hidden}
#obCodex .ob-h{flex:none;display:flex;align-items:center;gap:8px;padding:10px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.1)}
#obCodex .ob-h b{flex:1;font-size:17px}
#obCodex .ob-b{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:4px 14px 14px}
#obCodex h3{margin:14px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#38e1ff}
#obCodex p{margin:0 0 9px}
#obCodex p b{display:block;font-size:14px}
#obCodex p span{color:#c3cfdc;font-size:13.5px}
#obCodex .ob-tag{display:inline-block;margin-left:6px;padding:0 5px;border-radius:5px;font-size:10px;font-weight:700;color:#0b1220;background:#fbbf24;vertical-align:1px}
#obCodex .ob-tour{margin:8px 0 2px;padding:9px 10px;border-radius:10px;background:rgba(56,225,255,.08);border:1px solid rgba(56,225,255,.3)}
#obCodex .ob-tour div{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
#obCodex button{font:700 13px/1 system-ui,sans-serif;color:#e8eef6;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:9px;
 min-height:36px;padding:0 12px;touch-action:manipulation}
#obCodex button.ob-pri{background:#0e7490;border-color:#38e1ff}
`;
let line = null, codex = null, confirmSkip = false, flash = null; // flash: { html, until, cls }
function ui() {
  if (line) return;
  const st = document.createElement('style'); st.id = 'obStyle'; st.textContent = CSS; document.head.appendChild(st);
  line = document.createElement('div'); line.id = 'obLine'; line.hidden = true; line.setAttribute('role', 'status'); line.setAttribute('aria-live', 'polite');
  codex = document.createElement('div'); codex.id = 'obCodex'; codex.setAttribute('role', 'dialog'); codex.setAttribute('aria-label', 'How to play');
  codex.innerHTML = '<div class="ob-w"><div class="ob-h"><b>📖 How to play</b><button type="button" id="obCodexClose" aria-label="Close">✕ Close</button></div><div class="ob-b" id="obCodexBody"></div></div>';
  document.body.appendChild(codex);
  tap($('obCodexClose'), () => closeCodex());
  codex.addEventListener('pointerdown', e => { if (e.target === codex) codex._bg = e.pointerId; });
  codex.addEventListener('pointerup', e => { if (e.target === codex && codex._bg === e.pointerId) closeCodex(); codex._bg = null; });
  addEventListener('keydown', e => { if (e.code === 'Escape' && codex.classList.contains('show')) { e.stopPropagation(); closeCodex(); } }, true);
}
function placeLine(space) {
  const host = space ? document.body : $('stackR') || document.body;
  if (line.parentNode !== host) { space ? host.appendChild(line) : host.insertBefore(line, host.firstChild); }
  line.classList.toggle('ob-space', !!space);
}
let lineKey = '';
function setLine(html, key, space, cls = '') {
  placeLine(space); line.hidden = false; line.className = (space ? 'ob-space ' : '') + cls;
  if (key === lineKey) return; lineKey = key; line.innerHTML = html;
  line.querySelectorAll('button[data-ob]').forEach(b => tap(b, () => onLineBtn(b.dataset.ob)));
}
function hideLine() { if (line && !line.hidden) { line.hidden = true; lineKey = ''; } }
function onLineBtn(a) {
  if (a === 'x') { confirmSkip = true; lineKey = ''; render(); return; }
  if (a === 'keep') { confirmSkip = false; lineKey = ''; render(); return; }
  if (a === 'skip') { confirmSkip = false; doSkip(); }
}
function doSkip() {
  S = skipState(S); save(); clearWay();
  flash = { html: '<span class="ob-t">Tour skipped. Tap ☰, then 📖 How to play any time.</span>', until: performance.now() + 3500, cls: '' }; lineKey = ''; render();
}

// ---------- codex ----------
function openCodex() {
  ui(); renderCodex(); codex.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock?.();
}
function closeCodex() { codex?.classList.remove('show'); }
function renderCodex() {
  const touch = isTouch(), x = X();
  const has = k => k === 'fight' ? typeof x.fight?.status === 'function' || !!x.fight : !!x[k];
  const secs = codexFor(touch, has);
  const st = S?.status, where = progressLabel(S || {});
  const tour = st === 'active' ? `<b>🗺️ First Day on Mars</b> · on mission ${esc(where)}<div><button type="button" data-cx="skip">Skip tour</button><button type="button" data-cx="restart">Restart</button></div>`
    : st === 'done' ? `<b>🗺️ First Day on Mars</b> · done ✓<div><button type="button" data-cx="restart">Play the tour again</button></div>`
    : st === 'skipped' || st === 'paused' ? `<b>🗺️ First Day on Mars</b> · a short guided tour of Mars (${MISSIONS.length} missions, small cash rewards).<div><button type="button" class="ob-pri" data-cx="${S.m || S.s ? 'resume' : 'restart'}">${S.m || S.s ? 'Resume tour' : 'Start tour'}</button>${S.m || S.s ? '<button type="button" data-cx="restart">Start over</button>' : ''}</div>`
    : '';
  let html = tour ? `<div class="ob-tour" id="obTour">${tour}</div>` : '';
  for (const s of secs) {
    html += `<h3>${esc(s.sec)}</h3>`;
    for (const i of s.items) html += `<p data-id="${esc(i.id)}"><b>${esc(i.t)}${i.opt ? '<span class="ob-tag">if available</span>' : ''}</b><span>${esc(i.d)}</span></p>`;
  }
  const body = $('obCodexBody'); body.innerHTML = html;
  body.querySelectorAll('button[data-cx]').forEach(b => tap(b, () => {
    const a = b.dataset.cx;
    if (a === 'skip') S = skipState(S); else if (a === 'restart') S = restartState(S); else if (a === 'resume') S = resumeState(S);
    stepT0 = performance.now(); walkPt = null; confirmSkip = false; flash = null; lineKey = ''; save(); clearWay();
    if (a !== 'skip') closeCodex(); else renderCodex();
    render();
  }));
}

// ---------- waypoint: SSX.hudx (Snuffles) > our own marker ----------
let way = null, beam = null, beamScene = null;
function hudxWay() { const h = X().hudx; return typeof h?.setWaypoint === 'function' ? h : null; }
function setWay(t) {
  const key = t ? `${Math.round(t.x)},${Math.round(t.z)},${t.label}` : '';
  if (key === (way?.key || '')) { if (t && !hudxWay()) syncBeam(t); return; }
  clearWay(); if (!t) return;
  way = { ...t, key };
  const h = hudxWay();
  if (h) { try { h.setWaypoint({ x: t.x, z: t.z, label: t.label }, true); way.hudx = true; } catch (e) { way.hudx = false; } }
  if (!way.hudx) { X().minimap?.addMarks?.('onboard', [{ x: t.x, z: t.z, color: '#38e1ff', r: 4, clamp: true, ring: true }]); syncBeam(t); }
}
function clearWay() {
  if (way?.hudx) { const h = hudxWay(); try { const w = h?.waypoint?.(); if (!w || w.label === way.label) h?.setWaypoint(null, true); } catch (e) { /* ignore */ } }
  X().minimap?.clear?.('onboard'); if (beam) beam.visible = false; way = null;
}
function labelTex(text) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 512; c.height = 96;
  g.font = '700 46px system-ui, sans-serif'; const w = Math.min(500, g.measureText(text).width + 44);
  g.fillStyle = 'rgba(6,14,26,.86)'; g.strokeStyle = '#38e1ff'; g.lineWidth = 5;
  const x0 = (512 - w) / 2; g.beginPath(); g.roundRect ? g.roundRect(x0, 10, w, 76, 20) : g.rect(x0, 10, w, 76); g.fill(); g.stroke();
  g.fillStyle = '#e8f6ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function syncBeam(t) {
  const s = surf(), scene = s?.scene; if (!scene) return;
  if (!beam || beamScene !== scene) {
    beam?.parent?.remove(beam);
    beam = new THREE.Group(); beam.name = 'onboard-marker'; beamScene = scene;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 70, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.y = 35; beam.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 28), new THREE.MeshBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; beam.add(ring);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); sp.position.y = 5; sp.scale.set(8, 1.5, 1); sp.renderOrder = 5; beam.add(sp); beam.userData.sp = sp;
    scene.add(beam);
  }
  if (beam.userData.text !== t.label) { const sp = beam.userData.sp; sp.material.map?.dispose(); sp.material.map = labelTex(t.label); sp.material.needsUpdate = true; beam.userData.text = t.label; }
  const y = X().city?.height?.(t.x, t.z); beam.position.set(t.x, Number.isFinite(y) ? y : (s.info?.y ?? 0) - 1.7, t.z); beam.visible = true;
}

// ---------- targets & checks (world coords; Mars add-ons use Ares Junction-relative [x, z]) ----------
let walkPt = null, stepT0 = 0, turfOrg = null, sawAir = false;
function colony(i) { const c = i?.colony; return c ? { x: c.x, z: c.z } : null; }
function target(id, i) {
  const c = colony(i), aj = (p, label) => c && p ? { x: c.x + p[0], z: c.z + p[1], label } : null, x = X();
  switch (id) {
    case 'walk': {
      if (!walkPt || Math.hypot(walkPt.x - i.x, walkPt.z - i.z) > 150) {
        const to = c || { x: i.x, z: i.z - 1 }; let dx = to.x - i.x, dz = to.z - i.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        walkPt = { x: i.x + dx * 22, z: i.z + dz * 22 }; S.wp = walkPt; save();
      }
      return { ...walkPt, label: 'Walk here' };
    }
    case 'rover': return Number.isFinite(i.roverX) ? { x: i.roverX, z: i.roverZ, label: 'Your rover' } : null;
    case 'taxi': { let p = null; try { p = x.jobs?.places?.()?.taxiStands?.[0]; } catch (e) { /* optional */ } return aj(Array.isArray(p) ? p : [-24, 40], '🚕 Taxi stand'); }
    case 'blue': return aj([-258, -50], '💊 Blue');
    case 'turfmap': {
      if (!turfOrg) { try { const o = x.turf?.debug?.state?.()?.org; if (Array.isArray(o)) turfOrg = o; } catch (e) { /* optional */ } }
      const o = turfOrg || [-280, -40]; return aj([o[0] - 8, o[1] + 16], '🗺️ Turf map');
    }
    case 'pit': {
      try { const f = x.fight?.status?.(); if (Array.isArray(f?.at)) return aj(f.at, '🥊 Rust Pit'); } catch (e) { /* optional */ }
      // the activities runner checks its pins against raw world x/z: aim where its 📋 The Pit button actually shows
      const a = window.__activities?.list?.().find(v => v.id === 'act-pit-fight'); if (Array.isArray(a?.at)) return { x: a.at[0], z: a.at[1], label: '📋 The Pit' };
      return aj([-316, -58], '📋 The Pit');
    }
    case 'club': {
      const d = x.city?.world?.doorFor?.('velvet'); if (d && Number.isFinite(d.x)) return { x: d.x, z: d.z, label: '🍸 Velvet Airlock' };
      return aj([-30, -27], '🍸 Velvet Airlock');
    }
  }
  return null;
}
function check(id, i) {
  switch (id) {
    case 'jump': if (!i.driving && !i.inside && i.grounded === false) sawAir = true; return sawAir;
    case 'driving': return !!i.driving;
    case 'jobsOpen': return shown('jobPanel');
    case 'blueOpen': return shown('cbPanel');
    case 'turfOpen': return shown('turfPanel');
    case 'panelsClosed': return !PANELS.some(shown) && performance.now() - stepT0 > 600;
    case 'inClub': { const r = i.inside; if (!r) return false; const n = [r.door?.name, r.name, r.kind, r.door?.kind, i.door?.name].filter(Boolean).join(' '); return /velvet|club/i.test(n); }
    case 'pitBusy': { const a = window.__activities?.active; let f = null; try { f = X().fight?.status?.(); } catch (e) { /* optional */ } return /pit/i.test(a?.id || '') || !!(f?.inCage || f?.bout); }
  }
  return false;
}
// a dedicated activity owns the screen: our line steps aside (one caption at a time)
function busy(i) {
  const x = X(); let b = false;
  try { b = !!x.jobs?.active?.() || !!x.turf?.fight?.() || !!window.__activities?.active || !!x.heist?.active?.(); } catch (e) { b = false; }
  return b || document.body.classList.contains('duel');
}
const vis = id => { const e = $(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
function overlay() {
  return PANELS.some(shown) || shown('roverMenu') || !!codex?.classList.contains('show') || !!$('radio')?.classList.contains('open') ||
    document.body.classList.contains('cinematic') || ['shopPanel', 'ctlPanel', 'logPanel', 'sheet', 'adultGate'].some(vis);
}

// ---------- main loop ----------
function finishStep(i) {
  const r = advance(S); S = r.state; stepT0 = performance.now(); sawAir = false; confirmSkip = false; lineKey = '';
  if (r.paid) { try { X().city?.game?.bonus?.(r.paid); } catch (e) { /* ignore */ } }
  if (r.done) { clearWay(); flash = { html: `<span class="ob-t">🎓 ${esc(DONE_TEXT)}</span>`, until: performance.now() + 7000, cls: 'ob-done' }; }
  else if (r.finished) flash = { html: `<span class="ob-t"><span class="ob-k">Mission done</span>✓ ${esc(r.finished.title)} · +${r.paid} cr</span>`, until: performance.now() + 2600, cls: 'ob-done' };
  save(); X().emit?.('onboard:step', { m: S.m, s: S.s, status: S.status, paid: r.paid });
}
function lineHtml(text, kicker, dist) {
  const xb = confirmSkip ? '' : '<button type="button" class="ob-x" data-ob="x" aria-label="Skip the tour">✕</button>';
  if (confirmSkip) return `<span class="ob-t">Skip the tour? You can restart it from ☰ → 📖 How to play.</span><button type="button" data-ob="skip">Skip</button><button type="button" data-ob="keep">Keep going</button>`;
  return `<span class="ob-t"><span class="ob-k">${esc(kicker)}</span>${esc(text)}</span>${dist ? `<span class="ob-d"><i>${dist.arrow}</i>${esc(fmtDist(dist.d))}</span>` : ''}${xb}`;
}
function render() {
  if (!line || !S) return;
  const now = performance.now(), A = app(), st = A?.state, i = surf()?.info;
  if (flash && now < flash.until) { if (st?.onSurface && overlay()) return hideLine(); setLine(flash.html, 'flash' + flash.until, !st?.onSurface, flash.cls); return; }
  flash = null;
  if (!active() || !st || st.transitioning) { hideLine(); if (!active()) clearWay(); return; }
  const touch = isTouch();
  if (!st.onSurface || !i) { clearWay(); if (codex?.classList.contains('show') || shown('roverMenu')) return hideLine(); return setLine(lineHtml(textOf(SPACE_TEXT, touch), 'First day on Mars'), 'space' + confirmSkip + touch, true); }
  if (i.name !== 'Mars') { clearWay(); if (overlay()) return hideLine(); return setLine(lineHtml(textOf(AWAY_TEXT, touch), 'First day on Mars'), 'away' + confirmSkip + touch, false); }
  if (i.intro) return hideLine();
  const c = stepAt(S); if (!c?.step) { hideLine(); return; }
  const s = c.step, t = s.kind === 'go' ? target(s.target, i) : null;
  setWay(t && !busy(i) ? { ...t, label: s.label || t.label } : null);
  if (overlay() || busy(i)) return hideLine();
  let alt = false; if (s.target === 'rover' && t && Math.hypot(t.x - i.x, t.z - i.z) > 150) alt = true;
  if (s.alt && s.check === 'jobsOpen' && touch) { const d = $('ssxDock'); alt = !d || d.offsetWidth === 0 || getComputedStyle(d).visibility === 'hidden' || document.body.classList.contains('hxFold'); }
  if (s.alt && s.check === 'turfOpen' && touch) { const d = $('dockTurf'); alt = !d || d.offsetWidth === 0 || document.body.classList.contains('hxFold'); }
  const fight = s.target === 'pit' && typeof X().fight?.status === 'function';
  const text = stepText(S, { touch, alt, fight });
  const dist = t && !way?.hudx ? bearing(i.x, i.z, t.x, t.z, i.viewYaw || 0) : null; // hudx draws its own ➤ chip
  const kick = `${c.mi + 1}/${MISSIONS.length} · ${c.mission.title}`;
  const dk = dist ? `${dist.arrow}${Math.round(dist.d / (dist.d > 99 ? 10 : 1))}` : '';
  setLine(lineHtml(text, kick, dist), [S.m, S.s, alt, fight, touch, confirmSkip, dk].join('|'), false);
}
function tick() {
  if (!S) return;
  try {
    const A = app(), st = A?.state, i = surf()?.info;
    if (active() && st?.onSurface && !st.transitioning && i?.name === 'Mars' && !i.intro) {
      const c = stepAt(S), s = c?.step;
      if (s) {
        if (!stepT0) stepT0 = performance.now();
        let ok = false;
        if (s.kind === 'go') { const t = target(s.target, i); const near = t && Math.hypot(t.x - i.x, t.z - i.z) <= s.r; ok = s.check ? check(s.check, i) : near || (s.target === 'pit' && check('pitBusy', i)); }
        else if (s.kind === 'do') ok = check(s.check, i);
        else if (s.kind === 'tell') ok = performance.now() - stepT0 > (s.ms || 5000) && !overlay();
        if (ok) finishStep(i);
      }
    }
    render();
  } catch (e) { console.warn('onboard', e); }
}

// ---------- boot ----------
const API = {
  get state() { return S ? JSON.parse(JSON.stringify(S)) : null; },
  missions: () => MISSIONS.map(m => ({ id: m.id, title: m.title, reward: m.reward, steps: m.steps.length })),
  current: () => { const c = S && stepAt(S); return c ? { mission: c.mission.id, step: c.si, text: stepText(S, { touch: isTouch(), fight: typeof X().fight?.status === 'function' }), target: c.step.kind === 'go' && surf()?.info ? target(c.step.target, surf().info) : null } : null; },
  start() { S = restartState(S); stepT0 = 0; walkPt = null; flash = null; save(); render(); return API.state; },
  resume() { S = resumeState(S); save(); render(); return API.state; },
  skip() { doSkip(); return API.state; },
  openCodex, closeCodex, get waypoint() { return way ? { x: way.x, z: way.z, label: way.label, via: way.hudx ? 'hudx' : 'own' } : null; },
  debug: { next() { if (active()) finishStep(surf()?.info || {}); return API.state; }, set(m, s = 0) { S = { ...S, status: 'active', m, s }; stepT0 = 0; sawAir = false; save(); return API.state; }, reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } S = null; lastSave = ''; boot(); return API.state; } }
};
function boot() {
  if (!window.SSX?.registerMenuItem || !window.__app) { setTimeout(boot, 200); return; }
  const { st, persist } = load(); S = st; if (st.wp) walkPt = st.wp; if (persist) save(); else lastSave = JSON.stringify(S);
  window.SSX.onboard = API; ui();
  try { window.SSX.registerMenuItem({ id: 'rmHowTo', label: '📖 How to play', onTap: () => openCodex() }); } catch (e) { console.warn('onboard menu', e); }
  if (!boot.iv) boot.iv = setInterval(tick, 200);
}
boot();
