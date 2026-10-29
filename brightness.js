// ☰ → ☀️ Brightness (Low / Normal / High / Max, saved in localStorage 'ssx.bright.v1', ?bright=<level> for one session).
// Lifts exposure, ambient and the night floor everywhere: the Mars night look (SSX.time.addLookFilter), street-night,
// interiors, space and every planet, in the classic look and the v8 realistic look (feature-detected: SSX.look / __v8).
// Nothing is replaced and nobody else's values are overwritten: the renderer's exposure, hemisphere / ambient intensities
// and scene.environmentIntensity are scaled just for the duration of each renderer.render() call and put back right after,
// so time.js, street-night, carmeet, director and v8 keep owning them. Rules live in brightnesscore.js.
import * as B from './brightnesscore.js';

const S = { level: B.DEFAULT, renders: 0, lights: 0, wrapped: false, filter: false, look: 'classic' };
const warned = new Set(); const warnOnce = (k, e) => { if (warned.has(k)) return; warned.add(k); console.warn('[brightness] ' + k, e); };
function load() {
  let k = null; try { k = new URLSearchParams(location.search).get('bright'); } catch {}
  if (!k) try { k = localStorage.getItem(B.SAVE_KEY); } catch {}
  S.level = B.norm(k || B.DEFAULT);
}
function save() { try { localStorage.setItem(B.SAVE_KEY, S.level); } catch {} }

// ---------- render-time lift ----------
// how dark the Mars outdoor night is right now (0 by day, indoors, in space or on other worlds)
let darkAt = 0, darkV = 0;
function dark() {
  const t = performance.now(); if (t - darkAt < 250) return darkV; darkAt = t;
  try { const s = window.__app?.surface, T = window.SSX?.time; darkV = s?.info?.name === 'Mars' && !s.info.inside && window.__app.state?.onSurface && T?.nightness ? T.nightness() : 0; } catch { darkV = 0; }
  return darkV;
}
let lights = [], lightScene = null, scanAt = 0;
function scan(scene) {
  lights = []; lightScene = scene; scanAt = performance.now();
  scene.traverse(o => { if (o.isHemisphereLight || o.isAmbientLight) lights.push(o); });
  S.lights = lights.length;
}
function wrap(R) {
  if (!R || R.__ssxBright) return !!R; const render = R.render; let depth = 0;
  R.render = function (scene, camera) {
    if (depth || !scene?.isScene) return render.call(this, scene, camera);
    depth++; S.renders++;
    if (scene !== lightScene || performance.now() - scanAt > 1000) scan(scene);
    const e0 = this.toneMappingExposure, i0 = lights.map(l => l.intensity), env0 = scene.environment ? scene.environmentIntensity : null;
    try {
      this.toneMappingExposure = B.liftExposure(e0, S.level, dark());
      for (let i = 0; i < lights.length; i++) lights[i].intensity = B.liftAmbient(i0[i], S.level);
      if (env0 != null) scene.environmentIntensity = env0 * B.level(S.level).amb;
      return render.call(this, scene, camera);
    } finally {
      this.toneMappingExposure = e0; for (let i = 0; i < lights.length; i++) lights[i].intensity = i0[i];
      if (env0 != null) scene.environmentIntensity = env0; depth--;
    }
  };
  R.__ssxBright = true; S.wrapped = true; return true;
}

// ---------- Mars night floor (time.js) ----------
function hookTime() {
  const T = window.SSX?.time; if (S.filter || typeof T?.addLookFilter !== 'function') return;
  T.addLookFilter(L => { const b = window.__time?.base; return b ? B.nightFloor(L, b, S.level) : L; }); S.filter = true;
}

// ---------- ☰ menu + picker ----------
let btn = null, panel = null;
const label = () => `☀️ Brightness: ${B.level(S.level).label}`;
function set(k) { S.level = B.norm(k); save(); if (btn) btn.textContent = label(); if (panel) paint(); return S.level; }
function paint() { for (const b of panel.querySelectorAll('button[data-k]')) { const on = b.dataset.k === S.level; b.style.background = on ? '#f5c542' : 'rgba(255,255,255,0.08)'; b.style.color = on ? '#1a1206' : '#fff'; } }
function tapOf(el, fn) { // pointer-event tap, with click as the fallback (no ghost double fire)
  let pid = null, last = 0;
  el.addEventListener('pointerdown', e => { pid = e.pointerId; });
  el.addEventListener('pointerup', e => { if (e.pointerId !== pid) return; pid = null; last = performance.now(); e.preventDefault(); e.stopPropagation(); fn(e); });
  el.addEventListener('pointercancel', () => { pid = null; });
  el.addEventListener('click', e => { e.stopPropagation(); if (performance.now() - last < 700) return; fn(e); });
}
function close() { if (panel) panel.style.display = 'none'; }
function open() {
  if (!panel) {
    panel = document.createElement('div'); panel.id = 'brightPanel';
    panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;background:rgba(14,12,22,0.94);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:14px 14px 10px;color:#fff;font:600 15px system-ui,sans-serif;width:min(300px,86vw);box-shadow:0 8px 30px rgba(0,0,0,0.6);touch-action:manipulation';
    const h = document.createElement('div'); h.textContent = '☀️ Brightness'; h.style.cssText = 'margin-bottom:4px;font-size:16px';
    const p = document.createElement('div'); p.textContent = 'Lifts night, interiors and dark screens. Saved on this device.'; p.style.cssText = 'font-weight:400;font-size:12px;opacity:0.75;margin-bottom:10px';
    const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px';
    for (const k of B.ORDER) { const b = document.createElement('button'); b.dataset.k = k; b.id = 'bright-' + k; b.textContent = B.LEVELS[k].label;
      b.style.cssText = 'border:0;border-radius:9px;padding:11px 0;font:600 14px system-ui,sans-serif;min-height:44px'; tapOf(b, () => set(k)); row.appendChild(b); }
    const done = document.createElement('button'); done.id = 'brightDone'; done.textContent = 'Done';
    done.style.cssText = 'margin-top:10px;width:100%;border:0;border-radius:9px;padding:10px 0;min-height:44px;background:rgba(255,255,255,0.14);color:#fff;font:600 14px system-ui,sans-serif'; tapOf(done, close);
    panel.append(h, p, row, done); panel.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(panel);
  }
  paint(); panel.style.display = 'block';
}

const API = {
  version: 1,
  get: () => S.level, set, next: () => set(B.next(S.level)), levels: B.ORDER.slice(),
  open, close,
  state: () => ({ ...S, exp: B.level(S.level).exp, amb: B.level(S.level).amb, floor: B.level(S.level).floor, night: B.level(S.level).night, panel: panel?.style.display === 'block' })
};
window.__bright = { S, B, API };

(function boot() {
  const X = window.SSX, app = window.__app;
  if (!X || !app || typeof X.registerMenuItem !== 'function') { setTimeout(boot, 200); return; }
  if (X.brightness) return; X.brightness = API; load();
  try { btn = X.registerMenuItem({ id: 'brightMenuBtn', label: label(), onTap: () => open() }); } catch (e) { warnOnce('menu', e); }
  const tryWrap = () => { try { if (!wrap(window.__app?.renderer)) setTimeout(tryWrap, 300); } catch (e) { warnOnce('wrap', e); } };
  tryWrap();
  // SSX.time (mars/time.js) and the v8 look load as separate modules: pick them up whenever they appear
  const late = () => { try { hookTime(); S.look = window.SSX?.look?.tier?.() || (window.__v8 ? 'v8' : 'classic'); } catch (e) { warnOnce('late', e); } };
  late(); setInterval(late, 1000);
})();
