// v7.5.12 phone HUD declutter (Collin's iPhone screenshot: the wanted stars + "SEARCH 3s" pill and the "🎯 Mission: police easing off"
// chip sat on top of the job card and its Stuck? button). Loaded by one guarded import in index.html. Phones only (touch, <= 500 px wide).
//  - ONE slim status row (#hxStat) in flow inside the top-right stack (#stackR), right under the mission card: ★ stars · 🔎 search ·
//    🎯 police easing off. mars/pursuit.js (#puHud) and mars/missionheat.js (#mhChip) still render their own pills (we copy their
//    text); on phones those floating pills are hidden, so nothing is absolutely stacked over the card, the minimap or the buttons.
//  - while you're wanted the mission card folds to one line (title, ⏱, ➤ distance); the step text comes back when the heat is off.
//  - Stuck? (Ben's idea) is hidden until ~20 s pass with no mission progress and no movement; it's always in ☰ as "🆘 Stuck? hint".
//  - the 🎬 DIRECTOR badge is hidden on phones (Director stays in ☰ → 🎬 Director). 🐾 Pet already only shows next to a dog.
// Buttons stay black with white text. Window API: SSX.hudSlim = { on(), idleS(), state(), showStuck(ms) }
const app = () => window.__app;
const IDLE_S = 20, MOVE_M = 2;
const isOn = () => document.body.classList.contains('touch') && innerWidth <= 500;
const css = `
/* playtest M2 (iPhone SE 375x667): the stack is clipped at 25vh to keep the middle clear, and the job-offer pill sat last, so it was clipped away
   under the tour card + waypoint. It now rides first while it waits (one 22 px line), and the waypoint chip steps aside meanwhile */
body.hxSlim #stackR > #radio{order:-1}
body.hxSlim #stackR:has(> #radio.mini[style*="block"]) > #hxWay{display:none!important}
#hxStat{display:none;align-items:center;gap:6px;box-sizing:border-box;max-width:min(300px,100%);min-height:24px;padding:2px 8px;border-radius:9px;background:#000;color:#fff;border:1px solid #fff;font:800 12px/1.2 system-ui,sans-serif;white-space:nowrap;overflow:hidden;pointer-events:none;flex:none}
#hxStat.on{display:flex} #hxStat .st{letter-spacing:1px} #hxStat .st i{font-style:normal;opacity:.3} #hxStat .sr{color:#ffd400} #hxStat .mh{font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;min-width:0}
#hxStat .sep{opacity:.5}
body.hxSlim #surfInfo .gv,body.hxSlim.driving #surfInfo b,body.hxSlim #surfInfo .spd .sep{display:none!important} body.hxSlim #surfInfo{text-overflow:clip}
body.hxSlim #puHud,body.hxSlim #mhChip,body.hxSlim #dirTag{display:none!important}
body.hxSlim.surface:not(.indoors) #stackR{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
body.hxSlim #hxStuck:not(.hxShow){display:none!important}
body.hxSlim.wanted #hxCard :is(#hxJob .l2,#questTrack .hxTx,#questTrack .hxHow,#questTrack br){display:none!important}
body.hxSlim.wanted #hxCard.box{padding-top:2px;padding-bottom:2px} body.hxSlim.wanted #hxCard :is(#hxQuit,#hxStuck){min-height:32px;min-width:40px} body.hxSlim.wanted #hxQuit .i{display:none}
`;
const S = { on: false, idle: 0, anchor: null, key: '', last: 0, forceT: 0, stat: null };
function ensure() {
  if (S.stat) return S.stat;
  const st = document.createElement('style'); st.id = 'hxSlimCss'; st.textContent = css; document.head.appendChild(st);
  S.stat = document.createElement('div'); S.stat.id = 'hxStat'; S.stat.setAttribute('aria-live', 'polite');
  return S.stat;
}
function place() {
  const stack = document.getElementById('stackR'), card = document.getElementById('hxCard'), el = ensure();
  if (!stack) return;
  if (card && card.parentNode === stack) { if (card.nextSibling !== el) stack.insertBefore(el, card.nextSibling); }
  else if (el.parentNode !== stack) stack.appendChild(el);
}
const shown = el => !!el && el.classList.contains('show');
function status() {
  const pu = document.getElementById('puHud'), mh = document.getElementById('mhChip'), b = document.body;
  const parts = [];
  if (shown(pu) && b.classList.contains('surface') && !b.classList.contains('duel')) parts.push(pu.innerHTML);
  if (shown(mh) && !b.classList.contains('indoors') && !b.classList.contains('duel')) parts.push(`<span class="mh">🎯 ${(mh.textContent || '').replace(/^\s*🎯\s*(Mission:\s*)?/, '')}</span>`);
  const html = parts.join('<span class="sep">·</span>');
  if (S.stat.__h !== html) { S.stat.innerHTML = html; S.stat.__h = html; }
  S.stat.classList.toggle('on', !!html);
}
function idleTick(dt) {
  const btn = document.getElementById('hxStuck'); if (!btn) { S.idle = 0; return; }
  const cam = app()?.surface?.camera, p = cam ? { x: cam.position.x, z: cam.position.z } : null;
  const card = document.getElementById('hxCard'), fg = document.getElementById('farmGuide');
  const key = ((card?.classList.contains('on') ? card.textContent : '') + '|' + (fg?.classList.contains('on') ? fg.textContent : '')).replace(/[\d.:]+\s*(k?m|s)?/g, '').replace(/Stuck\?|Quit/g, '');
  const moved = p && S.anchor && Math.hypot(p.x - S.anchor.x, p.z - S.anchor.z) > MOVE_M;
  if (!S.anchor || moved || key !== S.key) { S.anchor = p; S.key = key; S.idle = 0; } else S.idle += dt;
  const pop = document.getElementById('stuckPop')?.classList.contains('on');
  btn.classList.toggle('hxShow', S.idle >= IDLE_S || pop || performance.now() < S.forceT);
}
function menu() {
  const X = window.SSX; if (!X?.registerMenuItem || document.getElementById('hxStuckMenu')) return !!X?.registerMenuItem;
  try { X.registerMenuItem({ id: 'hxStuckMenu', label: '🆘 Stuck? hint', onTap: () => {
    const btn = document.getElementById('hxStuck');
    if (!btn || !btn.classList.contains('vis')) { app()?.toast?.('🆘 Stuck? works during a mission, a job or the farm guide.', 2400); return; }
    S.forceT = performance.now() + 30000; btn.classList.add('hxShow'); setTimeout(() => btn.click(), 60);
  } }); } catch (e) { console.warn('hudslim menu', e); }
  return true;
}
let menuDone = false;
function tick() {
  const now = performance.now(), dt = S.last ? Math.min(1, (now - S.last) / 1000) : 0; S.last = now;
  const on = isOn(); if (on !== S.on) { S.on = on; document.body.classList.toggle('hxSlim', on); }
  if (!menuDone) menuDone = menu();
  if (!on) { if (S.stat) S.stat.classList.remove('on'); return; }
  place(); status(); idleTick(dt);
}
ensure(); setInterval(tick, 250); tick();
// mirror #puHud / #mhChip text changes right away (the 250 ms poll lagged a SEEN -> SEARCH flip)
try { let mq = 0; const mo = new MutationObserver(() => { if (S.on && !mq) { mq = 1; queueMicrotask(() => { mq = 0; try { status(); } catch (e) { /* */ } }); } });
  const watch = () => { for (const id of ['puHud', 'mhChip']) { const e = document.getElementById(id); if (e && !e.__hxMo) { e.__hxMo = 1; mo.observe(e, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] }); } } };
  watch(); setInterval(watch, 2000); } catch (e) { /* */ }
window.SSX = window.SSX || {};
window.SSX.hudSlim = { showStuck: (ms = 30000) => { S.forceT = performance.now() + ms; document.getElementById('hxStuck')?.classList.add('hxShow'); }, on: () => S.on, idleS: () => S.idle, state: () => ({ on: S.on, idle: +S.idle.toFixed(1), stat: S.stat?.textContent || '', statOn: !!S.stat?.classList.contains('on') }) };
