// Io: Loki Forge. A penal forge colony on the most volcanic world in the solar system.
export default {
  world: 'Io',
  // Pure layout data (no meshes): building/prop types are style keys, so the v8 look-dev pass can swap glTF in per type.
  // planets/hooks.js compiles this into the v7.2 COLONIES shape (domes/blocks) until registerColony lands.
  colony: {
    name: 'Loki Forge', site: { a: -130, d: 210 }, palette: { tint: 0xff4a20 },
    buildings: [
      { type: 'hub', at: [0, 0], r: 12, sign: 'LOKI FORGE', neon: 0xff3a2a },
      { type: 'forge', at: [24, 8], r: 8, sign: 'FORGE', neon: 0xff8a2a },
      { type: 'cellblock', at: [-24, -16], size: [12, 7, 6], sign: 'CELLBLOCK', neon: 0xff2a2a },
      { type: 'office', at: [30, -18], size: [7, 5, 5], sign: 'WARDEN', neon: 0xffd040 },
      { type: 'store', at: [-6, 24], size: [5, 3, 3], sign: 'COMMISSARY', neon: 0x3cff8a }
    ],
    props: [{ type: 'guard-tower', at: [-44, 8] }, { type: 'guard-tower', at: [44, 22] }], pad: { at: [-40, -18], r: 9 }, crates: [[-31, 20], [-48, 0], [38, -6], [12, 31], [-8, -26]], lamps: 12,
    shop: [-6, 21.5],
    contacts: [
      { name: 'Cinder', at: [-25, 27], blurb: 'Lifer. Escape artist. Runs the commissary black market.' },
      { name: 'Warden Okafor', at: [36, -27], blurb: 'Sells pardons. Loves a speech.' }
    ],
    vehicles: [['lava_runner', -14, 33, 0.4], ['lava_runner', 20, 33, -0.3], ['hauler', 50, -4, 2.2], ['buggy', -52, -34, 1.6]],
    guards: [[0, -22], [-26, 4], [22, -24]], colonists: 3
  },
  vehicles: ['lava_runner'],
  cosmetics: { paint: { sulfur: { name: 'Sulfur Yellow', color: 0xe8d040 } }, bandana: { convict: { name: 'Convict Orange', color: 0xff7a10 } } },
  quests: [
    { id: 'io-commissary', world: 'Io', contact: 'Cinder', title: 'Commissary run', fiction: true,
      intro: 'Cinder: Crate behind the commissary. Cigarettes, painkillers, a few things that go bang. Get it out past the fence to my drop in the sulfur fields. Guards shoot first and fill out forms never.',
      steps: [{ type: 'goto', at: [-6, 28], r: 3, item: 'contraband', text: 'Grab the crate behind the commissary' }, { type: 'take', text: 'Steal a ride' },
        { type: 'goto', a: 40, d: 320, r: 14, vehicle: 'stolen', limit: 100, wanted: 2, text: 'Get it to the drop in the sulfur fields' }],
      reward: { xp: 170, credits: 380, unlock: 'paint:sulfur' } },
    { id: 'io-breakout', world: 'Io', contact: 'Cinder', title: 'Breakout', fiction: true,
      intro: 'Cinder: Juno\u2019s brother is in Block C. I cut the fence, you grab him, you drive like the whole goddamn Authority is behind you, because it will be. Then you lose them. Nobody\u2019s ever done it. First time for everything.',
      steps: [{ type: 'goto', at: [-24, -11], r: 4, item: 'capsule', text: 'Spring him from the cellblock' }, { type: 'take', text: 'Steal a getaway ride' },
        { type: 'goto', a: 150, d: 400, r: 16, vehicle: 'stolen', limit: 90, wanted: 4, text: 'Get to the lava-tube hideout' }, { type: 'clean', text: 'Lose the penal force' }],
      reward: { xp: 260, credits: 600, badge: 'Jailbreaker', unlock: 'bandana:convict' } },
    { id: 'io-pardon', world: 'Io', contact: 'Warden Okafor', title: 'Pardon money', fiction: true,
      intro: 'Okafor: I have a wager with the night shift. You, a lava runner, six gates round the forge, sixty seconds. Win and I lose your file. Lose and I lose you. In the lava. Metaphorically. Mostly.',
      steps: [{ type: 'take', text: 'Grab a lava runner' }, { type: 'race', pts: [[50, 50], [130, 40], [170, -30], [120, -100], [40, -90], [0, -40]], limit: 60, text: 'Hit every gate' }],
      reward: { xp: 140, credits: 300, badge: 'Pardoned' } }
  ],
  radio: ['Loki Penal Radio. You\u2019re listening because you have no choice.', 'Lights out in the cellblock at twenty-one hundred. Lights out permanently for anyone near the fence.', 'The warden\u2019s quote of the day: lava doesn\u2019t negotiate. Neither do I.', 'Volcano update: yes.'],
  permit: { quest: 'europa-transfer', from: 'Juno Reyes on Europa' }
};
