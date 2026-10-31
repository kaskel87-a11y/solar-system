// v7.5.16 keyboard for every on-screen action (Collin, laptop: "Dealer" had no key; the mouse should never be needed).
// One layer over all modules, no module edits needed when a new button appears:
//  - Context buttons (the #surfBtns column and the floating *Act / *CtxBtn buttons): a module that already owns a key keeps
//    it (OWN map, or a "(X)" already in its label); every other visible one gets Enter (the first / main one) and then
//    Shift+Enter, = and - for the rest (never a number key), in on-screen order. The key shows after the label ("🚗 Dealer (Enter)").
//  - Open cards / sheets / panels / the ☰ menu: 1-9 press the listed options in order, Enter the main one (a .go / the
//    first option), Esc closes (the card's own ✕ / Close / Later, else hides it).
//  - Labels are desktop only (body.touch hides them). Never while typing (Save Code, names, chat).
// SSX.keys.audit() lists visible action buttons and their binding (tests/test-keys.js fails on any without one).
const OWN = { // id -> key the owning module already handles
  driveBtn: 'E', petBtn: 'P', radioBtn: 'N', heistBtn: 'G', jobAct: 'G', barContactBtn: 'G', baseBtn: 'K', turfAct: 'Y',
  airRollBtn: 'Z', dzPay: '1', dzFight: '2', dzRun: '3', dzTalk: '4', cbBtn: 'B', raceCtxBtn: 'Enter', snipeBtn: 'Z', craneBtn: 'G', radioAccept: 'Enter', radioLater: '⌫', hxStuck: '/',
};
const TOUCH_ONLY = new Set(['jumpBtn', 'runBtn', 'fireBtn', 'meleeBtn', 'hudShow']);
const CTX_SEL = '#surfBtns button, [id$="Act"], [id$="CtxBtn"], #hxCtxNext, #airRollBtn, #cbBtn, #hxStuck, #dockRcn, #dockSmg, #dockSmgF'; // v7.5.16: the 🦝 / smuggling dock buttons lost their number keys
// HUD furniture that is never a "card": the right stack, dock, minimap, joystick, the context column itself
const NOT_CARD = new Set(['surfHud', 'surfBtns', 'stackR', 'ssxDock', 'miniMap', 'hudShow', 'fireBtn', 'meleeBtn', 'joy', 'flyBtns', 'hud', 'crosshair', 'toast', 'loading', 'fireHint', 'kbLayerCss', 'radio', 'ctlPanel', 'topBar', 'snScope']); // radio offer + controls panel: own keys (Enter/⌫, Esc)
const OWNKEY_RE = /\((?:[A-Z0-9]|Enter|Esc|Space|Tab|Shift[^)]*|⇧[^)]*|[[\]\\.,';/`-])\)\s*$/;
const CSS = `body:not(.touch) [data-kb]::after{content:' (' attr(data-kb) ')';opacity:.85;font-weight:600}
body:not(.touch) .kbNum[data-kbn]::before{content:attr(data-kbn) ' · ';opacity:.7;font-weight:700}`;
const vis = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
const typing = () => { const t = document.activeElement; return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
const label = el => (el.textContent || el.getAttribute('aria-label') || '').trim();
const ownKey = el => OWN[el.id] || (OWNKEY_RE.test(label(el)) ? label(el).match(/\(([^)]*)\)\s*$/)[1] : null) || (el.closest('#dzEvChoices') ? String([...el.parentNode.children].indexOf(el) + 1) : null);
const CODE = k => k === 'Enter' ? 'Enter' : /^[A-Z]$/.test(k) ? 'Key' + k : /^[0-9]$/.test(k) ? 'Digit' + k : k;
let ctxMap = [], card = null;

function contextButtons() {
  const seen = new Set(), out = [];
  for (const el of document.querySelectorAll(CTX_SEL)) {
    if (seen.has(el) || TOUCH_ONLY.has(el.id) || el.closest('.touch-only') || el.disabled || !vis(el)) continue;
    if (el.tagName !== 'BUTTON' && el.getAttribute('role') !== 'button') continue;
    seen.add(el); out.push(el);
  }
  // on-screen order: top to bottom (the column grows upward, so the top one is the newest / main action)
  return out.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
}
const FREE = ['Enter', '⇧Enter', '=', '-']; // v7.5.16 (Ben): no number keys outside numbered menus; = and - are only used inside the track builder
function assign() {
  const btns = contextButtons(), used = new Set(), map = [];
  for (const el of btns) { const k = ownKey(el); if (k) { used.add(k); map.push({ el, key: k, own: true }); } }
  let fi = 0;
  for (const el of btns) { if (map.some(m => m.el === el)) continue; while (fi < FREE.length && used.has(FREE[fi])) fi++; const k = FREE[fi++] || null; if (k) used.add(k); map.push({ el, key: k, own: false }); }
  for (const m of map) { const want = m.own ? (OWN[m.el.id] && !OWNKEY_RE.test(label(m.el)) ? m.key : null) : m.key; if (want) { if (m.el.dataset.kb !== want) m.el.dataset.kb = want; } else if (m.el.dataset.kb && !m.own) delete m.el.dataset.kb; else if (m.el.dataset.kb && OWNKEY_RE.test(label(m.el))) delete m.el.dataset.kb; }
  ctxMap = map; return map;
}
// ---------- cards / sheets / panels ----------
function cardButtons(c) {
  return [...c.querySelectorAll('button, [role="button"], .item[data-id], a.btn')].filter(b => !b.disabled && vis(b) && !isClose(b) && !b.closest('[data-kbskip]'));
}
const CLOSE_RE = /^(✕|✖|×|x|close|✕ close|✖ close|later|not now|cancel|back|leave|done|no thanks)$/i;
const isClose = b => b.matches('.cfX, .close, [data-close], #raceResClose, button.ok') ? !/^(ok|accept)$/i.test(label(b)) || b.matches('.cfX, .close, [data-close]') : CLOSE_RE.test(label(b).replace(/\s*\([^)]*\)$/, '').replace(/^[^\w✕✖×]+/, '').trim());
function openCard() {
  const cands = [];
  const consider = el => { if (!el || NOT_CARD.has(el.id) || el.id === 'cfLayer') return; if (!vis(el)) return; const r = el.getBoundingClientRect(); if (r.width * r.height < 9000) return;
    const cs = getComputedStyle(el); if (cs.position !== 'fixed' && cs.position !== 'absolute' && !el.parentElement?.id?.match(/cfLayer/)) return; if (cs.pointerEvents === 'none' && !el.querySelector('button')) return;
    if (!cardButtons(el).length && !el.querySelector('.cfX, .close, [data-close]')) return;
    // only real sheets / result cards / dialogs, not HUD cards (the 📜 mission card with its Stuck? button)
    const modal = el.parentElement?.id === 'cfLayer' || r.width * r.height >= 40000 || el.getAttribute('role') === 'dialog' || /sheet|panel|result|dialog|modal|menu|pop/i.test(el.id + ' ' + el.className);
    if (modal) cands.push({ el, z: +cs.zIndex || 0 }); };
  for (const el of document.body.children) consider(el);
  for (const el of document.getElementById('cfLayer')?.children || []) consider(el);
  for (const el of document.getElementById('surfHud')?.children || []) if (el.id !== 'surfBtns' && (el.querySelector('.cfX, .close, [data-close]') || cardButtons(el).length >= 2)) consider(el); // HUD chips with one button (Stuck?) are not cards // radio card, dialogue, popups inside the HUD
  if (!cands.length) return null;
  cands.sort((a, b) => b.z - a.z); return cands[0].el;
}
function decorate(c) {
  const bs = cardButtons(c); bs.forEach((b, i) => { const n = i < 9 ? String(i + 1) : ''; if (b.dataset.kbn !== n) { b.dataset.kbn = n; b.classList.add('kbNum'); } });
  return bs;
}
function closeCard(c) {
  const x = [...c.querySelectorAll('button, [data-close], .cfX, .close')].find(b => vis(b) && isClose(b));
  if (x) { press(x); return true; }
  return false; // no close control: leave Esc to the owning module (shop / log panels, the ☰ menu close on Esc themselves)
}
function press(b) {
  try { b.click(); } catch (e) { /* */ }
}
function onKey(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing()) return;
  if (!document.body || document.body.classList.contains('touch') && !e.isTrusted) return;
  const code = e.code; if (!/^(Enter|NumpadEnter|Escape|Digit[1-9]|Numpad[1-9]|Equal|Minus)$/.test(code)) return;
  const c = openCard();
  if (c) {
    if (code === 'Escape') { if (e.repeat) return; if (closeCard(c)) { e.preventDefault(); e.stopPropagation(); } return; }
    const bs = decorate(c), n = /([1-9])$/.exec(code)?.[1];
    if (n && !e.shiftKey) { const b = bs[+n - 1]; if (b) { if (e.repeat) return; e.preventDefault(); e.stopPropagation(); press(b); } return; }
    if ((code === 'Enter' || code === 'NumpadEnter') && !e.shiftKey) { if (e.repeat || (document.activeElement?.tagName === 'BUTTON' && c.contains(document.activeElement)) ) return; /* a focused option presses natively */ const b = c.querySelector('button.go:not([disabled]), #raceAgain, #radioAccept') || bs[0]; if (b && vis(b)) { e.preventDefault(); e.stopPropagation(); press(b); } return; }
  }
  if (e.repeat) return;
  const map = assign(), want = (code === 'Enter' || code === 'NumpadEnter') ? (e.shiftKey ? '⇧Enter' : 'Enter') : code === 'Equal' && !e.shiftKey ? '=' : code === 'Minus' && !e.shiftKey ? '-' : null;
  if (want && want.length === 1 && window.__race?.builder?.open) return; // the track builder zooms with - / =
  if (!want) return;
  const m = map.find(m => !m.own && m.key === want); if (!m) return; // own keys (race Enter, G, K ...) stay with their modules
  e.preventDefault(); e.stopPropagation(); press(m.el);
}
// v7.5.16: the 🦝 / smuggling dock actions lived on number keys (5, 8, 9) because #ssxDock is hidden on desktop. With the
// number keys now menu-only, desktop gets a mirror button in the #surfBtns column (clicks the real one), so the action
// is visible, clickable and gets a context key + label like every other one. Touch keeps the real dock button.
const DOCK_ACT = ['dockRcn', 'dockSmg', 'dockSmgF'];
function mirrorDock() {
  const touch = document.body.classList.contains('touch'), col = document.getElementById('surfBtns');
  for (const id of DOCK_ACT) {
    const src = document.getElementById(id); let m = document.getElementById('kbp_' + id);
    const want = !touch && !!col && !!src && src.style.display !== 'none' && !vis(src);
    if (!want) { if (m) m.remove(); continue; }
    if (!m) { m = document.createElement('button'); m.type = 'button'; m.id = 'kbp_' + id; m.className = 'kbMirror'; m.addEventListener('click', () => document.getElementById(id)?.click()); col.prepend(m); }
    const t = (src.textContent || '').replace(/\s*\n\s*/g, ' ').trim(); if (m.textContent !== t) m.textContent = t;
    const al = src.getAttribute('aria-label') || t; if (m.getAttribute('aria-label') !== al) m.setAttribute('aria-label', al);
  }
}
let lastCard = null;
function tick() {
  if (!document.body) return; mirrorDock(); assign();
  const c = document.body.classList.contains('touch') ? null : openCard();
  if (c !== lastCard) { if (lastCard) for (const b of lastCard.querySelectorAll('.kbNum')) { b.classList.remove('kbNum'); delete b.dataset.kbn; } lastCard = c; }
  if (c) decorate(c);
}
function audit() {
  mirrorDock(); assign(); const out = [];
  for (const m of ctxMap) out.push({ id: m.el.id || null, label: label(m.el).slice(0, 40), key: m.key, own: m.own, kind: 'context' });
  const c = openCard(); if (c) { const bs = decorate(c); bs.forEach((b, i) => out.push({ id: b.id || null, label: label(b).slice(0, 40), key: i < 9 ? String(i + 1) : null, kind: 'card', card: c.id || c.className })); out.push({ kind: 'cardClose', card: c.id || c.className, key: 'Esc' }); }
  return out;
}
export const API = { audit, assign, openCard: () => openCard(), own: { ...OWN } };
if (typeof window !== 'undefined') {
  const st = document.createElement('style'); st.id = 'kbLayerCss'; st.textContent = CSS; document.head.appendChild(st);
  document.addEventListener('keydown', onKey); // document bubble: runs after modules' window-capture handlers, before their window-bubble ones
  setInterval(tick, 400);
  const attach = () => { if (window.SSX && window.SSX.keys !== API) window.SSX.keys = API; };
  window.SSX = window.SSX || {}; attach(); setInterval(attach, 1000);
}
