// Velvet Airlock snack bar (Collin: something to eat, on the unused floor).
// A counter, cook, stools and a table on the empty east-wing floor west of Ines's office.
// Walk up: the button says EAT. The sheet is wings, sliders, nachos, and a Red Dust burger.
// Food restores health. The burger also makes hits hurt 25% less for 60 seconds.
// Empire fronts are a separate business system. This counter only exposes upgradeHook for a later owner.
import * as THREE from 'three';
import * as C from './snackbarcore.js';

const APP = () => (typeof window !== 'undefined' ? window.__app : null);
const game = () => APP()?.surface?.game || APP()?.game || null;
const toast = (t, ms = 3200) => { try { APP()?.toast?.(t, ms); } catch (e) { /* hud not up */ } };

let fedUntil = 0;
const fed = () => performance.now() < fedUntil;
function mitigate() { return fed() ? C.BUFF_MIT : 1; }

function eat(id) {
  const g = game(), it = C.byId(id);
  if (!g?.spend) return { ok: false, why: 'Land first.' };
  const info = g.info || {}, q = C.quote(it, info.hp, info.hpMax, g.progress?.credits | 0);
  if (!q.ok) return q;
  if (!g.spend(q.price)) return { ok: false, why: `Short ${q.price} credits.` };
  const got = typeof g.heal === 'function' ? g.heal(q.heal) : 0;
  if (q.buff) fedUntil = performance.now() + q.buff * 1000;
  const bits = [`🍗 ${it.name}. −${q.price} cr`];
  if (got > 0) bits.push(`+${got} health`);
  else if (!q.buff) bits.push('already full');
  if (q.buff) bits.push('hits hurt 25% less for 60 seconds');
  toast(bits.join('. ') + '.', 3200);
  return { ok: true, id, healed: got, buff: !!q.buff };
}

let sheet = null, tok = 0, openedAt = 0;
function ensureSheet() {
  if (sheet) return sheet;
  const css = document.createElement('style');
  css.id = 'snackCss';
  css.textContent = `#snackSheet{position:fixed;left:0;right:0;bottom:0;z-index:16;display:none;padding:10px calc(12px + var(--sar,0px)) calc(12px + var(--sab,0px)) calc(12px + var(--sal,0px));background:rgba(12,6,4,.96);color:#fff;border-top:1px solid rgba(255,255,255,.35);max-height:52vh;overflow-y:auto;box-sizing:border-box;font:600 .9rem/1.3 system-ui,sans-serif}
#snackSheet .who{font-weight:800;color:#ffd040;font-size:.76rem;letter-spacing:.04em;text-transform:uppercase}
#snackSheet .p{margin:4px 0 8px}#snackSheet .opts{display:flex;flex-direction:column;gap:7px}
#snackSheet button{min-height:44px;padding:8px 12px;border-radius:10px;font-weight:700;text-align:left;background:#000;color:#fff;border:1px solid rgba(255,255,255,.6);font-size:.9rem;touch-action:manipulation}
#snackSheet button:disabled{color:#b4b4b4;border-style:dashed}`;
  document.head.appendChild(css);
  sheet = document.createElement('div');
  sheet.id = 'snackSheet';
  sheet.innerHTML = '<div class="who"></div><div class="p"></div><div class="opts"></div>';
  document.body.appendChild(sheet);
  return sheet;
}
function closeSheet() { if (sheet) sheet.style.display = 'none'; }
function open() {
  const el = ensureSheet(), g = game(), info = g?.info || {}, cr = g?.progress?.credits | 0;
  el.querySelector('.who').textContent = 'Snack bar · Pip';
  const left = fed() ? ` Hits hurt less for ${Math.max(1, Math.ceil((fedUntil - performance.now()) / 1000))}s.` : '';
  el.querySelector('.p').textContent = `Health ${info.hp ?? '—'}/${info.hpMax ?? '—'}. ${cr} cr. Food puts health back. The Red Dust burger also makes hits hurt 25% less for 60 seconds.${left}`;
  const box = el.querySelector('.opts'); box.innerHTML = '';
  const mine = ++tok;
  openedAt = performance.now(); // the EAT tap's click lands after the sheet opens; ignore it
  const tap = (btn, fn) => {
    let used = false;
    const go = ev => { ev.preventDefault(); if (used || btn.disabled || mine !== tok || performance.now() - openedAt < 450) return; used = true; fn(); };
    btn.addEventListener('click', go);
  };
  for (const it of C.MENU) {
    const q = C.quote(it, info.hp, info.hpMax, cr);
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = `${it.name} · ${it.price} cr · ${it.blurb}`;
    b.disabled = !q.ok;
    tap(b, () => { const r = eat(it.id); if (!r.ok) { toast(r.why || 'Not now.', 2200); return; } closeSheet(); });
    box.appendChild(b);
  }
  const c = document.createElement('button'); c.type = 'button'; c.textContent = 'Close';
  tap(c, () => closeSheet());
  box.appendChild(c);
  el.style.display = 'block';
}

