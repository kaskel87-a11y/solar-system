# Solar System Explorer

Interactive Three.js solar system: drag to orbit, scroll/pinch to zoom, tap or click a planet (or use the planet bar) for facts, and press **F** or tap **🚀 Fly** to pilot a rocket.

Live: https://kaskel87-a11y.github.io/solar-system/

## Controls
- **Desktop:** drag to orbit, scroll to zoom, click a planet. Flight: W/A/S/D or arrows move, mouse looks (click to lock the pointer, or drag), Q/E down/up, Space or Shift to boost, F or Esc to exit.
- **Phone:** one finger orbits, pinch zooms, tap a planet. Flight: the left stick moves, drag anywhere else to steer, and you hold Up/Down/Boost.

## Landing and walking
Fly close to **Mercury, Venus, Earth, the Moon, Mars, Io, Europa or Titan**. A **🛬 Land** button appears (or press **L**). Each world has its own procedural terrain, sky and gravity: grey cratered Moon with Earth in the sky, red Mars with a rover, orange-fogged Venus, and green Earth with water and trees. The Sun and gas giants tell you why you can't land.
- **Desktop:** W/A/S/D walk, mouse looks (click to lock, or drag), Space jumps, Shift runs, click or aim the crosshair at objects for facts, T takes off.
- **Phone:** the left stick walks, drag to look, hold Jump/Run, tap objects for facts, and tap 🚀 Take off to return to space.

## v5: explore more
- **Land button:** it's always visible while you fly. If you're far from a world, it puts the autopilot on the nearest one. Planet cards have a "Land here" button.
- **Camera:** first person, third person and aerial views. Tap the 👁 pill or press V. Pinch or use the mouse wheel to zoom out up to about 320 m. Fog and draw distance open up as you zoom out.
- **Discoveries:** 23 real sites and features across the Moon, Mars, Venus, Mercury and Earth. Gold beacons show what's left to find and turn green once found. The Discoveries log keeps the facts and saves in your browser.
- **Starship:** a stylized steel ship with heat tiles and flaps. You fly it in space and it stands on landing legs on the surface.
- **Rover:** a six-wheeled pressurized rover. Press Drive or E, steer with the stick or WASD, and hold Boost or Shift. It follows the terrain and gets big hops in low gravity.
- **Frankie the French bulldog:** follows you, rides in the rover, sits when you stop and sniffs toward undiscovered signals. Pet him with the button or P. He wears a helmet away from Earth. You can rename him in the log.

## v7.5.5: Mars dust storms (add-on: mars/storm.js)
- Every 9 to 16 minutes of Mars time (the first one 6 to 10 minutes after you land) a dust storm rolls in. It takes about 30 s to build, holds for about a minute, then clears over about 30 s. Storms run on `SSX.time` when it's there (frozen time holds the storm, and the time scale is capped at 20×). Without it they use a real-time timer. Storms only run on the Mars surface and pause when you leave.
- **Look:** fog closes in to about 38 m at the peak on med quality (30 m on low, 44 m on high). The sky, fog and sunlight turn rust red, the sun hides, and grit blows past the camera. The grit is one pooled `THREE.Points` draw call that wraps around the camera in the vertex shader: 160, 420 or 700 grains on phones for low, med and high quality. The storm layers on top of whatever set the look this frame (core zoom fog, v8 lighting, `SSX.time`, Director). It saves the look before each render and puts it back after, and it only ever pulls fog in, never pushes it out. With `SSX.time` the colours go through `SSX.time.addLookFilter`. Indoors nothing changes.
- **Gameplay:** traffic drops to 55% speed at the peak. Core cars are slowed through the world API, and Beltway traffic too if it exposes `setSpeedScale`, `setSpeed` or `setDensity`. Crimes gain up to 50% less heat, so a 2★ crime at the peak costs 1★. Fractions carry over to your next crime. Indoor crimes aren't damped. Everything goes back to normal when the storm clears.
- **HUD:** a one-line caption ("🌪️ Dust storm coming", "🌪️ Dust storm · heat −50%", "🌤️ Storm clearing") shows for about 3 s at each change, bottom-left above the joystick, clear of the screen centre and the top-right stack. Nothing stays on the HUD, and it never takes taps.
- **URL:** `?storm=1` starts a storm 6 s after you land on Mars. `?storm=peak` starts one at full strength. `?storm=0` turns off periodic storms (handy for tests). `?stormq=low|med|high|ultra` overrides the grit and fog tier.

`window.SSX.storm` (also `__app.storm`):

| call | what it does |
| --- | --- |
| `active()` / `intensity()` / `phase()` | is a storm on; 0..1 strength; `clear` / `building` / `peak` / `clearing` |
| `start({ build, peak, clear, intensity, instant })` | start a storm now (durations in seconds). Calling it during a storm extends the storm, and during clearing it builds back up without snapping |
| `stop({ instant, clear })` | clear the storm (smoothly unless `instant`) |
| `on(event, fn)` → unsubscribe / `off(event, fn)` | events: `start`, `peak`, `clearing`, `end`, `phase`, `shed` (heat was damped), `tier`; also `SSX.emit('storm:<event>')` |
| `state()` / `next()` | phase, timer, tier, on Mars / indoor; seconds to the next periodic storm |
| `setPeriodic(on)` / `periodic` | turn the schedule on or off |
| `tier()` / `setTier(t)` | grit and fog tier (follows `SSX.look.tier()` unless set) |
| `heatScale()` / `trafficScale()` / `visibility()` | current heat multiplier, traffic multiplier, fog far distance in metres |
| `frameMs()` / `stats()` | the storm's own CPU cost per frame (EMA) |

