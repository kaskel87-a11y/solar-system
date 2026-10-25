// v6 game layer: missions (side quests), agents (aliens), weapons, health, rewards and rare finds.
// Built to be reusable: missions are data-driven step lists, agents are typed AI entities, weapons are
// configs, and saved progress already has a credits wallet, so later releases can add NPCs, more
// vehicles, shops and new mission givers without changing the core loop.
import * as THREE from 'three';

// ---------- Saved progress ----------
export const PROGRESS_KEY = 'ssx.progress.v1';
const DEFAULT_PROGRESS = () => ({
  v: 1, xp: 0, credits: 0, badges: [], unlocks: ['paint:steel', 'bandana:none'], equip: { paint: 'steel', bandana: 'none' },
  quests: {}, active: {}, rare: {}, settings: { aliens: true, voice: true }, stats: { kills: 0, deaths: 0, shots: 0 }
});
export function loadProgress() {
  const d = DEFAULT_PROGRESS();
  try { const p = JSON.parse(localStorage.getItem(PROGRESS_KEY)); if (p && typeof p === 'object') return { ...d, ...p, equip: { ...d.equip, ...p.equip }, settings: { ...d.settings, ...p.settings }, stats: { ...d.stats, ...p.stats } }; } catch (e) { /* ignore */ }
  return d;
}
export function saveProgress(p) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ } }

export const RANKS = [[0, 'Cadet'], [100, 'Explorer'], [250, 'Pathfinder'], [500, 'Ranger'], [900, 'Commander'], [1400, 'Star Legend']];
export function rankOf(xp) { let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++; return { i, name: RANKS[i][1], next: RANKS[i + 1]?.[0] ?? null, base: RANKS[i][0] }; }

export const COSMETICS = {
  paint: { steel: { name: 'Stainless', color: 0xb4b9c1 }, lunar: { name: 'Lunar White', color: 0xeef2f6 }, rust: { name: 'Rust Red', color: 0xb0482a }, gold: { name: 'Venus Gold', color: 0xd8a838 }, shadow: { name: 'Shadow Black', color: 0x34363d }, neon: { name: 'Io Neon', color: 0x2fd4c0 } },
  bandana: { none: { name: 'No bandana' }, red: { name: 'Classic Red', color: 0xd23b3b }, stars: { name: 'Star Blue', color: 0x2a5cd8 }, green: { name: 'Mission Green', color: 0x3cc060 }, galaxy: { name: 'Galaxy Purple', color: 0x8a3cf0 } }
};

