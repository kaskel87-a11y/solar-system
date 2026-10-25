// Safe-crack minigame UI. One thumb on a 375x667 portrait phone: drag anywhere around the dial (pointer events, so
// touch, pen and mouse all work); desktop also gets ←/→ or A/D (hold Shift for fine). The dial rim glows and the
// phone buzzes as you near a notch; stop inside it to set the tumbler. Spin too fast and the noise bar fills.
// safeCrack(opts) -> Promise<{ success, reason: 'cracked'|'noise'|'timeout'|'abort', time, noise, tier, tumblers }>
import { createSafe, wrap180 } from './heistcore.js?v=7.5.1';

let active = null;
export const safeState = () => active ? { ...active.safe.view(), targets: active.safe.targets.slice() } : null; // test/debug view
export const safeOpen = () => !!active;

const CSS = `
#hsSafe { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  background: linear-gradient(180deg, rgba(4,6,12,.55) 0%, rgba(4,6,12,.9) 38%, rgba(4,6,12,.96) 100%); touch-action: none; user-select: none; -webkit-user-select: none;
  font: 600 14px system-ui, -apple-system, sans-serif; color: #e8ecf4; padding: 0 0 calc(18px + env(safe-area-inset-bottom)) 0; }
#hsSafe .hsTop { width: min(92vw, 420px); display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
#hsSafe .hsTitle { flex: 1; font-size: 15px; letter-spacing: .04em; text-transform: uppercase; }
#hsSafe .hsTime { font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; }
#hsSafe .hsX { width: 44px; height: 44px; border-radius: 12px; border: 1px solid rgba(255,255,255,.25); background: rgba(20,24,40,.7); color: #fff; font-size: 18px; }
#hsSafe .hsBars { width: min(92vw, 420px); display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; margin-bottom: 12px; font-size: 12px; opacity: .92; }
#hsSafe .hsBar { height: 8px; border-radius: 4px; background: rgba(255,255,255,.12); overflow: hidden; }
#hsSafe .hsBar b { display: block; height: 100%; width: 0; background: #ffb020; transition: width .08s linear; }
#hsSafe .hsBar.noise b { background: linear-gradient(90deg, #ffd040, #ff3c3c); }
#hsSafe .hsPips { display: flex; gap: 6px; } #hsSafe .hsPips i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.5); }
#hsSafe .hsPips i.on { background: #3cff8a; border-color: #3cff8a; } #hsSafe .hsPips i.cur { border-color: #ffd040; }
#hsSafe .hsDial { position: relative; width: min(64vw, 250px); height: min(64vw, 250px); border-radius: 50%; margin: 4px 0 10px;
  background: radial-gradient(circle at 50% 45%, #3a4050, #161a24 70%); border: 6px solid #59616f; box-shadow: 0 0 0 2px #10131b, 0 0 var(--glow, 0px) var(--glowc, #3cff8a); }
#hsSafe .hsDial .face { position: absolute; inset: 10%; border-radius: 50%; background: repeating-conic-gradient(from -1deg, #9aa3b5 0 2deg, transparent 2deg 10deg);
  -webkit-mask: radial-gradient(circle, transparent 74%, #000 75%); mask: radial-gradient(circle, transparent 74%, #000 75%); }
#hsSafe .hsDial .knob { position: absolute; inset: 30%; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #8b93a3, #2b303c); }
#hsSafe .hsDial .tick { position: absolute; left: calc(50% - 3px); top: 6%; width: 6px; height: 18%; border-radius: 3px; background: #ffd040; transform-origin: 50% 244%; }
#hsSafe .hsDial .mark { position: absolute; left: calc(50% - 7px); top: -16px; width: 0; height: 0; border: 7px solid transparent; border-top-color: #ff5a3c; }
#hsSafe .hsHint { font-size: 12px; opacity: .8; text-align: center; max-width: 86vw; }
#hsSafe.win .hsDial { --glowc: #3cff8a !important; --glow: 40px !important; } #hsSafe.lose .hsDial { --glowc: #ff3c3c !important; --glow: 40px !important; }
@media (orientation: landscape) and (max-height: 500px) { #hsSafe { flex-direction: row; justify-content: center; gap: 18px; align-items: flex-end; flex-wrap: wrap; }
  #hsSafe .hsDial { width: min(58vh, 220px); height: min(58vh, 220px); } #hsSafe .hsTop, #hsSafe .hsBars { width: min(44vw, 360px); } }
`;
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

