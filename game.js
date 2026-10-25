// v7 game layer: missions (Control side quests + shady colony contacts), hostile xenofauna AI, weapons
// (plasma rifle with heat, shotgun with ammo, rover cannon), health with real stakes, ichor/debris FX,
// rewards, rare finds and salvage. The world layer (colonies, NPCs, vehicles, wanted level) plugs in
// through ctx hooks: targets(), friendlies(), allowFire(), solidAt(), colony(), world.
import * as THREE from 'three';
import { mergeGeos } from './models.js?v=7';

// ---------- Saved progress ----------
export const PROGRESS_KEY = 'ssx.progress.v1';
const DEFAULT_PROGRESS = () => ({
  v: 1, xp: 0, credits: 0, badges: [], unlocks: ['paint:steel', 'bandana:none'], equip: { paint: 'steel', bandana: 'none', weapon: 'rifle' },
  quests: {}, active: {}, rare: {}, settings: { aliens: true, voice: true, radio: 0 }, stats: { kills: 0, deaths: 0, shots: 0, busted: 0, stolen: 0 },
  inv: { medkits: 1, shells: 0 }, upgrades: []
});
export function loadProgress() {
  const d = DEFAULT_PROGRESS();
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (p && typeof p === 'object') return { ...d, ...p, equip: { ...d.equip, ...p.equip }, settings: { ...d.settings, ...p.settings }, stats: { ...d.stats, ...p.stats }, inv: { ...d.inv, ...p.inv }, upgrades: p.upgrades || [] };
  } catch (e) { /* ignore */ }
  return d;
}
export function saveProgress(p) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ } }

export const RANKS = [[0, 'Greenhorn'], [100, 'Prospector'], [250, 'Pathfinder'], [500, 'Ranger'], [900, 'Commander'], [1400, 'Legend']];
export function rankOf(xp) { let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++; return { i, name: RANKS[i][1], next: RANKS[i + 1]?.[0] ?? null, base: RANKS[i][0] }; }

export const COSMETICS = {
  paint: { steel: { name: 'Stainless', color: 0xb4b9c1 }, lunar: { name: 'Lunar White', color: 0xeef2f6 }, rust: { name: 'Rust Red', color: 0xb0482a }, gold: { name: 'Venus Gold', color: 0xd8a838 }, shadow: { name: 'Shadow Black', color: 0x34363d }, neon: { name: 'Io Neon', color: 0x2fd4c0 },
    hazard: { name: 'Hazard Yellow', color: 0xe0b020, shop: 80 }, oxide: { name: 'Oxide Maroon', color: 0x5a1c1c, shop: 80 }, camo: { name: 'Dust Camo', color: 0x7a6a48, shop: 80 } },
  bandana: { none: { name: 'No bandana' }, red: { name: 'Classic Red', color: 0xd23b3b }, stars: { name: 'Star Blue', color: 0x2a5cd8 }, green: { name: 'Mission Green', color: 0x3cc060 }, galaxy: { name: 'Galaxy Purple', color: 0x8a3cf0 },
    blackops: { name: 'Black Ops', color: 0x18181c, shop: 60 }, blaze: { name: 'Blaze Orange', color: 0xff6a00, shop: 60 } }
};
// the colony shop: weapons, gear, upgrades and cosmetics (cosmetics come from COSMETICS[*].shop)
export const SHOP = [
  { id: 'shotgun', name: 'Breacher shotgun', desc: '8-pellet scattergun. Ruins anything up close. Comes with 12 shells.', price: 150, kind: 'weapon' },
  { id: 'shells', name: 'Shotgun shells ×12', desc: 'Buckshot, plasma-tipped.', price: 30, kind: 'ammo', needs: 'weapon:shotgun' },
  { id: 'medkit', name: 'Trauma medkit', desc: 'Heals 50. Carry up to 3. Use with X or tap your health bar.', price: 40, kind: 'medkit' },
  { id: 'armor', name: 'Suit armor plating', desc: '+25 max shield.', price: 200, kind: 'upgrade' },
  { id: 'heatsink', name: 'Rifle heat sink', desc: 'Plasma rifle runs 35% cooler.', price: 180, kind: 'upgrade' },
  { id: 'roverarmor', name: 'Rover armor', desc: 'Your rover takes half damage.', price: 150, kind: 'upgrade' }
];

// ---------- Missions ----------
// Step types: goto (reach a spot, optionally grab an item), collect (n items), defeat (a hostile wave; a scan
// in peaceful mode), return (back to the ship), take (be driving a vehicle that is not your rover),
// clean (lose your wanted level), race (checkpoint rings), escort (keep a world convoy alive to its goal).
// Positions: a/d = compass angle (deg) and distance (m) from the landing site; at = [dx, dz] from the colony.
// Step extras: limit (seconds for this step), vehicle ('stolen' = must be driving a non-rover), wanted (stars at start).
export const QUESTS = [
  { id: 'moon-camera', world: 'Moon', title: 'Recover the lost Apollo camera', intro: 'Control. Apollo crews left their cameras behind to save weight. One of ours walked off near the old landing zone, and I doubt it walked on its own. Go get it back before some scavenger pawns it in Freeport.',
    steps: [{ type: 'goto', a: 60, d: 95, item: 'camera', text: 'Find the lost camera' }, { type: 'return', text: 'Bring the camera back to the ship' }],
    reward: { xp: 60, credits: 50, badge: 'Shutterbug', unlock: 'bandana:stars' }, fact: 'Apollo astronauts left about a dozen Hasselblad camera bodies on the Moon and brought home only the film, saving weight for Moon rocks.' },
  { id: 'moon-ice', world: 'Moon', title: 'Scan 3 ice deposits in Shackleton', intro: 'Control. The shadowed crater ahead is our stand-in for Shackleton. Scan three ice deposits. Water is worth more than gold up here, and everybody knows it.',
    steps: [{ type: 'collect', a: -100, d: 150, spread: 16, n: 3, item: 'icecore', text: 'Scan ice deposits' }],
    reward: { xp: 80, credits: 60, unlock: 'paint:lunar' }, fact: 'Shackleton crater sits almost exactly on the Moon\u2019s south pole. Parts of its floor never see sunlight, which makes it a top target in the hunt for ice.' },
  { id: 'moon-drones', world: 'Moon', title: 'Seekers at the crater rim', fiction: true, intro: 'Control. Something with wings and teeth is circling the crater rim. It already took apart a survey team. Clear them out, and don\u2019t let them dive on you.',
    steps: [{ type: 'defeat', a: -20, d: 120, wave: ['drone', 'drone', 'drone', 'crawler'], text: 'Kill the seekers' }],
    reward: { xp: 100, credits: 80, badge: 'Moon Defender' } },
  { id: 'mars-rescue', world: 'Mars', title: 'Rescue a stranded rover', fiction: true, intro: 'Control. A science rover went dark and its last frames show stalkers crawling all over it. Get out there, kill them, and reboot the damn thing. Watch the sand, they hide in it.',
    steps: [{ type: 'goto', a: -40, d: 130, r: 12, item: 'stuckrover', keep: true, text: 'Reach the stranded rover' }, { type: 'defeat', a: -40, d: 130, wave: ['crawler', 'crawler', 'crawler', 'hunter'], ambush: true, text: 'Kill the stalkers' }, { type: 'goto', a: -40, d: 130, r: 5, text: 'Reboot the rover' }],
    reward: { xp: 120, credits: 100, unlock: 'paint:rust' }, fact: 'For real: NASA\u2019s Spirit rover got stuck in soft sand on Mars in 2009. Engineers tried for months to free it, then turned it into a stationary science station.' },
  { id: 'mars-signal', world: 'Mars', title: 'Find the signal source', fiction: true, intro: 'Control. There\u2019s a repeating signal coming out of the badlands. The last team that went looking stopped answering. Follow the shards, find the source, and if it\u2019s a hive, burn it.',
    steps: [{ type: 'goto', a: 100, d: 120, r: 10, text: 'Triangulate the signal' }, { type: 'collect', a: 125, d: 170, spread: 14, n: 3, item: 'artifact', text: 'Collect resonant shards' },
      { type: 'goto', a: 160, d: 240, r: 14, outpost: true, text: 'Follow the signal to its source' }, { type: 'defeat', a: 160, d: 240, wave: ['nest', 'drone', 'crawler', 'crawler', 'hunter'], text: 'Purge the hive' },
      { type: 'defeat', a: 160, d: 240, wave: ['boss'], text: 'Kill the Hive Queen' }],
    reward: { xp: 300, credits: 250, badge: 'Xeno Hunter', unlock: 'bandana:galaxy' }, fact: 'The hive is pure fiction. Real scientists do listen for signals from space, though: SETI searches have run since 1960.' },
  { id: 'venus-capsule', world: 'Venus', title: 'Retrieve the Venera data capsule', limit: 100, intro: 'Control. A Venera-style data capsule is out there cooking. Your suit can take this hell for 100 seconds. Grab it and get back. Don\u2019t sightsee.',
    steps: [{ type: 'goto', a: 150, d: 140, item: 'capsule', text: 'Grab the data capsule' }, { type: 'return', text: 'Back to the ship before your suit cooks' }],
    reward: { xp: 130, credits: 120, badge: 'Heatproof', unlock: 'paint:gold' }, fact: 'Venus\u2019s surface is about 465 \u00b0C, hot enough to melt lead. The toughest Soviet Venera landers lasted only about two hours.' },
  { id: 'venus-drones', world: 'Venus', title: 'Things in the haze', fiction: true, intro: 'Control. Something is moving in the haze west of you. It\u2019s not weather. Find it and put it down.',
    steps: [{ type: 'defeat', a: -90, d: 130, wave: ['drone', 'drone', 'hunter', 'crawler'], text: 'Clear the haze' }],
    reward: { xp: 100, credits: 80 } },
  { id: 'mercury-sunrise', world: 'Mercury', title: 'Outrun the sunrise', limit: 55, intro: 'Control. Sunrise in 55 seconds and the day side hits 430 \u00b0C. Reach the shadow line or we scrape you off the regolith. Take the rover.',
    steps: [{ type: 'goto', a: 0, d: 380, r: 16, text: 'Reach the shadow line before sunrise' }],
    reward: { xp: 140, credits: 120, badge: 'Shadow Runner', unlock: 'paint:shadow' }, fact: 'A solar day on Mercury lasts 176 Earth days. At the equator the dawn line creeps along at only about 3.5 km/h, slow enough to walk ahead of it.' },
  { id: 'mercury-ice', world: 'Mercury', title: 'Map polar ice', intro: 'Control. MESSENGER spotted ice in Mercury\u2019s shadowed craters. Scan three deposits. Easy money, for once.',
    steps: [{ type: 'collect', a: -30, d: 120, spread: 16, n: 3, item: 'icecore', text: 'Scan polar ice' }],
    reward: { xp: 80, credits: 60 }, fact: 'Mercury may hold roughly 100 billion to 1 trillion tonnes of water ice in permanently shadowed craters near its poles.' },
  { id: 'earth-fetch', world: 'Earth', title: 'Fetch: the lost tennis balls', dog: true, intro: 'Control. Your dog has filed a formal complaint: three tennis balls missing. Honestly the most reasonable request I\u2019ve had all week.',
    steps: [{ type: 'collect', a: 30, d: 60, spread: 22, n: 3, item: 'ball', text: 'Find the tennis balls' }],
    reward: { xp: 60, credits: 40, badge: 'Good Dog', unlock: 'bandana:red' }, fact: 'A dog\u2019s nose has up to about 300 million scent receptors. Ours have about 6 million.' },
  { id: 'earth-picnic', world: 'Earth', title: 'Something in the treeline', fiction: true, intro: 'Control. A campsite down the hill went quiet an hour ago. Their beacon is still on. Go see. Take the rifle.',
    steps: [{ type: 'goto', a: -60, d: 80, r: 12, item: 'picnic', keep: true, text: 'Find the abandoned camp' }, { type: 'defeat', a: -60, d: 80, wave: ['crawler', 'crawler', 'crawler'], ambush: true, text: 'Kill whatever did this' }],
    reward: { xp: 90, credits: 60, unlock: 'bandana:green' } },
  { id: 'io-sample', world: 'Io', title: 'Sulfur sample sprint', limit: 80, intro: 'Control. Jupiter\u2019s radiation is cooking your suit as we speak. Grab a sulfur sample and get back in 80 seconds.',
    steps: [{ type: 'goto', a: -60, d: 150, item: 'sample', text: 'Grab a sulfur sample' }, { type: 'return', text: 'Back to the ship, fast' }],
    reward: { xp: 120, credits: 100, unlock: 'paint:neon' }, fact: 'Io orbits inside Jupiter\u2019s intense radiation belts. An unprotected person there would get a deadly dose in about a day.' },
  { id: 'europa-ice', world: 'Europa', title: 'Ice samples for the ocean hunters', intro: 'Control. The Europa Clipper team wants ground truth. Collect three ice samples near the cracks. Mind your footing.',
    steps: [{ type: 'collect', a: 30, d: 90, spread: 20, n: 3, item: 'sample', text: 'Collect ice samples' }],
    reward: { xp: 90, credits: 80 }, fact: 'Europa Clipper is planned to fly past Europa about 49 times, measuring how thick the ice is and studying the ocean below.' },
  { id: 'titan-sea', world: 'Titan', title: 'Sample a methane sea', fiction: true, intro: 'Control. Scoop a sample from the methane shore. Sensors also show movement in the haze. Big movement. Stay sharp.',
    steps: [{ type: 'goto', a: 60, d: 90, r: 14, item: 'sample', text: 'Scoop a methane sample' }, { type: 'defeat', a: 60, d: 90, wave: ['drone', 'drone', 'hunter'], text: 'Kill the haze hunters' }],
    reward: { xp: 110, credits: 90 }, fact: 'Titan\u2019s seas are liquid methane and ethane at about \u2212179 \u00b0C. Kraken Mare, the biggest, is larger than the Caspian Sea.' },
  // ----- colony contacts (fiction): talk to them at Ares Junction (Mars) and Freeport Tranquility (Moon) -----
  { id: 'mars-smuggle', world: 'Mars', contact: 'Rook', title: 'Smuggling run', fiction: true,
    intro: 'Rook: Crate on the loading dock, no questions. Grab it, borrow a ride that isn\u2019t your shiny registered rover, and get it to the old pumping station. Security\u2019s been tipped off, because of course they have. Don\u2019t get pinched.',
    steps: [{ type: 'goto', at: [-34, 18], r: 3, item: 'contraband', text: 'Grab the crate on the loading dock' }, { type: 'take', text: 'Steal a ride (not your rover)' },
      { type: 'goto', a: -60, d: 380, r: 12, vehicle: 'stolen', limit: 120, wanted: 2, text: 'Deliver to the pumping station' }],
    reward: { xp: 150, credits: 350, badge: 'Contraband' } },
  { id: 'mars-getaway', world: 'Mars', contact: 'Rook', title: 'Getaway driver', fiction: true,
    intro: 'Rook: My crew\u2019s about to make a withdrawal. You drive. Meet them behind the cantina, take whatever\u2019s fast, then get to the safehouse before security boxes you in. Then lose them. I mean it.',
    steps: [{ type: 'goto', at: [30, -28], r: 4, text: 'Meet the crew behind the cantina' }, { type: 'take', text: 'Grab a fast vehicle' },
      { type: 'goto', a: -175, d: 430, r: 14, vehicle: 'stolen', limit: 75, wanted: 3, text: 'Reach the safehouse' }, { type: 'clean', text: 'Lose your wanted level' }],
    reward: { xp: 170, credits: 300, unlock: 'paint:camo' } },
  { id: 'mars-cargo', world: 'Mars', contact: 'Vesna', title: 'Stolen cargo', fiction: true,
    intro: 'Vesna: The hive dragged off one of my ore pods. Not the ore, the pod. It\u2019s got my damn ledger in it. There\u2019s a nest out past the dunes. Burn it, bring back my pod, and I\u2019ll pay you like you\u2019re a professional.',
    steps: [{ type: 'goto', a: -150, d: 330, r: 18, text: 'Find the nest past the dunes' }, { type: 'defeat', a: -150, d: 330, wave: ['nest', 'crawler', 'crawler', 'hunter'], ambush: true, text: 'Burn out the nest' },
      { type: 'goto', a: -147, d: 336, r: 3, item: 'cargo', text: 'Recover the cargo pod' }, { type: 'goto', at: [8, 24], r: 6, text: 'Bring the pod back to Vesna' }],
    reward: { xp: 200, credits: 400, badge: 'Exterminator' } },
  { id: 'mars-race', world: 'Mars', contact: 'Vesna', title: 'Canyon sprint', fiction: true,
    intro: 'Vesna: Kids here race the junction loop for money. You look like you need money. Six gates, 70 seconds. Grab something quick. Bikes are fast, and they also flip.',
    steps: [{ type: 'take', text: 'Grab a fast vehicle' }, { type: 'race', pts: [[-40, -60], [-120, -60], [-170, 10], [-130, 90], [-50, 80], [0, 30]], limit: 70, text: 'Hit every gate' }],
    reward: { xp: 120, credits: 250, unlock: 'bandana:blaze' } },
  { id: 'moon-race', world: 'Moon', contact: 'Kestrel', title: 'Crater run', fiction: true,
    intro: 'Kestrel: Freeport\u2019s fastest lap is 52 seconds and it\u2019s mine. You get 60. Six gates round the crater. Steal a hover bike if you want a prayer.',
    steps: [{ type: 'take', text: 'Grab a fast vehicle (try a hover bike)' }, { type: 'race', pts: [[50, -40], [120, -20], [150, 50], [100, 120], [20, 100], [0, 35]], limit: 60, text: 'Hit every gate' }],
    reward: { xp: 120, credits: 250, unlock: 'paint:hazard' } }
];
const ALIEN_ZONES = { Moon: { a: -150, d: 220, wave: ['drone', 'drone', 'crawler'] }, Mars: { a: 40, d: 260, wave: ['nest', 'crawler', 'crawler', 'drone'] }, Venus: { a: -120, d: 230, wave: ['drone', 'hunter'] }, Mercury: { a: 80, d: 230, wave: ['crawler', 'drone', 'crawler'] },
  Io: { a: 100, d: 200, wave: ['drone', 'crawler'] }, Europa: { a: -120, d: 220, wave: ['nest', 'crawler'] }, Titan: { a: -150, d: 180, wave: ['drone', 'hunter'] } };