// ---------- Missions ----------
// Step types: goto (reach a spot, optionally grab an item there), collect (n items spread around a spot),
// defeat (an alien wave; becomes a scan in peaceful mode), return (back to the Starship).
// a/d = compass angle (deg) and distance (m) from the landing site, like discoveries.
export const QUESTS = [
  { id: 'moon-camera', world: 'Moon', title: 'Recover the lost Apollo camera', intro: 'CAPCOM here. Apollo crews left their cameras behind to save weight. One of ours went missing near the old landing zone. Go find it.',
    steps: [{ type: 'goto', a: 60, d: 95, item: 'camera', text: 'Find the lost camera' }, { type: 'return', text: 'Bring the camera back to the Starship' }],
    reward: { xp: 60, credits: 50, badge: 'Shutterbug', unlock: 'bandana:stars' }, fact: 'Apollo astronauts left about a dozen Hasselblad camera bodies on the Moon and brought home only the film, saving weight for Moon rocks.' },
  { id: 'moon-ice', world: 'Moon', title: 'Scan 3 ice deposits in Shackleton', intro: 'Mission Control to rover crew: the shadowed crater ahead is our stand-in for Shackleton. Scan three ice deposits for the Artemis team.',
    steps: [{ type: 'collect', a: -100, d: 150, spread: 16, n: 3, item: 'icecore', text: 'Scan ice deposits' }],
    reward: { xp: 80, credits: 60, unlock: 'paint:lunar' }, fact: 'Shackleton crater sits almost exactly on the Moon\u2019s south pole. Parts of its floor never see sunlight, which makes it a top target in the hunt for ice.' },
  { id: 'moon-drones', world: 'Moon', title: 'Drone swarm at the crater rim', fiction: true, intro: 'Uh, CAPCOM here\u2026 we\u2019re tracking unidentified drones near the crater rim. Grab your blaster and clear them out. (Fiction!)',
    steps: [{ type: 'defeat', a: -20, d: 120, wave: ['drone', 'drone', 'drone', 'drone'], text: 'Zap the drones' }],
    reward: { xp: 100, credits: 80, badge: 'Moon Defender' } },
  { id: 'mars-rescue', world: 'Mars', title: 'Rescue a stranded rover', fiction: true, intro: 'Mission Control: one of our science rovers is stuck and bug-like crawlers are poking at it. Get out there, chase them off and reboot it.',
    steps: [{ type: 'goto', a: -40, d: 130, r: 12, item: 'stuckrover', keep: true, text: 'Reach the stranded rover' }, { type: 'defeat', a: -40, d: 130, wave: ['crawler', 'crawler', 'crawler'], text: 'Chase off the crawlers' }, { type: 'goto', a: -40, d: 130, r: 5, text: 'Reboot the rover' }],
    reward: { xp: 120, credits: 100, unlock: 'paint:rust' }, fact: 'For real: NASA\u2019s Spirit rover got stuck in soft sand on Mars in 2009. Engineers tried for months to free it, then turned it into a stationary science station.' },
  { id: 'mars-signal', world: 'Mars', title: 'Find the signal source', fiction: true, intro: 'We\u2019re picking up a strange repeating signal on Mars. Triangulate it, follow the trail of glowing shards, and find out who\u2019s sending it. Be careful out there. (Fiction!)',
    steps: [{ type: 'goto', a: 100, d: 120, r: 10, text: 'Triangulate the signal' }, { type: 'collect', a: 125, d: 170, spread: 14, n: 3, item: 'artifact', text: 'Collect glowing artifact shards' },
      { type: 'goto', a: 160, d: 240, r: 14, outpost: true, text: 'Follow the signal to its source' }, { type: 'defeat', a: 160, d: 240, wave: ['drone', 'drone', 'crawler', 'crawler'], text: 'Defend yourself at the outpost' },
      { type: 'defeat', a: 160, d: 240, wave: ['boss'], text: 'Defeat the Hive Queen!' }],
    reward: { xp: 300, credits: 250, badge: 'Xeno Hunter', unlock: 'bandana:galaxy' }, fact: 'The alien outpost is pure fiction. Real scientists do listen for signals from space, though: SETI searches have run since 1960.' },
  { id: 'venus-capsule', world: 'Venus', title: 'Retrieve the Venera data capsule', limit: 100, intro: 'Mission Control: a Venera-style data capsule is out there. Your suit can only take this heat for 100 seconds. Grab it and get back to the ship. Go, go, go!',
    steps: [{ type: 'goto', a: 150, d: 140, item: 'capsule', text: 'Grab the data capsule' }, { type: 'return', text: 'Back to the ship before your suit overheats' }],
    reward: { xp: 130, credits: 120, badge: 'Heatproof', unlock: 'paint:gold' }, fact: 'Venus\u2019s surface is about 465 \u00b0C, hot enough to melt lead. The toughest Soviet Venera landers lasted only about two hours.' },
  { id: 'venus-drones', world: 'Venus', title: 'Cloud drones', fiction: true, intro: 'Something is buzzing in the haze west of you. Probably not weather balloons. Investigate and zap anything hostile. (Fiction!)',
    steps: [{ type: 'defeat', a: -90, d: 130, wave: ['drone', 'drone', 'drone', 'crawler'], text: 'Clear the cloud drones' }],
    reward: { xp: 100, credits: 80 } },
  { id: 'mercury-sunrise', world: 'Mercury', title: 'Outrun the sunrise', limit: 55, intro: 'Mission Control: sunrise is coming, and Mercury\u2019s day side hits 430 \u00b0C. Race to the shadow line ahead in 55 seconds. The rover is your friend!',
    steps: [{ type: 'goto', a: 0, d: 380, r: 16, text: 'Reach the shadow line before sunrise!' }],
    reward: { xp: 140, credits: 120, badge: 'Shadow Runner', unlock: 'paint:shadow' }, fact: 'A solar day on Mercury lasts 176 Earth days. At the equator the dawn line creeps along at only about 3.5 km/h, slow enough to walk ahead of it.' },
  { id: 'mercury-ice', world: 'Mercury', title: 'Map polar ice', intro: 'Mission Control: MESSENGER spotted ice in Mercury\u2019s shadowed craters. Scan three deposits for us.',
    steps: [{ type: 'collect', a: -30, d: 120, spread: 16, n: 3, item: 'icecore', text: 'Scan polar ice' }],
    reward: { xp: 80, credits: 60 }, fact: 'Mercury may hold roughly 100 billion to 1 trillion tonnes of water ice in permanently shadowed craters near its poles.' },
  { id: 'earth-fetch', world: 'Earth', title: 'Fetch! The lost tennis balls', dog: true, intro: 'Mission Control: priority alert from your dog. Three tennis balls are missing. Follow that nose!',
    steps: [{ type: 'collect', a: 30, d: 60, spread: 22, n: 3, item: 'ball', text: 'Find the tennis balls' }],
    reward: { xp: 60, credits: 40, badge: 'Good Dog', unlock: 'bandana:red' }, fact: 'A dog\u2019s nose has up to about 300 million scent receptors. Ours have about 6 million.' },
  { id: 'earth-picnic', world: 'Earth', title: 'Picnic crashers', fiction: true, intro: 'Base camp reports space bugs raiding a picnic down the hill. Shoo them away before they eat all the sandwiches! (Fiction!)',
    steps: [{ type: 'goto', a: -60, d: 80, r: 12, item: 'picnic', keep: true, text: 'Find the picnic' }, { type: 'defeat', a: -60, d: 80, wave: ['crawler', 'crawler', 'crawler'], text: 'Shoo the crawlers away' }],
    reward: { xp: 90, credits: 60, unlock: 'bandana:green' } },
  { id: 'io-sample', world: 'Io', title: 'Sulfur sample sprint', limit: 80, intro: 'Mission Control: Jupiter\u2019s radiation is brutal here. Grab a sulfur sample and get back to the ship within 80 seconds.',
    steps: [{ type: 'goto', a: -60, d: 150, item: 'sample', text: 'Grab a sulfur sample' }, { type: 'return', text: 'Back to the ship, fast!' }],
    reward: { xp: 120, credits: 100, unlock: 'paint:neon' }, fact: 'Io orbits inside Jupiter\u2019s intense radiation belts. An unprotected person there would get a deadly dose in about a day.' },
  { id: 'europa-ice', world: 'Europa', title: 'Ice samples for the ocean hunters', intro: 'Mission Control: the Europa Clipper team wants ground truth. Collect three ice samples near the cracks.',
    steps: [{ type: 'collect', a: 30, d: 90, spread: 20, n: 3, item: 'sample', text: 'Collect ice samples' }],
    reward: { xp: 90, credits: 80 }, fact: 'Europa Clipper is planned to fly past Europa about 49 times, measuring how thick the ice is and studying the ocean below.' },
  { id: 'titan-sea', world: 'Titan', title: 'Sample a methane sea', fiction: true, intro: 'Mission Control: scoop a sample from the methane shore. Our sensors also show\u2026 drones in the haze? Stay sharp. (The drones are fiction!)',
    steps: [{ type: 'goto', a: 60, d: 90, r: 14, item: 'sample', text: 'Scoop a methane sample' }, { type: 'defeat', a: 60, d: 90, wave: ['drone', 'drone'], text: 'Zap the haze drones' }],
    reward: { xp: 110, credits: 90 }, fact: 'Titan\u2019s seas are liquid methane and ethane at about \u2212179 \u00b0C. Kraken Mare, the biggest, is larger than the Caspian Sea.' }
];
const ALIEN_ZONES = { Moon: { a: -150, d: 220, wave: ['drone', 'drone'] }, Mars: { a: 40, d: 260, wave: ['crawler', 'crawler', 'drone'] }, Venus: { a: -120, d: 230, wave: ['drone', 'drone'] }, Mercury: { a: 80, d: 230, wave: ['crawler', 'drone'] },
  Io: { a: 100, d: 200, wave: ['drone', 'crawler'] }, Europa: { a: -120, d: 220, wave: ['crawler', 'crawler'] }, Titan: { a: -150, d: 180, wave: ['drone', 'drone'] } };

