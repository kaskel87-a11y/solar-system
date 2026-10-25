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

## v6: side quests, aliens and more to discover
- **Side quests:** Mission Control radios you quest offers (with Quindar beeps and an optional voice). There are 14 quests across the Moon, Mars, Venus, Mercury, Earth, Io, Europa and Titan. Examples: recover a lost Apollo camera, scan ice in Shackleton, rescue a stranded rover, follow the Mars signal to an alien outpost and its Hive Queen boss, find the Venera capsule before it cooks, outrun the sunrise on Mercury, and play fetch with Frankie on Earth. A blue arrow and a beam point to each step. You earn XP, ranks, credits, badges, rover paints and bandanas for Frankie. Progress saves in your browser.
- **Aliens (fiction!):** cartoony drones, crawlers and a boss. They go *zap* and poof into sparkles. Your shield recharges, and if you go down you're beamed back to the Starship with nothing lost. Frankie growls when aliens are near. Turn them off in **📜 Log → ⚙️ Settings** for peaceful exploring.
  - **Phone:** hold **FIRE** to auto-aim at the nearest alien.
  - **Desktop:** click, or hold F, at the crosshair or mouse pointer.
- **Rover plasma blaster:** a twin-barrel heavy blaster on the roof, with muzzle flash, recoil and a heat meter that can overheat. On a phone it auto-aims ahead. On desktop it follows your aim.
- **More discoveries:** 41 real-science sites, including the new landable moons **Io, Europa and Titan**, next to Jupiter and Saturn. There are also rare finds: olivine crystals, pallasite meteorites and alien artifacts (fiction). Anything made-up is tagged **FICTION**, and all planet facts are real.
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
