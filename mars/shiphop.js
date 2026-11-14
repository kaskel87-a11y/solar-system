// mars/shiphop.js: point-to-point Ashfall flights on Mars (window.SSX.shiphop).
// Walk up to the ship (the pad, or wherever it is sitting) and tap 🚀 Take off. A list of spots comes up.
// Pick one: the ship lifts, crosses, and sets down, and you step out beside it. Go to space is still on that list.
// The sky uses the same rules as Call ship (3 stars, a job, indoors, down). The map card has Fly ship here.
import * as H from './shiphopcore.js';

const app = () => window.__app, surf = () => app()?.surface, world = () => surf()?.world, X = () => window.SSX || {};
const toast = (m, ms = 2800) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const onMars = () => { const s = app()?.state; return !!s?.onSurface && !s.transitioning && surf()?.info?.name === 'Mars'; };
const player = () => surf()?.info;
function colony() { const c = surf()?.info?.colony; return c && H && Number.isFinite(c.x) ? c : null; }
function aj(p) { const c = colony(), a = Array.isArray(p) ? p : null; return c && a && Number.isFinite(+a[0]) ? { x: c.x + +a[0], z: c.z + +a[1] } : null; }
function jobOn() {
  const x = X();
  if (tryv(() => x.heist?.active)) return true;
  if (tryv(() => x.jobs?.active?.())) return true;
  if (tryv(() => window.__activities?.active)) return true;
  if (tryv(() => x.beltway?.active?.())) return true;
  if (tryv(() => x.smuggle?.state?.run)) return true;
  if (tryv(() => x.spacebank?.state?.run)) return true;
  if (tryv(() => surf()?.game?.info?.quest)) return true;
  return false;
}
function ctx() {
  const i = player(), pose = tryv(() => surf()?.shipPose?.());
  const ship = X().base?.ship;
  return {
    onMars: onMars(),
    indoors: !!i?.inside,
    down: !!tryv(() => surf()?.game?.isDown?.()),
    wanted: +(world()?.wanted || 0),
    job: jobOn(),
    driving: !!i?.driving,
    busy: !!ship?.landing,
    hopping: !!hop,
    nearShip: H.nearShip(i, pose),
    pose, here: i ? { x: i.x, z: i.z } : null
  };
}
function spots() {
  const out = [];
  tryv(() => { for (const d of world()?.districts?.() || []) if (d.kind === 'downtown') { const p = d.fast || d; if (Number.isFinite(p.x)) out.push({ id: 'downtown', x: p.x, z: p.z }); } });
  tryv(() => { const d = world()?.doorFor?.('velvet') || world()?.doorFor?.('club'); const p = d && Number.isFinite(d.x) ? d : aj([-30, -27]); if (p) out.push({ id: 'velvet', x: p.x, z: p.z }); });
  tryv(() => {
    const plots = X().base?.plots?.() || [];
    const parked = X().base?.ship?.plotId;
    const owned = plots.filter(p => p.owned && p.world && p.id !== 'farm' && !/homestead/i.test(p.name || ''));
    const plot = owned.find(p => p.id === parked) || owned.find(p => X().base?.state?.(p.id)?.pieces?.some(q => q.type === 'pad')) || null;
    if (!plot) return;
    const piece = X().base.state(plot.id)?.pieces?.find(q => q.type === 'pad');
    if (piece) out.push({ id: 'pad', x: plot.world.x + (piece.i + 1.5) * 2 - 10, z: plot.world.z + (piece.j + 1.5) * 2 - 10 });
    else out.push({ id: 'pad', x: plot.world.x, z: plot.world.z, name: 'Your Mars base' });
  });
  tryv(() => { const p = X().icecap?.place?.(); if (p) out.push({ id: 'icecap', x: p.x, z: p.z }); });
  tryv(() => { const p = aj(X().fight?.status?.()?.at); if (p) out.push({ id: 'pit', x: p.x, z: p.z }); });
  tryv(() => { const p = (X().farm?.places?.() || []).find(q => q.id === 'farm'); if (p) out.push({ id: 'farm', x: p.x, z: p.z }); });
  tryv(() => { const p = aj([58, 46]); if (p) out.push({ id: 'dealer', x: p.x, z: p.z }); });
  tryv(() => { const p = (X().farm?.places?.() || []).find(q => q.id === 'post'); if (p) out.push({ id: 'post', x: p.x, z: p.z }); });
  return H.listOf(out, ctx().here);
}

let hop = null, panel = null, fadeEl = null;
export const holdsShip = () => !!hop;