export function safeCrack(opts = {}) {
  if (active) return Promise.resolve({ success: false, reason: 'busy', time: 0, noise: 0, tier: opts.tier || 'medium', tumblers: 0 });
  if (!document.getElementById('hsSafeCss')) { const s = el('style'); s.id = 'hsSafeCss'; s.textContent = CSS; document.head.appendChild(s); }
  const safe = createSafe({ tier: opts.tier, seed: opts.seed ?? ((Math.random() * 1e9) | 0), time: opts.time, overrides: opts.overrides });
  const root = el('div'); root.id = 'hsSafe'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Crack the safe');
  const top = el('div', 'hsTop'), title = el('div', 'hsTitle', '🔐 ' + (opts.title || 'Crack the safe')), time = el('div', 'hsTime'), x = el('button', 'hsX', '✕');
  x.setAttribute('aria-label', 'Give up'); x.id = 'hsSafeAbort'; top.append(title, time, x);
  const bars = el('div', 'hsBars'), pips = el('div', 'hsPips'), noise = el('div', 'hsBar noise', '<b></b>'), hold = el('div', 'hsBar', '<b></b>');
  for (let i = 0; i < safe.targets.length; i++) pips.appendChild(el('i'));
  bars.append(el('span', '', 'Tumblers'), pips, el('span', '', 'Set'), hold, el('span', '', 'Noise'), noise);
  const dial = el('div', 'hsDial'); dial.id = 'hsDial'; const tick = el('div', 'tick'); dial.append(el('div', 'face'), el('div', 'knob'), tick, el('div', 'mark'));
  const hint = el('div', 'hsHint', matchMedia('(pointer: coarse)').matches ? 'Drag your thumb around the dial. Slow down when it glows, then hold still.' : 'Drag around the dial, or hold ←/→ (Shift = fine). Hold still when it glows.');
  root.append(top, bars, dial, hint); document.body.appendChild(root);

  let pid = null, lastA = null, pend = 0, keyDir = 0, fine = false, raf = 0, last = performance.now(), buzzT = 0;
  const center = () => { const r = dial.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const angOf = e => { const c = center(); return Math.atan2(e.clientX - c.x, -(e.clientY - c.y)) * 180 / Math.PI; }; // 0 = up, clockwise +
  const down = e => { if (e.target === x || pid !== null) return; e.preventDefault(); pid = e.pointerId; lastA = angOf(e); try { root.setPointerCapture(pid); } catch (er) { /* synthetic */ } };
  const move = e => { if (e.pointerId !== pid) return; e.preventDefault(); const a = angOf(e); pend += wrap180(a - lastA); lastA = a; };
  const up = e => { if (e.pointerId !== pid) return; pid = null; lastA = null; };
  root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  const keys = e => { // capture phase on window: the game's WASD/E handlers never see keys while the safe is open
    const k = e.code, isDown = e.type === 'keydown'; fine = e.shiftKey;
    if (k === 'ArrowLeft' || k === 'KeyA') keyDir = isDown ? -1 : (keyDir === -1 ? 0 : keyDir);
    else if (k === 'ArrowRight' || k === 'KeyD') keyDir = isDown ? 1 : (keyDir === 1 ? 0 : keyDir);
    else if (k === 'Escape' && isDown) safe.abort();
    e.stopImmediatePropagation(); if (k !== 'Tab') e.preventDefault();
  };
  window.addEventListener('keydown', keys, true); window.addEventListener('keyup', keys, true);
  let doneP; const promise = new Promise(r => { doneP = r; });
  let pidX = null; // the ✕ fires on pointerup (thumb-safe) or a mouse click
  x.addEventListener('pointerdown', e => { pidX = e.pointerId; e.stopPropagation(); });
  x.addEventListener('pointerup', e => { if (e.pointerId === pidX) { e.stopPropagation(); safe.abort(); } pidX = null; });
  x.addEventListener('pointercancel', () => { pidX = null; });
  x.addEventListener('click', e => { if (!e.pointerType || e.pointerType === 'mouse') safe.abort(); }); // keyboard Enter / old engines; abort is idempotent

  const render = () => {
    const v = safe.view();
    tick.style.transform = `rotate(${v.angle}deg)`;
    dial.style.setProperty('--glow', `${Math.round(v.feedback * v.feedback * 28 + (v.inZone ? 8 : 0))}px`);
    dial.style.setProperty('--glowc', v.inZone ? '#3cff8a' : '#ffd040');
    noise.firstChild.style.width = `${Math.round(v.noise * 100)}%`; hold.firstChild.style.width = `${Math.round(Math.min(1, v.held) * 100)}%`;
    [...pips.children].forEach((p, i) => { p.className = i < v.idx ? 'on' : i === v.idx ? 'cur' : ''; });
    time.textContent = `${Math.ceil(v.left)}s`; time.style.color = v.left < 8 ? '#ff6a5a' : '';
  };
  const loop = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now; // a slow phone frame shouldn't read a normal drag as a loud spin
    const d = pend + keyDir * (fine ? 35 : 110) * dt; pend = 0;
    const before = safe.idx; safe.step(dt, d); opts.onTick?.(safe.view());
    if (safe.idx > before) navigator.vibrate?.(60);
    else if (safe.feedback > 0.6 && (buzzT -= dt) <= 0) { navigator.vibrate?.(8); buzzT = 0.25 - safe.feedback * 0.15; }
    render();
    if (safe.done) return end(); raf = requestAnimationFrame(loop);
  };
  function end() {
    const res = safe.result; root.classList.add(res.success ? 'win' : 'lose');
    window.removeEventListener('keydown', keys, true); window.removeEventListener('keyup', keys, true);
    setTimeout(() => { root.remove(); active = null; doneP(res); }, opts.instant ? 0 : 450);
  }
  active = { safe, root, cancel: () => safe.abort() };
  render(); raf = requestAnimationFrame(loop);
  return promise;
}
export function cancelSafe() { active?.cancel(); }
