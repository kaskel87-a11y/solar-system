// Grime pass: crude street chatter (bark line packs) + PIRATE 66.6, a pirate radio station. Data only.
// Added through Pumpkin's audio API (SSX.registerBarks / SSX.bark / SSX.registerStation); no second bark or radio system.
// Mature rating: profanity, crime and gore are in; nothing sexual, no slurs, no real brands. Lines stay <= 65 chars.

// more lines for the categories barks.js already picks by itself (district chatter, reactions)
export const BARK_PACKS = {
  flats: ['Rent\u2019s due, rats are fat, and my O2 tank is a fucking liar.', 'Saltblood took my shoes. Who steals shoes? On MARS?',
    'Don\u2019t drink from the tower. Somebody died in it. Twice.', 'I sold a kidney to Halvorsen. He sold it back. Used.',
    'You lost, or just shopping for a stab wound?', 'This street smells like piss and reactor coolant. Home.',
    'Marrow\u2019s boys cut Tick open over six credits. Six.', 'Keep walking, helmet. Nothing here you can afford.',
    'My filter\u2019s been black for a week. I taste everything now.', 'ColSec only comes down here to dump bodies.',
    'Shit, is that blood or rust? Never mind. Don\u2019t care.', 'Got a cough that sounds like a hauler. Pretty sure it\u2019s fine.'],
  downtown: ['Meridian laid off my whole shift by drone. Fucking drone.', 'Ten credits for a coffee. The cup was empty. ART, they said.',
    'Step over the guy, darling. He\u2019s not going anywhere.', 'Bank tower\u2019s got better air than the hospital. Priorities.',
    'Another jumper off the Trust roof. Bad quarter.', 'They power-wash the blood off by six. Very efficient.',
    'I bill four hundred an hour and I still rent a pod.', 'ColSec cleared the plaza again. Cleared means bulldozed.'],
  heights: ['Ugh, someone from the Flats touched the gate. Sanitize it.', 'Our butler stole the silver. We had him spaced. Tragic.',
    'Darling, the poor have a smell. It\u2019s called the Flats.', 'Private security shot a delivery kid. Paperwork was hell.',
    'The fence is electric for a reason, sweetie. Move along.'],
  street: ['Dust storm took the roof off the clinic. Again. Fuck Mars.', 'Somebody keyed DIE in my rover. Fair, honestly.',
    'My landlord charges for gravity. Says it\u2019s a utility.', 'Saw a guy eat a battery. Glowed for an hour. Legend.',
    'If you hear screaming, it\u2019s Tuesday. Keep moving.', 'Spit Valve\u2019s on pirate radio again. ColSec hates it.'],
  bump: ['Watch it, you clumsy shit!', 'Back the fuck up, spacer.', 'Touch me again, I\u2019ll sell your teeth.', 'Christ, walk much?'],
  hit: ['You broke my fucking nose!', 'Oh, you\u2019re DEAD, asshole!', 'That\u2019s it. I\u2019m getting my shiv.', 'Son of a\u2014 my teeth!'],
  gun: ['Fuck! Gun! GUN!', 'Not in my face, you psycho!', 'Shit, shit, shit, get down!', 'Okay! Okay! Don\u2019t shoot, Jesus!'],
  stolen: ['That\u2019s my rover, you thieving bastard!', 'Come back here, you piece of shit!', 'I still owe Gus on that, asshole!'],
  speeding: ['Slow the fuck down!', 'Drive like that, die like that, dickhead!', 'You almost turned me into paste!'],
  wanted: ['There\u2019s the psycho from the screens!', 'Fuck that, I\u2019m not dying for ColSec. Run!']
};

