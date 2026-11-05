// v7.5.33 Helios Heights guest pass runtime (rules: mars/heliospasscore.js). Bribe Porter at the Helios gate (or the
// ColSec cop logging plates there): 350 cr, 1 void honey or 3 glow-dust = one entry + one heist. The heist is Ben's
// Halvorsen Villa (☰ Heists, mars/heisttip.js): the bribe opens it for one run without Sable's tip, then it closes again.
// Where the offer appears:
//   - Rags to Riches: when Porter turns you away at the gate (modes/rags.js asks SSX.heliosPass.allow() before kicking).
//   - Normal game: when you roll through the Helios private gate checkpoint (index.html forwards the 'checkpoint' event),
//     at most every 10 min, never while wanted. Without a pass nothing changes.
// Panel: black buttons, white text, tap() (iPhone-safe).
import * as H from './heliospasscore.js';
import { tap } from '../racehooks.js';
import { bribeUnlock, bribeRelock } from './heisttip.js';

let S = null, panel = null, lastOffer = -1e9, chip = null;
const now = () => Date.now();
const app = () => window.__app;
const toast = (m, ms = 3000) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
const read = () => { try { return H.load(localStorage.getItem(H.KEY)); } catch (e) { return H.fresh(); } };
const save = () => { try { localStorage.setItem(H.KEY, JSON.stringify(S)); } catch (e) { /* */ } };
const game = () => app()?.game || app()?.surface?.game || null;
const credits = () => game()?.progress?.credits || 0;
const wanted = () => app()?.surface?.world?.wanted || 0;
const stash = () => { const out = {}; try { const it = window.SSX?.contraband?.stash?.()?.items || {}; for (const k in it) out[k] = it[k]?.qty || 0; } catch (e) { /* */ } return out; };
function hereAJ() {
  const s = app()?.surface, i = s?.info, col = s?.world?.colony; if (!i || !col || i.name !== 'Mars' || s.world.inside) return null;
  return [i.x - col.x, i.z - col.z];
}

const CSS = `#hpassPanel { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); }
#hpassPanel.on { display: flex; }
#hpassPanel .box { background: #0b0b0e; color: #fff; border: 1px solid #fff; border-radius: 16px; padding: 16px; width: min(360px, 92vw); font: 15px system-ui, sans-serif; }
#hpassPanel h3 { margin: 0 0 6px; font-size: 1.05rem; } #hpassPanel p { margin: 0 0 12px; opacity: 0.85; font-size: 0.86rem; line-height: 1.35; }
#hpassPanel button { display: block; width: 100%; min-height: 48px; margin: 8px 0 0; border-radius: 12px; background: #000; color: #fff; border: 1px solid #fff; font-weight: 800; font-size: 0.95rem; touch-action: manipulation; }
#hpassPanel button:disabled { opacity: 0.4; }
#hpassChip { position: fixed; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top, 0px) + 92px); z-index: 30; background: #000; color: #fff; border: 1px solid #fff; border-radius: 999px; padding: 4px 12px; font: 700 12px system-ui, sans-serif; pointer-events: none; display: none; }`;
function ensure() {
  if (panel) return panel;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'hpassPanel'; document.body.appendChild(panel);
  chip = document.createElement('div'); chip.id = 'hpassChip'; document.body.appendChild(chip);
  return panel;
}
const close = () => { if (panel) { panel.classList.remove('on'); panel.innerHTML = ''; } };

