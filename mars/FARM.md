# Mars farming (`mars/farm.js`, `window.SSX.farm`)

Fiction only. You buy a plot outside the city, put up a greenhouse dome, add hydroponic racks and grow crops over game
time. Upkeep is water and power. Dust storms do damage. You harvest into a silo, sell at an alien trading post, and raiders
come for a full silo.

Files: `mars/farm.js` (scene, UI, integration), `mars/farmcore.js` (pure rules, no DOM or three), `tests/test-farm-unit.mjs`,
`tests/test-farm.js` (Playwright e2e). Wiring: one script tag in `index.html`, one `sw.js` PRECACHE line, and the importmap via
`tools/importmap.py`. No other module is edited.

## Places (Ares Junction coords, x east / z south)
- **Dustbowl Homestead**: AJ [-60, 250], r 14. A fenced plot with a water tank, a solar mast, the dome (`farm-dome`) and racks.
- **Xen-7 Trading Post**: AJ [30, 300], r 10. A landing pad, an obelisk, and three alien buyers under a canopy.
- Minimap: a green ring for the farm and a purple ring for the post.

## Entry (HUD rules)
- **☰ menu → 🌱 Farm** (`rmFarm`) opens the sheet from anywhere. Away from the plot it shows one plain-word direction,
  e.g. "Go to Dustbowl Homestead (310 m south-west) and tap Farm."
- **One context button** (`#farmAct`, 52 px, black with a white border) only while you stand at the farm (🌱 Farm, or 🚨 Farm during a
  raid) or at the post (👽 Trade). It's hidden in the Rust Pit and while the car is airborne.
- There are no permanent HUD chips. Messages go to the sheet's message line when it's open, and to a single toast otherwise.
- All buttons are 48 px or taller and high contrast (disabled ones are light grey with a dashed border on black), wired through `window.__onTap`.

## Play
| Step | Cost | Notes |
|---|---|---|
| Buy the plot | 1200 cr | Comes with 40 water and 40 power |
| Build the dome | 900 cr | Needed before racks. A sound dome (≥ 60%) halves storm damage. Storms wear it down |
| Add a rack | 300 cr | Up to 6 |
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
- **Clock**: hour deltas from `SSX.time` (#30), else `SSX.empire.clock().hour` (#52), else its own clock (2 real minutes per game hour).
  `skip(h)` calls `SSX.time.set()` when present, so the world clock moves too.
- **Storm**: `SSX.storm` (#50) `active()` / `intensity()`, plus captions on `start` / `peak` / `end`. Without it there's no storm damage (`debug.storm(i)` for tests).
- **Raids**: `SSX.raids.start/stop` (main), else the own timer.
- **Contraband**: `SSX.contraband.add('glowdust')` for lichen and `add('voidhoney')` for Oru trades.
- **Base (#24)**: its plots and pieces are fixed and in-city, so the homestead isn't a base lot yet (see hooks).
- **Empire (#52)**: `income` only fires when you own fronts, so the farm uses `clock()` as an hour source instead.
- Core: `game.spend`, `game.progress.inv`, `world.setWanted`, `registerSurfaceTick`, `registerMenuItem`, `minimap.addMarks`.

## Safety
- In the Rust Pit (AJ [-292, -68], r 12) and while the car is floating (> 4 m above ground), the context button is hidden and actions
  return "Not now." or "Land first." Raids never start there.
- Mars only, and it tears down with the surface. The save is `localStorage['ssx.farm.v1']`, migrated, with offline catch-up capped at 14 days.

## API
```
SSX.farm.status()  -> { owned, dome, domeHp, racks:[{crop,growth,health,ripe}], water, power, silo, siloCount, favors, hours, day, clock, raid, at, storm, stats }
buy() buildDome() addRack() plant(i, crop) harvest('all'|i) refill('water'|'power') patch()
sell(buyerId, crop, qty) useFavor('cool') raid({waves}) skip(hours) -> { ok, via:'SSX.time'|'own' }
buyers() clock() places() open('farm'|'post') close() on(fn) CROPS PRICES
debug: goto('farm'|'post') storm(i) raidEnd('win'|'lose') noRaids(b) state() reset() reload() inPit() floating() scene()
```
Events go to `on(fn)`, to `window` as `ssx:farm`, and to `SSX.emit('farm:<type>')`. Types: buy, dome, rack, plant, ripe, harvest, refill, patch, sale,
favor, storm (phase start/peak/end/damage), raid, raid:end.

## Hooks wanted from Ben (not edited here)
1. `SSX.base.registerPlot(def)`, so the homestead can be a base lot (walls, gate and turrets defend it in raids).
2. `SSX.base.registerPiece(def)`, so the greenhouse dome and hydro racks become base pieces on that plot.
3. `SSX.empire.on('hour', fn)`, an every-game-hour tick even when you own no fronts, so growth and payouts ride the empire tick.

## Tests
`node tests/test-farm-unit.mjs`. For the e2e, serve the worktree and run
`BASE=http://127.0.0.1:<port>/ OUT=./shots/farm/ [BR=webkit DEV="iPhone 14"] node tests/test-farm.js` (one browser at a time).
