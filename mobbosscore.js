// Mob Boss respect (v7.5.88, folded into the cop-kill work). Pure rules.
// Cop kills, jacked cars and finished heists add Respect. Tiers unlock a real perk.
// None of the faction-rep, crew-star or Velvet-ownership tracks are "you are the boss", so this is its own ladder.

export const KEY = 'ssx.mobboss.v1';
export const TIERS = Object.freeze([
  { id: 'thug', name: 'Street Thug', hud: 'Thug', at: 0, blurb: 'Nobody. Kill ColSec, jack a car, or finish a heist.' },
  { id: 'enforcer', name: 'Enforcer', hud: 'Enforcer', at: 8, blurb: 'Crew level-ups cost 15% less.' },
  { id: 'capo', name: 'Capo', hud: 'Capo', at: 20, blurb: 'Crew jobs pay 10% more.' },
  { id: 'underboss', name: 'Underboss', hud: 'Underboss', at: 40, blurb: 'ColSec hesitates: every other cop you kill does not raise wanted.' },
  { id: 'boss', name: 'Boss of Mars', hud: 'Boss', at: 70, blurb: 'Turf blocks pay 15% more.' }
]);
// Respect per action. Cop kinds match copbounty tiers.
export const GAIN = Object.freeze({
  drone: 2, cruiser: 2, buggy: 2, guard: 2,
  officer: 4, heavy: 6, rover: 6, gunship: 8, swat: 8,
  car: 3, heist: 12
});
export const gainFor = kind => GAIN[kind] || 0;
export function tierAt(respect) {
  let cur = TIERS[0];
  for (const t of TIERS) if ((respect | 0) >= t.at) cur = t;
  return cur;
}
export function nextAt(respect) {
  return TIERS.find(t => t.at > (respect | 0)) || null;
}
const rank = id => TIERS.findIndex(t => t.id === id);
export const levelOff = id => rank(id) >= 1 ? 0.15 : 0;
export const crewCut = id => rank(id) >= 2 ? 0.10 : 0;
export const canHesitate = id => rank(id) >= 3;
export const turfCut = id => rank(id) >= 4 ? 0.15 : 0;
export function fresh() { return { v: 1, respect: 0, copKills: 0 }; }
export function load(raw) {
  let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || o.v !== 1) return fresh();
  return { v: 1, respect: Math.max(0, o.respect | 0), copKills: Math.max(0, o.copKills | 0) };
}
// Add respect. Returns the new state snapshot and whether the tier changed.
export function grant(s, kind) {
  const n = gainFor(kind); if (!n) return { ...view(s), added: 0, up: false };
  const before = tierAt(s.respect).id;
  s.respect += n;
  const after = tierAt(s.respect);
  return { ...view(s), added: n, up: after.id !== before, from: before };
}
// Underboss+: odd cop kills still raise wanted, even ones do not.
export function raiseHeat(s) {
  if (!canHesitate(tierAt(s.respect).id)) return true;
  s.copKills++;
  return s.copKills % 2 === 1;
}
export function view(s) {
  const tier = tierAt(s.respect), next = nextAt(s.respect);
  const span = next ? next.at - tier.at : 1;
  const into = next ? s.respect - tier.at : span;
  return {
    respect: s.respect, tier: tier.id, name: tier.name, hud: tier.hud, blurb: tier.blurb,
    next: next ? next.name : null, nextAt: next ? next.at : null, left: next ? next.at - s.respect : 0,
    pct: next ? Math.max(0, Math.min(1, into / span)) : 1,
    levelOff: levelOff(tier.id), crewCut: crewCut(tier.id), hesitate: canHesitate(tier.id), turfCut: turfCut(tier.id)
  };
}
