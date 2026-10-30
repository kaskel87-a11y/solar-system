# Ares Beltway highway crime (mars/beltway.js)

v7.5.2 Marsmania add-on with one `<script type="module">` hook in index.html, plus import-map and precache entries. It adds four
crime activities on the **existing** Ares Beltway. It doesn't add a traffic system, road or checkpoint of its own. It rides what
`world.js registerHighway` already gives us:

| Core system | How the Beltway uses it |
|---|---|
| Lane traffic (`updateTraffic`, haulers/buggies/hoverbikes) | Convoy and armored targets are **live traffic haulers**. Found via `world.debug.traffic()` + `world.nearVehicle()`, tagged `v.__belt`. Ram hits are read off the core crash (`traffic.wreck`). Disabled = `wreck` held high so it stops in lane. Released on finish/quit. Carjacking the target (core `take()`) counts as stealing the whole rig. |
| Checkpoints (`world.highway().checkpoints`) | Shakedowns target the real four booths (cp-ridge / cp-east ColSec, cp-helios Helios private, cp-flats Saltblood). The core toll/scan still runs as you roll up. |
| Wanted (`world.setWanted`, `crime`) | Hijack 1★ (plus `crime` if witnessed), armored 4★ (3★ with Wren), shakedowns 2★+ or a gang wave. |
| Street racing (Pumpkin's `race.js` via `window.__race.start(def)`) | The night race is a race.js sprint def (`beltway-night-run`, 9 gates down the Beltway): countdown, rival Vesper Kade, buy-in/purse, best time all come from race.js. If `__race` is missing, it falls back to a built-in gate sprint. |
| `SSX.contraband` (guarded) | Fence choice "keep it for the street" calls `SSX.contraband.add(item, qty)` (hot_plates / salvage / cold_cell / red_dust_whiskey from barter.json). Without contraband, it's credits only. |
| `SSX.city.hostiles`, `SSX.minimap.addMarks`, `SSX.height`, `SSX.time.isNight` | All feature-detected. |

## Activities and how to trigger them
Open the panel with **O**, ☰ **🛣️ Beltway**, or the phone dock button **🛣️ Belt** (attached to the shared `#ssxDock` from mars/turf.js, v7.5.3+; Beltway never creates a dock, so without turf the ☰ menu item is the phone route). The context action is **I**, or the black button on
the left at 54% height, which shows only when the action works. The HUD bar has **Quit**.

1. **🚚 Convoy hijack** (`start('hijack')`): get near the Beltway. The nearest traffic hauler within 190 m is marked (beacon + minimap).
   Ram it (34 per crash) or shoot it (100 HP), or carjack it outright. When it's dead in the lane, go on foot and **I: Grab the crates**.
   Drive to Kettle's lot (west edge of Red Tape Flats) and pick 💵 cash (200-260 cr) or 🎒 stash (contraband + a 25% fee).
   Timers: scout 2:00, chase 2:00, deliver 4:00.
2. **🛡️ Armored transport** (`start('armored')`): same lane hunt, but 220 HP, and it speeds up unless Dex is on the crew. The first hit gives 2★.
   Once it's stopped you get 4★ and two ColSec guards. **I: Crack the doors** takes 5 s (2 s with Wren). Then lose the heat within 4:00.
   Payout is 1200 cr gross, split with the crew picked in the panel:
   - Dex "Clutch" Varga, wheelman, 15%
   - Ivo Mardle, muscle, 20%, +60% damage
   - Wren Okafor-Sato, splicer, 10%, fast crack, 3★
3. **💢 Toll shakedown** (`start('shakedown', { checkpoint })`): defaults to the nearest booth. Go on foot within 12 m and press
   **I** 3× to lean on them. Payouts: ColSec 100-160 cr and +2★; Helios 220-300 cr, 2★ and guards+drone; Saltblood 140-200 cr and a
   thug wave. Each booth cools down for 8 min.
4. **🏁 Night street race** (`start('race')`): after dark only. Ares Junction south → ridge (through the ColSec speed trap) → Olympus
   Row → East cut, against Vesper Kade. Winning adds 1★ for an illegal race.

## API: `window.SSX.beltway`
`start(type, opts)`, `stop()`, `active()`, `on(event, fn)` / `on(fn)`, `open()`, `close()`, `crew()`, `setCrew(id, on)`, `split()`,
`fence(choice)`, `isNight()`, `nightIn()`, `waitForDark()`, `raceDef()`, `stats()`, `activities`.

Events: `start target hit disabled cargo fenced loot payout shakedown race fail stop change`. Each one is also sent as window `ssx:beltway`
and `SSX.emit('beltway:<ev>')`.

`debug`: `toRoad(s)`, `target()`, `haulers()`, `disable()`, `hit(n)`, `toTarget()`, `toFence()`, `toCheckpoint(id)`, `finishCrack()`,
`clearHeat()`, `setNight(bool)`, `finishRace(won)`, `state()`, `reset()`.

Persistence: localStorage `ssx.beltway.v1` (crew, booth cooldowns, stats, sol-clock offset).

## Gaps / notes for other bots
- **No day/night cycle on main.** The Beltway keeps a sol clock: 20 real minutes per sol, night for the last 40%, and the panel has
  🌙 "Wait for dark". If someone ships `SSX.time.isNight()`, the Beltway uses that instead.
- **No public race API.** race.js only exposes the test/debug object `window.__race`; `start(def)` accepts a def object, which is
  what we use. A `SSX.race.start(def)` / `on('finish')` would be nicer, since we currently poll `__race.state` / `__race.result`.
- **Traffic has no public accessor.** We use `world.debug.traffic()` + `world.nearVehicle()`. A `world.traffic()` that returns live
  objects, or `world.trafficAt(x, z)`, would remove the debug dependency. No hauler HP exists in core, so the Beltway keeps its own.
- **Key G is used by both heist.js and mars/jobs.js** (both contextual), which other bots should check. The Beltway uses free keys **O** / **I**.
- Phone layout: the HUD sits at top 244px (desktop 166px), below the jobs and turf HUDs. The action button is at left 54%, and the 🛣️ Belt button has order 4 on `#ssxDock` (attach-only, waits for turf.js to create the dock).
