// Pit fight controls (v7.5.107). Camera-relative movement is in surface.js. This file is the
// on-screen buttons, the stamina and round bars, the first-time tips card, and the crowd line.
import * as F from './pitfightcore.js';

const KEY = 'ssx.pit.tips';
const css = `
#pitPad{position:fixed;z-index:14;right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));display:none;flex-direction:column;gap:6px;width:148px}
body.duel #pitPad.on{display:flex}
#pitPad button{min-height:48px;width:100%;padding:0 8px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 15px/1 system-ui,sans-serif;touch-action:none}
#pitPad button.on{background:#fff;color:#000}
#pitPad button:disabled{opacity:.4}
#pitBars{position:fixed;z-index:14;left:50%;transform:translateX(-50%);top:calc(58px + env(safe-area-inset-top));display:none;width:min(420px,calc(100vw - 16px));box-sizing:border-box;padding:6px 10px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 13px/1.2 system-ui,sans-serif}
body.duel #pitBars.on{display:block}
#pitBars .row{display:flex;justify-content:space-between;gap:8px}
#pitBars .bar{height:8px;border-radius:4px;background:#222;overflow:hidden;margin-top:3px}
#pitBars .bar i{display:block;height:100%;width:0}
#pitBars .you i{background:#22c55e} #pitBars .them i{background:#f97316} #pitBars .sta i{background:#38bdf8}
#pitCheer{position:fixed;z-index:15;left:50%;top:38%;transform:translate(-50%,-50%);display:none;padding:8px 14px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 22px system-ui,sans-serif;pointer-events:none}
#pitCheer.on{display:block}
body.duel #fireBtn, body.duel #meleeBtn{display:none!important}
#pitTips{position:fixed;z-index:62;left:50%;top:calc(128px + env(safe-area-inset-top));transform:translateX(-50%);display:none;width:min(440px,calc(100vw - 16px));box-sizing:border-box;padding:12px;border-radius:14px;background:#000;color:#fff;border:2px solid #fff;font:15px/1.35 system-ui,sans-serif}
#pitTips.on{display:block} #pitTips button{min-height:48px;width:100%;margin-top:8px;border-radius:10px;background:#fff;color:#000;border:0;font:800 16px system-ui,sans-serif}
`;
let S = null, els = null, seen = false;
const duel = () => { try { return window.__app?.surface?.world?.duelState?.() || window.__app?.surface?.info?.duel || null; } catch (e) { return null; } };
const pitOn = () => { const d = duel(); return !!(d && d.type === 'fists'); };

