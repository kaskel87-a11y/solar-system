// v7.5.96 wearable effects. Pure numbers. The look lives on the skin (mars/skinscore.js, fx: id).
// mars/wearfx.js applies these while that skin is worn.
export const HOW = 'Buy at Threadbare or find one. ☰ → Wardrobe → Wear.';

// speed/jump are multipliers on the on-foot walk. hover is metres. coast is seconds you keep rolling.
// melee is a damage multiplier. jet, when set, replaces the shop jetpack while the suit is on.
export const FX = {
  raccoon: { speed: 1.28, jump: 1, hover: 0, coast: 0, melee: 1, line: 'You run faster in the raccoon suit.' },
  merc: { speed: 1.08, jump: 1, hover: 0, coast: 0, melee: 1.65, line: 'Punches hit harder in the crimson suit.' },
  superjet: { speed: 1, jump: 1, hover: 0, coast: 0, melee: 1, line: 'Hold Jump. This pack flies higher and longer than the shop jetpack.',
    jet: { fuel: 180, burn: 11, thrust: 14, maxUp: 12, ceil: 120, air: 8 } },
  skates: { speed: 1.7, jump: 1, hover: 0, coast: 0.7, melee: 1, line: 'The skates roll. Let go and you coast.' },
  dino: { speed: 1.05, jump: 1.2, hover: 0, coast: 0, melee: 1.4, line: 'The dino suit bites harder and jumps a little.' },
  banana: { speed: 1.12, jump: 1.55, hover: 0, coast: 0, melee: 1, line: 'The banana suit bounces. Jump goes higher.' },
  hover: { speed: 1.45, jump: 1.1, hover: 0.42, coast: 0.35, melee: 1, line: 'The board floats you off the ground.' },
  springs: { speed: 1, jump: 2.15, hover: 0, coast: 0, melee: 1, line: 'Spring boots launch you.' }
};

export const IDS = Object.keys(FX);
export const MOUTH = [
  'Worth it.', 'Ow. That was me.', 'Again.', 'Stay down.', 'Cute.', 'Next.'
];

export function fxOf(id) { return FX[id] || null; }
export function moveOf(id) {
  const f = FX[id]; if (!f) return { speed: 1, jump: 1, hover: 0, coast: 0 };
  return { speed: f.speed, jump: f.jump, hover: f.hover, coast: f.coast };
}
export function meleeOf(id) { return FX[id]?.melee || 1; }
export function jetOf(id) { return FX[id]?.jet || null; }

// shop jetpack (mars/jetpackcore.js) is the bar a super pack has to clear
export const SHOP_JET = { fuel: 100, burn: 20, thrust: 9.5, maxUp: 7, ceil: 60, air: 5 };
export function jetBeatsShop(j) {
  if (!j) return false;
  const hang = j.fuel / j.burn, shop = SHOP_JET.fuel / SHOP_JET.burn;
  return hang > shop && j.thrust > SHOP_JET.thrust && j.maxUp > SHOP_JET.maxUp && j.ceil > SHOP_JET.ceil;
}
