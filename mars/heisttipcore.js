// First real heist (pure data + unlock logic; runtime in mars/heisttip.js).
// After NEED city missions, an informant texts you about Halvorsen Villa and ☰ Heists appears.
import { villaDef } from './villacore.js';
export const KEY = 'ssx.heist.unlock', VERSION = 1, NEED = 3;
export const INFORMANT = 'Sable';
export const TIP_TEXT = 'Sable: ◆ Word gets around. Halvorsen Villa, Helios Heights. Owner is off-world all week: one wall safe, three cameras, a power box out back. ➤ ☰ Heists when you\'re ready.';

// Halvorsen Villa's own layout (walls, doors, rooms, vault, guards, cameras) lives in villacore.js
export function villaAt(x, z) { return villaDef([x, z]); }
export const VILLA_AT = [370, 85]; // Helios Heights, 50 m east of the hub; open and flat (probed in WebKit, rechecked by tests/test-depth.js)
export const VILLA = villaAt(...VILLA_AT);

export const fresh = () => ({ v: VERSION, unlocked: false, tipped: false, at: 0 });
// tolerant load + migration: missing / garbage -> fresh; legacy 'true'/'1' or { unlocked } without v -> v1
export function loadState(raw) {
  if (raw == null || raw === '') return fresh();
  if (raw === 'true' || raw === '1') return { ...fresh(), unlocked: true, tipped: true };
  let o; try { o = JSON.parse(raw); } catch { return fresh(); }
  if (o === true || o === 1) return { ...fresh(), unlocked: true, tipped: true };
  if (!o || typeof o !== 'object' || Array.isArray(o)) return fresh();
  return { v: VERSION, unlocked: !!(o.unlocked || o.tipped), tipped: !!o.tipped, at: Number.isFinite(o.at) ? o.at : 0 };
}
export const cityDone = (quests, ids) => ids.reduce((n, id) => n + (quests?.[id]?.everDone || quests?.[id]?.status === 'done' ? 1 : 0), 0);
// what to do this check: unlock when NEED city missions are done (also catches returning players), text once
export function decide(st, done) {
  const unlock = !st.unlocked && done >= NEED;
  return { unlock, tip: (st.unlocked || unlock) && !st.tipped };
}
