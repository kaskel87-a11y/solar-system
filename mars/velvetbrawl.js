// v7.5.137 Velvet brawls. Pick a fighter inside the club. Both of you have health. Either of you can die.
// The blows land off the middle of the screen, on a bar along the bottom. Payout is double the stake.
// window.SSX.velvetBrawl = { open, pick, strike, leave, state }
const FOES = [
  { id: 'vex', name: 'Vex Kline', hp: 48, stake: 100, line: 'Vex rolls taped wrists and a leather vest. "Two of us walk in. One walks out."' },
  { id: 'sera', name: 'Sera Doss', hp: 72, stake: 250, line: 'Sera Doss, boots and a buttoned coat, cracks her neck. "I do not tap."' },
  { id: 'brick', name: 'Brick Moll', hp: 96, stake: 500, line: 'Brick Moll fills the aisle in a work shirt. "Bet it. Then bleed."' }
];
const app = () => window.__app;
const game = () => app()?.surface?.game || app()?.game;
const toast = (t, ms = 2800) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const inside = () => app()?.surface?.info?.inside?.kind === 'club';

let root = null, fight = null;

function ensure() {
  if (root) return root;
  const st = document.createElement('style'); st.id = 'vbrawlCss';
  st.textContent = '#vbrawl{position:fixed;left:0;right:0;bottom:0;z-index:17;display:none;padding:10px 10px calc(10px + env(safe-area-inset-bottom));background:#000;color:#fff;border-top:2px solid #fff;box-sizing:border-box;font:14px/1.3 system-ui,sans-serif}'
    + '#vbrawl.on{display:block}#vbrawl h3{margin:0 0 6px;font-size:16px}#vbrawl .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
    + '#vbrawl button{min-height:48px;min-width:48px;padding:8px 12px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:800 15px system-ui,sans-serif;touch-action:manipulation}'
    + '#vbrawl .bars{flex:1;min-width:140px}#vbrawl .bars i{display:block;height:8px;margin:3px 0;background:#222}#vbrawl .bars b{display:block;height:8px}';
  document.head.appendChild(st);
  root = document.createElement('div'); root.id = 'vbrawl';
  document.body.appendChild(root);
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'leave') leave();
    else if (b.dataset.a === 'hit') strike();
    else if (b.dataset.id) pick(b.dataset.id);
  });
  return root;
}
function you() { const g = game(); return g ? { hp: g.info.hp, max: g.info.hpMax, shield: g.info.shield } : { hp: 0, max: 1, shield: 0 }; }
function paintPick() {
  root.classList.add('on');
  root.innerHTML = '<h3>Pick a fight. Either of you can die.</h3>' + FOES.map(f => `<button type="button" data-id="${f.id}">${f.name} · ${f.hp} hp · bet ${f.stake} cr</button>`).join('') + '<button type="button" data-a="leave">Leave</button>';
}
function paintFight() {
  const y = you();
  const yp = Math.max(0, Math.round(100 * y.hp / Math.max(1, y.max)));
  const tp = Math.max(0, Math.round(100 * fight.hp / fight.max));
  root.innerHTML = `<h3>${fight.name}</h3><p>${fight.line}</p><div class="row"><div class="bars"><span>You ${Math.max(0, Math.round(y.hp))}</span><i><b style="width:${yp}%;background:#7CFFB2"></b></i><span>${fight.name} ${Math.max(0, Math.round(fight.hp))}</span><i><b style="width:${tp}%;background:#ff5a7a"></b></i></div><button type="button" data-a="hit">Hit</button><button type="button" data-a="leave">Leave</button></div>`;
}
export function open() {
  ensure();
  if (!inside()) { toast('The brawl is inside the Velvet.'); return { ok: false, where: 'club' }; }
  fight = null; paintPick(); return { ok: true };
}
export function pick(id) {
  ensure();
  if (!inside()) return { ok: false, where: 'club' };
  const f = FOES.find(x => x.id === id); if (!f) return { ok: false };
  const g = game();
  if (f.stake && g && !g.spend(f.stake)) { toast(`You need ${f.stake} cr.`); return { ok: false, poor: true }; }
  fight = { ...f, max: f.hp, stake: f.stake };
  root.classList.add('on');
  paintFight();
  return { ok: true, name: f.name, hp: f.hp };
}
export function strike() {
  if (!fight) return { ok: false };
  const dmg = 16;
  fight.hp -= dmg;
  const back = 8;
  try { game()?.hurtPlayer?.(back, { x: 0, z: 0 }); } catch (e) { /* */ }
  const y = you();
  if (fight.hp <= 0) {
    const pay = fight.stake * 2;
    try { game()?.reward?.(0, pay); } catch (e) { /* */ }
    const name = fight.name; fight = null;
    toast(`${name} is dead on the carpet. Paid ${pay} cr.`);
    root.classList.remove('on');
    return { ok: true, win: true, pay, you: y.hp };
  }
  if (y.hp <= 0 || game()?.info?.down) {
    fight = null; root.classList.remove('on');
    toast('You die on the Velvet floor.');
    return { ok: true, dead: true, you: y.hp };
  }
  paintFight();
  return { ok: true, you: y.hp, them: fight.hp };
}
export function leave() { fight = null; root?.classList.remove('on'); return { ok: true }; }
function state() { const y = you(); return { open: !!root?.classList.contains('on'), fight: fight ? { name: fight.name, hp: fight.hp, max: fight.max } : null, you: y.hp, down: !!game()?.info?.down }; }
function boot() {
  if (!window.SSX && !window.__app) { setTimeout(boot, 250); return; }
  window.SSX = window.SSX || {};
  if (window.SSX.velvetBrawl) return;
  window.SSX.velvetBrawl = { open, pick, strike, leave, state, foes: FOES.map(f => ({ id: f.id, name: f.name, hp: f.hp, stake: f.stake })) };
  try { window.SSX.registerMenuItem?.({ id: 'rmBrawl', label: '🥊 Velvet brawl', onTap: () => open() }); } catch (e) { /* */ }
  window.SSX.registerSurfaceTick?.(() => {
    if (!inside() && root?.classList.contains('on') && !fight) root.classList.remove('on');
  });
}
if (typeof window !== 'undefined') boot();
