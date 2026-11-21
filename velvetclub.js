// Velvet club level, and the two lobby upgrades Collin buys.
import * as K from './velvetclubcore.js';

const KEY = K.KEY;
const game = () => window.__app?.surface?.game || window.__app?.game;
const toast = (t, ms) => { try { window.__app?.toast?.(t, ms); } catch (e) { /* */ } };
const credits = () => game()?.progress?.credits | 0;

let save = K.fresh(), chip = null, chipUntil = 0;

function load() { try { save = K.load(localStorage.getItem(KEY)); } catch (e) { save = K.fresh(); } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* */ } }
function spend(n) { const g = game(); return !!(g && g.spend && g.spend(n)); }

const CSS = `#vxClub{position:relative;z-index:1;display:none;max-width:100%;box-sizing:border-box;padding:6px 10px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 14px/1.25 system-ui,sans-serif;pointer-events:none}
#vxClub.on{display:block}`;

function ensure() {
  if (chip) return chip;
  const st = document.createElement('style'); st.id = 'vxClubCss'; st.textContent = CSS; document.head.appendChild(st);
  chip = document.createElement('div'); chip.id = 'vxClub';
  (document.getElementById('stackR') || document.body).appendChild(chip);
  return chip;
}
function paint() {
  const el = ensure();
  const inside = window.__app?.surface?.info?.inside?.kind === 'club';
  el.textContent = K.short(save.xp);
  el.classList.toggle('on', !!inside && performance.now() < chipUntil);
}
function owns(id) { return id === 'bingo' ? !!save.bingo : id === 'paddle' ? !!save.paddle : false; }
function buy(id) {
  if (id !== 'bingo' && id !== 'paddle') return { ok: false, msg: 'Unknown upgrade.' };
  if (owns(id)) return { ok: true, owned: true };
  if (credits() < K.PRICE) { toast(`You need ${K.PRICE.toLocaleString()} cr.`, 2400); return { ok: false, msg: 'short' }; }
  if (!spend(K.PRICE)) { toast(`You need ${K.PRICE.toLocaleString()} cr.`, 2400); return { ok: false, msg: 'short' }; }
  save[id] = true; persist(); paint();
  const name = id === 'bingo' ? 'Bingo table' : 'Plasma Paddle cabinet';
  toast(`${name} is yours.`, 2600);
  return { ok: true };
}
function play(wager) {
  const before = K.level(save.xp);
  save.xp += K.gain(wager);
  save.games++;
  const after = K.level(save.xp);
  persist(); chipUntil = performance.now() + 3200; paint();
  if (after > before) toast(`Velvet level ${after}. ${K.perkLine(after)}`, 3400);
  return { level: after, xp: save.xp };
}

const API = {
  KEY, PRICE: K.PRICE,
  owns, buy, play, paint,
  level: () => K.level(save.xp),
  perk: () => K.perk(K.level(save.xp)),
  line: () => K.line(save.xp),
  state: () => ({ ...save, level: K.level(save.xp) }),
  debug: { setXp(n) { save.xp = Math.max(0, n | 0); persist(); paint(); return K.level(save.xp); }, reset() { save = K.fresh(); persist(); paint(); } }
};

function boot() {
  if (!window.SSX) { setTimeout(boot, 250); return; }
  if (window.SSX.velvetclub) return;
  load();
  window.SSX.velvetclub = API;
  try { window.SSX.registerSurfaceTick?.(() => paint()); } catch (e) { /* */ }
}
boot();
export default API;
