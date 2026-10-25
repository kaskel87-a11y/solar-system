// Titan: Kraken Landing. Outlaw free port on the Kraken Mare shore; hydrocarbon bootleggers and smugglers.
export default {
  world: 'Titan',
  colony: {
    name: 'Kraken Landing', a: -95, d: 210, tint: 0xff7a3a,
    domes: [[0, 0, 12, 'FREE PORT', 0x7aff5a], [-22, -16, 8, 'TANK FARM', 0xff3ad0], [22, 10, 7]],
    blocks: [[30, -18, 8, 5, 6, 'CHANDLERY', 0xff3ad0], [-6, 24, 5, 3, 3, 'SUPPLY', 0x3cff8a], [-44, -14, 6, 4, 5, 'NO QUESTIONS', 0xffd040], [40, 18, 5, 5, 8]],
    pad: [-38, 12, 9], crates: [[-31, 18], [-33, 23], [-29, 23], [-48, -4], [38, -8], [12, 31], [-8, -26], [44, 6]],
    shop: [-6, 21.5],
    contacts: [
      { name: 'Mags', at: [36, -27], blurb: 'Queen of the free port. Everybody\u2019s welcome. Leaving is extra.' },
      { name: 'Saint Teodor', at: [-24, 28], blurb: 'Bootleg fuel distiller. Pays cash, mostly.' },
      { name: 'Lark', at: [10, 28], blurb: 'Racer. Kestrel\u2019s cousin. Insufferable.' }
    ],
    vehicles: [['methane_skiff', -14, 33, 0.4], ['methane_skiff', 20, 32, -0.3], ['hoverbike', 46, -6, 2.4], ['hauler', -52, -26, 1.6], ['shuttle', -38, 12, 0.9]],
    guards: [[0, -22], [24, -22]], colonists: 4, lamps: 10
  },
  vehicles: ['methane_skiff'],
  cosmetics: { paint: { kraken: { name: 'Kraken Rust', color: 0x8a4a22 } } },
  quests: [
    { id: 'titan-shore', world: 'Titan', contact: 'Lark', title: 'Shore sprint', fiction: true,
      intro: 'Lark: Tank-farm loop, six gates, sixty-five seconds. Kestrel says you\u2019re fast. Kestrel says a lot of shit. Take a skiff and prove it.',
      steps: [{ type: 'take', text: 'Grab a skiff (or anything fast)' }, { type: 'race', pts: [[50, -50], [120, -60], [160, 10], [120, 80], [40, 90], [0, 40]], limit: 65, text: 'Hit every gate' }],
      reward: { xp: 130, credits: 280, unlock: 'paint:kraken' } },
    { id: 'titan-ethane', world: 'Titan', contact: 'Saint Teodor', title: 'Spiked fuel', fiction: true,
      intro: 'Teodor: One drum of my finest ethane, extra spicy. Rig out in the dunes paid up front. The port militia didn\u2019t get their cut, so they\u2019ll be on you. Don\u2019t crash. Seriously. It\u2019ll take the whole block with it.',
      steps: [{ type: 'goto', at: [-44, -9], r: 3, item: 'cargo', text: 'Grab the drum behind NO QUESTIONS' }, { type: 'take', text: 'Steal a ride' },
        { type: 'goto', a: 160, d: 300, r: 14, vehicle: 'stolen', limit: 110, wanted: 2, text: 'Deliver to the dune rig' }],
      reward: { xp: 170, credits: 400, badge: 'Bootlegger' } },
    { id: 'mags-haze-sharks', world: 'Titan', contact: 'Mags', title: 'Haze sharks', fiction: true,
      intro: 'Mags: Something in the fog is opening my tanker crews like ration packs. Find the nest and burn it. I\u2019ll pay double if you bring me one of the heads. I won\u2019t say why.',
      steps: [{ type: 'goto', a: -40, d: 330, r: 16, text: 'Track the hunters into the fog' }, { type: 'defeat', a: -40, d: 330, wave: ['nest', 'hunter', 'hunter', 'drone'], ambush: true, text: 'Burn the nest' }],
      reward: { xp: 200, credits: 420 } },
    { id: 'titan-wetwork', world: 'Titan', contact: 'Mags', title: 'Wet work', fiction: true,
      intro: 'Mags: I need a man inside the Halvorsen ice mine on Europa. My forger is in the chandlery. Grab the papers and get to the outbound pad before the militia stamps you. Then you\u2019re on Europa, working for me.',
      steps: [{ type: 'goto', at: [30, -13], r: 3, item: 'camera', text: 'Pick up the forged papers at the chandlery' }, { type: 'goto', a: 30, d: 300, r: 14, limit: 90, wanted: 2, text: 'Reach the outbound pad' }, { type: 'clean', text: 'Lose the militia' }],
      reward: { xp: 190, credits: 350, badge: 'Inside Man' } }
  ],
  radio: ['Kraken Free Radio. No license, no rules, no refunds.', 'Methane drizzle this afternoon. Bring a hat. A heated one.', 'Mags says play nice. That\u2019s the only rule. It\u2019s a big rule.', 'Lost and found: one tanker, one crew, one sense of humor.'],
  permit: { quest: 'moon-invitational', from: 'Kestrel on the Moon' }
};
