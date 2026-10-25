# Cinematic Universe Explorer

Interactive Three.js solar system: drag to orbit, scroll/pinch to zoom, tap or click a planet (or use the planet bar) for facts, and press **F** or tap **🚀 Fly** to pilot a rocket.

Live: https://kaskel87-a11y.github.io/solar-system/

## Controls
- **Desktop:** drag to orbit, scroll to zoom, click a planet. Flight: W/A/S/D or arrows move, mouse looks (click to lock the pointer, or drag), Q/E down/up, Space or Shift to boost, F or Esc to exit.
- **Phone:** one finger orbits, pinch zooms, tap a planet. Flight: the left stick moves, drag anywhere else to steer, and you hold Up/Down/Boost.

## Running locally
It uses ES modules, so you need a local server: `python3 -m http.server` then open http://localhost:8000/.

## Credits
- Planet, Moon, Sun, ring and Milky Way textures © [Solar System Scope](https://www.solarsystemscope.com/textures/) (INOVE), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), downloaded from Wikimedia Commons. The `textures/1k/` copies are downscaled versions for phones.
- [three.js](https://threejs.org) r169 (MIT), vendored in `vendor/three/`.
