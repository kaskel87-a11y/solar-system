# Cinematic Universe Explorer

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

## Running locally
It uses ES modules, so you need a local server: `python3 -m http.server` then open http://localhost:8000/.

## Credits
- Planet, Moon, Sun, ring and Milky Way textures © [Solar System Scope](https://www.solarsystemscope.com/textures/) (INOVE), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), downloaded from Wikimedia Commons. The `textures/1k/` copies are downscaled versions for phones.
- [three.js](https://threejs.org) r169 (MIT), vendored in `vendor/three/`.