const RARE_TYPES = [
  { type: 'crystal', w: 0.45, name: 'Olivine crystals', xp: 15, credits: 10, fact: 'Olivine is a green mineral found in meteorites and in rocks on the Moon and Mars. On Earth, gem-quality olivine is called peridot.' },
  { type: 'meteorite', w: 0.35, name: 'Pallasite meteorite', xp: 15, credits: 10, fact: 'Pallasites are rare meteorites made of iron-nickel metal studded with olivine crystals. Most scientists think they formed where an asteroid\u2019s metal core met its rocky mantle.' },
  { type: 'artifact', w: 0.2, name: 'Alien artifact (fiction)', xp: 25, credits: 20, fiction: true, fact: 'Fiction! This glowing alien trinket is made up for the game. It hums quietly when your dog sniffs it.' }
];

// ---------- Agents (aliens now; the same AI shell can drive NPCs later) ----------
export const AGENT_TYPES = {
  drone: { hp: 3, speed: 8, hover: 4.5, r: 1.2, attack: 'shoot', dmg: 7, cd: 2.4, range: 30, keep: 11, xp: 10, credits: 5 },
  crawler: { hp: 4, speed: 6.5, hover: 0, r: 1.1, attack: 'melee', dmg: 9, cd: 1.3, range: 2.6, keep: 0, xp: 15, credits: 8 },
  boss: { hp: 45, speed: 4, hover: 7, r: 3.4, attack: 'shoot', dmg: 11, cd: 1.3, range: 45, keep: 16, xp: 150, credits: 100, boss: true, name: 'Hive Queen' }
};
// weapons are data too, so future vehicles can mount their own
export const WEAPONS = {
  blaster: { cd: 0.2, dmg: 1, speed: 95, color: 0x7fe9ff, size: 1, heat: 0 },
  roverCannon: { cd: 0.11, dmg: 1.4, speed: 120, color: 0xff5cf0, size: 1.7, heat: 6.5, twin: true }
};

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...o });
const B = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
function glowTex(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, c0); r.addColorStop(0.35, c1); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// shared geometry/materials, created once and reused across landings (cheap on phones)
const A = {};
function assets() {
  if (A.ok) return A; A.ok = true;
  A.droneBody = new THREE.SphereGeometry(0.75, 16, 10); A.droneRing = new THREE.TorusGeometry(1.05, 0.12, 6, 20); A.eye = new THREE.SphereGeometry(0.26, 10, 8);
  A.fin = new THREE.BoxGeometry(0.08, 0.5, 0.6); A.antenna = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4); A.bulb = new THREE.SphereGeometry(0.09, 6, 4);
  A.bugBody = new THREE.SphereGeometry(0.7, 14, 10); A.bugHead = new THREE.SphereGeometry(0.42, 12, 8); A.bugEye = new THREE.SphereGeometry(0.17, 10, 8); A.pupil = new THREE.SphereGeometry(0.08, 8, 6);
  A.leg = (() => { const g = new THREE.CylinderGeometry(0.06, 0.04, 0.8, 5); g.translate(0, -0.4, 0); return g; })();
  A.spot = new THREE.SphereGeometry(0.16, 6, 4); A.crown = new THREE.ConeGeometry(0.18, 0.6, 5);
  A.mDrone = M(0x7a5cd6, { metalness: 0.3, roughness: 0.35, flatShading: true }); A.mDrone2 = M(0x3a2c6a, { flatShading: true });
  A.mEye = B(0x5dffb0); A.mBug = M(0x4fc04a, { roughness: 0.5 }); A.mBug2 = M(0x2a6a2a); A.mWhite = B(0xffffff); A.mBlack = B(0x111111);
  A.mBoss = M(0xc04ad6, { roughness: 0.4, flatShading: true }); A.mCrown = B(0xffd84a);
  A.orbGeo = new THREE.SphereGeometry(0.32, 10, 8); A.mOrb = B(0xff4fa8, { transparent: true, opacity: 0.95 });
  A.boltGeo = (() => { const g = new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6); g.rotateX(Math.PI / 2); return g; })();
  A.mBolt = { 0x7fe9ff: B(0x7fe9ff, { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 0xff5cf0: B(0xff5cf0, { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }) };
  A.sparkTex = glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)');
  A.flashMat = new THREE.SpriteMaterial({ map: glowTex('rgba(255,240,255,1)', 'rgba(255,90,240,0.6)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  A.pickBeam = (() => { const g = new THREE.CylinderGeometry(0.25, 0.25, 30, 6, 1, true); g.translate(0, 15, 0); return g; })();
  A.mPickBeam = B(0x4fd8ff, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  A.zoneRing = new THREE.RingGeometry(16, 17.5, 40); A.mZone = B(0xb04aff, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  A.mGreen = B(0x3cff6a);
  // the surface tears down its scene on exit and disposes everything; mark shared stuff so it can opt out
  for (const k in A) { const v = A[k]; if (v && (v.isBufferGeometry || v.isMaterial)) v.userData.shared = true; }
  for (const k in A.mBolt) A.mBolt[k].userData.shared = true;
  return A;
}

function buildDrone() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const b = new THREE.Mesh(A.droneBody, A.mDrone); b.scale.y = 0.62; body.add(b);
  const ring = new THREE.Mesh(A.droneRing, A.mDrone2); ring.rotation.x = Math.PI / 2; body.add(ring);
  const eye = new THREE.Mesh(A.eye, A.mEye); eye.position.set(0, 0, -0.62); body.add(eye);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(A.fin, A.mDrone2); f.position.set(s * 1.05, -0.1, 0.2); body.add(f);
    const an = new THREE.Mesh(A.antenna, A.mDrone2); an.position.set(s * 0.25, 0.6, 0); an.rotation.z = s * 0.4; body.add(an);
    const bl = new THREE.Mesh(A.bulb, A.mEye); bl.position.set(s * 0.37, 0.88, 0); body.add(bl);
  }
  return { group: g, body, ring };
}
function buildCrawler(boss = false) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mb = boss ? A.mBoss : A.mBug;
  const b = new THREE.Mesh(A.bugBody, mb); b.scale.set(1, 0.62, 1.35); b.position.set(0, 0.75, 0.25); body.add(b);
  for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(A.spot, A.mBug2); sp.position.set((i % 2 ? 0.35 : -0.3), 1.12, -0.1 + i * 0.22); sp.scale.y = 0.4; body.add(sp); }
  const head = new THREE.Mesh(A.bugHead, mb); head.position.set(0, 0.85, -0.75); body.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(A.bugEye, A.mWhite); e.position.set(s * 0.2, 1.1, -0.98); body.add(e); const p = new THREE.Mesh(A.pupil, A.mBlack); p.position.set(s * 0.2, 1.1, -1.13); body.add(p); }
  const legs = [];
  for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, z = -0.35 + Math.floor(i / 2) * 0.4; const l = new THREE.Mesh(A.leg, A.mBug2); l.position.set(s * 0.55, 0.8, z); l.rotation.z = s * 0.9; body.add(l); legs.push(l); }
  if (boss) {
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(A.crown, A.mCrown); const a = i / 5 * Math.PI * 2; c.position.set(Math.cos(a) * 0.28, 1.35, -0.75 + Math.sin(a) * 0.28); body.add(c); }
    const ring = new THREE.Mesh(A.droneRing, A.mDrone2); ring.rotation.x = Math.PI / 2; ring.position.y = 0.7; ring.scale.setScalar(1.3); body.add(ring);
  }
  return { group: g, body, legs };
}

