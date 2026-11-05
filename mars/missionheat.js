/*
 * mars/missionheat.js: police ease off while you're on a mission (v7.5.11).
 *
 * Collin: "While doing a mission can we have the police calm down by 50%, I want to be able to complete a mission on foot."
 * This file only decides WHEN a mission is running and publishes one number; world.js (core ColSec) and mars/pursuit.js
 * (rovers / SWAT / roadblocks / search) read it and scale themselves. Off a mission the number is 1 and nothing changes.
 *
 * window.SSX.policeEase() -> 1 normally, EASE (0.5) while a mission is active
 * window.SSX.missionHeat  -> { EASE, FOOT, active() -> null | 'quest' | 'job' | 'activity' | 'beltway' | 'smuggle' | 'heist' | 'setpiece',
 *                             ease(), footK(), debug: { force(reason|null|undefined), state() } }
 *
 * What EASE = 0.5 does (see world.js "mission ease" and mars/pursuit.js "mission ease"):
 *  - heat gain: each reasoned rise in wanted stars is halved (fractions carry over, the first star still lands; a bare
 *    setWanted(n) or reason 'debug' still sets the level as-is)
 *  - dispatch: about half the drones / buggies / officers / heavies / rovers / SWAT / roadblocks, no gunship, respawns 2x slower
 *  - aggression: fire rate and shot / ram damage halved, bust (hands on you) takes twice as long
 *  - on foot: chasers move at FOOT (75%) speed
 *  - decay: the evade timer and the LOS search countdown are halved, so stars drop twice as fast
 * HUD: a small black chip under the stars, "🎯 Mission: police easing off", only while a mission is on AND you're wanted.
 */
import { pursuitDebug } from '../pursuit.js';

const EASE = 0.5, FOOT = 0.75;
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const tryB = f => { try { return !!f(); } catch (e) { return false; } };
let reason = null, forced, pollT = 0, chip = null, chipOn = false, onMars = false;

function detect() {
  if (forced !== undefined) return forced;
  if (!onMars || !app()?.state?.onSurface) return null;
  const x = window.SSX || {}, g = game();
  if (tryB(() => g?.isDown?.())) return null;
  if (tryB(() => x.jobs?.active?.())) return 'job';
  if (tryB(() => window.__activities?.active)) return 'activity';
  if (tryB(() => x.beltway?.active?.())) return 'beltway';
  if (tryB(() => x.smuggle?.state?.run)) return 'smuggle';
  if (tryB(() => x.heist?.active)) return 'heist';
  if (tryB(() => { const st = pursuitDebug.state; return st?.active && st.kind === 'setpiece'; })) return 'setpiece';
  if (tryB(() => g?.info?.quest)) return 'quest';
  return null;
}
const ease = () => (reason ? EASE : 1);
const footK = () => (reason ? FOOT : 1);

const css = `#mhChip{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(100px + env(safe-area-inset-top));display:none;padding:3px 10px;border-radius:10px;background:#000;color:#fff;border:1px solid #fff;font:700 12px/1.25 system-ui,sans-serif;pointer-events:none;white-space:nowrap}
body.surface #mhChip.show{display:block} body.duel #mhChip,body.indoors #mhChip{display:none!important}
#stackR > #mhChip{position:static;transform:none;align-self:flex-end;flex:none;max-width:100%;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis} /* v7.5.12 (playtest M1): in the HUD flow, never pinned over the tracker */
@media (max-width:640px){#mhChip{font-size:11px}}`;
function ui() {
  if (chip) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  chip = document.createElement('div'); chip.id = 'mhChip'; chip.textContent = '🎯 Mission: police easing off'; document.body.appendChild(chip);
}
function render() {
  const on = !!reason && ((world()?.wanted | 0) > 0);
  if (on && chip) { const st = document.getElementById('stackR'); if (st && chip.parentNode !== st) { const card = document.getElementById('hxCard'); st.insertBefore(chip, card && card.parentNode === st ? card.nextSibling : null); } } // v7.5.12: flow slot in the top-right stack
  if (on !== chipOn) { chipOn = on; chip?.classList.toggle('show', on); }
}
function tick(dt, tc) {
  onMars = tc?.name === 'Mars'; pollT -= dt; if (pollT > 0) return; pollT = 0.25;
  const r = detect();
  if (r !== reason) { const was = reason; reason = r; try { window.SSX?.emit?.('missionheat:' + (r ? 'on' : 'off'), { reason: r, was }); } catch (e) { /* no bus */ } }
  render();
}
const API = {
  EASE, FOOT, active: () => reason, ease, footK,
  debug: { force(r) { forced = r === undefined ? undefined : (r || null); pollT = 0; reason = detect(); render(); return reason; }, state: () => ({ reason, ease: ease(), footK: footK(), chip: chipOn, forced: forced === undefined ? 'auto' : forced }) }
};
(function boot() {
  if (!window.SSX || !window.__app || !window.SSX.registerSurfaceTick) { setTimeout(boot, 200); return; }
  if (window.SSX.missionHeat) return;
  window.SSX.missionHeat = API; window.SSX.policeEase = ease; ui();
  window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { console.warn('missionheat tick', e); } });
  setInterval(() => { const X = window.SSX; if (X && X.missionHeat !== API) { X.missionHeat = API; X.policeEase = ease; } // core may rebuild window.SSX
    if (!app()?.state?.onSurface) { onMars = false; if (reason && forced === undefined) reason = null; render(); } }, 1000);
})();
