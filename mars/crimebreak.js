// Crime break at Red Static Gulch (v7.5.75): ☰ → 👥 Crime break + a proximity card near the gulch.
// Summons hired crew (crew.js roster) for a sit-down: pays ⭐ via game.reward, stacks a permanent crew-payoff buff
// into crewcore.payMul (SSX.crimebreak.payBonus). Free intro once, then 500 cr + 1-sol cooldown. Rules: crimebreakcore.js.
// Fiction only. Black buttons, white text, 44px+, window.__onTap. Never touches Jeff's swag files.
import * as THREE from 'three';
import * as C from './crimebreakcore.js';
import { ROSTER } from '../crewcore.js';
import { panelTap, tap } from '../racehooks.js';

const W = () => (typeof window !== 'undefined' ? window : null), SSX = () => W()?.SSX, APP = () => W()?.__app;
const game = () => APP()?.surface?.game || APP()?.game;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { ui: null, root: null, figs: {}, colKey: '', near: false, line: 0, meeting: false, note: '', lastTap: 0 };
let D = C.fresh();
const guard = C.makeGuard();

function load() { try { D = C.load(localStorage.getItem(C.KEY)); } catch (e) { D = C.fresh(); } }
function save() { try { localStorage.setItem(C.KEY, JSON.stringify(D)); } catch (e) { /* private mode */ } }
const toast = (t, ms = 3000) => { try { APP()?.toast?.(t, ms); } catch (e) { /* */ } };
const credits = () => game()?.progress?.credits | 0;
const crewHired = () => { try { return SSX()?.crew?.state?.()?.crew?.length | 0; } catch (e) { return 0; } };
const crewIds = () => { try { return (SSX()?.crew?.state?.()?.crew || []).map(m => m.id); } catch (e) { return []; } };
const atGulch = () => { try { return !!SSX()?.copFree?.here?.(); } catch (e) { return false; } };
// one in-game sol = one farm/game day (24 game hours). Prefer farm2, then farm, then SSX.time elapsed.
function solNow() {
  try { const h = SSX()?.farm2?.status?.()?.hours; if (Number.isFinite(h)) return Math.floor(h / 24); } catch (e) { /* */ }
  try { const c = SSX()?.farm?.clock?.(); if (Number.isFinite(c?.day)) return c.day | 0; if (Number.isFinite(c?.hours)) return Math.floor(c.hours / 24); } catch (e) { /* */ }
  try { const t = SSX()?.time; const h = t?.hours?.() ?? t?.hour?.(); if (Number.isFinite(h) && Number.isFinite(t?.days)) return t.days | 0; } catch (e) { /* */ }
  return Math.floor(performance.now() / 1440000);
}
function gate() { return C.canStart(D, { crew: crewHired(), atGulch: atGulch(), credits: credits(), sol: solNow() }); }

