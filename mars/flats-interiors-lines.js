// Red Tape Flats interiors: dialogue and bark lines (flophouse, chop clinic, pawn cage, laundromat).
// All game fiction, written for this repo (CC0). Crude, dark, adult; no slurs, nothing sexual, no real brands.
export const LINES = {
  flop_desk: [
    'Bunk\u2019s fifteen. Sheets are extra. We\u2019re out of sheets.',
    'Cash up front. Nobody\u2019s ever paid me in the morning.',
    'Top bunk\u2019s got a leak. Bottom bunk\u2019s got Gordo. Pick.',
    'You puke, you mop. Mop\u2019s also out.',
    'Checkout\u2019s whenever you wake up. Or don\u2019t.'
  ],
  flop_junkie: [
    'Hey\u2026 hey man\u2026 you got a light? \u2026or a lung?',
    'I was a pilot. Swear to God. Cargo hauler. Then the dust.',
    'Don\u2019t touch my shoes. They\u2019re not my shoes.',
    'Mm. Five more minutes. Five more years.',
    'You a cop? \u2026Cops don\u2019t smell this bad. You\u2019re cool.',
    'Somebody stole my teeth again.',
    'Shh. The walls are breathing. Let \u2019em.'
  ],
  flop_sleeper: [
    '*snores like a busted air recycler*',
    'Mm\u2026 mom?\u2026 no\u2026 mom, the hull\u2026',
    'Get your feet off my head.',
    '*coughs something up, swallows it back down*'
  ],
  flop_robbed: [
    'You wake up with your boots on and your pockets inside out.',
    'Somebody went through your jacket while you slept. Professionally.',
    'Your wallet\u2019s where you left it. The money isn\u2019t.'
  ],
  flop_rest: [
    'You sleep like the dead. The guy in the next bunk might actually be.',
    'Six hours of coughing, dripping and somebody crying in the toilet. Still the best sleep you\u2019ve had in a week.',
    'You wake up stiff, itchy and alive. Two out of three.'
  ],
  clinic_doc: [
    'Sit. Bleed on the plastic, not the floor. Floor\u2019s new.',
    'I lost my licence. Not my touch.',
    'Whatever happened to you, I didn\u2019t see it, and you didn\u2019t pay me.',
    'Don\u2019t mind the cooler. It\u2019s inventory.',
    'Anaesthetic\u2019s forty extra. Or bite this.',
    'Ah, a through-and-through. My favourite. Less digging.'
  ],
  clinic_patch: [
    'Doc Varga stitches you up with fishing line and a steady hand. You only scream twice.',
    'He digs out what\u2019s left of the bullet with dental pliers. Then he digs out the other one he finds.',
    'Staples, glue and a shot of something blue. You feel fantastic, and also like a stapled thing.'
  ],
  clinic_wanted: [
    'Security\u2019s looking for you? That\u2019s a surcharge, not a question.',
    'Hot patients pay hot prices. Nobody hears it from me.'
  ],
  clinic_blood: [
    'He drains a pint into an old coolant bottle. "Universal donor? Lucky us."',
    'The bag fills fast. The room spins slow. Here\u2019s your money, champ.'
  ],
  clinic_waiting: [
    'Don\u2019t look at me. I\u2019m not here.',
    'Is he a real doctor? \u2026Don\u2019t answer.',
    'I came in for a tooth. Now I\u2019m down a toe. Long story.'
  ],
  pawn_owner: [
    'Talk through the slot. Hands where I can see \u2019em.',
    'I buy. I don\u2019t ask. I also don\u2019t overpay.',
    'That\u2019s not stolen. That\u2019s pre-owned.',
    'Everything in here has a story. None of \u2019em end well.',
    'No drugs, no Quiet crates, no body parts. Clinic\u2019s down the street.'
  ],
  pawn_lowball: [
    'It\u2019s hot. Hot is worth less. Physics.',
    'I gotta sit on it a month. You don\u2019t. That\u2019s the price of not sitting.',
    'Take it or carry it around till ColSec finds it on you.'
  ],
  pawn_haggle_ok: [
    'Fine. You\u2019re bleeding me dry. Go.',
    'Ugh. Alright. Don\u2019t tell my wife.',
    'You got a mouth on you. I respect a mouth.'
  ],
  pawn_haggle_no: [
    'Now it\u2019s less. Keep talking, it gets lesser.',
    'You wanna haggle, go to Olympus Row and get robbed politely.',
    'That\u2019s my final offer. And now it\u2019s my finaller offer.'
  ],
  pawn_warn: [
    'PUT IT AWAY. Now. I won\u2019t say it twice.',
    'Gun down or I redecorate with you.',
    'Holster it, genius. This cage stops bullets. You don\u2019t.'
  ],
  pawn_hostile: [
    'Should\u2019ve listened!',
    'Nobody robs Benny!',
    'Eat buckshot, punk!'
  ],
  pawn_barred: [
    'You again? Get out before I finish the job.',
    'Gate\u2019s closed for you. Permanently-ish.'
  ],
  laund_front: [
    'Machine four eats coins. Machine six eats hands.',
    'Don\u2019t sit there. That chair\u2019s haunted.',
    'Nobody\u2019s actually washed anything here since the crash.'
  ],
  laund_knuckles: [
    'Back room\u2019s for customers. You a customer?',
    'You got dirty money? Everybody\u2019s got dirty money.',
    'Wipe your feet. Auntie Ro hates blood on the carpet.'
  ],
  laund_ro: [
    'Dirty in, clean out. I keep a slice. That\u2019s laundry.',
    'Every credit gets a tumble and a fluff, baby.',
    'Your money smells like gunpowder. Mine smells like fabric softener.'
  ],
  laund_nothing: [
    'You got nothing dirty, sweetheart. Come back when you\u2019ve sinned.',
    'Your pockets are clean. That\u2019s sad. Go do some crimes.'
  ]
};
export const pick = a => a[Math.floor(Math.random() * a.length)];
