# Mars consequences: WASTED / BUSTED (`mars/consequences.js`, `window.SSX.consequences`)

GTA-style outcomes for dying or getting arrested on Mars. All fiction, M-rated: invented places, invented people.

## One owner for the penalty

| Thing | Who owns it on Mars (outside the Rust Pit / a duel / a fight cage) | Everyone else |
|---|---|---|
| Money on respawn (core med-evac fee / ColSec fine) | **consequences** (hospital bill + lost cash; bail/bribe/fees) | `game.js` asks `SSX.consequences.ownsOutcome(why)` at respawn. `true` = core fee 0, no core radio receipt. Respawn event carries `{ why, fee, owned }`. If the hook is missing, the core charges and consequences charges nothing on top. |
| Contraband on BUSTED | **consequences**: seized synchronously on `game:down` via `SSX.contraband.remove()`, kept for a bribe | `contraband.js` sees an empty stash on its next tick, so its own `confiscate` doesn't run. |
| Contraband on WASTED | **contraband.js** (its "med-evac pockets half" rule) | consequences doesn't touch the stash. |
| Weapons on BUSTED | **consequences** (evidence locker) | core `weapon:*` unlocks always; `SSX.arsenal` guns when #46 is loaded (guarded: `arsenal.state().owned` + `saveState()`). |
| Stars / outcome events | **pursuit.js** (#42) reports them | consequences only reads `busted`/`wasted` star counts. pursuit charges nothing. |
| Rust Pit, duels, off Mars | **core flow, unchanged** | consequences stands aside (`ownsOutcome` false). |

## Triggers
- **WASTED**: any `game:down` with `why: 'killed'` on Mars. Short WASTED screen, wake up at **Helios Mercy** (Beltway approach to Helios Heights), bill = 80 + 6% of credits, plus 4% "lost in the ambulance". Weapons kept.
- **BUSTED**: `game:down` with `why: 'busted'` (includes being killed by security). BUSTED screen, booked into **Deimos Lockup** (Olympus Row, west of Colsec Downtown), +1 strike (max 5). Weapons go to the evidence locker, product is seized, the rover goes to the **ColSec Impound** if you were in it or within 80 m. A floating/airborne rover is reset to the ground in the lot.
- Ways out of the cell (booking panel):
  - **Serve time**: free. Skips the clock by `3 + 3*stars + 2*strikes` hours (halved with the lawyer). Uses `SSX.time.set()` when the day-night PR is in, otherwise its own clock offset (`clock()`).
  - **Bail**: `100 + 120*stars + 60*strikes` cr (−40% with the lawyer). Out now, no time passes.
  - **Bribe Sergeant Kade**: price from `SSX.bribes.price({kind:'spot'})` ×1.4 when #23 is in, else its own. Odds use `SSX.rep` (`colsec`, `colsec_dirty`) when #20 is in. Yes = you walk with weapons + product, −1 strike. No = +1 strike, +2 hours, no second try.
  - **Lawyer** (Odile Marsh, Esq., Marsh & Vane): cuts bail 40%, halves time, −50% evidence fee, −30% impound fee. Outside custody: a 10-minute retainer for the fees, and **clear a strike** for `220 + 60*strikes` cr.
  - **Jailbreak**: you start in the NW yard corner. Two guards walk beats with torch cones (9 m, ~35°). Reach the west service gate unseen = escape at 2★ (sneak). Get spotted = alarm, 2 hostile guards spawn, escape at 3★ (fight). +1 strike either way.
- **Evidence locker**: front desk of the Lockup, 0 stars, `50 + 30*weapons` cr. A new bust with an unclaimed lot loses the old lot.
- **Impound**: pay 150 cr at the booth (or from the legal panel), or drive it out unpaid: `world.crime(2)` and at least 2★. Walking into the lot on foot is trespass: `world.crime(1)`. Summoning the rover out of the lot snaps it back.

## API (`window.SSX.consequences`)
`ownsOutcome(why)`, `status()`, `quote()`, `serve()`, `bail()`, `bribe({force?})`, `lawyer()`, `jailbreak()`, `reclaim()`, `payImpound()`, `clearStrike()`, `clock()`, `places()`, `ledger()`, `lawyerInfo`, `open(mode?)`, `close()`, `on(type?, fn)`, `key`, `debug.*` (tests).
Events: `down, wasted, busted, booked, seized, served, bail, bribe, bribe-refused, lawyer, strike, jailbreak, spotted, released, evidence, impound, charge` via `on()`, window `ssx:consequences` and `SSX.emit('consequences:<type>')`.

## UI
- Full-screen WASTED/BUSTED card (held until the respawn, then ~1 s). Panels are black/white, 48 px buttons, `__onTap`.
- HUD pill (custody / jailbreak / evidence desk / impound booth) with a 44 px button.
- Keyboard: **`'` (Quote)** toggles the legal panel. Checked free on main and all open PR branches (#46's key map included).
- Phone: ⚖️ **Legal** on `#ssxDock` (order 6, only while there's business), ☰ "⚖️ Legal", and `SSX.phone.addContact` if a phone module exists.
- Minimap rings: hospital (red), lockup (blue), impound (yellow).

## Notes for other modules
- **Arsenal (#46)**: there is no `confiscate()`/`restore()` API, so consequences edits `state().owned` and calls `saveState()`. A real `SSX.arsenal.confiscate() -> lot` / `restore(lot)` would be cleaner.
- **Contraband**: keep the busted-confiscate rule for off-Mars / no-consequences cases. It's harmless because the stash is already empty on Mars.
- **Pursuit (#42)**: keep `fee` at 0 or informational. Don't charge in pursuit.
- **game.js hook**: one guarded line in `updateHealth`. Anything else that wants to own the outcome should go through `ownsOutcome`, not a second fee.
- Merge note: `index.html` importmap entries for `mars/arsenal.js` (#46) and `mars/consequences.js` land on neighbouring lines. Re-run `python3 tools/importmap.py <v>` after merging.

Test: `tests/test-consequences.js` (desktop + `BR=webkit DEV="iPhone 14"`).