const ITEM_BUILD = {
  camera() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.35), M(0x9a9a9a)); b.position.y = 0.25; g.add(b); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.25, 12), M(0x222222)); l.rotation.x = Math.PI / 2; l.position.set(0, 0.25, -0.28); g.add(l); return g; },
  icecore() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), M(0xcff4ff, { emissive: 0x2a5a7a, roughness: 0.1, flatShading: true })); c.scale.y = 1.5; c.position.y = 0.7; g.add(c); return g; },
  artifact() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.TetrahedronGeometry(0.5, 0), B(0xb46bff)); c.position.y = 0.9; g.add(c); g.userData.spin = c; return g; },
  capsule() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), M(0xd0d0d0, { metalness: 0.25 })); c.position.y = 0.45; g.add(c); const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16), M(0xc03030)); band.rotation.x = Math.PI / 2; band.position.y = 0.45; g.add(band); return g; },
  ball() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M(0xd6f03a, { roughness: 0.9 })); c.position.y = 0.2; g.add(c); return g; },
  sample() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 10), M(0xeeeeee, { emissive: 0x224455 })); c.position.y = 0.35; g.add(c); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10), M(0x2a8ad8)); cap.position.y = 0.75; g.add(cap); return g; },
  stuckrover() {
    const g = new THREE.Group(), w = M(0xe8e8e8), d = M(0x2a2a2a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 3), w); b.position.y = 1.0; b.rotation.z = 0.12; g.add(b);
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 10), d); wh.rotation.z = Math.PI / 2; wh.position.set(s * 1.2, 0.25, k * 1.15); g.add(wh); }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), w); m.position.set(0.6, 2.1, 1.2); g.add(m);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), B(0xff3030)); light.position.set(0.6, 2.95, 1.2); g.add(light); g.userData.light = light; return g;
  },
  picnic() {
    const g = new THREE.Group(); const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#d03030'; x.fillRect(i * 8, j * 8, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), new THREE.MeshStandardMaterial({ map: t })); bl.rotation.x = -Math.PI / 2; bl.position.y = 0.04; g.add(bl);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.45), M(0xa06a30)); bk.position.set(0.6, 0.25, 0.3); g.add(bk); return g;
  },
  outpost() {
    const g = new THREE.Group(), m = M(0x2a1f3a, { flatShading: true }), glow = B(0xb46bff);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); g.add(dome);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.6, 8, 5), m); sp.position.set(Math.cos(a) * 9, 4, Math.sin(a) * 9); sp.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); g.add(sp);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glow); tip.position.set(Math.cos(a) * 9.6, 8, Math.sin(a) * 9.6); g.add(tip);
    }
    const door = new THREE.Mesh(new THREE.CircleGeometry(1.8, 14), glow); door.position.set(0, 1.6, 6.8); g.add(door); return g;
  },
  crystal() { const g = new THREE.Group(), m = M(0x6ad84a, { emissive: 0x1a4a10, roughness: 0.2, flatShading: true }); for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + i * 0.05, 0), m); c.scale.y = 2.2; c.position.set(Math.cos(i * 1.3) * 0.3, 0.35, Math.sin(i * 1.3) * 0.3); c.rotation.z = (i - 2) * 0.25; g.add(c); } return g; },
  meteorite() { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), M(0x5a4a3a, { metalness: 0.25, flatShading: true })); r.position.y = 0.4; g.add(r); const sm = M(0xa0d84a, { emissive: 0x204010 }); for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), sm); s.position.set(Math.cos(i) * 0.5, 0.4 + Math.sin(i * 2) * 0.3, Math.sin(i) * 0.5); g.add(s); } return g; }
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

  // ----- agents: a small reusable AI (idle wander -> aggro -> chase/orbit -> attack) -----
  function spawnAgent(type, x, z, opts = {}) {
    if (agents.length >= CAP) return null;
    const T = AGENT_TYPES[type];
    const m = type === 'drone' ? buildDrone() : buildCrawler(type === 'boss');
    if (T.boss) m.group.scale.setScalar(2.6);
    const y = height(x, z) + T.hover;
    m.group.position.set(x, y, z); scene.add(m.group);
    const a = { type, T, ...m, x, y, z, vy: 0, hp: T.hp, cd: 1 + Math.random() * T.cd, aggro: !!opts.aggro, home: { x, z }, src: opts.src || null, phase: Math.random() * 6, hit: 0, yaw: 0, orbitDir: Math.random() < 0.5 ? -1 : 1, summon: 9 };
    agents.push(a); if (T.boss) bossRef = a;
    burst(x, y + 1, z, 14, 4, [[0.7, 0.4, 1], [1, 1, 1]]);
    return a;
  }
  function removeAgent(a) { scene.remove(a.group); const i = agents.indexOf(a); if (i >= 0) agents.splice(i, 1); if (a === bossRef) bossRef = null; }
  function killAgent(a) {
    const c = center(a);
    burst(c.x, c.y, c.z, a.T.boss ? 110 : 36, a.T.boss ? 12 : 7);
    removeAgent(a);
    P.stats.kills++; gain(a.T.xp, a.T.credits, true);
    onEvent('poof', { type: a.type, xp: a.T.xp, boss: !!a.T.boss });
    if (a.src === 'zone' && zone) { zone.left--; if (zone.left <= 0) { zone.cool = 90; zone.active = false; onEvent('toast', { text: '👾 Alien zone cleared!' }); } }
    if (a.src === 'quest' && quest) { quest.killed++; onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() }); checkStep(); }
  }
  const target = () => { const st = ctx.st(); return st.driving ? { x: st.rover.x, y: st.rover.y + 1.6, z: st.rover.z, r: 2.6 } : { x: player.x, y: player.y - 0.7, z: player.z, r: 0.9 }; };
  function updateAgents(dt) {
    const st = ctx.st(), tg = target();
    for (const a of [...agents]) {
      const dx = tg.x - a.x, dz = tg.z - a.z, dist = Math.hypot(dx, dz) || 0.001;
      if (!a.aggro && dist < 48) a.aggro = true;
      a.phase += dt; a.hit = Math.max(0, a.hit - dt * 5);
      let vx = 0, vz = 0;
      if (H.down > 0 || !a.aggro || st.intro > 0) {
        const hx = a.home.x + Math.cos(a.phase * 0.4) * 6 - a.x, hz = a.home.z + Math.sin(a.phase * 0.4) * 6 - a.z, hl = Math.hypot(hx, hz) || 1;
        vx = hx / hl * 2; vz = hz / hl * 2;
      } else if (a.T.attack === 'melee') {
        if (dist > a.T.range * 0.8) { vx = dx / dist * a.T.speed; vz = dz / dist * a.T.speed; }
        a.cd -= dt;
        if (dist < a.T.range + tg.r * 0.5 && a.cd <= 0) { a.cd = a.T.cd; a.vy = 4; hurt(a.T.dmg, a); a.x -= dx / dist * 1.5; a.z -= dz / dist * 1.5; }
      } else {
        // hover and circle at a comfortable distance, lobbing slow, dodgeable orbs
        const rad = dist - a.T.keep, tx = -dz / dist * a.orbitDir, tz = dx / dist * a.orbitDir;
        vx = dx / dist * rad * 0.9 + tx * a.T.speed * 0.6; vz = dz / dist * rad * 0.9 + tz * a.T.speed * 0.6;
        const sp = Math.hypot(vx, vz); if (sp > a.T.speed) { vx *= a.T.speed / sp; vz *= a.T.speed / sp; }
        a.cd -= dt;
        if (dist < a.T.range && a.cd <= 0) {
          a.cd = a.T.cd * (0.8 + Math.random() * 0.4);
          const n = a.T.boss ? 3 : 1;
          for (let k = 0; k < n; k++) fireOrb(a, tg, (k - (n - 1) / 2) * 0.2);
        }
        if (a.T.boss) { a.summon -= dt; if (a.summon <= 0) { a.summon = 12; if (agents.length < CAP - 1) { spawnAgent('crawler', a.x + 5, a.z + 3, { aggro: true, src: 'minion' }); spawnAgent('drone', a.x - 5, a.z - 3, { aggro: true, src: 'minion' }); } } }
      }
      a.x += vx * dt; a.z += vz * dt;
      const gh = height(a.x, a.z);
      if (a.T.hover) a.y += (gh + a.T.hover + Math.sin(a.phase * 2.2) * 0.5 - a.y) * Math.min(1, dt * 3);
      else { a.vy -= 12 * dt; a.y += a.vy * dt; if (a.y < gh) { a.y = gh; a.vy = 0; } }
      a.group.position.set(a.x, a.y, a.z);
      const fy = Math.atan2(-dx, -dz); a.yaw += Math.atan2(Math.sin(fy - a.yaw), Math.cos(fy - a.yaw)) * Math.min(1, dt * 6);
      a.group.rotation.y = a.yaw;
      a.body.scale.setScalar(1 + a.hit * 0.35);
      if (a.ring) a.ring.rotation.z += dt * 4;
      if (a.legs) { const sp = Math.hypot(vx, vz), w = Math.sin(a.phase * 18) * Math.min(1, sp / 3) * 0.5; a.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? w : -w) * (Math.floor(i / 2) % 2 ? -1 : 1); }); }
      if (a.src === 'zone' && Math.hypot(a.x - a.home.x, a.z - a.home.z) > 140) a.aggro = false; // leash
    }
  }
  function fireOrb(a, tg, spread) {
    const o = new THREE.Mesh(A.orbGeo, A.mOrb); const sy = a.y + (a.T.boss ? 2 : 0);
    o.position.set(a.x, sy, a.z); scene.add(o);
    const d = new THREE.Vector3(tg.x - a.x, tg.y - sy, tg.z - a.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
    orbs.push({ mesh: o, v: d.multiplyScalar(a.T.boss ? 15 : 13), life: 4, dmg: a.T.dmg, src: a });
  }
  function updateOrbs(dt) {
    const tg = target();
    for (const o of [...orbs]) {
      o.life -= dt; o.mesh.position.addScaledVector(o.v, dt);
      const p = o.mesh.position; o.mesh.scale.setScalar(1 + Math.sin(time * 20) * 0.15);
      const hitP = Math.hypot(p.x - tg.x, p.y - tg.y, p.z - tg.z) < tg.r + 0.3;
      if (hitP && H.down <= 0) { hurt(o.dmg, o.src); burst(p.x, p.y, p.z, 10, 4, [[1, 0.4, 0.7]]); }
      if (hitP || o.life <= 0 || p.y < height(p.x, p.z)) { scene.remove(o.mesh); orbs.splice(orbs.indexOf(o), 1); }
    }
  }

  // ----- health: shield first, regen after a breather, respawn at the ship (nothing lost) -----
  function hurt(dmg, from) {
    if (H.down > 0 || H.inv > 0 || ctx.st().intro > 0) return;
    if (ctx.st().driving) dmg *= 0.5; // the rover's hull soaks up half
    H.lastHit = time;
    const s = Math.min(H.shield, dmg); H.shield -= s; dmg -= s;
    H.hp = Math.max(0, H.hp - dmg);
    onEvent('hurt', { hp: H.hp, shield: H.shield, fromX: from?.x, fromZ: from?.z });
    if (H.hp <= 0) { H.down = 2.4; P.stats.deaths++; save(); onEvent('down', {}); }
  }
  function updateHealth(dt) {
    if (H.inv > 0) H.inv -= dt;
    if (H.down > 0) {
      H.down -= dt;
      if (H.down <= 0) {
        ctx.respawn();
        H.hp = H.max; H.shield = H.smax; H.inv = 3; H.lastHit = time;
        for (const a of [...agents]) removeAgent(a);
        for (const o of orbs) scene.remove(o.mesh); orbs = [];
        if (zone) { zone.active = false; zone.cool = Math.max(zone.cool, 20); }
        if (quest) { quest.wave = null; quest.killed = 0; }
        onEvent('respawn', {});
        onEvent('radio', { text: 'Mission Control: you\u2019re okay! We beamed you back to the Starship and recharged your shields. Nothing lost. Go get \u2019em!' });
      }
      return;
    }
    if (time - H.lastHit > 3.5) H.shield = Math.min(H.smax, H.shield + 22 * dt);
    if (time - H.lastHit > 7) H.hp = Math.min(H.max, H.hp + 5 * dt);
  }

  // ----- weapons -----
  const tmpV = new THREE.Vector3(), cV = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector3();
  function center(a) { return cV.set(a.x, a.y + (a.T.hover ? 0 : 0.8 * (a.T.boss ? 2.6 : 1)), a.z); }
  function inView(a) { ndc.copy(center(a)).project(camera); return ndc.z < 1 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1; }
  // nearest alien on screen (phone auto-aim), optionally inside a cone around a direction
  function autoTarget(from, dir, cone = Math.PI, range = 75) {
    let best = null, bs = Infinity;
    for (const a of agents) {
      if (!inView(a)) continue;
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
    for (const a of agents) { const c = center(a); const ang = tmpV.copy(c).sub(ray.ray.origin).normalize().angleTo(ray.ray.direction); if (ang < ba && c.distanceTo(from) < 90) { ba = ang; best = a; } }
    if (best) return { agent: best, point: center(best).clone() };
    return { agent: null, point: ray.ray.at(80, new THREE.Vector3()) };
  }
  function muzzle() {
    const st = ctx.st();
    if (st.driving && turret) { turret.group.updateMatrixWorld(true); return (W.side ? turret.tipR : turret.tipL).getWorldPosition(new THREE.Vector3()); }
    if (st.camDist < 0.8) return new THREE.Vector3(player.x, player.y - 0.35, player.z).addScaledVector(camera.getWorldDirection(tmpV), 0.6);
    const fy = player.yaw;
    return new THREE.Vector3(player.x + Math.cos(fy) * 0.45 - Math.sin(fy) * 0.4, player.y - 0.45, player.z - Math.sin(fy) * 0.45 - Math.cos(fy) * 0.4);
  }
  // fire once. aimAt = {x,y} in NDC to shoot along a screen ray, or null for auto-aim (phone Fire button)
  function fire(aimAt) {
    const st = ctx.st();
    if (!aliensOn() || H.down > 0 || st.intro > 0 || st.outro > 0) return false;
    const wpn = st.driving ? WEAPONS.roverCannon : WEAPONS.blaster;
    if (W.cd > 0 || (wpn.heat && W.over)) return false;
    W.cd = wpn.cd; W.lastShot = time;
    if (wpn.twin) W.side ^= 1;
    const from = muzzle();
    let to;
    if (aimAt) to = rayTarget(aimAt.x, aimAt.y, from).point;
    else {
      const dir = st.driving ? new THREE.Vector3(-Math.sin(st.rover.yaw), 0, -Math.cos(st.rover.yaw)) : camera.getWorldDirection(new THREE.Vector3());
      const t = autoTarget(from, dir, st.driving ? 1.05 : Math.PI);
      if (t) to = center(t).clone();
      else if (st.driving && turret) { to = new THREE.Vector3(0, 0, -80); turret.pitchG.localToWorld(to); }
      else to = from.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 80);
    }
    if (st.driving && turret) turret.lock = to.clone();
    const v = to.clone().sub(from).normalize().multiplyScalar(wpn.speed);
    const m = new THREE.Mesh(A.boltGeo, A.mBolt[wpn.color]);
    m.scale.setScalar(wpn.size); m.position.copy(from); m.lookAt(to); scene.add(m);
    bolts.push({ mesh: m, v, life: 1.1, dmg: wpn.dmg, heavy: !!wpn.twin, prev: from.clone() });
    if (wpn.heat) { W.heat = Math.min(100, W.heat + wpn.heat); if (W.heat >= 100) { W.over = true; onEvent('overheat', {}); } W.flash = 0.06; W.recoil = 1; }
    P.stats.shots++;
    onEvent('zap', { heavy: !!wpn.twin });
    return true;
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
          a.hp -= b.dmg; a.hit = 1; a.aggro = true; burst(q.x, q.y, q.z, 6, 4, [[0.6, 0.95, 1], [1, 1, 1]]);
          onEvent('hit', { boss: !!a.T.boss });
          if (a.hp <= 0) killAgent(a);
          dead = true; break;
        }
      }
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
    if (!st.driving || !aliensOn()) {
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
    Object.assign(outpost.userData, { poi: true, name: '👾 Alien outpost (fiction)', fact: 'Fiction! A made-up alien outpost for the game. No one has ever found aliens on Mars.' });
    scene.add(outpost);
  }
  function clearQuestObjects() {
    if (!quest) return;
    for (const it of quest.items || []) scene.remove(it.obj);
    for (const a of [...agents]) if (a.src === 'quest' || a.src === 'minion') removeAgent(a);
    if (outpost) { scene.remove(outpost); outpost = null; }
    quest.items = []; quest.wave = null;
  }
  const stepDef = () => quest?.def.steps[quest.step];
  function stepTarget(s) {
    if (s.type === 'return') { const S = ctx.SHIP; return { x: S.x - 8, z: S.z + 8, r: 12 }; }
    const p = ctx.safePoint(s.a, s.d); return { x: p.x, z: p.z, r: s.r ?? 4 };
  }
  function startStep() {
    const s = stepDef(); if (!s) return;
    const qs = qState(quest.def.id); qs.step = quest.step; save();
    quest.items = quest.items.filter(it => { if (it.keep) return true; scene.remove(it.obj); return false; });
    quest.killed = 0; quest.wave = null; quest.target = stepTarget(s);
    const tg = quest.target;
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
    if (s.type === 'defeat' && quest.wave) return `${s.text} (${quest.killed}/${quest.wave.total})`;
    return s.text;
  }
  function accept(id) {
    const def = QUESTS.find(q => q.id === id); if (!def || def.world !== world) return false;
    if (quest) { if (quest.def.id === id) return true; abandon(true); }
    const qs = qState(id); qs.status = 'active'; qs.step = 0; qs.n = 0; P.active[world] = id; save();
    quest = { def, step: 0, items: [], t0: time, killed: 0 };
    startStep();
    onEvent('radio', { text: def.intro, quest: id, fiction: !!def.fiction });
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
    onEvent('radio', { text: `Mission Control: great work! "${def.title}" complete.${def.fact ? ' ' + def.fact : ''}` });
    offerTimers.push(setTimeout(() => offerNext(), 9000));
  }
  function fail(reason) {
    if (!quest) return; const def = quest.def; clearQuestObjects();
    const qs = qState(def.id); qs.status = qs.everDone ? 'done' : 'new'; delete P.active[world]; save(); quest = null;
    onEvent('quest', { kind: 'failed', id: def.id, title: def.title });
    onEvent('radio', { text: `Mission Control: ${reason} No harm done. Want to try "${def.title}" again?`, offer: def.id });
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
      return fail(quest.def.id === 'mercury-sunrise' ? 'the Sun came up before you reached the shadow line! We pulled you back just in time.' : 'your suit got too hot, so we pulled you back.');
    for (const it of quest.items) { if (it.obj.userData.spin) it.obj.userData.spin.rotation.y += dt * 2; if (it.obj.userData.beam) it.obj.userData.beam.scale.set(1 + Math.sin(time * 3) * 0.25, 1, 1 + Math.sin(time * 3) * 0.25); }
    const tg = quest.target;
    if (s.type === 'goto' || s.type === 'return') {
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
        s.wave.forEach((t, k) => { const a = (k / s.wave.length) * Math.PI * 2; spawnAgent(t, tg.x + Math.cos(a) * 9, tg.z + Math.sin(a) * 9, { aggro: true, src: 'quest' }); });
        if (s.wave.includes('boss')) onEvent('radio', { text: 'Mission Control: that\u2019s the Hive Queen! Keep moving and keep zapping. (Fiction!)' });
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
  const available = () => QUESTS.filter(q => q.world === world && !isDone(q.id) && (aliensOn() || !q.steps.some(s => s.type === 'defeat' && s.wave.includes('boss'))));
  function offerNext() {
    if (!world || quest || H.down > 0) return;
    const next = available()[0];
    if (next) onEvent('radio', { text: `Mission Control: side quest available: "${next.title}"${next.fiction ? ' (fiction)' : ''}. Want it?`, offer: next.id });
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
    if (st.rover?.paint) st.rover.paint.color.setHex(COSMETICS.paint[P.equip.paint]?.color ?? 0xb4b9c1);
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

  // ----- lifecycle -----
  function enter(name) {
    assets(); P = loadProgress(); world = name; cfg = ctx.st().cfg || {}; time = 0;
    H.hp = H.max; H.shield = H.smax; H.down = 0; H.inv = 0; H.lastHit = -99; W.heat = 0; W.over = false; W.cd = 0;
    sparks = makeSparks(); zone = makeZone();
    const st = ctx.st(); turret = st.rover ? buildTurret(st.rover) : null;
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
    agents = []; bolts = []; orbs = []; rares = []; quest = null; zone = null; outpost = null; sparks = null; turret = null; bandana = null; bossRef = null; world = null;
  }
  function update(dt, input) {
    if (!world) return;
    time += dt;
    updateHealth(dt);
    if (aliensOn()) { updateAgents(dt); updateOrbs(dt); }
    else if (agents.length || orbs.length) { for (const a of [...agents]) { const c = center(a); burst(c.x, c.y, c.z, 12); removeAgent(a); } for (const o of orbs) scene.remove(o.mesh); orbs = []; }
    updateWeapons(dt, input);
    updateBolts(dt); updateTurret(dt); updateSparks(dt);
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
  const combat = () => aliensOn() && agents.some(a => a.aggro || Math.hypot(a.x - player.x, a.z - player.z) < 60);
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
    enter, exit, update, fire, accept, abandon: () => abandon(false), equip, tapObject, tapTargets, waypoint, sniffTarget, offerNext, rareFor,
    get combat() { return combat(); },
    setAim(nx, ny, has = true) { aim.x = nx; aim.y = ny; aim.has = has; },
    onDiscover() { gain(20, 10); },
    setAliens(on) { P.settings.aliens = !!on; save(); if (quest) onEvent('quest', { kind: 'step', id: quest.def.id, text: stepText() }); },
    setVoice(on) { P.settings.voice = !!on; save(); },
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
        quest: quest ? { id: quest.def.id, title: quest.def.title, step: quest.step, steps: quest.def.steps.length, text: stepText(), fiction: !!quest.def.fiction, timer: quest.def.limit ? Math.max(0, quest.def.limit - (time - quest.t0)) : null } : null,
        boss: bossRef ? { name: bossRef.T.name, hp: Math.max(0, bossRef.hp), max: bossRef.T.hp } : null,
        rares: rareCount(), raresHere: rares.length, kills: P.stats.kills, deaths: P.stats.deaths, badges: P.badges.length,
        zone: zone ? { x: zone.x, z: zone.z, active: zone.active } : null
      };
    },
    // test/debug hooks
    debug: {
      spawn(type, dist = 18, ang = 0, aggro = true) { const st = ctx.st(); const yaw = (st.driving ? st.rover.yaw : player.yaw) + ang; return !!spawnAgent(type, player.x - Math.sin(yaw) * dist, player.z - Math.cos(yaw) * dist, { aggro, src: 'debug' }); },
      hurt(n) { hurt(n, null); },
      clear() { for (const a of [...agents]) removeAgent(a); },
      agents: () => agents.map(a => ({ type: a.type, hp: a.hp, x: a.x, z: a.z, src: a.src, d: Math.hypot(a.x - player.x, a.z - player.z) })),
      target: () => quest?.target || null, step: () => stepDef() || null,
      items: () => quest ? quest.items.map(i => ({ x: i.x, z: i.z, collect: !!i.collect, pick: !!i.pick })) : [],
      rares: () => rares.map(r => ({ x: r.x, z: r.z, id: r.id, type: r.def.type })),
      zone: () => zone && { x: zone.x, z: zone.z, active: zone.active, cool: zone.cool },
      calm(on) { for (const a of agents) a.T = on ? { ...AGENT_TYPES[a.type], speed: 0, cd: 999 } : AGENT_TYPES[a.type]; },
      skipTimer(s) { if (quest) quest.t0 -= s; }
    }
  };
}
