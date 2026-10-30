// node tests/test-ragsrover-unit.mjs : Rags to Riches counts any owned ride as a rover (live fix v7.5.4)
import fs from 'fs';
import * as R from '../modes/ragscore.js';
import * as RR from '../modes/ragsrover.js';
import * as GC from '../garagecore.js';
const data = JSON.parse(fs.readFileSync(new URL('../modes/rags-data.json', import.meta.url)));
let fails = 0; const ok = (name, c) => { console.log((c ? 'ok   ' : 'FAIL ') + name); if (!c) fails++; };
const stockOnly = GC.freshGarage(), withDealer = GC.freshGarage(); withDealer.rides.push(GC.newRide('r1', 'rover'));
// no rides -> kicked
const S0 = R.freshState(data);
ok('fresh run: no rover', !RR.hasRover(S0, stockOnly.rides));
ok('no rides: kicked out of the starter rover', RR.shouldKick(S0, stockOnly.rides, true));
ok('no rides: on foot is never a kick', !RR.shouldKick(S0, stockOnly.rides, false));
ok('no rides: sync changes nothing', !RR.sync(S0, stockOnly.rides) && S0.hasRover === false);
// Wrench's beater -> ok
const S1 = { ...R.freshState(data), hasRover: true };
ok("Wrench's beater: not kicked", !RR.shouldKick(S1, stockOnly.rides, true));
// dealer ride owned -> ok
const S2 = R.freshState(data);
ok('dealer ride owned: has a rover', RR.hasRover(S2, withDealer.rides));
ok('dealer ride owned: not kicked from the starter rover', !RR.shouldKick(S2, withDealer.rides, true));
// old save with an owned ride migrates (and survives garagecore's migration of a partial old garage)
const oldGarage = GC.migrateGarage({ rides: [{ id: 'stock', kind: 'rover' }, { id: 'r3', kind: 'hover_coupe' }] });
const S3 = { ...R.freshState(data), active: true, started: 1 };
ok('old save: sync flips hasRover', RR.sync(S3, oldGarage.rides) === true && S3.hasRover === true);
ok('old save: second sync is a no-op', RR.sync(S3, oldGarage.rides) === false);
ok('old save: survives a JSON round trip', JSON.parse(JSON.stringify(S3)).hasRover === true);
// ride source: progress.garage first, then SSX.garage.rides, else none
ok('ridesOf reads progress.garage.rides', RR.ridesOf({ garage: withDealer }, null).length === 2);
ok('ridesOf falls back to SSX.garage.rides', RR.ownsRide(RR.ridesOf({}, { garage: { rides: [{ id: 'r2', kind: 'rover' }] } })));
ok('ridesOf with nothing is empty', RR.ridesOf(null, undefined).length === 0 && !RR.ownsRide(undefined));
ok('junk entries do not count', !RR.ownsRide([null, 5, { kind: 'rover' }, { id: 'stock', kind: 'rover' }]));
// plain words
ok('toast points at the Dealer and stealing', /Dealer/.test(RR.NO_ROVER_MSG) && /steal/.test(RR.NO_ROVER_MSG) && !/borrow/.test(RR.NO_ROVER_MSG));
// rags.js uses the helper (one hook) and the old wording is gone
const src = fs.readFileSync(new URL('../modes/rags.js', import.meta.url), 'utf8');
ok('rags.js kicks via RR.shouldKick', /RR\.shouldKick\(/.test(src) && /RR\.sync\(/.test(src) && !/No rover yet/.test(src));
console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
