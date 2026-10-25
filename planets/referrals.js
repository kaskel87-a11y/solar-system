// Referral jobs from the existing contacts: each one vouches for you at a new colony (unlocks its fast-travel permit).
// They append to the contact's chain, so they come after Rook's, Vesna's and Kestrel's existing jobs.
export default [
  { id: 'mars-hotcargo', world: 'Mars', contact: 'Rook', title: 'Hot cargo (Venus referral)', fiction: true,
    intro: 'Rook: Buyer for that crate is a refinery boss on Venus. Dee Varga. You\u2019ll like her, until you don\u2019t. Get the second crate to the outbound pad and she\u2019ll know your name. Security\u2019s already sniffing.',
    steps: [{ type: 'goto', at: [-34, 18], r: 3, item: 'contraband', text: 'Grab the crate on the loading dock' }, { type: 'take', text: 'Steal a ride' },
      { type: 'goto', a: 60, d: 360, r: 14, vehicle: 'stolen', limit: 110, wanted: 2, text: 'Reach the outbound pad' }],
    reward: { xp: 160, credits: 300, badge: 'Venus Permit' } },
  { id: 'mars-salvage', world: 'Mars', contact: 'Vesna', title: 'Salvage rights (Mercury referral)', fiction: true,
    intro: 'Vesna: My ledger says a woman named Calloway buys scrapped panels on Mercury and doesn\u2019t ask where they came from. Collect three panel wrecks out west and I\u2019ll put your name on the manifest.',
    steps: [{ type: 'collect', a: -100, d: 260, spread: 18, n: 3, item: 'cargo', text: 'Collect the panel wrecks' }, { type: 'goto', at: [8, 24], r: 6, text: 'Bring them to Vesna' }],
    reward: { xp: 140, credits: 260, badge: 'Mercury Permit' } },
  { id: 'moon-invitational', world: 'Moon', contact: 'Kestrel', title: 'Invitational (Titan referral)', fiction: true,
    intro: 'Kestrel: My circuit has a Titan leg. Smugglers run it, my cousin Lark wins it. Qualify here, five gates in fifty-five, and you\u2019re in.',
    steps: [{ type: 'take', text: 'Grab a fast vehicle' }, { type: 'race', pts: [[-50, 40], [-120, 20], [-140, -50], [-70, -100], [0, -40]], limit: 55, text: 'Qualify: hit every gate' }],
    reward: { xp: 140, credits: 260, badge: 'Titan Permit' } }
];
