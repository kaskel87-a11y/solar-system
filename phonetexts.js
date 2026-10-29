// v3 phone texts: once you have Danny's number (privateshow.js tips -> 'ssx.contacts'), a few short, flirty but
// non-explicit texts arrive later in play. Stored on the device (localStorage 'ssx.texts'); a toast on arrival, a
// 💬 dock button on phones (and Shift+I / a small pill on desktop) opens a simple message list. All buttons use
// window.__onTap (one finger per button on iOS). No network, no timers while the tab is hidden.
import { DANNY_NAME } from './clubdancers.js';
const DF = DANNY_NAME.split(' ')[0];
const KEY = 'ssx.texts';
// [id, seconds of play after you got the number, body]
export const TEXTS = [
  ['hi', 75, 'Hey spacer. It’s ' + DF + '. Don’t let the number go to your head 😉'],
  ['airlock', 300, 'Come back to the Airlock tonight. I’m on late, and the booth gets lonely.'],
  ['job', 600, 'Side job, if you want it: a friend needs a careful driver, no questions. Taxi stand by the dome gate. Tell them I sent you. 🚕'],
  ['tiny', 1000, 'Tiny says you still owe the chair an apology. Kidding. Mostly.'],
  ['last', 1500, 'New song tonight. You’d like it. Hands on the armrests though 💋'],
];
const CSS = `
#ssxTexts{position:fixed;inset:0;z-index:57;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
#ssxTexts.show{display:flex}
#ssxTexts .w{width:100%;max-width:420px;max-height:72vh;margin:0 8px calc(8px + env(safe-area-inset-bottom));display:flex;flex-direction:column;border-radius:16px;background:#000;color:#fff;border:1px solid #fff;font:14px/1.4 system-ui,sans-serif;overflow:hidden}
#ssxTexts .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;font-weight:700}
#ssxTexts .hd span{flex:1} #ssxTexts .hd small{color:#aaa;font-weight:400}
#ssxTexts .ls{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch}
#ssxTexts .b{align-self:flex-start;max-width:85%;padding:8px 11px;border-radius:14px 14px 14px 4px;background:#2a0c1e;border:1px solid #ff3cc8}
#ssxTexts .b i{display:block;color:#bbb;font:11px system-ui,sans-serif;margin-top:3px;font-style:normal}
#ssxTexts .none{color:#aaa;text-align:center;padding:16px 0}
#ssxTexts button,#ssxTextsPill{min-height:44px;min-width:64px;border-radius:10px;border:1.5px solid #fff;background:#000;color:#fff;font:600 14px system-ui,sans-serif;touch-action:manipulation}
#ssxTextsPill{position:fixed;z-index:13;right:12px;bottom:calc(150px + env(safe-area-inset-bottom));display:none;padding:0 12px}
body.surface:not(.touch) #ssxTextsPill.on{display:block}
body.pshow #ssxTextsPill,body.pshow #ssxTexts{display:none!important}
`;
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.msgs)) return s; } catch (e) {} return { clock: 0, msgs: [] }; };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
const hasNumber = () => { try { return !!JSON.parse(localStorage.getItem('ssx.contacts') || '{}')[DANNY_NAME]; } catch (e) { return false; } };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// opts: { toast(msg, ms), onTap(el, fn), playing: () => bool (counts play time only while true) }
export function phoneTexts({ toast = () => {}, onTap = null, playing = () => true } = {}) {
  const tap = onTap || window.__onTap || ((el, fn) => el.addEventListener('click', fn));
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = 'ssxTexts'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Messages');
  panel.innerHTML = `<div class="w"><div class="hd">📱 <span>${esc(DANNY_NAME)} <small>555-0142</small></span><button type="button" id="ssxTextsClose">Close</button></div><div class="ls" id="ssxTextsList"></div></div>`;
  const pill = document.createElement('button'); pill.id = 'ssxTextsPill'; pill.type = 'button'; pill.setAttribute('aria-label', 'Messages (Shift+I)');
  document.body.append(panel, pill);
  const list = panel.querySelector('#ssxTextsList');
  let S = load(), dockBtn = null;
  const unread = () => S.msgs.filter(m => !m.read).length;
  function badge() {
    const n = unread(), any = S.msgs.length > 0;
    pill.textContent = n ? `💬 ${n} · I` : '💬 I'; pill.classList.toggle('on', any);
    if (dockBtn) { dockBtn.textContent = n ? `💬 ${n}\nTexts` : '💬\nTexts'; dockBtn.style.display = any ? '' : 'none'; }
  }
  function render() {
    list.innerHTML = S.msgs.length ? S.msgs.map(m => `<div class="b">${esc(m.body)}<i>${new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</i></div>`).join('') : '<div class="none">No messages yet.</div>';
    list.scrollTop = list.scrollHeight;
  }
  const open = () => { if (document.body.classList.contains('pshow')) return; S.msgs.forEach(m => { m.read = true; }); save(S); render(); badge(); panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); };
  const close = () => panel.classList.remove('show');
  tap(panel.querySelector('#ssxTextsClose'), close); tap(pill, () => panel.classList.contains('show') ? close() : open());
  panel.addEventListener('pointerup', e => { if (e.target === panel) close(); });
  addEventListener('keydown', e => {
    if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (e.code === 'KeyI' && e.shiftKey && S.msgs.length && !document.body.classList.contains('pshow')) { panel.classList.contains('show') ? close() : open(); }
    else if (e.code === 'Escape' && panel.classList.contains('show')) close();
  });
  // the shared phone dock (mars/turf.js owns #ssxDock); attach when it appears
  const attach = () => { const d = document.getElementById('ssxDock'); if (!d) return false; if (dockBtn) return true;
    dockBtn = document.createElement('button'); dockBtn.id = 'dockTexts'; dockBtn.type = 'button'; dockBtn.setAttribute('aria-label', 'Messages'); dockBtn.style.order = '5'; d.appendChild(dockBtn); tap(dockBtn, () => panel.classList.contains('show') ? close() : open()); badge(); return true; };
  if (!attach()) { try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) {} }
  function deliver(id, body) {
    if (S.msgs.some(m => m.id === id)) return;
    S.msgs.push({ id, from: DANNY_NAME, body, at: Date.now(), read: false }); save(S); badge(); if (panel.classList.contains('show')) { S.msgs.at(-1).read = true; save(S); render(); }
    const touch = document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
    toast(`📱 ${DF}: ${body.length > 70 ? body.slice(0, 68) + '…' : body}  ${touch ? '(💬 Texts)' : '(I to read)'}`, 4500);
  }
  function step(sec) { // play-time clock since the number; only advances while playing and not mid-show
    if (!hasNumber()) return; S.clock += sec;
    for (const [id, after, body] of TEXTS) if (S.clock >= after && !S.msgs.some(m => m.id === id)) { deliver(id, body); break; } // at most one per step
  }
  let acc = 0;
  setInterval(() => { if (document.hidden || document.body.classList.contains('pshow') || !playing()) return; acc++; step(1); if (acc % 10 === 0) save(S); }, 1000);
  window.SSX?.on?.('contact:add', e => { if (e?.name === DANNY_NAME) { S = load(); badge(); } });
  badge();
  const api = { open, close, get state() { return { clock: S.clock, msgs: S.msgs.map(m => ({ ...m })), unread: unread() }; }, skip: sec => { step(sec); save(S); return api.state; } };
  window.__texts = api; queueMicrotask(() => { if (window.SSX) window.SSX.phoneTexts = api; });
  return api;
}