function fade(on) {
  if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.id = 'shipFade'; fadeEl.style.cssText = 'position:fixed;inset:0;z-index:40;background:#000;opacity:0;pointer-events:none;transition:opacity .28s ease'; document.body.appendChild(fadeEl); }
  fadeEl.style.opacity = on ? '1' : '0';
}
function rumble(seconds) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const a = window.__shipAudio || new AC(); window.__shipAudio = a;
    if (localStorage.getItem('ssx.muted') === '1') return;
    if (a.state === 'suspended') a.resume?.()?.catch?.(() => {});
    const t = a.currentTime, end = t + seconds, g = a.createGain(), f = a.createBiquadFilter(), o = a.createOscillator();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, end);
    f.type = 'lowpass'; f.frequency.setValueAtTime(140, t); o.type = 'sawtooth'; o.frequency.setValueAtTime(52, t); o.frequency.exponentialRampToValueAtTime(36, end);
    o.connect(f); f.connect(g); g.connect(a.destination); o.start(t); o.stop(end + 0.02);
  } catch (e) { /* no audio */ }
}
function stand(x, z) {
  let px = x + 10, pz = z + 4;
  const c = tryv(() => world()?.collide?.(px, pz, 0.6));
  if (c && Number.isFinite(c.x) && Number.isFinite(c.z)) { px = c.x; pz = c.z; }
  return { x: px, z: pz, yaw: Math.atan2(-(x - px), -(z - pz)) };
}
function begin(dest) {
  const c = ctx(), w = H.hopBlock(c);
  if (w) { toast('🚀 ' + w); return { ok: false, why: w }; }
  if (!dest || !Number.isFinite(dest.x)) return { ok: false, why: 'unknown' };
  if (c.here && Math.hypot(dest.x - c.here.x, dest.z - c.here.z) < H.HERE_M) { toast('🚀 You are already here.'); return { ok: false, why: 'here' }; }
  const s = surf(); if (!s?.placeShip || !c.pose) return { ok: false, why: 'no-ship' };
  tryv(() => X().base?.releaseShip?.());
  close();
  tryv(() => X().hudx?.closeMap?.());
  const pose = c.pose;
  hop = { phase: 'up', t0: performance.now(), from: { x: pose.x, z: pose.z, yaw: pose.yaw }, to: { x: dest.x, z: dest.z }, name: dest.name || 'that spot', stand: stand(dest.x, dest.z), dust: false, moved: false };
  rumble(H.LIFT_S + H.DROP_S);
  toast('🚀 The Ashfall is lifting.', 1600);
  setTimeout(frame, 32);
  return { ok: true, name: hop.name };
}
const HOP_END = H.LIFT_S + H.CROSS_S + H.DROP_S;
function frame() {
  if (!hop) return;
  const elapsed = (performance.now() - hop.t0) / 1000;
  const s = surf();
  try {
    if (s?.placeShip) {
      if (elapsed < H.LIFT_S) {
        hop.phase = 'up';
        const u = elapsed / H.LIFT_S;
        s.placeShip(hop.from.x, hop.from.z, u * u * H.LIFT_M, hop.from.yaw);
        if (u > 0.82) fade(1);
      } else if (elapsed < H.LIFT_S + H.CROSS_S) {
        hop.phase = 'cross';
        if (!hop.moved && elapsed > H.LIFT_S + 0.28) {
          hop.moved = true;
          s.placeShip(hop.to.x, hop.to.z, H.LIFT_M, 0.4);
          s.debugMove(hop.stand.x, hop.stand.z, hop.stand.yaw);
        }
      } else if (elapsed < HOP_END) {
        hop.phase = 'down';
        fade(0);
        const u = (elapsed - H.LIFT_S - H.CROSS_S) / H.DROP_S, e = 1 - (1 - u) * (1 - u);
        s.placeShip(hop.to.x, hop.to.z, H.LIFT_M * (1 - e), 0.4);
        if (!hop.dust && u > 0.72) { hop.dust = true; tryv(() => s.dustAt?.(hop.to.x, hop.to.z, 36)); }
      } else {
        hop.phase = 'down';
        s.placeShip(hop.to.x, hop.to.z, 0, 0.4);
        tryv(() => s.dustAt?.(hop.to.x, hop.to.z, 48));
        const name = hop.name; hop = null; fade(0);
        toast(`🚀 The Ashfall is down at ${name}.`, 2800);
      }
    }
  } catch (e) { if (hop) hop.err = String(e?.message || e); }
  if (hop) setTimeout(frame, 32);
}

