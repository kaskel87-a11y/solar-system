// Reserved NPC slots runtime (logic: mars/npcslotscore.js). Ticked from mars/heisttip.js.
// API (all optional-chained by callers): SSX.npcSlots.reserve(id, n, { critical, active, keep }) / release(id) /
// releaseAll() / list() / floor() / grant(id, want, critical). Slots live in world.npcReserve, so world.npcBudget()
// counts them; critical ones also lower world.js's ambient floor (hook: SSX?.npcSlots?.floor?.()).
import { createSlots, setRes, floor, sweep, list, grant, criticalSum } from './npcslotscore.js';

const S = createSlots();
let W = null, pitWas = false, T = 0;
const sent = new Map(); // what world.npcReserve last got per key: only call it on a real change (each call re-toasts the zone)
const push = (key, n) => { if ((sent.get(key) || 0) === n) return; sent.set(key, n); if (!n) sent.delete(key); try { W?.npcReserve?.(key, n); } catch (e) {} };
export const npcSlots = {
  reserve(key, n, o = {}) { const k = setRes(S, key, n, o); push(key, k); return k; },
  release(key) { if (!S.res.has(key)) return 0; S.res.delete(key); push(key, 0); return 0; },
  releaseAll() { for (const k of [...S.res.keys()]) this.release(k); },
  grant(key, want, critical) { return grant(W?.npcBudget?.(), key, want, critical); },
  floor: () => floor(S), list: () => list(S), critical: () => criticalSum(S),
  budget: () => W?.npcBudget?.() || null, version: 1,
};
const attach = () => { const X = globalThis.SSX; if (X && X.npcSlots !== npcSlots) X.npcSlots = npcSlots; };
attach();

export function npcSlotsTick(dt, ctx) {
  attach(); // index.html rebuilds SSX: re-attach
  const w = ctx?.name === 'Mars' ? ctx.world : null;
  if (w !== W) { S.res.clear(); sent.clear(); W = w; pitWas = false; } // new landing / left Mars: the old world's slots went with it
  if (!W) return;
  // Pit fighters: one critical slot for the opponent while a bout or a best-of-3 series is on
  const pit = !!(W.inDuel || globalThis.__activities?.pit);
  if (pit && !pitWas && !S.res.get('pitFighter')?.critical) npcSlots.reserve('pitFighter', 1, { critical: true, active: () => !!(W?.inDuel || globalThis.__activities?.pit) });
  pitWas = pit;
  T += dt || 0;
  for (const c of sweep(S, T)) push(c.key, c.n); // mission over, failed or quit: let the slot go
}
if (typeof window !== 'undefined') window.__npcSlots = { get list() { return list(S); }, get floor() { return floor(S); }, api: npcSlots };
