// Runtime for the first real heist (logic + data: mars/heisttipcore.js). Ticked from activities/runner.js.
import { heist } from '../heist.js';
import { CITY_MISSIONS } from '../citydata.js';
import { villaTick } from './villa.js';
import { npcSlotsTick } from './npcslots.js';
import { barContactTick, barContactNear } from './barcontact.js';
import { KEY, VILLA, INFORMANT, TIP_TEXT, loadState, cityDone, decide } from './heisttipcore.js';

const IDS = CITY_MISSIONS.map(m => m.id);
let st = null, reg = false, tT = 0;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

let vWarn = false, lastCtx = null;
export function heistTipTick(dt, ctx) {
  lastCtx = ctx;
  if (reg) { try { villaTick(dt, ctx); } catch (e) { if (!vWarn) { vWarn = true; console.warn('[villa]', e); } } }
  try { npcSlotsTick(dt, ctx); barContactTick(dt, ctx, TIP_API); } catch (e) { if (!vWarn) { vWarn = true; console.warn('[npc slots / bar contact]', e); } }
  tT -= dt; if (tT > 0) return; tT = 1;
  check(ctx); if (!ctx?.game?.progress) return; // check() writes the migrated v1 shape back
  const d = { tip: st.unlocked && !st.tipped };
  // the text waits for a calm moment: on Mars, no duel, no heist running, not at Juno's door, not mid-transition
  if (d.tip && reg && ctx.name === 'Mars' && !ctx.world?.inDuel && !heist.active && !barContactNear() && (window.SSX?.city?.radio || window.__app?.radio)) {
    (window.SSX?.city?.radio || window.__app.radio)(TIP_TEXT.replace(/^[A-Z][\w .]{0,20}:\s*/, ''), INFORMANT); st.tipped = true; save();
  }
}
// the bar contact (mars/barcontact.js): same unlock check as the text, marks the tip as given so the text never doubles
function check(ctx) {
  if (!st) { st = loadState(read()); save(); }
  const P = ctx?.game?.progress; if (P) { const d = decide(st, cityDone(P.quests, IDS)); if (d.unlock) { st.unlocked = true; st.at = Date.now(); save(); } }
  if (st.unlocked && !reg) { try { if (!heist.heists().some(h => h.id === VILLA.id)) heist.registerHeist(VILLA); reg = true; } catch (e) { console.warn('[heist tip]', e); } }
}
const TIP_API = {
  state: () => st && { unlocked: st.unlocked, tipped: st.tipped },
  give() { check(lastCtx); if (!st?.unlocked) return { ok: false }; const already = st.tipped; if (!already) { st.tipped = true; save(); } return { ok: true, already, registered: reg }; },
};
export const tipState = () => st && { ...st, registered: reg };
