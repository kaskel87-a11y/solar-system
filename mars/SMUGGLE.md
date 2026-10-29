# Ship smuggling runs (Mars → Phobos → Mars)

`mars/smuggle.js` (game wiring, meshes, UI) + `mars/smugglecore.js` (pure logic, `tests/test-smuggle-unit.mjs`).
API: `window.SSX.smuggle` (`state`, `start`, `bribe`, `dump`, `payout(kind)`, `roll(dir)`, `on(fn)`), debug `window.__smuggle.debug`.

## Flow
1. **Pickup**: land on Mars and stand on the Ares Junction pad (AJ-relative [-38, 10], r 13). Tap **📦 RUN** in the shared dock
   (touch) or press **8**. Gutter Pell hands you a sealed crate. A one-line strip says `📦 Take off → Phobos`.
2. **Outbound**: take off (T / Exit). Phobos (r 1.7) circles Mars at R 58 with a white drop ring and a mast. The route lives
   in a non-rotating Mars frame; in the lane the ship gets Mars' orbital motion added so the lane stays put.
3. **Customs scans**: two beacons (Kestrel Customs, Warden Buoy) sit off the lane and sweep translucent scan cones (range
   32, ±0.4 rad). In the cone with line of sight (Mars and Phobos block it) the meter fills in about 1.8 s (faster when
   boosting or with heat). Options:
   - **dodge**: leave the cone or break line of sight; an evasive **roll** during a scan cuts the meter by 45% and ghosts
     you for 1.1 s;
   - **bribe** (💸 / B): price from `SSX.bribes.price({ kind: 'spot', stars })` when it exists, else 110 + 70 per heat star.
     Refusal odds rise with heat; a refusal flags you;
   - **dump** (DUMP / X): the run fails, no heat.
4. **Flagged**: heat +1 and patrol interceptors launch (1 + heat/2; max 2 on phones, 3 on desktop). Within 19 their lock
   builds; a full lock hits the crate for 34 hp; at 0 hp you're boarded and the cargo is seized (fail, heat +1). A roll
   breaks the lock. Lose them by staying over 75 away (boost: 90 vs their 40) or out of sight for 3 s.
5. **Drop**: hold inside the ring (8) at Phobos for 1.4 s.
6. **Return**: land on Mars. Tap **💰 CASH** / **🤝 FAVOR** in the dock, or press 8 / 9 (cash after 30 s).
   Cash = 480 × crate condition, +18% per flag shaken off (max 3), +140 for a clean run. A favor is worth 1.35× the cash in
   product from the contraband catalogue (`SSX.contraband.add`, within carry room), and Pell clears one wanted star.

## Feature detection
| Module | Used for | Fallback |
|---|---|---|
| `SSX.pursuit` (#42) | `raise(n, why)` if present, else a pending `world.setWanted` applied when you land on Mars | local heat 0–5 in `ssx.smuggle.v1`, cools 1 star / 150 s |
| `SSX.bribes` (#23) | `price()` only (never `offer()`: that starts a ColSec encounter) | `bribePrice(heat)` |
| `SSX.airRoll` (#41) | `roll('left'/'right')` when `canRoll()`; `isRolling()` | `__app.requestRoll(d)` / `__app.shipRoll` (also double-tap A/D, flick the stick) |
| `SSX.contraband` | favor payout | cash |

## Controls
Touch: dock buttons on the surface; in space a small black/white strip under the Land button with 🌀 (roll, only during a
scan or chase), 💸 price (only during a scan) and DUMP. Desktop: 8 run / cash, 9 favor, B bribe and X dump (space only;
on the surface B and X stay the stash and the medkit).
