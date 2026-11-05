// Unit tests for the junkyard-lab pack part 2 (sci-06..10). node tests/test-scientists2-unit.mjs
import { PORTAL_AT, JUNK_AT, hazardPos, makeRun, inRoom, inCol } from '../scicore.js';
import { SCI2_IDS, stepRun2, hazardAt, moveStalkers, clockLabel, raccoonArrived, rdriveHint, riftDrive, RIFT_TUNE } from '../sci2core.js';
import { sci2Missions, BARKS2, CAST, DIM_HOSTS, RIFT_SPOTS, barkCat } from '../scientists2.js';
import { sciMissions, BARKS, SILAS, TAM } from '../scientists.js';
import { DIMENSIONS } from '../dimensions/index.js';
import { DIMENSIONS2 } from '../dimensions/index2.js';
let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } };

// stalkers: walk toward you at their speed, stay in the room, hurt on contact with a cooldown
{
  const def = { id: 's', w: 10, d: 10, picks: [{ x: 4, z: 4 }], hazards: [{ kind: 'stalker', x: 0, z: -4, speed: 2, r: 1, dmg: 5, line: 'boo' }] };
  const r = makeRun(def);
  t('stalker starts at spawn', hazardAt(def.hazards[0], r, 0).z === -4);
  stepRun2(r, def, 0, 4, 1); const p = hazardAt(def.hazards[0], r, 0); t('stalker closes in by speed*dt', Math.abs(p.z - -2) < 1e-9 && p.x === 0);
  let hurt = null; for (let k = 0; k < 30 && !hurt; k++) hurt = stepRun2(r, def, 0, 4, 0.1).find(e => e.type === 'hurt');
  t('stalker hurts on contact', hurt && hurt.dmg === 5 && hurt.line === 'boo' && hurt.push[1] > 0);
  t('stalker hurt cooldown', !stepRun2(r, def, 0, 4, 0.1).some(e => e.type === 'hurt'));
  const r2 = makeRun(def); moveStalkers(r2, def, 50, 50, 100); const q = hazardAt(def.hazards[0], r2, 0); t('stalker stays in room', inRoom(def, q.x, q.z, 0.5));
  const r3 = makeRun(def, true); t('inert run: no stalker damage', !stepRun2(r3, def, 0, -4, 0.1).length);
  t('lanes still via hazardPos', JSON.stringify(hazardAt({ axis: 'x', at: 1, c: 0, amp: 2, speed: 1 }, { t: 0 }, 0)) === JSON.stringify(hazardPos({ axis: 'x', at: 1, c: 0, amp: 2, speed: 1 }, 0)));
}
// collapse timer (the Gut): clock events, then one collapse, none once done
{
  const def = { id: 'g', w: 10, d: 10, limit: 12, picks: [{ x: 4, z: 4 }], hazards: [] }, r = makeRun(def);
  const ev = []; for (let k = 0; k < 130; k++) ev.push(...stepRun2(r, def, -4, -4, 0.1));
  t('clock ticks', ev.some(e => e.type === 'clock' && e.left === 10) && ev.some(e => e.type === 'clock' && e.left <= 5));
  t('collapse once', ev.filter(e => e.type === 'collapse').length === 1 && r.collapsed);
  t('clock label', clockLabel('Nail', { t: 2.2, done: false }, def) === 'Nail · 10s' && clockLabel('Nail', { t: 2, done: true }, def) === 'Nail' && clockLabel('X', { t: 0 }, {}) === 'X');
  const r2 = makeRun(def); stepRun2(r2, def, 4, 4, 0.1); const ev2 = []; for (let k = 0; k < 150; k++) ev2.push(...stepRun2(r2, def, 4, 4, 0.1)); t('no collapse after done', r2.done && !ev2.some(e => e.type === 'collapse'));
}
// Raccoon Mobile steps + rift drive
{
  const s = { type: 'rdrive', r: 6 };
  t('rdrive in raccoon', raccoonArrived(s, 'raccoon_mobile', 7)); t('rdrive too far', !raccoonArrived(s, 'raccoon_mobile', 9));
  t('rdrive wrong car', !raccoonArrived(s, 'buggy', 1)); t('rdrive on foot', !raccoonArrived(s, null, 1)); t('rdrive only for rdrive', !raccoonArrived({ type: 'goto' }, 'raccoon_mobile', 0));
  t('hint on foot', /Raccoon/.test(rdriveHint(s, null, 3))); t('hint wrong car', /Wrong ride/.test(rdriveHint(s, 'hauler', 3))); t('no hint in raccoon', rdriveHint(s, 'raccoon_mobile', 3) === null); t('no hint far', rdriveHint(s, null, 40) === null);
  const p = { type: 'portal', raccoon: 'only' };
  t('rift: raccoon only portal', riftDrive(p, 'raccoon_mobile', 1, false)); t('rift: not other cars', !riftDrive(p, 'buggy', 1, true));
  t('rift: plain portal needs sci-09', !riftDrive({ type: 'portal' }, 'raccoon_mobile', 1, false) && riftDrive({ type: 'portal' }, 'raccoon_mobile', 1, true));
  t('rift: range', !riftDrive(p, 'raccoon_mobile', 3, true)); t('rift tune', RIFT_TUNE.vmax > 0 && RIFT_TUNE.vmax <= 4);
}
// dimensions 6..10: in the room, reachable, spawn clear, budget, picks free of lane hazards at some moment
for (const [id, d] of Object.entries(DIMENSIONS2)) {
  t(id + ' id', d.id === id && d.name && d.intro && d.done && typeof d.build === 'function' && !DIMENSIONS[id]);
  t(id + ' picks', d.picks.length >= 3 && d.picks.every(p => inRoom(d, p.x, p.z) && !inCol(d, p.x, p.z)));
  t(id + ' hazards in room', d.hazards.every(h => h.kind === 'geyser' || h.kind === 'stalker' ? inRoom(d, h.x, h.z) : (h.axis === 'z' ? inRoom(d, h.at, (h.c || 0) + h.amp) && inRoom(d, h.at, (h.c || 0) - h.amp) : inRoom(d, (h.c || 0) + h.amp, h.at, 0.3) && inRoom(d, (h.c || 0) - h.amp, h.at, 0.3))));
  t(id + ' spawn clear', !inCol(d, 0, d.d / 2 - 2.3) && !d.picks.some(p => Math.hypot(p.x, p.z - (d.d / 2 - 2.3)) < 2));
  t(id + ' stalker starts far from spawn', d.hazards.filter(h => h.kind === 'stalker').every(h => Math.hypot(h.x, h.z - (d.d / 2 - 2.3)) > 8 && h.speed < 2.5));
  t(id + ' size', d.w <= 24 && d.d <= 24 && d.h <= 10);
  t(id + ' host', !!DIM_HOSTS[id] && d.host === DIM_HOSTS[id] && Array.isArray(BARKS2[barkCat(d.host, 'dim')]));
  t(id + ' picks free', d.picks.every(p => { for (let k = 0; k < 200; k++) { const tt = k * 0.05; if (d.hazards.every(h => h.kind === 'stalker' || (q => !q.on || Math.hypot(q.x - p.x, q.z - p.z) > h.r)(hazardPos(h, tt)))) return true; } return false; }));
  t(id + ' geysers placeable', d.hazards.every(h => h.kind !== 'geyser' || typeof d.place === 'function'));
}
t('new dimension variants', Object.values(DIMENSIONS2).some(d => d.hazards.some(h => h.kind === 'stalker')) && Object.values(DIMENSIONS2).some(d => d.limit > 0) && Object.values(DIMENSIONS2).some(d => d.order));
// the gut is winnable: a straight-line pick route fits in the limit at walking pace (~4 m/s) with room to spare
{ const g = DIMENSIONS2.gut; let x = 0, z = g.d / 2 - 2.3, L = 0; for (const p of g.picks) { L += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; } t('gut route fits', L / 4 < g.limit * 0.5); }
// missions
{
  const M = sci2Missions(), all = [...sciMissions(), ...M], types = ['goto', 'defeat', 'clean', 'enter', 'portal', 'rdrive'];
  t('5 missions', M.length === 5 && M.map(m => m.id).join() === SCI2_IDS.join());
  t('chain from sci-05', M.every((m, i) => m.requires?.[0] === (i === 0 ? 'sci-05' : M[i - 1].id)));
  t('unique ids', new Set(all.map(m => m.id)).size === 10);
  t('world Mars', M.every(m => m.world === 'Mars' && m.fiction && m.title && m.intro && m.success && m.reward.xp > 0 && m.reward.credits > 0));
  t('rewards grow', M.every((m, i) => i === 0 || m.reward.credits >= M[i - 1].reward.credits) && M[0].reward.credits > sciMissions()[4].reward.credits);
  t('finale', M[4].finale && M[4].reward.badge && M[4].steps.some(s => s.type === 'clean' && s.wanted === 3 && s.getaway));
  t('contacts', M.every(m => m.contact === SILAS || m.contact === TAM) && M.filter(m => m.contact === TAM).length >= 2);
  t('step types', M.every(m => m.steps.every(s => types.includes(s.type) && s.text)));
  t('portal dims', M.every(m => m.steps.filter(s => s.type === 'portal').length === 1 && m.steps.filter(s => s.type === 'portal').every(s => DIMENSIONS2[s.dim] && String(s.at) === String(PORTAL_AT))));
  t('every new dim used once', M.map(m => m.steps.find(s => s.type === 'portal').dim).sort().join() === Object.keys(DIMENSIONS2).sort().join());
  t('raccoon in 4+ jobs', M.filter(m => m.steps.some(s => s.type === 'rdrive' || s.raccoon)).length >= 4);
  t('rift drive from sci-09', M.find(m => m.id === 'sci-09').steps.some(s => s.raccoon === 'only') && M.find(m => m.id === 'sci-10').steps.some(s => s.raccoon === 'only'));
  t('rdrive targets', M.every(m => m.steps.filter(s => s.type === 'rdrive').every(s => Array.isArray(s.at) && s.r >= 4)));
  t('ends in the lab', M.every(m => m.steps.at(-1).type === 'enter' && m.steps.at(-1).building === 'junkyard lab'));
  t('timed rdrive is generous', M.flatMap(m => m.steps).filter(s => s.limit).every(s => s.limit >= 120));
}
// rdrive spots: off the beltway, clear of AJ landmarks/blocks, inside the flat zone
{
  const beltway = [[0, -55], [-30, -50], [0, -220], [0, -390], [0, -430], [60, -430], [180, -200], [280, 40], [320, 80], [120, 160], [80, 40], [0, 60], [-140, 20], [-240, -20], [-280, -40], [-200, -120], [-80, -160], [0, -55]];
  const segD = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, k = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)) : 0; return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dz); };
  const roadD = p => Math.min(...beltway.slice(1).map((b, i) => segD(p, beltway[i], b)));
  const blocks = [[0, 0, 28, 28], [31, -17, 9, 5], [-6, 23, 8, 5], [-44, -14, 6, 4], [16, -38, 7, 5], [-30, -36, 12, 7], [6, -28, 8, 5], [-22, -16, 16, 16], [24, 6, 18, 18], [46, -34, 8, 5]];
  for (const [k, p] of Object.entries(RIFT_SPOTS)) {
    t('spot off beltway ' + k, roadD(p) > 12); t('spot flat zone ' + k, Math.hypot(p[0], p[1]) < 62);
    t('spot clear of blocks ' + k, blocks.every(([x, z, w, d]) => Math.abs(x - p[0]) > w / 2 + 3 || Math.abs(z - p[1]) > d / 2 + 3));
    t('spot clear of pad ' + k, Math.hypot(p[0] + 38, p[1] - 10) > 14);
  }
  t('junk spots reused', JUNK_AT.length === 3);
}
// barks: proper categories per speaker, short lines, every speaker covered
{
  t('barkCat', barkCat('Silas', 'idle') === 'sci_silas_idle' && barkCat('Mr. Lien', 'dim') === 'sci_lien_dim' && barkCat('The Hungry Quiet', 'dim') === 'sci_hungry_quiet_dim' && barkCat('Mother Ossery', 'dim') === 'sci_ossery_dim');
  t('bark cats', Object.keys(BARKS2).every(k => /^sci_[a-z_]+_(idle|warn|drive|dim)$/.test(k)) && ['sci_silas_idle', 'sci_tam_idle', 'sci_tam_warn', 'sci_silas_drive', 'sci_tam_drive'].every(k => BARKS2[k]?.length));
  t('bark length', Object.values(BARKS2).flat().every(l => l.length <= 90));
  t('cast', Object.keys(CAST).length === 5 && Object.values(CAST).every(c => DIMENSIONS2[c.where]));
  t('part1 barks untouched', BARKS[SILAS].length === 5 && BARKS[TAM].length === 5);
}
// originality + content guard: nothing from a certain cartoon, no real brands, no sexual content
{
  const txt = JSON.stringify([sci2Missions(), BARKS2, CAST, Object.values(DIMENSIONS2).map(d => [d.name, d.intro, d.done, d.hazards])]).toLowerCase();
  t('original', !/wubba|lubba|\brick\b|morty|plumbus|schwifty|squanch|meeseeks|citadel|szechuan|pickle|prime|unity|birdperson|gazorp|council of/.test(txt));
  t('no brands', !/coca|pepsi|marlboro|budweiser|jack daniel|nike|apple|google|amazon|walmart|tesla|spacex/.test(txt));
  t('no sexual content', !/\bsex|strip|nude|naked|porn|hooker|escort\b/.test(txt));
  t('no green portal', Object.values(DIMENSIONS2).every(d => d.trim !== 0x39ff14 && d.trim !== 0x00ff00));
}
console.log(`scientists2 unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
