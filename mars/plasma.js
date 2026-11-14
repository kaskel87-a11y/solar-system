// v7.5.98 Plasma Blade. A short grip and a glowing edge in three colours.
// Buy it at a gun counter. ☰ → Plasma Blade picks the colour. FIRE swings it.
import * as C from './plasmacore.js';

const KEY = 'ssx.plasma.v1';
const app = () => window.__app;
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && C.BY[s.color]) return s; } catch (e) { /* */ } return { color: 'cyan' }; };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* */ } };

let st = load(), sheet = null;

function hex() { return C.colorOf(st.color).hex; }
function owned() { try { return !!app()?.game?.progress?.unlocks?.includes('melee:' + C.ID); } catch (e) { return false; } }
function equipped() { try { return app()?.game?.progress?.equip?.weapon === C.ID && owned(); } catch (e) { return false; } }
function setColor(id) { if (!C.BY[id]) return st; st = { color: id }; save(st); paint(); return st; }
function cycle() { const i = C.COLORS.findIndex(c => c.id === st.color); return setColor(C.COLORS[(i + 1) % C.COLORS.length].id); }

const CSS = `#plSheet{position:fixed;left:0;right:0;bottom:0;z-index:64;display:none;box-sizing:border-box;padding:12px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));background:#000;color:#fff;border-top:2px solid #fff;font:15px/1.35 system-ui,sans-serif}
#plSheet.on{display:block} #plSheet h2{margin:0 0 6px;font-size:18px} #plSheet p{margin:0 0 8px}
#plSheet .row{display:flex;gap:8px;flex-wrap:wrap}
#plSheet button{min-height:48px;min-width:48px;flex:1 1 120px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.15 system-ui,sans-serif;touch-action:manipulation}
#plSheet button.on{background:#fff;color:#000}
body.touch.plasma #fireBtn, body.touch.plasma #meleeBtn{display:block!important;width:64px!important;height:64px!important;min-width:54px;min-height:54px}`;

function ensureCss() {
  if (document.getElementById('plCss')) return;
  const s = document.createElement('style'); s.id = 'plCss'; s.textContent = CSS; document.head.appendChild(s);
}
function open() {
  ensureCss();
  if (!sheet) {
    sheet = document.createElement('div'); sheet.id = 'plSheet'; document.body.appendChild(sheet);
    sheet.addEventListener('pointerup', e => {
      const b = e.target?.closest?.('button'); if (!b) return;
      if (b.dataset.a === 'close') sheet.classList.remove('on');
      else if (b.dataset.c) { setColor(b.dataset.c); render(); }
    });
  }
  render(); sheet.classList.add('on');
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
}
function render() {
  if (!sheet) return;
  const have = owned();
  const colors = C.COLORS.map(c => `<button type="button" data-c="${c.id}" class="${st.color === c.id ? 'on' : ''}">${c.name}</button>`).join('');
  sheet.innerHTML = `<h2>Plasma Blade</h2><p>${have ? 'Pick a colour. Swing with FIRE.' : C.HOW}</p><div class="row">${colors}<button type="button" data-a="close">Close</button></div>`;
}
function paint() {
  const mesh = window.__plasmaMesh; if (!mesh) return;
  const edge = mesh.getObjectByName('edge'), glow = mesh.getObjectByName('glow');
  const h = hex();
  if (edge?.material?.color) { edge.material.color.setHex(h); edge.material.emissive?.setHex(h); }
  if (glow?.material?.color) glow.material.color.setHex(h);
}

let lastSwing = 0, ctx = null;
function whoosh() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = ctx || new AC(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, n = ctx.createBuffer(1, (ctx.sampleRate * 0.09) | 0, ctx.sampleRate);
    const d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = n;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  } catch (e) { /* no audio */ }
}
function tick() {
  document.body.classList.toggle('plasma', equipped());
  const p = window.__plasmaSwing;
  if (p && p.at !== lastSwing) { lastSwing = p.at; whoosh(); }
}

function boot() {
  const S = window.SSX; if (!S?.registerSurfaceTick || !app()) { setTimeout(boot, 300); return; }
  if (S.plasma) return;
  ensureCss();
  S.plasma = { ID: C.ID, NAME: C.NAME, COLORS: C.COLORS, HOW: C.HOW, color: () => st.color, hex, setColor, cycle, owned, equipped, open };
  S.registerSurfaceTick?.(() => { try { tick(); } catch (e) { /* */ } });
  try { S.registerMenuItem?.({ id: 'rmPlasma', label: '⚡ Plasma Blade', onTap: () => open() }); } catch (e) { /* */ }
}
if (typeof window !== 'undefined') boot();
export default { boot };
