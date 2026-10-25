// Surface exploration: streaming procedural terrain + first-person walking.
import * as THREE from 'three';
import { buildStarship, buildAstronaut, buildDog, buildRover as buildBuggy, DISCOVERY_BUILDERS } from './models.js';
import { createGame } from './game.js';
import { createWorld, VEHICLES } from './world.js';
import { raceTick } from './race.js';
import { activityTick } from './activities/runner.js';
import { heistTick } from './heist.js';
import { sciTick } from './scihooks.js'; // junkyard lab pack: Raccoon Mobile + scientist portal jobs
import { dangerTick } from './danger.js'; // Chief of Staff's street danger (PR #3)
import { modeTick } from './modes/hook.js'; // add-on modes (Rags to Riches) + generic SSX.raids (PR #13)

// ---------- Seeded 2D simplex noise ----------
function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (x, y) {
    const s2 = (x + y) * F2, i = Math.floor(x + s2), j = Math.floor(y + s2);
    const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = grad[perm[ii + perm[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n; // ~[-1,1]
  };
}
function hash2(x, y, seed) { let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Body configs ----------
const C = c => new THREE.Color(c);
const BODIES = {
  Moon: {
    g: 0.165, seed: 11, amp: 5, freq: 1 / 140, ridged: 0, craters: { cell: 34, p: 0.75, rmin: 3, rmax: 16 },
    low: C(0x5f5f60), high: C(0xb4b4b0), slope: C(0x4a4a4a), crater: C(0x707070), rock: C(0x8d8d8a), rocksPerChunk: 22,
    sky: 'space', fog: { type: 'linear', color: 0x000000, near: 70, far: 150 }, sunSize: 26, sunElev: 0.45, light: 2.6, ambient: 0.45, hemi: [0x8a90a8, 0x3a3a3a],
    earthInSky: true,
    poi: { kind: 'lander', name: 'Apollo Lunar Module', fact: 'The Apollo landers\u2019 descent stages are still on the Moon: six of them, from 1969 to 1972. Astronauts used them as launch pads to fly home.' },
    flagFact: 'Apollo astronauts planted six US flags on the Moon. Decades of harsh sunlight have probably bleached them white.',
    facts: ['A meteorite! The Moon has no air to burn up space rocks, so even tiny ones hit the ground at full speed.', 'Moon dust (regolith) is sharp like broken glass, because no wind or water has ever smoothed it.', 'Footprints here can last millions of years, since there is no wind to blow them away.', 'A day on the Moon lasts about 29.5 Earth days, so the Sun hangs in this black sky for two weeks at a time.']
  },
  Mercury: {
    g: 0.38, seed: 23, amp: 7, freq: 1 / 160, ridged: 0.3, craters: { cell: 40, p: 0.7, rmin: 4, rmax: 20 },
    low: C(0x4f4842), high: C(0x9a9088), slope: C(0x3d3833), crater: C(0x5e5650), rock: C(0x6d655f), rocksPerChunk: 20,
    sky: 'space', fog: { type: 'linear', color: 0x000000, near: 70, far: 150 }, sunSize: 70, sunElev: 0.5, light: 3.4, ambient: 0.4, hemi: [0x907860, 0x3a3028],
    poi: { kind: 'probe', name: 'MESSENGER probe', fact: 'NASA\u2019s MESSENGER orbited Mercury from 2011 to 2015, then was crashed into the surface on purpose when it ran out of fuel.' },
    flagFact: 'No one has ever landed on Mercury. Your flag would be the first!',
    facts: ['From Mercury the Sun looks about 3 times bigger than it does from Earth.', 'Days here reach 430 \u00b0C, and nights fall to \u2212180 \u00b0C.', 'Despite the heat, there is water ice hiding in permanently shadowed craters at Mercury\u2019s poles.', 'Mercury is shrinking as its iron core cools, which wrinkles the surface into long cliffs.']
  },
  Venus: {
    g: 0.90, seed: 37, amp: 6, freq: 1 / 120, ridged: 0.6, craters: null,
    low: C(0x3e2610), high: C(0xa8743c), slope: C(0x2e1c0c), crater: C(0x5a3a1c), rock: C(0x553824), rocksPerChunk: 26, patch: 0.26, shade: 1.5,
    sky: 'gradient', top: 0x8a4a14, horizon: 0xe0a050, fog: { type: 'linear', color: 0xe0a050, near: 22, far: 150 }, sunSize: 0, sunElev: 0.6, light: 1.7, ambient: 0.45, hemi: [0xe0a060, 0x402010], lightColor: 0xffb070,
    poi: { kind: 'venera', name: 'Venera 13 lander', fact: 'The Soviet Venera 13 lander survived 127 minutes on Venus in 1982 and sent back the first color photos of its surface.' },
    flagFact: 'At 465 \u00b0C and 90 times Earth\u2019s air pressure, a flag here would char in minutes.',
    facts: ['The air here is so thick it is like being 900 m under the ocean on Earth.', 'Venus spins backwards, so the Sun would rise in the west, if you could see it through the clouds.', 'The clouds above are made of sulfuric acid.', 'A day on Venus (243 Earth days) is longer than its year (225 days).']
  },
  Earth: {
    g: 1.0, seed: 51, amp: 9, freq: 1 / 110, ridged: 0.2, craters: null, water: -1.5, padH: 2.5,
    low: C(0x3f7a2f), high: C(0x6e9c42), slope: C(0x6b6358), crater: C(0x3f7a2f), rock: C(0x7a7470), sand: C(0xcdb983), snow: C(0xf2f4f8), rocksPerChunk: 6, trees: 22,
    sky: 'gradient', top: 0x2f6fcf, horizon: 0xc4dff5, fog: { type: 'linear', color: 0xc4dff5, near: 50, far: 150 }, sunSize: 26, sunElev: 0.75, light: 2.6, ambient: 0.5, hemi: [0x9fc8ff, 0x3a5a2a],
    poi: { kind: 'sign', name: 'Welcome home', fact: 'Earth is the only place we know of with liquid water on the surface, breathable air, and life.' },
    flagFact: 'Home sweet home. Earth is the densest planet in the solar system.',
    facts: ['About 71% of Earth\u2019s surface is covered in water.', 'Trees like these produce much of the oxygen you are breathing right now.', 'Earth\u2019s spin is slowing: a day was only about 22 hours long 600 million years ago.', 'Earth\u2019s magnetic field shields life from the solar wind, and it makes the auroras.']
  },
  Mars: {
    g: 0.38, seed: 67, amp: 8, freq: 1 / 150, ridged: 0.4, craters: { cell: 60, p: 0.35, rmin: 5, rmax: 18 },
    low: C(0x8a3c1c), high: C(0xc0703c), slope: C(0x6b2e16), crater: C(0x7a3418), rock: C(0x5a2a18), rocksPerChunk: 40,
    sky: 'gradient', top: 0xb07a4a, horizon: 0xe2b483, fog: { type: 'linear', color: 0xd9a676, near: 45, far: 140 }, sunSize: 16, sunElev: 0.5, light: 2.2, ambient: 0.55, hemi: [0xe0b080, 0x502818], lightColor: 0xfff0dd,
    poi: { kind: 'rover', name: 'Perseverance rover', fact: 'NASA\u2019s Perseverance has explored Jezero Crater since 2021, drilling rock samples that may one day be flown back to Earth.' },
    flagFact: 'No human has stood on Mars yet. You would be the first!',
    facts: ['Mars looks red because its dust is full of iron oxide: rust.', 'Olympus Mons on Mars is about 22 km tall, nearly three times the height of Everest.', 'Sunsets on Mars are blue, the opposite of Earth\u2019s.', 'Dust storms on Mars can grow to cover the whole planet for weeks.']
  },
  Io: {
    g: 0.183, seed: 83, amp: 6, freq: 1 / 130, ridged: 0.3, craters: null,
    low: C(0xb88a2a), high: C(0xeedc6a), slope: C(0x8a5a20), crater: C(0xb88a2a), rock: C(0x5a3a18), rocksPerChunk: 16,
    spots: { color: C(0x2a1a10), hot: C(0xd04a18) },
    sky: 'space', fog: { type: 'linear', color: 0x000000, near: 70, far: 150 }, sunSize: 9, sunElev: 0.5, light: 2.0, ambient: 0.5, hemi: [0xffe0a0, 0x4a3010],
    planetInSky: { tex: 'jupiter', size: 110, pos: [-160, 140, -400] },
    poi: { kind: 'sign', sign: 'IO BASE CAMP', name: 'Io Base Camp', fact: 'NASA\u2019s Galileo (1995\u20132003) and Juno spacecraft have flown past Io. Jupiter\u2019s gravity squeezes Io as it orbits, heating its insides so much it erupts constantly.' },
    flagFact: 'No spacecraft has ever landed on Io. Jupiter\u2019s radiation here would be deadly to an unprotected human within a day.',
    facts: ['Io is the most volcanically active world in the solar system, with about 400 active volcanoes.', 'The yellow, orange and white colors on Io come from sulfur and frozen sulfur dioxide.', 'Io is a little bigger than Earth\u2019s Moon.', 'Jupiter looks about 40 times wider in Io\u2019s sky than the full Moon does in ours.']
  },
  Europa: {
    g: 0.134, seed: 97, amp: 3, freq: 1 / 170, ridged: 0.7, craters: { cell: 120, p: 0.15, rmin: 4, rmax: 10 },
    low: C(0xb8ad9a), high: C(0xf2efe6), slope: C(0x9a8670), crater: C(0xd0c8b8), rock: C(0xe2ddd2), rocksPerChunk: 14,
    cracks: C(0x8a4a2a),
    sky: 'space', fog: { type: 'linear', color: 0x000000, near: 70, far: 150 }, sunSize: 9, sunElev: 0.4, light: 2.3, ambient: 0.45, hemi: [0xc8d8ff, 0x50483e],
    planetInSky: { tex: 'jupiter', size: 70, pos: [-200, 150, -380] },
    poi: { kind: 'sign', sign: 'EUROPA BASE', name: 'Europa Base Camp', fact: 'NASA\u2019s Europa Clipper launched in October 2024 and is due to reach Jupiter in 2030, to study whether Europa\u2019s hidden ocean could support life.' },
    flagFact: 'No spacecraft has landed on Europa yet. Your flag stands on ice that may float over a global ocean.',
    facts: ['Europa\u2019s ice shell is probably 15\u201325 km thick, with a salty ocean beneath it.', 'Europa may hold about twice as much water as all of Earth\u2019s oceans.', 'Europa is slightly smaller than Earth\u2019s Moon.', 'Europa\u2019s surface is one of the smoothest in the solar system, with few big craters.']
  },
  Titan: {
    g: 0.138, seed: 109, amp: 5, freq: 1 / 140, ridged: 0.2, craters: null, water: -1.2, padH: 2.2, liquid: 0x1a120a,
    low: C(0x6a4a24), high: C(0x9a7440), slope: C(0x4a3418), crater: C(0x6a4a24), rock: C(0xa08a6a), sand: C(0x3a2a16), snow: C(0x9a7440), rocksPerChunk: 18,
    sky: 'gradient', top: 0x9a5a1a, horizon: 0xd99a4a, fog: { type: 'linear', color: 0xd0924a, near: 26, far: 160 }, sunSize: 0, sunElev: 0.6, light: 1.4, ambient: 0.55, patch: 0.22, shade: 1.3, hemi: [0xe0a050, 0x3a2410], lightColor: 0xffc080,
    poi: { kind: 'sign', sign: 'TITAN BASE', name: 'Titan Base Camp', fact: 'NASA\u2019s Dragonfly, a nuclear-powered drone helicopter, is planned to launch in 2028 and fly across Titan\u2019s dunes and craters in the 2030s.' },
    flagFact: 'Titan\u2019s air is thick enough (and gravity low enough) that you could fly by flapping wings strapped to your arms.',
    facts: ['Titan is the only moon with a thick atmosphere, mostly nitrogen, like Earth\u2019s.', 'At about \u2212179 \u00b0C, Titan is cold enough for methane to fall as rain.', 'The orange haze is made of organic molecules formed when sunlight breaks up methane.', 'Titan is bigger than the planet Mercury.']
  }
};
export const LANDABLE = Object.keys(BODIES);

// ---------- Discoveries (real facts) ----------
// a: compass angle in degrees from the landing site (0 = straight ahead), d: distance in metres, reach: discovery radius
export const DISCOVERIES = {
  Moon: [
    { id: 'footprints', kind: 'footprints', a: 20, d: 45, name: 'Apollo bootprints', fact: 'Neil Armstrong and Buzz Aldrin first walked on the Moon on 20 July 1969. With no wind or rain to wipe them away, bootprints like these could last for millions of years.' },
    { id: 'lrv', kind: 'lrv', a: -35, d: 80, name: 'Lunar Roving Vehicle', fact: 'Apollo 15, 16 and 17 each brought an electric Lunar Roving Vehicle and left it behind. These battery-powered buggies let astronauts explore kilometres from their lander, at up to about 18 km/h.' },
    { id: 'retro', kind: 'retro', a: 70, d: 120, name: 'Laser retroreflector', fact: 'Apollo 11, 14 and 15 left mirror arrays on the Moon. Observatories still bounce lasers off them, measuring the Moon\u2019s distance to within millimetres and showing it drifts about 3.8 cm farther from Earth every year.' },
    { id: 'golf', kind: 'golf', a: 150, d: 60, name: 'Alan Shepard\u2019s golf ball', fact: 'In February 1971, Apollo 14 commander Alan Shepard hit two golf balls on the Moon, using a six-iron club head attached to a tool for collecting samples.' },
    { id: 'ice', kind: 'ice', a: -110, d: 170, reach: 12, name: 'Ice in a shadowed crater', fact: 'Some craters near the Moon\u2019s poles never see sunlight and can be colder than \u2212230 \u00b0C. In 2018, data from NASA\u2019s Moon Mineralogy Mapper on India\u2019s Chandrayaan-1 confirmed water ice inside them.' },
    { id: 'meteorite', kind: 'meteorite', a: 110, d: 240, name: 'Fresh impact', fact: 'With no air to slow them down, even tiny meteoroids hit the Moon at tens of kilometres per second. Hundreds of rocks blasted off the Moon by impacts have been found on Earth as lunar meteorites.' },
    { id: 'surveyor', kind: 'surveyor', a: -70, d: 130, name: 'Surveyor 3 probe', fact: 'In November 1969, Apollo 12 landed within walking distance of the robotic Surveyor 3 probe, which had been on the Moon since 1967. Astronauts brought its camera back to Earth.' },
    { id: 'lunokhod', kind: 'lunokhod', a: 175, d: 200, name: 'Lunokhod rover', fact: 'The Soviet Lunokhod 1 became the first robotic rover on another world in November 1970. Drivers on Earth steered it by remote control for about 10 months.' }
  ],
  Mars: [
    { id: 'ingenuity', kind: 'ingenuity', a: 30, d: 70, name: 'Ingenuity helicopter', fact: 'Ingenuity rode to Mars under NASA\u2019s Perseverance rover. On 19 April 2021 it made the first powered, controlled flight on another planet, and it went on to fly 72 times.' },
    { id: 'riverbed', kind: 'riverbed', a: -60, d: 110, reach: 16, name: 'Ancient riverbed', fact: 'In 2012, NASA\u2019s Curiosity rover found rounded pebbles in Gale Crater that could only have been tumbled smooth by flowing water. Rivers and lakes existed on Mars billions of years ago.' },
    { id: 'icepatch', kind: 'icepatch', a: 140, d: 150, name: 'Buried ice', fact: 'Mars has water ice at its poles and just under the surface in many places. In 2008, NASA\u2019s Phoenix lander dug up bright chunks of ice that vanished (sublimated) within a few days.' },
    { id: 'dustdevil', kind: 'dustdevil', a: -150, d: 200, reach: 14, name: 'Dust devil', fact: 'Martian dust devils can be far bigger than Earth\u2019s. Their winds cleaned the dusty solar panels of the rovers Spirit and Opportunity, helping them keep working for years longer than planned.' },
    { id: 'face', kind: 'face', a: 80, d: 280, reach: 30, name: '\u2018Face on Mars\u2019 mesa', fact: 'In 1976, NASA\u2019s Viking 1 orbiter photographed a mesa in the Cydonia region that looked like a face. Sharper images from Mars Global Surveyor in 1998 and 2001 showed it is just an eroded hill.' },
    { id: 'oppy', kind: 'oppy', a: -100, d: 230, name: 'Opportunity rover', fact: 'NASA\u2019s Opportunity rover was built to last 90 Martian days but kept going from 2004 to 2018, driving over 45 km, until a planet-wide dust storm covered its solar panels.' },
    { id: 'blueberries', kind: 'blueberries', a: 175, d: 90, reach: 12, name: '\u2018Blueberries\u2019', fact: 'In 2004, Opportunity found millions of small grey spheres it nicknamed \u2018blueberries\u2019. They are made of hematite, an iron mineral that forms in water.' }
  ],
  Venus: [
    { id: 'lava', kind: 'lava', a: -50, d: 90, reach: 14, name: 'Lava flow', fact: 'Most of Venus is covered in volcanic plains. Its surface is surprisingly young, only about 300 to 600 million years old, probably because floods of lava repaved the planet.' },
    { id: 'balloon', kind: 'balloon', a: -140, d: 120, reach: 12, name: 'Vega balloon', fact: 'In June 1985, the Soviet Vega 1 and Vega 2 missions released balloons into Venus\u2019s clouds. They floated about 54 km up for around two days, the first balloons ever flown on another planet.' },
    { id: 'pancake', kind: 'pancake', a: 120, d: 160, reach: 20, name: 'Pancake dome', fact: 'Venus has flat-topped \u2018pancake domes\u2019 up to about 65 km wide but less than 1 km tall, made by thick, sticky lava that oozed out and spread slowly.' },
    { id: 'volcano', kind: 'volcano', a: 20, d: 260, reach: 46, name: 'Volcano', fact: 'Venus has more volcanoes than any other planet, including over 1,600 major ones. In 2023, scientists found a vent near Maat Mons that changed shape between 1991 radar images, evidence of a recent eruption.' },
    { id: 'tessera', kind: 'tessera', a: 170, d: 200, reach: 18, name: 'Tessera ridges', fact: 'Tesserae are Venus\u2019s oldest, most crumpled terrain, a jumble of crossing ridges and valleys. Scientists think they may hold clues to whether Venus once had oceans.' }
  ],
  Mercury: [
    { id: 'hollows', kind: 'hollows', a: 60, d: 70, reach: 12, name: 'Hollows', fact: 'NASA\u2019s MESSENGER found \u2018hollows\u2019 on Mercury: bright, shallow pits not seen on other rocky worlds. They seem to form as volatile material escapes from the rock.' },
    { id: 'polarice', kind: 'polarice', a: -30, d: 90, reach: 12, name: 'Ice in a polar crater', fact: 'Mercury is the closest planet to the Sun, yet it has water ice in polar craters that are always in shadow. NASA\u2019s MESSENGER spacecraft confirmed it in 2012.' },
    { id: 'scarp', kind: 'scarp', a: 170, d: 160, reach: 26, name: 'Lobate scarp', fact: 'As Mercury\u2019s iron core cooled, the whole planet shrank by up to about 7 km in radius, wrinkling the crust into giant cliffs called lobate scarps, some hundreds of kilometres long.' },
    { id: 'caloris', kind: 'caloris', a: -120, d: 220, reach: 18, name: 'Caloris boulders', fact: 'The Caloris Basin is one of the largest impact craters in the solar system, about 1,550 km across. The impact was so violent it may have jumbled the ground on the opposite side of Mercury.' },
    { id: 'rays', kind: 'rays', a: 110, d: 130, reach: 16, name: 'Rayed crater', fact: 'Young craters like Mercury\u2019s Kuiper crater are surrounded by bright streaks of thrown-out rock called rays. They fade over time as sunlight and micrometeorites darken them.' }
  ],
  Earth: [
    { id: 'fox', kind: 'fox', a: -30, d: 50, name: 'Red fox', fact: 'Red foxes have the widest range of any wild carnivore. Studies suggest they may even use Earth\u2019s magnetic field to aim their pounces on prey hidden under snow.' },
    { id: 'redwood', kind: 'redwood', a: 40, d: 90, reach: 14, name: 'Giant redwood', fact: 'Coast redwoods are the tallest trees on Earth. The tallest known, Hyperion in California, is about 116 m tall.' },
    { id: 'stones', kind: 'stones', a: 150, d: 140, reach: 16, name: 'Stone circle', fact: 'Stonehenge in England was built in stages starting about 5,000 years ago. Some of its smaller \u2018bluestones\u2019 were hauled from Wales, about 225 km away.' },
    { id: 'hoba', kind: 'hoba', a: -120, d: 190, name: 'Hoba meteorite', fact: 'The Hoba meteorite in Namibia is the largest known meteorite on Earth. It weighs about 60 tonnes, is made mostly of iron and nickel, and has never been moved from where it fell.' },
    { id: 'barringer', kind: 'barringer', a: 90, d: 230, reach: 18, name: 'Impact crater', fact: 'Meteor Crater (Barringer Crater) in Arizona is about 1.2 km wide. It was blasted out roughly 50,000 years ago by an iron meteorite about 50 m across.' },
    { id: 'tardigrade', kind: 'tardigrade', a: -70, d: 110, name: 'Tardigrades in the moss', fact: 'Tardigrades (\u2018water bears\u2019) are animals about half a millimetre long that live in moss. In 2007, some survived 10 days exposed to outer space on a satellite.' }
  ],
  Io: [
    { id: 'lavalake', kind: 'lavalake', a: 40, d: 110, reach: 16, name: 'Lava lake', fact: 'Loki Patera on Io is a lava lake about 200 km across, the most powerful volcano in the solar system. Its surface crust sinks and overturns in waves.' },
    { id: 'pele', kind: 'pele', a: -60, d: 170, reach: 24, name: 'Volcanic plume', fact: 'Io\u2019s volcano Pele shoots sulfur gas about 300 km into space. It falls back in a red ring more than 1,000 km wide, seen by NASA\u2019s Voyager and Galileo.' },
    { id: 'sulfur', kind: 'sulfur', a: 150, d: 80, reach: 10, name: 'Sulfur frost', fact: 'Io\u2019s bright colors come from sulfur compounds. Sulfur dioxide gas from volcanoes freezes onto the cold surface as white frost.' }
  ],
  Europa: [
    { id: 'lineae', kind: 'lineae', a: 30, d: 80, reach: 16, name: 'Lineae cracks', fact: 'Europa is covered in long reddish-brown cracks called lineae. Jupiter\u2019s tides flex the ice shell, splitting it, and material from below may color the cracks.' },
    { id: 'chaos', kind: 'chaos', a: -80, d: 150, reach: 18, name: 'Chaos terrain', fact: 'In places like Conamara Chaos, Europa\u2019s ice is broken into rafts that drifted and refroze, a sign that warmer ice or water lies not far below.' },
    { id: 'plume', kind: 'plume', a: 130, d: 200, reach: 22, name: 'Water vapor plume', fact: 'The Hubble Space Telescope saw signs of water vapor plumes rising from Europa in 2012 and 2016. If real, they could let a spacecraft sample the ocean without drilling.' },
    { id: 'salt', kind: 'salt', a: -160, d: 110, reach: 10, name: 'Sea salt', fact: 'In 2019, scientists using the Hubble Space Telescope found sodium chloride (table salt) in Europa\u2019s yellowish regions, possibly from its ocean.' }
  ],
  Titan: [
    { id: 'shore', kind: 'shore', a: 60, d: 90, reach: 14, name: 'Methane sea shore', fact: 'Titan is the only other world known to have liquid seas on its surface, but they are made of liquid methane and ethane. Kraken Mare is bigger than the Caspian Sea.' },
    { id: 'huygens', kind: 'huygens', a: -40, d: 130, name: 'Huygens probe', fact: 'On 14 January 2005, the European Space Agency\u2019s Huygens probe parachuted onto Titan, the most distant landing ever made. It found rounded ice pebbles, like a dried riverbed.' },
    { id: 'dunes', kind: 'dunes', a: 160, d: 180, reach: 22, name: 'Hydrocarbon dunes', fact: 'Titan has huge dune fields, with dunes up to about 100 m tall. The \u2018sand\u2019 is not rock but grains of frozen organic compounds.' }
  ]
};
const DISC_KEY = 'ssx.discoveries.v1';
export function loadFound() { try { return JSON.parse(localStorage.getItem(DISC_KEY)) || {}; } catch (e) { return {}; } }
function saveFound(f) { try { localStorage.setItem(DISC_KEY, JSON.stringify(f)); } catch (e) { /* private mode */ } }

export function createSurface({ renderer, textures, isMobile, onEvent = () => {} }) {
  const extraTicks = []; // v7.5.1: add-on per-frame hooks (SSX.registerSurfaceTick)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2400);
  camera.rotation.order = 'YXZ';

  const CHUNK = 48, SEG = isMobile ? 20 : 24, RADIUS = isMobile ? 2 : 3;
  const EYE = 1.7;
  let cfg = null, name = null, noise = null, noise2 = null;
  const chunks = new Map();
  const rockBlk = new Map(); // v7.5.1 (M4/m2): big rocks per chunk block the camera boom
  const rockAt = (x, y, z) => { const L = rockBlk.get(`${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`); if (L) for (const r of L) { const dx = x - r.x, dz = z - r.z, dy = (y - r.y) * 1.25; if (dx * dx + dy * dy + dz * dz < r.r * r.r) return true; } return false; };
  const poiObjects = [];
  let state = null;

  // Shared resources
  const grain = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = 200 + Math.random() * 55; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const rockGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.75 + Math.random() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6); trunkGeo.translate(0, 1.2, 0);
  const leafGeo = new THREE.ConeGeometry(1.6, 4.2, 7); leafGeo.translate(0, 4.2, 0);
  const meteorGeo = new THREE.DodecahedronGeometry(0.8, 0);
  let terrainMat, rockMat, trunkMat, leafMat, meteorMat;

  // ---------- Height ----------
  function baseHeight(x, z) {
    const f = cfg.freq;
    let h = 0, a = 1, fr = 1, norm = 0;
    for (let o = 0; o < 5; o++) {
      let n = noise(x * f * fr, z * f * fr);
      if (cfg.ridged && o < 2) n = THREE.MathUtils.lerp(n, 1 - 2 * Math.abs(n), cfg.ridged);
      h += n * a; norm += a; a *= 0.5; fr *= 2.03;
    }
    h = (h / norm) * cfg.amp * 2;
    h += noise2(x / 600, z / 600) * cfg.amp * 1.5; // broad hills
    if (cfg.craters) h += craterH(x, z, cfg.craters);
    return h;
  }
  function craterH(x, z, cr) {
    const cx = Math.floor(x / cr.cell), cz = Math.floor(z / cr.cell); let h = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const gx = cx + i, gz = cz + j;
      if (hash2(gx, gz, cfg.seed) > cr.p) continue;
      const px = (gx + hash2(gx, gz, cfg.seed + 1)) * cr.cell, pz = (gz + hash2(gx, gz, cfg.seed + 2)) * cr.cell;
      const R = cr.rmin + Math.pow(hash2(gx, gz, cfg.seed + 3), 2) * (cr.rmax - cr.rmin);
      const d = Math.hypot(x - px, z - pz) / R;
      if (d > 2) continue;
      const rim = 0.12 * R;
      h += d < 1 ? rim + (d * d - 1) * 0.38 * R : rim * Math.exp(-Math.pow((d - 1) / 0.3, 2));
    }
    return h;
  }
  let flats = []; // colony ground (v7): flattened discs
  function height(x, z) {
    const r = Math.hypot(x, z);
    const s = smooth(30, 70, r);
    const pad = cfg.padH ?? 0;
    const b = baseHeight(x, z);
    let h = THREE.MathUtils.lerp(pad + b * 0.15, b, s);
    for (let i = 0; i < flats.length; i++) { const f = flats[i];
      if (f.seg) { // v7.5 highway corridor: flatten to the road's own height along the segment
        if (x < f.minx || x > f.maxx || z < f.minz || z > f.maxz) continue;
        const ex = f.bx - f.ax, ez = f.bz - f.az, L2 = ex * ex + ez * ez, t = L2 ? Math.max(0, Math.min(1, ((x - f.ax) * ex + (z - f.az) * ez) / L2)) : 0, d = Math.hypot(x - f.ax - ex * t, z - f.az - ez * t);
        if (d < f.r2) h = THREE.MathUtils.lerp(f.ya + (f.yb - f.ya) * t, h, smooth(f.r1, f.r2, d)); continue; }
      if (f.ramp) { // v7.5 jump ramp: a wedge rising along (ux,uz), sheer drop at the lip
        const dx = x - f.x, dz = z - f.z, u = dx * f.ux + dz * f.uz + f.len / 2, v = Math.abs(dx * -f.uz + dz * f.ux);
        if (u > 0 && u < f.len && v < f.w / 2) h += f.h * (u / f.len) * Math.min(1, (f.w / 2 - v) * 3); continue; }
      const d = Math.hypot(x - f.x, z - f.z); if (d < f.r2) h = THREE.MathUtils.lerp(f.y, h, smooth(f.r1, f.r2, d)); }
    return h;
  }

  // ---------- Chunks ----------
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler(), tmpC = new THREE.Color();
  function buildChunk(ix, iz) {
    const N = SEG + 1, step = CHUNK / SEG, ox = ix * CHUNK, oz = iz * CHUNK;
    const H = new Float32Array((N + 2) * (N + 2));
    for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) H[(j + 1) * (N + 2) + (i + 1)] = height(ox + i * step, oz + j * step);
    const hAt = (i, j) => H[(j + 1) * (N + 2) + (i + 1)];
    const pos = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
    const nrm = new THREE.Vector3();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = ox + i * step, z = oz + j * step, h = hAt(i, j);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      nrm.set(hAt(i - 1, j) - hAt(i + 1, j), 2 * step, hAt(i, j - 1) - hAt(i, j + 1)).normalize();
      nor[k * 3] = nrm.x; nor[k * 3 + 1] = nrm.y; nor[k * 3 + 2] = nrm.z;
      uv[k * 2] = i / SEG; uv[k * 2 + 1] = j / SEG;
      // color
      const n = noise(x / 9, z / 9) * 0.5 + noise(x / 31, z / 31) * 0.5;
      const t = THREE.MathUtils.clamp(0.5 + h / (cfg.amp * 3.2) + n * 0.25, 0, 1);
      tmpC.copy(cfg.low).lerp(cfg.high, t);
      if (cfg.water !== undefined) {
        if (h < cfg.water + 0.7) tmpC.copy(cfg.sand);
        else if (h > cfg.amp * 2.1) tmpC.copy(cfg.snow);
      }
      surfTint(x, z);
      const steep = smooth(0.92, 0.75, nrm.y);
      tmpC.lerp(cfg.slope, steep * 0.85);
      // baked sun-facing slope shading + hollow darkening + fine mottling: cheap contrast that survives haze
      const sh = cfg.shade ?? 1, lit = Math.max(0, nrm.x * sunDir.x + nrm.y * sunDir.y + nrm.z * sunDir.z), flat = Math.max(0.2, sunDir.y);
      const cav = clamp((hAt(i - 1, j) + hAt(i + 1, j) + hAt(i, j - 1) + hAt(i, j + 1)) * 0.25 - h, -0.5, 0.5);
      tmpC.multiplyScalar(clamp(patchK(x, z) * (1 + (lit - flat) * 0.55 * sh) * (1 - cav * 0.35 * sh) * (1 + noise2(x / 2.7, z / 2.7) * 0.07), 0.45, 1.6));
      col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
    }
    const idx = [];
    for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, terrainMat));

    // Rocks (instanced, shared geometry)
    const nR = cfg.rocksPerChunk;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, nR);
    let placed = 0; const blk = [];
    for (let r = 0; r < nR; r++) {
      const hx = hash2(ix * 131 + r, iz * 71 - r, cfg.seed + 5), hz = hash2(ix * 17 - r, iz * 191 + r, cfg.seed + 6), hs = hash2(ix + r * 7, iz - r * 3, cfg.seed + 7);
      const x = ox + hx * CHUNK, z = oz + hz * CHUNK; const y = height(x, z);
      if (cfg.water !== undefined && y < cfg.water + 0.3) continue;
      if (Math.hypot(x, z) < 14 || Math.hypot(x - 14, z + 22) < 10) continue;
      const sc = 0.2 + Math.pow(hs, 3) * (name === 'Mars' ? 2.2 : 1.8);
      tmpS.set(sc * (0.8 + hx * 0.6), sc * (0.6 + hz * 0.6), sc * (0.8 + hs * 0.5));
      tmpE.set(hx * 3, hz * 6.28, hs * 2); tmpQ.setFromEuler(tmpE); tmpP.set(x, y + sc * 0.2, z);
      rocks.setMatrixAt(placed, tmpM.compose(tmpP, tmpQ, tmpS)); if (sc > 0.5) blk.push({ x, z, y: y + sc * 0.2, r: sc * 1.25 + 0.3 });
      rocks.setColorAt(placed, tmpC.copy(cfg.rock).multiplyScalar(0.75 + hs * 0.5));
      placed++;
    }
    rockBlk.set(`${ix},${iz}`, blk); rocks.count = placed; rocks.instanceMatrix.needsUpdate = true; if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();
    group.add(rocks);

    // Trees (Earth)
    if (cfg.trees) {
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, cfg.trees), leaves = new THREE.InstancedMesh(leafGeo, leafMat, cfg.trees);
      let tp = 0;
      for (let r = 0; r < cfg.trees; r++) {
        const hx = hash2(ix * 37 + r, iz * 53 + r * 3, 99), hz = hash2(ix * 61 - r, iz * 29 + r, 98), hs = hash2(ix + r, iz + r * 5, 97);
        const x = ox + hx * CHUNK, z = oz + hz * CHUNK, y = height(x, z);
        if (y < cfg.water + 1.2 || y > cfg.amp * 1.9 || Math.hypot(x, z) < 16 || Math.hypot(x - 14, z + 22) < 12) continue;
        if (noise(x / 70, z / 70) < -0.15) continue; // clearings
        const sc = 0.8 + hs * 0.9;
        tmpQ.setFromEuler(tmpE.set(0, hs * 6.28, 0)); tmpS.set(sc, sc, sc); tmpP.set(x, y - 0.1, z);
        tmpM.compose(tmpP, tmpQ, tmpS); trunks.setMatrixAt(tp, tmpM); leaves.setMatrixAt(tp, tmpM);
        leaves.setColorAt(tp, tmpC.setHSL(0.27 + hs * 0.06, 0.45, 0.22 + hx * 0.1));
        tp++;
      }
      trunks.count = leaves.count = tp; trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      trunks.computeBoundingSphere(); leaves.computeBoundingSphere();
      group.add(trunks, leaves);
    }

    // Occasional meteorite / curiosity to find
    const chunkPois = [];
    if (hash2(ix, iz, cfg.seed + 9) < 0.18 && Math.hypot(ix, iz) > 0) {
      const x = ox + (0.25 + hash2(ix, iz, 3) * 0.5) * CHUNK, z = oz + (0.25 + hash2(ix, iz, 4) * 0.5) * CHUNK, y = height(x, z);
      if (!(cfg.water !== undefined && y < cfg.water + 0.5)) {
        const m = new THREE.Mesh(meteorGeo, meteorMat); m.position.set(x, y + 0.4, z); m.rotation.set(1, 2, 3);
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color: 0x7fd4ff }));
        beacon.position.y = 1.6; m.add(beacon);
        const fi = Math.floor(hash2(ix, iz, 5) * cfg.facts.length);
        m.userData = { poi: true, name: 'Curious rock', fact: cfg.facts[fi], beacon };
        group.add(m); poiObjects.push(m); chunkPois.push(m);
      }
    }
    const rare = game.rareFor(ix, iz, CHUNK);
    if (rare) group.add(rare);
    scene.add(group);
    return { group, pois: chunkPois, geo, rare };
  }
  function disposeChunk(c) {
    scene.remove(c.group);
    c.geo.dispose();
    c.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    if (c.rare) c.rare.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
    c.pois.forEach(p => { const i = poiObjects.indexOf(p); if (i >= 0) poiObjects.splice(i, 1); p.userData.beacon?.geometry.dispose(); p.userData.beacon?.material.dispose(); });
  }
  // Europa cracks, Io sulfur/lava spots
  // large light/dark patches (lava plains, dust, ice) so the ground never reads as one flat color
  function patchK(x, z) { return 1 + noise2(x / 70 + 11, z / 70 - 5) * (cfg.patch ?? 0.16) + noise(x / 23 - 4, z / 23 + 9) * 0.06; }
  function surfTint(x, z) {
    if (cfg.cracks) { const c = 1 - Math.abs(noise(x / 55, z / 55)), c2 = 1 - Math.abs(noise2(x / 23 + 7, z / 23)); tmpC.lerp(cfg.cracks, Math.max(smooth(0.955, 0.988, c), smooth(0.97, 0.992, c2) * 0.8)); }
    if (cfg.spots) { const n2 = noise2(x / 40, z / 40); if (n2 > 0.5) tmpC.lerp(cfg.spots.color, smooth(0.5, 0.7, n2) * 0.85); const n3 = noise(x / 17 + 3, z / 17); if (n3 > 0.7) tmpC.lerp(cfg.spots.hot, smooth(0.7, 0.9, n3) * 0.7); }
  }
  function updateChunks(px, pz, force, perFrame = 1) {
    const cx = Math.floor(px / CHUNK), cz = Math.floor(pz / CHUNK);
    const want = new Set();
    for (let j = -RADIUS; j <= RADIUS; j++) for (let i = -RADIUS; i <= RADIUS; i++) want.add(`${cx + i},${cz + j}`);
    for (const [k, c] of chunks) if (!want.has(k)) { disposeChunk(c); chunks.delete(k); rockBlk.delete(k); }
    // build nearest missing first; limit per frame to avoid hitches
    const missing = [...want].filter(k => !chunks.has(k)).map(k => k.split(',').map(Number))
      .sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
    let budget = force ? Infinity : perFrame;
    for (const [i, j] of missing) { if (budget-- <= 0) break; chunks.set(`${i},${j}`, buildChunk(i, j)); }
  }

  // ---------- Sky ----------
  let skyGroup = null, waterMesh = null, sunDir = new THREE.Vector3();
  function makeGlow(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, inner); r.addColorStop(0.18, inner); r.addColorStop(0.32, outer); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function buildSky() {
    skyGroup = new THREE.Group(); skyGroup.scale.setScalar(3); scene.add(skyGroup);
    sunDir.set(0.6, cfg.sunElev, -0.8).normalize();
    if (cfg.sky === 'space') {
      scene.background = new THREE.Color(0x000000);
      const n = isMobile ? 1500 : 3000, p = new Float32Array(n * 3), v = new THREE.Vector3();
      for (let i = 0; i < n; i++) { v.randomDirection(); if (v.y < -0.1) v.y = -v.y; v.multiplyScalar(500); p.set([v.x, v.y, v.z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      skyGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false })));
    } else {
      const geo = new THREE.SphereGeometry(550, 32, 16);
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(cfg.top) }, horizon: { value: new THREE.Color(cfg.horizon) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float t = pow(clamp(vP.y,0.0,1.0),0.55); gl_FragColor = vec4(mix(horizon, top, t), 1.0);\n#include <colorspace_fragment>\n}'
      });
      skyGroup.add(new THREE.Mesh(geo, mat));
      scene.background = new THREE.Color(cfg.horizon);
    }
    if (cfg.sunSize) {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow('rgba(255,255,245,1)', 'rgba(255,200,120,0.35)'), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
      sun.position.copy(sunDir).multiplyScalar(480); sun.scale.setScalar(cfg.sunSize * 2.4); skyGroup.add(sun);
    }
    if (cfg.planetInSky && textures[cfg.planetInSky.tex]) {
      const P = cfg.planetInSky, e = new THREE.Mesh(new THREE.SphereGeometry(P.size, 40, 28), new THREE.MeshStandardMaterial({ map: textures[P.tex], fog: false, roughness: 1 }));
      e.position.set(...P.pos); e.rotation.z = 0.05; e.userData.spin = true; skyGroup.add(e);
    }
    if (cfg.earthInSky) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 32), new THREE.MeshStandardMaterial({ map: textures.earth, fog: false, roughness: 1 }));
      e.position.set(-200, 170, -380); e.userData.spin = true; skyGroup.add(e);
    }
    const f = cfg.fog;
    scene.fog = f.type === 'exp2' ? new THREE.FogExp2(f.color, f.density) : new THREE.Fog(f.color, f.near, Math.min(f.far, (RADIUS + 0.5) * CHUNK));
    const dl = new THREE.DirectionalLight(cfg.lightColor ?? 0xffffff, cfg.light); dl.position.copy(sunDir).multiplyScalar(100); scene.add(dl); scene.add(dl.target);
    scene.add(new THREE.HemisphereLight(cfg.hemi[0], cfg.hemi[1], cfg.ambient * 2));
    if (cfg.water !== undefined) {
      waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshStandardMaterial({ color: cfg.liquid ?? 0x2a6aa8, roughness: cfg.liquid ? 0.05 : 0.15, metalness: 0.1, transparent: true, opacity: cfg.liquid ? 0.94 : 0.88 }));
      waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.y = cfg.water; scene.add(waterMesh);
    }
  }

  // ---------- Points of interest near the landing site ----------
  // no env map on the surface, so keep metalness low or metals render black
  const metal = (c, m = 0.5, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, metalness: Math.min(m, 0.25), roughness: Math.max(r, 0.45) });
  function place(obj, x, z, info, yOff = 0) {
    obj.position.set(x, height(x, z) + yOff, z); obj.userData = { poi: true, ...info }; scene.add(obj); poiObjects.push(obj); return obj;
  }
  function buildRocket() {
    const { group, flames } = buildStarship({ legs: true, seg: isMobile ? 22 : 30 });
    group.userData.flames = flames; return group;
  }
  function buildFlag() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), metal(0xcccccc, 0.8, 0.3)); pole.position.y = 1.5; g.add(pole);
    const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d');
    for (let i = 0; i < 7; i++) { x.fillStyle = i % 2 ? '#fff' : '#c8102e'; x.fillRect(0, i * 64 / 7, 96, 64 / 7 + 1); }
    x.fillStyle = '#0a3161'; x.fillRect(0, 0, 40, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.position.set(0.77, 2.45, 0); g.add(cloth);
    return g;
  }
  function buildLander() {
    const g = new THREE.Group(), gold = metal(0xd4a23a, 0.85, 0.35), grey = metal(0xb8b8b8, 0.4, 0.6), dark = metal(0x333333, 0.3, 0.7);
    const desc = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.6, 8), gold); desc.position.y = 1.8; g.add(desc);
    const asc = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.2), grey); asc.position.y = 3.5; g.add(asc);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.1), dark); win.position.set(0, 3.7, 1.12); g.add(win);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), grey); leg.position.set(Math.cos(a) * 2.4, 1, Math.sin(a) * 2.4); leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(leg); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.1, 10), grey); pad.position.set(Math.cos(a) * 2.9, 0.05, Math.sin(a) * 2.9); g.add(pad); }
    return g;
  }
  function buildRover() {
    const g = new THREE.Group(), white = metal(0xe8e8e8, 0.3, 0.6), dark = metal(0x2a2a2a, 0.2, 0.8), gold = metal(0xc89a40, 0.8, 0.4);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 3), white); body.position.y = 1.2; g.add(body);
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8), dark); rtg.rotation.x = 1.1; rtg.position.set(0, 1.5, -1.7); g.add(rtg);
    for (let s = -1; s <= 1; s += 2) for (let k = -1; k <= 1; k++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12), dark); w.rotation.z = Math.PI / 2; w.position.set(s * 1.2, 0.4, k * 1.15); g.add(w); }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), white); mast.position.set(0.6, 2.3, 1.2); g.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.3), white); head.position.set(0.6, 3.2, 1.25); g.add(head);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), gold); eye.position.set(0.6, 3.2, 1.42); g.add(eye);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.4), white); arm.position.set(-0.6, 1.1, 2.1); g.add(arm);
    return g;
  }
  function buildVenera() {
    const g = new THREE.Group(), m = metal(0x9a9a9a, 0.7, 0.4), d = metal(0x555555, 0.5, 0.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.25, 8, 20), d); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 12), m); body.position.y = 1.0; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), m); top.position.y = 2.1; g.add(top);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 16), d); disc.position.y = 2.9; g.add(disc);
    return g;
  }
  function buildProbe() {
    const g = new THREE.Group(), gold = metal(0xc8a050, 0.8, 0.4), panel = metal(0x1a2a5a, 0.6, 0.3);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.2), gold); b.position.y = 0.5; b.rotation.set(0.3, 0.4, 0.2); g.add(b);
    const p = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1), panel); p.position.set(1.8, 0.3, 0.2); p.rotation.z = -0.25; g.add(p);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, 1.1), metal(0xdddddd, 0.5, 0.5)); dish.position.set(-0.6, 1.2, 0); dish.rotation.z = 0.9; g.add(dish);
    return g;
  }
  function buildSign(text = 'WELCOME HOME') {
    const g = new THREE.Group(), wood = metal(0x7a5230, 0, 0.9);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), wood); post.position.y = 1.1; g.add(post);
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#a7743f'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#2b1a0c'; x.font = `bold ${text.length > 12 ? 32 : 40}px system-ui, sans-serif`; x.textAlign = 'center'; x.fillText(text, 128, 62);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 0.08), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: t }), new THREE.MeshStandardMaterial({ map: t })]);
    board.position.y = 1.9; g.add(board); return g;
  }
  const builders = { lander: buildLander, rover: buildRover, venera: buildVenera, probe: buildProbe, sign: buildSign };

  // ---------- Player, camera, companions ----------
  const player = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: -0.05, grounded: false, walked: 0, bob: 0, moving: 0, moveYaw: 0, faceYaw: 0 };
  const VIEW_KEY = 'ssx.view.v1', CAM_MAX = 320, SHIP = { x: 14, z: -22 };
  const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
  const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);
  // on-foot and rover views are remembered separately; the rover defaults to the third-person chase cam
  const ROVER_VIEW_KEY = 'ssx.view.rover.v1', FP_DRIVE_PITCH = -0.07;
  const loadNum = (k, d) => { try { const v = parseFloat(localStorage.getItem(k)); return isFinite(v) ? clamp(v, 0, CAM_MAX) : d; } catch (e) { return d; } };
  let camGoal = loadNum(VIEW_KEY, 9), driveGoal = loadNum(ROVER_VIEW_KEY, 16);
  let duelYaw = null;
  let camDist = camGoal, walkGoal = camGoal, viewYaw = 0, camYawS = null, camYawOff = 0, lastLook = -9, time = 0, driven = 0;
  let indoor = null, hiddenOut = [];
  let car = null, astro = null, dog = null, rover = null, dust = null, farMesh = null, farCenter = null, baseFog = null, driving = false;
  let found = loadFound(), discItems = [];
  const saveView = () => { if (driving) driveGoal = camGoal; try { localStorage.setItem(driving ? ROVER_VIEW_KEY : VIEW_KEY, String(camGoal)); } catch (e) { /* ignore */ } };

  // discoveries
  const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 90, 8, 1, true); beamGeo.translate(0, 45, 0);
  const beamOn = new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beamOff = new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const glintMat = new THREE.SpriteMaterial({ map: makeGlow('rgba(255,240,190,1)', 'rgba(255,190,60,0.45)'), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
  const isFound = id => !!found[name]?.includes(id);
  function discCount() { const l = DISCOVERIES[name] || []; return { found: l.filter(d => isFound(d.id)).length, total: l.length }; }
  // a spot at compass angle a (deg) and distance d from the landing site, nudged out of any water
  function safePoint(aDeg, d0) {
    let a = aDeg * Math.PI / 180, dist = d0, x = 0, z = 0;
    for (let k = 0; k < 30; k++) {
      x = Math.sin(a) * dist; z = -Math.cos(a) * dist;
      if (cfg.water === undefined || height(x, z) > cfg.water + 1.2) break;
      dist += 15; if (k % 6 === 5) { a += 0.45; dist = d0; }
    }
    return { x, z };
  }
  function placeDiscoveries() {
    found = loadFound(); discItems = [];
    for (const d of DISCOVERIES[name] || []) {
      const { x, z } = safePoint(d.a, d.d);
      const y0 = height(x, z);
      const obj = DISCOVERY_BUILDERS[d.kind]((dx, dz) => height(x + dx, z + dz) - y0);
      obj.position.set(x, y0, z);
      Object.assign(obj.userData, { poi: true, disc: d.id, name: d.name, fact: d.fact });
      scene.add(obj); poiObjects.push(obj);
      const beacon = new THREE.Group(); beacon.position.set(x, y0, z);
      const beam = new THREE.Mesh(beamGeo, beamOn); beam.frustumCulled = false; beacon.add(beam);
      const glint = new THREE.Sprite(glintMat); glint.position.y = (obj.userData.beaconY ?? 4) + 2; glint.scale.setScalar(4); beacon.add(glint);
      scene.add(beacon);
      const it = { d, obj, beacon, beam, glint, x, z, reach: d.reach ?? 10 };
      setBeacon(it, isFound(d.id)); discItems.push(it);
    }
  }
  function setBeacon(it, f) { it.beam.material = f ? beamOff : beamOn; it.glint.visible = !f; }
  function discover(it, how) {
    if (isFound(it.d.id)) return false;
    (found[name] ||= []).push(it.d.id); saveFound(found); setBeacon(it, true);
    game.onDiscover();
    const c = discCount();
    onEvent('discover', { id: it.d.id, name: it.d.name, fact: it.d.fact, world: name, found: c.found, total: c.total, how });
    return true;
  }
  function nearestUndiscovered(px, pz) {
    let best = null, bd = 1e9;
    for (const it of discItems) { if (isFound(it.d.id)) continue; const d = Math.hypot(it.x - px, it.z - pz); if (d < bd) { bd = d; best = it; } }
    return best ? { it: best, dist: bd } : null;
  }
  const relDir = a => { a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) < 0.4 ? 'ahead' : Math.abs(a) > 2.5 ? 'behind you' : a > 0 ? 'to your left' : 'to your right'; };

  // far, low-detail terrain for high camera views; the shader cuts a hole where detailed chunks exist
  const nearHole = { value: new THREE.Vector3(0, 0, 0) };
  function buildFar(cx, cz) {
    if (farMesh) { scene.remove(farMesh); farMesh.geometry.dispose(); }
    const N = isMobile ? 64 : 88, SIZE = 1500, step = SIZE / N, n1 = N + 1;
    const pos = new Float32Array(n1 * n1 * 3), col = new Float32Array(n1 * n1 * 3), idx = [];
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
      const k = j * n1 + i, x = cx - SIZE / 2 + i * step, z = cz - SIZE / 2 + j * step, h = height(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = h - 0.4; pos[k * 3 + 2] = z;
      const n = noise(x / 31, z / 31) * 0.5;
      tmpC.copy(cfg.low).lerp(cfg.high, clamp(0.5 + h / (cfg.amp * 3.2) + n * 0.25, 0, 1));
      if (cfg.water !== undefined) { if (h < cfg.water + 0.7) tmpC.copy(cfg.sand); else if (h > cfg.amp * 2.1) tmpC.copy(cfg.snow); }
      surfTint(x, z); tmpC.multiplyScalar(patchK(x, z));
      col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    if (!farMesh) {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
      m.onBeforeCompile = sh => {
        sh.uniforms.uHole = nearHole;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;\nuniform vec3 uHole;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vWXZ.x - uHole.x) < uHole.z && abs(vWXZ.y - uHole.y) < uHole.z) discard;');
      };
      farMesh = new THREE.Mesh(geo, m);
    } else farMesh.geometry = geo;
    scene.add(farMesh); farCenter = { x: cx, z: cz };
  }

  // rover dust
  function makeDust() {
    const N = 160, pos = new Float32Array(N * 3), col = new Float32Array(N * 4), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const rg = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, depthWrite: false }));
    pts.frustumCulled = false; scene.add(pts);
    const tint = cfg.high.clone().lerp(new THREE.Color(0xffffff), 0.25);
    return { pts, N, life: new Float32Array(N), max: new Float32Array(N), vel: new Float32Array(N * 3), next: 0, acc: 0, tint, airless: cfg.sky === 'space' };
  }
  function spawnDust(x, y, z, vx, vy, vz) {
    const d = dust, i = d.next; d.next = (i + 1) % d.N;
    const p = d.pts.geometry.attributes.position.array; p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    d.vel[i * 3] = vx; d.vel[i * 3 + 1] = vy; d.vel[i * 3 + 2] = vz; d.life[i] = d.max[i] = d.airless ? 2.2 : 1.6;
  }
  function updateDust(dt, g) {
    const d = dust, p = d.pts.geometry.attributes.position.array, c = d.pts.geometry.attributes.color.array;
    for (let i = 0; i < d.N; i++) {
      if (d.life[i] <= 0) { c[i * 4 + 3] = 0; continue; }
      d.life[i] -= dt;
      if (d.airless) d.vel[i * 3 + 1] -= g * dt; // vacuum: dust flies in clean ballistic arcs
      else { const k = Math.exp(-dt * 2.2); d.vel[i * 3] *= k; d.vel[i * 3 + 1] = d.vel[i * 3 + 1] * k - 0.4 * dt; d.vel[i * 3 + 2] *= k; }
      p[i * 3] += d.vel[i * 3] * dt; p[i * 3 + 1] += d.vel[i * 3 + 1] * dt; p[i * 3 + 2] += d.vel[i * 3 + 2] * dt;
      const gh = height(p[i * 3], p[i * 3 + 2]); if (p[i * 3 + 1] < gh) { p[i * 3 + 1] = gh; d.vel[i * 3] *= 0.3; d.vel[i * 3 + 1] = 0; d.vel[i * 3 + 2] *= 0.3; }
      c[i * 4] = d.tint.r; c[i * 4 + 1] = d.tint.g; c[i * 4 + 2] = d.tint.b; c[i * 4 + 3] = Math.max(0, d.life[i] / d.max[i]) * 0.55;
    }
    d.pts.geometry.attributes.position.needsUpdate = true; d.pts.geometry.attributes.color.needsUpdate = true;
  }

  // v6 game layer: quests, aliens, blasters, rewards (see game.js)
  // v7 world layer: colonies, NPCs, parked vehicles, wanted level (see world.js)
  const world = createWorld({
    scene, height: (x, z) => height(x, z), player, onEvent, isMobile, game: () => game,
    st: () => ({ driving, car, ownRover: rover })
  });
  const gameEvent = (t, d) => { if (t === 'zap' && (!driving || car !== rover)) world.shotFired(); onEvent(t, d); };
  const game = createGame({
    scene, camera, isMobile, onEvent: gameEvent, height: (x, z) => height(x, z), player, SHIP, safePoint,
    st: () => ({ name, cfg, driving, rover: driving ? car : rover, ownRover: rover, own: !driving || car === rover, dog, camDist, intro: state?.intro ?? 0, outro: state?.outro ?? 0, inside: indoor ? world.inside : null }),
    doorFor: q => world.doorFor(q), enterBuilding: () => enterBuilding(), leaveBuilding: () => leaveBuilding(),
    hitWorld: (p0, p1, b) => world.hitWorld(p0, p1, b), blastWorld: (c, R, d, emp) => world.blast(c, R, d, emp), worldTargets: () => world.targets(), meleeTarget: (x, z, y, r) => world.meleeTarget(x, z, y, r), meleeWorld: (...a) => world.meleeWorld(...a), solidAt: (x, y, z) => world.solidAt(x, y, z), allowFire: () => world.allowFire(),
    colonyAt: p => world.colonyAt(p), nearestVehicle: () => world.nearestVehicle(), vehicle: () => driving ? { kind: car.kind || 'rover', stolen: car !== rover } : null,
    wanted: () => world.wanted, setWanted: (n, why) => world.setWanted(n, why),
    coverNear: (x, z, px, pz, r) => world.coverNear?.(x, z, px, pz, r), collide: (x, z, r) => world.collide?.(x, z, r), freeSpot: (x, z, r) => world.freeSpot?.(x, z, r), civHits: () => world.civHits || 0, caseCamera: id => world.caseCamera?.(id), npcRefresh: () => world.npcRefresh?.(), // v7.5 city
    respawn(why) {
      if (indoor) leaveBuilding(true);
      if (driving) interact();
      world.onRespawn(why);
      const gp = why === 'busted' ? world.gate() : null;
      const x = gp ? gp.x : SHIP.x - 10, z = gp ? gp.z : SHIP.z + 12;
      player.x = x; player.z = z; player.y = height(x, z) + EYE; player.vy = 0; player.yaw = 0.6; player.faceYaw = 0.6;
      if (dog) { dog.mode = 'follow'; dog.x = x + 1.5; dog.z = z + 1.5; dog.y = height(dog.x, dog.z); }
      updateChunks(x, z, true);
    },
    dogAlert(x, z) {
      if (!dog) return;
      dog.wag = 1.5;
      if (!driving) { if (dog.mode === 'sniff') { dog.mode = 'follow'; dog.nextSniff = 15; } dog.yaw = Math.atan2(-(x - dog.x), -(z - dog.z)); dog.idle = 0; if (!dog.air) dog.vy = 2.6; }
      onEvent('bark', { warn: true });
    }
  });
  function enter(bodyName) {
    cfg = BODIES[bodyName]; name = bodyName;
    noise = makeNoise(cfg.seed); noise2 = makeNoise(cfg.seed * 7 + 3);
    terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.95, metalness: 0 });
    rockMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });
    leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    meteorMat = new THREE.MeshStandardMaterial({ color: 0x2b2522, metalness: 0.7, roughness: 0.4, flatShading: true, emissive: 0x112233 });
    buildSky();
    const f = cfg.fog; baseFog = f.type === 'exp2' ? { density: f.density } : { near: f.near, far: scene.fog.far };
    // landing site
    const ship = place(buildRocket(), SHIP.x, SHIP.z, { name: 'Your Starship', fact: 'Your ride home: a stainless-steel, fully reusable-style starship standing about 50 m tall on six landing legs. Tap Take off (or press T) to return to orbit.' }); ship.rotation.y = 0.5;
    const flag = place(buildFlag(), -6, -10, { name: 'Flag', fact: cfg.flagFact }); flag.rotation.y = 0.4;
    const special = place(builders[cfg.poi.kind](cfg.poi.sign), -14, -27, { name: cfg.poi.name, fact: cfg.poi.fact }); special.rotation.y = -0.6;
    flats = world.layout(bodyName, safePoint);
    placeDiscoveries();
    // rover
    const rv = buildBuggy(); rv.group.rotation.order = 'YXZ';
    rover = { ...rv, kind: 'rover', spec: VEHICLES.rover, x: -9, z: 0, yaw: 0.5, y: height(-9, 0), vy: 0, speed: 0, steer: 0, pitch: 0, roll: 0, air: false, prevG: null, susp: 0, fuel: 100, jet: 0, jetT: -9, thrusting: false };
    rover.stockParts = rv.body.children.filter(o => o !== rv.seat);
    rover.jets = buildThrusters(rv.body); rover.setKit = (on, paint) => setKit(rover, on, paint);
    Object.assign(rv.group.userData, { poi: true, rover: true, name: 'Your rover', fact: 'A six-wheeled pressurized rover with independent suspension and a full light bar. Walk up and tap Drive (or press E). Boost goes faster; low gravity means big hops.' });
    scene.add(rv.group); poiObjects.push(rv.group);
    dust = makeDust();
    // astronaut + dog
    astro = buildAstronaut(); scene.add(astro.group);
    const dg = buildDog({ helmet: bodyName !== 'Earth' }); dg.group.rotation.order = 'YXZ';
    dog = { ...dg, x: 1.6, z: 7.5, y: height(1.6, 7.5), vy: 0, yaw: 0, mode: 'follow', idle: 0, wag: 0, phase: 0, nextSniff: 14, sniff: null, sniffT: 0, air: false, sit: 0 };
    scene.add(dg.group);
    driving = false; car = null; camYawOff = 0; driven = 0; camGoal = loadNum(VIEW_KEY, 9); driveGoal = loadNum(ROVER_VIEW_KEY, 16);
    scene.add(camera); buildCockpit();
    player.x = 0; player.z = 6; player.yaw = 0; player.pitch = -0.08; player.vy = 0; player.walked = 0; player.faceYaw = 0;
    player.y = height(0, 6) + EYE;
    state = { intro: 1.8, outro: 0 };
    world.enter(bodyName);
    game.enter(bodyName);
    updateChunks(player.x, player.z, true);
    camDist = camGoal;
    updateRover(0.016, { keys: {}, joy: { x: 0, y: 0 } }, cfg.g * 9.81); updateDog(0.016, cfg.g * 9.81); updateAstro(0.016); updateCamera(0.016);
  }
  function exit() {
    indoor = null; hiddenOut = [];
    game.exit(); world.exit(); flats = [];
    for (const c of chunks.values()) disposeChunk(c);
    chunks.clear();
    scene.traverse(o => { if (o.isMesh || o.isPoints || o.isSprite) { if (o.geometry && !o.geometry.userData.shared && ![rockGeo, trunkGeo, leafGeo, meteorGeo, beamGeo].includes(o.geometry)) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (!m || m.userData.shared || [beamOn, beamOff, glintMat].includes(m)) return; if (m.map?.userData?.shared) { m.dispose(); return; } if (m.map && m.map !== grain && m.map !== textures.earth) m.map.dispose(); m.dispose(); }); } });
    [terrainMat, rockMat, trunkMat, leafMat, meteorMat].forEach(m => m?.dispose());
    scene.clear(); poiObjects.length = 0; waterMesh = null; skyGroup = null; scene.fog = null;
    farMesh = null; farCenter = null; rover = null; car = null; dog = null; astro = null; dust = null; discItems = []; driving = false;
    cfg = null; state = null;
  }

  function look(dx, dy, k) {
    if (driving) camYawOff -= dx * k; else player.yaw -= dx * k;
    if (dx) lastLook = time;
    player.pitch -= dy * k;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  function readMove(input) {
    if (state.intro > 0 || state.outro > 0) return [0, 0];
    const k = input.keys;
    return [(k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + input.joy.x, (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - input.joy.y];
  }
  function walk(dt, input, g) {
    let [mvx, mvz] = readMove(input);
    const len = Math.hypot(mvx, mvz);
    if (len > 1) { mvx /= len; mvz /= len; }
    const running = input.run;
    const speed = (running ? 9 : 4.2) * (cfg.g < 0.3 ? 0.8 : 1);
    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const dx = (fwd.x * mvz + right.x * mvx) * speed * dt, dz = (fwd.z * mvz + right.z * mvx) * speed * dt;
    player.moving = Math.min(1, len); player.running = running && len > 0.3;
    if (dx || dz) {
      let nx = player.x + dx, nz = player.z + dz;
      const gh = groundAt(nx, nz);
      if (!indoor && cfg.water !== undefined && gh < cfg.water - 0.4) { nx = player.x; nz = player.z; }
      else { player.walked += Math.hypot(dx, dz); player.moveYaw = Math.atan2(-dx, -dz); }
      const c = world.collidePlayer(nx, nz, 0.45); if (c) { nx = c.x; nz = c.z; }
      player.x = nx; player.z = nz;
    }
    const ground = groundAt(player.x, player.z) + EYE;
    if (state.outro > 0) {
      state.outro -= dt; player.vy += 25 * dt; player.y += player.vy * dt;
    } else {
      if (player.grounded && input.jump) { player.vy = 4.2; player.grounded = false; }
      player.vy -= g * dt; player.y += player.vy * dt;
      if (player.y <= ground) { player.y = ground; player.vy = 0; player.grounded = true; }
      else if (player.grounded && player.y - ground < 0.35 && player.vy <= 0) { player.y = ground; }
      else player.grounded = false;
    }
    if (player.grounded && len > 0.05) player.bob += dt * (running ? 13 : 8) * (cfg.g < 0.3 ? 0.6 : 1); else player.bob *= 0.9;
  }

  // ----- v7.2 cold-gas thrusters: four belly pods for lift, two tail nozzles for push -----
  // plume fade: bright at the nozzle (v=0), gone at the tip (v=1); additive, so black = invisible
  const jetFade = (() => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const x = cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#333'); gr.addColorStop(0.9, '#bbb'); gr.addColorStop(1, '#fff'); x.fillStyle = gr; x.fillRect(0, 0, 4, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const jetMat = new THREE.MeshBasicMaterial({ color: 0x6fb8ff, map: jetFade, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const jetCore = new THREE.MeshBasicMaterial({ color: 0xd8f0ff, map: jetFade, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const plumeGeo = (() => { const gg = new THREE.ConeGeometry(0.26, 1.8, 10, 1, true); gg.translate(0, -0.9, 0); gg.rotateX(Math.PI); gg.translate(0, -1.8, 0); return gg; })();
  const coreGeo = (() => { const gg = new THREE.ConeGeometry(0.11, 0.9, 8, 1, true); gg.translate(0, -0.45, 0); gg.rotateX(Math.PI); gg.translate(0, -0.9, 0); return gg; })();
  function buildThrusters(body, bike) {
    const pods = [], dark = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6, metalness: 0.4, flatShading: true }), ring = new THREE.MeshBasicMaterial({ color: 0x5ad0ff });
    const mk = (x, y, z, rear) => {
      const pod = new THREE.Group(); pod.position.set(x, y, z); if (rear) pod.rotation.x = -Math.PI / 2; body.add(pod);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.34, 10), dark); pod.add(h);
      const rg = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 5, 12), ring); rg.rotation.x = Math.PI / 2; rg.position.y = -0.17; pod.add(rg);
      const plume = new THREE.Mesh(plumeGeo, jetMat), core = new THREE.Mesh(coreGeo, jetCore); plume.position.y = -0.17; core.position.y = -0.17; pod.add(plume, core);
      plume.visible = core.visible = false; plume.frustumCulled = core.frustumCulled = false;
      pods.push({ pod, plume, core, rear, ring: rg });
    };
    if (bike) { for (const sz of [-1, 1]) mk(0, 0.25, sz * 0.9, false); mk(0, 0.55, 1.35, true); }
    else { for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(sx * 1.36, 0.86, sz * 2.75, false); for (const sx of [-1, 1]) mk(sx * 0.75, 1.3, 3.12, true); }
    return pods;
  }
  function updateJets(r, dt) {
    if (!r.jets) return;
    const want = r.thrusting ? 1 : 0; r.jet += (want - r.jet) * Math.min(1, dt * (want ? 14 : 8));
    const k = r.jet, flick = 0.85 + Math.random() * 0.3, big = r.kit ? 1.3 : 1;
    for (const j of r.jets) {
      const on = k > 0.03; j.plume.visible = j.core.visible = on; j.ring.material.color.setRGB(0.25 + k * 0.75, 0.6 + k * 0.4, 1);
      if (!on) continue;
      const len = (j.rear ? (0.5 + Math.max(0, r.thrFwd || 0) * 0.9) : 1) * k * flick * big;
      j.plume.scale.set(big * (0.8 + k * 0.4), len, big * (0.8 + k * 0.4)); j.core.scale.set(big, len, big);
    }
    jetMat.opacity = (0.35 + 0.3 * k) * flick; jetCore.opacity = 0.55 + 0.35 * k;
    // blast the ground under you when low
    if (k > 0.3 && dust) { const gh = height(r.x, r.z), alt = r.y - gh; if (alt < 9 && Math.random() < dt * 40 * k * (1 - alt / 9)) { const a = Math.random() * 6.28, d = 1 + Math.random() * 2.5; spawnDust(r.x + Math.cos(a) * d, gh + 0.2, r.z + Math.sin(a) * d, Math.cos(a) * 9, 0.8 + Math.random() * 1.5, Math.sin(a) * 9); } }
  }
  // ----- v7.2 Roadster kit: a low, sleek two-seater shell over the chassis (generic: no badges, no logos) -----
  function setKit(r, on, paint) {
    r.kit = !!on;
    if (on && !r.kitG) {
      const g = new THREE.Group(), W = 2.62;
      const pm = new THREE.MeshStandardMaterial({ color: 0x8a0f14, roughness: 0.22, metalness: 0.65 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.78 });
      const ex = (pts, depth, m) => { const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))); const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }); geo.translate(0, 0, -depth / 2); geo.rotateY(-Math.PI / 2); return new THREE.Mesh(geo, m); };
      g.add(ex([[-3.25, 0.82], [-3.32, 1.05], [-2.7, 1.22], [-1.1, 1.42], [1.4, 1.5], [2.85, 1.56], [3.1, 1.36], [3.08, 0.82]], W, pm));
      const can = ex([[-1.15, 1.42], [-0.15, 1.98], [0.85, 2.02], [1.75, 1.5]], W - 0.7, glass); can.renderOrder = 2; g.add(can);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.05, 0.34), pm); sp.position.set(0, 1.72, 2.92); sp.rotation.x = 0.12; g.add(sp);
      for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0x18181c })); st.position.set(sx * 0.9, 1.62, 2.9); g.add(st); }
      const hd = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff })); hd.position.set(0, 1.08, -3.3); g.add(hd);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2020 })); tl.position.set(0, 1.42, 3.12); g.add(tl);
      const sk = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.22, 5.9), new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.8 })); sk.position.y = 0.92; g.add(sk);
      r.kitG = g; r.kitPaint = pm; r.body.add(g);
    }
    if (r.kitG) { r.kitG.visible = r.kit; if (paint !== undefined && r.kitPaint) r.kitPaint.color.setHex(paint && paint !== 0xb4b9c1 ? paint : 0x8a0f14); }
    for (const o of r.stockParts || []) o.visible = !r.kit;
    r.seat.position.y = r.kit ? 1.15 : 1.45;
    for (const j of r.jets || []) j.pod.scale.setScalar(r.kit ? 1.3 : 1);
  }
  const FUEL_MAX = r => r.kit ? 130 : 100, FUEL_BURN = 20, ALT_CEIL = 70;
  function thrustFuel(r, on, dt) {
    if (r.fuel === undefined) { r.fuel = 100; r.jet = 0; r.jetT = -9; }
    const mx = FUEL_MAX(r);
    if (on) { r.fuel = Math.max(0, r.fuel - FUEL_BURN * dt); r.jetT = time; }
    else if (!r.air && time - r.jetT > 0.6) r.fuel = Math.min(mx, r.fuel + (r.kit ? 34 : 25) * dt);
  }
  const canThrust = r => !!r && (r === rover || r.kind === 'hoverbike');
  // v7.4 barrel rolls: anything you drive that's airborne can roll a full 360. Land it clean for a stunt bonus; land upside down and it hurts.
  const ROLL_T = 0.75; let stuntLog = { rolls: 0, clean: 0, crash: 0, last: null };
  function stunt(r, dt, input, me) {
    let ang = 0;
    if (!me) { r.wasAir = r.air; r.barrel = null; return 0; }
    if (input.roll && r.air && !r.barrel) { r.barrel = { dir: input.roll, t: 0 }; onEvent('roll', { dir: input.roll }); }
    if (r.barrel) {
      r.barrel.t += dt; const p = Math.min(1, r.barrel.t / ROLL_T), e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
      ang = -r.barrel.dir * Math.PI * 2 * e;
      if (p >= 1) { r.rolls = (r.rolls || 0) + 1; stuntLog.rolls++; r.barrel = null; ang = 0; }
    }
    if (r.wasAir && !r.air) { // touchdown
      const p = r.barrel ? r.barrel.t / ROLL_T : 1;
      if (r.barrel && p > 0.22 && p < 0.78) { // on the roof
        r.barrel = null; r.rolls = 0; ang = 0; r.speed *= 0.3; stuntLog.crash++;
        game.hurtPlayer(22, null); onEvent('stunt', { bad: true }); stuntLog.last = 'crash';
      } else {
        if (r.barrel) { r.rolls = (r.rolls || 0) + 1; stuntLog.rolls++; r.barrel = null; ang = 0; }
        if (r.rolls) { const n = r.rolls, bonus = 25 * n * n + (r.kit ? 10 : 0); game.bonus?.(bonus, n); stuntLog.clean++; stuntLog.last = 'clean'; onEvent('stunt', { rolls: n, bonus }); }
        r.rolls = 0;
      }
    }
    r.wasAir = r.air; return ang;
  }
  function updateRover(dt, input, g, r = rover) {
    const sp = r.spec || VEHICLES.rover, me = driving && car === r;
    let thr = 0, st = 0;
    if (me) { [st, thr] = readMove(input); thr = clamp(thr, -1, 1); st = clamp(st, -1, 1); }
    // v7.2: hold Jump (Thrust on touch, Space on keys) for cold-gas lift; works on your rover and on a stolen hover bike
    const wantThr = me && canThrust(r) && !!input.jump && state.intro <= 0 && r.fuel > 0.5;
    r.thrusting = wantThr; r.thrFwd = me ? thr : 0; thrustFuel(r, wantThr, dt);
    const boost = me && input.run, vmax = boost ? sp.boost : sp.vmax, grip = r.air ? (wantThr ? 0.65 : 0.22) : 1;
    if (me) { r.boosting = !!boost; r.vcap = vmax; } // v7.3: every drivable vehicle boosts (per-vehicle boost top speed in VEHICLES)
    if (thr * r.speed < -0.1) r.speed += thr * 26 * dt * grip;
    else if (Math.abs(thr) > 0.05) r.speed += thr * (boost ? sp.bacc : sp.acc) * dt * grip;
    else r.speed -= Math.sign(r.speed) * Math.min(Math.abs(r.speed), 5 * dt * grip);
    if (r.speed > vmax) r.speed = Math.max(vmax, r.speed - 10 * dt);
    r.speed = Math.max(r.speed, -7);
    r.steer += (st - r.steer) * Math.min(1, dt * 8);
    const as = Math.abs(r.speed);
    if (!r.air) r.yaw -= r.steer * sp.turn * Math.min(1, as / 4) * (1 - 0.45 * Math.min(1, as / 30)) * Math.sign(r.speed || 1) * dt;
    else r.yaw -= r.steer * (sp.airTurn || 1.5) * (wantThr ? 1.25 : 1) * dt; // v7.2 air control: yaw with the stick, at any speed
    const nx = r.x - Math.sin(r.yaw) * r.speed * dt, nz = r.z - Math.cos(r.yaw) * r.speed * dt;
    if (cfg.water !== undefined && !sp.amphibious && height(nx, nz) < cfg.water - 0.3) r.speed *= -0.2; // v7.4: spec.amphibious rides on the sea
    else {
      const c = world.collide(nx, nz, sp.r * 0.75, r);
      if (c) { if (Math.abs(r.speed) > 9 && me) { onEvent('crash', { speed: Math.abs(r.speed) }); if (Math.abs(r.speed) > 16) game.hurtPlayer(Math.abs(r.speed) * 0.6, null); } r.speed *= -0.25; }
      else { driven += Math.hypot(nx - r.x, nz - r.z); r.x = nx; r.z = nz; }
    }
    if (sp.hover) { // hover vehicles: ride a cushion above the ground, lean into turns
      if (wantThr && !r.jets && r.body) r.jets = buildThrusters(r.body, true);
      r.lift = Math.max(0, Math.min(18, (r.lift || 0) + (wantThr ? 7 : -5) * dt)); r.air = r.lift > 0.6; updateJets(r, dt);
      const gh = sp.amphibious && cfg.water !== undefined ? Math.max(height(r.x, r.z), cfg.water) : height(r.x, r.z), want = gh + sp.hover + r.lift + Math.sin(time * 3) * 0.08;
      r.y += (Math.max(want, gh + 0.4) - r.y) * Math.min(1, dt * 6); r.vy = 0; r.prevG = gh;
      const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
      const tp = Math.atan2(height(r.x + fx * 2.5, r.z + fz * 2.5) - height(r.x - fx * 2.5, r.z - fz * 2.5), 5) * 0.6;
      r.pitch += ((r.air ? -thr * 0.15 : tp) - r.pitch) * Math.min(1, dt * 4); r.roll += (-r.steer * (sp.lean || 0.15) * (r.air ? 1.2 : Math.min(1, as / 10)) - r.roll) * Math.min(1, dt * 5);
      const bang = stunt(r, dt, input, me);
      r.group.position.set(r.x, r.y, r.z); r.group.rotation.set(r.pitch, r.yaw, r.roll + bang);
      if (dust && as > 4 && Math.random() < dt * as * 1.5) spawnDust(r.x + (Math.random() - 0.5) * 2, gh + 0.2, r.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6, 1 + Math.random() * 2, (Math.random() - 0.5) * 6);
      return;
    }
    const gH = height(r.x, r.z);
    if (r.prevG === null) r.prevG = gH;
    const gv = (gH - r.prevG) / Math.max(dt, 1e-3); r.prevG = gH;
    if (wantThr) { const alt = r.y - gH, fade = clamp((ALT_CEIL - alt) / 10, 0, 1); r.vy += (g + clamp((6 - r.vy) * 2.6, -g * 0.7, 15)) * fade * dt + g * (1 - fade) * dt * 0.98; }
    r.vy -= g * dt; r.y += r.vy * dt;
    if (r.y <= gH) { if (r.vy < -2.5) r.susp = Math.min(0.45, -r.vy * 0.04);
      if (me && r.vy < -13) { onEvent('crash', { speed: -r.vy }); if (r.vy < -17) game.hurtPlayer((-r.vy - 17) * 2, null); }
      r.y = gH; r.vy = Math.min(Math.max(r.vy, gv), 14); r.air = false; }
    else r.air = r.y - gH > 0.25;
    const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw), rx = Math.cos(r.yaw), rz = -Math.sin(r.yaw);
    if (!r.air) {
      const tp = Math.atan2(height(r.x + fx * 2.1, r.z + fz * 2.1) - height(r.x - fx * 2.1, r.z - fz * 2.1), 4.2);
      const tr = Math.atan2(height(r.x + rx * 1.55, r.z + rz * 1.55) - height(r.x - rx * 1.55, r.z - rz * 1.55), 3.1);
      r.pitch += (tp - r.pitch) * Math.min(1, dt * 10); r.roll += (tr - r.roll) * Math.min(1, dt * 10);
    } else { // v7.2: bank into air turns, stick forward/back noses down/up a little
      r.pitch += (clamp(r.vy * 0.025 - thr * 0.2, -0.4, 0.4) - r.pitch) * Math.min(1, dt * 3);
      r.roll += (-r.steer * 0.42 - r.roll) * Math.min(1, dt * 4);
    }
    updateJets(r, dt);
    r.susp *= Math.exp(-dt * 6);
    const bang = stunt(r, dt, input, me);
    r.group.position.set(r.x, r.y, r.z); r.group.rotation.set(r.pitch, r.yaw, r.roll + bang);
    r.body.position.y = -r.susp + (r.air ? 0.06 : Math.sin(time * 31) * 0.012 * Math.min(1, as / 17));
    for (const w of r.wheels) {
      const wx = r.x + rx * w.x - fx * w.z, wz = r.z + rz * w.x - fz * w.z;
      const expected = r.y + (-w.z) * Math.sin(r.pitch) + w.x * Math.sin(r.roll);
      const off = r.air ? -0.22 : clamp(height(wx, wz) - expected, -0.3, 0.3);
      w.pivot.position.y += (sp.wy + off - w.pivot.position.y) * Math.min(1, dt * 18);
      w.spin.rotation.x -= r.speed * dt / sp.wr;
      if (w.front) w.pivot.rotation.y = -r.steer * 0.38; else if (w.z > 1) w.pivot.rotation.y = r.steer * 0.12;
    }
    // dust from the rear wheels
    if (!r.air && as > 2.5 && dust) {
      r.dustAcc = (r.dustAcc || 0) + as * dt * (cfg.trees ? 1.2 : 2.6);
      while (r.dustAcc >= 1) {
        r.dustAcc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1, bx = r.x + rx * side * 1.55 - fx * 2.3, bz = r.z + rz * side * 1.55 - fz * 2.3;
        const back = -Math.sign(r.speed) * (0.2 + Math.random() * 0.25) * as;
        spawnDust(bx + (Math.random() - 0.5) * 0.6, height(bx, bz) + 0.25, bz + (Math.random() - 0.5) * 0.6,
          fx * back + (Math.random() - 0.5) * 2 + rx * side * 0.8, 1.2 + Math.random() * 2.2 * (dust.airless ? 1.6 : 1), fz * back + (Math.random() - 0.5) * 2 + rz * side * 0.8);
      }
    }
  }

  const seatW = new THREE.Vector3();
  function updateDog(dt, g) {
    const d = dog, P = d.parts; d.wag = Math.max(0, d.wag - dt);
    let v = 0;
    if (driving) {
      d.mode = 'ride'; car.group.updateMatrixWorld(true); car.seat.getWorldPosition(seatW);
      d.x = seatW.x; d.z = seatW.z; d.y = seatW.y; d.vy = 0; d.air = false;
      d.group.position.copy(seatW); d.group.rotation.set(car.pitch, car.yaw, car.roll); d.yaw = car.yaw; d.sit = 1;
    } else {
      if (d.mode === 'ride') { d.mode = 'follow'; d.x = player.x + Math.cos(player.yaw) * 1.4; d.z = player.z - Math.sin(player.yaw) * 1.4; d.y = height(d.x, d.z) + 0.8; d.vy = 0; d.idle = 0; }
      const fxp = -Math.sin(player.yaw), fzp = -Math.cos(player.yaw), rxp = Math.cos(player.yaw), rzp = -Math.sin(player.yaw);
      let tx = player.x + rxp * 1.3 - fxp * 1.0, tz = player.z + rzp * 1.3 - fzp * 1.0, stopAt = 0.7;
      if (d.mode === 'sniff' && d.sniff) {
        tx = d.sniff.x; tz = d.sniff.z; stopAt = 0.8;
        if (Math.hypot(player.x - d.x, player.z - d.z) > 14 || player.running || d.sniff.done()) { d.mode = 'follow'; d.nextSniff = Math.max(d.nextSniff, 8); } // v7.3 (playtest m3): keep up
      }
      const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz);
      if (dist > 60 && d.mode === 'follow') { d.x = tx; d.z = tz; d.y = height(tx, tz); }
      else if (dist > stopAt) {
        v = Math.min(d.mode === 'sniff' ? 7 : 10, dist * 2.2);
        const ox = d.x, oz = d.z; d.x += dx / dist * v * dt; d.z += dz / dist * v * dt;
        if (cfg.water !== undefined && height(d.x, d.z) < cfg.water - 0.1) { d.x = ox; d.z = oz; v = 0; }
        d.yaw = lerpAngle(d.yaw, Math.atan2(-dx, -dz), dt * 8);
      } else if (d.mode === 'sniff') {
        d.sniffT -= dt; if (d.sniffT <= 0) { d.mode = 'follow'; d.nextSniff = 22 + Math.random() * 18; }
      } else d.yaw = lerpAngle(d.yaw, Math.atan2(-(player.x - d.x), -(player.z - d.z)), dt * 3);
      d.idle = (v < 0.3 && d.mode === 'follow') ? d.idle + dt : 0;
      d.nextSniff -= dt;
      if (d.mode === 'follow' && d.nextSniff <= 0 && state.intro <= 0 && !player.running && !indoor) {
        // quest items and rare finds first, then undiscovered sites
        const q = game.sniffTarget(player.x, player.z), n = nearestUndiscovered(player.x, player.z);
        const t = q ? { x: q.x, z: q.z, id: q.id, done: q.done, dist: Math.hypot(q.x - player.x, q.z - player.z), quest: true }
          : n && n.dist < 130 ? { x: n.it.x, z: n.it.z, id: n.it.d.id, done: () => isFound(n.it.d.id), dist: n.dist } : null;
        d.nextSniff = q ? 12 + Math.random() * 6 : 22 + Math.random() * 18;
        if (t) {
          const k = t.dist < 17 ? Math.max(0, t.dist - 3) / t.dist : 14 / t.dist;
          d.sniff = { x: player.x + (t.x - player.x) * k, z: player.z + (t.z - player.z) * k, id: t.id, done: t.done }; d.mode = 'sniff'; d.sniffT = 2.5;
          onEvent('dogHint', { dist: Math.round(t.dist), dir: relDir(Math.atan2(-(t.x - player.x), -(t.z - player.z)) - viewYaw), quest: !!t.quest });
        }
      }
      const gh = height(d.x, d.z);
      d.vy -= g * dt; d.y += d.vy * dt;
      if (d.y <= gh) { d.y = gh; d.vy = 0; d.air = false; }
      else if (!d.air && d.y - gh < 0.3 && d.vy <= 0) d.y = gh;
      else d.air = true;
      d.sit += ((d.idle > 1.5 && !d.air ? 1 : 0) - d.sit) * Math.min(1, dt * 6);
      d.group.position.set(d.x, d.y, d.z); d.group.rotation.set(0, d.yaw, 0);
    }
    // animation: trot with diagonal leg pairs, sit, sniff, wag
    d.phase += v * dt * 2.6;
    const sw = v > 0.3 ? Math.sin(d.phase) * Math.min(0.75, 0.25 + v * 0.06) : 0;
    const s = d.sit;
    P.legs[0].rotation.x = sw * (1 - s) - 0.4 * s; P.legs[3].rotation.x = sw * (1 - s) + 1.25 * s;
    P.legs[1].rotation.x = -sw * (1 - s) - 0.4 * s; P.legs[2].rotation.x = -sw * (1 - s) + 1.25 * s;
    if (d.air && !driving) P.legs.forEach((l, i) => l.rotation.x = i < 2 ? -0.6 : 0.6);
    P.body.rotation.x = 0.42 * s; P.body.position.y = -0.1 * s + (v > 0.3 ? Math.abs(Math.sin(d.phase)) * 0.03 : 0);
    const sniffing = d.mode === 'sniff' && d.sniffT < 2.5;
    P.head.rotation.x = sniffing ? -0.55 + Math.sin(time * 16) * 0.08 : -0.3 * s + (d.wag > 0 ? Math.sin(time * 9) * 0.1 : 0);
    P.tail.rotation.y = Math.sin(time * (d.wag > 0 ? 32 : 9)) * (d.wag > 0 ? 0.8 : 0.25);
  }

  let lastCd = 9;
  function updateAstro(dt) {
    const a = astro, P = a.parts;
    a.group.visible = !driving && camDist > 0.8 && lastCd > 1.0; // v7.4: hide yourself when the boom is squeezed (no head filling the screen)
    if (!a.group.visible) return;
    a.group.position.set(player.x, player.y - EYE, player.z);
    if (player.moving > 0.05) player.faceYaw = lerpAngle(player.faceYaw, player.moveYaw, dt * 10);
    a.group.rotation.y = player.faceYaw;
    const sw = Math.sin(player.bob) * 0.6 * player.moving;
    if (!player.grounded) { P.legL.rotation.x = 0.45; P.legR.rotation.x = -0.25; P.armL.rotation.x = -0.6; P.armR.rotation.x = -0.6; }
    else { P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.armL.rotation.x = -sw * 0.7; P.armR.rotation.x = sw * 0.7; }
    // v7.1 melee: the vibro-machete rides in the right hand once you own it; punches, kicks and slashes animate the limbs
    if (player.hasBlade && !P.blade) {
      const bl = new THREE.Group(); bl.position.set(0, -0.7, 0);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0x3a2f22, roughness: 0.9 })); h.position.z = 0.02; bl.add(h);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 0.72), new THREE.MeshStandardMaterial({ color: 0xb8c4cc, metalness: 0.8, roughness: 0.25, emissive: 0x0a3344 })); b.position.z = -0.45; bl.add(b);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.72), new THREE.MeshBasicMaterial({ color: 0x7fe9ff })); e.position.set(0, -0.06, -0.45); bl.add(e);
      P.armR.add(bl); P.blade = bl;
    }
    const m = player.melee;
    if (m && m.t > 0) {
      m.t -= dt; const k = Math.max(0, m.t / m.max), arc = Math.sin(k * Math.PI);
      if (m.kick) { P.legR.rotation.x = 1.45 * arc; P.armL.rotation.x = -0.5 * arc; }
      else if (m.blade) P.armR.rotation.x = 0.1 + 2.4 * k;
      else (m.step % 2 ? P.armL : P.armR).rotation.x = 1.6 * arc;
    }
  }

  // ----- first-person rover cockpit: hood, dashboard, pillars and a live gauge, drawn on top of the world -----
  let cockpit = null;
  function buildCockpit() {
    if (!cockpit) {
      const mk = (geo, color, ro) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: false, depthTest: false, depthWrite: false })); m.renderOrder = ro; m.userData.shared = true; m.material.userData.shared = true; m.geometry.userData.shared = true; return m; };
      const g = new THREE.Group(); g.userData.shared = true;
      // unit-sized parts (width 1, height 1), scaled to the screen each frame
      const hoodShape = new THREE.Shape(); hoodShape.moveTo(-0.55, 0); hoodShape.lineTo(0.55, 0); hoodShape.lineTo(0.3, 0.92); hoodShape.quadraticCurveTo(0, 1.04, -0.3, 0.92); hoodShape.closePath();
      const hoodGeo = new THREE.ShapeGeometry(hoodShape, 6), hc = [], pa = hoodGeo.attributes.position;
      for (let v = 0; v < pa.count; v++) { const t = pa.getY(v), e = 1 - Math.abs(pa.getX(v)) * 0.5; hc.push(0.07 * e + 0.05 * t, 0.075 * e + 0.05 * t, 0.09 * e + 0.055 * t); }
      hoodGeo.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3));
      const hood = mk(hoodGeo, 0xffffff, 990); hood.material.vertexColors = true; hood.material.needsUpdate = true;
      const hoodLine = mk(new THREE.PlaneGeometry(1, 1), 0x2a2e35, 991);
      const dash = mk(new THREE.PlaneGeometry(1, 1), 0x14161c, 992);
      const trim = mk(new THREE.PlaneGeometry(1, 1), 0x38bdf8, 993);
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const gauge = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: tex, fog: false, depthTest: false, depthWrite: false, transparent: true }));
      gauge.renderOrder = 994; gauge.userData.shared = true; gauge.material.userData.shared = true; gauge.geometry.userData.shared = true;
      const pL = mk(new THREE.PlaneGeometry(1, 1), 0x15171d, 995), pR = pL.clone(); pR.renderOrder = 995;
      g.add(hood, hoodLine, dash, trim, gauge, pL, pR);
      cockpit = { g, hood, hoodLine, dash, trim, gauge, pL, pR, c, tex, t: 0, last: '' };
    }
    cockpit.g.visible = false; camera.add(cockpit.g);
  }
  function updateCockpit(dt, on) {
    if (!cockpit) return;
    // in the rover's first-person seat the rover's own deck would fill the lower screen: hide it, the cockpit frame replaces it
    if (rover) rover.group.visible = !(on && car === rover);
    if (car && car !== rover) car.group.visible = !on;
    if (dog && driving) dog.group.visible = !on; else if (dog) dog.group.visible = true;
    cockpit.g.visible = on; if (!on) return;
    // sized as fractions of the screen so portrait phones get a slim frame: dash ~6%, hood ~10% of the height
    const D = 0.5, hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * D, hw = hh * camera.aspect, H = 2 * hh, W = 2 * hw;
    const dashH = H * 0.06, hoodH = H * (camera.aspect < 1 ? 0.09 : 0.12), hoodW = Math.min(W * 1.02, H * 1.5);
    cockpit.dash.position.set(0, -hh + dashH / 2, -D); cockpit.dash.scale.set(W * 1.1, dashH, 1);
    cockpit.trim.position.set(0, -hh + dashH, -D); cockpit.trim.scale.set(W * 1.1, H * 0.004, 1);
    cockpit.hood.position.set(0, -hh + dashH * 0.9, -D); cockpit.hood.scale.set(hoodW, hoodH, 1);
    cockpit.hoodLine.position.set(0, -hh + dashH + hoodH * 0.45, -D); cockpit.hoodLine.scale.set(hoodW * 0.012, hoodH * 0.85, 1);
    const gh = dashH * 0.7; cockpit.gauge.position.set(0, -hh + dashH * 0.48, -D); cockpit.gauge.scale.set(gh, gh, 1);
    const pw = W * 0.018; for (const [p, sgn] of [[cockpit.pL, -1], [cockpit.pR, 1]]) { p.position.set(sgn * (hw - pw * 0.3), 0, -D); p.scale.set(pw, H * 1.2, 1); p.rotation.z = sgn * 0.06; }
    cockpit.t -= dt; if (cockpit.t > 0) return; cockpit.t = 0.2;
    const gi = game.info, alt = car.air ? Math.round(car.y - height(car.x, car.z)) : -1, txt = `${alt}|${Math.round(car.fuel ?? 0)}|${Math.round(Math.abs(car.speed) * 3.6)}|${gi.turret ? gi.heat : -1}|${gi.overheat}`;
    if (txt === cockpit.last) return; cockpit.last = txt;
    const x = cockpit.c.getContext('2d'); x.clearRect(0, 0, 256, 64);
    x.fillStyle = 'rgba(5,10,20,0.9)'; x.beginPath(); x.roundRect ? x.roundRect(2, 2, 252, 60, 12) : x.rect(2, 2, 252, 60); x.fill();
    x.fillStyle = '#7dd3fc'; x.font = 'bold 30px system-ui, sans-serif'; x.textBaseline = 'middle'; x.fillText(alt >= 0 ? `ALT ${alt} m` : `${Math.round(Math.abs(car.speed) * 3.6)} km/h`, 14, 33);
    if (gi.turret) { x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(150, 26, 92, 14); x.fillStyle = gi.overheat ? '#ff2d55' : '#f59e0b'; x.fillRect(150, 26, 92 * gi.heat / 100, 14); x.fillStyle = '#fff'; x.font = 'bold 13px system-ui, sans-serif'; x.fillText(gi.overheat ? 'OVERHEAT' : 'PLASMA', 152, 15); }
    cockpit.tex.needsUpdate = true;
  }
  const camT = new THREE.Vector3(), camDir = new THREE.Vector3(); let camPull = 1e9, camOcc = false;
  function updateCamera(dt) {
    camDist += (camGoal - camDist) * (1 - Math.exp(-dt * 6));
    if (Math.abs(camGoal - camDist) < 0.02) camDist = camGoal;
    const zt = clamp((camDist - 10) / (CAM_MAX - 10), 0, 1);
    const introY = state.intro > 0 ? Math.pow(state.intro / 1.8, 2) * 40 : 0, introP = state.intro > 0 ? state.intro * 0.35 : 0;
    const first = camDist < 0.8;
    if (driving) {
      // v7.2 GTA-style: a manual orbit eases back behind the vehicle 1.5 s after the last drag, or as soon as it's moving
      const lookIdle = time - lastLook;
      if (lookIdle > 1.5 || (lookIdle > 0.35 && (Math.abs(car.speed) > 2 || car.air))) camYawOff *= Math.exp(-dt * (lookIdle > 1.5 ? 2.2 : 2.8));
      // v7.2: the chase cam swings after the car's heading (softer in the air, so banked turns read)
      if (camYawS === null || first) camYawS = car.yaw;
      else camYawS += Math.atan2(Math.sin(car.yaw - camYawS), Math.cos(car.yaw - camYawS)) * (1 - Math.exp(-dt * (car.air ? 3.5 : 9)));
      viewYaw = camYawS + camYawOff;
      if (first) {
        car.group.updateMatrixWorld(true); car.body.localToWorld(camT.set(-0.45, car.kit ? 1.85 : 2.15, -0.55));
        camera.position.copy(camT); camera.rotation.set(player.pitch + car.pitch * (car.air ? 0.6 : 1), viewYaw, car.roll * (car.air ? 0.5 : 1), 'YXZ');
      } else camT.set(car.x, car.y + 2.0, car.z);
    } else {
      // v7.2 GTA-style third person: the camera eases round behind the way you face (you turn to face where you walk).
      // Drag to orbit any time; it settles back 1.5 s after you let go, or as soon as you move. Desktop mouse-look (pointer lock) is left alone.
      if (!first && state.intro <= 0 && !document.pointerLockElement) {
        const idle = time - lastLook, d = Math.atan2(Math.sin(player.faceYaw - player.yaw), Math.cos(player.faceYaw - player.yaw));
        let rate = 0;
        if (player.moving > 0.05 && idle > 0.35) rate = 2.4 * player.moving * (0.25 + 0.75 * Math.max(0, Math.cos(d))); // full pull when running away from the lens, gentle when strafing or coming back toward it
        else if (idle > 1.5) rate = 2.2;
        player.yaw += d * (1 - Math.exp(-dt * rate));
      }
      viewYaw = player.yaw; camYawS = null;
      if (first) {
        camera.position.set(player.x, player.y + introY + (player.grounded ? Math.sin(player.bob) * 0.06 : 0), player.z);
        camera.rotation.set(player.pitch - introP, player.yaw, 0);
      } else camT.set(player.x, player.y - EYE + 1.5, player.z);
    }
    const dS = !first && !driving && !indoor ? world.duel : null; // v7.5.1 (M4): duel cam frames both fighters from the clearest side
    if (dS && dS.phase !== 'done' && dS.x != null) {
      const ang = Math.atan2(player.x - dS.x, player.z - dS.z), clear = yw => { const sx = Math.sin(yw), sz = Math.cos(yw); for (let i = 1; i <= 8; i++) { const t = camDist * i / 8, x = camT.x + sx * t, z = camT.z + sz * t, y = camT.y + t * 0.35; if (world.camBlocked(x, y, z) || rockAt(x, y, z)) return i; } return 9; };
      let best = duelYaw ?? ang, bs = duelYaw != null ? clear(duelYaw) + 0.5 : -1; for (const o of [0, 0.5, -0.5, 1.0, -1.0, 1.57, -1.57]) { const s = clear(ang + o); if (s > bs) { bs = s; best = ang + o; } }
      duelYaw = duelYaw == null ? best : duelYaw + Math.atan2(Math.sin(best - duelYaw), Math.cos(best - duelYaw)) * (1 - Math.exp(-dt * 2.5)); viewYaw = duelYaw;
      camT.set((player.x * 2 + dS.x) / 3, camT.y, (player.z * 2 + dS.z) / 3);
    } else duelYaw = null;
    if (!first) {
      const ep = clamp(player.pitch - lerp(0.28, 1.0, zt) - introP, -1.52, 0.5);
      camDir.set(-Math.sin(viewYaw) * Math.cos(ep), Math.sin(ep), -Math.cos(viewYaw) * Math.cos(ep));
      let cd = camDist;
      if (indoor) { // v7.3: tight-space camera. Pull in close and shorten the boom so the lens never leaves the room
        const b = world.inside, m = 0.35; cd = Math.min(cd, 3.4);
        const lim = (o, d, lo, hi) => d > 1e-4 ? (hi - o) / d : d < -1e-4 ? (lo - o) / d : 1e9;
        cd = Math.max(0.3, Math.min(cd, lim(camT.x, -camDir.x, b.x0 + m, b.x1 - m), lim(camT.z, -camDir.z, b.z0 + m, b.z1 - m), lim(camT.y, -camDir.y, b.floor + 0.4, b.y1 - m)));
        // v7.4: march the boom against tall interior colliders too (VIP partition, depot shelving) so the lens never ends up inside a wall
        const N = 12, c0 = cd; for (let i = 1; i <= N; i++) { const t = c0 * i / N; if (world.camBlockedIn(camT.x - camDir.x * t, camT.y - camDir.y * t, camT.z - camDir.z * t)) { cd = Math.max(0.3, c0 * (i - 1) / N - 0.2); break; } }
      }
      else if (cd < 60) { // v7.3: GTA-style pull-in. March the boom from the target outward; stop short of buildings, domes and the Starship
        const sx = SHIP.x, sz = SHIP.z, dS = Math.hypot(camT.x - sx, camT.z - sz), shipNear = dS < cd + 8 && dS > 5;
        const blocked = (x, y, z) => world.camBlocked(x, y, z) || rockAt(x, y, z) || (shipNear && y < height(sx, sz) + 52 && Math.hypot(x - sx, z - sz) < 4.6);
        const N = 14; let hit = cd;
        for (let i = 1; i <= N; i++) { const t = cd * i / N; if (blocked(camT.x - camDir.x * t, camT.y - camDir.y * t, camT.z - camDir.z * t)) { hit = Math.max(0.9, cd * (i - 1) / N - 0.25); break; } }
        camPull = hit < camPull ? hit : camPull + (hit - camPull) * (1 - Math.exp(-dt * 3));
        cd = Math.min(cd, camPull);
      }
      if (indoor || cd >= 60) camPull = cd;
      camOcc = cd < camDist - 0.3; lastCd = cd;
      camera.position.copy(camT).addScaledVector(camDir, -cd); camera.position.y += introY;
      const gy = (indoor ? world.inside.floor + 0.4 : height(camera.position.x, camera.position.z) + 1.0);
      if (camera.position.y < gy) camera.position.y = gy;
      if (!indoor && cfg.water !== undefined && camera.position.y < cfg.water + 0.6) camera.position.y = cfg.water + 0.6;
      camera.lookAt(camT.x, camT.y + introY * 0.8, camT.z);
    }
    if (scene.fog && baseFog && indoor) { if (scene.fog.isFogExp2) scene.fog.density = 0; else { scene.fog.near = 300; scene.fog.far = 600; } }
    else if (scene.fog && baseFog) {
      if (scene.fog.isFogExp2) scene.fog.density = baseFog.density * lerp(1, 0.12, zt);
      else { scene.fog.near = lerp(baseFog.near, Math.max(baseFog.near, 260), zt); scene.fog.far = lerp(baseFog.far, 720, zt); }
    }
    return zt;
  }

  function update(dt, input) {
    if (!cfg) return;
    time += dt;
    const g = cfg.g * 9.81;
    if (state.intro > 0) state.intro = Math.max(0, state.intro - dt);
    if (game.isDown()) input = { keys: {}, joy: { x: 0, y: 0 } }; // knocked out: wait for the beam-back
    if (!driving) walk(dt, input, g);
    updateRover(dt, input, g, rover);
    if (driving && car !== rover) updateRover(dt, input, g, car);
    if (dust) updateDust(dt, g);
    world.update(dt);
    if (driving) { player.x = car.x; player.z = car.z; player.y = car.y + EYE; player.grounded = !car.air; if (state.outro > 0) state.outro -= dt; }
    if (!indoor) updateDog(dt, g);
    updateAstro(dt);
    updateCamera(dt);
    raceTick(dt, { scene, camera, height, player, car: driving ? car : null, rover, game, world, name });
    activityTick(dt, { scene, camera, height, player, car: driving ? car : null, rover, game, world, name, isMobile });
    heistTick(dt, { scene, camera, height, player, car: driving ? car : null, rover, game, world, name });
    sciTick(dt, { scene, camera, height, player, car: driving ? car : null, rover, game, world, name });
    if (extraTicks.length) { const tc = { scene, camera, height, player, car: driving ? car : null, rover, game, world, name, isMobile }; for (const f of extraTicks) { try { f(dt, tc); } catch (e) { console.warn('surface tick', e); } } } // v7.5.1 registerSurfaceTick
    modeTick(dt, { scene, camera, height, player, car: driving ? car : null, rover, game, world, name, isMobile });
    game.update(dt, input);
    dangerTick(dt, { scene, camera, height, player, car: driving ? car : null, rover, game, world, name, inside: !!indoor, dog, intro: state.intro });
    updateCockpit(dt, driving && camDist < 0.8);
    const px = player.x, pz = player.z;
    updateChunks(px, pz, false, driving ? 2 : 1);
    // far terrain for high views
    const farOn = camDist > 18 && !indoor;
    if (farOn && (!farCenter || Math.hypot(px - farCenter.x, pz - farCenter.z) > 150)) buildFar(Math.round(px / 50) * 50, Math.round(pz / 50) * 50);
    if (farMesh) { farMesh.visible = farOn; const cx = Math.floor(px / CHUNK), cz = Math.floor(pz / CHUNK); nearHole.value.set((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK, (RADIUS + 0.5) * CHUNK - 1); }
    if (skyGroup) { skyGroup.position.copy(camera.position); skyGroup.children.forEach(c => { if (c.userData.spin) c.rotation.y += dt * 0.05; }); }
    if (waterMesh) { waterMesh.position.x = Math.round(camera.position.x / 8) * 8; waterMesh.position.z = Math.round(camera.position.z / 8) * 8; }
    poiObjects.forEach(p => { if (p.userData.beacon) { p.userData.beacon.rotation.y += dt * 2; p.userData.beacon.position.y = 1.6 + Math.sin(time * 2.5) * 0.15; } });
    // discoveries: beacons stay visible from afar; walk or drive close to discover
    for (const it of discItems) {
      const dc = Math.hypot(it.x - camera.position.x, it.z - camera.position.z), k = Math.max(1, dc / 70);
      it.beam.scale.set(k, 1, k); it.glint.scale.setScalar(Math.max(4, dc / 14));
      it.obj.userData.anim?.(it.obj, time);
      if (state.intro <= 0 && !indoor && !isFound(it.d.id) && Math.hypot(it.x - px, it.z - pz) < it.reach + (driving ? 4 : 0)) discover(it, driving ? 'drive' : 'walk');
    }
  }

  const ray = new THREE.Raycaster();
  function tap(nx, ny) {
    if (!cfg) return null;
    if (indoor) { // v7.3: tap an item on a rack or in a case to buy it
      ray.far = 14; ray.setFromCamera({ x: nx, y: ny }, camera);
      const h = ray.intersectObjects(world.wareTargets(), false)[0];
      return h ? { ware: h.object.userData.ware } : null;
    }
    ray.far = camDist + 90;
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const targets = [...poiObjects, ...game.tapTargets()]; if (dog && !driving) targets.push(dog.group);
    const hits = ray.intersectObjects(targets, true);
    const combat = game.combat;
    for (const h of hits) {
      let o = h.object; while (o && !o.userData.poi && o !== dog?.group) o = o.parent;
      if (!o) continue;
      const gr = game.tapObject(o);
      if (gr !== undefined) { if (gr) return gr; continue; }
      if (combat && !o.userData.disc) break; // in a fight, taps on scenery shoot instead
      if (o === dog?.group) { pet(); return { pet: true }; }
      if (o.userData.disc) {
        const it = discItems.find(i => i.d.id === o.userData.disc);
        if (isFound(it.d.id)) return { name: it.d.name, fact: it.d.fact };
        const dd = Math.hypot(it.x - player.x, it.z - player.z);
        if (dd <= 45) { discover(it, 'tap'); return { name: it.d.name, fact: it.d.fact, discovered: true }; }
        return { name: 'Unknown signal', fact: `Something interesting is about ${Math.round(dd)} m away. Get closer to discover it.` };
      }
      return { name: o.userData.name, fact: o.userData.fact, rover: !!o.userData.rover };
    }
    if (combat) { game.fire({ x: nx, y: ny }); return { fired: true }; }
    return null;
  }
  function nearestPoi() {
    let best = null, bd = 1e9;
    for (const p of poiObjects) { if (p.userData.disc) continue; const d = Math.hypot(p.position.x - player.x, p.position.z - player.z); if (d < bd && d > 6) { bd = d; best = p; } }
    if (!best || bd > 200) return null;
    return { name: best.userData.name, dist: Math.round(bd), dir: relDir(Math.atan2(-(best.position.x - player.x), -(best.position.z - player.z)) - viewYaw) };
  }
  const nearRover = () => rover && !driving && !indoor && Math.hypot(rover.x - player.x, rover.z - player.z) < 6.5;
  // ----- v7.3 enterable buildings: walk through a door into a small interior parked above the colony -----
  const groundAt = (x, z) => indoor ? world.inside.floor : height(x, z);
  function enterBuilding(door) {
    if (!cfg || indoor || driving || state.intro > 0 || state.outro > 0 || game.isDown()) return null;
    const r = world.enterBuilding(door); if (!r.ok) { if (r.msg) onEvent('toast', { text: r.msg, long: true }); return r; }
    indoor = { kind: r.kind, name: r.name, out: { x: player.x, z: player.z } };
    hiddenOut = [];
    for (const o of scene.children) { if (o.isLight || o.isCamera || o.userData.keep || o === astro?.group || !o.visible) continue; o.visible = false; hiddenOut.push(o); }
    player.x = r.spawn.x - Math.sin(r.spawn.yaw) * 1.0; player.z = r.spawn.z - Math.cos(r.spawn.yaw) * 1.0; player.y = r.spawn.y + EYE; player.vy = 0; player.grounded = true; player.yaw = r.spawn.yaw; // v7.4: a step inside, so the first look shows the room player.faceYaw = r.spawn.yaw; player.pitch = -0.08;
    lastLook = -9; camYawS = null;
    onEvent('indoor', { on: true, kind: r.kind, name: r.name, paid: r.paid || 0 });
    return r;
  }
  function leaveBuilding(quiet) {
    if (!indoor) return null;
    const p = world.exitBuilding();
    for (const o of hiddenOut) o.visible = true; hiddenOut = [];
    indoor = null;
    if (p) { player.x = p.x; player.z = p.z; player.y = height(p.x, p.z) + EYE; player.vy = 0; player.yaw = p.yaw; player.faceYaw = p.yaw; dogTo(p.x, p.z); updateChunks(p.x, p.z, true); }
    if (!quiet) onEvent('indoor', { on: false });
    return p;
  }
  function interact() {
    if (!cfg || state.intro > 0 || state.outro > 0) return null;
    if (indoor) return null;
    if (driving) {
      const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
      let ex = car.x - rx * 2.9, ez = car.z - rz * 2.9;
      if (cfg.water !== undefined && height(ex, ez) < cfg.water - 0.3) { ex = car.x + rx * 2.9; ez = car.z + rz * 2.9; }
      player.x = ex; player.z = ez; player.y = height(ex, ez) + EYE; player.vy = 0; player.grounded = true;
      const c = world.collide(ex, ez, 0.45, car); if (c) { player.x = c.x; player.z = c.z; }
      player.yaw = car.yaw + camYawOff; player.faceYaw = player.yaw;
      car.speed = 0; car.group.visible = true; driveGoal = camGoal; saveView(); driving = false; camGoal = walkGoal;
      const was = car; if (car !== rover) world.leave(car); car = null;
      onEvent('vehicle', { on: false, kind: was.kind }); return 'exit';
    }
    // a little more reach than the button's show range so a tap at the edge never whiffs
    const nv = !nearRover() && world.nearVehicle(player.x, player.z, 7);
    if (nearRover() || nv) {
      car = nv || rover; if (nv) world.take(nv);
      walkGoal = camGoal; saveView(); driving = true; camGoal = driveGoal; camYawOff = 0; player.pitch = camGoal < 0.8 ? FP_DRIVE_PITCH : Math.min(player.pitch, 0);
      onEvent('vehicle', { on: true, kind: car.kind, name: car.spec.name, stolen: car !== rover });
      return nv ? 'take' : 'drive';
    }
    const far = world.nearVehicle(player.x, player.z, 16);
    if (far) { onEvent('toast', { text: `Too far. Get right up to the ${far.spec?.name || far.kind}.` }); return 'far'; }
    return null;
  }
  function pet() {
    if (!dog) return false;
    const dd = driving ? 0 : Math.hypot(dog.x - player.x, dog.z - player.z);
    if (dd > 40) return false;
    // petting (or calling from a distance) brings the dog back from a sniff
    if (!driving && dog.mode === 'sniff') { dog.mode = 'follow'; dog.nextSniff = 20 + Math.random() * 15; }
    dog.wag = 2.4; dog.idle = 0; if (!dog.air && !driving && dd < 8) dog.vy = 3.2;
    onEvent('bark', {}); return true;
  }
  const viewName = (d = camGoal) => d < 0.8 ? 'first' : d < 60 ? 'third' : 'aerial';
  function setView(v) { camGoal = v === 'first' ? 0 : v === 'aerial' ? 220 : (driving ? 16 : 9); if (driving && v === 'first') player.pitch = FP_DRIVE_PITCH; saveView(); return viewName(); }
  function cycleView() { const v = viewName(); return setView(v === 'first' ? 'third' : v === 'third' ? 'aerial' : 'first'); }
  function zoom(f) {
    if (camGoal < 0.8) { if (f > 1) camGoal = 3.5; }
    else { camGoal *= f; if (camGoal < 2.6) camGoal = 0; }
    camGoal = Math.min(CAM_MAX, camGoal); saveView();
  }
  function resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function takeOff() { if (state) { if (indoor) leaveBuilding(); if (driving) interact(); state.outro = 1.0; player.vy = 2; } }
  function discoveryLog() {
    const f = loadFound();
    return Object.entries(DISCOVERIES).map(([world, list]) => ({ world, items: list.map(d => ({ id: d.id, name: d.name, fact: d.fact, found: !!f[world]?.includes(d.id) })) }));
  }
  // test/debug hook: move next to a discovery (or 25 m short of it)
  function debugTeleport(id, short = 25) {
    const it = discItems.find(i => i.d.id === id); if (!it) return false;
    const L = Math.hypot(it.x, it.z) || 1, k = Math.max(0, (L - short) / L), x = it.x * k, z = it.z * k;
    const yaw = Math.atan2(-(it.x - x), -(it.z - z));
    if (driving) { car.x = x; car.z = z; car.yaw = yaw; car.y = height(x, z); car.prevG = null; car.vy = 0; car.speed = 0; }
    else { player.x = x; player.z = z; player.y = height(x, z) + EYE; player.yaw = yaw; }
    updateChunks(x, z, true); return true;
  }

  // ----- travel helpers: summon the rover, warp to the rover, return to the ship (any distance; positions don't depend on loaded chunks) -----
  const dry = (x, z) => cfg.water === undefined || height(x, z) > cfg.water + 0.4;
  function freeSpot(cx, cz, yaw, r0) {
    for (let k = 0; k < 16; k++) { const a = yaw + [-1.2, 1.2, -0.6, 0.6, -1.9, 1.9, 0, Math.PI][k % 8], r = r0 + Math.floor(k / 8) * 4, x = cx - Math.sin(a) * r, z = cz - Math.cos(a) * r; if (dry(x, z) && Math.hypot(x - SHIP.x, z - SHIP.z) > 11) return { x, z }; }
    return { x: cx + 4, z: cz + 4 };
  }
  function travelBlocked() { if (!cfg || !rover) return 'no rover here'; if (indoor) leaveBuilding(); if (state.intro > 0 || game.isDown()) return 'busy'; if (game.info.combat) return 'aliens are nearby! Clear them first.'; return null; }
  function dogTo(x, z) { if (!dog || driving) return; dog.mode = 'follow'; dog.sniff = null; dog.x = x + 1.4; dog.z = z + 1.2; dog.y = height(dog.x, dog.z); dog.vy = 0; dog.nextSniff = 12; }
  function dustRing(x, z, n = 70) { if (!dust) return; const y = height(x, z); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, sp = 3 + (i % 5); spawnDust(x + Math.cos(a) * 2.2, y + 0.4, z + Math.sin(a) * 2.2, Math.cos(a) * sp, 1.5 + (i % 3), Math.sin(a) * sp); } }
  function summonRover() {
    const b = travelBlocked(); if (b) return { ok: false, why: b };
    if (driving) return { ok: false, why: 'you are already driving' };
    const p = freeSpot(player.x, player.z, player.yaw + 0.9, 6);
    rover.x = p.x; rover.z = p.z; rover.y = height(p.x, p.z); rover.yaw = Math.atan2(-(player.x - p.x), -(player.z - p.z)) + Math.PI / 2;
    rover.vy = 0; rover.speed = 0; rover.steer = 0; rover.prevG = null; rover.air = false; rover.pitch = 0; rover.roll = 0;
    rover.group.position.set(rover.x, rover.y, rover.z); rover.group.rotation.set(0, rover.yaw, 0);
    updateChunks(player.x, player.z, true); dustRing(p.x, p.z);
    return { ok: true, x: p.x, z: p.z };
  }
  function warpToRover() {
    const b = travelBlocked(); if (b) return { ok: false, why: b };
    if (driving) return { ok: false, why: 'you are already in the rover' };
    const p = freeSpot(rover.x, rover.z, rover.yaw + Math.PI, 4.5);
    player.x = p.x; player.z = p.z; player.y = height(p.x, p.z) + EYE; player.vy = 0;
    player.yaw = Math.atan2(-(rover.x - p.x), -(rover.z - p.z)); player.faceYaw = player.yaw;
    dogTo(p.x, p.z); updateChunks(p.x, p.z, true); dustRing(p.x, p.z, 40);
    return { ok: true };
  }
  function returnToShip() {
    if (!cfg || state.intro > 0 || game.isDown()) return { ok: false, why: 'busy' };
    if (indoor) leaveBuilding();
    if (game.info.combat) return { ok: false, why: 'aliens are nearby! Clear them first.' };
    if (driving && car !== rover) interact();
    if (driving) {
      const p = freeSpot(SHIP.x, SHIP.z + 20, 0, 4);
      rover.x = p.x; rover.z = p.z; rover.y = height(p.x, p.z); rover.speed = 0; rover.vy = 0; rover.prevG = null; rover.yaw = 0.4;
      player.x = rover.x; player.z = rover.z; updateChunks(p.x, p.z, true); return { ok: true };
    }
    const x = SHIP.x - 10, z = SHIP.z + 12;
    player.x = x; player.z = z; player.y = height(x, z) + EYE; player.vy = 0; player.yaw = 0.6; player.faceYaw = 0.6;
    dogTo(x, z); updateChunks(x, z, true);
    return { ok: true };
  }
  function roverNav() {
    if (!rover) return null;
    const dx = rover.x - player.x, dz = rover.z - player.z, a = Math.atan2(-dx, -dz) - viewYaw;
    return { dist: Math.round(Math.hypot(dx, dz)), ang: Math.atan2(Math.sin(a), Math.cos(a)), ship: Math.round(Math.hypot(SHIP.x - player.x, SHIP.z - player.z)) };
  }
  // v7.5 ☰ Districts: fast travel between the colony and its districts (same world). Your car comes with you.
  function fastTravel(id) {
    const b = travelBlocked(); if (b) return { ok: false, why: b };
    if (world.wanted > 0) return { ok: false, why: 'lose the heat first' };
    const q = String(id || '').toLowerCase(), d = world.districts().find(s => s.id === id || s.name.toLowerCase().includes(q)); if (!d) return { ok: false, why: 'no such district here' };
    let { x, z } = d.fast; const c = world.collide(x, z, driving ? 2.5 : 0.6); if (c) { x = c.x; z = c.z; }
    if (driving) { car.x = x; car.z = z; car.yaw = 0; car.y = height(x, z) + (car.spec.hover || 0); car.prevG = null; car.vy = 0; car.speed = 0; car.group.position.set(car.x, car.y, car.z); car.group.rotation.set(0, 0, 0); player.x = x; player.z = z; }
    else { player.x = x; player.z = z; player.y = height(x, z) + EYE; player.vy = 0; player.yaw = 0; player.faceYaw = 0; dogTo(x, z); }
    updateChunks(x, z, true); world.debug.zones(); dustRing(x, z, 40);
    return { ok: true, id: d.id, name: d.name };
  }
  function debugPlace(x, z, yaw = player.yaw) { if (indoor) leaveBuilding(true); if (driving) interact(); player.x = x; player.z = z; player.y = height(x, z) + EYE; player.yaw = yaw; player.faceYaw = yaw; updateChunks(x, z, true); }
  return {
    scene, camera, enter, exit, update, look, tap, resize, takeOff, nearestPoi, interact, pet, setView, cycleView, zoom, discoveryLog, debugTeleport, debugPlace, game, world,
    aim(nx, ny, has = true) { game.setAim(nx, ny, has); },
    chopVehicle() { // v7.5.1: chop shops scrap your stolen ride (Marsmania's barter 'chop'); never your own rover
      let v = driving && car !== rover ? car : null; if (v) interact(); else { const n = world.nearestVehicle?.(); if (n && n.taken && n !== rover && Math.hypot(n.x - player.x, n.z - player.z) < 7) v = n; }
      return v ? world.despawnVehicle(v) : false; },
    summonRover, warpToRover, returnToShip, roverNav, enterBuilding, leaveBuilding, fastTravel, registerTick: fn => { if (typeof fn === 'function' && !extraTicks.includes(fn)) extraTicks.push(fn); return () => { const i = extraTicks.indexOf(fn); if (i >= 0) extraTicks.splice(i, 1); }; },
    debugInside(lx, lz, yaw = 0) { const b = world.inside; if (!b) return false; player.x = (b.x0 + b.x1) / 2 + lx; player.z = (b.z0 + b.z1) / 2 + lz; player.yaw = yaw; player.faceYaw = yaw; return true; },
    // test hook: jump to just short of the active quest's current objective
    debugLaunch(vy = 9) { if (!driving || !car) return false; if (car.spec?.hover) { car.lift = 6; car.air = true; return true; } car.y += 0.6; car.vy = vy; car.air = true; return true; }, // v7.4 tests: pop the car into the air
    debugMove(x, z, yaw = 0) { if (driving) { car.x = x; car.z = z; car.yaw = yaw; car.y = height(x, z); car.prevG = null; car.vy = 0; car.speed = 0; updateChunks(x, z, true); } else debugPlace(x, z, yaw); return true; },
    debugQuestGo(short = 6) { const w = game.waypoint(); if (!w) return false; const dx = w.x - player.x, dz = w.z - player.z, L = Math.hypot(dx, dz) || 1, k = Math.max(0, (L - short) / L), x = player.x + dx * k, z = player.z + dz * k, yaw = Math.atan2(-dx, -dz); if (driving) { car.x = x; car.z = z; car.yaw = yaw; car.y = height(x, z); car.prevG = null; car.vy = 0; car.speed = 0; updateChunks(x, z, true); } else debugPlace(x, z, yaw); return true; },
    mapData() {
      if (!cfg) return null;
      const n = nearestUndiscovered(player.x, player.z), w = game.waypoint();
      return { x: driving ? car.x : player.x, z: driving ? car.z : player.z, yaw: viewYaw, driving, rover: rover ? { x: rover.x, z: rover.z } : null, ship: SHIP,
        wp: w ? { x: w.x, z: w.z } : null, next: n ? { x: n.it.x, z: n.it.z } : null, aliens: game.mapAliens(), dog: dog && !driving ? { x: dog.x, z: dog.z } : null,
        world: world.mapData(), gate: game.mapGate(), crates: game.mapCrates() };
    },
    waypoint() { const w = game.waypoint(); if (!w) return null; const a = Math.atan2(-(w.x - player.x), -(w.z - player.z)) - viewYaw; return { dist: Math.round(w.dist), ang: Math.atan2(Math.sin(a), Math.cos(a)), text: w.text }; },
    get info() {
      if (!cfg) return null;
      const n = nearestUndiscovered(player.x, player.z), c = discCount();
      return {
        name, g: cfg.g, walked: player.walked, x: player.x, z: player.z, y: player.y, grounded: player.grounded, chunks: chunks.size, intro: state.intro,
        view: viewName(camDist), camDist, camGoal, camPulled: camOcc, camPos: [camera.position.x, camera.position.y, camera.position.z], driving, nearRover: !!nearRover(), driven, speed: driving ? car.speed : 0, air: driving ? !!car.air : false, rolling: driving ? !!car.barrel : false, stunts: { ...stuntLog }, boosting: driving ? !!car.boosting : false, vcap: driving ? car.vcap || 0 : 0, vehicle: driving ? car.kind : null, vehicleName: driving ? car.spec.name : null, stolen: driving && car !== rover,
        nearVehicle: (() => { if (driving || indoor || nearRover()) return null; const v = world.nearVehicle(player.x, player.z); return v ? { kind: v.kind, name: v.spec.name } : null; })(),
        nearContact: !driving && !indoor ? (world.nearContact()?.name || null) : null, duelist: !driving && !indoor ? world.nearDuelist() : null, duel: world.duel, nearShop: !driving && !indoor ? world.nearShop() : null,
        door: !driving && !indoor ? (() => { const d = world.nearDoor(); return d ? { name: d.name, kind: d.kind } : null; })() : null,
        inside: indoor ? world.inside : null, spot: indoor ? (() => { const s = world.nearSpot(); return s ? { id: s.id, label: s.label, act: s.act, who: s.who || null, stash: s.stash || null, perm: s.perm || null, ware: s.ware || null, venue: s.venue || null, crack: s.crack || null, difficulty: s.difficulty || 0 } : null; })() : null, wanted: world.wanted, evading: world.evading, colony: world.colony, roverAir: rover?.air, roverX: rover?.x, roverZ: rover?.z, roverY: rover?.y, roverYaw: rover?.yaw, roverRoll: rover?.roll, roverAlt: rover ? rover.y - height(rover.x, rover.z) : 0,
        carYaw: driving ? car.yaw : null, carAir: driving ? !!car.air : false, carAlt: driving ? (car.spec.hover ? car.lift || 0 : car.y - height(car.x, car.z)) : 0, kit: !!rover?.kit,
        faceYaw: player.faceYaw, camYawOff, lookIdle: time - lastLook,
        thrust: (() => { const r = driving ? car : rover; const can = driving && canThrust(car); return { can, on: !!(can && r.thrusting), fuel: r ? Math.round(r.fuel ?? 100) : 0, max: r ? FUEL_MAX(r) : 100, jet: r?.jet || 0 }; })(), viewYaw,
        dog: dog ? { mode: dog.mode, dist: Math.hypot(dog.x - player.x, dog.z - player.z), sit: dog.sit, air: dog.air, wag: dog.wag > 0, y: dog.y } : null,
        nearDog: !!dog && !driving && !indoor && Math.hypot(dog.x - player.x, dog.z - player.z) < 7,
        disc: c, next: n ? { dist: Math.round(n.dist), ang: Math.atan2(Math.sin(Math.atan2(-(n.it.x - player.x), -(n.it.z - player.z)) - viewYaw), Math.cos(Math.atan2(-(n.it.x - player.x), -(n.it.z - player.z)) - viewYaw)), id: n.it.d.id } : null,
        far: !!farMesh?.visible
      };
    }
  };
}
