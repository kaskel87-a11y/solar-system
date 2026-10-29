# Mars farming (`mars/farm.js`, `window.SSX.farm`)

Fiction only. You buy a plot outside the city, put up a greenhouse dome, add hydroponic racks and grow crops over game
time. Upkeep is water and power. Dust storms do damage. You harvest into a silo, sell at an alien trading post, and raiders
come for a full silo.

Files: `mars/farm.js` (scene, UI, integration), `mars/farmcore.js` (pure rules, no DOM or three), `tests/test-farm-unit.mjs`,
`tests/test-farm.js` (Playwright e2e). Wiring: one script tag in `index.html`, one `sw.js` PRECACHE line, and the importmap via
`tools/importmap.py`. No other module is edited.

## Places (Ares Junction coords, x east / z south)
- **Dustbowl Homestead**: AJ [10, 226], r 10. It moved off the rocky [-60, 250], which had 11.5 m of relief and boulders on the plot.
  The new spot has 1.5 m of relief over the lot and no boulder bigger than 0.9 m within 11.5 m.
  It is one standard **20 × 20 m lot** (10 × 10 cells of 2 m, centred on `at`, the same grid as SSX.base #24), laid out like this:
  - the greenhouse dome (r 5.8 m) on the north 6 × 6 cells (cell 2,0)
  - six hydro racks (1 × 2 cells each) along the south row, in cells 1–3 and 6–8 of row 7, filled from the path outward
  - a path up the middle from the gate
  - the water tank and solar mast on the east and west edges, and the sign over the south gate
- **Xen-7 Trading Post**: AJ [-70, 210], r 10. It moved with the farm and is now 82 m west of it, with 3.1 m of relief over its pad and no boulders on it.
  It has a landing pad, an obelisk, and three alien buyers under a canopy.
- Minimap: a green ring for the farm and a purple ring for the post.

## Entry (HUD rules)
- **☰ menu → 🌱 Farm** (`rmFarm`) opens the sheet from anywhere. Away from the plot it shows one plain-word direction,
  e.g. "Go to Dustbowl Homestead (310 m south-west) and tap Farm."
- **One context button** (`#farmAct`, 52 px, black with a white border) only while you stand at the farm (🌱 Farm, or 🚨 Farm during a
  raid) or at the post (👽 Trade). It's hidden in the Rust Pit and while the car is airborne.
- There are no permanent HUD chips. Messages go to the sheet's message line when it's open, and to a single toast otherwise.
- All buttons are 48 px or taller and high contrast (disabled ones are light grey with a dashed border on black), wired through `window.__onTap`.

## First-loop guide (plain words, one caption)
- Opening ☰ → 🌱 Farm starts a one-line caption (`#farmGuide`, under the top bar, black with a yellow border). It shows one step at a time:
  1. Buy the Dustbowl Homestead
  2. Build a dome
  3. Plant potatoes in a hydro rack (or "Add a hydro rack, then plant potatoes")
  4. Wait for your potatoes to grow (N%)
  5. Harvest your potatoes
  6. Sell to the aliens at Xen-7 Trading Post

  When the tanks run dry, the caption becomes "Fill the water tank and charge the power cells". Away from the target, its second line gives the distance and direction. Up close, it says which button to tap.
- **Waypoint**: it follows the current step. If Snuffles' `SSX.waypoint` / `SSX.nav` / `SSX.gps` exists, the farm calls its `set` / `to` / `add` (guarded).
  Otherwise it uses a minimap mark (`farm-guide`) and a yellow world beacon over the target.
- The ✕ button (44 px) dismisses the guide, and the sheet's "Show the farm guide" button brings it back. The first sale finishes it. Its state is saved with the farm,
  and old saves that already have a sale start out finished. It adds no permanent chips: one caption, only while the loop is unfinished and not dismissed.
- API: `SSX.farm.guide.status() / start() / hide() / show()`. A `guide` event fires on each step change (`step`, `why`).

## Play
| Step | Cost | Notes |
|---|---|---|
| Buy the plot | 1200 cr | Comes with 40 water and 40 power |
| Build the dome | 900 cr | Needed before racks. With SSX.base it's a base piece (`farm-dome`). A sound dome (≥ 60%) halves storm damage. Storms wear it down |
| Add a rack | 300 cr | Up to 6. With SSX.base it's a base piece (`farm-rack`) |
| Plant | seed | Potatoes 20 (10 h), Algae mats 15 (6 h), Glow-berries 60 (14 h), Ghost lichen 120 (20 h, contraband) |
| Water / power | 2 / 3 cr a unit | Tanks hold 100. Each crop uses some per hour. When a tank is dry, crops wilt (−6 health/h) and stop growing |
| Patch the dome | 120 cr | Back to 100% |
| Harvest | free | Yield scales with health. Ghost lichen dries into **Glow-dust** in your contraband stash (if there's room), otherwise it stays in the silo |

**Trading post.** Prices shift every game day (seeded by day number):
- **Vell broker** pays cash for every crop.
- **Oru collector** pays rare items (Medkit, Coil slugs ×4, or Void Honey; the item changes by day) for Glow-berries and Algae.
- **The Hush** pays favors for Ghost lichen and Glow-berries. "ColSec loses your file" drops 2 wanted stars when you tap it. "Watchers on the farm" is
  used automatically and takes one wave off the next raid.

**Raids.** Once the silo holds 8 or more, there's a 6% chance per game hour of a raid, with an 18 h cooldown. The raid runs on `SSX.raids.start` (main).
A win pays a 120 cr bounty. A loss means the raiders take 60% of the silo. Without SSX.raids it uses its own 60 s timer: you win if you're
at the farm when the timer ends. `?farmraids=0` turns off random raids, and `raid()` still works.

## Reuse and fallbacks (all guarded; any can be missing)
- **Clock**: when `SSX.empire.on('hour')` (#52) is live, each hour event moves the farm by exactly 1 h (growth, upkeep, wilt, storms, raid roll).
  The first event, or the first catch-up burst, is only a baseline, because the farm's own clock already covered that hour.
  After that, the farm's own clock stops advancing, so nothing ticks twice. The hook is registered with `SSX.empire.on` if it exists, and otherwise queued on
  `window.SSX_pending.empire` (one path only). Without the hook, the farm takes hour deltas from `SSX.time` (#30), else `SSX.empire.clock().hour`, else its own clock (2 real minutes per game hour).
  `skip(h)` calls `SSX.time.set()` when present, so the world clock moves too. The empire hour events that this jump causes are swallowed (a skip debt, which expires after 3 s), so a skip isn't counted twice.
- **Storm**: `SSX.storm` (#50) `active()` / `intensity()`, plus captions on `start` / `peak` / `end`. Without it there's no storm damage (`debug.storm(i)` for tests).
- **Raids**: `SSX.raids.start/stop` (main), else the own timer. SSX.raids runs one raid at a time, so if another add-on's raid is active (e.g. #52's empire crew raids) the farm falls back to its own timer. `status().raid.engineWhy` says why.
- **Contraband**: `SSX.contraband.add('glowdust')` for lichen and `add('voidhoney')` for Oru trades.
- **Base (#24)**: the homestead is registered as a lot: `SSX.base.registerPlot({ id: 'farm-homestead', at: [10, 226], owned: () => farm owned, price, blurb })`.
  - Its ownership follows the farm's own Buy, so the lot has no base Buy button. Walls, gates and turrets from base's own Build flow can go on it.
  - `registerPiece` adds `farm-dome` (6 × 6, solid: false so you can walk in, max 1, 900 cr) and `farm-rack` (1 × 2, max 6, 300 cr), both limited to that lot,
    with their own parts, so base draws them.
  - In base mode, the farm's Build dome and Add rack buttons call `SSX.base.place` at the layout spot, or any free cell if that spot is taken.
    Base charges the cost and calls `onPlace`.
  - Pieces placed or scrapped in base's own Build flow join or leave the farm (`onPlace`, plus base's `remove` event).
  - An old save that already has a dome or racks gets them placed for free on first load: the farm credits the cost, then base charges it.
  - The farm draws only what base doesn't have, plus the crops, which it draws on the rack pieces.
  - If base hasn't booted, the calls are queued on `window.SSX_pending.{pieces, plots}`, and a duplicate id replaces the earlier one.
  - If there is no base, or a base without the add-on API, the farm draws and charges everything itself, with the same layout.
- Core: `game.spend`, `game.progress.inv`, `world.setWanted`, `registerSurfaceTick`, `registerMenuItem`, `minimap.addMarks`.

## Safety
- In the Rust Pit (AJ [-292, -68], r 12) and while the car is floating (> 4 m above ground), the context button is hidden and actions
  return "Not now." or "Land first." Raids never start there.
- Mars only, and it tears down with the surface. The save is `localStorage['ssx.farm.v1']`, migrated, with offline catch-up capped at 14 days.

## API
```
SSX.farm.status()  -> { owned, dome, domeHp, racks:[{crop,growth,health,ripe}], water, power, silo, siloCount, favors, hours, day, clock, base, empire, hooks, raid, at, storm, stats }
  hooks: { base:'api'|'queued'|'old'|null, baseRegistered, empire:'api'|'queued'|'old'|null, empireLive }; clock: 'SSX.empire.hour'|'SSX.time'|'SSX.empire'|'own'; base: { plot, pieces } | 'queued'|'old'|null; empire: { hook:'api'|'queued'|'old', live, hours } | null
guide.status() guide.start() guide.hide() guide.show()
buy() buildDome() addRack() plant(i, crop) harvest('all'|i) refill('water'|'power') patch()
sell(buyerId, crop, qty) useFavor('cool') raid({waves}) skip(hours) -> { ok, via:'SSX.time'|'own' }
buyers() clock() places() open('farm'|'post') close() on(fn) CROPS PRICES
debug: goto('farm'|'post') storm(i) raidEnd('win'|'lose') noRaids(b) state() reset() reload() inPit() floating() scene() ground(x,z) colony()
```
Events go to `on(fn)`, to `window` as `ssx:farm`, and to `SSX.emit('farm:<type>')`. Types: buy, dome, rack, plant, ripe, harvest, refill, patch, sale,
favor, storm (phase start/peak/end/damage), raid, raid:end, guide, base, clock.

## Ben's hooks (called, guarded; his files are not edited here)
1. `SSX.base.registerPlot` (#24): the homestead is the `farm-homestead` lot.
2. `SSX.base.registerPiece` (#24): `farm-dome` and `farm-rack`.
3. `SSX.empire.on('hour', fn)` (#52): drives growth and upkeep.

Notes for Ben:
- On a registered lot, base shows its own 🏗️ Build button, so there are two context buttons at the homestead (🌱 Farm and 🏗️ Build).
  A per-plot option to hide base's button (e.g. `build: false` or `button: false` on registerPlot) would keep the one-context-button rule.
- `place()` refuses with "Buy the lot first" until base's next frame syncs `owned()`. The farm re-registers the plot right after its own Buy to sync it at once.
  A `syncOwners()` / `refresh()` call on SSX.base would be cleaner.

## Tests
`node tests/test-farm-unit.mjs`. For the e2e, serve the worktree and run
`BASE=http://127.0.0.1:<port>/ OUT=./shots/farm/ [BR=webkit DEV="iPhone 14"] node tests/test-farm.js` (one browser at a time).
- `tests/test-farm.js` checks the base and empire paths when `SSX.base.registerPlot` and `SSX.empire.on` are present:
  - the lot is registered at the farm's spot
  - the pieces are at the layout cells, and the dome isn't drawn twice
  - scrapping or placing in base's flow syncs the farm
  - one SSX.time hour gives exactly one farm hour
  Without those APIs, it checks the farm's own drawing and clocks.
- `tests/test-farm-loop.js` plays the first loop through the guide (buy → dome → rack + plant → grow → harvest → sell), including dismiss, re-enable, a reload mid-loop and done after the sale.
  It saves phone screenshots `farm-loop-<n>-<step>-<device>-<browser>.png`.
