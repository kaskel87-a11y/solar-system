// mars/mouthcore.js rules + mars/mouth.js / hook static checks. node tests/test-mouth-unit.mjs
import fs from 'node:fs';
import * as M from '../mars/mouthcore.js';
const R = new URL('..', import.meta.url).pathname; let n = 0, fails = 0;
const t = (name, c) => { n++; if (!c) { fails++; console.log('FAIL ' + name); } };
const all = [...M.GREET, ...Object.values(M.INSULT).flat()];
// lines
t('15+ greetings', M.GREET.length >= 15);
t('exact "What\'s up, bitch"', M.GREET.includes("What's up, bitch"));
t('greetings unique', new Set(M.GREET).size === M.GREET.length);
t('insult sets bump/honk/drive', ['bump', 'honk', 'drive'].every(k => M.INSULT[k]?.length >= 4));
t('insults separate from greetings', Object.values(M.INSULT).flat().every(l => !M.GREET.includes(l)));
t('short enough for a bubble', all.every(l => typeof l === 'string' && l.length > 3 && l.length <= 65));
t('M-rated: actually swears', M.GREET.filter(l => /fuck|shit|ass|bitch|damn|hell|bastard|piss|dick/i.test(l)).length >= 10);
// content limits: identity targets, sexual content, real brands / people (word stems only, no slurs written here)
const banned = /\b(race|racial|black|white|asian|mexican|jew|jewish|muslim|christian|islam|church|god\s*hates|gay|lesbian|homo|queer|trans|tranny|retard|spaz|cripple|autis|lame-?o|midget|sex|sexy|horny|dick\s*suck|blow\s*job|cock|pussy|cunt|tits?|boobs?|whore|slut|hooker|porn|rape|nigg|fag|dyke|chink|spic|kike|wetback)\w*/i;
const brands = /\b(nike|coke|coca|pepsi|tesla|musk|spacex|apple|iphone|google|amazon|mcdonald|walmart|starbucks|disney|trump|biden|elon|ford|toyota|ferrari|uber|lyft)\b/i;
t('no identity / sexual words', all.every(l => !banned.test(l)));
t('no brands / real people', all.every(l => !brands.test(l)));
// who swears
t('districts', M.isFoulDistrict({ id: 'mars-rough', kind: 'rough' }) && M.isFoulDistrict({ id: 'mars-downtown', kind: 'downtown' }) && M.isFoulDistrict({ id: 'x', name: 'Red Tape Flats' }));
t('not aj / gated', !M.isFoulDistrict({ id: 'aj', name: 'Ares Junction', kind: 'hub' }) && !M.isFoulDistrict({ id: 'mars-gated', name: 'Helios Heights', kind: 'gated' }) && !M.isFoulDistrict(null));
const keys = Array.from({ length: 400 }, (_, i) => M.npcKey('mars-rough', i, 'N' + i));
const f1 = M.pickFoul(keys), f2 = M.pickFoul([...keys].reverse());
t('pickFoul ~1 in 4', f1.size === 100);
t('pickFoul deterministic, order-free', [...f1].every(k => f2.has(k)));
t('pickFoul ≥1 even for 3', M.pickFoul(keys.slice(0, 3)).size === 1 && M.pickFoul([]).size === 0);
const three = keys.slice(0, 3), base = [...M.pickFoul(three)][0], others = three.filter(k => k !== base);
const live = M.pickFoulLive(three, new Set(others));
t('cap: a parked pick → a live one promoted', [...live].some(k => others.includes(k)) && live.has(base));
t('cap: live pick → nothing promoted', M.pickFoulLive(three, new Set(three)).size === 1);
t('cap: deterministic', [...M.pickFoulLive(three, new Set(others))].join() === [...M.pickFoulLive(three, new Set([...others].reverse()))].join());
t('npcKey stable', M.npcKey('mars-rough', 2, 'Juno Reyes') === 'mars-rough:2:Juno Reyes');
// triggers
const C = M.CFG;
t('cooldowns in range', C.greetNpc >= 20 && C.greetNpc <= 30 && C.insultNpc >= 20 && C.insultNpc <= 30 && C.greetGlobal >= 3 && C.insultGlobal >= 1.5 && C.greetDist === 8);
t('greet in view ≤8 m', M.trigger({ d: 7, inView: true, moved: 0 }) === 'greet');
t('no greet out of view / far', M.trigger({ d: 7, inView: false, moved: 0 }) === null && M.trigger({ d: 9, inView: true, moved: 0 }) === null);
t('bump', M.trigger({ d: 1, inView: false, moved: 0.3 }) === 'bump' && M.trigger({ d: 1, inView: true, moved: 0 }) === 'greet');
t('honk', M.trigger({ d: 10, driving: true, speed: 0, honkAgo: 0.5 }) === 'honk' && M.trigger({ d: 10, driving: true, speed: 0, honkAgo: 3 }) === null);
t('drive close', M.trigger({ d: 3, driving: true, speed: 9 }) === 'drive' && M.trigger({ d: 3, driving: true, speed: 1 }) === null && M.trigger({ d: 7, driving: true, speed: 9 }) === null);
t('no greet from the car', M.trigger({ d: 5, driving: true, speed: 0, inView: true }) === null);
t('isInsult', M.isInsult('bump') && M.isInsult('honk') && M.isInsult('drive') && !M.isInsult('greet'));
// cooldowns
const cd = M.createCooldowns(), a = 'z:0:A', b = 'z:1:B';
t('first greet ok', cd.can(0, a, 'greet')); cd.mark(0, a, 'greet');
t('same NPC no repeat greet', !cd.can(10, a, 'greet') && !cd.can(C.greetNpc - 0.1, a, 'greet') && cd.can(C.greetNpc, a, 'greet'));
t('global greet gap', !cd.can(C.greetGlobal - 0.1, b, 'greet') && cd.can(C.greetGlobal, b, 'greet'));
t('bump after greet still insults', cd.can(1, a, 'bump')); cd.mark(1, a, 'bump');
t('per-NPC insult cooldown', !cd.can(1 + C.insultNpc - 0.1, a, 'drive') && cd.can(1 + C.insultNpc, a, 'honk'));
t('global insult gap', !cd.can(1 + C.insultGlobal - 0.1, b, 'bump') && cd.can(1 + C.insultGlobal, b, 'bump'));
t('no greet right after an insult', !cd.can(1 + C.insultGlobal - 0.1, b, 'greet'));
// spam bound: 60 s of every NPC triggering every 0.1 s
{ const c2 = M.createCooldowns(); let said = 0; for (let s = 0; s < 600; s++) { const now = s / 10; for (const k of ['k1', 'k2', 'k3']) for (const ty of ['greet', 'bump']) if (c2.can(now, k, ty)) { c2.mark(now, k, ty); said++; } } t('never spams (≤ 6 per NPC / min)', said <= 3 * 6); }
// lines picking
{ const rec = []; const seen = []; let r = 0; const rng = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 6; i++) seen.push(M.pickLine('greet', rec, rng));
  t('pickLine no repeats in a row', new Set(seen).size === 6 && seen.every(l => M.GREET.includes(l)));
  t('pickLine insult types', ['bump', 'honk', 'drive'].every(k => M.INSULT[k].includes(M.pickLine(k, [], () => 0.5))) && M.pickLine('nope') === null); }
