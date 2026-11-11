// Mob Boss (v7.5.88). Cop kills, jacked cars and finished heists add Respect.
// The card says how. A short label sits under the minimap, never in the middle of the screen.
import * as C from './mobbosscore.js';
import { addMenuItem, panelTap } from './racehooks.js';

const app = () => window.__app;
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
let S = C.fresh();
try { S = C.load(localStorage.getItem(C.KEY)); } catch (e) { /* */ }
const save = () => { try { localStorage.setItem(C.KEY, JSON.stringify(S)); } catch (e) { /* */ } };

const CSS = `#bossTag{position:fixed;z-index:8;left:calc(8px + env(safe-area-inset-left));top:calc(164px + env(safe-area-inset-top));display:none;max-width:148px;min-height:36px;padding:4px 8px;box-sizing:border-box;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:800 12px/1.2 system-ui,sans-serif;touch-action:manipulation}
#bossTag.on{display:block}
#bossTag small{display:block;font-weight:600;opacity:.85}
#bossCard{position:fixed;inset:0;z-index:64;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45)}
#bossCard.on{display:flex}
#bossCard .wrap{position:relative;width:min(96vw,420px);margin:0 8px calc(12px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:14px;box-sizing:border-box;font:15px/1.35 system-ui,sans-serif}
#bossCard h2{margin:0 40px 8px 0;font-size:18px}
#bossCard .x{position:absolute;top:8px;right:8px;width:44px;height:44px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:700 22px/40px system-ui,sans-serif}
#bossCard li{margin:4px 0}`;

let tag = null, card = null;
function ensure() {
  if (tag || typeof document === 'undefined') return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  tag = document.createElement('button'); tag.id = 'bossTag'; tag.type = 'button'; document.body.appendChild(tag);
  tag.addEventListener('click', () => open());
  card = document.createElement('div'); card.id = 'bossCard';
  card.innerHTML = '<div class="wrap"><button type="button" class="x" data-a="close" aria-label="Close">✕</button><div id="bossBody"></div></div>';
  document.body.appendChild(card);
  panelTap(card, e => { const b = e.target?.closest?.('button'); if (b?.dataset.a === 'close') close(); });
}
function paint() {
  if (!tag) return;
  const v = C.view(S);
  const show = S.respect > 0 && !document.body.classList.contains('cinematic');
  tag.classList.toggle('on', show);
  const line = v.next ? `${v.hud} · ${v.left} to ${v.next}` : v.hud;
  if (tag.textContent !== line) tag.textContent = line;
  tag.setAttribute('aria-label', `${v.name}. ${v.blurb}`);
}
function body() {
  const v = C.view(S);
  const rows = C.TIERS.map(t => `<li><b>${t.name}</b> at ${t.at} Respect. ${t.at === 0 ? 'Where you start.' : t.blurb}${t.id === v.tier ? ' ← you' : ''}</li>`).join('');
  const nxt = v.next ? `<p>Next: <b>${v.next}</b> in ${v.left} Respect. ${C.TIERS.find(t => t.name === v.next).blurb}</p>` : '<p>You run Mars.</p>';
  return `<h2>👑 ${v.name}</h2><p>Respect ${v.respect}${v.nextAt != null ? ` / ${v.nextAt}` : ''}. ${v.blurb}</p>${nxt}<p>How to earn it:</p><ul><li>Kill a ColSec drone, cruiser or buggy: +2</li><li>Kill an officer: +4 · a heavy: +6 · a gunship: +8</li><li>Jack a car: +3</li><li>Finish a heist: +12</li></ul><p>Killing cops also pays ⭐ and raises wanted, unless you are in the Gulch.</p><ol>${rows}</ol>`;
}
function open() { ensure(); card.querySelector('#bossBody').innerHTML = body(); card.classList.add('on'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } paint(); return true; }
function close() { card?.classList.remove('on'); return true; }
function grant(kind) {
  const r = C.grant(S, kind); if (!r.added) return r;
  save(); paint();
  if (r.up) toast(`👑 ${r.name}. ${r.blurb}`, 4200);
  return r;
}

const api = {
  version: 'v7.5.88',
  view: () => C.view(S),
  levelOff: () => C.view(S).levelOff,
  crewCut: () => C.view(S).crewCut,
  turfCut: () => C.view(S).turfCut,
  raiseHeat() { const up = C.raiseHeat(S); save(); return up; },
  grant, open, close,
  debug: { set: (n) => { S.respect = Math.max(0, n | 0); save(); paint(); return C.view(S); }, reset: () => { S = C.fresh(); save(); paint(); } }
};
window.SSX = window.SSX || {};
window.SSX.mobboss = api;

function boot(n = 0) {
  if (!window.SSX?.on || !window.__app?.registerMenuItem) { if (n < 400) setTimeout(() => boot(n + 1), 200); return; }
  ensure(); paint();
  try { addMenuItem(window.__app, { id: 'bossMenu', label: '👑 Mob Boss', onTap: () => open() }); } catch (e) { console.warn('mob boss menu', e); }
  const on = (ev, fn) => { try { window.SSX.on(ev, fn); } catch (e) { /* */ } };
  on('game:secDown', ev => { if (!ev || ev.zone) return; grant(ev.kind || 'officer'); });
  on('game:take', ev => { if (ev && (ev.carjack || ev.seen)) grant('car'); });
  addEventListener('heist:done', e => { if (e.detail?.success) grant('heist'); });
  try { window.SSX.registerSurfaceTick?.(() => paint()); } catch (e) { /* */ }
}
boot();
