// Junkyard lab pack, part 2: sci-06..10. Darker, weirder jobs for Silas & Tam, the Raccoon Mobile's rift drive and the
// finale. Pure data; no imports except pure modules, so node can load it in unit tests. Lore: docs/SCIENTISTS.md.
// All original game fiction (M-rated: swearing, dread, violence; no sexual content, no real brands).
import { PORTAL_AT, JUNK_AT } from './scicore.js';
import { SILAS, TAM } from './scientists.js';

// Ares Junction-relative spots for the Raccoon Mobile legs (x east, z south), clear of the beltway and AJ blocks
export const LAB_YARD = [44, -24];     // out front of the lab, between the door and the portal
export const DUST_CEMETERY = [20, 40]; // the colony's unofficial boneyard, north of the hab ring
export const BACK_LOT = [-48, 30];     // the dead lot past the landing pad where nobody asks what's in the trunk
export const RIFT_SPOTS = { LAB_YARD, DUST_CEMETERY, BACK_LOT };

// new characters (all original): they only exist on the far side of the portal
export const CAST = {
  ossery: { name: 'Mother Ossery', where: 'orchard', blurb: 'Keeps an orchard that grows teeth. Prunes trespassers. Hums lullabies about gums.' },
  lineman: { name: 'The Lineman', where: 'hum', blurb: 'Faceless operator of a switchboard where every unanswered call ends up. Still on shift.' },
  lien: { name: 'Mr. Lien', where: 'pawn', blurb: 'Pawnbroker. Buys organs, memories and years. Smiles with somebody else\u2019s teeth.' },
  understudy: { name: 'The Understudy', where: 'rehearsal', blurb: 'A waxen Silas who has rehearsed being Silas for 30 years. Nearly word-perfect.' },
  quiet: { name: 'The Hungry Quiet', where: 'gut', blurb: 'What lives in the gap between dimensions. Not evil. Just very, very hungry.' }
};