// voice + mute
const v1 = M.voiceFor('mars-rough:0:Juno Reyes'), v2 = M.voiceFor('mars-rough:0:Juno Reyes');
t('voice stable + in range', v1.pitch === v2.pitch && v1.rate === v2.rate && v1.pitch >= 0.75 && v1.pitch <= 1.3 && v1.rate >= 0.95 && v1.rate <= 1.15);
t('tts on with sound', M.ttsAllowed({ mute: false, master: 0.8 }));
t('tts off when muted / silent / hidden / off / missing', !M.ttsAllowed({ mute: true }) && !M.ttsAllowed({ master: 0 }) && !M.ttsAllowed({ hidden: true }) && !M.ttsAllowed({ off: true }) && !M.ttsAllowed({ has: false }));
// runtime file + wiring
const rt = fs.readFileSync(R + 'mars/mouth.js', 'utf8'), core = fs.readFileSync(R + 'mars/mouthcore.js', 'utf8'), html = fs.readFileSync(R + 'index.html', 'utf8'), sw = fs.readFileSync(R + 'sw.js', 'utf8');
const ver = (html.match(/brightness\.js\?v=([\d.]+)/) || [])[1];
t('plain imports', /from '\.\/mouthcore\.js'/.test(rt) && !/import[^;]*\?v=/.test(rt) && !/^import/m.test(core));
t('importmap entries', ['./mars/mouth.js', 'ssx/mars/mouth', './mars/mouthcore.js', 'ssx/mars/mouthcore'].every(k => html.includes(`"${k}": "./mars/${k.includes('core') ? 'mouthcore' : 'mouth'}.js?v=${ver}"`)));
t('one script hook', (html.match(/<script type="module" src="\.\/mars\/mouth\.js\?v=[\d.]+"><\/script>/g) || []).length === 1 && html.includes(`src="./mars/mouth.js?v=${ver}"`));
t('sw precache', /`mars\/mouth\.js\$\{q\}`, `mars\/mouthcore\.js\$\{q\}`/.test(sw));
t('guarded boot + kill switch', /typeof X\.registerSurfaceTick !== 'function'/.test(rt) && /q\('mouth'\) === '0'/.test(rt) && /if \(X\.mouth\) return/.test(rt));
t('reuses Pumpkin bark voice + categories', /import \{ babble \} from '\.\.\/synth\.js'/.test(rt) && /registerBarks\('mouth_greet'/.test(rt));
t('babble also mute-gated', /function babbleFor[^]*?mix\?\.mute/.test(rt));
t('tts gated on mute', /ttsAllowed\(\{ mute: !!mix\?\.mute/.test(rt) && /if \(!sp \|\| !soundOn\(\)\) return false/.test(rt));
t('no new NPCs', !/addPerson|spawnPerson|spawnNpc|new THREE\.Mesh|createPerson/i.test(rt));
t('respects the NPC cap (live only)', /p\.on === false\) continue/.test(rt));
t('no keyboard clash (no new key)', !/e\.code\s*[!=]==\s*'Key/.test(rt));
console.log(`${n - fails}/${n} mouth unit checks passed`); if (fails) process.exit(1);
