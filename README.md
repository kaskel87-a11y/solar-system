# Cinematic Universe Explorer

Interactive Three.js solar system: drag to orbit, scroll/pinch to zoom, tap or click a planet (or use the planet bar) for facts, and press **F** or tap **🚀 Fly** to pilot a rocket.

Live: https://kaskel87-a11y.github.io/solar-system/

## Controls
- **Desktop:** drag to orbit, scroll to zoom, click a planet. Flight: W/A/S/D or arrows move, mouse looks (click to lock the pointer, or drag), Q/E down/up, Space or Shift to boost, F or Esc to exit.
- **Phone:** one finger orbits, pinch zooms, tap a planet. Flight: the left stick moves, drag anywhere else to steer, and you hold Up/Down/Boost.

## Landing and walking
Fly close to **Mercury, Venus, Earth, the Moon or Mars**. A **🛬 Land** button appears (or press **L**). Each world has its own procedural terrain, sky and gravity: grey cratered Moon with Earth in the sky, red Mars with a rover, orange-fogged Venus, and green Earth with water and trees. The Sun and gas giants tell you why you can't land.
- **Desktop:** W/A/S/D walk, mouse looks (click to lock, or drag), Space jumps, Shift runs, click or aim the crosshair at objects for facts, T takes off.
- **Phone:** the left stick walks, drag to look, hold Jump/Run, tap objects for facts, and tap 🚀 Take off to return to space.

## v5: explore more
- **Land button:** it's always visible while you fly. If you're far from a world, it puts the autopilot on the nearest one. Planet cards have a "Land here" button.
- **Camera:** first person, third person and aerial views. Tap the 👁 pill or press V. Pinch or use the mouse wheel to zoom out up to about 320 m. Fog and draw distance open up as you zoom out.
- **Discoveries:** 23 real sites and features across the Moon, Mars, Venus, Mercury and Earth. Gold beacons show what's left to find and turn green once found. The Discoveries log keeps the facts and saves in your browser.
- **Starship:** a stylized steel ship with heat tiles and flaps. You fly it in space and it stands on landing legs on the surface.
- **Rover:** a six-wheeled pressurized rover. Press Drive or E, steer with the stick or WASD, and hold Boost or Shift. It follows the terrain and gets big hops in low gravity.
- **Frankie the French bulldog:** follows you, rides in the rover, sits when you stop and sniffs toward undiscovered signals. Pet him with the button or P. He wears a helmet away from Earth. You can rename him in the log.

## Running locally
It uses ES modules, so you need a local server: `python3 -m http.server` then open http://localhost:8000/.

## Credits
- Planet, Moon, Sun, ring and Milky Way textures © [Solar System Scope](https://www.solarsystemscope.com/textures/) (INOVE), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), downloaded from Wikimedia Commons. The `textures/1k/` copies are downscaled versions for phones.
- [three.js](https://threejs.org) r169 (MIT), vendored in `vendor/three/`.
