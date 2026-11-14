// v7.5.5 full-screen map (Snuffles). v7.5.101: one-finger pan, pinch zoom, drag and wheel, a Me button,
// filters All / Activities / Crime / Owned / Shops, and a card when you tap a place.
// North-up. The list under the map is how fast travel finds a place (mars/fasttravel.js). ☰ stays on the header.
let el = null, cv = null, X = null, raf = 0, zoom = 1, center = null;
const MODES = [['all', 'All'], ['activities', 'Activities'], ['crime', 'Crime'], ['owned', 'Owned'], ['shops', 'Shops']];
const css = `
#hxMap{position:fixed;inset:0;z-index:30;display:none;flex-direction:column;background:#05070f;color:#fff;font:600 15px/1.35 system-ui,sans-serif;
 padding:calc(6px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));box-sizing:border-box;gap:6px}
#hxMap.on{display:flex}
body.hxMapOpen :is(#fireBtn,#meleeBtn,#joy,#surfBtns,#petBtn,#driveBtn){visibility:hidden}
#hxMap button{min-height:48px;min-width:48px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 15px system-ui,sans-serif;touch-action:manipulation;padding:0 10px}
#hxMap .hd{display:flex;gap:6px;align-items:center} #hxMap .hd h2{flex:1;margin:0;font-size:18px}
#hxMap .chips{display:flex;gap:6px;flex-wrap:wrap} #hxMap .chips button{flex:1 1 30%;padding:0 6px}
#hxMap .chips button[aria-pressed="false"]{border-color:#555;color:#bbb}
#hxMap .body{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px}
#hxMap .cvw{position:relative;flex:1 1 auto;min-height:42vh;border-radius:12px;overflow:hidden;border:1px solid #334}
#hxMap canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;z-index:auto}
#hxMap .zm{position:absolute;right:6px;top:6px;display:flex;flex-direction:column;gap:6px}
#hxMap .lg{font:600 12px/1.4 system-ui,sans-serif;color:#cbd5e1;display:flex;flex-wrap:wrap;gap:2px 10px}
#hxMap .lst{flex:0 1 30%;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:5px;-webkit-overflow-scrolling:touch}
#hxMap .it{display:flex;align-items:center;gap:8px;text-align:left;min-height:48px;width:100%;padding:4px 10px}
#hxMap .it .ic{font-size:18px;width:24px;text-align:center;flex:none} #hxMap .it .nm{flex:1;min-width:0} #hxMap .it small{display:block;font-weight:500;color:#aab;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#hxMap .it .ds{font-size:12px;color:#9fe8ff;flex:none}
#hxMap .it.act{border-color:#38e1ff;background:#06222b} #hxMap .it.wp{border-color:#facc15}
#hxLoc{position:absolute;left:8px;right:8px;bottom:8px;z-index:4;display:none;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff}
#hxLoc.on{display:flex} #hxLoc .nm{font:800 17px system-ui,sans-serif} #hxLoc .do,#hxLoc .pay{margin:0;font-size:14px}
#hxLoc #hxLocFly{width:100%}
#hxLoc .row{display:flex;gap:8px;flex-wrap:wrap} #hxLoc .row button{flex:1 1 120px}
@media (orientation:landscape){#hxMap .body{flex-direction:row} #hxMap .cvw{height:auto;flex:0 0 min(55vw,calc(100vh - 140px));min-height:0;aspect-ratio:1} #hxMap .side{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px} #hxMap .lst{flex:1;max-height:none}}
@media (orientation:portrait){#hxMap .side{flex:0 1 32%;min-height:0;display:flex;flex-direction:column;gap:6px}}
`;
let A = null; // api from hudx.js
function build() {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'hxMap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Map');
  el.innerHTML = `<div class="hd"><h2>🗺️ Map</h2><button id="hxMapMini" type="button"></button><button id="hxMapMenu" type="button" aria-label="Menu">☰</button><button id="hxMapClose" type="button" aria-label="Close map">✕</button></div>
<div class="chips">${MODES.map(([k, l]) => `<button type="button" data-mode="${k}">${l}</button>`).join('')}</div>
<div class="body"><div class="cvw"><canvas></canvas><div class="zm"><button type="button" data-z="1.6" aria-label="Zoom in">＋</button><button type="button" data-z="0.625" aria-label="Zoom out">－</button><button type="button" id="hxMapMe" data-z="0" aria-label="Recenter on me">Me</button></div>
<div id="hxLoc" role="dialog" aria-label="Place"><div class="nm"></div><p class="do"></p><p class="pay"></p><button type="button" id="hxLocFly">Fly ship here</button><div class="row"><button type="button" id="hxLocWp">Set waypoint</button><button type="button" id="hxLocBeam">Beam there</button><button type="button" id="hxLocX" aria-label="Close place">✕</button></div></div></div>
<div class="side"><div class="lg"><span>Drag to move. Pinch or scroll to zoom.</span><span>➤ you</span><span>◆ objective</span><span>$ shop</span></div>
<div class="lst" role="list"></div></div></div>`;
  document.body.appendChild(el); cv = el.querySelector('canvas'); X = cv.getContext('2d');
  A.onTap(el.querySelector('#hxMapClose'), () => closeMap());
  A.onTap(el.querySelector('#hxMapMenu'), () => { closeMap(); setTimeout(() => A.app()?.toggleMenu?.(true), 350); });
  A.onTap(el.querySelector('#hxMapMini'), () => { A.mini(A.mini() === 'lite' ? 'full' : 'lite'); paintHead(); });
  for (const b of el.querySelectorAll('.chips button')) A.onTap(b, () => { A.S.mapMode = b.dataset.mode; A.save(); paintHead(); list(); hideCard(); });
  for (const b of el.querySelectorAll('.zm button')) A.onTap(b, () => { const z = +b.dataset.z; if (z) zoom = Math.max(0.35, Math.min(8, zoom * z)); else { zoom = 1.4; center = null; } });
  A.onTap(el.querySelector('#hxLocFly'), () => { if (cardP) window.SSX?.shiphop?.fromMap?.(cardP); });
  A.onTap(el.querySelector('#hxLocWp'), () => { if (cardP) setWp(cardP); });
  A.onTap(el.querySelector('#hxLocBeam'), () => { if (cardP) window.SSX?.fastTravel?.offer?.(cardP); });
  A.onTap(el.querySelector('#hxLocX'), () => hideCard());
  wirePan();
}
function paintHead() {
  el.querySelector('#hxMapMini').textContent = A.mini() === 'lite' ? 'Minimap: Lite' : 'Minimap: Full';
  const mode = A.S.mapMode || 'all';
  for (const b of el.querySelectorAll('.chips button')) b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
}
let shown = [], view = null, cardP = null;
function groupsOf(p) {
  const g = new Set();
  const blob = `${p.cat || ''} ${p.name || ''} ${p.sub || ''} ${p.ft || ''} ${p.id || ''}`;
  if (p.cat === 'shops' || p.icon === '$' || /shop|trading post/i.test(blob)) g.add('shops');
  if (p.cat === 'missions' || p.cat === 'races' || /taxi|clinic|race|contact|activity/i.test(blob)) g.add('activities');
  if (p.icon === '🏴' || /your base|your turf|your farm|homestead/i.test(blob) || /^(base|farm|turf):/.test(String(p.ft || p.id || ''))) g.add('owned');
  if (p.cat === 'crime' || p.empire || /contraband|bounty|vigilante|heist|crime|pit|fight/i.test(blob)) g.add('crime');
  if (/velvet|club|pit/i.test(blob)) g.add('activities');
  if (!g.size) g.add('activities');
  return g;
}
function payLine(p) {
  if (p.pay) return p.pay;
  const sub = p.sub || '';
  const fee = sub.match(/(\d+)\s*cr/);
  if (/fast travel/i.test(sub)) return fee ? `Beam: ${fee[1]} cr` : 'Beam: free';
  if (p.cat === 'shops') return 'Prices are on the counter.';
  if (/race/i.test(sub)) return 'Prize is on the race board.';
  return sub || 'No fee.';
}
function doLine(p) {
  if (p.ft) return 'Beam here, or set a waypoint and go yourself.';
  if (p.active) return p.sub || 'This is what you are doing now.';
  if (/pit/i.test(p.name || '')) return 'Watch a fight, place a bet, or step in yourself.';
  if (/velvet|club/i.test(p.name || '')) return 'Club, jobs, and the boss lounge once you own it.';
  if (p.cat === 'shops') return 'Buy gear, guns, or a ride.';
  if (p.icon === '🏴') return 'A business or block you already hold.';
  if (p.cat === 'races' || /race/i.test(p.sub || '')) return 'Run the race.';
  return p.sub || 'Go there and use what is on the spot.';
}
function showOf(md) {
  const mode = A.S.mapMode || 'all';
  const items = [...A.pois(true), ...(window.SSX?.fastTravel?.mapPlaces?.() || []), ...(window.SSX?.empirePrompt?.mapPlaces?.() || [])].map(p => ({ ...p, d: Math.hypot(p.x - md.x, p.z - md.z) }));
  return items.filter(p => mode === 'all' || groupsOf(p).has(mode)).sort((a, b) => a.d - b.d);
}
function setWp(p) {
  const ob = A.objective();
  const busy = ob && ob.kind !== 'waypoint';
  A.setWaypoint({ x: p.x, z: p.z, label: p.name }, busy);
  closeMap();
  if (busy) A.app()?.toast?.(`📍 Waypoint set: ${p.name}. Your mission marker still wins until it is done.`, 2600);
}
function hideCard() { cardP = null; el?.querySelector('#hxLoc')?.classList.remove('on'); }
function openCard(p) {
  if (!p || p.active) { if (p?.active) closeMap(); return; }
  cardP = p;
  const box = el.querySelector('#hxLoc');
  box.querySelector('.nm').textContent = `${p.icon || ''} ${p.name}`.trim();
  box.querySelector('.do').textContent = doLine(p);
  box.querySelector('.pay').textContent = payLine(p);
  const beam = box.querySelector('#hxLocBeam');
  const can = !!(p.ft && window.SSX?.fastTravel?.offer);
  beam.style.display = can ? '' : 'none';
  const fly = box.querySelector('#hxLocFly');
  const mars = A.app()?.surface?.info?.name === 'Mars' && Number.isFinite(p.x);
  fly.style.display = mars ? '' : 'none';
  box.classList.add('on');
}
function choose(p) {
  if (p.active) { closeMap(); return; }
  if (window.SSX?.fastTravel?.offer?.(p)) return; // list rows of known places keep the Travel here sheet
  openCard(p);
}
function list() {
  const md = A.mapData(), L = el.querySelector('.lst'); if (!md) { L.innerHTML = '<div>Land somewhere first.</div>'; return; }
  const ob = A.objective(md), wp = A.S.wp;
  const items = showOf(md);
  const rows = [];
  if (ob && (A.S.mapMode || 'all') === 'all') rows.push({ id: 'active', icon: '◆', name: ob.label, sub: ob.kind === 'quest' ? A.plainStep(A.app()?.surface?.game?.info?.quest?.text || '').text : 'Active objective', x: ob.x, z: ob.z, d: Math.hypot(ob.x - md.x, ob.z - md.z), active: true });
  shown = [...rows, ...items.slice(0, 80)];
  L.innerHTML = shown.map((p, i) => `<button type="button" role="listitem" class="it${p.active ? ' act' : ''}${wp && !p.active && Math.hypot(wp.x - p.x, wp.z - p.z) < 1 ? ' wp' : ''}" data-i="${i}"><span class="ic">${A.esc(p.icon)}</span><span class="nm">${p.active ? '<b style="color:#38e1ff">ACTIVE · </b>' : ''}${A.esc(p.name)}<small>${A.esc(p.sub || '')}</small></span><span class="ds">${A.fmtD(p.d)}</span></button>`).join('')
    || '<div style="color:#aab;padding:8px">Nothing here with this filter.</div>';
  for (const b of L.querySelectorAll('.it')) A.onTap(b, () => choose(shown[+b.dataset.i]));
}
function nearestAt(sx, sy) {
  if (!view) return null; let best = null, bd = 28;
  for (const p of shown) { if (p.active) continue; const q = view.toS(p.x, p.z), d = Math.hypot(q[0] - sx, q[1] - sy); if (d < bd) { bd = d; best = p; } } return best;
}
const fingers = new Map();
let pinch = null;
function wirePan() {
  const down = e => {
    if (e.target.closest && e.target.closest('#hxLoc, .zm, .lst, .hd, .chips')) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0 });
    try { cv.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic taps have no live pointer */ }
    pinch = null;
  };
  const move = e => {
    const f = fingers.get(e.pointerId); if (!f) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y; f.x = e.clientX; f.y = e.clientY; f.moved += Math.hypot(dx, dy);
    if (fingers.size >= 2) {
      const pts = [...fingers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!pinch) pinch = dist;
      else if (pinch > 8) { zoom = Math.max(0.35, Math.min(8, zoom * (dist / pinch))); pinch = dist; }
      return;
    }
    if (f.moved < 4) return;
    const md = A.mapData(); if (!md) return;
    if (!center) center = { x: md.x, z: md.z };
    const k = view?.k || 1;
    center.x -= dx / k; center.z -= dy / k;
  };
  const up = e => {
    const f = fingers.get(e.pointerId); fingers.delete(e.pointerId); pinch = null;
    if (!f || f.moved > 10 || !cv) return;
    const r = cv.getBoundingClientRect();
    const hit = nearestAt(e.clientX - r.left, e.clientY - r.top);
    if (hit) openCard(hit);
  };
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  addEventListener('pointerup', up, true);
  addEventListener('pointercancel', e => { fingers.delete(e.pointerId); pinch = null; }, true);
  cv.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(0.35, Math.min(8, zoom * (e.deltaY > 0 ? 0.9 : 1.12))); }, { passive: false });
}
function draw() {
  if (!el?.classList.contains('on')) return; raf = requestAnimationFrame(draw);
  const md = A.mapData(); if (!md) return;
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = X, cx0 = center ? center.x : md.x, cz0 = center ? center.z : md.z, k = Math.min(w, h) / (900 / zoom); // ~900 m across at zoom 1 (the whole of Ares Junction + districts)
  const toS = (x, z) => [w / 2 + (x - cx0) * k, h / 2 + (z - cz0) * k]; view = { toS, k };
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
  zoom = 1.4; center = null; if (!A.S.mapMode) A.S.mapMode = 'all'; hideCard(); paintHead(); list(); el.classList.add('on'); document.body.classList.add('hxMapOpen');
  if (document.pointerLockElement) document.exitPointerLock();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); return true;
}
addEventListener('keydown', e => { if (e.key === 'Escape' && mapOpen()) { e.stopPropagation(); closeMap(); } }, true);
export function closeMap() { if (!el) return; el.classList.remove('on'); document.body.classList.remove('hxMapOpen'); cancelAnimationFrame(raf); hideCard(); }
export const mapOpen = () => !!el?.classList.contains('on');
if (typeof window !== 'undefined') window.__hxMapDebug = {
  zoom: () => zoom, center: () => center && { ...center }, mode: () => A?.S?.mapMode || 'all', card: () => cardP?.name || '',
  pan(dx, dy) { const md = A?.mapData?.(); if (!md) return null; if (!center) center = { x: md.x, z: md.z }; const k = view?.k || 1; center.x -= dx / k; center.z -= dy / k; return { ...center }; },
  recenter() { center = null; zoom = 1.4; return true; },
  openCard() { const p = shown.find(x => x.ft) || shown.find(x => !x.active); if (p) openCard(p); return cardP?.name || ''; },
  waypoint() { if (!cardP) return false; setWp(cardP); return true; }
};