Core hook: `world.js` `setWanted` calls `SSX.heatFilter(from, to, why)` when it's set, and uses the result if it's a finite number. The call is guarded and wrapped in try/catch, so a broken filter can't stop crimes. The storm installs this filter only while a storm is on, and chains to any filter that was there before.

## v7.5.2: street life
- **Fixed on iPhone:** ✅ Accept and Later on radio job offers (and every other in-game button: Log ▶ Start, duel, race and shop buttons, ☰, map, Land/Take off) now work while your thumb is on the joystick. iOS sends no click for a second finger's tap, so these now fire on the finger's own touch release.
- Street danger: knife muggings with Pay / Fight / Run / Talk, street fights, gang and junkie car chases, the Red Tape Run highway set-piece, and ambient street vignettes. Toggle it from ☰ (🔪 Street danger).
- Side jobs: taxi, paramedic and vigilante runs with levels, across all four districts.
- The Raccoon Mobile (900 cr at Meridian Depot) and Silas & Tam's junkyard lab: five portal missions.
- Under the hood: one import map now owns the version, so every module loads exactly once (see API.md, "Importing core modules").

## v7.5.1: heists
- Safes in the First Junction Trust bank and the Helios Heights mansions now use a cracking dial: drag anywhere to turn it, and stop on each notch while keeping the noise down. Too much noise trips the alarm.
- Security cameras sweep view cones and raise your wanted level when they spot you. Private security responds to alarms.
- Informant tips mark cameras and guard posts on your minimap.
- The street economy: buy low in one district and sell high in another, barter with fixers for guns, tips and backup, and watch out for undercover busts. Chop shops scrap hot rides.
- Fixes: the duel camera finds a clear side, rocks and crate stacks no longer swallow the camera, and the Security pay-off spot is easier to hit.
- Radio messages you didn't ask for arrive as a one-line pill (tap to read), and on portrait phones the pill replaces the toast, so the centre of the screen stays clear.
- Fixed: the Mars story pack loaded a second copy of the game module.

## v7.5: the Mars city
Land on Mars and Ares Junction is now the hub of a city. Open ☰ → 🏙 **Districts** to hop between them (lose your wanted stars first).

