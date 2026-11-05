# Mars pursuit (`mars/pursuit.js`, `window.SSX.pursuit`)

A GTA-style wanted chase that sits on top of the security core in `world.js`. It adds **no second heat counter**:
`world.wanted` (0-5, raised by `world.crime()`) is the only source of stars. Pursuit reads it, layers extra units
on top of the core dispatch, and lowers it through `world.setWanted()` when you shake the chase.

Hooked with one `<script type="module">` line in `index.html` (after `mars/jobs.js`) and ticked through
`SSX.registerSurfaceTick`. It only runs on Mars. Not to be confused with the root `pursuit.js` (street chases such as
gangs and getaways), which is a separate module.

## v7.5.28: cops calm down (`copcore.js`)
- **Taking a car is not a police matter.** Parked, traffic (carjack), the magnet-crane lift, Lou's crane, the Raccoon Rover
  and skipping Lou's Hook & Crook fee give **0★**; the owner shouts / runs. Exceptions: a ColSec officer or guard within
  **12 m with line of sight** gives 1★ (only if you were clean), and boosting a marked ColSec cruiser is 2★.
- Minor crimes on top of existing heat (hit-and-run, speeding, tagging, discharging, ...) need 2 in a row per extra star.
  Serious crimes (shooting / killing, heists, dealing in view, armored transports) escalate exactly as before.
- 1★: one slower drone, no pursuit rovers, highway cruisers only join from 2★, a longer grab before a bust (3.5 s on
  foot / 5 s in a car). Out of sight at 1-2★ cools off even in town; evade needs `4 + 2·★` s (was `5 + 2.5·★`).

## Tiers
| ★ | core (`world.js`, unchanged) | pursuit adds |
|---|---|---|
| 1 | 1 slow drone (v7.5.28: a nuisance, not a chase) | nothing |
| 2 | + buggies, officers | 2 rovers (1 on mobile) |
| 3 | | drone **spotlights**: a cone and pool under each core drone/gunship; the pool spots you |
| 4 | + heavies | **roadblocks**: 2 buggies plus barriers at the nearest Beltway checkpoint and the lane ahead |
| 5 | + gunship | armoured **SWAT** rovers (2, 1 on mobile) that fire hitscan rounds |

Rovers chase with a lead, **PIT** you from the rear quarter at speed, **ram** on contact, and **box you in**. If you are
stopped with 2+ units within 7.5 m for 3 s, they call `game.bust()`. Stuck units re-dispatch, and units more than 260 m
away are dropped. All units are cheap buggy meshes, with NaN guards on every step.

## Line of sight, search and losing heat
- Every 0.25 s each unit checks `world.lineOfSight`. While anyone sees you, the heat holds.
- When sight breaks, a **search** starts at your last-seen point. It lasts `6 + 4·★` s (v7.5.28, was `8 + 5·★`), covers a radius of `25 + 10·★` m,
  and shows as a yellow ring on the minimap (`pursuit:search`) and as `🔎 SEARCH Ns` in the HUD. Being re-spotted cancels it.
  When it expires, stars go to 0.
- **Hideouts** (white minimap dots): a Flats storm culvert, a Flats gutted silo, two Beltway underpasses, the lab
  (`SSX.lab`, when owned) and the turf HQ (`SSX.turf`, when you hold it). Stay unseen and still for 3 s to drop to 0.
- **Spray shops** (purple): Dust Devil Respray (Flats) and Red Static Paint & Panel (Olympus Row). Drive in unseen and
  tap **Respray** (52 px). It costs 60 + 40·★ cr, gives a new plate and drops you to 0★ (★4-5: −2★ plus a half-length
  search). If `SSX.garage.respray()` exists, it is called as well.
- **Bribes**: no new UI. A `ssx:bribe` paid or record event from `SSX.bribes` ends the pursuit, or partly reduces it.

## Busted, wasted and safety
- Penalties stay on the core path only. `game:down` busted or killed and then `game:respawn` charge the core fee
  (busted: max(50, 15%); killed: 10%), and contraband.js seizes the stash (all of it when busted, half when killed).
  Pursuit only emits `busted`, `wasted` and `outcome {fee}`, so nothing is charged twice.
- **The Rust Pit is never fired into.** Within 12 m of the pit, or whenever `world.inDuel` or `SSX.fight.debug.inCage`
  applies, units hold a ring outside and never ram, PIT, box or shoot. (The core's own security is not ours to gate.)
- **Zero-G**: a car more than 4 m above the ground (or `SSX.gravity.floating/isFloating/zeroG`) is safe. Units circle
  below and wait.

## API
`heat() tier() units() seen() searching() hideouts() sprays() plate() roadblocks() lose(how) on([event,] fn) inPit() stats() spike(amount, reason) addHeat(amount, reason) spikes()`.
`lose('hideout'|'repaint'|'bribe')` returns `{ ok, msg }`. Events go to `on()`, to `window` `ssx:pursuit`, and to the SSX bus as
`pursuit:<type>`: tier, dispatch, spotted, search, lost, hideout, repaint, ram, pit, boxed, roadblock, shot, busted, wasted, outcome, spike.

### `spike(amount, reason)` / `addHeat(amount, reason)`
For other modules (Beltway convoys, carjacking and tolls in #49) that want to raise heat without their own wanted logic.
- Raises stars by `amount` (rounded, default 1) through `world.setWanted(min(5, stars + amount), reason)`, so world.js is still the single source of heat and its dispatch and HUD react as usual. It bypasses `world.crime()`'s 2.5 s cooldown.
- Clamped to 5. `amount <= 0`, off Mars or no player is a no-op: `{ ok: false, why: 'off' }`.
- **No-op in the Rust Pit** (within 12 m): `{ ok: false, why: 'pit' }`, and heat doesn't change.
- Returns `{ ok: true, amount, from, to, reason, t, stars }`, records the reason (last 20 in `spikes()`), and emits `spike` (`on()`, `ssx:pursuit`, `pursuit:spike`).
- Guarded use: `window.SSX?.pursuit?.spike?.(1, 'toll evasion')`.

`debug`: `setHeat(n)`, `los(true|false|null)`, `expire()`, `sync()`, `goto(id|'pit')`, `box()`, `volley(n, dmg)`, `float(h, sec)`, `state()`, `reset()`.

## Try it
Commit a crime on Mars (or run `SSX.pursuit.debug.setHeat(4)`), break line of sight behind a building, then make for
a hideout or a spray shop.

Test: `BASE=http://127.0.0.1:8889/ BR=webkit DEV="iPhone 14" OUT=./shots/pursuit/ node tests/test-pursuit.js`
(desktop: omit BR/DEV). Run one browser at a time.
