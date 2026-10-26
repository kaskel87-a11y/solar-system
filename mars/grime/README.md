# Grime pass (Mars)

Loaded by one line in `index.html` (after the mars-audio import): `import('./mars/grime.js')…initGrime(window.__app)`.

* `mars/grime.js` builds the config, the per-district bake (decals, trash, shanties, barrels, vents, wires, neon, Beltway underpasses), the film look, the panel and the API.
* `mars/grime-tex.js` holds the procedural textures.
* `mars/grime-lines.js` holds the barks plus the PIRATE 66.6 station.
* `mars/grime-street.js` runs the street encounters: camps, panhandlers, hustlers, a yeller, shovers and pickpockets. Muggings belong to street danger (`SSX.danger`, danger.js). Its director rolls them, and a forced grime mugging is handed to it via `SSX.danger.startMugging(opts)` (falls back to `__danger.force`, then the local mugger if it refuses or is missing); the busy check uses `SSX.danger.isMugging()` / `mugging.phase`, then `__danger.state.mug`. The grime mugger only runs as a fallback when danger.js isn't loaded.

## In game
* **☰ → 🧱 Grime & grain** sets the level (off / light / med / max), the film pass (off / lite / full) and street hassle on or off. Settings are saved to `localStorage['ssx.grime.v1']`.
* Walk Red Tape Flats, especially at night (`SSX.time.isNight()` when it exists, otherwise the real clock), to see camps, burn barrels and the street hassle. Olympus Row is medium. Helios Heights only gets grime on its edges.
* Tune the radio to **PIRATE 66.6**.

## API (`window.SSX.grime`)
```js
SSX.grime.setLevel('off'|'light'|'med'|'max'|0..1.5); SSX.grime.level      // getter
SSX.grime.enable(); SSX.grime.disable(); SSX.grime.enabled                  // getter
SSX.grime.setPost('off'|'lite'|'full')
SSX.grime.district('mars-rough', { grime: 1.2, neon: 0.5, fog: null }) // override; pass null to reset
SSX.grime.rebuild(); SSX.grime.stats(); SSX.grime.openPanel(); SSX.grime.config
SSX.grime.street.setDensity(0..3); .density(); .enable(); .disable(); .enabled()
SSX.grime.street.setNight(true|false|null)  // null = SSX.time.isNight(), else the real clock
SSX.grime.street.trigger('panhandler'|'hustler'|'yeller'|'shover'|'pickpocket'|'mugger', { near: true })  // 'mugger' -> SSX.danger mugging when danger.js is loaded ({ local: true } forces the fallback)
SSX.grime.street.actors(); SSX.grime.street.stats()
```
On phones the defaults are the med tier, the lite film pass, a 512 atlas, no MSAA, no fire light and a street pool of 3.

## Colliders (PR #44)

Solid grime props register with `SSX.colliders` when it exists. Every call is guarded, so they do nothing without #44.
* `{type:'box', x, z, hx, hz, yaw?, group:'grime'}`: shanties, shopping carts, the rotting sofa, the burnt-out hauler, Beltway overpass pillars and jersey barriers.
* `{type:'cyl', x, z, r, group:'grime'}`: tents (r ≈ 0.85), burn barrels (0.35), junk piles of 2+ bags (0.8).
* Non-solid: all decals, litter, single bags, cans, tyres, tarps, mattresses, sleepers and power lines.
* Grime re-syncs the whole group, `removeGroup('grime')` and then re-adding every built district, whenever a district builds, streams out, rebuilds or `disable()` runs. If `SSX.colliders` isn't there yet, it keeps checking each frame (and on a `colliders:ready` window event) and registers once #44 loads.
* `SSX.grime.stats()` reports `colliders` and `collidersPer`. Typical counts per district: Red Tape Flats ≈120 desktop max / 74 phone med, Beltway ≈25 / 19, Ares Junction ≈10 / 7, Olympus Row ≈23 / 15, Helios Heights 0.
