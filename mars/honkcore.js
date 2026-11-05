// Pure logic for the Grin Reaper's brass bulb horn (mars/honk.js). No DOM, no WebAudio: tests/test-honk-unit.mjs runs it in node.
export const SKIN = 'grinreaper';
export const CORE = 'ar_horn';
export const ARS_ID = 'horn';
export const SAVE_KEY = 'ssx.honk.v1';
export const TAUNT_CD = 0.6; // s between taunts
export const SCARE = { swing: 10, taunt: 14, t: 2.5 }; // scare radius (m) for a bonk / a taunt, flee time (s)
// the honk: a reedy two-oscillator buzz through two formants, a squeeze pitch envelope (dips in, settles, sags at the end)
export function honkSpec(kind = 'swing', rnd = 0.5) {
  const f = 392 + (rnd - 0.5) * 30;
  const one = (t, k = 1) => ({ t, f: f * k, f0: f * k * 0.86, f1: f * k * 0.95, dur: 0.24, att: 0.018, detune: 7, form: [760, 1650], q: [2.4, 3.2], vol: 0.32, air: 0.05 });
  return kind === 'taunt' ? [one(0), one(0.27, 1.06)] : [one(0, kind === 'hit' ? 0.94 : 1)];
}
export function fresh() { return { v: 1, given: false, honks: 0 }; }
export function parse(str) { try { const o = JSON.parse(str); if (o && o.v === 1) return { ...fresh(), given: !!o.given, honks: Math.max(0, o.honks | 0) }; } catch (e) { /* */ } return fresh(); }
// what the honk button does now: 'none' (hidden) | 'taunt'
export function buttonMode({ worn, onFoot, mars, inside, down }) { return worn && onFoot && mars && !inside && !down ? 'taunt' : 'none'; }
// first time you wear the outfit: give the horn (if you don't have it) and put it in your hand once
export function onWear(st, { worn, owned }) { if (!worn || st.given) return { give: false, equip: false }; return { give: !owned, equip: true }; }
export function canTaunt(now, last) { return !(now - last < TAUNT_CD); }
