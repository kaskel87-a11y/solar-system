// The junkyard lab pack: an original mad-scientist duo on Mars, their lab interior, barks and a 5-mission portal chain.
// Pure data + build(api, K); no imports except scicore (also pure), so node can load it in unit tests.
// Lore: docs/SCIENTISTS.md. All game fiction (M-rated: swearing, crime, violence; no sexual content).
import { LAB_BLOCK, PORTAL_AT, JUNK_AT } from './scicore.js';

export const SILAS = 'Silas';   // Dr. Silas Muckridge
export const TAM = 'Tam';       // Tamsin "Tam" Okafor
export const DUO = {
  [SILAS]: {
    full: 'Dr. Silas Muckridge', role: 'burned-out genius, junkyard rift physicist, functioning alcoholic (barely)',
    look: { skin: 0xd8b090, top: 0xc8c0b0, bottom: 0x4a5a2a, shoes: 0x2a1a10, hair: 0xb8b8b8, hairStyle: 'bald', size: 1.08, bulk: 0.92 },
    voice: 'Slow gravel drawl. Calls everyone "colleague". Treats physics like scripture and sobriety like a rumour.'
  },
  [TAM]: {
    full: 'Tamsin "Tam" Okafor', role: 'sixteen, his very anxious lab assistant, keeps the incident reports',
    look: { skin: 0x6a4630, top: 0x6a3aa0, bottom: 0x50545c, shoes: 0xe8e8e8, hair: 0x141010, hairStyle: 'short', size: 0.9, bulk: 1.12 },
    voice: 'Fast, apologetic, narrates her own panic. Counts things to calm down. Braver than she sounds.'
  }
};
export const BARKS = {
  [SILAS]: [
    "Colleague. I'm between disasters. Come back when I'm sober enough to cause one.",
    "Science is just swearing with numbers.",
    "The multiverse is infinite, and every single version of me is out of ice.",
    "Don't touch the pistol. Don't touch the flask. Honestly, don't touch me.",
    "I invented a door to everywhere and the first thing I did was find a worse bar."
  ],
  [TAM]: [
    "Okay. Okay okay okay. That's fine. That's a normal amount of teeth.",
    "I've started a spreadsheet of things that tried to eat me. It has tabs now.",
    "Sorry! Sorry. I say sorry when I'm scared. I'm saying it a lot today.",
    "He's a genius. A drunk genius. A genius who is drunk. I'm working on the order.",
    "One, two, three, four... I count the rivets when the portal's open. There are 212."
  ]
};