const RARE_TYPES = [
  { type: 'crystal', w: 0.38, name: 'Olivine crystals', xp: 15, credits: 10, fact: 'Olivine is a green mineral found in meteorites and in rocks on the Moon and Mars. On Earth, gem-quality olivine is called peridot.' },
  { type: 'meteorite', w: 0.27, name: 'Pallasite meteorite', xp: 15, credits: 15, fact: 'Pallasites are rare meteorites made of iron-nickel metal studded with olivine crystals. Most scientists think they formed where an asteroid\u2019s metal core met its rocky mantle.' },
  { type: 'salvage', w: 0.2, name: 'Wreck salvage', xp: 10, credits: 45, fact: 'Somebody\u2019s bad day: a stripped supply drone. The colony scrapyard pays for parts, no questions asked.' },
  { type: 'artifact', w: 0.15, name: 'Hive resin', xp: 25, credits: 30, fiction: true, fact: 'Hardened hive resin, still warm. Colony labs pay well for it and don\u2019t ask where you got it.' }
];

// ---------- Hostile xenofauna (fiction) ----------
// cy = height of the body centre above the ground (scaled), armor = fraction of damage soaked
export const AGENT_TYPES = {
  drone: { name: 'Seeker', hp: 4, speed: 10, hover: 4.5, r: 1.1, cy: 0, attack: 'shoot', dmg: 9, dive: 15, cd: 2.2, range: 34, keep: 12, xp: 12, credits: 8 },
  crawler: { name: 'Stalker', hp: 5, speed: 9, hover: 0, r: 1.15, cy: 0.95, attack: 'melee', dmg: 16, cd: 1.1, range: 2.7, keep: 0, xp: 15, credits: 10, flank: true },
  hunter: { name: 'Hunter', hp: 9, armor: 0.3, speed: 6, hover: 0, r: 1.35, cy: 1.7, attack: 'shoot', dmg: 11, burst: 3, cd: 2.4, range: 42, keep: 18, xp: 30, credits: 22, flank: true },
  nest: { name: 'Hive nest', hp: 26, speed: 0, hover: 0, r: 2.7, cy: 1.2, attack: 'spawn', cd: 8, range: 60, keep: 0, xp: 50, credits: 40, still: true },
  boss: { name: 'Hive Queen', hp: 64, armor: 0.2, speed: 6.5, hover: 0, r: 3.2, cy: 2.5, scale: 2.6, attack: 'shoot', dmg: 18, swipe: 30, cd: 1.5, range: 46, keep: 14, xp: 150, credits: 120, boss: true }
};
export const WEAPONS = {
  rifle: { name: 'Plasma rifle', cd: 0.13, dmg: 1.1, speed: 110, color: 0x7fe9ff, size: 1, heat: 6.5, life: 1.0 },
  shotgun: { name: 'Shotgun', cd: 0.8, dmg: 1.0, pellets: 8, spread: 0.075, speed: 85, color: 0xffb347, size: 0.75, ammo: 'shells', life: 0.4 },
  roverCannon: { name: 'Rover cannon', cd: 0.11, dmg: 1.5, speed: 120, color: 0xff5cf0, size: 1.7, heat: 6, twin: true, life: 1.1 }
};

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...o });
const B = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
function glowTex(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, c0); r.addColorStop(0.35, c1); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// matrix helpers for merging static model parts into one geometry per material (few draw calls on phones)
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const mx = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
function limb(list, geo, a, b, r) {
  const A0 = new THREE.Vector3(...a), B0 = new THREE.Vector3(...b), d = B0.clone().sub(A0), len = d.length();
  list.push([geo, new THREE.Matrix4().compose(A0.clone().add(B0).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(r, len, r))]);
}

