// v7.5.5 full-screen map (Snuffles). Opened by tapping the minimap (hud/hudx.js wires it). North-up, centred on you.
// Legend, filter chips (Missions / Shops / Races / Turf), the ACTIVE objective highlighted, and a tappable list of everything
// you can do: tap one to set a waypoint (the ➤ arrow under the mission card then points at it). ☰ Menu keeps the old minimap tap.
let el = null, cv = null, X = null, raf = 0, zoom = 1, center = null;
const CATS = [['missions', '📋 Missions'], ['shops', '$ Shops'], ['races', '🏁 Races'], ['turf', '🚩 Turf']];
const css = `
#hxMap{position:fixed;inset:0;z-index:30;display:none;flex-direction:column;background:rgba(4,6,14,.96);color:#fff;font:600 14px system-ui,sans-serif;
 padding:calc(6px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));box-sizing:border-box;gap:6px}
#hxMap.on{display:flex}
#hxMap button{min-height:44px;min-width:44px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation;padding:0 10px}
#hxMap .hd{display:flex;gap:6px;align-items:center} #hxMap .hd h2{flex:1;margin:0;font-size:17px}
#hxMap .chips{display:flex;gap:6px;flex-wrap:wrap} #hxMap .chips button{flex:1 1 0;padding:0 4px}
#hxMap .chips button[aria-pressed="false"]{border-color:#555;color:#999}
#hxMap .body{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px}
#hxMap .cvw{position:relative;flex:0 0 auto;height:min(44vh,calc(100vw - 16px));border-radius:12px;overflow:hidden;border:1px solid #334}
#hxMap canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;z-index:auto}
#hxMap .zm{position:absolute;right:6px;top:6px;display:flex;flex-direction:column;gap:6px}
#hxMap .lg{font:600 11px/1.5 system-ui,sans-serif;color:#cbd5e1;display:flex;flex-wrap:wrap;gap:2px 10px}
#hxMap .lst{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:5px;-webkit-overflow-scrolling:touch}
#hxMap .it{display:flex;align-items:center;gap:8px;text-align:left;min-height:48px;width:100%;padding:4px 10px}
#hxMap .it .ic{font-size:18px;width:24px;text-align:center;flex:none} #hxMap .it .nm{flex:1;min-width:0} #hxMap .it small{display:block;font-weight:500;color:#aab;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#hxMap .it .ds{font-size:12px;color:#9fe8ff;flex:none}
#hxMap .it.act{border-color:#38e1ff;background:#06222b} #hxMap .it.wp{border-color:#facc15}
@media (orientation:landscape){#hxMap .body{flex-direction:row} #hxMap .cvw{height:auto;flex:0 0 min(55vw,calc(100vh - 120px));aspect-ratio:1} #hxMap .side{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}}
@media (orientation:portrait){#hxMap .side{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px}}
`;
let A = null; // api from hudx.js
function build() {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'hxMap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Map');
  el.innerHTML = `<div class="hd"><h2>🗺️ Map</h2><button id="hxMapMini" type="button"></button><button id="hxMapMenu" type="button" aria-label="Menu">☰</button><button id="hxMapClose" type="button" aria-label="Close map">✕</button></div>
<div class="chips">${CATS.map(([k, l]) => `<button type="button" data-cat="${k}">${l}</button>`).join('')}</div>
<div class="body"><div class="cvw"><canvas></canvas><div class="zm"><button type="button" data-z="1.6" aria-label="Zoom in">＋</button><button type="button" data-z="0.625" aria-label="Zoom out">－</button><button type="button" data-z="0" aria-label="Centre on me">◎</button></div></div>
<div class="side"><div class="lg"><span><b style="color:#fff">➤</b> you</span><span><b style="color:#38e1ff">◆</b> active objective</span><span><b style="color:#facc15">◆</b> your waypoint / race ring</span><span>📋 mission</span><span>💬 contact</span><span>🚕🚑🎯 jobs</span><span>🏁 race</span><span>🚩 turf</span><span><b style="color:#4ade80">$</b> shop</span><span><b style="color:#ff4b4b">●</b> enemy</span></div>
<div class="lst" role="list"></div></div></div>`;
  document.body.appendChild(el); cv = el.querySelector('canvas'); X = cv.getContext('2d');
  A.onTap(el.querySelector('#hxMapClose'), () => closeMap());
  A.onTap(el.querySelector('#hxMapMenu'), () => { closeMap(); setTimeout(() => A.app()?.toggleMenu?.(true), 350); }); // after the tap's trailing click
  A.onTap(el.querySelector('#hxMapMini'), () => { A.mini(A.mini() === 'lite' ? 'full' : 'lite'); paintHead(); });
  for (const b of el.querySelectorAll('.chips button')) A.onTap(b, () => { const k = b.dataset.cat; A.S.filters[k] = A.S.filters[k] ? 0 : 1; A.save(); paintHead(); list(); });
  for (const b of el.querySelectorAll('.zm button')) A.onTap(b, () => { const z = +b.dataset.z; if (z) zoom = Math.max(0.25, Math.min(6, zoom * z)); else { zoom = 1.4; center = null; } });
  // tap a marker on the map: same as tapping it in the list
  cv.addEventListener('pointerup', e => { const r = cv.getBoundingClientRect(), hit = nearestAt(e.clientX - r.left, e.clientY - r.top); if (hit) choose(hit); });
}
function paintHead() {
  el.querySelector('#hxMapMini').textContent = A.mini() === 'lite' ? 'Minimap: Lite' : 'Minimap: Full';
  for (const b of el.querySelectorAll('.chips button')) b.setAttribute('aria-pressed', A.S.filters[b.dataset.cat] ? 'true' : 'false');
}
let shown = [], view = null;
function choose(p) {
  if (!p.active && window.SSX?.fastTravel?.offer?.(p)) return; // mars/fasttravel.js: a known place -> its 🚀 Travel here sheet (guarded)
  const ob = A.objective(); if (p.active) { closeMap(); return; }
  if (A.S.wp && Math.hypot(A.S.wp.x - p.x, A.S.wp.z - p.z) < 1) { A.setWaypoint(null); A.app()?.toast?.('📍 Waypoint cleared.', 1600); list(); return; }
  const busy = ob && ob.kind !== 'waypoint'; A.setWaypoint({ x: p.x, z: p.z, label: p.name }, busy); closeMap();
  if (busy) A.app()?.toast?.(`📍 Waypoint set: ${p.name}. Your mission marker still wins until it's done.`, 2600);
}
function list() {
  const md = A.mapData(), L = el.querySelector('.lst'); if (!md) { L.innerHTML = '<div>Land somewhere first.</div>'; return; }
  const ob = A.objective(md), wp = A.S.wp, f = A.S.filters;
  const items = [...A.pois(true), ...(window.SSX?.fastTravel?.mapPlaces?.() || [])].filter(p => f[p.cat] || p.ft).map(p => ({ ...p, d: Math.hypot(p.x - md.x, p.z - md.z) })).sort((a, b) => a.d - b.d); // + mars/fasttravel.js places (guarded)
  const rows = [];
  if (ob) rows.push({ id: 'active', icon: '◆', name: ob.kind === 'quest' ? `${ob.label}` : ob.label, sub: ob.kind === 'quest' ? A.plainStep(A.app()?.surface?.game?.info?.quest?.text || '').text : 'Active objective', x: ob.x, z: ob.z, d: Math.hypot(ob.x - md.x, ob.z - md.z), active: true });
  shown = [...rows, ...items.slice(0, 60)];
  L.innerHTML = shown.map((p, i) => `<button type="button" role="listitem" class="it${p.active ? ' act' : ''}${wp && !p.active && Math.hypot(wp.x - p.x, wp.z - p.z) < 1 ? ' wp' : ''}" data-i="${i}"><span class="ic">${A.esc(p.icon)}</span><span class="nm">${p.active ? '<b style="color:#38e1ff">ACTIVE · </b>' : ''}${A.esc(p.name)}<small>${A.esc(p.sub || '')}</small></span><span class="ds">${A.fmtD(p.d)}</span></button>`).join('')
    || '<div style="color:#aab;padding:8px">Nothing here with these filters.</div>';
  for (const b of L.querySelectorAll('.it')) A.onTap(b, () => choose(shown[+b.dataset.i]));
}
function nearestAt(sx, sy) {
  if (!view) return null; let best = null, bd = 26;
  for (const p of shown) { const q = view.toS(p.x, p.z), d = Math.hypot(q[0] - sx, q[1] - sy); if (d < bd) { bd = d; best = p; } } return best;
}
function draw() {
  if (!el?.classList.contains('on')) return; raf = requestAnimationFrame(draw);
  const md = A.mapData(); if (!md) return;
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = X, cx0 = center ? center.x : md.x, cz0 = center ? center.z : md.z, k = Math.min(w, h) / (900 / zoom); // ~900 m across at zoom 1 (the whole of Ares Junction + districts)
  const toS = (x, z) => [w / 2 + (x - cx0) * k, h / 2 + (z - cz0) * k]; view = { toS };
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#0b0f1c'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1; const g = 100 * k; for (let x = (w / 2 - cx0 * k) % g; x < w; x += g) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = (h / 2 - cz0 * k) % g; y < h; y += g) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  const W = md.world || {};
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const d of W.districts || []) { const x = d.x ?? d.cx, z = d.z ?? d.cz; if (x == null) continue; const p = toS(x, z), r = (d.r || 80) * k; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fillStyle = 'rgba(255,155,90,0.07)'; c.fill(); c.strokeStyle = 'rgba(255,155,90,0.35)'; c.stroke();
    c.font = '800 12px system-ui'; c.fillStyle = 'rgba(255,200,160,0.8)'; c.fillText(d.name || '', p[0], p[1] - r - 8 > 8 ? p[1] - r - 8 : p[1]); }
  if (W.colony) { const p = toS(W.colony.x, W.colony.z); c.beginPath(); c.arc(p[0], p[1], Math.max(6, 26 * k), 0, Math.PI * 2); c.strokeStyle = '#ff9b5a'; c.lineWidth = 2; c.stroke(); c.lineWidth = 1; }
  for (const a of md.aliens || []) { const p = toS(a.x, a.z); c.beginPath(); c.arc(p[0], p[1], 3, 0, Math.PI * 2); c.fillStyle = '#ff4b4b'; c.fill(); }
  c.font = '15px system-ui';
  for (const p of shown) { if (p.active) continue; const q = toS(p.x, p.z); if (q[0] < -10 || q[1] < -10 || q[0] > w + 10 || q[1] > h + 10) continue;
    if (p.icon === '$') { c.font = '900 15px system-ui'; c.lineWidth = 3; c.strokeStyle = '#06210f'; c.strokeText('$', q[0], q[1]); c.fillStyle = '#4ade80'; c.fillText('$', q[0], q[1]); c.font = '15px system-ui'; continue; }
    c.beginPath(); c.arc(q[0], q[1], 11, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.8)'; c.fill(); c.strokeStyle = '#fff'; c.stroke(); c.fillStyle = '#fff'; c.fillText(p.icon, q[0], q[1] + 1); }
  const now = performance.now(), ob = A.objective(md), wp = A.S.wp;
  const diamond = (p, col, s) => { c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 4); c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2; c.fillRect(-s, -s, 2 * s, 2 * s); c.strokeRect(-s, -s, 2 * s, 2 * s); c.restore(); };
  if (wp && (!ob || ob.kind !== 'waypoint')) diamond(toS(wp.x, wp.z), '#facc15', 6);
  if (ob) { const p = toS(ob.x, ob.z), pr = 14 + 5 * Math.sin(now / 200); c.beginPath(); c.arc(p[0], p[1], pr, 0, Math.PI * 2); c.strokeStyle = 'rgba(56,225,255,0.8)'; c.lineWidth = 2; c.stroke(); diamond(p, ob.kind === 'race' || ob.kind === 'waypoint' ? '#facc15' : '#38e1ff', 8);
    const me = toS(md.x, md.z); c.setLineDash([6, 6]); c.beginPath(); c.moveTo(me[0], me[1]); c.lineTo(p[0], p[1]); c.strokeStyle = 'rgba(56,225,255,0.6)'; c.stroke(); c.setLineDash([]); }
  const me = toS(md.x, md.z); c.save(); c.translate(me[0], me[1]); c.rotate(-md.yaw); c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke(); c.restore();
  c.font = '700 11px system-ui'; c.fillStyle = 'rgba(255,255,255,0.7)'; c.textAlign = 'left'; c.fillText('N ↑', 8, 12);
}
export function openMap(api) {
  A = api; if (!A?.app()?.state?.onSurface) { A?.app()?.toggleMenu?.(); return false; }
  if (!el) build();
  zoom = 1.4; center = null; paintHead(); list(); el.classList.add('on'); document.body.classList.add('hxMapOpen');
  if (document.pointerLockElement) document.exitPointerLock();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); return true;
}
addEventListener('keydown', e => { if (e.key === 'Escape' && mapOpen()) { e.stopPropagation(); closeMap(); } }, true);
export function closeMap() { if (!el) return; el.classList.remove('on'); document.body.classList.remove('hxMapOpen'); cancelAnimationFrame(raf); }
export const mapOpen = () => !!el?.classList.contains('on');
