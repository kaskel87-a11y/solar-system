// Red Tape Flats street life: bark lines (Snuffles). Registered as street_<cat> through SSX.bark / registerBarks when
// Pumpkin's audio is up; otherwise one line is picked here and shown as a toast. All fiction, all brands made up.
export const LINES = {
  barrel: [
    'Fuckin\u2019 dome heat cut out again. Third time this week.', 'My cousin sold his lungs. Both of \u2019em. Bought a hoverbike.',
    'ColSec don\u2019t come down here after dark. Not even for bodies.', 'Rent went up. For a fuckin\u2019 crate. A CRATE.',
    'They say the air in Helios smells like oranges. Fuck oranges.', 'I ain\u2019t cold. I\u2019m just shaking for fun.',
    'Last guy who slept by the vent woke up cooked. Like, medium-rare.', 'Who keeps throwing boots in the barrel? It smells like feet on fire.',
    'Burn the Meridian ads, they burn green. Pretty.', 'I had a job once. Then I had a better idea. The idea was worse.',
    'Shut up about your ex, Dez. She left you for a vending machine.', 'Pass the bottle or I\u2019m passing out on you.'
  ],
  barrelHello: ['Fuck off, unless you brought a bottle.', 'Warm your hands, helmet. Don\u2019t touch nothing.', 'New face. Got smokes?', 'You lost? Everybody here\u2019s lost.'],
  fight: ['That was MY spot, you sack of shit!', 'Say it again! SAY IT AGAIN!', 'Get off me! Get the fuck off me!', 'He bit me! Motherfucker BIT me!', 'Break it up, break it up! ...Nah, hit him again.'],
  fightOver: ['Stay down, bitch.', 'He\u2019ll live. Probably.', 'Somebody check if he\u2019s breathing. ...Eh, he\u2019s breathing.'],
  mouthOff: ['Oh, you wanna go? You WANNA GO?', 'Big helmet, little balls. Let\u2019s see.', 'Get him!'],
  bottle: ['Red Dust whiskey. Tastes like a brake fire. Cheers.', 'To the dome that never fixed the heat.', 'Drink up. It kills the taste of the air.'],
  rumor: [
    'Wrench\u2019ll chop anything with wheels. Lou at Hook & Crook pays more, asks less, keeps the plates.',
    'Blue Room\u2019s got fresh glow-dust. Don\u2019t buy off the kid with the eye twitch. It\u2019s chalk and battery acid.',
    'Saltblood paint the east walls. Paint over \u2019em and watch your back for a week.',
    'Lou\u2019s tow truck hooks anything parked longer than a cigarette. Don\u2019t leave your rover by the pad.',
    'ColSec cams don\u2019t reach past the shanties. Paint all you want down there.'
  ],
  dealer: ['Psst. Helmet. You holding or buying?', 'Glow, gels, static. Best on the block.', 'Don\u2019t stand there like a cop. Buy or walk.', 'Cash up front. I don\u2019t do tabs, I don\u2019t do feelings.', 'Fresh batch. Only three people died. Kidding. Four.'],
  dealerSold: ['Pleasure doing crimes with you.', 'Don\u2019t take it all at once. Or do. Not my funeral.', 'You didn\u2019t get it from me.'],
  dealerBroke: ['Come back when your wallet grows up.', 'Broke? Then fuck off, broke.'],
  junkie: ['Hey... hey man... you got anything? Anything?', 'I\u2019m not sick, I\u2019m just... between doses.', 'C\u2019mon, one bump. I\u2019ll pay. I\u2019ll pay later. I\u2019ll pay you in love.', 'Spare a credit? For... oxygen. Yeah. Oxygen.'],
  junkieNod: ['Mmmh... the walls are breathing...', '...five more minutes, ma...', 'I can hear Jupiter...'],
  junkieScratch: ['Something\u2019s under my skin. Bugs. Space bugs.', 'Itchy. Itchy itchy itchy.'],
  junkieThanks: ['Oh you beautiful bastard. You beautiful, beautiful bastard.', 'I love you. I don\u2019t know your name. I love you.', 'You\u2019re a saint. A dirty saint.'],
  junkieTip: ['Lou\u2019s got a hot buggy on the back lot, no plates. Tell him Twitch sent you. Don\u2019t tell him Twitch sent you.', 'Somebody stashed cans behind the jersey wall south of the dentist. Fresh paint.'],
  junkieNo: ['Fuck you then. Fuck you and your helmet.', 'Cheap. You\u2019re cheap. I\u2019ll remember.', 'Whatever, man. Whatever.'],
  junkieNarc: ['Heh. Sorry, buddy. Gotta eat.'],
  tagDone: ['Fresh piece. Smells like crime.', 'That\u2019s gonna piss somebody off.'],
  tagCovered: ['Somebody crossed out your piece. Disrespectful.'],
  lou: ['Hook & Crook. We tow it, you owe it.', 'What\u2019re you selling, what\u2019re you buying, and is anybody following you?', 'Plates? Never heard of \u2019em.'],
  louBuy: ['Nice. I\u2019ll have it in six pieces by breakfast.', 'Pleasure. Now get lost before the owner calls.'],
  louStrip: ['Engine\u2019s yours. The rest goes in the crusher.', 'Fifteen minutes. Don\u2019t watch, it\u2019s like surgery.'],
  louTowed: ['Parked like an asshole, got towed like an asshole. Pay up.', 'Your rover\u2019s out back. Fee first. Rules are rules. My rules.'],
  louJumped: ['HEY! That rover\u2019s impounded! I\u2019m calling it in, shithead!'],
  spotted: ['ColSec! Hey, you! Drop the can!', 'Vandal on camera, Flats east. Units respond.']
};
export const pick = a => a[(Math.random() * a.length) | 0];