// interiors.js calls this while building the club. poses: { sit, idle }
export function addSnackBar(api, poses = {}) {
  const { box, mat, G } = api, A = C.AT;
  const wood = mat(0x3a1a0a, { roughness: 0.45 }), steel = mat(0x2a2e34, { metalness: 0.7, roughness: 0.35 });
  const red = mat(0x8a1a14, { roughness: 0.6 }), gold = mat(0xffd040, { basic: true }), heat = mat(0xff6a1a, { basic: true });
  box(A.x, 0.52, A.z, 0.72, 1.04, 3.05, steel);
  box(A.x, 1.06, A.z, 0.86, 0.06, 3.2, wood);
  box(A.x + 0.05, 1.12, A.z - 0.7, 0.5, 0.04, 0.7, heat); // the grill
  api.col(A.x, A.z, 0.42, 1.58);
  for (const z of [A.z - 0.9, A.z + 0.9]) {
    box(A.x + 0.85, 0.28, z, 0.36, 0.5, 0.36, red);
    api.col(A.x + 0.85, z, 0.22, 0.22);
  }
  box(A.x + 2.35, 0.38, A.z, 0.9, 0.06, 0.9, wood);
  box(A.x + 2.35, 0.18, A.z, 0.12, 0.36, 0.12, steel);
  api.col(A.x + 2.35, A.z, 0.5, 0.5);
  for (const z of [A.z - 0.7, A.z + 0.7]) { box(A.x + 3.05, 0.28, z, 0.36, 0.5, 0.36, red); api.col(A.x + 3.05, z, 0.22, 0.22); }
  api.sign('SNACK BAR', 0xffd040, A.x + 0.2, 2.55, A.z, -Math.PI / 2, 2.8, { w: 512, h: 128, font: 'bold 72px system-ui, sans-serif' });
  api.sign('EAT HERE', 0xfff0c0, A.x, 2.15, A.z + 1.7, 0, 1.8, { w: 512, h: 128, font: 'bold 80px system-ui, sans-serif' });
  api.sign('WINGS 25 · SLIDERS 30', 0xffffff, A.x + 0.2, 1.85, A.z - 0.15, -Math.PI / 2, 2.2, { h: 80, font: 'bold 48px system-ui, sans-serif' });
  api.sign('NACHOS 20 · BURGER 45', 0xffd040, A.x + 0.2, 1.45, A.z - 0.15, -Math.PI / 2, 2.2, { h: 80, font: 'bold 44px system-ui, sans-serif' });
  api.person({ top: 0xf4f4f4, bottom: 0x1a1a1a, hair: 0x3a2412, hairStyle: 'cap', skin: 0xc68a64, accent: 0xff6a1a }, A.x - 0.85, A.z, -Math.PI / 2, (p, t) => { poses.idle?.(p, t, 1); p.arms[1].rotation.x = 1.15 + Math.sin(t * 2.2) * 0.25; });
  api.sign('PIP · COOK', 0xffd040, A.x - 0.7, 2.15, A.z + 0.55, -Math.PI / 2, 1.3, { w: 512, h: 96, font: 'bold 52px system-ui, sans-serif' });
  if (poses.sit) api.person({ top: 0x6a3030, bottom: 0x1a1a22, hair: 0x101010, hairStyle: 'short', skin: 0x8a5a3a }, A.x + 0.85, A.z - 0.9, Math.PI / 2, (p) => poses.sit(p));
  api.spot({ id: 'snack', x: A.x + 1.15, z: A.z, r: 1.45, label: '🍗 EAT', act: 'velvet', run: () => open() });
  return { at: A };
}

const api = {
  menu: () => C.MENU.map(it => ({ ...it })),
  fed, mitigate, eat, open, close: closeSheet,
  // later: an Empire front could own this counter. Not built.
  upgradeHook: () => ({ id: 'velvet-snacks', name: 'Velvet snack bar', kind: 'front', ready: false })
};
if (typeof window !== 'undefined') {
  window.SSX = window.SSX || {};
  window.SSX.snack = api;
}
export default api;