- **Olympus Row**: downtown towers, the First Junction Trust bank (crack the vault in Kline's job), the Red Shift cantina and the precinct.
- **Red Tape Flats**: Saltblood gang turf, the chop shop and dealer lots. Thugs here don't call the cops; they call their friends.
- **Helios Heights**: four gated mansions. Case the camera grid, get in, hold still on the safe, and get out before private security arrives.
- **The Ares Beltway**: the highway between them, with traffic, ramps, faction checkpoints and two chase missions.
- **16 city missions** from Detective Vale, Marrow, Captain Rhee, Lita Quinn, Kline and Nyx, including a choice you can't take back. Ines's VIP room has a job board.
- **Security fights back**: guards take cover and pop up to shoot, backup rolls in, heavies come at 4-5★. People bleed red; machines throw sparks.
- **Also in v7.5**: 17 repeatable side jobs (with Static Hold'em poker) by Steve, four in-car radio stations and district soundscapes by Pumpkin, and 11 story missions for Rook, Vesna, Kestrel, Ines and Rusk by Jeff.
- ☰ now works in space too.
- Modders: see [API.md](API.md).

## v7.4: five new colonies, street races and barrel rolls
- **Colonies on Venus, Mercury, Titan, Europa and Io** (merged from PR #1): Sulfur Gate, Shadowline Array, Kraken Landing, Conamara Station and Loki Forge. Each one has its own contacts, jobs, radio lines and a signature ride (acid crawler, sun skimmer, methane skiff, crevasse sled, lava runner). Every storefront is a walk-in interior. You get a world's travel permit by finishing a referral job, then fast travel from ☰ **🌍 Colonies** (40 cr the first time, free after that). The Titan methane skiff is amphibious and skims the methane seas.
- **Street races and a track builder** (merged from PR #2): ☰ **🏁 Street races** has checkpoint gates, a 3-2-1 countdown, lap times, best-lap ghosts, an AI rival and a buy-in purse. ☰ **🛠 Track builder** lets you lay out your own gates and race them.
- **Barrel rolls:** anything airborne can roll, including the thruster rover, hover bikes, stolen rides that catch air and the Starship in space.
  - **Laptop:** press **Q / E** in the air, or double-tap **A / D**.
  - **Phone:** flick the stick sideways twice, fast, or swipe across the Thrust button.
  - Land on your wheels for a stunt bonus: 25 cr × rolls², plus 10 cr with the body kit. Land on the roof and you take damage.
- **The Velvet Airlock goes full strip club (non-explicit):** pole dancers in bikinis that stay on (realistic models, v7.5.x). Stand at the stage and **💸 Tip · 20 cr** to make it rain credit chits. In the VIP room, **💃 Dance · 50 cr** buys Danny Alvarez's one-song private dance, costumed and letterboxed, with Tiny watching. **🚪 Upstairs · 150** with Sable (an adult host) fades to black with one line and brings you back with full health and shield. Nothing sexual is shown or described. A one-time **🔞 18+** prompt guards all three.
- **Laptop fix:** you land with a free mouse, so a click on ☰ always opens it. Click the ground to lock mouse aim. Esc frees the mouse again, and **M** opens the menu at any time.
- **Phone fix:** a ☰ entry that opens a panel can no longer press the button that appears under your finger.
- **Legal duels:** walk up to a colonist and press **⚔️ Challenge**. Pick 👊 fists, 🔪 blades or a 🔫 quick-draw at 10 paces, and put up a wager they match.
  - A ring forms, a crowd gathers and cheers, and you fight to KO or yield, never to the death. Tap 🏳 to yield.
  - Duels are sanctioned: no stars, and security watches but stays out of it.
  - Win the pot plus XP, and come back for rematches. Some colonists refuse, and some lose their nerve before the draw.
  - **Grinder Vos**, the cantina pit champion, wants at least 50 cr and the house adds a purse.
  - Hitting people outside a duel is still a crime.
- **Labelled meters:** the top bar now reads **🛡 SHIELD**, **❤ HEALTH** and, whenever your ride can thrust, **🚀 THRUST** fuel (turns orange under 25%). Laptops show the words and numbers; phones show icons.
- **Playtest fixes (BUGS-v7.3):**
  - While the mouse is captured, a small chip says **Esc frees mouse · M menu**, and clicks near the top bar never grab the mouse.
  - Indoor cameras respect interior walls: the VIP room no longer goes black when you face Ines, and Depot shelving no longer hides you.
  - You walk in a step past the door, and your character fades out if the camera gets squeezed against you.
  - Autopilot keeps its own label when you pass another world.
  - ☰, the weapon chip and Drive/Pet/Radio are all at least 44 px tall.
  - The landscape ☰ menu stops above Pet and Jump.
  - Fixed a three.js 'basic' material warning.

## v7.3: walk in, go shopping, and the Velvet Airlock

**Every building is enterable.** Walk up to a door in a colony and the context button says **🚪 Enter <name>** (stores say **🛒 Shop**). Inside, the camera pulls in close and stays in the room, guns are holstered ("house rules"), and **🚪 Leave** by the door takes you back out.

| Colony | Building | What it's for |
|---|---|---|
| Ares Junction (Mars) | Cantina | Dutch behind the bar: drinks (heal/shield), rumors, jobs |
| | Ares Supply | Medkits, armor, heat sink, shells; Trauma implants and Bandolier rigs in the cases; Frankie's bandanas |
| | Meridian Depot | Rover parts wall (turrets, rail cannon, rockets, torch, EMP, armor), paint and body kit wall, a hidden stash |
| | Ozzie's Iron | Wall rack of long guns (shotgun, Viper SMG, rail rifle, frag launcher), cases of ammo and blades; Ozzie's jobs |
| | The Velvet Airlock | Neon club: fully clothed costumed dancers, bar, booths, Brick at the door (20 cr cover, no entry while wanted), VIP room (60 cr) with Ines |
| | Colony Security | Deputy Rusk takes 80 × stars² cr to make your wanted level disappear (not at 4★+) |
| Freeport (Moon) | The Dry Sea, Freeport Supply, Freeport Arms | Bar, gear store, gun shop |

**Shopping is physical.** Guns hang on the wall, gear and upgrades sit in lit glass cases, and every item has a price tag (it flips to OWNED or EQUIPPED). Walk up to an item for **🛒 Buy <item> · <price>**, or tap the item itself. The clerk at the counter has the full list as a fallback. Finding a store: each one is a big green **$** on the radar, **🛒 Shop** beats Pet near a store, and ☰ → **🛒 Shop** marks the nearest one with a pulsing $.

**New gear:** Viper SMG (rounds), scoped rail rifle (slugs), frag launcher (lobbed grenades with splash), heavy cleaver (melee). Max health (+15 per Trauma implant) and ammo capacity (+25% per Bandolier rig) go up with buyable tiers I-III, rare biomod/bandolier finds and two hidden stashes.

**Story.** Contacts from the story pack (Dutch, Ozzie, Ines, Brick, Rusk) live in the buildings. Dutch's and Ozzie's first jobs, Vesna's resin job and Kestrel's ghost run are playable now; later missions unlock as the engine grows (v7.4).

**Playtest fixes (from the v7.2 bug list).**
- The chase camera now pulls in instead of going through buildings, domes or the Starship's legs, so you stay on screen next to walls.
- **🛬 Fly to … & land** now goes to the world you picked, or to **Mars** (Ares Junction, where the game is) when you haven't picked one. Before, it went to whatever was nearest.
- Job offers that arrive while you're landing show up as a one-line pill. A minimized pill really hides Accept/Later now, and **Later** is readable.
- Frankie no longer wanders off sniffing while you run.
- Credits never get cut off in the top bar; the gravity readout drops out when you're wanted or driving.
- ☰, the weapon chip, the radio buttons and the menu items are all at least 44 px tall.
- All buttons are black with white text and a light border. Toggles show a green **ON** or a grey **OFF**. `tests/test-contrast.js` checks every visible button for at least 4.5:1 contrast.
- On a laptop, the HUD is drawn larger.

**Keyboard and mouse (laptops).** ☰ → **❔ Controls** (or press **?**) lists every key for flying and on foot. ☰ → **⛶ Full screen** toggles browser full screen (it reads *Exit full screen* while active, F11 and Esc still work; hidden on iPhone, which has no element full screen). On a touchscreen laptop the HUD follows your last input: tap the screen and the touch joystick and buttons appear, press a key or move the mouse and you get the keyboard/mouse HUD back. **Boost:** hold **Shift** while driving any vehicle (your rover, or a stolen buggy, hauler, hover bike or skimmer; each has its own boost top speed), or hold the **⚡ Boost** button with the mouse or a finger. The first time you drive on a laptop a hint reminds you.
- **Enter** accepts a radio job and **Backspace** skips it, even when the mouse is locked.
- **E** enters buildings and buys the item in front of you. Inside, a crosshair appears, and clicking an item on the wall buys it.
- Opening a menu or shop frees the mouse.

### Modding API (v7.3, extended in v7.4)
Call these from the browser console or an extra `<script type="module">` before you land:

```js
// a new colony on any landable world. blocks: [x, z, w, d, h, sign, colour, interiorKind?, insideTitle?]
SSX.registerColony('Europa', { name: 'Ice Harbor', a: 20, d: 180, tint: 0x9fd8ff,
  domes: [[0, 0, 10, 'ICE HARBOR', 0x9fd8ff]], blocks: [[18, 10, 7, 4, 4, 'SUPPLY', 0x3cff8a, 'supply'], [-16, 12, 8, 5, 5, 'BAR', 0xff2a5a, 'cantina', 'THE CRACK']],
  shop: [18, 13.2], contacts: [{ name: 'Mara', at: [6, 18], blurb: 'Ice miner. Owes everyone.' }], inside: { cantina: { barkeep: 'Mara', talk: 'Mara' } } });

// a mission (engine format: steps goto/collect/defeat/return/take/clean/race/enter; `at` is colony-relative [x, z])
SSX.registerMission({ id: 'mara-01', world: 'Europa', contact: 'Mara', title: 'Cold feet', intro: 'Mara: Walk into the bar. Act normal.',
  steps: [{ type: 'enter', building: 'bar', text: 'Walk into The Crack' }, { type: 'goto', at: [30, -20], r: 4, text: 'Meet the buyer' }],
  reward: { xp: 120, credits: 150 } });
// story-pack format (giver/setup/dialogue/rewards/prerequisites) is accepted too.

// a new interior kind: build(api, opts) with api.box/col/spot/sign/person; spots { id, x, z, r, label, act: 'shop'|'talk'|'leave'|'bribe', venue, who }
SSX.registerInterior('chapel', { name: 'Chapel', w: 10, d: 12, h: 6, build(api) { api.sign('QUIET PLEASE', 0xffffff, 0, 3.5, -5.9); } });

// a ☰ menu entry (pointer-based: touch fires on pointerup, mouse on click). Returns the <button>
const btn = SSX.registerMenuItem({ id: 'warpBtn', label: '🎲 Random warp', onTap: app => app.toast('Not today.') });

// v7.4: a vehicle kind. spec merges over defaults (boost = vmax × 1.5); optional builder(THREE, spec) returns a Group.
// spec.amphibious rides on liquid (cfg.water) instead of bouncing off it; spec.icon is used on the Take button.
SSX.registerVehicle('ice_cart', { name: 'Ice cart', icon: '🛷', vmax: 18, hover: 0.6, amphibious: true });

// v7.4: stub. Additive districts on a world (registerColony('Mars', …) would replace Ares Junction).
// Stored for the v7.5 Mars city build; districtsOf('Mars') lists them.
SSX.registerDistrict('Mars', 'olympus-row', { name: 'Olympus Row', centre: [0, -430] });
// v7.4: add-on modules can read world.wanted / world.evading / world.inDuel, call world.setWanted(n, why) and world.crime(min, why),
// and read world.securityList() (a copy). During a sanctioned duel, crime() ignores colonist hits and gunfire.
// v7.4: stub. Records a body in SSX.bodies for a later release; it doesn't add a planet yet
SSX.registerBody({ name: 'Ceres', r: 1.2, d: 300 });
```

### Heist mechanics (v7.5 add-on: heist.js)
Generic, data-driven heist pieces for the Mars city builder. `SSX.heist` (also `__app.heist`, or `import { heist } from './heist.js?v=7.4'`):

```js
// one-thumb safe-crack minigame (pointer drag round the dial; desktop ←/→ or A/D, Shift = fine). Tiers easy/medium/hard/vault.
const r = await SSX.heist.safeCrack({ tier: 'hard', time: 40, title: 'Voss House safe' }); // { success, reason: 'cracked'|'noise'|'timeout'|'abort', time, noise, tier, tumblers }
// cameras: world metres (or rel: 'colony' = relative to the world's colony centre, i.e. Ares Junction on Mars). yaw 0 looks toward -z.
SSX.heist.addCamera({ id: 'voss-cam0', world: 'Mars', rel: 'colony', x: 286, z: 68, yaw: 2.4, fov: 70, range: 12, sweep: 30, level: 2 });
SSX.heist.disableCamera('voss-cam0', 60); SSX.heist.removeCamera('voss-cam0');
SSX.heist.alarm(2, 'Voss House alarm'); // wanted -> 2★ (setWanted), or +1★ via crime() if you're already that hot
// a full job: case -> break in -> crack safe -> escape -> lose the heat. Steve's mansions convert with fromMansion().
const g = await (await fetch('gated-community.json')).json();
for (const b of g.buildings.filter(b => b.type === 'mansion')) SSX.heist.registerHeist(SSX.heist.fromMansion(b, g.coords.origin_aj, { tier: 'medium', credits: 300 }));
const res = await SSX.heist.startHeist('heist-voss'); // { success, loot, fail, stage, t, alarm }
SSX.heist.applyTip('heist-voss', { type: 'safe', ease: 0.3 }); // informant intel: 'cameras' | 'safe' | 'patrol'; unknown types ignored
SSX.heist.on('escape', e => { /* pursuit.js: { id, title, world, pos:{x,z}, site:{x,z,r}, heat, evading, security, alarm, loot, t, vehicle } */ });
```
Events (also `window` CustomEvents named `heist:<evt>`): `start`, `stage`, `tip`, `camera:alert`, `camera:disabled`, `alarm`, `alarm:response`, `safe:open`, `safe:result`, `loot`, `escape`, `done`, `clean`, `fail`.
No security AI or chase lives here: alarms only raise the wanted level and the getaway is the `escape` event. `?heisttest=1` adds a throwaway sample villa east of Ares Junction under ☰ → 🕵️ Heists. Context action key: **G**.

Engine hooks for add-on modules: `surface.js` calls `raceTick(dt, ctx)` (race.js) and `heistTick(dt, ctx)` (heist.js) once per surface frame, and `planets/index.js` runs `initPlanets(window.__app)` at startup. Colony packs live in `planets/<world>.js`, and `planets/hooks.js` is their only bridge to the core API.

```js
```

## Mars city ambience (add-on: radio stations, district soundscapes, pedestrian barks)

Files: `mars-audio.js` (glue, mixer, ☰ 🔊 panel), `radio.js`, `ambience.js`, `barks.js`, `synth.js`. Everything is synthesized with Web Audio: no samples, nothing downloaded, no licences to track.

- **Radio:** four new stations join the stock three (after *Radio off*, so old saves keep their station): **RUST 103.5** (Red Tape hip-hop/industrial), **OLYMPUS 90.1** (Meridian talk & news: news, in-world ads and host banter as small captions over a TTS-free babble voice), **HELIOS 107.7** (Quiet Money lounge), **BELTWAY 99.9** (outrun darksynth). NPC_BARKS.md DJ lines are added to KRED/VOID/CERES. Switch with **📻 Next** while driving or from **☰ → 🔊 Sound & radio** (pick a station on foot and it plays on your next drive). Radio only plays in vehicles; the station is saved as `settings.radioId` + `settings.radio`.
- **Mixer:** Master, Music and Ambience sliders plus Mute in the same panel, saved in `settings.mix`. Master/Mute cover every game sound.
- **District soundscapes (Mars):** Ares Junction hum and PA, Olympus Row traffic, horns and crowds, Red Tape Flats sirens, dogs, arguments and far-off shots, Helios Heights fountain, chimes and drone flybys, Ares Beltway wind and pass-bys. They crossfade by your AJ-relative position, using the mars-city centres (`AMBIENCE_CONFIG` in ambience.js), and switch to `registerDistrict` centres/radii once v7.5 registers them. They're muffled in a vehicle and almost silent indoors. Phones play at most 2 beds and 5 one-shot voices.
- **Barks:** short captions above nearby colonists and guards, triggered by being close, bumping into them, wanted level (guard lines scale with ★), gunfire, hits, stealing a car, speeding past or showing off a flashy ride. They're rate-limited (global, per NPC and per category gaps, at most 2 on screen), kept off the screen centre and the control band, and never take input.

```js
SSX.registerStation({ id: 'mine', name: 'MINE 88.8', tag: 'Test', bpm: 100, dj: ['Hi.'], step(x, t, s, bar, spb) { if (s % 4 === 0) x.osc('sine', 120, t, 0.2, 0.5, 40); } });
SSX.bark(npc, 'flats')            // npc: people index | name | { x, z } | null (nearest); category from barks.js BARKS or literal text; { force: true } skips the rate limit
SSX.registerBarks('heist', ['You\'re the Exchange guy!'])
SSX.registerSoundscape('spaceport', { centre: [500, 0], r: 60, profile: 'downtown' })  // AJ-relative
SSX.audio.mix.set({ master: 0.8, music: 0.5, amb: 1, mute: false }); SSX.audio.setRideFlash(info => 0.8) // garages: how flashy the current ride is (0..1)
```
Core hooks: one dynamic import line in `index.html`, `a.__ssxMusic || a.destination` in `audio7.js`, the new files in `sw.js` PRECACHE. Tests: `node tests/test-ambience-unit.mjs`, `BR=webkit VP=393x852 node tests/test-ambience.js`.

## v7.2: fly the rover, bolt guns to it, and install it as an app

**Air control.** Your rover now steers in the air. While it's airborne, from a jump, a crest or thrusters, push the stick left or right to yaw. It banks into the turn and the turn rate doesn't depend on speed. Stick forward or back noses it down or up a little. The chase cam swings after the heading softly, so banked turns read well. In first person the cockpit roll is halved and the gauge shows **ALT** instead of km/h.

**Cold-gas thrusters (Roadster-style).** In your own rover, or a stolen hover bike, the **Jump** slot becomes **🚀 Thrust**:
- Hold it to fire four belly pods and two tail nozzles. You climb at about 6 m/s, up to a 70 m ceiling.
- Feather it to hover. Let go to glide down. Push the stick forward while thrusting to drive with the tail jets.
- Fuel is the thin bar inside the button. A full tank lasts about 5 s of burn, and the bar turns orange below 25%.
- Fuel recharges only with the wheels on the ground, starting 0.6 s after you stop burning (about 4 s from empty to full).
- Landing at more than 13 m/s gives a hard thud. Above 17 m/s it hurts.
- Thrusting hisses, kicks dust off the ground below you, and lights the pod rings.
- On a keyboard, Space is Thrust while you drive.

**Rover weapons (colony shop → "Rover weapons").** Tap the weapon chip while driving your rover to cycle the mounts you own. Your purchases are saved in localStorage.

| Item | Price | What it does |
|---|---|---|
| Turret Mk II | 180 | Twin blaster with about 35% more damage, a faster cycle, and less heat |
| Turret Mk III | 320 | Quad-linked heavy blaster with four barrels (needs Mk II) |
| Rail cannon | 300 | 400 m/s slug that pierces everything in a line and leaves a beam tracer. Slow to cycle and hot |
| Rocket pods | 280 | Twin dumb-fire rockets with a 5.5 m blast radius and smoke trails |
| Plasma torch | 240 | Flamethrower-style short-range jet: wide, piercing, and constant |
| EMP pulse | 260 | 25 m shockwave that stuns aliens for about 3 s, dazes colonists and fries security. 3 s recharge |

The rover turret now works with **hostiles off** and **while flying**. When you're airborne, the turret can depress to shoot down at the ground. Splash and EMP damage on colony folk or security still counts as a crime.

**Roadster kit (shop → "Rover body", 350).** A low, sleek two-seater shell in deep red (or your chosen paint) over the six-wheel chassis, with a rear spoiler, light bars and bigger thruster pods. It gives +30% fuel (130) and faster recharge. Tap it again in the shop to go back to the stock hull. The styling is generic, with no badges or logos.

**Install it as an app (PWA).**
- The app ships with `manifest.webmanifest` (name "Solar System Explorer", full-screen, any orientation), gritty Starship-over-Mars icons (192/512, maskable variants, and a 180 apple-touch-icon), and iOS meta tags.
- `sw.js` keeps the app shell, three.js and textures cached, so the game launches offline after the first run. Cache names carry the release version (`sw.js?v=7.3`, the same number as the module `?v` cache bust), and old caches are deleted on update. `index.html` and the game's own modules are fetched network-first, with the cache as the offline fallback, so new releases and hotfixes still land. three.js, textures and icons are served cache-first.
- The HUD already respects the notch and home-bar safe areas in standalone mode.
- **On iPhone:** open https://kaskel87-a11y.github.io/solar-system/ in Safari, tap **Share (□↑) → Add to Home Screen → Add**. On iOS 16.4+ Chrome works too: **Share → Add to Home Screen**. Launch it from the home-screen icon for full screen with no browser bars.
- **On Android or desktop Chrome:** use the ☰ menu → **📲 Add to Home Screen**, which triggers the install prompt, or use the browser's Install button.
- The ☰ menu item has a small dot until you've opened it once. It hides itself when the game is already running as an installed app. There are no banners.

**Third-person camera stays behind you (GTA-style).**
- On foot, your character turns to face the way you walk, and the camera eases round behind them. It pulls hard when you run away from the lens and gently when you strafe or walk back toward it.
- The same follow works in your rover, stolen rides, and while flying.
- Drag to orbit and look around whenever you like. The camera settles back behind you 1.5 s after you let go, or right away once you start moving.
- Pinch or scroll zoom distance is kept.
- First person and desktop mouse-look (pointer lock) are left alone.

**Share with friends (free, no App Store).**
- ☰ menu → **🔗 Share with friends** opens the phone's share sheet (iMessage, WhatsApp, etc.). It sends the title, a one-line pitch and the clean link https://kaskel87-a11y.github.io/solar-system/.
- Where there's no share sheet, as on most desktop browsers, it copies the link and shows a small "Link copied" toast.
- The page carries Open Graph and Twitter card tags, with a 1200×630 gameplay card (`share-card.jpg`: the Roadster thrusting past the Starship). Links unfurl with a big preview in iMessage, Slack, Discord and X.
- Everyone's progress is their own. Credits, unlocks, quests and settings live in that device's localStorage, so nothing is shared through the link. A friend opening it starts fresh, and so does an installed home-screen copy on a new phone.

Tests: `tests/test-cam.js` checks that the camera converges behind you after turning, and covers orbit hold, ease-back, zoom kept, rover, flying and stolen rides. `tests/test-v72.js` covers:
- air turns left and right, plus bank sign, with and without thrust;
- thrust lift, fuel drain, empty tank and ground recharge;
- turret fire with hostiles off while flying;
- buying every mount, cycling them by tapping the chip, and each mount damaging a target;
- the Roadster kit, and persistence across a reload;
- the share item (share sheet and copy-link fallback) and the OG/Twitter meta tags;
- a Chromium CDP multi-touch check (thumb on the stick plus Thrust);
- manifest, icons, iOS meta tags and the service worker.

## v7.1: fists, a blade, and a Take button that works
- **Take fixed on iPhone:** Take, Drive, Exit, Pet, Radio and the weapon chip now trigger on the touch itself. iOS WebKit (Safari and Chrome on iPhone) drops the tap's click event when your other thumb is on the joystick, so before this fix Take did nothing. Take also reaches a bit further than the distance at which the button appears. If you're too far, a toast says "Too far". Getting in plays a door clunk and a quick vignette.
- **Fire on foot:** the **FIRE** button is always there on foot and in a stolen ride, where you shoot out the window.
  - Auto-aim picks the nearest hostile in front of you, then security, then guards once you're wanted.
  - Firing near the colony, or hitting people or security, raises your wanted level. A quick tap always fires.
- **Weapons and ammo:** tap the weapon chip in the top bar (desktop: Q) to cycle the blaster, the shotgun and the machete (whichever you own).
  - **Plasma blaster:** never runs out of ammo, but it overheats.
  - **Shotgun:** uses shells.
  - **The chip:** `🔫∞` means the blaster is selected, `💥12` is your shotgun shells, `🗡️` means the machete is selected, and `✚1` is your medkits (tap the health bar or press X to use one).
- **More shells:**
  - Kills drop them.
  - Green **ammo crates** (green squares on the radar) sit around Ares Junction and Freeport Tranquility, with bigger supply caches out in the wastes. Crates restock after 90 s.
  - The shop sells them.
  - Your rover and the ship's lockers top you up to 24 shells (and 1 medkit) once a minute.
- **Melee:** a 👊 button appears next to FIRE when something is in reach (desktop: C).
  - It runs a punch, punch, kick combo. The kick knocks things back and staggers them. Fists do little damage.
  - **Vibro-machete** (220 cr at the shop, or sometimes dropped by hunters, nests and the Queen): it shows in your hand, sweeps everything in its arc, does 3× damage and leaves ichor everywhere. Select it on the chip to slash with FIRE.

## v7: darker, meaner, and a bit of GTA in space
- **Tone:** this is a game for adults now. Mission Control and the colony contacts are dry and salty (mild swearing, no sexual content). The "(Fiction!)" tags are gone. The Log's Rewards tab has one quiet line noting which parts are fictional (hostiles, hives, colonies, contacts, security). Planet facts are still real science.
- **Hostiles:** these are biomechanical crawlers that burrow and ambush, armored hunters that strafe and burst-fire, diving seekers, resin nests that keep hatching crawlers, and a much nastier Hive Queen who swipes and summons. They flank, lunge and hit hard. Kills burst ichor and chitin debris and leave splats on the ground.
- **Weapons and supplies:**
  - **Plasma rifle:** it overheats.
  - **Pump shotgun:** a pellet spread that uses shells.
  - **Medkits (+50 HP):** carry up to three.
  - Hostiles sometimes drop shells and medkits. Your shield regenerates, but health only creeps back to 35 on its own.
  - If you go down, med-evac bills you 10%.
- **Atmosphere:**
  - The ambient audio is a low drone with wind and the odd metal groan.
  - A **motion tracker** pings faster and higher as something closes inside 60 m, and the radar edge pulses green.
  - Colony lamps flicker.
  - Frankie still growls when something is out there.
  - Peaceful mode (Log → Settings) turns the hostiles off. Colonies and security stay.
- **Colonies:**
  - **Ares Junction** on Mars, about 200 m from the landing site. It has domes, a cantina, a supply depot, a landing pad, neon, crates, colonists and armed guards.
  - **Freeport Tranquility** on the Moon, which is smaller.
- **Take any ride:** walk up to a parked buggy, hauler, hover bike or shuttle and tap **Take** (E). Each has its own handling: the hauler is tough, the bike is fast and flips, the shuttle hovers. Your own rover stays your rover. "Return to rover" and the roof blaster still only apply to it, and there is no firing from stolen rides.
- **Wanted level (1–5 ★ in the top bar):** stealing in front of witnesses, shooting near the colony or hitting people or security raises it. Security drones and patrol buggies come after you. At 2★ they shoot, and at 3★ the buggies ram. To lose them, get far from the colony and out of their sight. The stars blink while you're evading, and lying low on foot helps. If they get their hands on you, you're **busted**: you pay a fine (15%, minimum 50 cr) and get dumped at the colony gate.
- **Contacts and jobs:**
  - **Rook:** smuggling run, getaway driver.
  - **Vesna:** stolen cargo, canyon sprint race.
  - **Kestrel** (Moon): crater run.
  - Walk up to a contact and tap their name to get a job.
- **Credits shop (🛒 at the supply depot):** shotgun, shells, medkits, an armor vest, a rifle heatsink, rover armor, rover paints and Frankie bandanas.
- **Radio:** it plays whenever you're in a vehicle. There are three procedural stations: **KRED 88.1** (red dust rock), **VOID 101.3** (deep space ambient) and **CERES 94.7** (belt synthwave), each with DJ blurbs, plus Off. Tap **📻 Next** or press N. The station name shows as a short toast.
- **Minimap icons:**

  | Icon | Meaning |
  |---|---|
  | Orange ring | Colony |
  | Green $ | Shop |
  | White bars | Parked vehicles |
  | Grey dots | Colonists |
  | Blue dots | Guards |
  | Purple diamonds | Contacts |
  | Green squares | Ammo crates (v7.1) |
  | Red/blue blinking | Security |
  | Yellow ring | Race gate |

- **Keys:**

  | Key | Action |
  |---|---|
  | E | Drive, take, talk or shop |
  | Q | Switch weapon |
  | X | Medkit |
  | N | Next station |

  On a phone, tap the gear chip in the top bar to switch weapons, and tap the health bars to use a medkit.
- **HUD rules from v6.1 still hold.** One action button changes with context (Drive, Take, Talk, Shop or Exit), and `test-hud.js` still checks for no overlaps and a clear center. `test-v7.js` covers taking a vehicle, a mission, gaining and losing wanted, getting busted, buying, the radio and combat.

## v6.1: minimal phone HUD
- **One slim top bar:** planet and gravity, shield and health bars, credits and XP, and a ☰ menu. The menu holds Take off, Discoveries/Log, View, Summon rover, Warp to rover, Return to ship, Hide HUD and Settings. On desktop it opens with Tab or M.
- **Radar minimap (top-left):** heading-up. It shows your rover (blue), the Starship (orange), the quest objective (cyan), the next discovery (gold), aliens (red) and Frankie. A label gives the rover distance. Tap the radar for the rover/ship menu.
- **Contextual buttons:** Pet appears only when Frankie is close, Drive only next to the rover, and FIRE only when aliens are around. They sit in the right-thumb area.
- **Compact cards:** discoveries and facts appear as a one-line card that disappears after about 4 seconds. Tap it to read the full fact, which also stays in the log. Only one message shows at a time, and a pending Mission Control offer shrinks to a "tap to read" chip.
- **Hide HUD (cinematic):** use ☰ → 🎬 Hide HUD, or U on desktop. Tap 👁 to bring it back.
- **Layout test:** `test-hud.js` checks that no HUD elements overlap and that the middle 50% of the screen stays clear. It runs on iPhone SE, 14 and 14 Pro Max, in portrait and landscape, on WebKit and Chromium.

## v6: side quests, aliens and more to discover
- **Side quests:** Mission Control radios you quest offers (with Quindar beeps and an optional voice). There are 14 quests across the Moon, Mars, Venus, Mercury, Earth, Io, Europa and Titan. Examples: recover a lost Apollo camera, scan ice in Shackleton, rescue a stranded rover, follow the Mars signal to an alien outpost and its Hive Queen boss, find the Venera capsule before it cooks, outrun the sunrise on Mercury, and play fetch with Frankie on Earth. A blue arrow and a beam point to each step. You earn XP, ranks, credits, badges, rover paints and bandanas for Frankie. Progress saves in your browser.
- **Aliens:** drones, crawlers and a boss (reworked in v7, see above). Your shield recharges, and if you go down you're beamed back to the Starship. Frankie growls when aliens are near. Turn them off in **📜 Log → ⚙️ Settings** for peaceful exploring.
  - **Phone:** hold **FIRE** to auto-aim at the nearest alien.
  - **Desktop:** click, or hold F, at the crosshair or mouse pointer.
- **Rover plasma blaster:** a twin-barrel heavy blaster on the roof, with muzzle flash, recoil and a heat meter that can overheat. On a phone it auto-aims ahead. On desktop it follows your aim.
- **More discoveries:** 41 real-science sites, including the new landable moons **Io, Europa and Titan**, next to Jupiter and Saturn. There are also rare finds: olivine crystals, pallasite meteorites and alien artifacts. All planet facts are real.
- **Easier to see:**
  - **Rover views:** the rover starts in the chase camera and remembers its own view, separate from your on-foot view. First person in the rover has a hood and dashboard with a speed and heat gauge.
  - **Terrain:** it has more contrast (slope shading, light and dark patches, darker rocks).
  - **Venus and Titan:** the haze is lighter and fades with distance, so nearby ground stays clear.
  - **HUD:** the pills are smaller, have solid backgrounds and sit stacked in the corners.
- **Return to rover:** on foot, the **🚙 Rover · 1.2 km** pill shows how far away your rover is and which way it is. Tap it to **summon the rover** to you, **warp to the rover** (Frankie comes too) or **return to the Starship**. This works at any distance. It's disabled while aliens are attacking. On desktop: **R** summons, **Shift+R** warps, **H** goes to the ship.

See [ROADMAP.md](ROADMAP.md) for what's next (v7.3: buildings, gun shop, security combat, more missions).

## Running locally
It uses ES modules, so you need a local server: `python3 -m http.server` then open http://localhost:8000/.

## Credits
- Planet, Moon, Sun, ring and Milky Way textures © [Solar System Scope](https://www.solarsystemscope.com/textures/) (INOVE), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), downloaded from Wikimedia Commons. The `textures/1k/` copies are downscaled versions for phones.
- [three.js](https://threejs.org) r169 (MIT), vendored in `vendor/three/`.