// who: 'Porter' (Helios private gate) or 'ColSec' (the cop logging plates at the checkpoint)
export function offer(who = 'Porter', force = false) {
  if (!S) S = read();
  if (S.pass) { toast(`${who}: You already bought your way in. Use it.`); return { ok: false, why: 'held' }; }
  if (wanted() > 0) return { ok: false, why: 'wanted' };
  if (!force && now() - lastOffer < H.OFFER_COOL_S * 1000) return { ok: false, why: 'cool' };
  lastOffer = now();
  const el = ensure(), opts = H.options(stash(), credits(), wanted());
  el.innerHTML = `<div class="box"><h3>\u{1F3F0} ${who === 'Porter' ? 'Porter, Helios gate' : 'ColSec at the Helios gate'}</h3>
    <p>${who === 'Porter' ? '"Residents and guests only." He lowers his voice. "Guests can be arranged."' : '"Plate\u2019s flagged. Could un-flag it."'} One pass: you get in once and get one job inside: the Halvorsen Villa (\u2630 Heists). Price: ${H.priceLine()}.</p>
    ${opts.map((o, i) => `<button type="button" data-i="${i}">${o.label}</button>`).join('') || `<p>You\u2019re not holding enough (${H.priceLine()}).</p>`}
    <button type="button" data-x="1">Walk away</button></div>`;
  el.classList.add('on');
  for (const b of el.querySelectorAll('button')) {
    const fn = () => { if (b.dataset.x) { close(); return; } pay(opts[+b.dataset.i], who); };
    tap(b, fn); // touch on pointerup + mouse click, no double fire
  }
  return { ok: true, options: opts.length };
}
export function pay(o, who = 'Porter') {
  close(); if (!S) S = read(); if (!o) return { ok: false };
  if (S.pass) return { ok: false, why: 'held' };
  const g = game(), C = window.SSX?.contraband;
  if (o.kind === 'cash') { if (!g?.spend?.(o.cr)) { toast(`${who}: That\u2019s not ${o.cr}.`); return { ok: false, why: 'cash' }; } }
  else { if (!C || (stash()[o.item] || 0) < o.qty || C.remove(o.item, o.qty) < o.qty) { toast(`${who}: You\u2019re not holding that.`); return { ok: false, why: 'product' }; } }
  const r = H.buy(S, now(), o.kind === 'cash' ? 'cash' : o.item); S = r.s; save();
  const u = bribeUnlock();
  toast(`\u{1F3F0} ${who}: "Guest of the Halvorsens tonight." One entry, one job. ${u.already ? 'The villa job\u2019s yours to run.' : 'Halvorsen Villa is on your \u2630 Heists list for one run.'}`, 4200);
  try { g?.save?.(); } catch (e) { /* */ }
  return { ok: true, pass: { ...S.pass } };
}
export function allow() { if (!S) S = read(); return H.allow(S, now()); }

function step() {
  if (!S) S = read();
  if (S.pass) bribeUnlock(); // a reload keeps a live pass's villa on the menu
  const here = hereAJ(), active = !!window.SSX?.heist?.active;
  if (here) { const r = H.tick(S, here, now(), active); if (r.s !== S) { S = r.s; save(); }
    if (r.ev === 'enter') toast('\u{1F3F0} Helios pass: you\u2019re in. One job. Don\u2019t make Porter regret it.', 3000);
    if (r.ev === 'used') { bribeRelock(); toast('\u{1F3F0} Helios pass used up. Next time it\u2019s another bribe.', 3200); } }
  if (chip) { const t = H.status(S, now()); chip.textContent = t; chip.style.display = t && app()?.state?.onSurface ? 'block' : 'none'; }
}
function onStart(e) { if (!S) S = read(); const r = H.jobStart(S, e.detail?.id, hereAJ()); if (r.ok) { S = r.s; save(); } }
function onEnd(e) { if (!S) S = read(); const r = H.jobEnd(S, e.detail?.id, now()); if (r.ok) { S = r.s; save(); toast(`\u{1F3F0} Job\u2019s done. You\u2019ve got ${H.GRACE_S} s before Helios security walks you out.`, 3600); } }
// index.html: world 'checkpoint' event (normal game)
let cpAt = -1e9;
export function onCheckpoint(ev) {
  if (!ev || ev.id !== 'cp-helios' || !ev.ok || wanted() > 0) return;
  if (!S) S = read(); if (S.pass || now() - cpAt < 600000) return;
  cpAt = now(); offer('ColSec', true);
}

if (typeof window !== 'undefined') {
  const boot = () => { S = read(); ensure(); setInterval(() => { try { step(); } catch (e) { /* */ } }, 500); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
  addEventListener('heist:start', onStart); addEventListener('heist:done', onEnd); addEventListener('heist:fail', onEnd);
  window.SSX = window.SSX || {};
  window.SSX.heliosPass = { offer, pay, allow, onCheckpoint, state: () => ({ ...(S || read()) }), core: H, debug: { reset() { S = H.fresh(); save(); bribeRelock(); }, tick: step } };
}