const A = {};
function assets() {
  if (A.ok) return A; A.ok = true;
  const S = new THREE.SphereGeometry(1, 12, 9), C = new THREE.CylinderGeometry(1, 0.75, 1, 7), K = new THREE.ConeGeometry(1, 1, 5), X = new THREE.BoxGeometry(1, 1, 1), I = new THREE.IcosahedronGeometry(1, 0);
  A.uSph = S; A.uCone = K;
  // --- stalker (xeno crawler): long skull, dorsal tubes, ribbed back, glowing slits ---
  let ch = [], gl = [], bo = [];
  ch.push([S, mx(0, 0.95, 0.15, 0.4, 0.36, 0.8)], [S, mx(0, 1.0, 0.85, 0.34, 0.32, 0.5)], [S, mx(0, 1.05, -0.55, 0.18, 0.18, 0.3)],
    [S, mx(0, 1.15, -0.95, 0.24, 0.22, 0.5, 0.1)], [S, mx(0, 1.4, -0.5, 0.2, 0.16, 0.62, -0.45)], [S, mx(0, 0.98, -1.15, 0.15, 0.09, 0.3)]);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { limb(ch, C, [s * 0.16, 1.18, -0.3 + i * 0.28], [s * 0.24, 1.58, 0.02 + i * 0.28], 0.05); gl.push([S, mx(s * 0.24, 1.6, 0.03 + i * 0.28, 0.06)]); }
  for (let i = 0; i < 6; i++) ch.push([K, mx(0, 1.3 - i * 0.02, -0.25 + i * 0.22, 0.06, 0.24, 0.06, 0.6)]);
  for (let i = 0; i < 5; i++) ch.push([S, mx(0, 0.72, -0.2 + i * 0.22, 0.3 - i * 0.02, 0.05, 0.08)]); // ventral ribs
  for (const s of [-1, 1]) {
    limb(ch, C, [s * 0.25, 0.92, -0.45], [s * 0.42, 0.62, -0.88], 0.055); ch.push([K, mx(s * 0.44, 0.52, -1.02, 0.04, 0.26, 0.04, -1.9)]);
    for (let k = 0; k < 3; k++) gl.push([X, mx(s * 0.215, 1.18 - k * 0.04, -0.88 - k * 0.12, 0.02, 0.025, 0.1)]);
  }
  gl.push([S, mx(0, 0.78, 0.35, 0.18, 0.07, 0.38)]);
  for (let k = 0; k < 6; k++) bo.push([K, mx((k - 2.5) * 0.045, 0.94, -1.3 + Math.abs(k - 2.5) * 0.03, 0.022, 0.09, 0.022, Math.PI)]);
  A.stalkerGeo = mergeGeos(ch); A.stalkerGlow = mergeGeos(gl); A.teethGeo = mergeGeos(bo);
  const lg = []; limb(lg, C, [0, 0, 0], [0.5, 0.36, 0], 0.075); limb(lg, C, [0.5, 0.36, 0], [0.72, -0.95, 0.05], 0.05); lg.push([K, mx(0.73, -0.98, 0.0, 0.04, 0.14, 0.04, 0, 0, Math.PI)]);
  A.stalkerLeg = mergeGeos(lg);
  const crest = []; for (let i = 0; i < 7; i++) crest.push([K, mx((i - 3) * 0.09, 1.62, -0.15, 0.05, 0.9, 0.03, 1.0, 0, (i - 3) * 0.22)]);
  A.queenCrest = mergeGeos(crest);
  const sacs = []; for (let i = 0; i < 4; i++) sacs.push([S, mx((i % 2 ? 0.2 : -0.2), 1.05 + (i > 1 ? 0.1 : 0), 0.7 + (i > 1 ? 0.3 : 0), 0.16, 0.14, 0.2)]);
  A.queenSacs = mergeGeos(sacs);
  // --- hunter: armored digitigrade biped with an arm cannon and three red eyes ---
  const ar = [], fl = [], hg = [];
  ar.push([X, mx(0, 2.05, 0, 1.0, 0.8, 0.7)], [X, mx(0, 1.58, 0.05, 0.7, 0.32, 0.5)], [X, mx(0, 2.75, -0.12, 0.42, 0.38, 0.5)], [K, mx(0, 3.02, -0.02, 0.08, 0.35, 0.3)],
    [X, mx(0, 2.15, 0.45, 0.7, 0.6, 0.3)], [X, mx(-0.74, 1.72, -0.22, 0.22, 0.26, 0.62)]);
  for (const s of [-1, 1]) ar.push([S, mx(s * 0.66, 2.42, 0, 0.36, 0.24, 0.42)]);
  ar.push([C, mx(0.76, 1.74, -0.4, 0.15, 0.95, 0.15, Math.PI / 2)]); ar.push([X, mx(0.76, 1.95, -0.25, 0.12, 0.2, 0.5)]);
  for (const s of [-1, 1]) limb(fl, C, [s * 0.6, 2.3, 0], [s * 0.74, 1.85, -0.1], 0.13);
  limb(fl, C, [0, 2.45, -0.1], [0, 2.62, -0.12], 0.14); limb(fl, C, [-0.74, 1.6, -0.5], [-0.8, 1.35, -0.75], 0.05); limb(fl, C, [-0.66, 1.6, -0.5], [-0.66, 1.33, -0.78], 0.05);
  hg.push([S, mx(-0.12, 2.78, -0.38, 0.045)], [S, mx(0.12, 2.78, -0.38, 0.045)], [S, mx(0, 2.88, -0.38, 0.04)], [S, mx(0.76, 1.74, -0.88, 0.11, 0.11, 0.04)]);
  for (const s of [-1, 1]) hg.push([X, mx(s * 0.26, 2.0, -0.36, 0.14, 0.05, 0.02)]);
  A.hunterArmor = mergeGeos(ar); A.hunterFlesh = mergeGeos(fl); A.hunterGlow = mergeGeos(hg);
  const hl = []; limb(hl, C, [0, 0, 0], [0, -0.62, -0.36], 0.17); limb(hl, C, [0, -0.62, -0.36], [0, -1.1, 0.2], 0.11); limb(hl, C, [0, -1.1, 0.2], [0, -1.45, -0.05], 0.09);
  hl.push([X, mx(0, -1.47, -0.2, 0.22, 0.08, 0.4)], [X, mx(0, -0.3, -0.25, 0.26, 0.4, 0.12, -0.5)]);
  A.hunterLeg = mergeGeos(hl);
  // --- seeker: biomech flyer with membrane wings and a tail stinger ---
  const sk = [], sg = [];
  sk.push([I, mx(0, 0, 0, 0.55, 0.42, 0.95)], [I, mx(0, 0.05, -0.85, 0.3, 0.25, 0.42)], [K, mx(0, -0.08, 1.15, 0.08, 0.7, 0.08, Math.PI / 2)]);
  for (let i = 0; i < 5; i++) sk.push([K, mx(0, 0.38, -0.4 + i * 0.22, 0.05, 0.3, 0.05, 0.5)]);
  for (const s of [-1, 1]) sk.push([K, mx(s * 0.14, -0.1, -1.25, 0.04, 0.3, 0.04, -1.7, 0, s * 0.3)]);
  for (let i = 0; i < 4; i++) sg.push([S, mx((i % 2 ? 0.1 : -0.1), 0.1 + (i > 1 ? 0.08 : 0), -1.15, 0.05)]);
  sg.push([S, mx(0, -0.32, 0.15, 0.3, 0.16, 0.45)]);
  A.seekerGeo = mergeGeos(sk); A.seekerGlow = mergeGeos(sg);
  const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.lineTo(1.5, 0.3); ws.lineTo(1.7, -0.15); ws.lineTo(1.0, -0.45); ws.lineTo(0.5, -0.3); ws.lineTo(0, -0.35);
  A.wingGeo = new THREE.ShapeGeometry(ws); A.wingGeo.rotateX(-Math.PI / 2);
  // --- hive nest: lumpy resin mound, ribs, tendrils and glowing egg pods ---
  const mound = new THREE.IcosahedronGeometry(1, 2), mp = mound.attributes.position;
  for (let i = 0; i < mp.count; i++) { const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i), n = 1 + 0.18 * Math.sin(x * 5.1 + z * 3.3) + 0.12 * Math.sin(y * 7.7 + x * 2.1); mp.setXYZ(i, x * n, Math.max(-0.2, y) * n, z * n); }
  mound.computeVertexNormals();
  const ns = [[mound, mx(0, 0.4, 0, 2.6, 1.6, 2.6)]];
  for (let i = 0; i < 6; i++) ns.push([new THREE.TorusGeometry(2.3, 0.13, 5, 12, Math.PI), mx(0, 0.2, 0, 1, 1, 1, 0, i * Math.PI / 6, 0)]);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ns.push([K, mx(Math.cos(a) * 3.3, 0.15, Math.sin(a) * 3.3, 0.16, 2.4, 0.16, 0, -a, Math.PI / 2 - 0.08)]); }
  A.nestGeo = mergeGeos(ns);
  const pods = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; pods.push([S, mx(Math.cos(a) * 2.5, 0.35, Math.sin(a) * 2.5, 0.34, 0.46, 0.34)]); }
  pods.push([S, mx(0, 2.05, 0, 0.5, 0.35, 0.5)]);
  A.podGeo = mergeGeos(pods);
  // --- materials ---
  A.mChitin = M(0x17181d, { roughness: 0.28, metalness: 0.35, emissive: 0x060709 }); A.mQueen = M(0x1e1517, { roughness: 0.3, metalness: 0.35, emissive: 0x0b0304 });
  A.mArmor = M(0x3c4047, { roughness: 0.42, metalness: 0.6, flatShading: true }); A.mBone = M(0xcfc6a8, { roughness: 0.6 });
  A.mGlowG = B(0x8dff3a); A.mGlowR = B(0xff3a22); A.mGlowY = B(0xd8ff4a); A.mGlowO = B(0xff7a1e);
  A.mWing = new THREE.MeshStandardMaterial({ color: 0x4a1c26, transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 0.6 });
  A.mResin = M(0x261d21, { roughness: 0.35, metalness: 0.15, flatShading: true }); A.mPod = M(0xffa040, { emissive: 0xff7a10, emissiveIntensity: 1.1, roughness: 0.3 });
  A.acidGeo = new THREE.SphereGeometry(0.24, 8, 6); A.mAcid = B(0x9dff3a, { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  A.boltGeo = (() => { const g = new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6); g.rotateX(Math.PI / 2); return g; })();
  const bm = c => B(c, { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  A.mBolt = { 0x7fe9ff: bm(0x7fe9ff), 0xff5cf0: bm(0xff5cf0), 0xffb347: bm(0xffb347), 0xff3a2a: bm(0xff3a2a) };
  A.sparkTex = glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)');
  A.flashMat = new THREE.SpriteMaterial({ map: glowTex('rgba(255,240,255,1)', 'rgba(255,90,240,0.6)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  A.pickBeam = (() => { const g = new THREE.CylinderGeometry(0.25, 0.25, 30, 6, 1, true); g.translate(0, 15, 0); return g; })();
  A.mPickBeam = B(0x4fd8ff, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  A.zoneRing = new THREE.RingGeometry(16, 17.5, 40); A.mZone = B(0x6aff2a, { transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
  A.gateGeo = new THREE.TorusGeometry(5, 0.35, 6, 24); A.mGate = B(0xffd84a, { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  A.debrisGeo = new THREE.TetrahedronGeometry(0.22, 0); A.mDebris = M(0xffffff, { roughness: 0.4, metalness: 0.3, flatShading: true });
  A.splatGeo = new THREE.CircleGeometry(1, 10); A.splatGeo.rotateX(-Math.PI / 2); A.mSplat = B(0x6aff1a, { transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  A.mGreen = B(0x3cff6a); A.mWhite = M(0xe8e8e8); A.mRed = B(0xff2a2a); A.mCrate = M(0x6a5a3a, { roughness: 0.8 }); A.mShell = M(0xd0601a, { metalness: 0.4 });
  for (const k in A) { const v = A[k]; if (v && (v.isBufferGeometry || v.isMaterial)) v.userData.shared = true; }
  for (const k in A.mBolt) A.mBolt[k].userData.shared = true;
  A.sparkTex.userData.shared = true; A.flashMat.map.userData.shared = true;
  return A;
}

function buildStalker(queen = false) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mc = queen ? A.mQueen : A.mChitin, mg = queen ? A.mGlowO : A.mGlowG;
  body.add(new THREE.Mesh(A.stalkerGeo, mc), new THREE.Mesh(A.stalkerGlow, mg), new THREE.Mesh(A.teethGeo, A.mBone));
  if (queen) body.add(new THREE.Mesh(A.queenCrest, mc), new THREE.Mesh(A.queenSacs, A.mGlowO));
  const legs = [];
  for (const [x, z] of [[0.3, -0.2], [0.3, 0.55], [-0.3, -0.2], [-0.3, 0.55]]) { const l = new THREE.Mesh(A.stalkerLeg, mc); l.position.set(x, 0.95, z); if (x < 0) l.scale.x = -1; body.add(l); legs.push(l); }
  const tail = []; let parent = body;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i ? 0 : 1.0, i ? 0.36 : 1.3); parent.add(seg);
    const m = new THREE.Mesh(A.uSph, mc); m.scale.set(0.12 - i * 0.017, 0.11 - i * 0.015, 0.24); m.position.z = 0.18; seg.add(m);
    tail.push(seg); parent = seg;
  }
  const tip = new THREE.Mesh(A.uCone, A.mBone); tip.scale.set(0.07, 0.42, 0.025); tip.rotation.x = Math.PI / 2; tip.position.z = 0.5; parent.add(tip);
  return { group: g, body, legs, tail, kind: 'stalker' };
}
function buildHunter() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(new THREE.Mesh(A.hunterArmor, A.mArmor), new THREE.Mesh(A.hunterFlesh, A.mChitin), new THREE.Mesh(A.hunterGlow, A.mGlowR));
  const legs = [];
  for (const x of [-0.3, 0.3]) { const l = new THREE.Mesh(A.hunterLeg, A.mArmor); l.position.set(x, 1.45, 0.05); body.add(l); legs.push(l); }
  return { group: g, body, legs, kind: 'hunter' };
}
function buildSeeker() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(new THREE.Mesh(A.seekerGeo, A.mChitin), new THREE.Mesh(A.seekerGlow, A.mGlowY));
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Mesh(A.wingGeo, A.mWing); w.position.set(s * 0.35, 0.18, -0.1); w.scale.x = s; body.add(w); wings.push(w); }
  return { group: g, body, wings, kind: 'seeker' };
}
function buildNest() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(new THREE.Mesh(A.nestGeo, A.mResin)); const pods = new THREE.Mesh(A.podGeo, A.mPod); body.add(pods);
  return { group: g, body, pods, kind: 'nest' };
}
const BUILDERS = { drone: buildSeeker, crawler: () => buildStalker(false), hunter: buildHunter, nest: buildNest, boss: () => buildStalker(true) };

const ITEM_BUILD = {
  camera() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.35), M(0x9a9a9a)); b.position.y = 0.25; g.add(b); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.25, 12), M(0x222222)); l.rotation.x = Math.PI / 2; l.position.set(0, 0.25, -0.28); g.add(l); return g; },
  icecore() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), M(0xcff4ff, { emissive: 0x2a5a7a, roughness: 0.1, flatShading: true })); c.scale.y = 1.5; c.position.y = 0.7; g.add(c); return g; },
  artifact() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.TetrahedronGeometry(0.5, 0), M(0x3a2a10, { emissive: 0xc07a10, emissiveIntensity: 0.8, flatShading: true })); c.position.y = 0.9; g.add(c); g.userData.spin = c; return g; },
  capsule() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), M(0xd0d0d0, { metalness: 0.25 })); c.position.y = 0.45; g.add(c); const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16), M(0xc03030)); band.rotation.x = Math.PI / 2; band.position.y = 0.45; g.add(band); return g; },
  ball() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M(0xd6f03a, { roughness: 0.9 })); c.position.y = 0.2; g.add(c); return g; },
  sample() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 10), M(0xeeeeee, { emissive: 0x224455 })); c.position.y = 0.35; g.add(c); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10), M(0x2a8ad8)); cap.position.y = 0.75; g.add(cap); return g; },
  stuckrover() {
    const g = new THREE.Group(), w = M(0xb8b8b8), d = M(0x2a2a2a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 3), w); b.position.y = 1.0; b.rotation.z = 0.12; g.add(b);
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 10), d); wh.rotation.z = Math.PI / 2; wh.position.set(s * 1.2, 0.25, k * 1.15); g.add(wh); }
    const gouge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.6), M(0x2a3a18, { emissive: 0x2a5a10 })); gouge.position.set(1.02, 1.05, 0.2); gouge.rotation.z = 0.12; g.add(gouge);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), w); m.position.set(0.6, 2.1, 1.2); g.add(m);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), B(0xff3030)); light.position.set(0.6, 2.95, 1.2); g.add(light); g.userData.light = light; return g;
  },
  picnic() {
    const g = new THREE.Group();
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.8, 4, 1, true), M(0x4a5a3a, { side: THREE.DoubleSide, flatShading: true })); tent.position.y = 0.9; tent.rotation.z = 0.5; g.add(tent);
    const bx = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.45), M(0x5a4a3a)); bx.position.set(1.4, 0.22, 0.6); bx.rotation.y = 0.7; g.add(bx);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), B(0xffb040)); lamp.position.set(-1.1, 0.12, 0.8); g.add(lamp); return g;
  },
  outpost() {
    const g = new THREE.Group(), m = A.mResin, glow = A.mGlowG;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); g.add(dome);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.6, 8, 5), m); sp.position.set(Math.cos(a) * 9, 4, Math.sin(a) * 9); sp.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); g.add(sp);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glow); tip.position.set(Math.cos(a) * 9.6, 8, Math.sin(a) * 9.6); g.add(tip);
    }
    const door = new THREE.Mesh(new THREE.CircleGeometry(1.8, 14), glow); door.position.set(0, 1.6, 6.8); g.add(door); return g;
  },
  crystal() { const g = new THREE.Group(), m = M(0x6ad84a, { emissive: 0x1a4a10, roughness: 0.2, flatShading: true }); for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + i * 0.05, 0), m); c.scale.y = 2.2; c.position.set(Math.cos(i * 1.3) * 0.3, 0.35, Math.sin(i * 1.3) * 0.3); c.rotation.z = (i - 2) * 0.25; g.add(c); } return g; },
  meteorite() { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), M(0x5a4a3a, { metalness: 0.25, flatShading: true })); r.position.y = 0.4; g.add(r); const sm = M(0xa0d84a, { emissive: 0x204010 }); for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), sm); s.position.set(Math.cos(i) * 0.5, 0.4 + Math.sin(i * 2) * 0.3, Math.sin(i) * 0.5); g.add(s); } return g; },
  salvage() { const g = new THREE.Group(), m = M(0x6a6e76, { metalness: 0.6, roughness: 0.4, flatShading: true }); const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), m); b.position.y = 0.2; b.rotation.set(0.2, 0.5, 0.3); g.add(b); const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 5, 10), m); r.position.set(0.7, 0.15, 0.3); r.rotation.x = 1.3; g.add(r); const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), B(0xff3a22)); l.position.set(-0.3, 0.45, 0); g.add(l); return g; },
  contraband() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), A.mCrate); b.position.y = 0.4; g.add(b); const s = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.12, 0.82), B(0xff3a22)); s.position.y = 0.55; g.add(s); return g; },
  cargo() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 10), M(0x8a7a5a, { metalness: 0.5 })); c.rotation.z = Math.PI / 2; c.position.y = 0.55; g.add(c); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.2, 10), A.mGlowG); s.rotation.z = Math.PI / 2; s.position.set(0.3, 0.55, 0); g.add(s); return g; },
  medkit() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), A.mWhite); b.position.y = 0.3; g.add(b); for (const [w, d] of [[0.42, 0.12], [0.12, 0.34]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), A.mRed); c.position.y = 0.48; g.add(c); } g.userData.spin = g; return g; },
  shells() { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 6), A.mShell); s.position.set((i - 1.5) * 0.14, 0.2, 0); g.add(s); } g.userData.spin = g; return g; }
};