const css = `#shipHop{position:fixed;inset:0;z-index:64;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45)}
#shipHop.on{display:flex}
#shipHop .wrap{width:min(440px,calc(100vw - 16px));max-height:min(92vh,760px);overflow:auto;background:#000;color:#fff;border:3px solid #fff;border-radius:16px 16px 0 0;padding:12px 12px calc(10px + env(safe-area-inset-bottom));font:600 15px/1.35 system-ui,sans-serif}
#shipHop h2{margin:0 0 4px;font:900 20px/1.2 system-ui,sans-serif} #shipHop .sub{color:#ddd;font-size:13px;margin:0 0 8px}
#shipHop .why{color:#ffd400;font-weight:800;min-height:0;margin:0 0 6px} #shipHop .why:empty{display:none}
#shipHop button{display:block;width:100%;min-height:48px;margin:6px 0 0;padding:6px 12px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation}
#shipHop button small{display:block;font-weight:600;font-size:12px;color:#ddd}
#shipHop button.pri{background:#fff;color:#000} #shipHop button.pri small{color:#222}
#shipHop button:disabled{opacity:1;color:#c8c8c8;border-style:dashed;border-color:#8a8a8a}
#shipHop .gap{height:8px}`;
function ensure() {
  if (panel) return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'shipHop'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Fly the Ashfall');
  panel.innerHTML = '<div class="wrap"><h2>🚀 Fly the Ashfall</h2><p class="sub">Pick a spot on Mars. The ship lifts, crosses, and sets down. You step out beside it.</p><div class="why" id="shipWhy"></div><div id="shipList"></div><div class="gap"></div><button type="button" id="shipSpace" class="pri">🚀 Go to space<small>Leave Mars for orbit.</small></button><button type="button" id="shipClose">Close</button></div>';
  document.body.appendChild(panel);
  const tap = (el, fn) => { (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, fn); };
  tap(panel.querySelector('#shipClose'), () => close());
  tap(panel.querySelector('#shipSpace'), () => { const w = H.skyBlock(ctx()); if (w) { toast('🚀 ' + w); paint(); return; } close(); tryv(() => app()?.takeOff?.()); });
  panel.addEventListener('pointerup', e => { if (e.target === panel) close(); });
}
function paint() {
  if (!panel) return;
  const c = ctx(), w = H.skyBlock(c), list = spots();
  panel.querySelector('#shipWhy').textContent = w || '';
  const space = panel.querySelector('#shipSpace'); space.disabled = !!w;
  const box = panel.querySelector('#shipList');
  box.innerHTML = list.map(p => `<button type="button" data-id="${p.id}" ${w || p.here ? 'disabled' : ''}>${p.icon} ${p.name}<small>${p.here ? 'You are here.' : Math.round(p.d) + ' m'}</small></button>`).join('') || '<p class="sub">No spots on this rock yet.</p>';
  const tap = (el, fn) => { (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, fn); };
  box.querySelectorAll('button').forEach(b => tap(b, () => { const p = spots().find(q => q.id === b.dataset.id); if (p) begin(p); }));
}
function open() {
  ensure(); paint(); panel.classList.add('on');
  try { document.getElementById('roverMenu')?.classList.remove('show'); if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  return true;
}
function close() { panel?.classList.remove('on'); }
function board() {
  const c = ctx();
  if (!c.onMars || c.indoors || c.driving || c.hopping || c.busy || !c.nearShip) return false;
  return open();
}
function fromMap(p) {
  if (!p || !Number.isFinite(+p.x) || !Number.isFinite(+p.z)) return { ok: false, why: 'unknown' };
  const w = H.hopBlock(ctx());
  if (w) { toast('🚀 ' + w); return { ok: false, why: w }; }
  return begin({ x: +p.x, z: +p.z, name: String(p.name || 'that spot').replace(/^[^\w]+/, '').trim() || 'that spot' });
}

const API = {
  board, open, close, fromMap, holdsShip, spots, skyBlock: () => H.skyBlock(ctx()),
  fly: id => { const p = spots().find(q => q.id === id); if (!p) { toast('🚀 That spot is not on the list.'); return { ok: false, why: 'unknown' }; } return begin(p); },
  get hopping() { return !!hop; },
  get phase() { return hop?.phase || ''; },
  debug: { open, pose: () => tryv(() => surf()?.shipPose?.()), ctx }
};
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 200); return; }
  if (window.SSX.shiphop) return;
  window.SSX.shiphop = API;
})();
