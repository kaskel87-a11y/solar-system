// Venus: Sulfur Gate Refinery. A refrigerated refinery town on a lava plain; Gate Local 9 runs the coolant racket.
export default {
  world: 'Venus',
  colony: {
    name: 'Sulfur Gate', a: 65, d: 210, tint: 0xffa030,
    domes: [[0, 0, 13, 'SULFUR GATE', 0xffb020], [-24, -14, 8, 'BOILER', 0xff5020], [24, 8, 8]],
    blocks: [[30, -18, 8, 5, 5, 'CHAPEL', 0x9aff3a], [-6, 24, 5, 3, 3, 'SUPPLY', 0x3cff8a], [-44, -12, 7, 4, 5, 'COOLANT', 0x6ad0ff], [42, 14, 4, 8, 7]],
    pad: [-38, 12, 9], crates: [[-31, 18], [-48, -2], [36, -8], [12, 31], [-10, -26]],
    shop: [-6, 21.5],
    contacts: [
      { name: 'Dee Varga', at: [36, -27], blurb: 'Gate Local 9 shop steward. Runs the coolant racket.' },
      { name: 'Brother Ash', at: [22, -24], blurb: 'Ex-geologist. Preaches heat death in the chapel.' },
      { name: 'Skids', at: [-25, 28], blurb: 'Crawler jockey. Burned hands, no fear.' }
    ],
    vehicles: [['acid_crawler', -14, 32, 0.4], ['acid_crawler', -52, -24, 1.6], ['buggy', 20, 30, -0.3], ['hauler', 46, -2, 2.2]],
    guards: [[0, -22], [-26, 4]], colonists: 4, lamps: 10
  },
  vehicles: ['acid_crawler'],
  cosmetics: { paint: { acid: { name: 'Acid Green', color: 0x8acc2a } } },
  quests: [
    { id: 'venus-coolant', world: 'Venus', contact: 'Dee Varga', title: 'Coolant run', fiction: true,
      intro: 'Dee: Coolant is life down here, sweetheart. Swipe a canister from the depot, jack a crawler, and get it to my friends on B-shift before company security works out where it went. Ninety seconds. Don\u2019t fucking dawdle.',
      steps: [{ type: 'goto', at: [-44, -7], r: 3, item: 'cargo', text: 'Swipe the coolant canister at the depot' }, { type: 'take', text: 'Jack a ride (a crawler takes hits)' },
        { type: 'goto', a: 140, d: 330, r: 14, vehicle: 'stolen', limit: 90, wanted: 2, text: 'Deliver to B-shift before it boils off' }],
      reward: { xp: 160, credits: 380, badge: 'Local 9', unlock: 'paint:acid' } },
    { id: 'venus-valves', world: 'Venus', contact: 'Dee Varga', title: 'Valve job', fiction: true,
      intro: 'Dee: The company\u2019s scab pipeline runs out past the lava. Three pressure valves. Open them all and let the bastards cook. Seventy seconds before their sensors flag it.',
      steps: [{ type: 'collect', a: 10, d: 330, spread: 18, n: 3, item: 'artifact', limit: 70, wanted: 1, text: 'Crack the pressure valves' }, { type: 'clean', text: 'Lose the company cops' }],
      reward: { xp: 180, credits: 420 } },
    { id: 'venus-pipe', world: 'Venus', contact: 'Brother Ash', title: 'Things that eat pipe', fiction: true,
      intro: 'Brother Ash: The haze is hungry, friend. Something out there is chewing through the pipeline and the crews that go to fix it. Go and bless them with a rifle.',
      steps: [{ type: 'goto', a: 100, d: 340, r: 14, text: 'Follow the chewed pipe into the haze' }, { type: 'defeat', a: 100, d: 340, wave: ['crawler', 'crawler', 'hunter', 'drone'], ambush: true, text: 'Put down whatever\u2019s eating it' }],
      reward: { xp: 170, credits: 300, badge: 'Haze Walker' } },
    { id: 'venus-drag', world: 'Venus', contact: 'Skids', title: 'Gate 9 drag', fiction: true,
      intro: 'Skids: Lava-field drag, five gates, sixty-five seconds. Crawlers are slow but they don\u2019t flip. Buggies flip. Your funeral, man.',
      steps: [{ type: 'take', text: 'Grab a ride' }, { type: 'race', pts: [[-30, 60], [-110, 80], [-160, 20], [-110, -60], [-20, -50]], limit: 65, text: 'Hit every gate' }],
      reward: { xp: 130, credits: 260 } }
  ],
  radio: ['Gate Radio. It\u2019s 465 degrees and somehow the coffee\u2019s still cold.', 'Shift change in ten. Still on the surface after that? You\u2019re overtime or you\u2019re dead.', 'Local 9 reminds you: scabs float. Acid\u2019s hungry.', 'Weather: orange. Tomorrow: orange. The day after: you guessed it.'],
  permit: { quest: 'mars-hotcargo', from: 'Rook on Mars' }
};
