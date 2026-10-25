// PIT 66.6 / DUST 98.3 / MY MUSIC unit tests (pure logic, no browser): node tests/test-radio-extra-unit.mjs
import * as SG from '../songs.js';
import { PIT_STATION, PIT_TRACKS } from '../pit.js';
import { DUST_STATION, DUST_TRACKS } from '../dust.js';
import { EXTRA_STATIONS, MINE_STATION, shuffleOrder, isAudioFile, prettyName } from '../radio-extra.js';
import { appendStations, normStation, resolveStation, rememberStation, MARS_STATIONS } from '../radio.js';
import { STATIONS as STOCK } from '../audio7.js';
import { pickNightEvent, NIGHT_EVENTS, isNight } from '../night.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };

// ---------- registration (same path as SSX.audio.registerStation) ----------
const list = STOCK.map(s => ({ ...s })); appendStations(list, MARS_STATIONS);
const before = list.map(s => s.id).join();
const idx = appendStations(list, EXTRA_STATIONS);
ok('appended after existing stations', list.slice(0, 8).map(s => s.id).join() === before && idx.join() === '8,9,10', list.map(s => s.id).join());
ok('ids', list.slice(8).map(s => s.id).join() === 'pit,dust,mine');
ok('re-register is idempotent', appendStations(list, EXTRA_STATIONS).join() === '8,9,10' && list.length === 11);
ok('normStation keeps step + tracks', typeof list[8].step === 'function' && list[8].tracks === PIT_TRACKS && typeof list[9].step === 'function');
ok('mine has no step (silent scheduler, files play instead)', typeof list[10].step !== 'function' && list[10].name === 'MY MUSIC');
ok('names', PIT_STATION.name === 'PIT 66.6' && DUST_STATION.name === 'DUST 98.3');
ok('bpm clamped by normStation', list.slice(8).every(s => s.bpm >= 40 && s.bpm <= 200));
const set = {}; ok('remember by id', rememberStation(set, list, 9) && set.radioId === 'dust' && set.radio === 9);
ok('resolve by id even if order changes', resolveStation([...list].reverse(), { radioId: 'pit', radio: 8 }) === 2);
ok('dj lines present (no sexual content check: wordlist)', [PIT_STATION, DUST_STATION].every(s => s.dj.length >= 5 && s.dj.every(l => l.length < 80 && !/\b(sex|fuck(ing)? (me|you)|tits|dick|pussy)\b/i.test(l))));

// ---------- song engine ----------
ok('rng deterministic', SG.rng(5)() === SG.rng(5)() && SG.rng(5)() !== SG.rng(6)());
{ const d = {}, seen = []; for (let i = 0; i < 70; i++) seen.push(SG.nextTrack(d, 7, SG.rng(i + 1)));
  ok('nextTrack never repeats back to back', seen.every((v, i) => i === 0 || v !== seen[i - 1]));
  ok('nextTrack plays every track per deck', [0, 7, 14].every(o => new Set(seen.slice(o, o + 7)).size === 7)); }
{ const tr = [{ meter: 4, sections: [{ type: 'a', bars: 1 }, { type: 'b', bars: 2 }] }, { meter: 3, sections: [{ type: 'c', bars: 1 }] }];
  ok('section/track steps', SG.sectionSteps(tr[1], tr[1].sections[0]) === 12 && SG.trackSteps(tr[0]) === 48);
  const p = {}, types = []; for (let i = 0; i < 200; i++) { const c = SG.advance(p, tr, SG.rng(3)); if (c.startSec) types.push(c.sec.type); }
  ok('advance walks sections in order', types.join('').includes('abc') || types.join('').includes('cab'), types.join('')); }

