// Runtime for the first real heist (logic + data: mars/heisttipcore.js). Ticked from activities/runner.js.
import { heist } from '../heist.js';
import { CITY_MISSIONS } from '../citydata.js';
import { KEY, VILLA, INFORMANT, TIP_TEXT, loadState, cityDone, decide } from './heisttipcore.js';

const IDS = CITY_MISSIONS.map(m => m.id);
let st = null, reg = false, tT = 0;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

export function heistTipTick(dt, ctx) {
  tT -= dt; if (tT > 0) return; tT = 1;
  if (!st) { st = loadState(read()); save(); } // writes the migrated v1 shape back
  const P = ctx?.game?.progress; if (!P) return;
  const d = decide(st, cityDone(P.quests, IDS));
  if (d.unlock) { st.unlocked = true; st.at = Date.now(); save(); }
  if (st.unlocked && !reg) { try { if (!heist.heists().some(h => h.id === VILLA.id)) heist.registerHeist(VILLA); reg = true; } catch (e) { console.warn('[heist tip]', e); } }
  // the text waits for a calm moment: on Mars, no duel, no heist running, not mid-transition
  if (d.tip && reg && ctx.name === 'Mars' && !ctx.world?.inDuel && !heist.active && window.__app?.radio) {
    window.__app.radio(TIP_TEXT, INFORMANT); st.tipped = true; save();
  }
}
export const tipState = () => st && { ...st, registered: reg };
