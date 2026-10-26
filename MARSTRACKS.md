# Mars street circuits (Pumpkin add-on)

Race tracks for the v7.5 Mars city, built on Chief of Staff's v7.4 race system (`race.js`, `racecore.js`, `trackbuilder.js`)
rather than a new one. Depends on PR #7 (`carmeet.js`, the car meets).

## What you get

| Track | District | Shape | Gates | Lap | Par (rival) | Purse |
|---|---|---|---|---|---|---|
| Junction Ring | Ares Junction | ring road round the colony fence, 3 laps | 15 | ~400 m | 27 s | 160 |
| Precinct Loop | Olympus Row | tight west-side streets past the precinct, 3 laps | 10 | ~215 m | 17 s | 170 |
| Red Tape Scramble | Red Tape Flats | Flats ring road round the shanty blocks, 2 laps | 14 | ~390 m | 26 s | 180 |
| Helios Crescent | Helios Heights | round the private estates, 2 laps | 17 | ~400 m | 27 s | 220 |
| Ares Beltway Run | the Beltway | one lap of the whole Ares Beltway | 23 | ~1.9 km | 94 s | 400 |

* They are plain race.js presets (pushed into `racecore.PRESETS` at load). Everything race.js already does works on them:
  the idle start arch and 🏁 Race button, the Races panel, best laps, ghosts, the buy-in, and the builder's 📂 Tracks list
  (open one, copy it, edit it, save your own version).
* Checkpoints follow the roads. The district circuits run on ring streets this add-on paints onto Mars: asphalt, a centre dash
  and red kerbs, one merged ribbon per street. The Beltway Run runs on the Beltway, plus a link round the east side of Olympus
  Row and a slip road past the Helios private gate.
* Every racing line is checked against the real city colliders (`world.solidAt`) in the Playwright test, and against
  blocks, domes, parked vehicles, crates, lots and the checkpoint booths in the unit test.
* The district circuits stay clear of the Beltway checkpoints, so there are no tolls mid-race. The Beltway Run goes through
  the two ColSec checkpoints (Ridge and East). Clean drivers are waved through; wanted drivers pick up a star, as normal.

## Builder road snap (Mars only)

On Mars, a builder tap places a 🚩 gate, ⛰ ramp or ⚡ boost pad on the nearest road centreline within 36 m: the painted streets
or the Beltway (but not the Beltway inside district cores, where it has no asphalt). 🧱 barriers are never snapped, so
chicanes still work. Dragging an item stays free, which is your manual override.
A **🧲 Roads** chip under the builder's top bar turns snapping off and on. The setting is saved in `localStorage['ssx.marstracks.snap']`.

## Checkpoint sanity (no unreachable gates)

No checkpoint may sit inside a building, a dome or an interior's footprint, or on ground too steep to drive (a slope over 0.55).
This came out of Blue Lights gate 4 inside Olympus Row. That race is Chief of Staff's, so it's left alone here.

* **Presets:** on the first Mars frame, each preset is checked against the real colliders (`world.solidAt`, plus `camBlocked`
  so a dome's whole volume counts) and the terrain. A bad gate moves to the nearest clear road point whose legs in and out
  are drivable. If there's none, the gate is dropped. Fixes are logged and kept in `__marstracks.gateFixes`, which is empty
  today.
* **Builder taps (🚩 gates):** with snap on, the tap goes to the nearest *clear* road point. With snap off, a tap inside a
  building moves to clear ground within 12 m. If there's nowhere clear, the tap is refused with a toast: the hook returns `false`.
* `marstrackcore.js` has `gateIssue`, `moveGate`, `legPoints`/`legBlock` (the same Catmull-Rom line race.js drives),
  `sanitizeGates` and `snapTap`. The unit test checks that every preset gate is clear and on a road, and can be reached
  from the gate before it. It also replays the bug: a gate buried in The Static gets moved and is reachable both ways.

## Car meets: circuit races

The meet challenge sheet (PR #7) now has a track row: **🛣 ¼ mile drag** (still the default), the Mars presets, and your
saved Mars tracks (💾). Pick one, pick a wager (No bet / 50 / 100 / 250 / 500), then tap 🏁 Race them. The flow:

* You both grid up at the track's start line (race.js holds the car on the grid).
* The meet car's driver is the rival. Their pace comes from that car's stats (a share of its boost top speed, more on long
  straights) and their skill, so a Phobos Phantom is much harder than a dune buggy.
* Your wager is escrowed and matched. Purse = both stakes + 30 + distance money (up to 150).
* Rep is a bit more than a drag (`circuitRep`).
* Quitting or failing loses the stake, the same as a drag.
* **Night:** meets follow Steve's day/night cycle when `SSX.time.isNight()` exists (checked as `SSX.time?.isNight?.()`).
  Meets run only at night, the local lot darkening is skipped (his cycle does the lighting), and the hub hides ⏩ Kill time
  till dark. Without it, the PR #7 colony clock (21:00 to 03:00) and its local darkening still apply.

## Wiring

* `marstrackcore.js`: pure data and maths. Presets, streets, road network, snapping, meet pace and def. No THREE or DOM.
* `marstracks.js`: the runtime. Pushes the presets, paints the streets, sets `globalThis.SSX_TRACK_SNAP`, adds the 🧲 chip,
  provides `meetTracks()` / `meetCircuitDef()`, and exposes `SSX.marsTracks` (`presets()`, `streets()`, `snap(x,z)`, `snapOn`,
  `setSnap(on)`, `meetTracks()`). It runs from `window.SSX_TICKS`. Debug: `window.__marstracks`.
* `carmeet.js` (PR #7): imports marstracks.js and adds the track picker, `startCircuit`, and circuit settle and rep.
* **Shared-file hooks:**
  * `trackbuilder.js` `place()`: one line that asks `globalThis.SSX_TRACK_SNAP?.(planet, point, tool)`. It returns a point,
    `null` to keep the tap point, or `false` to refuse the tap.
  * `index.html`: only the import-map entries for the two new modules, regenerated by `python3 tools/importmap.py`.
* Imports are plain relative paths, matching main (v7.5.3) and its import map. `sw.js` is not touched. Its precache is optional,
  so the new modules cache on first load.

## Tests

* `node tests/test-marstracks-unit.mjs`: covers preset shape and race.js rules, clearance against the city layout, gates on
  roads, checkpoints, the network and snapping, and the meet circuit maths.
* `tests/run-marstracks.sh`: runs the unit test, then `tests/test-marstracks.js` at 375x667, 393x852 and 430x932 in WebKit
  and Chromium, plus desktop Chromium, one browser at a time. Screenshots go to `SHOTS_DIR` (default `shots/` in the checkout).
  On touch devices, the game-screen taps are made with a second finger held on `#joy`.
