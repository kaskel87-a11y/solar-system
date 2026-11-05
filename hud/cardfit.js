// v7.5.15 card fit (Collin, Oct 31 2026 — iPhone landscape screenshot: the race result card was cut off by the right
// stack, sat over Exit/Next and could not be dismissed). Every popup / result / dialogue / toast card now:
//  - fits on screen: a max height inside the viewport, scrolls inside when long, smaller text on phones;
//  - has a clear black ✕ (white text, 44 px tap target) and closes when you tap the card itself;
//  - never covers the action buttons: big cards (race result) live in a top-centre layer whose height stops above
//    whichever buttons sit under it (measured, so it follows landscape/portrait and in-car layouts).
// Closing only hides the card (class cfOff); the owning module's own close (e.g. race ✖) runs when present, and the
// card shows again the next time its module changes it — no flow loses its Next/Rematch path.
const CARDS = { // id -> { tap: tap-card-to-close, big: lives in the centre layer }
  raceResult: { tap: true, big: true },
  toast: { tap: true },
  discPop: { tap: false }, // tapping expands the fact (existing flow); the ✕ closes
  stuckPop: { tap: false }, // its own buttons are the actions; the ✕ closes
};
const CSS = `
#cfLayer{position:fixed;z-index:10;left:50%;top:calc(60px + var(--sat,0px));transform:translateX(-50%);width:min(380px,calc(100vw - 24px));display:flex;flex-direction:column;gap:6px;pointer-events:none;max-height:calc(100dvh - 200px)}
#cfLayer>*{pointer-events:auto;box-sizing:border-box;max-width:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
#cfLayer>#raceResult{max-width:none}
.cfCard{position:relative}
.cfOff{display:none!important}
.cfCard>.cfX,#cfLayer .cfCard>.cfX{all:unset;box-sizing:border-box;position:sticky;top:0;float:right;z-index:2;width:30px;height:30px;margin:-2px -3px 2px 8px;border-radius:50%;background:#000!important;color:#fff!important;border:2px solid #fff!important;min-height:0!important;padding:0!important;flex:none!important;font:900 15px/26px system-ui,sans-serif!important;text-align:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.cfCard>.cfX::before{content:'';position:absolute;inset:-8px}
#toast>.cfX{width:24px;height:24px;font-size:12px!important;line-height:20px!important;margin:0 0 0 6px}
#stuckPop{max-height:calc(100dvh - 24px - var(--sat,0px) - var(--sab,0px));overflow-y:auto;overscroll-behavior:contain}
@media (max-height:440px),(max-width:440px){
 #cfLayer #raceResult{font-size:0.66rem;line-height:1.25;padding:6px 8px}
 #cfLayer #raceResult h4{font-size:0.8rem}
 #cfLayer #raceResult button{min-height:40px;font-size:0.74rem}
 #discPop p,#discPop small{font-size:0.68rem}
 #stuckPop{font-size:13px}
}
@media (max-height:440px){#cfLayer{top:calc(50px + var(--sat,0px));width:min(360px,calc(100vw - 2 * (24vw + 16px)))}}
`;
const $ = id => document.getElementById(id);
let layer = null;
const wired = new WeakSet();

