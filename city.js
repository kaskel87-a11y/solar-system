// v7.5 Mars city: Olympus Row (downtown), Red Tape Flats (rough), Helios Heights (gated) and the Ares Beltway,
// built from Steve's pack (citydata.js) through the public modding API. Everything here is additive: registerDistrict /
// registerHighway / registerMission. Swap geometry or materials for v8 with world.setMaterialSlot / registerAgentModel.
import { registerDistrict, registerHighway } from './world.js?v=7.5';
import { registerMission, storyToQuest } from './game.js?v=7.5';
import { DISTRICT_DATA, BELTWAY_DATA, CITY_MISSIONS } from './citydata.js?v=7.5';

export const CITY_WORLD = 'Mars';
const ORIGIN = { downtown: [0, -430], rough: [-280, -40], gated: [320, 80] };
// add-on lots kept clear (Pumpkin's dealership / garages / car meets)
const LOTS = {
  downtown: [{ id: 'olympus-meet', at: [40, 30], r: 9, use: 'car-meet' }],
  rough: [{ id: 'flats-dealer', at: [36, -34], r: 10, use: 'dealership' }],
  gated: [{ id: 'helios-garage', at: [34, 46], r: 8, use: 'garage' }]
};
const MANSIONS = { 'VOSS HOUSE': 'voss', 'SABLE ANNEX': 'sable', 'QUINN VILLA': 'quinn', 'KLINE RETREAT': 'kline' };
const clearOfVehicles = (f, vs) => { let [x, z] = f; for (const v of vs || []) if (Math.hypot(v[1] - x, v[2] - z) < 6) { const L = Math.hypot(x, z) || 1; x -= x / L * 8; z -= z / L * 8; } return [Math.round(x * 10) / 10, Math.round(z * 10) / 10]; };
export const SAFE_DIFFICULTY = { quinn: 2, kline: 3, sable: 3, voss: 4 };
const titleCase = s => s.replace(/\b([A-Z])([A-Z\u2019']+)/g, (m, a, b) => a + b.toLowerCase());
export const safeIdOf = sign => 'safe:' + titleCase(sign);

function districtDef(key) {
  const P = DISTRICT_DATA[key], sp = P.spawns || {}, pat = P.patrols || {};
  const footKey = Object.keys(pat).find(k => /foot/.test(k) && pat[k].route), foot = footKey ? pat[footKey] : null;
  const D = {
    name: P.name, kind: P.kind || key, key, alias: key, tint: P.tint, origin: ORIGIN[key], r1: 58, r2: 86, lampR: 52, lamps: P.lamps,
    domes: P.domes.map(d => MANSIONS[d[3]] ? [d[0], d[1], d[2], d[3], d[4], 'mansion', d[3]] : d),
    blocks: P.blocks.map(b => b[5] === 'RED SHIFT' ? [...b.slice(0, 7), 'cantina', 'RED SHIFT'] : b),
    pad: key === 'downtown' ? [-48, -6, 7] : P.pad, // the pack's downtown pad overlaps the precinct
    crates: P.crates, shop: P.shop, contacts: P.contacts, guards: P.guards, colonists: P.colonists, phoneColonists: Math.min(P.colonists, 3),
    vehicles: P.vehicles.map(v => key === 'downtown' && v[0] === 'shuttle' ? ['shuttle', -48, -6, 0.9] : v),
    inside: { ...P.inside, ...(key === 'downtown' ? { 'RED SHIFT': { barkeep: 'Red Shift barkeep' } } : {}),
      ...Object.fromEntries(Object.entries(MANSIONS).map(([sign, k]) => [sign, { away: true, difficulty: SAFE_DIFFICULTY[k] || 2, title: sign }])) }, // owners are out; that's the point
    spawns: sp, patrols: pat, lots: LOTS[key] || [],
    walk: sp.civ_spawn || sp.gang_spawn || undefined, patrol: foot?.route, guardStyle: key === 'gated' ? 'private' : key === 'rough' ? 'saltblood' : null,
    fastTravel: clearOfVehicles(sp.player_fast_travel || [0, 20], P.vehicles), /* never arrive inside the parked shuttle */ cams: key === 'rough' ? 0 : 55, cameras: []
  };
  // mansion camera grid: the pack's camera points pushed out to the dome's skin (they'd sit inside the glass)
  for (const [k, m] of Object.entries(sp.mansions || {})) {
    const dome = D.domes.find(d => MANSIONS[d[3]] === k); if (!dome) continue;
    for (const c of m.cameras || []) { const dx = c[0] - dome[0], dz = c[1] - dome[1], dl = Math.hypot(dx, dz) || 1; D.cameras.push([dome[0] + dx / dl * (dome[2] + 1.5), dome[1] + dz / dl * (dome[2] + 1.5)]); }
  }
  return D;
}
export const CITY_DISTRICTS = {};
for (const key of Object.keys(DISTRICT_DATA)) { const D = districtDef(key); const id = DISTRICT_DATA[key].id || 'mars-' + key; registerDistrict(CITY_WORLD, id, D); CITY_DISTRICTS[id] = D; }

// ---- Ares Beltway ----
const wp = Object.fromEntries(BELTWAY_DATA.waypoints.map(w => [w.id, w]));
const nextDistrict = i => { for (let k = i + 1; k < BELTWAY_DATA.waypoints.length; k++) if (BELTWAY_DATA.waypoints[k].kind === 'district') return BELTWAY_DATA.waypoints[k].at; return null; };
registerHighway(CITY_WORLD, {
  name: BELTWAY_DATA.name, polyline: BELTWAY_DATA.polyline, width: 10, waypoints: BELTWAY_DATA.waypoints,
  ramps: BELTWAY_DATA.waypoints.map((w, i) => w.ramp ? { id: w.id, at: w.at, to: nextDistrict(i) || w.at, len: 14, h: 1.6 } : null).filter(r => r && r.to !== r.at),
  checkpoints: BELTWAY_DATA.checkpoints.map(c => ({ ...c, name: c.id.replace(/^cp-/, '') + ' ' + (/colsec/i.test(c.faction) ? 'scan' : /saltblood/i.test(c.faction) ? 'toll' : 'gate') })),
  props: BELTWAY_DATA.props.filter(p => p.type === 'billboard').map(p => ({ type: 'billboard', at: p.at, yaw: Math.PI / 2, text: p.copy.split(/\s+\u2014\s+/)[0], copy: p.copy, neon: p.neon })),
  traffic: BELTWAY_DATA.traffic, chases: BELTWAY_DATA.chases
});

// ---- Steve's 16 missions, patched onto engine steps ----
// stand-in alien waves -> human hostiles; mansion "crack the safe" gotos -> crack steps (the heist module owns the minigame);
// "mark camera" gotos -> case steps; Rhee's offer -> a choice step; the two beltway chases get wanted / pursuers.
const HUMAN_WAVE = { 'vale-02-warrant': ['goon', 'goon'], 'nyx-01-bounce': ['thug', 'goon', 'thug'], 'marrow-02-message': ['guard', 'guard'],
  'vale-03-beltway': ['sbuggy', 'enforcer'], 'rhee-01-eviction': ['enforcer', 'guard', 'sdrone'] };
const MANSION_WAVE = ['guard', 'guard', 'sdrone'];
const clean = t => t.replace(/\s*\((stand-in[^)]*)\)/i, '').replace(/\s*\(stand-in wave\)/i, '');
export function patchMission(m) {
  const steps = [];
  m.steps.forEach((s, i) => {
    let o = { ...s, text: clean(s.text || '') };
    if (o.type === 'defeat') o.wave = HUMAN_WAVE[m.id] || (/^lita-/.test(m.id) ? MANSION_WAVE : o.wave.map(t => ({ crawler: 'goon', drone: 'sdrone', hunter: 'enforcer' }[t] || t)));
    const mm = /^Case (.+): mark camera ([AB])/.exec(o.text);
    if (mm && o.type === 'goto') o = { type: 'case', at: o.at, r: 4, text: `Case ${titleCase(mm[1])}: mark camera ${mm[2]}`, mansion: MANSIONS[mm[1]] };
    if (/^Crack the safe/.test(o.text) && /^lita-/.test(m.id)) { const b = m.steps.find(x => x.type === 'enter')?.building || ''; o = { type: 'crack', building: b, id: safeIdOf(b), difficulty: SAFE_DIFFICULTY[MANSIONS[b]] || 2, text: `Crack the ${titleCase(b)} safe`, loot: 0 }; }
    if (m.id === 'kline-01-ledger' && i === 1) o = { type: 'crack', building: 'FIRST JUNCTION TRUST', id: 'bank-vault', difficulty: 3, text: 'Crack the vault, lift Kline\u2019s slate', loot: 0 };
    if (m.id === 'vale-03-beltway' && o.type === 'race') o.wanted = 3;
    if (m.id === 'marrow-03-crate' && o.type === 'race') { o.pursuers = ['goon', 'goon', 'sbuggy']; o.wanted = 2; }
    if (['vale-01-patrol', 'nyx-01-bounce'].includes(m.id)) o.noCivilians = true;
    steps.push(o);
    if (m.id === 'rhee-01-eviction' && i === 0 && m.choice) steps.push({ type: 'choice', prompt: m.choice.prompt, text: m.choice.prompt,
      options: m.choice.options.map(c => c.id === 'take_retainer' ? { ...c, credits: 250, skip: 2, radio: 'Rhee: Smart. You\u2019re on the payroll. Don\u2019t make me audit you.' } : { ...c, wanted: 3, radio: 'Rhee: Noted. Invoice to follow. In lead.' }) });
  });
  return { ...m, steps };
}
export const CITY_MISSION_IDS = [];
for (const m of CITY_MISSIONS) { const q = storyToQuest(patchMission(m)); q.city = true; q.district = m.location; registerMission(q); CITY_MISSION_IDS.push(q.id); }
