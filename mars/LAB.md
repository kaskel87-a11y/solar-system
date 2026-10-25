# The Vat House: contraband production in Red Tape Flats (`mars/lab.js`, `window.SSX.lab`)

This is a pure game abstraction: buy supply crates, hire a crew, wait in real time, then collect units of the fictional products that `SSX.contraband` already sells (Glow-dust, Low-G, Red Static). There are no real substances, equipment or steps. The flavour is only the vats, the reactor hum and "the batch".

The feature is a single module loaded from one `<script type="module">` line in `index.html`. It also has an import-map entry (from `tools/importmap.py 7.5.2`) and one line in the `sw.js` precache. No core files were changed and the version was not bumped.

## Where it is
| Situation | Site | Door (AJ-relative) |
|---|---|---|
| `SSX.base` present (Ben's mars-base PR) | Fitted out on Ben's **Flats Scrap Lot** (`flats-scrap`). You buy the lot through `SSX.base.buy()` (900), then pay a 600 fit-out. | `[-180, -52]`, just outside the lot's 20 m grid. Raids centre on the lot, so Ben's turrets arm. |
| No `SSX.base` (main today) | A standalone Vat House you buy for 1400. | `[-330, 12]`, inside Red Tape Flats (`districtAt` gives `red-tape-flats`) and clear of roads, Blue, Rusk, turf flags and R2R doors. |

Once you've bought it, the site is saved, so it doesn't move if `SSX.base` turns up later.

You get there in three ways:
- the white beacon with its **🛢️ VAT HOUSE** label, whose context button reads "🛢️ Vat House" within 6 m;
- ☰ → **🛢️ Vat House**;
- the **[** key (BracketLeft; it was free on main and on every open branch).

When `#ssxDock` exists, a 🛢️ Lab button is attached to it (guarded: the lab never creates the dock). The HUD only shows a chip during a raid.

## Loop
- **Supplies:** a crate costs 110 cr and makes one batch. You can rack 6, 10, 16 or 24 crates depending on the capacity level.
- **Products:**

  | Product | Units per crate | Batch time | Heat per unit | Needs |
  |---|---|---|---|---|
  | Glow-dust | 4 | 90 s | 1.2 | — |
  | Low-G | 6 | 70 s | 0.8 | — |
  | Red Static | 2 | 150 s | 2.5 | purity 1 |

- **Cook:** without a cook, the vats only run while you're within 26 m, at half speed. With a cook they run all the time, including offline.
- **Offline catch-up:** capped at 4 h, the same as turf income. Runner sales and paydays are replayed in order.
- **Locker:** holds 24, 40, 64 or 100 units depending on capacity. `collect()` moves product into `SSX.contraband`'s stash with `add(item, qty, fresh)`, which respects the 20-unit carry limit and each item's max. Anything that doesn't fit **stays in the locker**. Collected product is normal stash product, so it works for selling and barter.
- **Upgrades:** each has 3 levels. A lost raid can damage one, which makes it work a level lower until you repair it for 40% of that level's price.

  | Upgrade | Effect per level |
  |---|---|
  | capacity | supply racks and locker size |
  | purity | freshness of collected product (0.75 → 0.85 → 0.95 → 1; this feeds `buyerPrice`'s fresh multiplier) and runner price ×1 → ×1.1 → ×1.25 → ×1.4. Level 1 unlocks Red Static. Level 2 adds the **brick press**: on collect, every 10 Glow-dust becomes one `glow_dust_brick` (the existing barter.json item), which you can toggle. |
  | speed | batch time ×0.8 → ×0.65 → ×0.5 |
  | security | raid odds and losses down. At level 2 the cameras warn you early (90 s instead of 60 s). |

- **Crew:** wages are paid every 10 min, from the till first and then your wallet.

  | Role | Name | Hire | Wage per 10 min | Job |
  |---|---|---|---|---|
  | cook | Pipes | 60 | 30 | runs the vats while you're away |
  | guard | Tuli Brickhand | 50 | 25 | lower raid odds, a smaller last wave, +0.2 defence when raided while you're away |
  | runner | Skitter | 40 | 20 | every 2 min sells 40% of the biggest stack (up to 6 units) at the Flats `buyerPrice` × purity, keeps 25%, and puts the rest in the till |

  After 2 unpaid paydays the crew start skimming: the cook takes a quarter of each batch, the runner keeps half, and the guard naps. After 4 unpaid paydays they quit. "Pay back wages" settles what's owed.

## Risk
- **Heat (0–100):**
  - Builds with every unit made (halved by a live **Rusk patrol sheet** from `SSX.bribes`) and with runner sales.
  - Cools by 1.5 per minute, or 3 per minute with the patrol sheet.
  - **Lay low** pauses the vats for 3 min and removes 30 heat.
  - **Grease the beat** costs about 1.2× heat in credits (at least 60), removes 40 heat and gives +1 `colsec_dirty` rep when `SSX.rep` is loaded. It also calls off a ColSec raid that's still in its alert phase.
- **Raid rolls:** made every 2 min while you're on Mars and the lab has stock.
  - ColSec raids start at heat 55 or more.
  - Rival raids come from whichever Flats crew likes you least (`SSX.rep.get`; Saltblood if rep isn't loaded). The odds rise with negative rep and a full locker.
- **Warnings:**
  - ColSec raids are announced 90 s ahead if you have a patrol sheet or security level 2; otherwise you get 60 s.
  - Laying low during a warned ColSec alert cancels the raid.
- **If you get there:** you fight it.
  - The fight goes through `SSX.raids.start()` when Steve's engine is present (one raid at a time; if it refuses, the lab runs its own waves).
  - Otherwise turf-style waves spawn through `SSX.city.hostiles` / `game.hostiles` with `src: 'lab'`.
  - A ColSec fight also sets wanted to 2.
- **If you don't get there:** the raid auto-resolves on your defence: 0.2 + security + 0.2 for a paid guard + 0.05 per Ben turret on the lot, clamped to 0.1–0.85.
- **Losing a raid:**
  - you lose 20–70% of the locker (less with security and a guard) and half that share of your supplies;
  - one upgrade is damaged;
  - the vats are down for 2 min;
  - a ColSec loss also takes half the till.
- **Winning a raid:**
  - you get credits and XP when you fought it;
  - a ColSec win removes 35 heat;
  - a gang win costs −2 rep with that crew, because they're sore.

## API (`window.SSX.lab`)
```
status()            { owned, site, at, product, products, supplies, supplyMax, batch:{pct, secLeft, running, why},
                      locker, lockerUsed, lockerMax, till, heat, upgrades:{id:{level, damaged, next}},
                      crew:{role:{hired, owed, mood}}, raid, downtime, perHour, defence, turrets, stats }
buy(opts?)          buySupplies(n)   setProduct(id)   upgrade(id)   repair(id)
hire(role)          fire(role)       payCrew()        collect(opts?)   layLow()   greaseBeat()
on(event, fn) | on(fn) -> unsubscribe      open() / close()
debug: goto, advance(sec), heat(n), raid(kind, gang?), arrive, clearWave, resolve(win), grant, sale, payday, reset, state, engine
```
- `buy` and `collect` must happen at the door; pass `{force:true}` for scripts.
- **Events:** buy supplies batch collect sale payday skim quit hire fire upgrade repair product heat warn raid wave raid:win raid:lose laylow grease catchup change. They also fire as the window event `ssx:lab` and as `SSX.emit('lab:<type>')`.
- **Persistence:** localStorage `ssx.lab.v1`.

## Notes for other builders
- **Ben (mars-base):** your stash (credits/medkits) is untouched, and the lab's product lives in its own locker.
  - The lab only reads `SSX.base.state('flats-scrap')`, `plots()` and `buy()`.
  - If you add a piece registry, the Vat House could become a 2×2 piece. The door offset is `BASE_DOOR`.
- **Steve (R2R / raids):**
  - Lab raids use `SSX.raids.start({pos, radius:26, attackers, waves, onWin, onLose})` and listen to `raid:wave`.
  - For net worth, R2R could add `SSX.lab.status().lockerUsed` × price.
  - The lab doesn't touch `ssx.r2r.v1` or the R2R properties.
- **Contraband:** there's no quality price hook yet. Purity works through `fresh` and the brick press. If `buyerPrice` gets a modifier list (as in PR #18's `modMult`), a lab-quality modifier would slot in there.
- **Bribes / rep:** both are read through optional chaining only.

Test: `BASE=http://127.0.0.1:8882/ [BR=webkit DEV="iPhone 14"] OUT=./shots/lab/ node tests/test-lab.js`.
