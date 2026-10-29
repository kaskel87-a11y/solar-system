// First real heist (pure data + unlock logic; runtime in mars/heisttip.js).
// After NEED city missions, an informant texts you about Halvorsen Villa and ☰ Heists appears.
export const KEY = 'ssx.heist.unlock', VERSION = 1, NEED = 3;
export const INFORMANT = 'Sable';
export const TIP_TEXT = 'Sable: ◆ Word gets around. Halvorsen Villa, Helios Heights. Owner is off-world all week: one wall safe, three cameras, a power box out back. ➤ ☰ Heists when you\'re ready.';

// villa layout reuses the heist sample's shape (walls, safe, power box, 3 cameras), placed on open ground (colony-relative AJ metres)
export function villaAt(x, z) {
  return {
    id: 'heist-halvorsen-villa', title: 'Halvorsen Villa', world: 'Mars', rel: 'colony', sample: true, payout: true,
    site: { x, z, r: 12 }, door: { x, z: z + 7 }, safe: { x, z: z - 4, tier: 'medium', time: 45 }, power: { x: x - 8, z: z + 8, s: 45 },
    cameras: [
      { id: 'hv-cam0', x: x - 6, z: z - 6, yaw: Math.PI * 0.25, range: 12, sweep: 30, label: 'the villa camera' },
      { id: 'hv-cam1', x: x + 6, z: z - 6, yaw: -Math.PI * 0.25, range: 12, sweep: 30, phase: 1.3, label: 'the villa camera' },
      { id: 'hv-cam2', x: x + 6, z: z + 6, yaw: -Math.PI * 0.75, range: 10, sweep: 25, phase: 2.1, label: 'the porch camera' }],
    alarm: { wanted: 2, responseS: 18 }, loot: { credits: 400, item: 'contraband' },
  };
}
export const VILLA_AT = [380, 150]; // Helios Heights, east of the gate; open, flat (checked in tests/test-depth.js)
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
