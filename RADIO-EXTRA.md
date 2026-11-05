# Mars radio, part 2: PIT 66.6, DUST 98.3 and MY MUSIC

Files: `radio-extra.js` (glue, MY MUSIC, panel section), `songs.js` (song-structured station engine), `pit.js`, `dust.js`.
Tests: `tests/test-radio-extra-unit.mjs` (node) and `tests/test-radio-extra.js` (Playwright).

## Stations
All three are added with `SSX.audio.registerStation`, after the existing stations, and saved by id (`settings.radioId`).

- **PIT 66.6** (Metalcore · Deathcore): down-tuned palm-muted chugs through a waveshaper amp, hardcore two-steps, groove
  riffs with double kick, blast beats with dissonant tremolo picking, half-time and slam breakdowns with a bass drop, pinch
  squeals and amp feedback. 7 rotating tracks, 150-198 BPM, drop E to drop A.
- **DUST 98.3** (Red Dirt Outlaw Country): strummed acoustic guitar, upright bass, fiddle, pedal-steel-style slides, brush
  train beats, a shuffle, a waltz in 3/4 and a fingerpicked ballad. 7 rotating tracks.
- Both are **instrumental only**: no vocals and no lyrics in the music. A short spoken DJ station ID (caption plus the
  TTS-free babble voice from `synth.js`) plays only in the one-bar gap between songs. Regular DJ lines show up as text toasts, the same way they do on the other stations.
- Songs never repeat back to back. Each song gets its own tempo, key and section order.
- **MY MUSIC**: tap ☰ → 🔊 Sound & radio → **📁 Pick files** (or tap the MY MUSIC station) to choose audio files on your
  phone or computer. They shuffle, auto-advance, and skip with **⏭ Next song**. They play through the Music bus, so the
  Music, Master and Mute controls all apply, and they follow the car radio: 📻 Next, Radio off, getting out and venues
  all pause them. Files play from local `blob:` URLs and are **never uploaded**. They're forgotten when the page
  closes, and only the station choice is saved.

## Licensing
All music on PIT 66.6 and DUST 98.3 is **original and procedural**. It's synthesized live with Web Audio oscillators
and noise, with no samples or recordings. Riffs and melodies are generated from seeds (`songs.js` `rng`), and the chord
changes are generic I-IV-V-style progressions. Nothing is taken from or modeled on any specific song, so there's no
license to track. MY MUSIC only plays files the player already has on their own device, locally.

## Night mix (night.js)
When a day/night clock exists (`SSX.time.isNight()`), the Mars districts get sparse seedier one-shots at night on top of the ambience beds: far sirens and dogs, bottle smashes, shouting, rattling shutters, club bass, hover-cop sweeps, weighted by district (Flats seediest, Heights quietest). They follow the Ambience slider, Master and Mute. Without a clock it does nothing. All procedural.
