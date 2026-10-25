// Europa: Conamara Station. Halvorsen Ice & Water Co. (fictional) company town over a hidden ocean.
export default {
  world: 'Europa',
  // Pure layout data (no meshes): building/prop types are style keys, so the v8 look-dev pass can swap glTF in per type.
  // planets/hooks.js compiles this into the v7.2 COLONIES shape (domes/blocks) until registerColony lands.
  colony: {
    name: 'Conamara Station', site: { a: -25, d: 210 }, palette: { tint: 0x8ad8ff },
    buildings: [
      { type: 'hub', at: [0, 0], r: 13, sign: 'HALVORSEN', neon: 0x6ad0ff },
      { type: 'infirmary', at: [-22, -16], r: 8, sign: 'INFIRMARY', neon: 0xff4a5a },
      { type: 'drill-rig', at: [24, 8], r: 8, sign: 'DRILL 4', neon: 0xffd040 },
      { type: 'store', at: [30, -18], size: [9, 5, 5], sign: 'COMPANY STORE', neon: 0x6ad0ff },
      { type: 'supply', at: [-6, 24], size: [5, 3, 3], sign: 'SUPPLY', neon: 0x3cff8a },
      { type: 'bunks', at: [-44, -14], size: [6, 4, 5], sign: 'BUNKS', neon: 0xc0c8ff }
    ],
    props: [{ type: 'drill-derrick', at: [42, 20] }], pad: { at: [-38, 12], r: 9 }, crates: [[-31, 18], [-33, 23], [-48, -4], [36, -8], [12, 31]], lamps: 12,
    shop: [-6, 21.5],
    contacts: [
      { name: 'Foreman Brask', at: [36, -27], blurb: 'Company man. Fines you for breathing loud.' },
      { name: 'Juno Reyes', at: [-26, 28], blurb: 'Drift union organizer. Water smuggler.' },
      { name: 'Old Henrik', at: [12, 28], blurb: 'Retired driller. Says the ice sings.' }
    ],
    vehicles: [['crevasse_sled', -14, 33, 0.4], ['crevasse_sled', 46, 2, 2.0], ['hoverbike', 20, 34, -0.3], ['buggy', -52, -26, 1.6]],
    guards: [[0, -22], [-26, 4], [22, -22]], colonists: 4
  },
  vehicles: ['crevasse_sled'],
  cosmetics: { paint: { glacier: { name: 'Glacier White', color: 0xe8eef4 } } },
  quests: [
    { id: 'europa-store', world: 'Europa', contact: 'Juno Reyes', title: 'Company store', fiction: true,
      intro: 'Juno: Halvorsen is cooking the ration books, and the manifest proves it. It\u2019s in the company store. Grab it, get it to my people at the old drill site, then lose Brask\u2019s goons. They don\u2019t arrest, they disappear you.',
      steps: [{ type: 'goto', at: [30, -13], r: 3, item: 'camera', text: 'Lift the manifest from the company store' }, { type: 'take', text: 'Steal a ride' },
        { type: 'goto', a: 120, d: 320, r: 14, vehicle: 'stolen', limit: 100, wanted: 2, text: 'Get it to the old drill site' }, { type: 'clean', text: 'Lose the company security' }],
      reward: { xp: 180, credits: 380, badge: 'Drift', unlock: 'paint:glacier' } },
    { id: 'europa-cores', world: 'Europa', contact: 'Old Henrik', title: 'Core sample', fiction: true,
      intro: 'Henrik: Three cores from the cracks out east, before Brask\u2019s boys get there and bury them. The ice is singing, I\u2019m telling you. Something down there is listening.',
      steps: [{ type: 'collect', a: 60, d: 280, spread: 18, n: 3, item: 'icecore', limit: 120, text: 'Scan the ocean-ice cores' }, { type: 'defeat', a: 60, d: 280, wave: ['crawler', 'crawler', 'drone'], text: 'Whatever was listening: kill it' }],
      reward: { xp: 170, credits: 320, badge: 'Ice Singer' }, fact: 'Real science: Europa\u2019s ocean is thought to touch a rocky seafloor, where hydrothermal vents could supply energy and chemistry, one reason it\u2019s a top target in the search for life.' },
    { id: 'europa-iceroad', world: 'Europa', contact: 'Foreman Brask', title: 'Ice road', fiction: true,
      intro: 'Brask: Team-building exercise. Six gates down the ice road, seventy seconds. Winners get a bonus. Losers get a fine. Everybody gets a fine, actually.',
      steps: [{ type: 'take', text: 'Grab a sled (or anything with grip)' }, { type: 'race', pts: [[-50, -60], [-130, -50], [-170, 20], [-120, 90], [-40, 80], [0, 40]], limit: 70, text: 'Hit every gate' }],
      reward: { xp: 130, credits: 260 } },
    { id: 'europa-transfer', world: 'Europa', contact: 'Juno Reyes', title: 'Transfer papers', fiction: true,
      intro: 'Juno: They shipped my brother to the Loki Forge on Io. I forged you a visitor transfer. Pick it up from the infirmary and get to the outbound pad. Then go get him out.',
      steps: [{ type: 'goto', at: [-22, -6], r: 3, item: 'capsule', text: 'Pick up the transfer at the infirmary' }, { type: 'goto', a: -100, d: 300, r: 14, limit: 90, wanted: 1, text: 'Reach the outbound pad' }],
      reward: { xp: 160, credits: 300, badge: 'Visitor' } }
  ],
  radio: ['Halvorsen Radio: hydration is a privilege.', 'The company reminds you that union talk is a fineable offense. This message is also fineable.', 'Jupiter is up. Jupiter is always up. Stop looking at it.', 'Henrik says the ice is singing again. Henrik is off his meds.'],
  permit: { quest: 'titan-wetwork', from: 'Mags on Titan' }
};