function nativeClose(el) { // prefer the module's own close so its state (timers, flags) stays right
  const b = el.querySelector('#raceResClose, button.ok, button.close, [data-close]');
  if (!b) return false;
  for (const t of ['pointerdown', 'pointerup', 'touchend', 'click']) {
    try { b.dispatchEvent(t.startsWith('pointer') ? new PointerEvent(t, { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }) : new Event(t, { bubbles: true, cancelable: true })); } catch (_) {}
  }
  return true;
}
function close(el) {
  el.classList.add('cfOff'); el.__cfOffAt = performance.now();
  nativeClose(el);
  if (el.id === 'toast') el.classList.remove('on');
  if (el.id === 'discPop') el.classList.remove('show', 'open');
  if (el.id === 'stuckPop') el.classList.remove('on');
  ensureX(el);
}
function ensureX(el) {
  if (el.querySelector(':scope > .cfX')) return;
  const x = document.createElement('button'); x.type = 'button'; x.className = 'cfX'; x.textContent = '\u2715'; x.setAttribute('aria-label', 'Close');
  const stop = e => { e.stopPropagation(); };
  x.addEventListener('pointerdown', stop); x.addEventListener('touchstart', stop, { passive: true });
  x.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); close(el); });
  x.addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); close(el); });
  el.insertBefore(x, el.firstChild);
}
function wire(el, cfg) {
  if (wired.has(el)) return; wired.add(el);
  el.classList.add('cfCard'); ensureX(el);
  if (cfg.tap) el.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('button, a, input, select, textarea, .row')) return;
    close(el);
  });
  // re-arm: the module changing the card (new text, shown again) brings it back and restores the ✕
  new MutationObserver(recs => {
    let content = false;
    for (const r of recs) {
      if (r.type === 'attributes') { if (r.attributeName === 'class') { /* only a fresh show re-arms */ if (!el.classList.contains('cfOff')) continue; } else if (r.attributeName === 'style') content = true; continue; }
      if ([...r.addedNodes, ...r.removedNodes].some(n => !(n.classList && n.classList.contains('cfX')))) content = true;
      if (r.type === 'characterData') content = true;
    }
    if (content) { if (performance.now() - (el.__cfOffAt || 0) > 150) el.classList.remove('cfOff'); ensureX(el); }
  }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  // toast: textContent writes wipe the ✕; ensureX above re-adds it
}

// ---- keep the big-card layer clear of the action buttons ----
const BLOCK = '#surfBtns > *, #fireBtn, #meleeBtn, #joy, #hxCtxNext, #airRollBtn, #cbBtn, [id$="Act"], #ssxDock, #miniMap, #stackR > *';
function fit() {
  if (!layer) return;
  const vis = [...layer.children].some(e => e.offsetParent && !e.classList.contains('cfOff'));
  if (!vis) return;
  const vw = innerWidth, vh = innerHeight, land = vw > vh;
  const st = $('stackR'), sr = st && st.getBoundingClientRect();
  // portrait: start below the right stack (it spans the width); landscape: beside it, between minimap and stack
  let top = land ? 50 : Math.max(60, (sr && sr.height ? sr.bottom : 60) + 6);
  layer.style.top = top + 'px';
  const lr = layer.getBoundingClientRect();
  let bottom = vh - 8;
  for (const b of document.querySelectorAll(BLOCK)) {
    if (!b.offsetParent && getComputedStyle(b).position !== 'fixed') continue;
    const r = b.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.right <= lr.left || r.left >= lr.right) continue; // not under the card's column
    if (r.bottom <= top + 4) continue; // above the layer (top bar, stack beside it)
    if (r.top > top + 4) bottom = Math.min(bottom, r.top - 6);
  }
  const h = Math.max(96, Math.round(bottom - top));
  layer.style.maxHeight = h + 'px';
  for (const c of layer.children) c.style.maxHeight = h + 'px';
}

function scan() {
  for (const id in CARDS) {
    const el = $(id); if (!el) continue;
    if (CARDS[id].big && layer && el.parentElement !== layer) layer.appendChild(el);
    wire(el, CARDS[id]);
  }
}
function init() {
  if (!document.getElementById('cfCss')) { const s = document.createElement('style'); s.id = 'cfCss'; s.textContent = CSS; document.head.appendChild(s); }
  layer = $('cfLayer') || Object.assign(document.createElement('div'), { id: 'cfLayer' });
  if (!layer.parentElement) document.body.appendChild(layer);
  scan();
  setInterval(scan, 1500); // race / stuck UIs are created lazily
  setInterval(fit, 400);
  addEventListener('resize', () => setTimeout(fit, 60));
  addEventListener('orientationchange', () => setTimeout(fit, 250));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

const api = { fit, scan, close: id => { const e = $(id); if (e) close(e); }, get layer() { return layer; } };
window.SSX = window.SSX || {}; window.SSX.cardFit = api;
export default api;