// fake x: count voices; songs.js helpers fall back to x.osc when x.out isn't a Web Audio node
function run(station, seconds) {
  const st = normStation(station), calls = { osc: 0, hit: 0 }, titles = [], perSec = [];
  st.onTrack = tr => titles.push(tr.title);
  const x = { out: null, osc: () => calls.osc++, hit: () => calls.hit++ };
  let t = 0, step = 0, sec = 0, cnt = 0, bad = 0, bpms = new Set();
  while (t < seconds) {
    const spb = 60 / st.bpm / 4; const b = calls.osc + calls.hit;
    try { st.step(x, t, step % 64, Math.floor(step / 16) % 4, spb); } catch (e) { bad++; if (bad < 3) console.log(e); }
    cnt += calls.osc + calls.hit - b; bpms.add(st.bpm); t += spb; step++;
    if (t >= sec + 1) { perSec.push(cnt); cnt = 0; sec++; }
  }
  return { calls, titles, perSec, bad, bpms };
}
for (const [S, T] of [[PIT_STATION, PIT_TRACKS], [DUST_STATION, DUST_TRACKS]]) {
  const r = run(S, 60 * 40); // 40 minutes of radio
  ok(`${S.id}: no errors`, r.bad === 0, r.bad);
  ok(`${S.id}: rotates through all ${T.length} tracks`, new Set(r.titles).size === T.length, [...new Set(r.titles)].join('|'));
  ok(`${S.id}: never the same track twice in a row`, r.titles.every((v, i) => i === 0 || v !== r.titles[i - 1]));
  ok(`${S.id}: tempo changes per track`, r.bpms.size >= 4, [...r.bpms].join());
  const avg = r.perSec.reduce((a, b) => a + b, 0) / r.perSec.length, peak = Math.max(...r.perSec);
  ok(`${S.id}: voice budget (avg ${avg.toFixed(1)}/s, peak ${peak}/s) stays mobile-friendly`, avg < 70 && peak < 130);
  ok(`${S.id}: tracks have distinct material`, new Set(T.map(t => JSON.stringify(t.riffs || t.mel))).size === T.length);
  ok(`${S.id}: tracks are 45 s - 4 min`, T.every(t => { const s = SG.trackSteps(t) * 60 / t.bpm / 4; return s > 45 && s < 240; }), T.map(t => Math.round(SG.trackSteps(t) * 60 / t.bpm / 4)).join());
  ok(`${S.id}: ends each song with a gap for the DJ ID`, T.every(t => t.sections.at(-1).type === 'gap'));
}
ok('pit has breakdowns + blasts in every track', PIT_TRACKS.every(t => ['half', 'slam', 'blast'].every(k => t.sections.some(s => s.type === k))));
ok('pit is down-tuned (E1..A1)', PIT_TRACKS.every(t => t.root >= 28 && t.root <= 33));
ok('dust has a waltz, a shuffle, a train beat and a ballad', ['waltz', 'shuffle', 'train', 'ballad'].every(f => DUST_TRACKS.some(t => t.feel === f)));
ok('dust waltz is in 3', DUST_TRACKS.filter(t => t.feel === 'waltz').every(t => t.meter === 3));

// ---------- MY MUSIC helpers ----------
{ const o = shuffleOrder(10, -1, SG.rng(9)); ok('shuffle is a permutation', o.slice().sort((a, b) => a - b).join() === '0,1,2,3,4,5,6,7,8,9'); }
ok('shuffle refill never starts with the last song', Array.from({ length: 50 }, (_, i) => shuffleOrder(4, 2, SG.rng(i + 1))[0]).every(v => v !== 2));
ok('single file shuffle', shuffleOrder(1, 0).join() === '0');
ok('audio file filter', isAudioFile({ type: 'audio/mpeg', name: 'x' }) && isAudioFile({ type: '', name: 'song.m4a' }) && !isAudioFile({ type: 'image/png', name: 'a.png' }) && !isAudioFile(null));
ok('pretty name', prettyName('my_song.mp3') === 'my song');
ok('MY MUSIC def', MINE_STATION.id === 'mine' && EXTRA_STATIONS.at(-1) === MINE_STATION);
// ---------- night mix ----------
ok('night: no clock means not night', (globalThis.window = undefined, isNight() === false));
ok('night: nothing outside districts', pickNightEvent({ flats: 0, downtown: 0 }) === null && pickNightEvent(null) === null);
ok('night: flats events come from the flats table', Array.from({ length: 40 }, (_, i) => pickNightEvent({ flats: 1 }, SG.rng(i + 1))).every(e => e in NIGHT_EVENTS.flats));
ok('night: heights stays quiet (no bottles or shouting)', Array.from({ length: 40 }, (_, i) => pickNightEvent({ heights: 1 }, SG.rng(i + 1))).every(e => !['bottle', 'shout', 'shutter'].includes(e)));
console.log(`${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
