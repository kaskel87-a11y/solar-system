# Director mode (Mars sandbox toggles)

Open it from ☰ → **🎬 Director**. The panel is a full-height dialog with high contrast (black and yellow), every control is at least 48 px, and it works with pointer events plus a click fallback. Settings are saved to `localStorage['ssx.director.v1']`. It adds no permanent HUD buttons. While a cheat is on, a small **🎬 DIRECTOR** tag sits in the right-hand HUD stack (`#stackR`).

| Setting | Values | Cheat? |
|---|---|---|
| Dust storm | off / light / heavy: fog closes in, a dust colour cast, a gusting-wind particle cloud (160/360 particles on phones, 600/1400 on desktop) | no |
| Time of day | game / dawn / noon / dusk / night, plus a 0–24 h slider. Changes sky, sun, light and stars (blue Mars sunsets) | no |
| Freeze time / time scale | freeze; 0.5×, 1×, 4× or 16× in-game hours per game minute | no |
| NPC density | normal / sparse / empty. It only *reserves* NPC slots, so it can't go over the phone cap of 12 | no |
| No cops | keeps wanted at 0, recalls ColSec security (world.js) and no-ops `SSX.city.securityResponse`. Street danger and gang chases (danger.js/pursuit.js) aren't police and keep their own ☰ toggle | **yes** |
| Invincibility | keeps HP and shield full | **yes** |
| Unlimited ammo | refills shells, rounds, slugs and grenades and clears cooldowns | **yes** |
| Spawn vehicle | lists the registered `VEHICLES`. Uses `SSX.garage.grantVehicle` if that add-on exists; otherwise only the rover (summonRover) | **yes** (until reload) |

Storms and time of day only apply on the Mars surface, never indoors. Fog near and far can only be pulled in, never pushed out. "game" brings back the planet's own lighting exactly.

When the Mars day/night cycle is loaded (`mars/time.js`, `window.SSX.time`), it is the only clock. The Director time controls call `SSX.time.set()`, `setScale()` and `freeze()`. "Live" means `freeze(false)` plus `setScale(1)`. Reset sets the speed back to 1× and unfreezes the clock. The dust storm adds its look through `SSX.time.addLookFilter()` and doesn't write the lights or sky itself. Director falls back to its own `S.tod` overlay only when SSX.time isn't there. See `mars/TIME.md`.

## Rewards are blocked while cheats are on
- `game.reward(xp, cr)` pays nothing.
- On `game:quest` `{kind:'done'}`, the core quest payout is clawed back and a toast is shown.
- **Not covered:** race payouts (race.js writes `P.credits` directly with no event) and Rags-to-Riches property income. Add-ons should opt in like this:
  ```js
  if (window.SSX?.director?.rewardsBlocked?.()) return; // skip payout
  SSX.on('director:change', ({ cheats, rewardsBlocked }) => { ... });
  ```

## API: `window.SSX.director`
`version, state(), set(key, value), cheats(), rewardsBlocked(), open(), close(), spawnVehicle(id), vehicles(), on(fn)`; emits `director:change`.

## Hook
There's one line in `index.html`, right after the contraband script: `<script type="module" src="./modes/director.js?v=…">`. Everything else lives in `modes/director.js` (UI and scene) and `modes/directorcore.js` (pure rules). The modules import plain relative paths (`'../world.js'`, `'./directorcore.js'`), following the v7.5.2 import-map rule, and the script src uses main's `?v=`. **At merge:** run `python3 tools/importmap.py` (adds `modes/director*.js` to the import map) and add both files to `sw.js` PRECACHE, as was done for `mars/jobs.js`. Until then they load unversioned and work fine online. It reads core APIs only through `SSX.registerSurfaceTick`, `SSX.registerMenuItem`, `SSX.on`, `__app.surface.{game,world}` and feature-detected `SSX.danger`, `SSX.garage` and `SSX.city`.

## Tests
- `node tests/test-director-unit.mjs`
- `BASE=http://127.0.0.1:PORT/ BR=webkit DEV="iPhone 14" SHOTS_DIR=$PWD/.shots node tests/test-director.js` (also `BR=chromium`, `DEV="iPhone SE"`). This toggles every setting and checks HUD overlap, control size, the panel staying on screen, relative fps, rewards blocking, persistence and reset.