function ui() {
  if (els) return els;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const pad = document.createElement('div'); pad.id = 'pitPad';
  pad.innerHTML = ['Punch', 'Kick', 'Block', 'Dodge', 'Special'].map(n => `<button type="button" data-p="${n.toLowerCase()}">${n}</button>`).join('');
  const bars = document.createElement('div'); bars.id = 'pitBars';
  bars.innerHTML = '<div class="row"><span id="pitTime">1:15</span><span id="pitStyle"></span></div><div class="bar you"><i></i></div><div class="bar them"><i></i></div><div class="bar sta"><i></i></div>';
  const cheer = document.createElement('div'); cheer.id = 'pitCheer';
  const tips = document.createElement('div'); tips.id = 'pitTips';
  tips.innerHTML = `<div>${F.tipsText}</div><button type="button">Got it</button>`;
  document.body.appendChild(pad); document.body.appendChild(bars); document.body.appendChild(cheer); document.body.appendChild(tips);
  const hold = {};
  const btn = name => pad.querySelector(`[data-p="${name}"]`);
  const down = (name, e) => {
    e.preventDefault();
    if (name === 'block') { F.blockDown(S); btn(name).classList.add('on'); return; }
    if (name === 'special') { if (F.chargeStart(S)) btn(name).classList.add('on'); return; }
    hold[name] = performance.now();
  };
  const up = (name, e) => {
    e?.preventDefault?.();
    btn(name)?.classList.remove('on');
    if (!S) return;
    if (name === 'block') { F.blockUp(S); return; }
    if (name === 'special') { const r = F.chargeRelease(S); if (r.ok) swing('special'); return; }
    if (name === 'dodge') { F.dodge(S); return; }
    if (name === 'kick') { if (F.kick(S).ok) swing('kick'); return; }
    if (name === 'punch') { const held = performance.now() - (hold.punch || 0) > 280; const r = F.punch(S, held); if (r.ok) swing(r.finisher ? 'finisher' : 'punch'); }
  };
  for (const b of pad.querySelectorAll('button')) {
    b.addEventListener('pointerdown', e => down(b.dataset.p, e));
    b.addEventListener('pointerup', e => up(b.dataset.p, e));
    b.addEventListener('pointercancel', e => up(b.dataset.p, e));
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  tips.querySelector('button').addEventListener('pointerup', e => { e.preventDefault(); try { localStorage.setItem(KEY, '1'); } catch (err) { /* */ } tips.classList.remove('on'); });
  els = { pad, bars, cheer, tips, you: bars.querySelector('.you i'), them: bars.querySelector('.them i'), sta: bars.querySelector('.sta i'), time: bars.querySelector('#pitTime'), style: bars.querySelector('#pitStyle') };
  return els;
}
function swing(kind) {
  window.__pitHit = kind;
  try { window.__app?.game?.melee?.(); } catch (e) { /* */ }
  window.__pitHit = null;
}
function ensure(d) {
  if (!S || S.name !== d.name) S = F.fresh(d.name);
}
function frame(dt) {
  const U = ui();
  const d = duel();
  const on = pitOn();
  U.pad.classList.toggle('on', on && d.phase === 'fight');
  U.bars.classList.toggle('on', on);
  if (!on) { S = null; U.cheer.classList.remove('on'); return; }
  ensure(d);
  F.tick(S, dt, S.block > 0);
  if (d.phase === 'fight' && F.timeLeft(S) <= 0) { try { window.__app?.surface?.world?.endPit?.(d.me >= d.them ? 'ko-win' : 'ko-lose'); } catch (e) { /* */ } }
  const left = Math.ceil(d.phase === 'count' ? d.count : F.timeLeft(S));
  U.time.textContent = d.phase === 'count' ? `${d.count}` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  U.style.textContent = F.STYLES[S.style].name + ((d.tel > 0 || d.pit?.tel > 0) ? ' · SWINGING' : '');
  U.you.style.width = Math.max(0, Math.min(100, d.me)) + '%';
  U.them.style.width = Math.max(0, Math.min(100, d.them)) + '%';
  U.sta.style.width = Math.round(S.sta) + '%';
  if (S.cheer) { U.cheer.textContent = S.cheer === 'PARRY' ? 'PARRY' : S.cheer === 'COMBO' ? 'COMBO' : S.cheer === 'FINISH' ? 'FINISH' : 'OHH!'; U.cheer.classList.add('on'); }
  else U.cheer.classList.remove('on');
  if (d.phase === 'fight' && !seen) {
    seen = true; let had = false; try { had = localStorage.getItem(KEY) === '1'; } catch (e) { had = false; }
    if (!had) U.tips.classList.add('on');
  }
  if (d.phase !== 'fight') U.tips.classList.remove('on');
}

function boot() {
  if (!window.__app?.surface) { setTimeout(boot, 300); return; }
  ui();
  let last = performance.now();
  const loop = () => {
    const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n;
    try { frame(dt); } catch (e) { /* */ }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.SSX = window.SSX || {};
  window.SSX.pitfight = {
    stickWorld: F.stickWorld, fresh: F.fresh, punch: F.punch, kick: F.kick, dodge: F.dodge, absorb: (dmg) => S ? F.absorb(S, dmg) : { dmg, dodge: false, parry: false },
    windup: () => S ? F.STYLES[S.style].wind : 0.5,
    shake: () => S?.shake || 0, downFor: () => S?.down || 0, state: () => S ? { ...S } : null,
    tips: F.tipsText
  };
}
boot();
