// Mercury: Shadowline Array. A power town just behind the terminator, owned by Calloway Power & Light (fictional).
export default {
  world: 'Mercury',
  colony: {
    name: 'Shadowline Array', a: -75, d: 210, tint: 0xfff0c0,
    domes: [[0, 0, 12, 'SHADOWLINE', 0xffe070], [22, -12, 7, 'GRID', 0x6ae0ff], [-24, 10, 8]],
    blocks: [[32, 14, 8, 4, 4, 'CANTEEN', 0xff2a5a], [-6, 24, 5, 3, 3, 'SUPPLY', 0x3cff8a], [-42, -16, 7, 5, 5, 'ICE HOUSE', 0x9ad8ff],
      [12, -36, 10, 2, 1.2], [-14, -38, 10, 2, 1.2], [38, -30, 8, 2, 1.2]],
    pad: [-40, 12, 9], crates: [[-33, 20], [-50, -2], [40, -6], [10, 31]],
    shop: [-6, 21.5],
    contacts: [
      { name: 'Sunny Calloway', at: [34, 24], blurb: 'Owns the lights. Owns you, if you\u2019re not careful.' },
      { name: 'Dr. Takacs', at: [-30, -28], blurb: 'Rogue grid engineer. Paranoid, brilliant, skimming.' }
    ],
    vehicles: [['sun_skimmer', -14, 32, 0.4], ['sun_skimmer', 46, 4, 2.0], ['hoverbike', 20, 30, -0.3], ['hauler', -52, -28, 1.6]],
    guards: [[0, -22], [22, -24]], colonists: 3, lamps: 10
  },
  vehicles: ['sun_skimmer'],
  cosmetics: { paint: { mirror: { name: 'Mirror Chrome', color: 0xdfe6f0 } } },
  quests: [
    { id: 'mercury-darkgrid', world: 'Mercury', contact: 'Dr. Takacs', title: 'Dark grid', fiction: true,
      intro: 'Takacs: Three junction boxes on the panel field. Jack them and my skim goes live. Pike\u2019s drones sweep every eighty seconds, so move your ass. Don\u2019t tell Calloway. Don\u2019t tell anyone. Don\u2019t even think it loudly.',
      steps: [{ type: 'collect', a: -120, d: 300, spread: 18, n: 3, item: 'artifact', limit: 80, text: 'Jack the junction boxes' }, { type: 'goto', at: [-30, -24], r: 5, text: 'Report back to Takacs' }],
      reward: { xp: 160, credits: 360, unlock: 'paint:mirror' } },
    { id: 'mercury-terminator', world: 'Mercury', contact: 'Sunny Calloway', title: 'Terminator run', fiction: true,
      intro: 'Sunny: Darling, my board likes a show. Race the shadow line, six gates, sixty seconds. Take a skimmer. If dawn catches you, I\u2019ll send flowers. Cheap ones.',
      steps: [{ type: 'take', text: 'Grab a skimmer (or anything fast)' }, { type: 'race', pts: [[60, -50], [140, -40], [190, 30], [140, 110], [50, 100], [0, 40]], limit: 60, text: 'Beat the dawn through every gate' }],
      reward: { xp: 140, credits: 300, badge: 'Dawn Breaker' } },
    { id: 'mercury-icehouse', world: 'Mercury', contact: 'Dr. Takacs', title: 'Ice house', fiction: true,
      intro: 'Takacs: Calloway keeps the polar ice in the Ice House like it\u2019s her fucking jewelry. Steal a core, steal a ride, and get it to my buyer at the scarp. Pike will come. Pike always comes.',
      steps: [{ type: 'goto', at: [-42, -11], r: 3, item: 'icecore', text: 'Steal an ice core from the Ice House' }, { type: 'take', text: 'Steal a ride' },
        { type: 'goto', a: 170, d: 360, r: 14, vehicle: 'stolen', limit: 100, wanted: 3, text: 'Get it to the buyer at the scarp' }, { type: 'clean', text: 'Shake Pike\u2019s people' }],
      reward: { xp: 200, credits: 450, badge: 'Grid Ghost' } }
  ],
  radio: ['Shadowline FM. Stay in the shade, stay alive.', 'Sunrise ETA: always. Run accordingly.', 'Calloway Power and Light: we keep the lights on. Pay your bill.', 'Somebody stole another junction box. Pike says he\u2019ll find you. Pike always finds you.'],
  permit: { quest: 'mars-salvage', from: 'Vesna on Mars' }
};