// ctx: { scene, camera, isMobile, onEvent(type, data), height(x,z), player, st() -> {name,cfg,driving,rover,dog,camDist,intro,outro},
//        safePoint(a,d) -> {x,z}, SHIP, respawn(), dogAlert(x,z) }
export function createGame(ctx) {
  const { scene, camera, isMobile, onEvent, height } = ctx;
  const player = ctx.player;
  const CAP = isMobile ? 6 : 9;
  let P = loadProgress();
  const save = () => saveProgress(P);
  let world = null, time = 0, cfg = null;

  let agents = [], bolts = [], orbs = [], rares = [], zone = null, outpost = null;
  let sparks = null, turret = null, bandana = null;
  const H = { hp: 100, max: 100, shield: 60, smax: 60, lastHit: -99, down: 0, inv: 0 };
  const W = { cd: 0, heat: 0, over: false, lastShot: -9, flash: 0, side: 0, recoil: 0 };
  let quest = null; // the active quest in this world: { def, step, items, t0, killed, wave, target, got }
  let warnCd = 0, bossRef = null;
  const aim = { x: 0, y: 0, has: false };
  const offerTimers = [];

  const qState = id => (P.quests[id] ||= { status: 'new', step: 0, n: 0 });
  const isDone = id => !!P.quests[id]?.everDone;
  const aliensOn = () => P.settings.aliens !== false;

  // ----- sparkle bursts (one pooled Points buffer) -----
  function makeSparks() {
    const N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 4), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.7, map: A.sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.frustumCulled = false; scene.add(pts);
    return { pts, N, vel: new Float32Array(N * 3), life: new Float32Array(N), rgb: new Float32Array(N * 3), next: 0 };
  }
  const PALETTE = [[1, 0.5, 0.95], [0.5, 0.95, 1], [1, 0.9, 0.4], [0.6, 1, 0.6], [1, 1, 1]];
  const rv = new THREE.Vector3();
  function burst(x, y, z, n, spd = 6, colors = PALETTE) {
    if (!sparks) return;
    const S = sparks, p = S.pts.geometry.attributes.position.array;
    for (let k = 0; k < n; k++) {
      const i = S.next; S.next = (i + 1) % S.N;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      rv.randomDirection().multiplyScalar(spd * (0.4 + Math.random() * 0.8));
      S.vel[i * 3] = rv.x; S.vel[i * 3 + 1] = rv.y + spd * 0.3; S.vel[i * 3 + 2] = rv.z; S.life[i] = 0.7 + Math.random() * 0.6;
      S.rgb.set(colors[(Math.random() * colors.length) | 0], i * 3);
    }
  }
  function updateSparks(dt) {
    const S = sparks, p = S.pts.geometry.attributes.position.array, c = S.pts.geometry.attributes.color.array;
    const k = Math.exp(-dt * 2.5);
    for (let i = 0; i < S.N; i++) {
      if (S.life[i] <= 0) { c[i * 4 + 3] = 0; continue; }
      S.life[i] -= dt;
      S.vel[i * 3] *= k; S.vel[i * 3 + 1] = S.vel[i * 3 + 1] * k - 3 * dt; S.vel[i * 3 + 2] *= k;
      p[i * 3] += S.vel[i * 3] * dt; p[i * 3 + 1] += S.vel[i * 3 + 1] * dt; p[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
      c[i * 4] = S.rgb[i * 3]; c[i * 4 + 1] = S.rgb[i * 3 + 1]; c[i * 4 + 2] = S.rgb[i * 3 + 2]; c[i * 4 + 3] = Math.min(1, S.life[i] * 1.6);
    }
    S.pts.geometry.attributes.position.needsUpdate = true; S.pts.geometry.attributes.color.needsUpdate = true;
  }

  // ----- ichor, debris and splats (pooled, cheap) -----
  const ICHOR = [[0.55, 1, 0.18], [0.75, 1, 0.3], [0.3, 0.8, 0.08], [0.9, 1, 0.5]], ICHOR_H = [[1, 0.35, 0.12], [0.55, 1, 0.18], [1, 0.6, 0.2]], DUSTC = [[0.55, 0.45, 0.35], [0.4, 0.33, 0.25]];
  let debrisL = [], splats = [], pickups = [];
  function debris(c, n, mat, big = 1) {
    for (let k = 0; k < n && debrisL.length < 48; k++) {
      const m = new THREE.Mesh(A.debrisGeo, mat); m.position.copy(c); m.scale.setScalar((0.6 + Math.random() * 1.2) * Math.sqrt(big)); scene.add(m);
      rv.randomDirection(); debrisL.push({ m, v: new THREE.Vector3(rv.x * 7, Math.abs(rv.y) * 8 + 3, rv.z * 7).multiplyScalar(0.6 + Math.random() * 0.6), s: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), life: 2.5 + Math.random() * 1.5 });
    }
  }
  function updateDebris(dt) {
    for (const d of [...debrisL]) {
      d.life -= dt; d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.s.x * dt; d.m.rotation.y += d.s.y * dt;
      const gh = height(d.m.position.x, d.m.position.z) + 0.1; if (d.m.position.y < gh) { d.m.position.y = gh; d.v.multiplyScalar(0.35); d.v.y = Math.abs(d.v.y) * 0.4; d.s.multiplyScalar(0.5); }
      if (d.life < 0.5) d.m.scale.multiplyScalar(1 - dt * 3);
      if (d.life <= 0) { scene.remove(d.m); debrisL.splice(debrisL.indexOf(d), 1); }
    }
    for (const s of [...splats]) { s.life -= dt; if (s.life < 4) s.m.scale.setScalar(s.r * Math.max(0.01, s.life / 4)); if (s.life <= 0) { scene.remove(s.m); splats.splice(splats.indexOf(s), 1); } }
  }
  function splat(x, z, r) {
    if (splats.length >= 14) { const o = splats.shift(); scene.remove(o.m); }
    const m = new THREE.Mesh(A.splatGeo, A.mSplat); m.position.set(x, height(x, z) + 0.07, z); m.rotation.y = Math.random() * 6; m.scale.setScalar(r); scene.add(m);
    splats.push({ m, r, life: 30 });
  }
  // medkits and shells dropped by kills; walk over them
  function drop(kind, x, z) {
    const obj = ITEM_BUILD[kind](); obj.position.set(x, height(x, z) + 0.1, z); scene.add(obj);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.sparkTex, color: kind === 'medkit' ? 0xff5050 : 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.position.y = 0.9; sp.scale.setScalar(1.2); obj.add(sp);
    pickups.push({ obj, kind, x, z, life: 45 });
  }
  function maybeDrop(x, z, a) {
    const r = Math.random(), big = a.T.boss || a.type === 'nest';
    if (big || r < 0.22) drop('medkit', x + 0.8, z);
    if (P.unlocks.includes('weapon:shotgun') && (big || Math.random() < 0.3)) drop('shells', x - 0.8, z + 0.5);
  }
  function updatePickups(dt) {
    for (const p of [...pickups]) {
      p.life -= dt; p.obj.rotation.y += dt * 2;
      const near = Math.hypot(p.x - player.x, p.z - player.z) < (ctx.st().driving ? 3.5 : 2.2);
      if (near || p.life <= 0) {
        scene.remove(p.obj); pickups.splice(pickups.indexOf(p), 1); if (!near) continue;
        if (p.kind === 'medkit') { if (P.inv.medkits < 3) { P.inv.medkits++; onEvent('pickup', { name: `Medkit (${P.inv.medkits}/3)` }); } else { H.hp = Math.min(H.max, H.hp + 25); onEvent('pickup', { name: 'Patched up +25' }); } }
        else { P.inv.shells = Math.min(48, P.inv.shells + 6); onEvent('pickup', { name: `Shells +6 (${P.inv.shells})` }); }
        save();
      }
    }
  }

  // ----- hostile AI: stalkers flank and lunge (some wait burrowed), hunters strafe and burst-fire from range,
  //       seekers circle and dive, nests birth stalkers, the queen spits acid, swipes and calls her brood -----
  function spawnAgent(type, x, z, opts = {}) {
    if (agents.length >= CAP || !aliensOn()) return null;
    const T = AGENT_TYPES[type], m = BUILDERS[type]();
    if (T.scale) m.group.scale.setScalar(T.scale);
    const burrow = !!opts.burrow && !T.hover && !T.still;
    const y = height(x, z) + T.hover - (burrow ? 3 : 0);
    m.group.position.set(x, y, z); m.group.rotation.y = Math.random() * 6; scene.add(m.group);
    const a = { type, T, ...m, x, y, z, vy: 0, hp: T.hp, cd: 1 + Math.random() * T.cd, aggro: !!opts.aggro && !burrow, home: { x, z }, src: opts.src || null, phase: Math.random() * 6, hit: 0, yaw: m.group.rotation.y,
      orbitDir: Math.random() < 0.5 ? -1 : 1, summon: 9, burrow, flank: (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.5), lunge: 0, dive: 0, diveCd: 4 + Math.random() * 4, burstLeft: 0, burstT: 0, strafeT: 1, swipeCd: 2 };
    agents.push(a); if (T.boss) bossRef = a;
    if (!burrow) burst(x, y + 1, z, 10, 3, DUSTC);
    return a;
  }
  function removeAgent(a) { scene.remove(a.group); const i = agents.indexOf(a); if (i >= 0) agents.splice(i, 1); if (a === bossRef) bossRef = null; }
  function killAgent(a) {
    const c = center(a).clone(), big = a.T.boss ? 3 : a.type === 'nest' ? 2.2 : a.type === 'hunter' ? 1.4 : 1;
    burst(c.x, c.y, c.z, Math.round(38 * big), 7 * Math.sqrt(big), a.type === 'hunter' ? ICHOR_H : ICHOR);
    debris(c, Math.round(6 * big), a.type === 'hunter' ? A.mArmor : a.type === 'nest' ? A.mResin : A.mChitin, big);
    splat(c.x, c.z, 1.1 * big);
    removeAgent(a);
    P.stats.kills++; gain(a.T.xp, a.T.credits, true);
    onEvent('poof', { type: a.type, xp: a.T.xp, boss: !!a.T.boss, name: a.T.name });
    maybeDrop(c.x, c.z, a);
    if (a.src === 'zone' && zone) { zone.left--; if (zone.left <= 0) { zone.cool = 90; zone.active = false; onEvent('toast', { text: '☣️ Hive zone cleared. For now.' }); } }
    if (a.src === 'quest' && quest) { quest.killed++; onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() }); checkStep(); }
  }
  const target = () => { const st = ctx.st(); return st.driving ? { x: st.rover.x, y: st.rover.y + 1.6, z: st.rover.z, r: 2.6 } : { x: player.x, y: player.y - 0.7, z: player.z, r: 0.9 }; };
  function updateAgents(dt) {
    const st = ctx.st(), tg = target();
    for (const a of [...agents]) {
      const T = a.T, dx = tg.x - a.x, dz = tg.z - a.z, dist = Math.hypot(dx, dz) || 0.001;
      a.phase += dt; a.hit = Math.max(0, a.hit - dt * 5);
      if (a.burrow) { // waiting under the sand until you walk too close
        if (dist < 15 && H.down <= 0 && st.intro <= 0) { a.burrow = false; a.aggro = true; a.y = height(a.x, a.z) - 0.5; a.vy = 7; burst(a.x, a.y + 1, a.z, 22, 6, DUSTC); onEvent('ambush', {}); }
        else continue;
      }
      if (!a.aggro && dist < 48) a.aggro = true;
      const calm = H.down > 0 || !a.aggro || st.intro > 0;
      if (T.still) { // nest
        if (a.pods) a.pods.scale.setScalar(1 + Math.sin(a.phase * 3) * 0.06 + a.hit * 0.25);
        a.body.scale.setScalar(1 + a.hit * 0.08);
        a.cd -= dt;
        if (!calm && dist < T.range && a.cd <= 0) { a.cd = T.cd; if (agents.length < CAP) { const ang = Math.random() * 6.28; spawnAgent('crawler', a.x + Math.cos(ang) * 3.6, a.z + Math.sin(ang) * 3.6, { aggro: true, src: 'minion' }); onEvent('hatch', {}); } }
        continue;
      }
      let vx = 0, vz = 0, hoverGoal = T.hover;
      if (calm) {
        const hx = a.home.x + Math.cos(a.phase * 0.4) * 6 - a.x, hz = a.home.z + Math.sin(a.phase * 0.4) * 6 - a.z, hl = Math.hypot(hx, hz) || 1;
        vx = hx / hl * 2; vz = hz / hl * 2;
      } else if (T.attack === 'melee') {
        // approach on an offset arc (flanking), then a fast lunge for the last few metres
        const fa = dist > 8 ? a.flank * Math.min(1, (dist - 8) / 18) : 0, ca = Math.cos(fa), sa = Math.sin(fa);
        const ux = (dx * ca - dz * sa) / dist, uz = (dx * sa + dz * ca) / dist;
        a.cd -= dt; a.lunge -= dt;
        if (dist < 7.5 && a.lunge <= -0.6 && a.cd <= 0.35) { a.lunge = 0.45; if (a.y <= height(a.x, a.z) + 0.05) a.vy = 4.5; onEvent('screech', { x: a.x, z: a.z }); }
        const sp = T.speed * (a.lunge > 0 ? 1.9 : 1);
        if (dist > T.range * 0.7) { vx = ux * sp; vz = uz * sp; }
        if (dist < T.range + tg.r * 0.5 && a.cd <= 0) { a.cd = T.cd; hurt(T.dmg, a); a.x -= dx / dist * 1.8; a.z -= dz / dist * 1.8; onEvent('slash', {}); }
      } else {
        // ranged: strafe and keep distance; seekers dive at you, hunters fire bursts
        a.strafeT -= dt; if (a.strafeT <= 0) { a.strafeT = 1.4 + Math.random() * 2; if (Math.random() < 0.45) a.orbitDir *= -1; }
        const rad = dist - T.keep, tx = -dz / dist * a.orbitDir, tz = dx / dist * a.orbitDir;
        vx = dx / dist * rad * 0.9 + tx * T.speed * 0.7; vz = dz / dist * rad * 0.9 + tz * T.speed * 0.7;
        const sp = Math.hypot(vx, vz); if (sp > T.speed) { vx *= T.speed / sp; vz *= T.speed / sp; }
        a.cd -= dt;
        if (T.dive) {
          a.diveCd -= dt;
          if (a.dive <= 0 && a.diveCd <= 0 && dist < 30) { a.dive = 1.6; a.diveCd = 5 + Math.random() * 4; onEvent('screech', { x: a.x, z: a.z }); }
          if (a.dive > 0) { a.dive -= dt; vx = dx / dist * T.speed * 2.1; vz = dz / dist * T.speed * 2.1; hoverGoal = Math.max(0.8, tg.y - height(a.x, a.z));
            if (Math.hypot(dist, tg.y - a.y) < tg.r + 1.3) { hurt(T.dive, a); a.dive = 0; a.x -= dx / dist * 3; a.z -= dz / dist * 3; onEvent('slash', {}); } }
        }
        if (dist < T.range && a.cd <= 0 && a.dive <= 0) {
          a.cd = T.cd * (0.8 + Math.random() * 0.4);
          if (T.burst) a.burstLeft = T.burst;
          else { const n = T.boss ? 3 : 1; for (let k = 0; k < n; k++) fireOrb(a, tg, (k - (n - 1) / 2) * 0.2); }
        }
        if (a.burstLeft > 0) { a.burstT -= dt; if (a.burstT <= 0) { a.burstT = 0.17; a.burstLeft--; fireShot(a, tg); } }
        if (T.boss) {
          a.swipeCd -= dt;
          if (dist < 7 && a.swipeCd <= 0) { a.swipeCd = 2.2; hurt(T.swipe, a); a.vy = 3; onEvent('slash', { boss: true }); }
          a.summon -= dt; if (a.summon <= 0) { a.summon = 12; if (agents.length < CAP - 1) { spawnAgent('crawler', a.x + 5, a.z + 3, { aggro: true, src: 'minion' }); spawnAgent('drone', a.x - 5, a.z - 3, { aggro: true, src: 'minion' }); onEvent('screech', { boss: true }); } }
        }
      }
      // keep the pack spread out
      for (const b of agents) if (b !== a && !b.T.still && !b.burrow) { const sx = a.x - b.x, sz = a.z - b.z, d2 = sx * sx + sz * sz; if (d2 < 5 && d2 > 1e-4) { const d = Math.sqrt(d2); vx += sx / d * 3; vz += sz / d * 3; } }
      a.x += vx * dt; a.z += vz * dt;
      const gh = height(a.x, a.z);
      if (T.hover) a.y += (gh + hoverGoal + Math.sin(a.phase * 2.2) * 0.5 - a.y) * Math.min(1, dt * (a.dive > 0 ? 6 : 3));
      else { a.vy -= 12 * dt; a.y += a.vy * dt; if (a.y < gh) { a.y = gh; a.vy = 0; } }
      a.group.position.set(a.x, a.y, a.z);
      const fy = Math.atan2(-dx, -dz); a.yaw += Math.atan2(Math.sin(fy - a.yaw), Math.cos(fy - a.yaw)) * Math.min(1, dt * 6);
      a.group.rotation.y = a.yaw;
      a.body.scale.setScalar(1 + a.hit * 0.12);
      const spd = Math.hypot(vx, vz);
      if (a.legs) { const w = Math.sin(a.phase * (a.kind === 'hunter' ? 9 : 16)) * Math.min(1, spd / 3) * 0.55; a.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? w : -w) * (a.kind === 'stalker' && i > 1 ? -1 : 1); }); }
      if (a.tail) a.tail.forEach((sg, i) => { sg.rotation.y = Math.sin(a.phase * 3 + i * 0.7) * 0.22; sg.rotation.x = -0.12 + Math.sin(a.phase * 2 + i) * 0.06; });
      if (a.wings) a.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(a.phase * 24) * 0.55; });
      if (a.kind === 'stalker') a.body.rotation.x = a.lunge > 0 ? -0.18 : 0;
      if (a.src === 'zone' && Math.hypot(a.x - a.home.x, a.z - a.home.z) > 140) a.aggro = false; // leash
    }
  }
  function fireOrb(a, tg, spread) {
    const o = new THREE.Mesh(A.acidGeo, A.mAcid); const sy = a.y + (a.T.boss ? 3.2 : 0);
    o.position.set(a.x, sy, a.z); scene.add(o);
    const d = new THREE.Vector3(tg.x - a.x, tg.y - sy, tg.z - a.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
    orbs.push({ mesh: o, v: d.multiplyScalar(a.T.boss ? 17 : 15), life: 4, dmg: a.T.dmg, src: a });
    onEvent('spit', {});
  }
  // hunter arm-cannon: fast red bolts with a little lead on a moving target
  function fireShot(a, tg) {
    const m = new THREE.Mesh(A.boltGeo, A.mBolt[0xff3a2a]); const from = new THREE.Vector3(a.x, a.y + 1.75, a.z);
    const st = ctx.st(), sp = st.driving ? st.rover.speed : 0, lead = new THREE.Vector3(tg.x - Math.sin(st.rover?.yaw || 0) * sp * 0.3, tg.y, tg.z - Math.cos(st.rover?.yaw || 0) * sp * 0.3);
    lead.x += (Math.random() - 0.5) * 2.2; lead.z += (Math.random() - 0.5) * 2.2;
    m.position.copy(from); m.lookAt(lead); scene.add(m);
    orbs.push({ mesh: m, v: lead.sub(from).normalize().multiplyScalar(42), life: 2, dmg: a.T.dmg, src: a, bolt: true });
    onEvent('enemyShot', {});
  }
  function updateOrbs(dt) {
    const tg = target();
    for (const o of [...orbs]) {
      o.life -= dt; o.mesh.position.addScaledVector(o.v, dt);
      const p = o.mesh.position; if (!o.bolt) o.mesh.scale.setScalar(1 + Math.sin(time * 20) * 0.15);
      const hitP = Math.hypot(p.x - tg.x, p.y - tg.y, p.z - tg.z) < tg.r + 0.3;
      if (hitP && H.down <= 0) { hurt(o.dmg, o.src); burst(p.x, p.y, p.z, 10, 4, o.bolt ? [[1, 0.3, 0.2]] : ICHOR); }
      if (hitP || o.life <= 0 || p.y < height(p.x, p.z)) { scene.remove(o.mesh); orbs.splice(orbs.indexOf(o), 1); }
    }
  }

  // ----- health: shield first, then meat. Shield recharges after a breather; HP only creeps back to 35, medkits do the rest.
  //       Going down costs a med-evac fee (or a fine, if security got you) -----
  let downWhy = 'killed';
  const hasUp = id => P.upgrades.includes(id);
  function hurt(dmg, from) {
    if (H.down > 0 || H.inv > 0 || ctx.st().intro > 0) return;
    const st = ctx.st();
    if (st.driving) dmg *= st.own ? (hasUp('roverarmor') ? 0.25 : 0.5) : 0.6; // hull soaks some
    H.lastHit = time;
    const s = Math.min(H.shield, dmg); H.shield -= s; dmg -= s;
    H.hp = Math.max(0, H.hp - dmg);
    onEvent('hurt', { hp: H.hp, shield: H.shield, fromX: from?.x, fromZ: from?.z });
    if (H.hp <= 0) down(from?.security ? 'busted' : 'killed');
  }
  function down(why) {
    if (H.down > 0) return;
    downWhy = why; H.down = why === 'busted' ? 1.8 : 2.4; H.hp = Math.max(H.hp, 0);
    if (why === 'killed') P.stats.deaths++; else P.stats.busted++;
    save(); onEvent('down', { why });
  }
  function updateHealth(dt) {
    if (H.inv > 0) H.inv -= dt;
    if (H.down > 0) {
      H.down -= dt;
      if (H.down <= 0) {
        const busted = downWhy === 'busted';
        const fee = Math.min(P.credits, busted ? Math.max(50, Math.round(P.credits * 0.15)) : Math.round(P.credits * 0.1));
        P.credits -= fee; save();
        ctx.respawn(downWhy);
        H.hp = H.max; H.shield = H.smax; H.inv = 3; H.lastHit = time;
        for (const a of [...agents]) removeAgent(a);
        for (const o of orbs) scene.remove(o.mesh); orbs = [];
        if (zone) { zone.active = false; zone.cool = Math.max(zone.cool, 20); }
        if (quest) { quest.wave = null; quest.killed = 0; if (busted && quest.def.contact) fail('You got pinched. Job\u2019s blown.'); }
        onEvent('respawn', { why: downWhy, fee });
        onEvent('radio', { text: busted
          ? `Colony Security: you\u2019ve been processed. Fine: ${fee} credits. Gear returned. Try not to make us do the paperwork again.`
          : `Control: med-evac dragged you back to the ship. That\u2019s ${fee} credits for the ride, and the doc says stop getting chewed on.` });
      }
      return;
    }
    if (time - H.lastHit > 4.5) H.shield = Math.min(H.smax, H.shield + 14 * dt);
    if (time - H.lastHit > 8 && H.hp < 35) H.hp = Math.min(35, H.hp + 2 * dt);
  }
  function useMedkit() {
    if (H.down > 0) return false;
    if (!P.inv.medkits) { onEvent('toast', { text: '🩹 No medkits. The colony shop sells them.' }); return false; }
    if (H.hp >= H.max) { onEvent('toast', { text: '🩹 You\u2019re fine. Save it.' }); return false; }
    P.inv.medkits--; H.hp = Math.min(H.max, H.hp + 50); save();
    onEvent('medkit', { hp: H.hp, left: P.inv.medkits }); return true;
  }

  // ----- weapons -----
  const tmpV = new THREE.Vector3(), cV = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector3();
  function center(a) { return cV.set(a.x, a.y + (a.T.cy ?? 0.8), a.z); }
  function inView(a) { ndc.copy(center(a)).project(camera); return ndc.z < 1 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1; }
  // nearest alien on screen (phone auto-aim), optionally inside a cone around a direction
  function autoTarget(from, dir, cone = Math.PI, range = 75) {
    let best = null, bs = Infinity;
    for (const a of agents) {
      if (a.burrow || !inView(a)) continue;
      const c = center(a), d = c.distanceTo(from); if (d > range) continue;
      const ang = tmpV.copy(c).sub(from).normalize().angleTo(dir); if (ang > cone) continue;
      const s = d + ang * 30; if (s < bs) { bs = s; best = a; }
    }
    return best;
  }
  // aim along a camera ray (desktop crosshair/mouse), with a gentle ~7 degree assist toward nearby aliens
  function rayTarget(nx, ny, from) {
    ray.setFromCamera({ x: nx, y: ny }, camera);
    let best = null, ba = 0.12;
    for (const a of agents) { if (a.burrow) continue; const c = center(a); const ang = tmpV.copy(c).sub(ray.ray.origin).normalize().angleTo(ray.ray.direction); if (ang < ba && c.distanceTo(from) < 90) { ba = ang; best = a; } }
    if (best) return { agent: best, point: center(best).clone() };
    return { agent: null, point: ray.ray.at(80, new THREE.Vector3()) };
  }
  function muzzle() {
    const st = ctx.st();
    if (st.driving && st.own && turret) { turret.group.updateMatrixWorld(true); return (W.side ? turret.tipR : turret.tipL).getWorldPosition(new THREE.Vector3()); }
    if (st.camDist < 0.8) return new THREE.Vector3(player.x, player.y - 0.35, player.z).addScaledVector(camera.getWorldDirection(tmpV), 0.6);
    const fy = player.yaw;
    return new THREE.Vector3(player.x + Math.cos(fy) * 0.45 - Math.sin(fy) * 0.4, player.y - 0.45, player.z - Math.sin(fy) * 0.45 - Math.cos(fy) * 0.4);
  }
  // fire once. aimAt = {x,y} in NDC to shoot along a screen ray, or null for auto-aim (phone Fire button)
  const curWeapon = () => { const st = ctx.st(); if (st.driving) return st.own && turret ? WEAPONS.roverCannon : null; return WEAPONS[P.equip.weapon] || WEAPONS.rifle; };
  function fire(aimAt) {
    const st = ctx.st();
    if (H.down > 0 || st.intro > 0 || st.outro > 0) return false;
    if (!aliensOn() && !ctx.allowFire?.()) return false;
    const wpn = curWeapon(); if (!wpn) return false;
    if (W.cd > 0 || (wpn.heat && W.over)) return false;
    if (wpn.ammo) { if (!P.inv[wpn.ammo]) { W.cd = 0.5; onEvent('dry', { weapon: wpn.name }); return false; } P.inv[wpn.ammo]--; }
    W.cd = wpn.cd; W.lastShot = time;
    if (wpn.twin) W.side ^= 1;
    const from = muzzle(), useTurret = st.driving && turret;
    let to;
    if (aimAt) to = rayTarget(aimAt.x, aimAt.y, from).point;
    else {
      const dir = st.driving ? new THREE.Vector3(-Math.sin(st.rover.yaw), 0, -Math.cos(st.rover.yaw)) : camera.getWorldDirection(new THREE.Vector3());
      const t = autoTarget(from, dir, st.driving ? 1.05 : Math.PI);
      if (t) to = center(t).clone();
      else if (useTurret) { to = new THREE.Vector3(0, 0, -80); turret.pitchG.localToWorld(to); }
      else to = from.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 80);
    }
    if (useTurret) turret.lock = to.clone();
    const dir0 = to.clone().sub(from).normalize(), n = wpn.pellets || 1;
    for (let k = 0; k < n; k++) {
      const d = dir0.clone(); if (wpn.spread) { d.x += (Math.random() - 0.5) * wpn.spread * 2; d.y += (Math.random() - 0.5) * wpn.spread * 1.4; d.z += (Math.random() - 0.5) * wpn.spread * 2; d.normalize(); }
      const m = new THREE.Mesh(A.boltGeo, A.mBolt[wpn.color]);
      m.scale.setScalar(wpn.size); m.position.copy(from); m.lookAt(from.clone().add(d)); scene.add(m);
      bolts.push({ mesh: m, v: d.multiplyScalar(wpn.speed), life: wpn.life || 1.1, dmg: wpn.dmg, heavy: !!wpn.twin, prev: from.clone() });
    }
    if (wpn.heat) { W.heat = Math.min(100, W.heat + wpn.heat * (wpn === WEAPONS.rifle && hasUp('heatsink') ? 0.65 : 1)); if (W.heat >= 100) { W.over = true; onEvent('overheat', {}); } }
    W.flash = 0.06; W.recoil = wpn.pellets ? 1.6 : 1;
    P.stats.shots++;
    onEvent('zap', { heavy: !!wpn.twin, shotgun: !!wpn.pellets });
    return true;
  }
  function switchWeapon(id) {
    const own = P.unlocks.includes('weapon:shotgun');
    const next = id || (P.equip.weapon === 'shotgun' ? 'rifle' : 'shotgun');
    if (next === 'shotgun' && !own) { onEvent('toast', { text: '🔫 No shotgun yet. The colony shop has one.' }); return false; }
    P.equip.weapon = next; save(); onEvent('weapon', { id: next, name: WEAPONS[next].name, shells: P.inv.shells }); return true;
  }
  const seg = new THREE.Vector3(), q = new THREE.Vector3();
  function updateBolts(dt) {
    for (const b of [...bolts]) {
      b.prev.copy(b.mesh.position); b.mesh.position.addScaledVector(b.v, dt); b.life -= dt;
      const p0 = b.prev, p1 = b.mesh.position; let dead = b.life <= 0;
      for (const a of agents) {
        const c = center(a), r = a.T.r + (b.heavy ? 0.45 : 0.25);
        seg.copy(p1).sub(p0); const L2 = seg.lengthSq();
        const t = L2 ? THREE.MathUtils.clamp(tmpV.copy(c).sub(p0).dot(seg) / L2, 0, 1) : 0;
        q.copy(p0).addScaledVector(seg, t);
        if (q.distanceTo(c) < r) {
          if (a.burrow) continue;
          a.hp -= b.dmg * (1 - (a.T.armor || 0)); a.aggro = true;
          burst(q.x, q.y, q.z, 5, 3, a.type === 'hunter' ? ICHOR_H : ICHOR); a.hit = 1;
          onEvent('hit', { boss: !!a.T.boss });
          if (a.hp <= 0) killAgent(a);
          dead = true; break;
        }
      }
      if (!dead && ctx.hitWorld?.(p0, p1, b)) dead = true;
      if (!dead && ctx.solidAt?.(p1.x, p1.y, p1.z)) { burst(p1.x, p1.y, p1.z, 4, 3, [[1, 0.8, 0.5]]); dead = true; }
      if (!dead && p1.y < height(p1.x, p1.z)) { burst(p1.x, p1.y + 0.2, p1.z, 4, 3, [[1, 0.9, 0.6]]); dead = true; }
      if (dead) { scene.remove(b.mesh); bolts.splice(bolts.indexOf(b), 1); }
    }
  }

  // ----- rover heavy plasma blaster: twin barrels, recoil, muzzle flash, heat glow -----
  function buildTurret(rover) {
    const g = new THREE.Group(); g.position.set(0, 2.34, 1.3); rover.body.add(g);
    const dark = M(0x2b2d33, { flatShading: true }), steel = M(0x8a9099, { flatShading: true, metalness: 0.25 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 0.28, 12), dark); base.position.y = 0.14; g.add(base);
    const yawG = new THREE.Group(); yawG.position.y = 0.3; g.add(yawG);
    const house = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.6, 1.3), steel); house.position.set(0, 0.3, 0.1); yawG.add(house);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.78, 0.12), dark); plate.position.set(0, 0.4, -0.6); plate.rotation.x = -0.25; yawG.add(plate);
    const pitchG = new THREE.Group(); pitchG.position.set(0, 0.38, -0.3); yawG.add(pitchG);
    const heatMat = M(0x332244, { emissive: 0x220a33, roughness: 0.3 });
    const barrels = [], tips = [], flashes = [];
    for (const s of [-1, 1]) {
      const bg = new THREE.Group(); bg.position.x = s * 0.3; pitchG.add(bg);
      const brl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.1, 10), dark); brl.rotation.x = Math.PI / 2; brl.position.z = -1.05; bg.add(brl);
      for (let k = 0; k < 3; k++) { const coil = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12), heatMat); coil.position.z = -0.45 - k * 0.5; bg.add(coil); }
      const muz = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.3, 10), steel); muz.rotation.x = Math.PI / 2; muz.position.z = -2.15; bg.add(muz);
      const tip = new THREE.Object3D(); tip.position.z = -2.45; bg.add(tip);
      const fl = new THREE.Sprite(A.flashMat.clone()); fl.scale.setScalar(1.7); fl.visible = false; tip.add(fl);
      barrels.push(bg); tips.push(tip); flashes.push(fl);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 10), heatMat); tank.rotation.z = Math.PI / 2; tank.position.set(0, 0.64, 0.45); yawG.add(tank);
    return { group: g, yawG, pitchG, barrels, tipL: tips[0], tipR: tips[1], flashes, heatMat, lock: null, yaw: 0, pitch: 0 };
  }
  function updateTurret(dt) {
    if (!turret) return;
    const st = ctx.st(); turret.group.visible = aliensOn();
    W.recoil = Math.max(0, W.recoil - dt * 9); W.flash -= dt;
    if (!st.driving || !st.own || !aliensOn()) {
      turret.yaw *= Math.exp(-dt * 3); turret.pitch *= Math.exp(-dt * 3);
      turret.yawG.rotation.y = turret.yaw; turret.pitchG.rotation.x = turret.pitch; turret.flashes.forEach(f => f.visible = false);
    } else {
      // aim: last shot's target -> mouse/crosshair ray (desktop) -> nearest alien ahead (phone) -> straight ahead
      let aimP = null; const base = turret.group.getWorldPosition(new THREE.Vector3());
      if (turret.lock && time - W.lastShot < 0.35) aimP = turret.lock;
      else if (aim.has) aimP = rayTarget(aim.x, aim.y, base).point;
      else { const fwd = new THREE.Vector3(-Math.sin(st.rover.yaw), 0, -Math.cos(st.rover.yaw)); const t = autoTarget(base, fwd, 1.05); if (t) aimP = center(t).clone(); }
      let wy = 0, wp = 0;
      if (aimP) {
        const local = turret.group.worldToLocal(aimP.clone());
        wy = Math.atan2(-local.x, -local.z); wp = THREE.MathUtils.clamp(Math.atan2(local.y - 0.68, Math.hypot(local.x, local.z)), -0.3, 0.6);
      }
      const k = Math.min(1, dt * 10);
      turret.yaw += Math.atan2(Math.sin(wy - turret.yaw), Math.cos(wy - turret.yaw)) * k; turret.pitch += (wp - turret.pitch) * k;
      turret.yawG.rotation.y = turret.yaw; turret.pitchG.rotation.x = turret.pitch;
      turret.barrels.forEach((b, i) => { b.position.z = i === W.side ? W.recoil * 0.3 : 0; });
      turret.flashes.forEach((f, i) => { f.visible = W.flash > 0 && i === W.side; f.material.rotation = Math.random() * 6; });
    }
    const h = W.heat / 100; turret.heatMat.emissive.setRGB(0.13 + h * 0.87, 0.04 + h * (W.over ? 0.05 : 0.3), 0.2 + h * 0.35);
  }
  function updateWeapons(dt, input) {
    W.cd = Math.max(0, W.cd - dt);
    if (time - W.lastShot > 0.35) W.heat = Math.max(0, W.heat - (W.over ? 28 : 40) * dt);
    if (W.over && W.heat < 35) { W.over = false; onEvent('cooled', {}); }
    if (input.fire) fire(input.fireAim || null);
    if (input.medkit) useMedkit();
  }

  // ----- missions -----
  function placeItem(kind, x, z, data = {}) {
    const obj = ITEM_BUILD[kind](); obj.position.set(x, height(x, z), z);
    if (!data.noBeam) { const beam = new THREE.Mesh(A.pickBeam, A.mPickBeam); beam.frustumCulled = false; obj.add(beam); obj.userData.beam = beam; }
    Object.assign(obj.userData, { poi: true, name: data.name || 'Quest item', fact: data.fact || 'Walk up to it to pick it up.', ...data });
    scene.add(obj); return obj;
  }
  function addOutpost(tg) {
    if (outpost) return;
    outpost = ITEM_BUILD.outpost(); outpost.position.set(tg.x, height(tg.x, tg.z) - 0.5, tg.z - 20);
    Object.assign(outpost.userData, { poi: true, name: 'Hive outpost', fact: 'A resin hive grown over something that used to be a relay station. Whatever built it is still home. (Game fiction.)' });
    scene.add(outpost);
  }
  function clearQuestObjects() {
    if (gate) { scene.remove(gate); gate = null; }
    if (!quest) return;
    for (const it of quest.items || []) scene.remove(it.obj);
    for (const a of [...agents]) if (a.src === 'quest' || a.src === 'minion') removeAgent(a);
    if (outpost) { scene.remove(outpost); outpost = null; }
    quest.items = []; quest.wave = null;
  }
  const stepDef = () => quest?.def.steps[quest.step];
  function stepTarget(s) {
    if (s.type === 'return') { const S = ctx.SHIP; return { x: S.x - 8, z: S.z + 8, r: 12 }; }
    if (s.at) { const p = ctx.colonyAt?.(s.at); if (p) return { x: p.x, z: p.z, r: s.r ?? 4 }; }
    if (s.type === 'take') { const v = ctx.nearestVehicle?.(); return v ? { x: v.x, z: v.z, r: 3 } : { x: player.x, z: player.z, r: 3 }; }
    if (s.type === 'clean') return { x: player.x, z: player.z, r: 0 };
    if (s.type === 'race') { const p = ctx.colonyAt?.(s.pts[0]) || ctx.safePoint(0, 60); return { x: p.x, z: p.z, r: 6 }; }
    const p = ctx.safePoint(s.a, s.d); return { x: p.x, z: p.z, r: s.r ?? 4 };
  }
  let gate = null;
  function placeGate() {
    const s = stepDef(); if (gate) { scene.remove(gate); gate = null; }
    if (!quest || s?.type !== 'race' || quest.gi >= s.pts.length) return;
    const p = ctx.colonyAt?.(s.pts[quest.gi]) || { x: quest.target.x, z: quest.target.z }, nx = s.pts[quest.gi + 1] ? ctx.colonyAt(s.pts[quest.gi + 1]) : null;
    quest.target = { x: p.x, z: p.z, r: 6 };
    gate = new THREE.Group(); const ring = new THREE.Mesh(A.gateGeo, A.mGate); ring.position.y = 4.2; gate.add(ring);
    const beam = new THREE.Mesh(A.pickBeam, A.mPickBeam); beam.frustumCulled = false; gate.add(beam);
    gate.position.set(p.x, height(p.x, p.z), p.z); if (nx) gate.rotation.y = Math.atan2(nx.x - p.x, nx.z - p.z);
    scene.add(gate);
  }
  function startStep() {
    const s = stepDef(); if (!s) return;
    const qs = qState(quest.def.id); qs.step = quest.step; save();
    quest.items = quest.items.filter(it => { if (it.keep) return true; scene.remove(it.obj); return false; });
    quest.killed = 0; quest.wave = null; quest.target = stepTarget(s); quest.st0 = time;
    const tg = quest.target;
    if (s.wanted) ctx.setWanted?.(Math.max(ctx.wanted?.() || 0, s.wanted), 'job');
    if (s.type === 'race') { quest.gi = 0; placeGate(); }
    if (s.type === 'goto' && s.item) quest.items.push({ obj: placeItem(s.item, tg.x, tg.z, { name: s.text, quest: true }), x: tg.x, z: tg.z, id: `${quest.def.id}-${quest.step}`, keep: !!s.keep, pick: !s.keep });
    if (s.outpost) addOutpost(tg);
    if (s.type === 'collect') {
      quest.got = qs.n || 0;
      for (let k = quest.got; k < s.n; k++) {
        const ang = k * 2.4 + 0.7, r = s.spread * (0.45 + (k % 3) * 0.28);
        let x = tg.x + Math.cos(ang) * r, z = tg.z + Math.sin(ang) * r;
        if (cfg.water !== undefined && height(x, z) < cfg.water + 0.8) { x = tg.x + k * 2.5; z = tg.z; }
        quest.items.push({ obj: placeItem(s.item, x, z, { name: s.text, quest: true }), x, z, id: `${quest.def.id}-${quest.step}-${k}`, pick: true, collect: true });
      }
    }
    onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() });
  }
  function stepText() {
    const s = stepDef(); if (!s) return '';
    if (s.type === 'defeat' && !aliensOn()) return 'Scan the alien zone (peaceful mode)';
    if (s.type === 'collect') return `${s.text} (${quest.got || 0}/${s.n})`;
    if (s.type === 'race') return `${s.text} (${quest.gi || 0}/${s.pts.length})`;
    if (s.vehicle === 'stolen' && !ctx.vehicle?.()?.stolen) return `${s.text} (in a stolen ride)`;
    if (s.type === 'defeat' && quest.wave) return `${s.text} (${quest.killed}/${quest.wave.total})`;
    return s.text;
  }
  function accept(id) {
    const def = QUESTS.find(q => q.id === id); if (!def || def.world !== world) return false;
    if (quest) { if (quest.def.id === id) return true; abandon(true); }
    const qs = qState(id); qs.status = 'active'; qs.step = 0; qs.n = 0; P.active[world] = id; save();
    quest = { def, step: 0, items: [], t0: time, killed: 0 };
    startStep();
    onEvent('radio', { text: def.intro, quest: id, fiction: !!def.fiction, contact: def.contact || null });
    onEvent('quest', { kind: 'accepted', id, title: def.title });
    return true;
  }
  function abandon(quiet) {
    if (!quest) return; const id = quest.def.id; clearQuestObjects();
    const qs = qState(id); qs.status = qs.everDone ? 'done' : 'new'; delete P.active[world]; save(); quest = null;
    if (!quiet) onEvent('quest', { kind: 'abandoned', id });
  }
  function resume() {
    const id = P.active[world]; const def = QUESTS.find(q => q.id === id);
    if (!def || P.quests[id]?.status !== 'active') return false;
    const qs = P.quests[id];
    if (def.limit) { qs.step = 0; qs.n = 0; } // timed quests restart from the top
    quest = { def, step: Math.min(qs.step || 0, def.steps.length - 1), items: [], t0: time, killed: 0 };
    // re-create anything earlier steps left standing (the stranded rover, the picnic, the outpost)
    for (let k = 0; k < quest.step; k++) {
      const s = def.steps[k], tg = stepTarget(s);
      if (s.keep && s.item) quest.items.push({ obj: placeItem(s.item, tg.x, tg.z, { name: s.text, quest: true, noBeam: true }), x: tg.x, z: tg.z, id: `${id}-${k}`, keep: true, pick: false });
      if (s.outpost) addOutpost(tg);
    }
    startStep();
    onEvent('quest', { kind: 'resumed', id, title: def.title });
    return true;
  }
  function advance() {
    quest.step++;
    if (quest.step >= quest.def.steps.length) return complete();
    onEvent('chime', {}); startStep();
  }
  function complete() {
    const def = quest.def, qs = qState(def.id), first = !qs.everDone;
    clearQuestObjects();
    qs.status = 'done'; qs.everDone = true; qs.step = 0; qs.n = 0; delete P.active[world];
    const r = def.reward, got = [], xp = first ? r.xp : Math.round(r.xp * 0.25), cr = first ? (r.credits || 0) : Math.round((r.credits || 0) * 0.25);
    if (first) {
      if (r.badge && !P.badges.includes(r.badge)) { P.badges.push(r.badge); got.push(`🏅 Badge: ${r.badge}`); }
      if (r.unlock && !P.unlocks.includes(r.unlock)) { P.unlocks.push(r.unlock); const [k, v] = r.unlock.split(':'); got.push(`${k === 'paint' ? '🎨 Rover paint' : '🧣 Bandana'}: ${COSMETICS[k][v].name}`); }
    }
    gain(xp, cr, true); save();
    quest = null;
    onEvent('quest', { kind: 'done', id: def.id, title: def.title, xp, credits: cr, got, fact: def.fact || '', fiction: !!def.fiction });
    const who = def.contact || 'Control', line = def.contact ? ['Pleasure doing business.', 'Not bad. Don\u2019t get comfortable.', 'Clean work. Mostly.'][Math.floor(Math.random() * 3)] : ['Good work. Try to come back in one piece next time too.', 'Done. Nobody died. Today that counts as a win.', 'Logged. Somebody up here owes me five credits.'][Math.floor(Math.random() * 3)];
    onEvent('radio', { text: `${who}: "${def.title}" done. ${cr} credits wired. ${line}${def.fact ? ' ' + def.fact : ''}` });
    offerTimers.push(setTimeout(() => offerNext(), 9000));
  }
  function fail(reason) {
    if (!quest) return; const def = quest.def; clearQuestObjects();
    const qs = qState(def.id); qs.status = qs.everDone ? 'done' : 'new'; delete P.active[world]; save(); quest = null;
    onEvent('quest', { kind: 'failed', id: def.id, title: def.title });
    onEvent('radio', { text: `${def.contact || 'Control'}: ${reason} Want another crack at "${def.title}"?`, offer: def.id });
  }
  function checkStep() {
    const s = stepDef(); if (!s) return;
    if (s.type === 'defeat' && quest.wave && quest.killed >= quest.wave.total) {
      for (const a of [...agents]) if (a.src === 'minion') { const c = center(a); burst(c.x, c.y, c.z, 20); removeAgent(a); }
      advance();
    }
  }
  function updateQuest(dt) {
    if (!quest) return;
    const s = stepDef(); if (!s) return;
    const st = ctx.st(), px = player.x, pz = player.z, reach = st.driving ? 2.5 : 0;
    if (quest.def.limit && H.down <= 0 && quest.def.limit - (time - quest.t0) <= 0)
      return fail(quest.def.id === 'mercury-sunrise' ? 'Sunrise caught you in the open. We hauled your smoking carcass back. Barely.' : 'Your suit cooked past spec, so we yanked you. You\u2019re welcome.');
    if (s.limit && H.down <= 0 && s.limit - (time - quest.st0) <= 0) return fail(s.type === 'race' ? 'Too slow. My grandmother hits those gates faster, and she\u2019s a hologram.' : 'Clock ran out. Buyer walked.');
    for (const it of quest.items) { if (it.obj.userData.spin) it.obj.userData.spin.rotation.y += dt * 2; if (it.obj.userData.beam) it.obj.userData.beam.scale.set(1 + Math.sin(time * 3) * 0.25, 1, 1 + Math.sin(time * 3) * 0.25); }
    const tg = quest.target;
    if (s.type === 'take') { if (ctx.vehicle?.()?.stolen) advance(); else { const v = ctx.nearestVehicle?.(); if (v) { tg.x = v.x; tg.z = v.z; } } return; }
    if (s.type === 'clean') { if (!(ctx.wanted?.() > 0)) advance(); return; }
    if (s.type === 'race') {
      if (Math.hypot(tg.x - px, tg.z - pz) < tg.r + reach + 1) { quest.gi++; onEvent('chime', {}); if (quest.gi >= s.pts.length) { if (gate) { scene.remove(gate); gate = null; } return advance(); } placeGate(); onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() }); }
      if (gate) gate.children[0].rotation.z += dt; return;
    }
    if (s.type === 'goto' || s.type === 'return') {
      if (s.vehicle === 'stolen' && !ctx.vehicle?.()?.stolen) return;
      if (Math.hypot(tg.x - px, tg.z - pz) < tg.r + reach) {
        if (s.item && !s.keep) { const it = quest.items.find(i => i.pick); if (it) { scene.remove(it.obj); quest.items.splice(quest.items.indexOf(it), 1); onEvent('pickup', { name: s.text }); } }
        if (s.text === 'Reboot the rover') { const r = quest.items.find(i => i.keep); if (r?.obj.userData.light) r.obj.userData.light.material = A.mGreen; }
        advance();
      }
    } else if (s.type === 'collect') {
      for (const it of [...quest.items]) if (it.collect && Math.hypot(it.x - px, it.z - pz) < 3 + reach) pickCollect(it);
    } else if (s.type === 'defeat') {
      const d = Math.hypot(tg.x - px, tg.z - pz);
      if (!aliensOn()) { if (d < 16 + reach) { onEvent('toast', { text: '📡 Zone scanned. (Peaceful mode: no aliens today.)' }); advance(); } return; }
      if (!quest.wave && d < 75 && H.down <= 0) {
        quest.wave = { total: s.wave.length }; quest.killed = 0;
        for (const o of agents.filter(o => o.src !== 'quest').slice(0, Math.max(0, agents.length + s.wave.length - CAP))) { const c = center(o); burst(c.x, c.y, c.z, 10); removeAgent(o); } // make room for the quest wave
        s.wave.forEach((t, k) => { const a = (k / s.wave.length) * Math.PI * 2, burrow = s.ambush && t === 'crawler'; const r = burrow ? 14 + k * 3 : 9;
          spawnAgent(t, tg.x + Math.cos(a) * r, tg.z + Math.sin(a) * r, { aggro: !burrow && t !== 'nest', burrow, src: 'quest' }); });
        if (s.wave.includes('boss')) onEvent('radio', { text: 'Control: that\u2019s the Queen. Don\u2019t stand still and don\u2019t let her get close. She will open you like a ration pack.' });
        onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() });
      }
    }
  }
  function pickCollect(it) {
    const s = stepDef(); scene.remove(it.obj); quest.items.splice(quest.items.indexOf(it), 1);
    quest.got = (quest.got || 0) + 1; qState(quest.def.id).n = quest.got; save();
    onEvent('pickup', { name: `${s.text} ${quest.got}/${s.n}` });
    onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() });
    if (quest.got >= s.n) { qState(quest.def.id).n = 0; advance(); }
  }
  const available = () => QUESTS.filter(q => q.world === world && !q.contact && !isDone(q.id) && (aliensOn() || !q.steps.some(s => s.type === 'defeat' && s.wave.includes('boss'))));
  function offerNext() {
    if (!world || quest || H.down > 0) return;
    const next = available()[0];
    if (next) onEvent('radio', { text: `Control: got a job if you\u2019re bored: "${next.title}". Pays ${next.reward.credits || 0}. Want it?`, offer: next.id });
  }

  // ----- rewards -----
  function gain(xp = 0, credits = 0, silent = false) {
    const before = rankOf(P.xp).i;
    P.xp += xp; P.credits += credits || 0; save();
    if (!silent && xp) onEvent('xp', { xp, credits });
    const after = rankOf(P.xp);
    if (after.i > before) onEvent('rank', { rank: after.name });
  }

  // ----- rare finds: deterministic per terrain chunk; the chunk owns the mesh -----
  function hashf(a, b, s) { let h = (a * 374761393 + b * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function rareFor(ix, iz, CHUNK) {
    if (!world || (Math.abs(ix) <= 1 && Math.abs(iz) <= 1)) return null;
    if (hashf(ix, iz, (cfg.seed || 1) + 41) > 0.075) return null;
    const id = `${ix},${iz}`; if (P.rare[world]?.includes(id)) return null;
    let r = hashf(ix, iz, 77), def = RARE_TYPES[0]; for (const t of RARE_TYPES) { if (r < t.w) { def = t; break; } r -= t.w; }
    const x = (ix + 0.2 + hashf(ix, iz, 78) * 0.6) * CHUNK, z = (iz + 0.2 + hashf(ix, iz, 79) * 0.6) * CHUNK, y = height(x, z);
    if (cfg.water !== undefined && y < cfg.water + 0.6) return null;
    const obj = ITEM_BUILD[def.type === 'artifact' ? 'artifact' : def.type](); obj.position.set(x, y, z);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.sparkTex, color: def.fiction ? 0xc080ff : 0x9fffb0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.position.y = 1.6; sp.scale.setScalar(1.4); obj.add(sp);
    Object.assign(obj.userData, { poi: true, rare: id, name: `✨ Rare find: ${def.name}`, fact: def.fact });
    rares.push({ obj, id, def, x, z, sp });
    return obj;
  }
  function pickRare(r) {
    if (r.obj.parent) r.obj.parent.remove(r.obj);
    rares.splice(rares.indexOf(r), 1);
    (P.rare[world] ||= []).push(r.id);
    gain(r.def.xp, r.def.credits, true);
    burst(r.x, height(r.x, r.z) + 1, r.z, 24, 5, [[0.6, 1, 0.6], [1, 1, 1]]);
    onEvent('rare', { name: r.def.name, fact: r.def.fact, fiction: !!r.def.fiction, xp: r.def.xp, count: rareCount() });
  }
  const rareCount = () => Object.values(P.rare).reduce((a, l) => a + l.length, 0);
  function updateRares(dt) {
    const st = ctx.st();
    for (const r of [...rares]) {
      if (!r.obj.parent?.parent) { rares.splice(rares.indexOf(r), 1); continue; } // its chunk was unloaded
      r.sp.material.rotation += dt; r.sp.scale.setScalar(1.3 + Math.sin(time * 3 + r.x) * 0.25);
      if (Math.hypot(r.x - player.x, r.z - player.z) < (st.driving ? 4.5 : 2.6)) pickRare(r);
    }
  }

  // ----- ambient alien zone (fiction) -----
  function makeZone() {
    const Z = ALIEN_ZONES[world]; if (!Z) return null;
    const p = ctx.safePoint(Z.a, Z.d);
    const ring = new THREE.Mesh(A.zoneRing, A.mZone); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, height(p.x, p.z) + 0.4, p.z); scene.add(ring);
    return { ...Z, x: p.x, z: p.z, ring, active: false, left: 0, cool: 0 };
  }
  function updateZone(dt) {
    if (!zone) return;
    zone.ring.visible = aliensOn(); zone.ring.rotation.z += dt * 0.3;
    if (!aliensOn()) return;
    if (zone.cool > 0) { zone.cool -= dt; return; }
    if (!zone.active && H.down <= 0 && Math.hypot(zone.x - player.x, zone.z - player.z) < 80) {
      zone.active = true; zone.left = 0;
      zone.wave.forEach((t, k) => { const a = k / zone.wave.length * Math.PI * 2; if (spawnAgent(t, zone.x + Math.cos(a) * 8, zone.z + Math.sin(a) * 8, { src: 'zone' })) zone.left++; });
      if (!zone.left) zone.active = false;
    }
  }

  // ----- the dog warns you about nearby aliens -----
  function updateDogWarn(dt) {
    warnCd -= dt; if (warnCd > 0 || H.down > 0) return;
    let near = null, nd = 42;
    for (const a of agents) { const d = Math.hypot(a.x - player.x, a.z - player.z); if (d < nd) { nd = d; near = a; } }
    if (near) { warnCd = 10; ctx.dogAlert?.(near.x, near.z); onEvent('alienWarn', { dist: Math.round(nd) }); }
  }

  // ----- cosmetics -----
  function applyCosmetics() {
    const st = ctx.st();
    if (st.ownRover?.paint) st.ownRover.paint.color.setHex(COSMETICS.paint[P.equip.paint]?.color ?? 0xb4b9c1);
    if (bandana) { bandana.userData.cleanup?.(); bandana.parent?.remove(bandana); bandana = null; }
    const b = COSMETICS.bandana[P.equip.bandana], body = st.dog?.parts?.body;
    if (b?.color && body) {
      const geo = new THREE.ConeGeometry(0.16, 0.24, 3); geo.rotateX(Math.PI);
      bandana = new THREE.Mesh(geo, M(b.color, { roughness: 0.9, flatShading: true }));
      bandana.position.set(0, 0.3, -0.33); bandana.rotation.x = 0.35; bandana.scale.set(1.4, 1, 0.45); body.add(bandana);
      const knot = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 5, 12), bandana.material); knot.position.set(0, 0.42, -0.25); knot.rotation.x = Math.PI / 2 - 0.4; body.add(knot); bandana.userData.knot = knot;
      const origRemove = () => { knot.parent?.remove(knot); };
      bandana.userData.cleanup = origRemove;
    }
  }
  function equip(kind, id) {
    if (!P.unlocks.includes(`${kind}:${id}`)) return false;
    P.equip[kind] = id; save(); applyCosmetics(); return true;
  }

  function questTimer() {
    const s = stepDef(); let t = quest.def.limit ? Math.max(0, quest.def.limit - (time - quest.t0)) : null;
    if (s?.limit) { const u = Math.max(0, s.limit - (time - quest.st0)); t = t === null ? u : Math.min(t, u); }
    return t;
  }
  // ----- colony shop -----
  function shopList() {
    const own = id => P.unlocks.includes(id);
    const items = SHOP.map(it => {
      let owned = false, ok = true, why = '';
      if (it.kind === 'weapon') owned = own('weapon:' + it.id);
      if (it.kind === 'upgrade') owned = hasUp(it.id);
      if (it.needs && !own(it.needs)) { ok = false; why = 'Needs the shotgun'; }
      if (it.kind === 'medkit' && P.inv.medkits >= 3) { ok = false; why = 'Carrying 3'; }
      if (it.kind === 'ammo' && P.inv.shells >= 48) { ok = false; why = 'Full'; }
      return { id: it.id, name: it.name, desc: it.desc, price: it.price, owned, ok: ok && !owned, why, afford: P.credits >= it.price, group: it.kind === 'upgrade' ? 'Upgrades' : 'Gear' };
    });
    for (const k of ['paint', 'bandana']) for (const [v, c] of Object.entries(COSMETICS[k])) if (c.shop) {
      const id = `${k}:${v}`, owned = own(id);
      items.push({ id, name: (k === 'paint' ? 'Rover paint: ' : 'Frankie bandana: ') + c.name, desc: owned ? (P.equip[k] === v ? 'Equipped' : 'Owned. Tap to equip') : '', price: c.shop, owned, ok: true, why: '', afford: P.credits >= c.shop, group: k === 'paint' ? 'Rover paint' : 'Frankie gear', color: c.color });
    }
    return { credits: P.credits, items, medkits: P.inv.medkits, shells: P.inv.shells };
  }
  function buy(id) {
    const it = SHOP.find(x => x.id === id);
    if (!it) {
      const [k, v] = id.split(':'), c = COSMETICS[k]?.[v]; if (!c?.shop) return { ok: false, msg: 'Not for sale.' };
      if (P.unlocks.includes(id)) { equip(k, v); return { ok: true, msg: `Equipped ${c.name}.` }; }
      if (P.credits < c.shop) return { ok: false, msg: `Short ${c.shop - P.credits} credits.` };
      P.credits -= c.shop; P.unlocks.push(id); P.equip[k] = v; save(); applyCosmetics(); onEvent('bought', { id, name: c.name });
      return { ok: true, msg: `${c.name}: yours.` };
    }
    const L = shopList().items.find(x => x.id === id);
    if (L.owned) return { ok: false, msg: 'Already got it.' };
    if (!L.ok) return { ok: false, msg: L.why };
    if (P.credits < it.price) return { ok: false, msg: `Short ${it.price - P.credits} credits.` };
    P.credits -= it.price;
    if (it.kind === 'weapon') { P.unlocks.push('weapon:' + it.id); P.inv.shells = Math.min(48, P.inv.shells + 12); P.equip.weapon = it.id; }
    else if (it.kind === 'ammo') P.inv.shells = Math.min(48, P.inv.shells + 12);
    else if (it.kind === 'medkit') P.inv.medkits++;
    else if (it.kind === 'upgrade') { P.upgrades.push(it.id); applyUpgrades(); }
    save(); onEvent('bought', { id, name: it.name });
    return { ok: true, msg: `${it.name}: yours.` };
  }
  function applyUpgrades() { H.smax = 60 + (hasUp('armor') ? 25 : 0); H.shield = Math.min(H.shield, H.smax); }
  // talk to a colony contact: offer their next job (or a replay)
  function talk(contact) {
    if (quest?.def.contact === contact) { onEvent('radio', { text: `${contact}: You\u2019re already on my job. Clock\u2019s running.` }); return; }
    const jobs = QUESTS.filter(q => q.world === world && q.contact === contact);
    const next = jobs.find(q => !isDone(q.id)) || jobs[Math.floor(Math.random() * jobs.length)];
    if (!next) return;
    onEvent('radio', { text: `${next.intro} [${next.reward.credits || 0} cr]`, offer: next.id, contact, fiction: true });
  }

  // ----- lifecycle -----
  function enter(name) {
    assets(); P = loadProgress(); world = name; cfg = ctx.st().cfg || {}; time = 0; applyUpgrades();
    H.hp = H.max; H.shield = H.smax; H.down = 0; H.inv = 0; H.lastHit = -99; W.heat = 0; W.over = false; W.cd = 0;
    sparks = makeSparks(); zone = makeZone();
    const st = ctx.st(); turret = st.ownRover ? buildTurret(st.ownRover) : null;
    applyCosmetics();
    quest = null;
    if (!resume()) offerTimers.push(setTimeout(() => { if (world === name) offerNext(); }, 4500));
  }
  function exit() {
    offerTimers.forEach(clearTimeout); offerTimers.length = 0;
    for (const a of [...agents]) removeAgent(a);
    for (const b of bolts) scene.remove(b.mesh);
    for (const o of orbs) scene.remove(o.mesh);
    if (quest) for (const it of quest.items) scene.remove(it.obj);
    if (outpost) scene.remove(outpost);
    if (zone) scene.remove(zone.ring);
    if (sparks) { scene.remove(sparks.pts); sparks.pts.geometry.dispose(); sparks.pts.material.dispose(); }
    if (turret) turret.group.parent?.remove(turret.group);
    for (const d of debrisL) scene.remove(d.m); for (const d of splats) scene.remove(d.m); for (const d of pickups) scene.remove(d.obj); debrisL = []; splats = []; pickups = [];
    if (gate) { scene.remove(gate); gate = null; }
    agents = []; bolts = []; orbs = []; rares = []; quest = null; zone = null; outpost = null; sparks = null; turret = null; bandana = null; bossRef = null; world = null;
  }
  function update(dt, input) {
    if (!world) return;
    time += dt;
    updateHealth(dt);
    if (aliensOn()) { updateAgents(dt); updateOrbs(dt); }
    else if (agents.length || orbs.length) { for (const a of [...agents]) { const c = center(a); burst(c.x, c.y, c.z, 12); removeAgent(a); } for (const o of orbs) scene.remove(o.mesh); orbs = []; }
    updateWeapons(dt, input);
    updateBolts(dt); updateTurret(dt); updateSparks(dt); updateDebris(dt); updatePickups(dt);
    updateQuest(dt); updateRares(dt); updateZone(dt); updateDogWarn(dt);
  }
  // tapping a quest item or rare find picks it up; returns undefined when the object is not ours
  function tapObject(o) {
    while (o && !o.userData.poi && o.parent) o = o.parent;
    if (!o) return undefined;
    if (o.userData.rare) {
      const r = rares.find(r => r.obj === o);
      if (r && Math.hypot(r.x - player.x, r.z - player.z) < 25) { pickRare(r); return { rare: true }; }
      return { name: o.userData.name, fact: 'Get a bit closer to pick it up. ' + o.userData.fact };
    }
    if (o.userData.quest && quest) {
      const it = quest.items.find(i => i.obj === o);
      if (it?.collect && Math.hypot(it.x - player.x, it.z - player.z) < 25) { pickCollect(it); return { picked: true }; }
      return { name: o.userData.name, fact: 'Quest objective. Follow the blue arrow and walk right up to it.' };
    }
    return undefined;
  }
  const combat = () => aliensOn() && agents.some(a => !a.burrow && (a.aggro || Math.hypot(a.x - player.x, a.z - player.z) < 60));
  function tapTargets() { const t = rares.map(r => r.obj); if (quest) t.push(...quest.items.map(i => i.obj)); if (outpost) t.push(outpost); return t; }
  function waypoint() {
    if (!quest) return null; const s = stepDef(); if (!s) return null;
    let x = quest.target.x, z = quest.target.z;
    if (s.type === 'collect') { let bd = 1e9; for (const it of quest.items) if (it.collect) { const d = Math.hypot(it.x - player.x, it.z - player.z); if (d < bd) { bd = d; x = it.x; z = it.z; } } }
    if (s.type === 'defeat' && quest.wave) { let bd = 1e9; for (const a of agents) if (a.src === 'quest') { const d = Math.hypot(a.x - player.x, a.z - player.z); if (d < bd) { bd = d; x = a.x; z = a.z; } } }
    return { x, z, dist: Math.hypot(x - player.x, z - player.z), text: stepText() };
  }
  // the dog sniffs out quest items and rare finds before regular discoveries
  function sniffTarget(px, pz) {
    let best = null, bd = 130;
    const consider = (x, z, id, done) => { const d = Math.hypot(x - px, z - pz); if (d < bd && d > 4) { bd = d; best = { x, z, id, done }; } };
    if (quest) for (const it of quest.items) if (it.pick) consider(it.x, it.z, it.id, () => !quest || !quest.items.includes(it));
    for (const r of rares) if (r.obj.parent) consider(r.x, r.z, r.id, () => !rares.includes(r));
    return best;
  }

  return {
    enter, exit, update, fire, accept, useMedkit, switchWeapon, shopList, buy, talk, hurtPlayer: (d, from) => hurt(d, from), bust: () => down('busted'), isDown: () => H.down > 0, abandon: () => abandon(false), equip, tapObject, tapTargets, waypoint, sniffTarget, offerNext, rareFor,
    get combat() { return combat(); },
    setAim(nx, ny, has = true) { aim.x = nx; aim.y = ny; aim.has = has; },
    onDiscover() { gain(20, 10); },
    setAliens(on) {
      P.settings.aliens = !!on; save();
      if (!on) { for (const a of [...agents]) removeAgent(a); for (const o of orbs) scene.remove(o.mesh); orbs.length = 0; for (const b of bolts) scene.remove(b.mesh); bolts.length = 0; W.heat = 0; W.over = false; } if (quest) onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() }); },
    setVoice(on) { P.settings.voice = !!on; save(); }, save: () => save(),
    reload() { P = loadProgress(); applyCosmetics(); },
    get progress() { return P; },
    questList(w = world) {
      return QUESTS.filter(q => q.world === w).map(q => ({ id: q.id, world: q.world, title: q.title, fiction: !!q.fiction, limit: q.limit || 0, steps: q.steps.length, reward: q.reward,
        done: !!P.quests[q.id]?.everDone, active: quest?.def.id === q.id, needsAliens: q.steps.some(s => s.type === 'defeat' && s.wave.includes('boss')) }));
    },
    get info() {
      const st = ctx.st(), r = rankOf(P.xp);
      return {
        hp: Math.round(H.hp), hpMax: H.max, shield: Math.round(H.shield), shieldMax: H.smax, down: H.down > 0,
        combat: combat(), aliens: agents.length, aliensOn: aliensOn(), xp: P.xp, credits: P.credits, rank: r.name, rankNext: r.next, rankBase: r.base,
        heat: Math.round(W.heat), overheat: W.over, turret: !!turret && !!st.driving && aliensOn(), turretYaw: turret?.yaw ?? 0, turretPitch: turret?.pitch ?? 0, recoil: W.recoil,
        quest: quest ? { id: quest.def.id, title: quest.def.title, step: quest.step, steps: quest.def.steps.length, text: stepText(), fiction: !!quest.def.fiction, timer: questTimer() } : null,
        boss: bossRef ? { name: bossRef.T.name, hp: Math.max(0, bossRef.hp), max: bossRef.T.hp } : null,
        rares: rareCount(), raresHere: rares.length, kills: P.stats.kills, deaths: P.stats.deaths, badges: P.badges.length, busted: P.stats.busted,
        weapon: st.driving ? (st.own && turret ? 'roverCannon' : null) : P.equip.weapon, weaponName: curWeapon()?.name || '', shells: P.inv.shells, medkits: P.inv.medkits, hasShotgun: P.unlocks.includes('weapon:shotgun'),
        tracker: (() => { let d = 1e9; for (const a of agents) if (!a.T.still || true) d = Math.min(d, Math.hypot(a.x - player.x, a.z - player.z)); return d; })(),
        zone: zone ? { x: zone.x, z: zone.z, active: zone.active } : null
      };
    },
    mapAliens: () => agents.filter(a => !a.burrow).map(a => ({ x: a.x, z: a.z, boss: !!a.T.boss, nest: a.type === 'nest' })),
    mapGate: () => gate ? { x: gate.position.x, z: gate.position.z } : null,
    // test/debug hooks
    debug: {
      spawn(type, dist = 18, ang = 0, aggro = true) { const st = ctx.st(); const yaw = (st.driving ? st.rover.yaw : player.yaw) + ang; return !!spawnAgent(type, player.x - Math.sin(yaw) * dist, player.z - Math.cos(yaw) * dist, { aggro, src: 'debug' }); },
      hurt(n) { hurt(n, null); },
      clear() { for (const a of [...agents]) removeAgent(a); },
      agents: () => agents.map(a => { const p = center(a).clone().project(camera); return { type: a.type, hp: a.hp, x: a.x, y: a.y, z: a.z, src: a.src, d: Math.hypot(a.x - player.x, a.z - player.z), sx: p.x, sy: p.y, onScreen: inView(a) }; }),
      target: () => quest?.target || null, step: () => stepDef() || null,
      items: () => quest ? quest.items.map(i => ({ x: i.x, z: i.z, collect: !!i.collect, pick: !!i.pick })) : [],
      rares: () => rares.map(r => ({ x: r.x, z: r.z, id: r.id, type: r.def.type })),
      zone: () => zone && { x: zone.x, z: zone.z, active: zone.active, cool: zone.cool },
      calm(on) { for (const a of agents) a.T = on ? { ...AGENT_TYPES[a.type], speed: 0, cd: 999 } : AGENT_TYPES[a.type]; },
      skipTimer(s) { if (quest) { quest.t0 -= s; quest.st0 -= s; } },
      credits(n) { P.credits += n; save(); }, P: () => P, H: () => H, debrisCount: () => debrisL.length + splats.length,
      advance() { if (quest) advance(); }, quest: () => quest && { id: quest.def.id, step: quest.step, gi: quest.gi, target: quest.target }
    }
  };
}
