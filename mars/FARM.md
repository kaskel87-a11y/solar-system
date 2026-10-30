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

**Trading post.** Prices shift every game day (seeded by day number) between 0.85x and 1.15x of the base price:

v7.5.6 economy: a crop's base price is about 3.5x its full grow cost for one harvest on one rack. That cost is seed + the water
and power it uses + the rack's share of plot, dome and rack ((1200 + 900) / 6 + 300 = 650 cr) over 5 harvests (130 cr).
Even on a low day a full rack sells for about 3x what it cost (`growCost(crop)` in farmcore.js, checked in test-farm-unit).

| Crop | Grow cost / harvest | Yield | Base price / unit | Full rack at Vell (1.0 day) |
|---|---|---|---|---|
| Potatoes | 182 cr | 6 | 105 cr | 630 cr (3.5x) |
| Algae mats | 183.4 cr | 8 | 80 cr | 640 cr (3.5x) |
| Glow-berries | 265.6 cr | 5 | 185 cr | 925 cr (3.5x) |
| Ghost lichen | 366 cr | 4 | 320 cr | 1280 cr (3.5x) |

Oru items and Hush favors still ask the same number of crops as before (they're priced on the old per-unit `barter` value).
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
- **Raids**: SSX.raids runs one raid at a time, so before `SSX.raids.start` the farm asks for the slot:
  - It calls `SSX.empire.yieldRaid('farm')` when present (#52), else it dispatches `window` event `raid:request` `{ detail: { id } }`. The empire then hands over its rival-crew raid and keeps that fight going as a 40 s hold.
  - Then it reads `SSX.empire.raidSlot()` (`'free'|'ours'|'other'`). If the slot is `'free'` or `'ours'`, the raid goes through `SSX.raids.start`. Only if it's still `'other'` (a third add-on's raid) does the farm use its own 60 s timer.
  - `status().raid` shows `{ via, slot, asked, engineWhy }`. Without SSX.raids, or if start refuses, the farm uses its own timer.
- **Contraband**: `SSX.contraband.add('glowdust')` for lichen and `add('voidhoney')` for Oru trades.
- **Base (#24)**: the homestead is registered as a lot: `SSX.base.registerPlot({ id: 'farm-homestead', at: [10, 226], owned: () => farm owned, price, blurb })`.
  - Its ownership follows the farm's own Buy, so the lot has no base Buy button. It's registered with `build: false`, so base's 🏗️ Build button (context and overview) stays hidden there and 🌱 Farm is the one context button.
  - Right after Buy, and before each place, the farm calls `SSX.base.refresh()` (or `syncOwners()`) when present, so ownership is synced in the same frame. On an older base it re-registers the plot, and if `place()` still says "Buy the lot first" it retries once after re-registering.
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

## Taps are idempotent (no extra racks or charges)
- Every buy / build / plant / harvest / refill / patch / sell (sheet tap or API call) runs through one action guard (`makeActGuard` in farmcore):
  - a re-entrant call while another action runs is ignored (`why:'busy'`)
  - the same action key within 300 ms of its last success is ignored (`why:'debounced'`). Keys are per action, e.g. `rack`, `plant:<rack>#<pieceId>`, `sell:<buyer>:<crop>`, so different actions don't block each other, and a rack replaced in base's flow counts as a new target.
  - Duplicates return `{ ok:false, dup:true }` and charge nothing.
- Expected state is checked before charging: the rack button carries `data-n` (the rack count it saw) and sell buttons carry `data-q` (the silo count it saw). If the state moved on ("That rack is already in." / "Already sold."), nothing is charged.
- While the sheet re-renders, and for 250 ms after any change, its buttons are held (`data-hold`, disabled) and taps on stale or held buttons are ignored, so a double tap can't land on the button that replaced it.
- Base mode: Build dome adopts an existing `farm-dome` piece for free. Add rack clamps to one new rack. If `SSX.base.place` charged more than the piece cost (a doubled `onPlace` path), the excess is refunded, so each place charges once.
- Buttons stay on `window.__onTap` and 48 px+.

## Safety
- In the Rust Pit (AJ [-292, -68], r 12) and while the car is floating (> 4 m above ground), the context button is hidden and actions
  return "Not now." or "Land first." Raids never start there.
- Mars only, and it tears down with the surface. The save is `localStorage['ssx.farm.v1']`, migrated, with offline catch-up capped at 14 days.

## Save and recovery (v7.5.7 hotfix)
- The save is `ssx.farm.v1` (one key, not per slot or per version; a v7.5.5 save loads unchanged). Every owned save is mirrored to `ssx.farm.v1.bak`.
- On load the farm takes the first **owned** state from: the save, the mirror, then the homestead's record in SSX.base's save (`ssx.base.v1`
  keeps `farm-dome` / `farm-rack` pieces even after the lot synced to unowned). A farm restored from base gets its dome and racks back
  (crops on them are not known there), the tanks at 40 at least, and no charge. `status().restored` is `'backup' | 'base' | null`, and a `restore` event and one message fire on Mars.
- Never downgraded: an unowned state is never written over an owned save (only `debug.reset()` does that), and if base reports the lot `lost` while the farm owns it, the farm re-syncs it as owned.
- If storage is full, the farm drops its own mirror and retries; if that fails too it says so once (`status().saveErr`) instead of failing silently.

## API
```
SSX.farm.status()  -> { owned, dome, domeHp, racks:[{crop,growth,health,ripe}], water, power, silo, siloCount, favors, hours, day, clock, base, empire, hooks, raid, at, storm, stats }
  hooks: { base:'api'|'queued'|'old'|null, baseRegistered, lotSync:'refresh'|'syncOwners'|'reregister'|null, empire:'api'|'queued'|'old'|null, empireLive, yieldRaid, raidSlot }; clock: 'SSX.empire.hour'|'SSX.time'|'SSX.empire'|'own'; base: { plot, pieces } | 'queued'|'old'|null; empire: { hook:'api'|'queued'|'old', live, hours } | null
guide.status() guide.start() guide.hide() guide.show()
buy() buildDome() addRack() plant(i, crop) harvest('all'|i) refill('water'|'power') patch()   (a repeat within 300 ms -> { ok:false, dup:true }, no charge)
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

4. `build: false` on registerPlot (#24, 47e433a): there's no base 🏗️ Build button at the lot.
5. `SSX.base.refresh()` / `syncOwners()` (#24, 47e433a): ownership syncs in the same frame. The re-register and retry stay as the fallback.
6. `SSX.empire.yieldRaid('farm')`, or the `raid:request` event, plus `raidSlot()` (#52, a6df4a3): these share the one SSX.raids slot.

Earlier notes for Ben (two context buttons, "Buy the lot first", the busy raid slot) are all covered by 47e433a and a6df4a3.

## Tests
`node tests/test-farm-unit.mjs`. For the e2e, serve the worktree and run
`BASE=http://127.0.0.1:<port>/ OUT=./shots/farm/ [BR=webkit DEV="iPhone 14"] node tests/test-farm.js` (one browser at a time).
- `tests/test-farm.js` checks the base and empire paths when `SSX.base.registerPlot` and `SSX.empire.on` are present:
  - the lot is registered at the farm's spot
  - the pieces are at the layout cells, and the dome isn't drawn twice
  - scrapping or placing in base's flow syncs the farm
  - one SSX.time hour gives exactly one farm hour
  - inside the owned lot there's exactly one context button (🌱 Farm) and no visible 🏗️ Build
  - `lotSync` is `'refresh'` when SSX.base.refresh exists
  - raid slot: an empire raid yields via `yieldRaid` (and via `raid:request` when yieldRaid is absent), the farm raid runs on SSX.raids, and a third add-on's raid keeps the farm on its own timer
  Without those APIs, it checks the farm's own drawing and clocks.
  - idempotency: `apiTwice` (buy, dome and rack called twice: one charge each of 1200 / 900 / 300, one base piece), `tapTwice` (two taps in the same frame on buy, dome and rack, and on the button now under the finger), `tapTwiceSell` (one sale), `apiSell` (one sale, paid once)
- `test-farm-unit.mjs` fires two taps in the same frame and two API calls for buy lot, build dome, add rack and sell: each gives exactly one effect and one charge. It also covers per-key debounce, re-entry and stale expected state.
- The e2e taps no longer wait two frames. They wait (up to 1.5 s) for the sheet's `data-hold` to clear, like a person would.
- `tests/test-farm-restore.js` (WebKit iPhone 14, 393x852) seeds a v7.5.5 save (974154e: homestead, dome, 3 racks, potatoes) and checks it loads owned with its racks and no charge; then the farm save lost, unowned over a base synced to unowned (the for-sale state), broken with a mirror, `base.refresh()` + a stale unowned write (no downgrade), and that `debug.reset()` still resets. It saves `farm-restored-<tag>.png`.
- `tests/test-farm-loop.js` plays the first loop through the guide (buy → dome → rack + plant → grow → harvest → sell), including dismiss, re-enable, a reload mid-loop and done after the sale, then checks for one context button in the lot.
  It saves phone screenshots `farm-loop-<n>-<step>-<device>-<browser>.png`.
