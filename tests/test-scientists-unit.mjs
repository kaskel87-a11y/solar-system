// Unit tests for the junkyard-lab pack's pure logic. node tests/test-scientists-unit.mjs
import { LAB_BLOCK, PORTAL_AT, JUNK_AT, RACCOON_PARK, SCI_IDS, portalTrigger, hazardPos, makeRun, stepRun, stepLabel, inRoom, inCol } from '../scicore.js';
import { RACCOON_ID, RACCOON_SPEC, RACCOON_SHOP } from '../raccoon.js';
import { sciMissions, BARKS, DUO, SILAS, TAM } from '../scientists.js';
import { DIMENSIONS } from '../dimensions/index.js';
let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } };

// portal trigger: edge, re-arms only after you walk away
{ const s = { armed: true }; t('enters', portalTrigger(s, 1.0)); t('no bounce', !portalTrigger(s, 1.0)); t('still no', !portalTrigger(s, 2.5)); portalTrigger(s, 4); t('re-armed', portalTrigger(s, 1.2)); }
{ const s = { armed: true }; t('far no', !portalTrigger(s, 10)); t('edge 1.6 no', !portalTrigger(s, 1.6)); }
// hazards
{ const h = { axis: 'x', at: 4, c: 0, amp: 5, speed: 1 }; const p = hazardPos(h, Math.PI / 2); t('lane x', Math.abs(p.x - 5) < 1e-9 && p.z === 4 && p.on); }
{ const h = { axis: 'z', at: 2, c: 1, amp: 3, speed: 2, phase: 0 }; const p = hazardPos(h, 0); t('lane z', p.x === 2 && p.z === 1); }
{ const g = { kind: 'geyser', x: 1, z: 2, period: 3, on: 1 }; t('geyser on', hazardPos(g, 0.5).on); t('geyser off', !hazardPos(g, 2).on); t('geyser wraps', hazardPos(g, 3.2).on); t('geyser k', Math.abs(hazardPos(g, 1.5).k - 0.5) < 1e-9); }
// runs
{
  const def = { id: 'x', picks: [{ x: 0, z: 0 }, { x: 5, z: 0 }], hazards: [{ axis: 'x', at: 10, c: 0, amp: 0, speed: 0, r: 1, dmg: 7 }] };
  const r = makeRun(def); let ev = stepRun(r, def, 0, 0, 0.1);
  t('pick 1', ev.some(e => e.type === 'pick' && e.got === 1)); t('label', stepLabel('Grab', r) === 'Grab (1/2)');
  ev = stepRun(r, def, 0, 0, 0.1); t('no double pick', !ev.length);
  ev = stepRun(r, def, 5, 0, 0.1); t('done', ev.some(e => e.type === 'done') && r.done); t('label done', stepLabel('Grab', r) === 'Grab');
  ev = stepRun(r, def, 5, 0, 0.1); t('done once', !ev.some(e => e.type === 'done'));
  ev = stepRun(r, def, 0.3, 10, 0.1); t('hurt', ev.some(e => e.type === 'hurt' && e.dmg === 7 && e.push[0] > 0));
  ev = stepRun(r, def, 0.3, 10, 0.1); t('hurt cooldown', !ev.some(e => e.type === 'hurt'));
  ev = stepRun(r, def, 0.3, 10, 1.3); t('hurt again after cooldown', ev.some(e => e.type === 'hurt'));
}
{
  const def = { id: 'o', order: true, picks: [{ x: 0, z: 0 }, { x: 5, z: 0 }], hazards: [] }, r = makeRun(def);
  let ev = stepRun(r, def, 5, 0, 0.1); t('order: wrong', ev.some(e => e.type === 'wrong' && e.want === 0) && r.got === 0);
  ev = stepRun(r, def, 5, 0, 0.1); t('order: wrong throttled', !ev.length);
  stepRun(r, def, 0, 0, 0.1); ev = stepRun(r, def, 5, 0, 0.1); t('order: in order', r.done);
}
{ const def = { id: 'i', picks: [{ x: 0, z: 0 }], hazards: [{ axis: 'x', at: 0, c: 0, amp: 0, speed: 0, r: 2, dmg: 5 }] }, r = makeRun(def, true); t('inert run does nothing', !stepRun(r, def, 0, 0, 0.1).length); }
// dimensions: every pick and hazard lane inside the room, picks reachable (not inside a collider), budget-friendly
for (const [id, d] of Object.entries(DIMENSIONS)) {
  t(id + ' id', d.id === id && d.name && d.intro && d.done && typeof d.build === 'function');
  t(id + ' picks', d.picks.length >= 1 && d.picks.every(p => inRoom(d, p.x, p.z) && !inCol(d, p.x, p.z)));
  t(id + ' hazards in room', d.hazards.every(h => h.kind === 'geyser' ? inRoom(d, h.x, h.z) : (h.axis === 'z' ? inRoom(d, h.at, (h.c || 0) + h.amp) && inRoom(d, h.at, (h.c || 0) - h.amp) : inRoom(d, (h.c || 0) + h.amp, h.at, 0.3) && inRoom(d, (h.c || 0) - h.amp, h.at, 0.3))));
  t(id + ' spawn clear', !inCol(d, 0, d.d / 2 - 2.3) && !d.picks.some(p => Math.hypot(p.x, p.z - (d.d / 2 - 2.3)) < 2));
  t(id + ' size', d.w <= 24 && d.d <= 24 && d.h <= 10);
  // each pick is clear of every hazard at some moment (no permanently blocked objective)
  t(id + ' picks free', d.picks.every(p => { for (let k = 0; k < 200; k++) { const tt = k * 0.05; if (d.hazards.every(h => { const q = hazardPos(h, tt); return !q.on || Math.hypot(q.x - p.x, q.z - p.z) > h.r; })) return true; } return false; }));
}
// missions: 5-step chain, valid step types, portal dims exist, contacts are the duo, requires chain in order
{
  const M = sciMissions(), types = ['goto', 'collect', 'defeat', 'return', 'take', 'clean', 'race', 'enter', 'portal'];
  t('5 missions', M.length === 5 && M.map(m => m.id).join() === SCI_IDS.join());
  t('world Mars', M.every(m => m.world === 'Mars' && m.title && m.intro && m.reward.xp > 0 && m.reward.credits > 0));
  t('contacts', M.every(m => m.contact === SILAS || m.contact === TAM) && M.some(m => m.contact === TAM));
  t('chain', M.every((m, i) => i === 0 ? !m.requires : m.requires?.[0] === M[i - 1].id));
  t('step types', M.every(m => m.steps.every(s => types.includes(s.type) && s.text)));
  t('portal dims', M.every(m => m.steps.some(s => s.type === 'portal') && m.steps.filter(s => s.type === 'portal').every(s => DIMENSIONS[s.dim] && String(s.at) === String(PORTAL_AT))));
  t('all dims used', new Set(M.flatMap(m => m.steps.filter(s => s.type === 'portal').map(s => s.dim))).size === Object.keys(DIMENSIONS).length);
  t('ends in the lab', M.every(m => m.steps.at(-1).type === 'enter' && m.steps.at(-1).building === 'junkyard lab'));
  t('getaway', M.find(m => m.id === 'sci-05').steps.some(s => s.type === 'clean' && s.wanted === 2 && s.getaway));
}
// placement: clear of Steve's mars-city coordinates and the existing Ares Junction blocks, inside the flat zone
{
  const beltway = [[0, -55], [-30, -50], [0, -220], [0, -390], [0, -430], [60, -430], [180, -200], [280, 40], [320, 80], [120, 160], [80, 40], [0, 60], [-140, 20], [-240, -20], [-280, -40], [-200, -120], [-80, -160], [0, -55]];
  const segD = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, k = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)) : 0; return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dz); };
  const roadD = p => Math.min(...beltway.slice(1).map((b, i) => segD(p, beltway[i], b)));
  const marks = [[-4, -40], [-4, -52], [-60, -4], [167, 1], [0, 200], [0, -430], [-280, -40], [320, 80]];
  const blocks = [[0, 0, 28, 28], [31, -17, 9, 5], [-6, 23, 8, 5], [-44, -14, 6, 4], [16, -38, 7, 5], [-30, -36, 12, 7], [6, -28, 8, 5], [-22, -16, 16, 16], [24, 6, 18, 18]];
  const [lx, lz, lw, ld] = LAB_BLOCK;
  for (const p of [[lx, lz], PORTAL_AT, ...JUNK_AT]) { t('off the beltway ' + p, roadD(p) > 12); t('clear of landmarks ' + p, marks.every(m => Math.hypot(m[0] - p[0], m[1] - p[1]) > 15)); t('flat zone ' + p, Math.hypot(p[0], p[1]) < 62); }
  t('no block overlap', blocks.every(([x, z, w, d]) => Math.abs(x - lx) > (w + lw) / 2 + 2 || Math.abs(z - lz) > (d + ld) / 2 + 2));
  t('lab kind', LAB_BLOCK[7] === 'scilab' && /JUNKYARD LAB/.test(LAB_BLOCK[5]));
  t('contacts clear', [[36, -26], [8, 24]].every(c => Math.hypot(c[0] - PORTAL_AT[0], c[1] - PORTAL_AT[1]) > 6 && Math.hypot(c[0] - lx, c[1] - lz) > 6));
  t('raccoon park clear of pad', Math.hypot(RACCOON_PARK[0] + 38, RACCOON_PARK[1] - 10) > 11);
}
// Raccoon Mobile: listable spec for the dealership, scrappy handling vs the stock buggy
t('raccoon id', RACCOON_ID === 'raccoon_mobile' && RACCOON_SHOP.id === RACCOON_ID && RACCOON_SHOP.venue === 'depot' && RACCOON_SHOP.price === RACCOON_SPEC.price);
t('raccoon spec', RACCOON_SPEC.price === 900 && RACCOON_SPEC.turn > 1.75 && RACCOON_SPEC.acc > 12 && RACCOON_SPEC.vmax < 22 && RACCOON_SPEC.name === 'Raccoon Mobile');
// originality guard: nothing lifted from a certain cartoon
{
  const txt = JSON.stringify([sciMissions(), BARKS, DUO]).toLowerCase();
  t('original', !/wubba|lubba|rick|morty|plumbus|schwifty|squanch|meeseeks|citadel|szechuan|pickle/.test(txt));
  t('no green portal', Object.values(DIMENSIONS).every(d => d.trim !== 0x39ff14));
  t('duo looks', DUO[SILAS].look.hairStyle === 'bald' && DUO[TAM].look.top !== 0xffd400 && DUO[TAM].look.top !== 0xffff00);
}
console.log(`scientists unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
