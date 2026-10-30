// v7.5.5 HUD declutter (Snuffles), from Collin's iPhone playtest. Loaded by one guarded import in index.html.
//  - plain directions: the 📜 card says WHAT to do and WHERE (hud/hints.js) + a ➤ arrow chip with the distance to the objective
//  - lite minimap by default: you, the ACTIVE objective (big ◆), the nearest 3 jobs/missions, threats. Tap it for the full map
//    (hud/hudmap.js: legend, filter chips, tappable mission list that sets a waypoint). Settings → Minimap: Lite / Full
//  - one context button slot for Rook / Turf / Taxi duty (#cbBtn, #turfAct, #jobAct move there; one shows, ⇅ cycles)
//  - phones: the Stash / Jobs / Turf dock (#ssxDock) is hidden; those items live in the ☰ menu (mirrored if a module didn't add one); #stackR stays out of the middle of the screen
//  - the radio is NOT touched here (Pumpkin's pumpkin/radio-hud-declutter owns it). We keep a slot free for its one-line strip:
//    bottom-left, above the joystick (SSX.hudx.radioSlot(), CSS var --hx-radio-bottom). Nothing in this file goes there.
//  - ONE mission card (#hxCard, top right): the 📜 quest + any running Mars job (mars/jobs.js taxi / medic / bounty) or turf fight
//    (mars/turf.js) as one compact line with a ⏱ chip, the step text, the ➤ arrow + distance, and ONE 🏳️ quit control for all of
//    them (also quits a 📋 side job). Their old full-width mid-screen bars (#jobHud, #turfHud) and the duplicate 📋 Job chip are
//    hidden; those modules still render them (we read their text), so nothing in jobs.js / turf.js / runner.js changes.
// Window API: SSX.hudx = { mini(mode?), openMap(), closeMap(), objective(), setWaypoint(p|null), pois(), questHtml(q), drawMini(o), radioSlot() }
import { plainStep } from './hints.js';
import { openMap, closeMap, mapOpen } from './hudmap.js';

