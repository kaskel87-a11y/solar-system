// mars/cropscapecore.js: which growth stage a crop mesh shows. Pure. Timers, yields and saves stay in farmcore / farm2core.
// growth is 0..1 from those modules. 1 is ripe (harvest is allowed). Visual stages only.
export const STAGE_NAMES = ['seedling', 'leafy', 'mature', 'ready'];
// homestead crops plus the gulch crops. kind picks the mesh, not the timer.
export const KINDS = {
  potato: 'bush', algae: 'mat', glowberry: 'vine', lichen: 'shroom',
  redstatic: 'moss', glowcactus: 'cactus', voidpoppy: 'flower', ghostspore: 'shroom'
};
export function stageOf(g) {
  const x = +g || 0;
  if (x >= 1) return 3;
  if (x >= 0.55) return 2;
  if (x >= 0.25) return 1;
  return 0;
}
export function stageName(g) { return STAGE_NAMES[stageOf(g)]; }
// how many plants fit the part of the bed the sickle has not cut (left is 0..1, north end goes first)
export function plantCount(left, kind = 'bush') {
  const L = Math.max(0, Math.min(1, +left || 0));
  if (L <= 0) return 0;
  return Math.max(1, Math.round((kind === 'mat' ? 5 : 8) * L));
}
// soil bed in the rack's local frame: same span the old crop box used, so a cut rack shortens from the north
export function bedSpan(left) {
  const L = Math.max(0, Math.min(1, +left || 0));
  return { z: 1.55 * (1 - L), depth: 3.1 * L };
}
