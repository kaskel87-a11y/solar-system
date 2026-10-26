// Red Tape Flats street life: tweaker / rockhead rants (Snuffles). "Static rock" is cooked-down Red Static, a made-up
// Martian street drug; the people who smoke it are rockheads. Coherent threats mixed with paranoid word salad.
// Lines stay under 90 characters (SSX.bark's limit). mangle() adds stutter, caps and trailing off; volume() scales the
// delivery with distance (mutter -> talk -> SCREAM).
export const RANT = [
  'The satellites took my FUCKING teeth, Gary!', 'Blorp the dome! BLORP IT!', 'I know what you did with the oxygen, you lizard-eyed motherfucker',
  'Mmmrrhhgh... ninety-nine crickets... SQUARE UP!', 'They put a chip in the water. Two chips. Salt and vinegar.', 'Phobos is WATCHING. Phobos has a little camera, man.',
  'Don\u2019t breathe my air! That\u2019s MY air! I paid for that air!', 'My left hand works for ColSec now. Traitor. Fuckin\u2019 traitor hand.',
  'The dust talks at night. It says your name. It says it WRONG.', 'Who moved the sky? Somebody moved the goddamn sky!', 'I can hear the pipes thinking. Shut UP, pipes!',
  'Gary owes me eleven teeth and a hamster.', 'Static in my blood, static in my bones, static in my... where\u2019s my shoe?', 'You\u2019re not even REAL. You\u2019re a Meridian ad.',
  'Spiders. Tiny space spiders. In the vents. Wearing hats.', 'I was a pilot! I flew the moon! The little one! Fuck the big one!', 'Rocks are just shy money. SHY MONEY.',
  'The lamp post is a cop. Look at it. LOOK AT IT.', 'Who sent you? Halvorsen? The worms? Was it the worms?', 'Eat the dome! Eat it from the inside! Like a melon!',
  'I\u2019m not high. I\u2019m elevated. There\u2019s a difference, Gary.', 'Count your fingers. COUNT THEM. They swap them while you sleep.', 'Bzzt bzzt. Bzzt. That\u2019s the code. You know the code.',
  'My mom is a vending machine and she\u2019s DISAPPOINTED in me.', 'The crickets want their ninety-nine back.', 'Oxygen is a scam, man. Big Air. BIG AIR.',
  'Somebody stole my shadow and left this cheap one.', 'Fuck the moon. Fuck both moons. Fuck the idea of moons.', 'I see you. I see you seeing me. I see you seeing me SEE you.',
  'Glorbo, Glorbo, open the door... nobody\u2019s Glorbo anymore...', 'My skin\u2019s on backwards and it\u2019s YOUR fault.', 'Red rock, red sky, red you. RED YOU.',
  'I sold my kidney for a rock and the rock was a kidney.', 'Don\u2019t look at the tower. The tower looks BACK.'
];
export const ACCUSE = [
  'You took my stash! I KNOW you took my stash!', 'You lookin\u2019 at me? You fuckin\u2019 lookin\u2019 at me?!', 'That\u2019s my rock in your pocket. I can SMELL it.',
  'You been following me since the airlock, you narc piece of shit.', 'Stop STARING. Your eyes are too loud.', 'You touched my spot. Nobody touches my spot.',
  'You\u2019re the one who ate my shoes, aren\u2019t you?', 'I saw you whisper to the lamp post. Snitch.'
];
export const CHALLENGE = [
  'You lookin\u2019 at me? Square up, motherfucker!', 'Fists up! FISTS UP! Let\u2019s fuckin\u2019 go!', 'Me and you. Right here. Bare knuckles, bitch.',
  'Come on then! I\u2019ll knock your teeth into orbit!', 'Square UP! Square up or pay up, Gary!', 'I eat guys like you for breakfast. I don\u2019t eat breakfast. FIGHT ME.'
];
export const TAUNT = ['Yeah, run, you lizard bitch!', 'Thought so. All suit, no balls.', 'Walk away! Walk AWAY! The crickets saw that!', 'Coward! COWARD! I\u2019m telling the satellites!', 'Pussy. Absolute dome-bred pussy.'];
export const PAID = ['Ten? TEN? ...Okay. Okay. We\u2019re cool. We\u2019re so cool.', 'Pleasure doing crime with you.', 'This is going straight up my... into savings. Savings.', 'Blessings of the crickets upon you.'];
export const SWING = ['HYAH!', 'Fuckin\u2019 HOLD STILL!', 'Bzzt! BZZT!', 'Eat it!', 'For Gary!', 'Rrraaagh!', 'Stop moving your FACE!'];
export const BOTTLE = ['Oh you want it SPICY? Bottle time, bitch!', 'Meet my friend. He\u2019s broken. Like me.', 'Glass! GLASS! Glass for the lizard!'];
export const KO = ['Mmmrrhh... the crickets... they\u2019re coming...', 'Gary... tell my hamster...', 'I meant to... lie down... anyway...', 'Five more minutes, mom...'];
export const WON = ['Stay DOWN, lizard! Your credits are mine now!', 'That\u2019s what you get! The satellites saw THAT!', 'Hah! HAH! I\u2019m the king of the dirt!'];
export const HURT = ['Ow! OW! You hit my thoughts!', 'That one\u2019s going on my record!', 'Lucky! LUCKY punch!', 'My nose was rented!'];
const R = () => Math.random();
const pick = a => a[(R() * a.length) | 0];
let last = '';
export function pickRant(pool = RANT) { let l = pick(pool); if (l === last && pool.length > 1) l = pick(pool); last = l; return l; }
// stutter the first word, SHOUT a random word, or trail off; level 0 mutter, 1 talk, 2 scream
export function mangle(line, level = 1) {
  let w = line.split(' ');
  if (R() < 0.35) { const f = w[0], c = f.match(/[A-Za-z]{1,2}/)?.[0] || f[0]; w[0] = `${c}-${c.toLowerCase()}-${f}`; }
  if (R() < 0.3 && w.length > 3) { const i = 1 + ((R() * (w.length - 2)) | 0); w[i] = w[i].toUpperCase(); }
  if (R() < 0.15 && w.length > 4) { const i = 1 + ((R() * (w.length - 2)) | 0); w.splice(i, 0, w[i]); }
  let s = w.join(' ');
  if (level <= 0) s = s.toLowerCase().replace(/[!?.]+$/, '') + '\u2026';
  else if (level >= 2) s = s.toUpperCase().replace(/[.]+$/, '') + (/[!?]$/.test(s) ? '!' : '!!');
  else if (R() < 0.2) s = s.replace(/[!?.]+$/, '') + '\u2026';
  return s.slice(0, 90);
}
export const volume = d => d > 16 ? 0 : d > 7 ? 1 : 2;