// new categories for the street-encounter system (mars/grime-street.js) and ambient grime NPCs
export const STREET_BARKS = {
  grime_panhandle: ['Spare a credit, chief? Just one. For air.', 'Hey. Hey! Five credits and I\u2019ll stop following you.',
    'Come on, man, I haven\u2019t breathed clean since Tuesday.', 'You got a nice helmet. Spare change for a guy without one?',
    'God bless. Or don\u2019t. Just give me a fucking credit.', 'I\u2019m not a junkie, I\u2019m between jobs. Five credits?',
    'Don\u2019t look away, I can see you looking away.'],
  grime_hustle: ['O2 cartridges! Ninety-percent oxygen, ten-percent mystery!', 'Psst. Genuine Meridian ID. Barely dead guy\u2019s.',
    'Glow-dust? No? Cheap filters? Stolen? Absolutely.', 'Rover parts, still warm. Don\u2019t ask whose.', 'Knockoff Lungful, tastes like real air. Mostly.',
    'Need a gun with no history? It\u2019s got a LITTLE history.'],
  grime_yell: ['THE DOMES ARE LISTENING! THEY\u2019RE ALWAYS FUCKING LISTENING!', 'Meridian put a chip in my teeth! I pulled \u2019em ALL!',
    'The sky is a lie! It\u2019s PAINT! I\u2019ve TOUCHED it!', 'Earth is a myth sold by the air companies! WAKE UP!',
    'Who stole my FUCKING shoe? WHO?', 'I can hear the reactor singing. It hates you specifically.'],
  grime_shove: ['The fuck you looking at?', 'You bump me? You BUMP me, helmet?', 'Back up or I\u2019ll back you up, asshole.',
    'Nice suit. Shame if it got holes in it.', 'Get out of my fucking light.'],
  grime_pickpocket: ['Sorry, sorry, my bad, tripped.', 'Excuse me, friend. Lovely day.', 'Whoops. Didn\u2019t see you there.'],
  grime_lifted: ['Thanks for the donation, dumbass!', 'Too slow, helmet!', 'Pleasure doing business!'],
  grime_mugger: ['Wallet. Now. Or I open you up.', 'Easy. Credits on the ground and nobody bleeds.', 'This is a stick-up, you rich fuck.',
    'Make a sound and I\u2019ll pop your seals. Pay up.'],
  grime_paid: ['Pleasure. Now fuck off.', 'Smart. Real smart.', 'See? Nobody had to leak.', 'God bless your stupid face.'],
  grime_refused: ['Yeah? Fuck you too, then.', 'Cheap bastard. Hope your filter clogs.', 'I\u2019ll remember that face.',
    'Fine. Choke on it.', 'Asshole. Pure gold-plated asshole.'],
  grime_fight: ['Oh, you wanna dance? Let\u2019s fucking dance!', 'Big mistake, helmet!', 'I\u2019m gonna wear your face!'],
  grime_run: ['Run, rabbit! Run!', 'Yeah, keep running, coward!', 'Next time I gut you!'],
  grime_shoved: ['Ow! Okay! Okay! Psycho!', 'Fuck! Fine! I\u2019m going!', 'You\u2019ll get yours, asshole.'],
  grime_sleeper: ['Mmph. Fuck off. Sleeping.', 'Touch my bag and lose the hand.', '...five more minutes, Ma...', 'Got no credits. Got lice. Want some?']
};

// PIRATE 66.6: Spit Valve's illegal station, broadcast off a stolen relay. Procedural music only (synth.js through radio.js).
export const PIRATE_STATION = {
  id: 'pirate', name: 'PIRATE 66.6', tag: 'Illegal Relay \u00b7 Sludge & Rage', bpm: 96, mars: 'flats', talk: true,
  dj: ['PIRATE 66.6. Stolen signal, stolen music, stolen everything.', 'Spit Valve here. ColSec can choke on my exhaust.'],
  segs: [
    'Spit: This is PIRATE 66.6. If ColSec finds this relay, I\u2019m dead. Hi.', 'Spit: Meridian took my lungs. I took their antenna. We\u2019re even.',
    'Spit: Shout-out to whoever torched the precinct van. Art.', 'Spit: Water tower\u2019s poisoned again. Boil it. Pray. Drink beer.',
    'Spit: Rusk, I know you listen. Your mom does too. She calls in.', 'Spit: Weather: shit. Traffic: shit. Life: shit. Here\u2019s a song.',
    'Ad: Doc Kettle\u2019s Back-Alley Clinic. Stitches, no questions.', 'Ad: Gus\u2019s Rovers. If it\u2019s hot, it\u2019s cheaper.',
    'Ad: Ozzie\u2019s Iron. Untraceable since we filed the numbers off.', 'Ad: Lungful Lite. Now with 20% less lung damage. Allegedly.',
    'Caller: Some fucker stole my dog. Spit: Was it the dog? Dogs leave.', 'Caller: ColSec beat my brother. Spit: Name the cop. On air.',
    'Spit: Saltblood says tribute is up. Saltblood can eat shit.', 'Spit: Whoever\u2019s squatting in Dome Three, they\u2019re coming tonight.',
    'Spit: The Trust says money is safe. Your money. Not you.', 'Spit: Remember: snitches get static. And then stitches.',
    'Caller: Is the dust supposed to be blue? Spit: Only if you paid.', 'Spit: Hold your breath, kids. It\u2019s free. For now.'
  ],
  step(x, t, s, bar, spb) { // grimy downtuned sludge: distorted saw bass, dragged snare, a busted clank
    const root = [33, 33, 36, 31][bar];
    if (s % 16 === 0 || s % 16 === 3 || s % 16 === 10) x.osc('sine', 90, t, 0.35, 0.65, 34);
    if (s % 16 === 8) { x.hit(t, 0.3, 0.38, 1100, 0.5); x.hit(t + spb * 0.15, 0.12, 0.12, 4000, 1, 'highpass'); }
    if (s % 4 === 2) x.hit(t, 0.05, 0.06, 6500, 1, 'highpass');
    if (s % 2 === 0) x.osc('sawtooth', 440 / 32 * Math.pow(2, (root - 9) / 12) * (s % 8 === 6 ? 1.5 : 1), t, spb * 1.8, 0.11);
    if (s % 32 === 12) { x.osc('square', 1660, t, 0.06, 0.04, 400); x.hit(t, 0.2, 0.1, 2400, 12); }
    if (s % 64 === 32) x.osc('sawtooth', 440 * Math.pow(2, (root + 12 - 69) / 12), t, spb * 10, 0.035, 440 * Math.pow(2, (root + 11 - 69) / 12));
    if (s % 64 === 0) x.hit(t, 2.2, 0.06, 700, 0.3); // tape hiss swell
  }
};