// ---------- panel ----------
const CSS = `#cbPanel{position:fixed;inset:0;z-index:58;display:none;align-items:flex-end;justify-content:center;background:rgba(4,6,12,.55)}
#cbPanel.on{display:flex}#cbPanel .wrap{width:min(96vw,440px);max-height:78vh;overflow:auto;-webkit-overflow-scrolling:touch;margin-bottom:calc(8px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:14px;font:14px system-ui,sans-serif;box-sizing:border-box}
#cbPanel h2{margin:2px 0 8px;font-size:17px}#cbPanel q{display:block;font-style:italic;opacity:.9;margin:8px 0;line-height:1.35}
#cbPanel .who{font-weight:800;opacity:.75;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
#cbPanel .note{margin:6px 0;padding:8px 10px;border:2px solid #fff;border-radius:10px;font-weight:700}
#cbPanel .sum{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}#cbPanel .sum b{padding:4px 8px;border-radius:8px;border:1px solid #555;font-size:12px}
#cbPanel .btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#cbPanel button{min-height:48px;min-width:64px;flex:1;padding:8px 12px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
#cbPanel button:disabled{opacity:.45}#cbAct{display:none;background:#000!important;color:#fff!important;border:3px solid #fff!important;min-height:52px;padding:6px 14px;border-radius:14px;font:900 16px/1.15 system-ui,sans-serif}`;
function ensureUi() {
  if (S.ui || typeof document === 'undefined') return S.ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = 'cbPanel'; panel.innerHTML = '<div class="wrap"></div>'; document.body.appendChild(panel);
  panel.addEventListener('pointerdown', e => { if (e.target === panel && !S.meeting) close(); });
  panelTap(panel, e => { const b = e.target?.closest?.('button'); if (b && !b.disabled) act(b.dataset); });
  S.ui = { panel, wrap: panel.firstChild }; return S.ui;
}
const panelOn = () => !!S.ui?.panel.classList.contains('on');
function open(force = false) {
  ensureUi();
  const here = atGulch();
  if (!here && !force) { toast('👥 Crime break is at Red Static Gulch.'); return false; }
  // menu / debug always opens a panel so the player sees why (hire first, wrong place, cooldown)
  const g = C.canStart(D, { crew: crewHired(), atGulch: here || force, credits: credits(), sol: solNow() });
  // if we only faked gulch for messaging, still tell them to go there when they have a crew
  if (force && !here && crewHired() > 0 && g.ok) {
    S.note = 'Crime break only works at Red Static Gulch.'; S.meeting = false; S.line = 0;
    S.ui.panel.classList.add('on'); render(); return true;
  }
  if (g.needCrew) { S.note = g.why; S.meeting = false; S.line = 0; S.ui.panel.classList.add('on'); render(); return true; }
  if (!g.ok) { S.note = g.why; S.meeting = false; S.line = 0; S.ui.panel.classList.add('on'); render(); return true; }
  S.note = ''; S.meeting = false; S.line = 0; S.ui.panel.classList.add('on'); render(); return true;
}
function close() { S.ui?.panel.classList.remove('on'); S.meeting = false; S.line = 0; S.note = ''; clearFigs(true); return true; }
function act(ds) {
  const a = ds?.a; if (a === 'close') return close();
  if (a === 'crew') { close(); try { SSX()?.crew?.open?.(); } catch (e) { /* */ } return; }
  if (a === 'start') return begin();
  if (a === 'next') return nextLine();
  if (a === 'done') return finish();
}
function begin() {
  return guard.run('begin', () => {
    const g = gate(); if (!g.ok) { S.note = '❌ ' + g.why; render(); return g; }
    S.meeting = true; S.line = 0; S.note = ''; gather(); render(); return { ok: true };
  });
}
function nextLine() {
  if (!S.meeting) return;
  if (S.line + 1 < speak().length) { S.line++; render(); return; }
  finish();
}
function speak() {
  const ids = new Set(crewIds());
  const lines = C.LINES.filter(l => {
    const id = ROSTER.find(r => r.name.startsWith(l.who) || r.name.includes(l.who))?.id;
    return !id || ids.has(id);
  });
  return lines.length ? lines : C.LINES.slice(0, 1);
}
function finish() {
  return guard.run('finish:' + D.meets, () => {
    if (!S.meeting) return { ok: false, dup: true };
    const sol = solNow();
    const r = C.complete(D, {
      sol, credits: credits(),
      pay: n => { const g = game(); if (!g?.spend?.(n)) return { ok: false, msg: `Need ${n} cr.` }; return { ok: true }; }
    });
    if (!r.ok) { S.note = '❌ ' + (r.why || 'Couldn\'t finish.'); S.meeting = false; render(); return r; }
    save();
    try { if (r.stars > 0) game()?.reward?.(r.stars, 0); } catch (e) { /* */ }
    S.meeting = false; S.note = r.msg; render();
    toast(r.msg, 3800);
    setTimeout(() => { try { clearFigs(false); } catch (e) { /* */ } }, 1800);
    return r;
  });
}
function render() {
  if (!S.ui) return;
  const g = gate(), ids = crewIds(), lines = speak(), L = lines[Math.min(S.line, lines.length - 1)];
  const buff = C.buffPct(D), next = C.nextSol(D);
  let body = '';
  if (S.note) body += `<div class="note">${esc(S.note)}</div>`;
  body += `<h2>👥 Crime break</h2><div class="sum"><b>Meetings ${D.meets}</b><b>Crew pay +${buff}%</b>${next != null ? `<b>Next sol ${next}</b>` : '<b>Intro free</b>'}<b>⭐ ${C.STAR_PAY}</b></div>`;
  if (g.needCrew) {
    body += `<p>Nobody on your crew yet. Hire someone first, then come back to the gulch.</p><div class="btns"><button data-a="crew">👥 Open Crew</button><button data-a="close">Close</button></div>`;
  } else if (S.meeting && L) {
    body += `<div class="who">${esc(L.who)}</div><q>“${esc(L.text)}”</q>`;
    const last = S.line >= lines.length - 1;
    body += `<div class="btns"><button data-a="${last ? 'done' : 'next'}">${last ? '💵 Seal it' : 'Next'}</button></div>`;
  } else if (!g.ok) {
    if (!S.note && g.why) body = `<div class="note">${esc(g.why)}</div>` + body;
    body += `<p>${esc(g.why || 'Not right now.')}</p><div class="btns"><button data-a="close">Close</button></div>`;
  } else {
    const cost = g.intro ? 'Free intro' : `${C.COST_CR} cr buy-in`;
    body += `<p>Call your people to the gulch. Sit-down pays ${C.STAR_PAY} ⭐ and bumps crew job payoffs (+5%, cap +25%). ${esc(cost)}.</p>`;
    if (ids.length) body += `<p>Showing: ${esc(ids.map(id => ROSTER.find(r => r.id === id)?.name.split(' ')[0] || id).join(', '))}.</p>`;
    body += `<div class="btns"><button data-a="start">👥 Call them in</button><button data-a="close">Close</button></div>`;
  }
  S.ui.wrap.innerHTML = body;
}

