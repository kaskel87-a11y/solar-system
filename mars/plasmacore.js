// v7.5.98 Plasma Blade. An original grip and a glowing edge. Not a film weapon.
export const ID = 'plasmablade';
export const NAME = 'Plasma Blade';
export const PRICE = 480;
export const COLORS = [
  { id: 'cyan', name: 'Cyan', hex: 0x3ef0ff },
  { id: 'amber', name: 'Amber', hex: 0xffb020 },
  { id: 'violet', name: 'Violet', hex: 0xc084fc }
];
export const BY = Object.fromEntries(COLORS.map(c => [c.id, c]));
export const HOW = 'Buy it at Ozzie\'s Iron, then ☰ → Plasma Blade to pick a colour. Swing with FIRE.';
export function colorOf(id) { return BY[id] || COLORS[0]; }
// swing damage for the three-hit combo, before a worn suit's multiplier
export const HITS = [4, 5, 8];
export const REACH = 3.6;
