// node tests/test-r2r-unit.mjs : Rags to Riches pure rules + data sanity
import fs from 'fs';
import * as R from '../modes/ragscore.js';
const data = JSON.parse(fs.readFileSync(new URL('../modes/rags-data.json', import.meta.url)));
let fails = 0; const ok = (name, c) => { console.log((c ? 'ok   ' : 'FAIL ') + name); if (!c) fails++; };
const S = R.freshState(data);
ok('fresh: broke, tier 0, nothing owned', S.cash === 25 && S.tier === 0 && Object.values(S.props).every(p => !p.owned));
ok('net worth = cash when broke', R.netWorth(S, data) === 25);
ok('first goal is a property', /first property/.test(R.nextGoal(S, data).text));
const noodle = R.propDef(data, 'noodle'), st = S.props.noodle;
ok('no income before owning', R.accrue(noodle, st, 600) === 0);
st.owned = true; R.accrue(noodle, st, 60);
ok('12 cr/min accrues', Math.abs(st.stored - 12) < 1e-6);
R.accrue(noodle, st, 1e6); ok('fills up to cap', st.stored === noodle.cap);
st.incomeLvl = 1; ok('income upgrade raises cap', R.incomeCap(noodle, st) === 180);
st.damaged = 30; const before = st.stored; R.accrue(noodle, st, 60); ok('no income while trashed', st.stored === before); st.damaged = 0;
ok('security cuts raid odds', R.raidChancePerMin(noodle, { secLvl: 3 }) < R.raidChancePerMin(noodle, { secLvl: 0 }));
const club = R.propDef(data, 'club');
ok('phone wave sizes capped at 6', R.wavePlan(club, { secLvl: 0 }, true).every(w => w.count <= 6));
ok('blast doors drop a wave', R.wavePlan(club, { secLvl: 2 }, true).length === club.raidWaves - 1);
ok('tier needs both net worth and rep', R.tierFor(3000, 5, data) === 0 && R.tierFor(3000, 25, data) === 1 && R.tierFor(9500, 50, data) === 2 && R.tierFor(9500, 30, data) === 1);
ok('upgrade cost grows', R.upgradeCost(club, 'security', 1, data) > R.upgradeCost(club, 'security', 0, data));
ok('auto-defend capped', R.autoDefendChance({ secLvl: 9 }) <= 0.9);
// data sanity
ok('one property per tier at least', [0, 1, 2].every(t => data.properties.some(p => p.tier === t)));
ok('chop shop, club, mansion present', ['chop', 'club', 'mansion'].every(id => R.propDef(data, id)));
ok('district centres match the city pack', JSON.stringify(data.districts.olympus.center) === '[0,-430]' && JSON.stringify(data.districts.flats.center) === '[-280,-40]' && JSON.stringify(data.districts.helios.center) === '[320,80]');
const inside = (aj, d) => Math.hypot(aj[0] - d.center[0], aj[1] - d.center[1]) <= d.radius;
ok('properties sit in their districts', data.properties.every(p => inside(p.door, data.districts[p.district])));
ok('Helios gate exit is outside the gate radius', !inside(data.helios_gate.outside, data.districts.helios));
const lita = [[292, 108], [346, 112], [350, 72], [292, 70]];
ok('mansion clear of the heist houses', lita.every(h => Math.hypot(h[0] - 362, h[1] - 40) > 25));
ok('tiers monotonic', data.tiers.every((t, i) => !i || (t.netWorth >= data.tiers[i - 1].netWorth && t.rep >= data.tiers[i - 1].rep)));
// nothing we build sits on the v7.5 city's domes, blocks, parked vehicles or add-on lots
try {
  const { DISTRICT_DATA } = await import('../citydata.js');
  const ORIGIN = { olympus: ['downtown', [0, -430]], flats: ['rough', [-280, -40]], helios: ['gated', [320, 80]] };
  const LOTS = { downtown: [[40, 30, 9]], rough: [[36, -34, 10]], gated: [[34, 46, 8]] };
  const clash = [];
  const check = (name, aj, rad, dk, skipSign) => {
    const [key, o] = ORIGIN[dk], P = DISTRICT_DATA[key], x = aj[0] - o[0], z = aj[1] - o[1];
    for (const d of P.domes) if (Math.hypot(x - d[0], z - d[1]) < d[2] + rad) clash.push(`${name}×dome ${d[3]}`);
    for (const b of P.blocks) if (b[5] !== skipSign && Math.abs(x - b[0]) < b[2] / 2 + rad && Math.abs(z - b[1]) < b[3] / 2 + rad) clash.push(`${name}×block ${b[5]}`);
    for (const v of P.vehicles) if (Math.hypot(x - v[1], z - v[2]) < rad + 2) clash.push(`${name}×${v[0]}`);
    for (const l of LOTS[key]) if (Math.hypot(x - l[0], z - l[1]) < l[2] + rad) clash.push(`${name}×lot`);
  };
  for (const p of data.properties) {
    const dc = data.districts[p.district].center, dx = p.door[0] - dc[0], dz = p.door[1] - dc[1], L = Math.hypot(dx, dz);
    const c = p.building ? p.door : [p.door[0] + dx / L * p.size[2] / 2, p.door[1] + dz / L * p.size[2] / 2];
    check(p.id, c, p.building ? 0.8 : Math.hypot(p.size[0], p.size[2]) / 2, p.district, p.building);
  }
  const spD = { crashpad: 'flats', loft: 'olympus', suite: 'helios' };
  for (const [id, sp] of Object.entries(data.spawns)) check('spawn ' + id, sp.aj, 1.5, spD[id]);
  ok('clear of city buildings, vehicles and lots' + (clash.length ? ': ' + clash.join(', ') : ''), !clash.length);
  for (const p of data.properties.filter(p => p.building)) ok(`${p.id} is the city's ${p.building}`, DISTRICT_DATA[ORIGIN[p.district][0]].blocks.some(b => b[5] === p.building));
} catch (e) { ok('citydata import (' + e.message + ')', false); }
const txt = JSON.stringify(data).toLowerCase();
ok('no real company names / nudity', !/\bspacex\b|\btesla\b|\bnude|\bnaked|\btopless/.test(txt));
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