// ---------- world: gather hired crew around the player at the gulch ----------
const MAT = {}; const mat = c => (MAT[c] ||= new THREE.MeshLambertMaterial({ color: c }));
let GEO = null;
function figure(r) {
  GEO ||= { legs: new THREE.BoxGeometry(0.42, 0.85, 0.24), torso: new THREE.BoxGeometry(0.56, 0.72, 0.3), head: new THREE.BoxGeometry(0.28, 0.3, 0.28), hat: new THREE.BoxGeometry(0.31, 0.12, 0.31) };
  const g = new THREE.Group(), L = r.look, add = (geo, m, y) => { const o = new THREE.Mesh(geo, mat(m)); o.position.y = y; g.add(o); return o; };
  add(GEO.legs, L.body, 0.43); add(GEO.torso, L.coat, 1.22); add(GEO.head, L.skin, 1.74); add(GEO.hat, L.hat, 1.93); g.name = 'crimebreak-' + r.id; return g;
}
function gather() {
  const tc = APP()?.surface; if (!tc?.scene || !/mars/i.test(tc.info?.name || '')) return;
  const c = SSX()?.city?.colony?.(); if (!c) return;
  const key = `${Math.round(c.x)}|${Math.round(c.z)}`;
  if (!S.root || S.colKey !== key) { S.root?.parent?.remove(S.root); S.root = new THREE.Group(); S.root.name = 'crimebreak-crew'; tc.scene.add(S.root); S.figs = {}; S.colKey = key; }
  const car = tc.car, pl = tc.player || tc.info;
  const px = Number.isFinite(car?.x) ? car.x : (Number.isFinite(pl?.x) ? pl.x : null);
  const pz = Number.isFinite(car?.z) ? car.z : (Number.isFinite(pl?.z) ? pl.z : null);
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
  const ids = crewIds(); S.root.visible = true;
  ids.forEach((id, i) => {
    const r = ROSTER.find(q => q.id === id); if (!r) return;
    let f = S.figs[id]; if (!f) { f = S.figs[id] = figure(r); S.root.add(f); }
    const ang = (i / Math.max(1, ids.length)) * Math.PI * 2 + 0.4, rad = 2.2;
    const x = px + Math.cos(ang) * rad, z = pz + Math.sin(ang) * rad;
    let y = 0; try { y = tc.height?.(x, z) || 0; } catch (e) { /* */ }
    f.position.set(x, y, z); f.rotation.y = Math.atan2(px - x, pz - z); f.visible = true;
  });
  for (const [id, f] of Object.entries(S.figs)) if (!ids.includes(id)) f.visible = false;
}
function clearFigs(hide) {
  if (!S.root) return;
  if (hide) { S.root.visible = false; return; }
  for (const f of Object.values(S.figs)) f.visible = false;
  S.root.visible = false;
}
function setNear(on) {
  if (S.near === on) return; S.near = on;
  const sb = document.getElementById('surfBtns'); if (!sb) return;
  if (!S.btn) { S.btn = document.createElement('button'); S.btn.id = 'cbAct'; S.btn.className = 'glass'; sb.insertBefore(S.btn, sb.firstChild); tap(S.btn, () => open()); }
  S.btn.style.display = on ? 'block' : 'none'; if (on) {
    const g = gate();
    S.btn.textContent = g.needCrew ? '👥 Need a crew' : (!g.ok ? '👥 Break cooling' : '👥 Crime break');
  }
}
function worldTick() {
  if (!atGulch()) { setNear(false); if (!S.meeting) clearFigs(true); return; }
  const n = crewHired();
  setNear(n >= 0 && !panelOn()); // show prompt at gulch even with 0 crew (explains hire-first)
  if (S.meeting) gather();
}

export const crimebreak = {
  version: 1, key: C.KEY, COST: C.COST_CR, STAR_PAY: C.STAR_PAY, BUFF_STEP: C.BUFF_STEP, BUFF_CAP: C.BUFF_CAP,
  open, close, get isOpen() { return panelOn(); }, get meeting() { return S.meeting; },
  state: () => JSON.parse(JSON.stringify(D)), payBonus: () => C.payBonus(D), buffPct: () => C.buffPct(D),
  sol: solNow, gate, start: begin, finish, save, reload() { load(); return true; },
  debug: {
    reset() { D = C.fresh(); save(); S.meeting = false; return true; },
    setSol(n) { try { const F = SSX()?.farm2; const cur = F?.status?.()?.hours || 0; const want = (+n || 0) * 24; if (F?.debug?.skip && want > cur) F.debug.skip(want - cur); } catch (e) { /* */ } return solNow(); },
    force(sol) { D.lastSol = sol - C.COOLDOWN_SOLS; save(); return true; }
  }
};

(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 300); return; }
  if (window.SSX.crimebreak) return; load(); window.SSX.crimebreak = crimebreak;
  try { window.SSX.registerMenuItem({ id: 'rmCrimeBreak', label: '👥 Crime break', onTap: () => open() }); } catch (e) { console.warn('crimebreak menu', e); }
  window.SSX.registerSurfaceTick(() => { try { worldTick(); } catch (e) { /* */ } });
  addEventListener('pagehide', () => { try { save(); } catch (e) { /* */ } });
})();