const step = (o) => o;
export function sciMissions() {
  const P = PORTAL_AT, J = JUNK_AT[0];
  return RAW(P, J).map(m => ({ world: 'Mars', fiction: true, ...m, intro: `${m.contact}: ${m.brief}`, success: m.done }));
}
function RAW(P, J) {
  return [
    { id: 'sci-01', title: 'Exact Change', contact: SILAS, kind: 'portal',
      brief: "Silas needs a rift cell out of the scrap heap and exact change from a dimension where vending machines are the customers. Don't ask. He won't explain, he'll just drink.",
      steps: [
        step({ type: 'goto', at: J, item: 'salvage', r: 3, text: 'Dig the rift cell out of the scrap heap behind the lab' }),
        step({ type: 'portal', dim: 'automat', at: P, r: 2, text: 'Step through the portal to the Automat' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Bring the change back to Silas' })
      ], reward: { xp: 150, credits: 220 }, done: '"Exact change. You beautiful idiot. Now I can afford the good paint thinner."' },
    { id: 'sci-02', title: 'Gravity Is a Suggestion', contact: SILAS, kind: 'portal', requires: ['sci-01'],
      brief: 'Silas wants bog orchids from a swamp that hangs from the sky. Something will probably follow you back. Tam has a bat.',
      steps: [
        step({ type: 'portal', dim: 'gravbog', at: P, r: 2, text: 'Portal to the Upside-Down Bog' }),
        step({ type: 'defeat', at: P, wave: ['crawler', 'crawler', 'drone'], text: 'Something followed you out of the bog. Deal with it' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Get the orchids to the lab' })
      ], reward: { xp: 170, credits: 260 }, done: '"Orchids. Smell that? That\'s the smell of a hangover cure I\'ll never finish."' },
    { id: 'sci-03', title: 'Take a Number', contact: TAM, kind: 'portal', requires: ['sci-02'],
      brief: "ColSec says the portal pistol needs a permit. Tam found the office that issues them. It's at the end of time. The queue is long.",
      steps: [
        step({ type: 'portal', dim: 'waitroom', at: P, r: 2, text: 'Portal to the Waiting Room and get Permit 77-B' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Get the permit to Tam before Silas uses it as a coaster' })
      ], reward: { xp: 160, credits: 240 }, done: '"It says PROBABLY FINE. That\'s the nicest thing anyone\'s ever stamped on us."' },
    { id: 'sci-04', title: 'Where\'s My Flask', contact: SILAS, kind: 'portal', requires: ['sci-03'],
      brief: "Silas lost his flask. He's checked the cantina (he hasn't). Then he remembers: the Giant's Pantry. You're about to be two centimetres tall.",
      steps: [
        step({ type: 'enter', building: 'cantina', text: 'Check the cantina for Silas\'s flask (he swears it\'s there)' }),
        step({ type: 'portal', dim: 'pantry', at: P, r: 2, text: "It's not there. Dutch says try the Giant's Pantry. Portal over" }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Return the flask to its rightful alcoholic' })
      ], reward: { xp: 190, credits: 300 }, done: '"My flask. My one true colleague. Tam, write down that I cried. No, don\'t."' },
    { id: 'sci-05', title: 'Last Call at the End of Everything', contact: SILAS, kind: 'portal', requires: ['sci-04'],
      brief: "Silas left his life's work, Unified Hangover Theory, at a bar at the end of the multiverse. ColSec has decided the notes are a weapon. They are not wrong.",
      steps: [
        step({ type: 'portal', dim: 'lounge', at: P, r: 2, text: 'Portal to the Last Bar and grab the notes' }),
        step({ type: 'clean', wanted: 2, getaway: true, text: 'ColSec wants those notes. Lose them' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Get the notes to the lab' })
      ], reward: { xp: 300, credits: 600, badge: 'Interdimensional Delinquent' }, done: '"Unified Hangover Theory. Complete. I\'d celebrate but that\'s how the last one started."' }
  ];
}

// lab interior (registerInterior 'scilab'): junk-built workshop, one point light, ~20 draws + 2 people
export const LAB_INTERIOR = {
  name: 'Muckridge Applied Catastrophics', w: 14, d: 11, h: 5, wall: 0x2a2420, floor: 0x1e1a16, ceil: 0x141210, trim: 0xffa020,
  light: { color: 0xffc080, int: 60 }
};
export function buildLab(api, K, look = DUO) {
  const { THREE } = K, d = api.d;
  // workbench along the north wall with the rift pistol on it, a booze shelf, a tesla coil, a sagging couch, a dead portal frame
  api.box(-2.5, 0.5, -d / 2 + 0.9, 5, 1, 1.2, api.mat(0x4a3a2a)); api.col(-2.5, -d / 2 + 0.9, 2.5, 0.6, 'bench');
  const pistol = new THREE.Group();
  const pb = new THREE.Mesh(K.geo.box, api.mat(0x6a5a40, { metalness: 0.6 })); pb.scale.set(0.5, 0.2, 0.18);
  const pg = new THREE.Mesh(K.geo.sph, K.glow(0xff2fa8)); pg.scale.setScalar(0.13); pg.position.x = 0.3;
  pistol.add(pb, pg); pistol.position.set(-2, 1.15, -d / 2 + 0.9); api.g.add(pistol);
  api.box(4.5, 1.2, -d / 2 + 0.35, 3.6, 0.08, 0.5, api.mat(0x3a2a1a)); api.box(4.5, 2.0, -d / 2 + 0.35, 3.6, 0.08, 0.5, api.mat(0x3a2a1a));
  const bt = []; for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) bt.push([3.0 + i * 0.38, 1.42 + r * 0.8, -d / 2 + 0.35, 0.07, 0.34, 0.07, 0, [0xffb040, 0x9a5a2a, 0xd8d0b0, 0x5a3a20][(i + r) % 4]]);
  K.inst(K.geo.cyl, K.std(0xffffff, { roughness: 0.2 }), bt);
  const coil = new THREE.Mesh(K.geo.cyl, api.mat(0xb87a40, { metalness: 0.8, roughness: 0.3 })); coil.scale.set(0.25, 2.2, 0.25); coil.position.set(5.6, 1.1, 2.6); api.g.add(coil);
  const orb = new THREE.Mesh(K.geo.sph, K.glow(0xffa020)); orb.scale.setScalar(0.4); orb.position.set(5.6, 2.45, 2.6); api.g.add(orb); api.col(5.6, 2.6, 0.4, 0.4, 'coil');
  api.box(-5.4, 0.35, 1.6, 1.6, 0.7, 3.2, api.mat(0x5a3a3a, { roughness: 1 })); api.col(-5.4, 1.6, 0.8, 1.6, 'couch');
  const frame = new THREE.Mesh(K.geo.torus, api.mat(0x6a6a70, { metalness: 0.8 })); frame.scale.setScalar(1.3); frame.position.set(6.9, 1.6, -1.2); frame.rotation.y = Math.PI / 2; api.g.add(frame);
  api.sign('MUCKRIDGE APPLIED CATASTROPHICS', 0xffa020, 0, 3.7, -d / 2 + 0.02, 0, 6);
  api.sign('DAYS SINCE LAST RIFT INCIDENT: 0', 0xff2fa8, -2.5, 2.4, -d / 2 + 0.02, 0, 3.6);
  // Silas: shaved head, grey braided beard, welding goggles up on his forehead, coveralls tied at the waist, flask in hand
  const s = api.person(look[SILAS].look, -1.6, -2.4, Math.PI, (p, t) => {
    p.torso.rotation.z = Math.sin(t * 0.9) * 0.06; p.hips.rotation.y = Math.sin(t * 0.5) * 0.08;
    p.arms[1].rotation.x = -1.2 - Math.max(0, Math.sin(t * 0.6)) * 1.0; p.head.rotation.x = -Math.max(0, Math.sin(t * 0.6)) * 0.35;
  });
  const beard = new THREE.Mesh(K.geo.box, api.mat(0xb8b8b8)); beard.scale.set(0.1, 0.24, 0.08); beard.position.set(0, -0.2, -0.1); s.head.add(beard);
  const gog = new THREE.Mesh(K.geo.box, api.mat(0x2a2a2a)); gog.scale.set(0.27, 0.05, 0.27); gog.position.y = 0.08; s.head.add(gog);
  for (const x of [-0.06, 0.06]) { const l = new THREE.Mesh(K.geo.sph, K.glow(0xffa020)); l.scale.setScalar(0.045); l.position.set(x, 0.09, -0.135); s.head.add(l); }
  const sleeves = new THREE.Mesh(K.geo.box, api.mat(0x4a5a2a)); sleeves.scale.set(0.5, 0.1, 0.3); sleeves.position.set(0, 0.04, 0); s.torso.add(sleeves);
  const flask = new THREE.Mesh(K.geo.box, api.mat(0x9aa4ac, { metalness: 0.9, roughness: 0.25 })); flask.scale.set(0.09, 0.16, 0.04); flask.position.set(0, -0.62, -0.06); s.arms[1].add(flask);
  // Tam: purple puffer vest, big orange ear defenders, curly hair, clipboard. Fidgets.
  const tm = api.person(look[TAM].look, 1.9, -1.6, Math.PI + 0.4, (p, t) => {
    p.head.rotation.y = Math.sin(t * 1.7) * 0.4; p.hips.position.y = p.base + Math.abs(Math.sin(t * 3)) * 0.02; p.arms[0].rotation.x = -0.9 + Math.sin(t * 5) * 0.05;
  });
  const curls = new THREE.Mesh(K.geo.sph, api.mat(0x141010, { roughness: 1 })); curls.scale.set(0.17, 0.14, 0.17); curls.position.y = 0.07; tm.head.add(curls);
  for (const x of [-1, 1]) { const ear = new THREE.Mesh(K.geo.sph, api.mat(0xff7a1a)); ear.scale.set(0.05, 0.08, 0.08); ear.position.x = x * 0.14; tm.head.add(ear); }
  const band = new THREE.Mesh(K.geo.torus, api.mat(0xff7a1a)); band.scale.setScalar(0.15); band.rotation.y = Math.PI / 2; tm.head.add(band);
  const clip = new THREE.Mesh(K.geo.box, api.mat(0xe8e0d0)); clip.scale.set(0.2, 0.02, 0.27); clip.position.set(0, -0.55, -0.15); clip.rotation.x = 0.9; tm.arms[0].add(clip);
  api.spot({ id: 'silas', x: -1.6, z: -1.2, r: 1.6, label: '💬 Silas', act: 'talk', who: SILAS });
  api.spot({ id: 'tam', x: 1.9, z: -0.4, r: 1.5, label: '💬 Tam', act: 'talk', who: TAM });
  api.ticks.push(t => { orb.scale.setScalar(0.36 + Math.abs(Math.sin(t * 13)) * 0.08); pg.scale.setScalar(0.12 + Math.sin(t * 4) * 0.02); });
  return { silas: s, tam: tm };
}
export const LAB = { block: LAB_BLOCK };