// SSX.bark categories (registered via SSX.registerBarks; each stays under ~65 chars for iPhone portrait)
export const BARKS2 = {
  sci_silas_idle: ["Colleague. The portal hums in its sleep now. That's new. That's bad.",
    "I've seen the end of everything. The bar was fine. The service, not so much.",
    "Every version of me drinks. One of me quit. Nobody talks to him.",
    "Science is a knife, colleague. I just keep grabbing the wrong end."],
  sci_tam_idle: ["The portal blinked at me. Portals don't have eyelids. I checked.",
    "I added a tab to the spreadsheet: 'Things That Knew My Name.'",
    "Two hundred and twelve rivets. Two hundred and thirteen? No. No no no.",
    "If Silas starts calling you 'colleague' twice in one sentence, run."],
  sci_tam_warn: ["It doesn't take cars! Get out and walk in. Please. Sorry.",
    "Not without the carburettor! The car needs the carburettor!"],
  sci_tam_drive: ["Raccoon Mobile, go! Go go go! Sorry, I'm loud when I'm scared.",
    "Don't brake for the shadows. They like it when you brake."],
  sci_silas_drive: ["Floor it, colleague. The teeth won't keep and neither will I.",
    "Mind the upholstery. I've bled on it enough for both of us."],
  sci_ossery_dim: ['"Hush now, little gums. Mother\'s pruning."', '"Pick my molars and I\'ll pick yours, sweetling."'],
  sci_lineman_dim: ['"Please hold. Your silence is important to us."', '"All lines are dead. So are most callers."'],
  sci_lien_dim: ['"Ticket? Interest compounds per heartbeat, friend."', '"Lovely kidneys. Shame about the man around them."'],
  sci_understudy_dim: ['"Colleague. Colleague. Collea... no. Again. From the top."', '"I know his lines. I know his face. Give me yours."'],
  sci_hungry_quiet_dim: ['(The silence leans closer. It is breathing through your ears.)', '(Something very large opens its mouth, very slowly.)']
};
// dimension id -> the host who greets you on the way in (category above)
export const DIM_HOSTS = { orchard: 'Mother Ossery', hum: 'The Lineman', pawn: 'Mr. Lien', rehearsal: 'The Understudy', gut: 'The Hungry Quiet' };
export const barkCat = (who, kind) => 'sci_' + String(who).toLowerCase().replace(/^(mother|mr\.?|the)\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + kind;

const step = o => o;
export function sci2Missions() {
  const P = PORTAL_AT;
  return RAW(P).map(m => ({ world: 'Mars', fiction: true, ...m, intro: `${m.contact}: ${m.brief}`, success: m.done }));
}
function RAW(P) {
  return [
    { id: 'sci-06', title: 'Root Canal', contact: SILAS, kind: 'portal', requires: ['sci-05'],
      brief: "Silas needs enamel to grind a new rift lens. There's an orchard where molars grow on trees. The woman who tends it doesn't like pickers. Bring the Raccoon Mobile.",
      steps: [
        step({ type: 'rdrive', at: LAB_YARD, r: 6, text: 'Bring the Raccoon Mobile to the lab yard' }),
        step({ type: 'portal', dim: 'orchard', at: P, r: 2, text: 'Portal to the Tooth Orchard and pick 4 molars' }),
        step({ type: 'rdrive', at: DUST_CEMETERY, r: 6, limit: 150, text: "The molars are whispering. Get them to the dust cemetery in the Raccoon Mobile before they start biting" }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Tell Silas the teeth are buried. Mostly' })
      ], reward: { xp: 320, credits: 650 }, done: '"Enamel lens, ground and polished. It only screams when you look through it. Progress."' },
    { id: 'sci-07', title: 'Dead Air', contact: TAM, kind: 'portal', requires: ['sci-06'],
      brief: "Tam wants a recording of her own voice. From the timeline where she never came to Mars. It's on a switchboard where every unanswered call ends up. Pick up in order: 1, 2, 3.",
      steps: [
        step({ type: 'portal', dim: 'hum', at: P, r: 2, text: 'Portal to the Hum and answer lines 1, 2, 3 in order' }),
        step({ type: 'defeat', at: P, wave: ['crawler', 'drone', 'crawler'], text: 'Something crawled down the line after you. Hang up on it' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Bring Tam the tape' })
      ], reward: { xp: 340, credits: 700 }, done: '"She sounds... happy. She sounds like she sleeps. I\'m going to stop listening now. Thank you. Sorry."' },
    { id: 'sci-08', title: 'Collateral', contact: SILAS, kind: 'portal', requires: ['sci-07'],
      brief: "Twenty years ago Silas pawned his liver. The good one. The ticket expires tonight and Mr. Lien collects with interest. Get the ticket, the jar and the receipt, in that order.",
      steps: [
        step({ type: 'portal', dim: 'pawn', at: P, r: 2, text: 'Portal to Lien & Sons Organ Pawn: ticket, jar, receipt' }),
        step({ type: 'clean', wanted: 2, getaway: true, text: "Lien's repo men tipped ColSec. Lose the heat" }),
        step({ type: 'rdrive', at: BACK_LOT, r: 6, text: 'Stash the jar at the back lot in the Raccoon Mobile. Nobody checks a trunk there' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Tell Silas his liver is safe. Safer than in him' })
      ], reward: { xp: 380, credits: 800 }, done: '"My liver. Floating there like a little brown moon. I\'ll visit. I won\'t drink in front of it."' },
    { id: 'sci-09', title: 'The Understudy', contact: TAM, kind: 'portal', requires: ['sci-08'],
      brief: "Something in the lab is wearing Silas's coveralls and saying his lines almost right. The real Silas is stuck in a theatre where it rehearsed him. Tam built a rift carburettor for the Raccoon Mobile.",
      steps: [
        step({ type: 'goto', at: JUNK_AT[1], item: 'salvage', r: 3, text: "Pull Tam's rift carburettor out of the wreck pile" }),
        step({ type: 'rdrive', at: LAB_YARD, r: 6, text: 'Get in the Raccoon Mobile. Tam bolts the carburettor on in the lab yard' }),
        step({ type: 'portal', dim: 'rehearsal', at: P, r: 2, raccoon: 'only', text: 'Drive the Raccoon Mobile straight into the portal. Find 3 script pages' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Get the real Silas home. Check his teeth' })
      ], reward: { xp: 420, credits: 900 }, done: '"The real me. I can tell because I\'m disappointed. The copy was sober. That should\'ve been the tell."' },
    { id: 'sci-10', title: 'Closing Time', contact: SILAS, kind: 'portal', requires: ['sci-09'], finale: true,
      brief: "The portals are bleeding into Mars. Every rift Silas ever opened leads back to the Gut, the space between everywhere. Drive in, nail down 4 anchors before it collapses, and shut the door.",
      steps: [
        step({ type: 'rdrive', at: JUNK_AT[2], r: 6, text: 'Load the last rift cell into the Raccoon Mobile at the north scrap heap' }),
        step({ type: 'portal', dim: 'gut', at: P, r: 2, raccoon: 'only', text: 'Drive into the Gut. Nail 4 anchors before it closes on you' }),
        step({ type: 'defeat', at: P, wave: ['crawler', 'crawler', 'drone', 'drone'], text: 'The Gut is spitting things out on its way shut. Put them down' }),
        step({ type: 'clean', wanted: 3, getaway: true, text: 'ColSec wants whoever opened a hole in Mars. Lose 3 stars' }),
        step({ type: 'enter', building: 'junkyard lab', text: 'Last call. Get back to the lab' })
      ], reward: { xp: 650, credits: 1500, badge: 'Closed the Door Behind Me' },
      done: '"It\'s shut. All of it. For the first time in thirty years nothing is listening to me. Pour two. No, colleague. Pour you one."' }
  ];
}