const LS = 'ssx.hudx.v1';
const S = (() => { try { return { mini: 'lite', filters: { missions: 1, shops: 0, races: 1, turf: 1 }, wp: null, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch (e) { return { mini: 'lite', filters: { missions: 1, shops: 0, races: 1, turf: 1 }, wp: null }; } })();
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const app = () => window.__app, surf = () => app()?.surface, info = () => surf()?.info;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtD = d => d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
const onTap = (el, fn) => (window.__onTap ? window.__onTap(el, fn) : el.addEventListener('click', fn));
const RADIO_SLOT = { left: 8, bottom: 150, height: 30, maxWidthVw: 62 }; // css px above the safe area; joystick top is ~142px

const css = `
:root{--hx-radio-bottom:${RADIO_SLOT.bottom}px}
body.hudx #questTrack{white-space:normal;max-width:min(300px,100%);text-overflow:clip}
body.hudx #questTrack .hxQh{display:flex;gap:6px;align-items:center;white-space:nowrap} body.hudx #questTrack .hxQh>b{overflow:hidden;text-overflow:ellipsis;min-width:0}
body.hudx #questTrack .hxQw{margin-left:auto;flex:none;display:flex;align-items:center;gap:2px;color:#9fe8ff;font-weight:800} body.hudx #questTrack .hxQw:empty{display:none}
body.hudx #questTrack .hxQw .ar{width:15px;height:15px;display:block} body.hudx #questTrack .hxQw .ar path{fill:#38e1ff;stroke:#000;stroke-width:1.2}
/* v7.6: the First Day tour card sits above the flight pad + joystick while flying, never on Up/Boost */
body.hudx.touch.flying #obLine.ob-space{bottom:calc(172px + env(safe-area-inset-bottom,0px))}
/* v7.6: toasts stay inside the viewport minus safe areas, long words wrap, 3 lines before the clamp */
body.hudx #toast{max-width:min(100%,calc(100vw - 16px - var(--sal,0px) - var(--sar,0px)));overflow-wrap:anywhere;-webkit-line-clamp:3}
body.hudx #questTrack :is(.hxTx,.hxHow){display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden} /* every hint: 2 lines max (hud/hints.js copy is sized to fit 390 px) */
body.hudx #questTrack .hxHow{color:#9fe8ff;font-weight:600} #hxCard #hxJob.on~#questTrack .hxHow{display:none} /* a running job: keep the card tight */
body.hudx #stackR:has(#questTrack[style*="block"]) > #actChip,body.hxCardOn #actChip{display:none!important}
body.hudx #jobHud,body.hudx #turfHud,body.hxQuitAct #actCtxBtn{display:none!important}
#hxCard{display:none;align-items:flex-start;gap:4px;max-width:min(300px,100%);box-sizing:border-box} #hxCard.on{display:flex} #hxCard .hxCol{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;gap:2px;align-items:stretch}
#hxCard.box{padding:4px 4px 4px 9px;border-radius:9px;background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(80,200,255,.45);text-shadow:0 1px 2px rgba(0,0,0,.8)}
#hxCard.box #questTrack{background:none;border:0;padding:0;border-radius:0;-webkit-backdrop-filter:none;backdrop-filter:none;max-width:100%}
#hxCard.box #hxJob.on+#questTrack[style*="block"]{border-top:1px solid rgba(255,255,255,.18);padding-top:2px}
#hxJob{display:none;font-size:.7rem;line-height:1.3;color:#fff} #hxJob.on{display:block}
#hxJob .hxJh{display:flex;gap:5px;align-items:center;white-space:nowrap} #hxJob .l1{font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;min-width:0}
#hxJob .tm{flex:none;padding:0 5px;border-radius:6px;background:#000;color:#fff;border:1px solid rgba(255,255,255,.6);font-weight:800;font-variant-numeric:tabular-nums} #hxJob .tm:empty{display:none} #hxJob .tm.warn{color:#ffd400;border-color:#ffd400}
#hxJob .l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #hxJob .l2:empty{display:none}
#hxJob .hxQw{margin-left:auto;flex:none;display:flex;align-items:center;gap:2px;color:#9fe8ff;font-weight:800} #hxJob .hxQw:empty{display:none} #hxJob .hxQw .ar{width:15px;height:15px;display:block} #hxJob .hxQw .ar path{fill:#38e1ff;stroke:#000;stroke-width:1.2}
#hxQuit{display:none;flex:none;min-width:44px;min-height:44px;padding:2px 3px;border-radius:9px;background:#000;color:#fff;border:2px solid #fff;font:800 10px/1.1 system-ui,sans-serif;touch-action:manipulation;flex-direction:column;align-items:center;justify-content:center;gap:1px}
#hxQuit.on{display:flex} #hxQuit .i{font-size:16px;line-height:18px}
#hxWay{display:none;pointer-events:none;align-items:center;gap:6px;padding:3px 9px 3px 4px;border-radius:10px;background:rgba(0,0,0,.78);border:1px solid #38e1ff;color:#fff;font:700 .74rem system-ui,sans-serif;max-width:100%}
#hxWay.on{display:flex} body.indoors #hxWay{display:none!important}
#hxWay .ar{width:26px;height:26px;flex:none;display:block;transition:transform .15s linear}
#hxWay .ar path{fill:#38e1ff;stroke:#000;stroke-width:1.2}
#hxWay .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #hxWay .d{color:#9fe8ff}
body.hudx #cbBtn,body.hudx #turfAct,body.hudx #jobAct{left:auto!important;top:auto!important;right:var(--hx-ctx-right,8px)!important;bottom:var(--hx-ctx-bottom,190px)!important;max-width:min(150px,36vw);min-width:96px!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (orientation:portrait){body.hudx #cbBtn,body.hudx #turfAct,body.hudx #jobAct{max-width:84px;min-width:64px!important;white-space:normal;line-height:1.1;font-size:12px;padding:4px 6px}}
body.hudx .hxCtxOff{display:none!important}
#hxCtxNext{position:fixed;z-index:13;display:none;min-height:44px;min-width:48px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 13px/1.1 system-ui,sans-serif;touch-action:manipulation;padding:0 4px}
body.surface:not(.indoors):not(.cinematic) #hxCtxNext.show{display:block}
body:has(#roverMenu.show) :is(#hxCtxNext,#cbBtn,#turfAct,#jobAct),body.hxMapOpen :is(#hxCtxNext,#cbBtn,#turfAct,#jobAct),body.hidehud #hxCtxNext,body.danger-standoff #hxCtxNext{display:none!important}
body.hxFold #ssxDock:not(:has(> :is(#dockRcn,#dockSmg,#dockSmgF):not([style*="display: none"]))){display:none!important} body.hxFold #ssxDock > :not(#dockRcn,#dockSmg,#dockSmgF){display:none!important} /* v7.5.5: on-the-spot actions (Raccoon buy/pick, smuggling pickup/drop) stay as a button on the spot, not in ☰ */
@media (orientation:portrait){body.hudx #stackR{max-height:calc(25vh - 62px - var(--sat))} body.hudx #stackR:has(> #radio[style*="block"]:not(.mini)){max-height:44vh}}
/* v7.6 ▤ More (phones): the dock items that aren't already in ☰ live here, left side under the minimap, clear of FIRE/Pet/Jump/Run/joystick */
#hxMore{display:none;position:fixed;z-index:9;left:calc(10px + var(--sal,0px));top:calc(196px + var(--sat,0px));min-width:44px;min-height:44px;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:1px solid rgba(255,255,255,.55);font:700 13px/1 system-ui,sans-serif;touch-action:manipulation}
#hxMore.avail{display:block} #hxMore[aria-expanded="true"]{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
#hxMoreP{display:none;position:fixed;z-index:9;left:calc(10px + var(--sal,0px));top:calc(246px + var(--sat,0px));width:min(214px,calc(100vw - 20px - var(--sal,0px) - var(--sar,0px)));max-height:max(96px,calc(100vh - 246px - 196px - var(--sat,0px) - var(--sab,0px)));overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;box-sizing:border-box;padding:6px;border-radius:12px;background:rgba(0,0,0,.92);border:1px solid rgba(255,255,255,.3);grid-template-columns:1fr 1fr;gap:6px}
#hxMoreP.show{display:grid} body.hxMoreOn #roverMenu button.hxDup{display:none!important}
#hxMore:not(.avail) + #hxMoreP{display:none!important}
#hxMoreP button{min-height:44px;padding:4px 6px;border-radius:9px;background:#000;color:#fff;border:1px solid rgba(255,255,255,.45);font:700 12px/1.15 system-ui,sans-serif;white-space:normal;text-align:left}
#hxMoreP button:not(.show){display:none}
@media (max-height:440px){#hxMore{top:calc(140px + var(--sat,0px))} #hxMoreP{top:calc(190px + var(--sat,0px));max-height:calc(100vh - 190px - 140px - var(--sat,0px) - var(--sab,0px));width:min(300px,40vw)}}
/* v7.6 👁 hide-HUD: only the joystick, Jump, Run, FIRE (+ flight pad in space) and the 👁 stay */
body.cinematic #surfHud{display:block!important} body.touch.cinematic.surface #surfHud > #surfBtns{display:grid!important} body.cinematic #surfBtns > :not(#jumpBtn,#runBtn){display:none!important}
body.touch.cinematic.surface.combat #surfHud > #fireBtn,body.touch.cinematic.surface.turret #surfHud > #fireBtn,body.touch.cinematic.surface.canfire #surfHud > #fireBtn,body.touch.cinematic.surface.wanted:not(.driving) #surfHud > #fireBtn{display:block!important}
body.cinematic.surface #joy{opacity:.85}
body.cinematic > :not(#surfHud,#hud,#joy,canvas,script,style,link,#fadeBlack,#adultGate,#loading,#hudShow){display:none!important}
body.cinematic #hud > :not(#joy,#flyBtns){display:none!important}
/* v7.6 sheets scroll vertically; the tap guard below stops a swipe from firing the button it started on */
#roverMenu,#shopPanel .wrap,#logPanel .wrap,[role="dialog"]{touch-action:pan-y}
`;

// ---------- objective + points of interest (world coords) ----------
function colony() { const i = info(); return i?.colony ? { x: i.colony.x, z: i.colony.z } : null; }
function rel(at) { const c = colony(); if (!c || !at) return null; const a = Array.isArray(at) ? at : [at.x, at.z]; return { x: c.x + a[0], z: c.z + a[1] }; }
function mapData() { try { return surf()?.mapData?.() || null; } catch (e) { return null; } }
export function objective(md = mapData()) {
  if (!md) return null;
  if (md.gate) return { x: md.gate.x, z: md.gate.z, label: 'Next race ring', kind: 'race' };
  const q = surf()?.game?.info?.quest;
  if (md.wp) return { x: md.wp.x, z: md.wp.z, label: q?.title || 'Objective', kind: 'quest' };
  try { const j = window.SSX?.jobs?.active?.(); const p = j?.target && rel(j.target); if (p) return { ...p, label: j.text || 'Job', kind: 'job' }; } catch (e) { /* no jobs */ }
  try { const f = window.SSX?.turf?.fight?.(); if (f) { const b = window.SSX.turf.blocks().find(b => b.id === f.block); const p = b && rel(b.flag); if (p) return { ...p, label: `Defend ${b.name}`, kind: 'turf' }; } } catch (e) { /* no turf */ }
  if (S.wp && S.wp.world === info()?.name) return { x: S.wp.x, z: S.wp.z, label: S.wp.label, kind: 'waypoint' };
  return null;
}
export function setWaypoint(p, quiet) {
  S.wp = p ? { x: p.x, z: p.z, label: p.label || 'Waypoint', world: info()?.name || '' } : null; save();
  if (p && !quiet) app()?.toast?.(`📍 Waypoint: ${p.label || 'set'}. Follow the ➤ arrow.`, 2200);
  tick(true);
}
const ICON = { 'act-pit-fight': '🥊', 'act-static-bounce': '🚪', 'act-vale-scanner': '🚔', 'act-pixel-photo': '📷', 'act-kline-armored': '💰', 'act-trust-range': '🎯', 'act-wrench-scrap': '🔧', 'act-funeral-bets': '🎲',
  'act-blue-courier': '📦', 'act-porter-valet': '🔑', 'act-lita-openhouse': '📷', 'act-rhee-drill': '🏁', 'act-beltway-trial': '🏁', 'act-beltway-taxi': '🚕', 'act-beltway-delivery': '📦', 'act-parkour-ridge': '🏃', 'act-static-poker': '🃏' };
let poiCache = { t: 0, list: [] };
// -> [{ id, cat: missions|shops|races|turf, icon, name, sub, x, z }]
export function pois(force) {
  const now = performance.now(); if (!force && now - poiCache.t < 1000) return poiCache.list;
  const out = [], md = mapData(), W = md?.world, add = (o, at) => { const p = at && (at.x !== undefined ? at : rel(at)); if (p && isFinite(p.x) && isFinite(p.z)) out.push({ ...o, x: p.x, z: p.z }); };
  try { const A = window.__activities, pack = A?.pack?.activities || [];
    for (const a of A?.list?.() || []) { if (a.deferred || !a.at) continue; const d = pack.find(p => p.id === a.id); add({ id: 'act:' + a.id, cat: a.id.includes('trial') || a.id.includes('drill') || a.id.includes('parkour') ? 'races' : 'missions', icon: ICON[a.id] || '📋', name: a.name, sub: [d?.contact, d?.location?.label].filter(Boolean).join(' · '), act: a.id }, a.at); } } catch (e) { /* no activities */ }
  for (const q of W?.people || []) if (q.kind === 'contact') add({ id: 'contact:' + (q.name || q.id), cat: 'missions', icon: '💬', name: q.name || 'Contact', sub: 'Story contact: walk up and talk' }, { x: q.x, z: q.z });
  try { for (const n of window.SSX?.contraband?.npcs?.() || []) if (n.spot) add({ id: 'cb:' + n.id, cat: 'missions', icon: '🤝', name: n.name || n.id, sub: 'Contraband buyer' }, n.spot); } catch (e) { /* none */ }
  try { const P = window.SSX?.jobs?.places?.(); if (P) {
    (P.taxiStands || []).forEach((a, i) => add({ id: 'taxi:' + i, cat: 'missions', icon: '🚕', name: 'Taxi stand', sub: 'Taxi job: stop here in any car' }, a));
    (P.clinics || []).forEach((c, i) => add({ id: 'clinic:' + i, cat: 'missions', icon: '🚑', name: c.name || 'Clinic', sub: 'Paramedic job' }, c.at || c));
    (P.boards || []).forEach((a, i) => add({ id: 'board:' + i, cat: 'missions', icon: '🎯', name: 'Bounty board', sub: 'Vigilante job' }, a)); } } catch (e) { /* none */ }
  try { for (const t of window.__race?.tracks?.() || []) if (t.gates?.[0]) add({ id: 'race:' + t.id, cat: 'races', icon: '🏁', name: t.name, sub: `Street race · ${t.gates.length} rings` }, { x: t.gates[0].x, z: t.gates[0].z }); } catch (e) { /* none */ }
  try { for (const b of window.SSX?.turf?.blocks?.() || []) if (b.flag) add({ id: 'turf:' + b.id, cat: 'turf', icon: b.owner === 'player' ? '🏴' : '🚩', name: b.name, sub: `Turf · held by ${b.ownerName || '?'}` }, b.flag); } catch (e) { /* none */ }
  for (const sh of W?.shops || []) add({ id: 'shop:' + (sh.id || sh.name || out.length), cat: 'shops', icon: '$', name: sh.name || 'Shop', sub: 'Shop' }, { x: sh.x, z: sh.z });
  poiCache = { t: now, list: out }; return out;
}

// ---------- 📜 card: plain words ----------
// the "how" line (what to actually do) shows for HOW_MS after each new step, then the card shrinks back to 2 lines
const HOW_MS = 8000; let howKey = '', howAt = 0;
// v7.6: phones have no keyboard, so drop "(E)" / "(T)" style key hints on touch (index.html's toast does the same)
export const KEY_HINT = /\s*\((?:[A-Z0-9]|Esc|Space|Tab|Shift|Enter)\)/g;
export const noKeys = s => (typeof document !== 'undefined' && document.body?.classList.contains('touch') ? String(s).replace(KEY_HINT, '') : s);
export function questHtml(q) {
  if (!q) return '';
  const p0 = plainStep(q.text, q.type), p = { ...p0, text: noKeys(p0.text), how: p0.how && noKeys(p0.how) }, key = `${q.title}|${String(q.text).replace(/\s*\([^)]*\d[^)]*\)\s*$/, '')}`, now = performance.now();
  if (key !== howKey) { howKey = key; howAt = now; }
  const how = p.how && now - howAt < HOW_MS;
  return `<span class="hxQh"><b>📜 ${esc(q.title)}</b>${q.timer != null ? `<span class="tm">⏱ ${Math.ceil(q.timer)} s</span>` : ''}<span class="hxQw"></span></span><span class="hxTx">${esc(p.text)}</span>${how ? `<span class="hxHow">${esc(p.how)}</span>` : ''}`;
}

// ---------- lite minimap (index.html drawMiniMap calls this first; true = drawn) ----------
export function drawMini(o) {
  if (S.mini === 'full' || !o?.md) return false;
  const { c, W, R, dpr, md, proj, out } = o, now = performance.now();
  c.beginPath(); c.arc(R, R, R - dpr, 0, Math.PI * 2); c.fillStyle = 'rgba(8,10,20,0.66)'; c.fill(); c.lineWidth = 1.5 * dpr; c.strokeStyle = 'rgba(56,225,255,0.55)'; c.stroke();
  const dot = (p, col, r) => { if (!p) return; c.beginPath(); c.arc(p[0], p[1], r * dpr, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
  for (const a of md.aliens || []) { const p = proj(a.x, a.z, false); if (p) { dot(p, a.boss ? '#ff2d6a' : '#ff4b4b', a.boss ? 4.2 : 2.8); out.aliens++; } }
  for (const q of md.crates || []) { const p = proj(q.x, q.z, false); if (p) { c.fillStyle = '#3cff6a'; c.fillRect(p[0] - 2.5 * dpr, p[1] - 2.5 * dpr, 5 * dpr, 5 * dpr); out.crates = (out.crates || 0) + 1; } }
  const blink = (now / 250 | 0) % 2; for (const q of md.world?.security || []) { const p = proj(q.x, q.z, true); dot(p, blink ? '#ef4444' : '#3b82f6', 2.8); out.security = (out.security || 0) + 1; }
  for (const [, ms] of o.marks || []) for (const m of ms) { const p = proj(m.x, m.z, !!m.clamp); if (p) { dot(p, m.color || '#f59e0b', m.r || 2.6); out.marks = (out.marks || 0) + 1; } }
  // your rides (clamped): the rover when on foot, the Starship always (small, they are how you get home)
  if (md.ship) { const p = proj(md.ship.x, md.ship.z, true); c.save(); c.translate(p[0], p[1]); c.beginPath(); c.moveTo(0, -4 * dpr); c.lineTo(3.5 * dpr, 3.5 * dpr); c.lineTo(-3.5 * dpr, 3.5 * dpr); c.closePath(); c.fillStyle = '#ff8a3c'; c.fill(); c.restore(); out.ship = true; }
  if (md.rover && !md.driving) { const p = proj(md.rover.x, md.rover.z, true); c.fillStyle = '#4fa8ff'; c.fillRect(p[0] - 3 * dpr, p[1] - 3 * dpr, 6 * dpr, 6 * dpr); out.rover = true; }
  // the ☰ 🛒 Shop target you asked for (pulsing $)
  const sm = o.shopMark && (md.world?.shops || []).find(sh => Math.hypot(o.shopMark.x - sh.x, o.shopMark.z - sh.z) < 1);
  if (sm) { const p = proj(sm.x, sm.z, true), pr = (4 + 3 * (0.5 + 0.5 * Math.sin(now / 180))) * dpr; c.beginPath(); c.arc(p[0], p[1], 6 * dpr + pr, 0, Math.PI * 2); c.strokeStyle = '#4ade80'; c.lineWidth = 2 * dpr; c.stroke();
    c.font = `900 ${Math.round(13 * dpr)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3 * dpr; c.strokeStyle = '#06210f'; c.strokeText('$', p[0], p[1]); c.fillStyle = '#4ade80'; c.fillText('$', p[0], p[1]); out.shopMark = true; out.shop = 1; }
  // nearest 3 jobs / missions (clamped to the rim so you can always see which way)
  const ob = objective(md), near = pois().filter(p => p.cat === 'missions' || p.cat === 'races').map(p => ({ p, d: Math.hypot(p.x - md.x, p.z - md.z) }))
    .filter(e => !ob || Math.hypot(e.p.x - ob.x, e.p.z - ob.z) > 12).sort((a, b) => a.d - b.d).slice(0, 3);
  c.font = `${Math.round(11 * dpr)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const e of near) { const p = proj(e.p.x, e.p.z, true); if (!p) continue; c.beginPath(); c.arc(p[0], p[1], 7 * dpr, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.75)'; c.fill(); c.lineWidth = dpr; c.strokeStyle = '#fff'; c.stroke(); c.fillStyle = '#fff'; c.fillText(e.p.icon, p[0], p[1] + 0.5 * dpr); }
  out.near = near.length;
  if (ob) { const p = proj(ob.x, ob.z, true), pr = 1 + 0.18 * Math.sin(now / 160);
    c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 4); c.scale(pr, pr); c.fillStyle = ob.kind === 'race' ? '#facc15' : '#38e1ff'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * dpr; c.fillRect(-5.5 * dpr, -5.5 * dpr, 11 * dpr, 11 * dpr); c.strokeRect(-5.5 * dpr, -5.5 * dpr, 11 * dpr, 11 * dpr); c.restore();
    out.objective = ob.kind; if (md.wp) out.wp = true; if (md.gate) out.gate = true; }
  c.save(); c.translate(R, R); c.beginPath(); c.moveTo(0, -7 * dpr); c.lineTo(5 * dpr, 6 * dpr); c.lineTo(0, 3 * dpr); c.lineTo(-5 * dpr, 6 * dpr); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = dpr; c.stroke(); c.restore();
  const label = ob ? `◆ ${fmtD(Math.hypot(ob.x - md.x, ob.z - md.z))}` : 'MAP';
  c.font = `800 ${Math.round(9 * dpr)}px system-ui,sans-serif`; c.fillStyle = '#fff'; c.shadowColor = '#000'; c.shadowBlur = 3 * dpr; c.fillText(label, R, W - 10 * dpr); c.shadowBlur = 0;
  out.lite = true; return true;
}

// ---------- ➤ waypoint chip, context button, dock fold ----------
let way, ctxNext, ctxPick = 0, lastT = 0;
const ARROW = '<svg class="ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 L21 21 L12 16 L3 21 Z"/></svg>';
function dirWord(a) { const d = ((a * 180 / Math.PI) % 360 + 540) % 360 - 180, A = Math.abs(d); return A < 22 ? 'ahead' : A > 150 ? 'behind you' : A < 70 ? (d > 0 ? 'ahead, right' : 'ahead, left') : A < 115 ? (d > 0 ? 'to your right' : 'to your left') : (d > 0 ? 'behind, right' : 'behind, left'); }
function districtName(x, z) { try { const ds = mapData()?.world?.districts || []; let best = null, bd = Infinity; for (const d of ds) { const dd = Math.hypot((d.x ?? d.cx) - x, (d.z ?? d.cz) - z) - (d.r || 0); if (dd < bd) { bd = dd; best = d; } } return best && bd < 60 ? best.name : ''; } catch (e) { return ''; } }
function updWay(md) {
  if (!way) { way = document.createElement('div'); way.id = 'hxWay'; way.setAttribute('aria-live', 'off'); way.innerHTML = `${ARROW}<span class="t"></span>`; }
  const stack = document.getElementById('stackR'), qt = document.getElementById('questTrack');
  const anchor = card && card.parentNode === stack ? card : qt && qt.parentNode === stack ? qt : null;
  if (stack && (way.parentNode !== stack || (anchor && way.previousElementSibling !== anchor))) anchor ? anchor.after(way) : stack.prepend(way);
  const ob = app()?.state?.onSurface ? objective(md) : null, qw = qt?.style.display === 'block' ? qt.querySelector('.hxQw') : null;
  if (!ob) { way.classList.remove('on'); if (qw && qw.innerHTML) { qw.innerHTML = ''; qw.dataset.v = ''; } return; }
  const dx = ob.x - md.x, dz = ob.z - md.z, cy = Math.cos(md.yaw), sy = Math.sin(md.yaw), sx = dx * cy - dz * sy, sz = dx * sy + dz * cy, ang = Math.atan2(sx, -sz), d = Math.hypot(dx, dz);
  // a mission: the arrow + distance ride in the 📜 card's title row (no extra chip); a running job / turf fight: in its card line
  const jw = (ob.kind === 'job' || ob.kind === 'turf') && jobKind === ob.kind ? card?.querySelector('#hxJob.on .hxQw') : null;
  if (jw) {
    way.classList.remove('on');
    const v = d < 12 ? 'here' : fmtD(d); if (jw.dataset.v !== v || !jw.firstChild) { jw.dataset.v = v; jw.innerHTML = `${ARROW}<span>${v}</span>`; }
    jw.querySelector('.ar').style.transform = `rotate(${(ang * 180 / Math.PI).toFixed(0)}deg)`; jw.title = dirWord(ang); if (qw && qw.innerHTML) { qw.innerHTML = ''; qw.dataset.v = ''; } return;
  }
  if (ob.kind === 'quest' && qw) {
    way.classList.remove('on');
    const v = d < 12 ? 'here' : fmtD(d); if (qw.dataset.v !== v || !qw.firstChild) { qw.dataset.v = v; qw.innerHTML = `${ARROW}<span>${v}</span>`; }
    qw.querySelector('.ar').style.transform = `rotate(${(ang * 180 / Math.PI).toFixed(0)}deg)`; qw.title = dirWord(ang); return;
  }
  way.querySelector('.ar').style.transform = `rotate(${(ang * 180 / Math.PI).toFixed(0)}deg)`;
  const dn = districtName(ob.x, ob.z), lab = ob.kind === 'quest' ? '' : ` · ${ob.label}`;
  const txt = `<b>${fmtD(d)}</b> <span class="d">${d < 12 ? 'you are here' : dirWord(ang)}</span>${esc(lab)}${dn ? ` · ${esc(dn)}` : ''}`;
  const t = way.querySelector('.t'); if (t.dataset.v !== txt) { t.dataset.v = txt; t.innerHTML = txt; }
  way.classList.add('on'); way.dataset.kind = ob.kind;
}
// ---------- one mission card: 📜 quest + running job / turf fight + one 🏳️ quit ----------
// The jobs / turf modules keep rendering their own bars (#jobHud .l1/.l2, #turfHud .l1/.l2, hidden by our CSS); we fold that text
// into the card. If this file never loads, their bars simply show as before.
let card, jobEl, quitBtn, jobKind = '', cardKey = '';
const shown = id => { const e = document.getElementById(id); return e && e.classList.contains('show') ? e : null; };
function quitNow() {
  const T = window.SSX?.turf, J = window.SSX?.jobs, A = window.__activities;
  try { if (T?.fight?.()) { T.retreat(); tick(true); return; } } catch (e) { /* no turf */ }
  try { if (J?.active?.()) J.stop(); } catch (e) { /* no jobs */ }
  try { const a = A?.active; if (a && a.mode !== 'poker') document.getElementById('actCtxBtn')?.click(); } catch (e) { /* no side jobs */ } // its own quit handler
  tick(true);
}
function ensureCard() {
  const stack = document.getElementById('stackR'), qt = document.getElementById('questTrack'); if (!stack || !qt) return null;
  if (!card) {
    card = document.createElement('div'); card.id = 'hxCard';
    card.innerHTML = '<div class="hxCol"><div id="hxJob" aria-live="off"><div class="hxJh"><span class="l1"></span><span class="tm"></span><span class="hxQw"></span></div><div class="l2"></div></div></div><button id="hxQuit" type="button" aria-label="Quit job"><span class="i">🏳️</span><span class="w">Quit</span></button>';
    jobEl = card.querySelector('#hxJob'); quitBtn = card.querySelector('#hxQuit'); onTap(quitBtn, quitNow);
  }
  if (qt.parentNode !== card.firstChild) { qt.before(card); card.firstChild.append(qt); } // the 📜 card moves inside (same node, index.html keeps driving it)
  return card;
}
function updCard(md) {
  if (!ensureCard()) return;
  const turf = shown('turfHud'), job = shown('jobHud'), src = turf || job, qtOn = document.getElementById('questTrack').style.display === 'block';
  let actOn = false; try { const a = window.__activities?.active; actOn = !!a && a.mode !== 'poker'; } catch (e) { /* none */ }
  jobKind = turf ? 'turf' : job ? 'job' : '';
  if (src) {
    const tx = c => src.querySelector(c)?.textContent || '', warn = !!src.querySelector('.l1.warn');
    let l1 = tx('.l1'), l2 = tx('.l2'), tm = '';
    const grab = t => t.replace(/\s*·?\s*(⏱\s*\+?[\d:]+)\s*·?\s*/, (m, x) => { tm = x; return ' · '; }).replace(/^\s*·\s*|\s*·\s*$/g, '').trim();
    l1 = grab(l1); if (!tm) l2 = grab(l2);
    let ob = null; try { ob = md ? objective(md) : null; } catch (e) { /* none */ }
    // one line: icon + step + pay (no "TAXI · L1", no second distance: only the step the ➤ points at shows one, in this row's arrow)
    l2 = l2.replace(/\s*·\s*\d+\s*m\s+[NSEW]{1,2}\s*$/, '');
    if (jobKind === 'job') { const parts = l1.split(' · '), head = parts[0] || '', icon = head.split(' ')[0] || '', extra = parts.slice(1).filter(x => !/^L\d+$/.test(x.trim()));
      l1 = `${icon} ${l2 || head.slice(icon.length).trim()}${extra.length ? ' · ' + extra.join(' · ') : ''}`; }
    else if (l2) l1 = `${l1} · ${l2}`;
    l2 = '';
    if (ob?.kind !== jobKind) { const w = jobEl.querySelector('.hxQw'); if (w.innerHTML) { w.innerHTML = ''; w.dataset.v = ''; } } // the ➤ belongs to the 📜 step
    const key = `${l1}|${l2}|${tm}|${warn}`;
    if (key !== cardKey) { cardKey = key; jobEl.querySelector('.l1').textContent = l1; jobEl.title = l1; jobEl.querySelector('.l2').textContent = l2; const t = jobEl.querySelector('.tm'); t.textContent = tm; t.classList.toggle('warn', warn); }
  } else if (cardKey) { cardKey = ''; const w = jobEl.querySelector('.hxQw'); w.innerHTML = ''; w.dataset.v = ''; }
  jobEl.classList.toggle('on', !!src);
  const on = qtOn || !!src, quit = on && (!!src || actOn);
  card.classList.toggle('on', on); card.classList.toggle('box', !!src || quit); quitBtn.classList.toggle('on', quit);
  const ql = turf ? (document.getElementById('turfRetreat')?.textContent || 'Retreat') : 'Quit';
  if (quitBtn.lastChild.textContent !== ql) { quitBtn.lastChild.textContent = ql; quitBtn.setAttribute('aria-label', turf ? ql : 'Quit job'); }
  document.body.classList.toggle('hxCardOn', on); document.body.classList.toggle('hxQuitAct', quit && actOn);
}
// one context button: the three left-side action buttons (contraband deal, turf action, taxi/medic/bounty duty) all move to one
// slot above the right-hand cluster; only the top-priority one that wants to show is visible, ⇅ n cycles when several do.
// The real buttons stay the real buttons (their own handlers, keys and tests keep working); we only move/hide them.
const CTX = ['cbBtn', 'turfAct', 'jobAct']; // default priority: contraband deal > turf action > job duty
// ...but a running job (🩺 Stabilise, 🚕 fare) or turf fight outranks a passer-by deal: the task in hand wins the slot
const ctxOrder = () => { let o = CTX; try { if (window.SSX?.turf?.fight?.()) o = ['turfAct', ...o.filter(x => x !== 'turfAct')]; if (window.SSX?.jobs?.active?.()) o = ['jobAct', ...o.filter(x => x !== 'jobAct')]; } catch (e) {} return o; };
let ctxSet = '';
function updCtx() {
  if (!ctxNext) { ctxNext = document.createElement('button'); ctxNext.id = 'hxCtxNext'; ctxNext.type = 'button'; ctxNext.setAttribute('aria-label', 'Next action'); document.body.appendChild(ctxNext); onTap(ctxNext, () => { ctxPick++; tick(true); }); }
  const all = ctxOrder().map(id => document.getElementById(id)).filter(Boolean), list = all.filter(el => el.classList.contains('show'));
  const set = list.map(e => e.id).join(); if (set !== ctxSet) { ctxSet = set; ctxPick = 0; } // a new button showing up starts from the top pick again
  // sit just above the right-hand button cluster (never in the middle, never in the bottom-left radio slot)
  // portrait: right edge, just above the cluster. landscape: bottom edge, just left of the cluster (the middle stays clear)
  let top = innerHeight - 24, left = innerWidth; for (const id of ['surfBtns', 'fireBtn', 'meleeBtn']) { const r = document.getElementById(id)?.getBoundingClientRect(); if (r && r.height && r.right > innerWidth * 0.6) { top = Math.min(top, r.top); left = Math.min(left, r.left); } }
  const land = innerWidth > innerHeight, R = document.documentElement.style, sab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
  const b = land ? Math.round(12 + sab) : Math.max(24, Math.round(innerHeight - top + 10)), r = land && left < innerWidth ? Math.round(innerWidth - left + 10) : 8;
  if (R.getPropertyValue('--hx-ctx-bottom') !== `${b}px`) R.setProperty('--hx-ctx-bottom', `${b}px`);
  if (R.getPropertyValue('--hx-ctx-right') !== `${r}px`) R.setProperty('--hx-ctx-right', `${r}px`);
  const pick = list.length ? list[ctxPick % list.length] : null;
  for (const el of all) { el.classList.toggle('hxCtxOff', !!pick && el !== pick);
    if (!el.dataset.hxObs) { el.dataset.hxObs = '1'; new MutationObserver(() => updCtx()).observe(el, { attributes: true, attributeFilter: ['class'] }); } } // react the same frame a button shows
  ctxNext.textContent = `⇅ ${list.length}`; ctxNext.classList.toggle('show', list.length > 1);
  if (pick && list.length > 1) { const pr = pick.getBoundingClientRect(); // ⇅ sits beside (landscape) or on top of (portrait) the picked button
    ctxNext.style.right = land ? `${r + Math.round(pr.width || 120) + 8}px` : `${r}px`; ctxNext.style.bottom = land ? `${b}px` : `${b + Math.round(pr.height || 52) + 6}px`; }
}
const touch = () => document.body.classList.contains('touch') || matchMedia('(pointer:coarse)').matches;
const CTX_DOCK = ['dockRcn', 'dockSmg', 'dockSmgF']; // contextual dock actions: never folded into ☰
function updDock() {
  document.body.classList.toggle('hxFold', touch());
  const dock = document.getElementById('ssxDock'), menu = document.getElementById('roverMenu'); if (!dock || !menu) return;
  const norm = t => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  for (const b of dock.querySelectorAll('button[id]')) { if (CTX_DOCK.includes(b.id)) continue;
    const id = 'hxm_' + b.id; let m = document.getElementById(id);
    // the whole dock column lives in ▤ More; its ☰ twin (🎒 Stash, 🛢️ Vat House…) is hidden while More is up, so nothing shows twice
    const name = norm((b.getAttribute('aria-label') || '').replace(/\([^)]*\)\s*$/, ''));
    const twin = [...menu.querySelectorAll('button')].find(x => !x.classList.contains('hxDockItem') && (norm(x.textContent) === norm(b.textContent) || (name && norm(x.textContent).replace(/^\S+\s/, '') === name)));
    if (!m) { m = document.createElement('button'); m.id = id; m.type = 'button'; m.className = 'hxDockItem'; morePanel().appendChild(m);
      onTap(m, () => { setMore(false); menu.classList.remove('show'); b.click(); }); }
    let lab = (b.textContent || '').replace(/\s+/g, ' ').trim(); if (!/[a-z]/i.test(lab) && b.getAttribute('aria-label')) lab = `${lab} ${b.getAttribute('aria-label').replace(/\s*\([^)]*\)\s*$/, '')}`.trim(); // icon-only dock buttons (🎯) get their name
    if (m.textContent !== lab) m.textContent = lab;
    const shown = b.style.display !== 'none' && !b.hidden; m.classList.toggle('show', shown);
    if (twin) twin.classList.toggle('hxDup', shown); // a hidden dock item keeps its ☰ entry
  }
  updMore();
}
// ---------- v7.6 ▤ More: one black button folds the phone dock column; starts collapsed, remembers open/closed, closes on a pick ----------
const MORE_KEY = 'ssx.hudx.more';
let moreBtn = null, moreP = null;
function morePanel() {
  if (moreP) return moreP;
  moreP = document.createElement('div'); moreP.id = 'hxMoreP'; moreP.setAttribute('role', 'menu'); moreP.setAttribute('aria-label', 'More');
  moreBtn = document.createElement('button'); moreBtn.id = 'hxMore'; moreBtn.type = 'button'; moreBtn.textContent = '▤ More'; moreBtn.setAttribute('aria-haspopup', 'menu'); moreBtn.setAttribute('aria-expanded', 'false');
  document.body.appendChild(moreBtn); document.body.appendChild(moreP);
  onTap(moreBtn, () => setMore(!moreP.classList.contains('show')));
  return moreP;
}
function setMore(open) { if (!moreP) return; if (open && !moreBtn.classList.contains('avail')) open = false; moreP.classList.toggle('show', !!open); moreBtn.setAttribute('aria-expanded', String(!!open)); try { localStorage.setItem(MORE_KEY, open ? '1' : '0'); } catch (e) { /* private mode */ } }
function updMore() {
  if (!moreP) return; const b = document.body;
  const avail = touch() && b.classList.contains('surface') && !b.classList.contains('cinematic') && !b.classList.contains('indoors') && !!moreP.querySelector('button.show');
  b.classList.toggle('hxMoreOn', avail); // ☰ hides the twins of More's items only while More is reachable
  const on = avail && !document.getElementById('roverMenu')?.classList.contains('show');
  if (moreBtn.classList.contains('avail') !== on) { moreBtn.classList.toggle('avail', on); let open = false; try { open = localStorage.getItem(MORE_KEY) === '1'; } catch (e) { /* none */ } moreP.classList.toggle('show', on && open); moreBtn.setAttribute('aria-expanded', String(on && open)); }
}
// ---------- v7.6 tap guard for scrolling sheets (☰, shop, farm, any panel): a swipe never fires the button it started on ----------
// Capture phase on window runs before every handler (window.__onTap, registerMenuItem, the modules' own tap helpers, plain click).
// A touch that moved > 10 px, or whose sheet scrolled, or that lands < 150 ms after a scroll, becomes a pointercancel + no click.
const TAP_SLOP = 10, SCROLL_QUIET = 150;
function scrollers(el) { const o = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) o.push([e, e.scrollTop, e.scrollLeft]); } } return o; }
function installTapGuard() {
  if (window.__hxTapGuard) return; window.__hxTapGuard = true;
  let down = null, blockClick = 0, blockSc = null; const lastS = new WeakMap(); // per scroller: a log that auto-scrolls elsewhere never blocks this sheet
  const now = () => performance.now(), recent = sc => sc.some(([el]) => now() - (lastS.get(el) ?? -1e9) < SCROLL_QUIET);
  addEventListener('scroll', e => { const t = e.target; if (t && t.nodeType === 1) lastS.set(t, now()); }, true);
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.__hx) { return; } const sc = scrollers(e.target); down = sc.length ? { id: e.pointerId, x: e.clientX, y: e.clientY, sc, quiet: recent(sc) } : null; }, true);
  addEventListener('pointermove', e => { if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP) down.moved = true; }, true);
  addEventListener('pointerup', e => {
    if (!down || e.pointerId !== down.id || e.__hx) return; const d = down; down = null;
    const bad = d.quiet || d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP || recent(d.sc) || d.sc.some(([el, t, l]) => Math.abs(el.scrollTop - t) > 1 || Math.abs(el.scrollLeft - l) > 1);
    if (!bad) return;
    e.stopImmediatePropagation(); e.preventDefault(); blockClick = now() + 700; blockSc = d.sc.map(([el]) => el);
    try { const c = new PointerEvent('pointercancel', { pointerId: e.pointerId, pointerType: e.pointerType, bubbles: true, clientX: e.clientX, clientY: e.clientY }); c.__hx = true; e.target.dispatchEvent(c); } catch (er) { /* old WebKit */ }
  }, true);
  addEventListener('pointercancel', e => { if (down && e.pointerId === down.id && !e.__hx) down = null; }, true);
  // v7.5.9: the late click of a guarded swipe is swallowed only inside that same sheet; a tap on ☰ (or anything else) right after a flick still lands
  addEventListener('click', e => { if ((now() < blockClick && blockSc?.some(el => el.contains(e.target))) || (e.isTrusted && e.detail !== 0 && recent(scrollers(e.target)))) { blockClick = 0; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
function tick(force) {
  const now = performance.now(); if (!force && now - lastT < 140) return; lastT = now;
  if (!app()?.state) return;
  const md = app().state.onSurface ? mapData() : null;
  try { updCard(md); } catch (e) { /* card is optional */ }
  if (md) updWay(md); else way?.classList.remove('on');
  updCtx(); if (!force) updDock();
}
function mini(mode) {
  if (mode === 'lite' || mode === 'full') { S.mini = mode; save(); }
  return S.mini;
}
export const hudx = {
  mini, openMap: () => openMap(api()), closeMap, mapOpen, objective, setWaypoint, pois, questHtml, drawMini, plainStep,
  waypoint: () => S.wp, radioSlot: () => ({ ...RADIO_SLOT }), state: () => ({ mini: S.mini, filters: { ...S.filters }, wp: S.wp })
};
function api() { return { S, save, objective, pois, setWaypoint, mapData, info, app, esc, fmtD, onTap, mini, plainStep }; }
function boot() {
  if (!window.__app || !window.SSX || !document.getElementById('stackR')) { setTimeout(boot, 300); return; }
  if (window.SSX.hudx) return;
  const st = document.createElement('style'); st.id = 'hudxCss'; st.textContent = css; document.head.appendChild(st);
  document.body.classList.add('hudx'); window.SSX.hudx = hudx; installTapGuard();
  // v7.6: no "(T)" style key hints in toasts on phones; guarded, index.html untouched (the rewrite no longer matches, so it settles)
  try { const t = document.getElementById('toast'); if (t && window.MutationObserver) new MutationObserver(() => { if (!document.body.classList.contains('touch')) return; const v = t.textContent, n = noKeys(v); if (n !== v) t.textContent = n; }).observe(t, { childList: true, characterData: true, subtree: true }); } catch (e) { /* toast keeps its text */ }
  setInterval(() => tick(false), 150);
}
boot();
