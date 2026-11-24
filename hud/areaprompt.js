// v7.5.139 one walk-up prompt. The nearest person, table, or door gets a thumb button and a glow.
// Desktop uses E. Menu entries for those places sit under More places.
import * as THREE from 'three';

const MENUS = ['rmBrawl', 'rmVtake', 'rmPaddle', 'rmBingo', 'rmVelvet', 'rmSilt', 'rmFarm2'];
const HIDE = '#vtakeAct,#siltAct,#sworkAct,#f2Act';
const app = () => window.__app;
const surf = () => app()?.surface;
const world = () => surf()?.world;

let btn = null, ring = null, current = null;

function clean(s) {
  return String(s || '').replace(/^\s*\p{Extended_Pictographic}\s*/u, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}
function me() {
  const i = surf()?.info;
  return i && Number.isFinite(i.x) ? i : null;
}
function dist(p, x, z) { return Math.hypot(p.x - x, p.z - z); }

function candidates() {
  const p = me(), w = world();
  if (!p || !w || !app()?.state?.onSurface) return [];
  const out = [];
  const push = c => { if (c && Number.isFinite(c.x) && Number.isFinite(c.z) && c.label) out.push(c); };
  if (p.inside) {
    for (const s of w.spotList?.() || []) {
      if (s.act === 'leave') continue;
      push({ id: s.id, label: clean(s.label), x: s.x, z: s.z, r: s.r, go: () => window.SSX?.actSpot?.(s.spot), inside: true });
    }
    const ins = w.inside;
    if (ins?.kind === 'club') push({ id: 'brawl', label: 'Brawl Brick Moll', x: ins.ax - 6, z: ins.az + 6, r: 3.4, go: () => window.SSX?.velvetBrawl?.open(), inside: true, menu: 'rmBrawl' });
  } else {
    const door = w.nearDoor?.(6);
    if (door) push({ id: 'door-' + door.kind, label: 'Enter ' + String(door.name || 'door').replace(/^The\s+/i, ''), x: door.x, z: door.z, r: 6, go: () => surf().enterBuilding?.(door) });
    const shop = w.nearestStore?.();
    if (shop && shop.dist < 8) push({ id: 'shop-' + shop.kind, label: 'Shop · ' + (shop.name || 'counter'), x: shop.x, z: shop.z, r: 8, go: () => surf().enterBuilding?.(shop.door) });
    const silt = window.SSX?.silt;
    const sp = silt?.place?.();
    if (sp && dist(p, sp.x, sp.z) < 8) push({ id: 'silt', label: "Silt's debt", x: sp.x, z: sp.z, r: 8, go: () => silt.act?.(), menu: 'rmSilt' });
    const take = window.SSX?.velvetTake;
    const tp = take?.place?.();
    if (tp && dist(p, tp.x, tp.z) < 9) {
      const st = take.state?.() || {};
      const label = st.demoted ? 'Visit Ines' : st.step === 1 ? 'Take the Velvet' : 'Talk to Ines';
      push({ id: 'vtake', label, x: tp.x, z: tp.z, r: 9, go: () => take.act?.(), menu: 'rmVtake' });
    }
    const sw = window.SSX?.streetWork;
    if (sw?.debug?.goto) {
      const spot = sw.state?.().spot;
      if (spot) {
        const aj = spot === 'gulch' ? [120, 300] : [-330, -120];
        const c = w.colonyAt?.(aj);
        if (c) push({ id: 'corner', label: 'Ask the corner', x: c.x, z: c.z, r: 8, go: () => sw.offer?.() });
      }
    }
    const gulch = w.colonyAt?.([150, 330]);
    if (gulch && dist(p, gulch.x, gulch.z) < 10) push({ id: 'gulch', label: 'Enter the shed', x: gulch.x, z: gulch.z, r: 10, go: () => document.getElementById('f2Act')?.click(), menu: 'rmFarm2' });
    const hang = window.__dealer?.hangar?.buy;
    if (hang && dist(p, hang.x, hang.z) < 8) push({ id: 'hangar', label: window.__dealer.hangar.on ? 'Red Line hangar' : 'Buy the hangar', x: hang.x, z: hang.z, r: 8, go: () => { const h = window.__dealer.hangar; if (h.on) window.__dealer.openDealer?.(); else window.__dealer.buyHangar?.(); } });
  }
  return out;
}

function nearest() {
  const p = me(); if (!p) return null;
  let best = null, bd = 1e9;
  for (const c of candidates()) {
    const d = dist(p, c.x, c.z);
    if (d < c.r && d < bd) { bd = d; best = c; }
  }
  return best;
}
function glowOf() {
  const p = me(); if (!p) return null;
  let best = null, bd = 18;
  for (const c of candidates()) {
    const d = dist(p, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function ensure() {
  if (btn) return;
  const st = document.createElement('style'); st.id = 'areaCss';
  st.textContent = '#areaGo{position:fixed;z-index:13;left:168px;bottom:calc(132px + env(safe-area-inset-bottom));display:none;min-height:48px;max-width:168px;padding:6px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 14px/1.15 system-ui,sans-serif;touch-action:manipulation}'
    + '#areaGo.on{display:block}'
    + 'body.areaIn #driveBtn{display:none!important}'
    + HIDE + '{display:none!important}'
    + '#rmPlaces{margin:4px 0;border:1px solid rgba(255,255,255,.35);border-radius:8px;padding:4px 8px;color:#fff}'
    + '#rmPlaces summary{min-height:44px;display:flex;align-items:center;font:700 14px system-ui,sans-serif;cursor:pointer}'
    + '#rmPlaces .btn{width:100%}';
  document.head.appendChild(st);
  btn = document.createElement('button'); btn.id = 'areaGo'; btn.type = 'button';
  document.body.appendChild(btn);
  const tap = window.__onTap;
  const go = () => use();
  if (tap) tap(btn, go); else btn.addEventListener('click', go);
}
function use() {
  if (!current) return false;
  try { current.go?.(); } catch (e) { console.warn('area prompt', e); }
  return true;
}
function tuck() {
  const menu = document.getElementById('roverMenu'); if (!menu) return;
  let box = document.getElementById('rmPlaces');
  if (!box) {
    box = document.createElement('details'); box.id = 'rmPlaces';
    box.innerHTML = '<summary>More places</summary>';
    const settings = document.getElementById('settingsBtn');
    menu.insertBefore(box, settings || null);
  }
  for (const id of MENUS) {
    const b = document.getElementById(id);
    if (b && b.parentElement !== box) box.appendChild(b);
  }
}
function paintGlow(c) {
  const sc = surf()?.scene; if (!sc || !c) { if (ring) ring.visible = false; return; }
  if (!ring) {
    ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.05, 6, 18), new THREE.MeshBasicMaterial({ color: 0x7af0ff }));
    ring.rotation.x = Math.PI / 2; ring.name = 'area-glow';
  }
  if (ring.parent !== sc) sc.add(ring);
  const ins = world()?.inside;
  const y = ins ? (ins.floor || 0) + 0.08 : ((surf().height?.(c.x, c.z) || 0) + 0.08);
  ring.position.set(c.x, y, c.z);
  ring.visible = true;
}
function tick() {
  ensure();
  const busy = document.getElementById('ppGame')?.classList.contains('on') || document.getElementById('vbrawl')?.classList.contains('on') || document.getElementById('sworkFade')?.classList.contains('on');
  current = busy ? null : nearest();
  if (!current) { btn.classList.remove('on'); btn.textContent = ''; document.body.classList.remove('areaIn'); }
  else {
    if (btn.textContent !== current.label) btn.textContent = current.label;
    btn.classList.add('on');
    document.body.classList.toggle('areaIn', !!current.inside);
  }
  paintGlow(glowOf());
  tuck();
}
function boot() {
  if (!window.SSX?.registerSurfaceTick && !window.__app) { setTimeout(boot, 250); return; }
  window.SSX = window.SSX || {};
  if (window.SSX.area) return;
  window.SSX.area = { use, current: () => current ? { id: current.id, label: current.label } : null };
  window.SSX.registerSurfaceTick?.(() => { try { tick(); } catch (e) { /* */ } });
}
if (typeof window !== 'undefined') boot();
