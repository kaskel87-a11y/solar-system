# Solar System Explorer: add-on API (v7.5)

All add-ons import core modules with the **same `?v=` string as the core** (currently `?v=7.5`), otherwise the browser loads a second copy of the module.

## window.SSX (index.html)

| Call | What it does |
|---|---|
| `SSX.registerMenuItem({ id, label, onTap })` | Adds a ☰ menu button (works on the surface and in space). |
| `SSX.registerVehicle(kind, spec)`, `SSX.registerBody(def)` | v7.4 hooks, unchanged. |
| `SSX.registerHighway(world, def)` | Adds a highway (waypoints, width, ramps, checkpoints, billboards, traffic, chases). |
| `SSX.registerAgentModel(type, build)` | Swap the mesh for an enemy type (v8 visuals). `build()` returns `{ group, body, legs?, arms?, wheels? }`. |
| `SSX.AGENT_TYPES`, `SSX.MATERIAL_ROLES` | Enemy stats table, material slot names for `world.setMaterialSlot`. |
| `SSX.on(type, fn)` / `SSX.emit(type, detail)` | Event bus. Every game event is re-emitted as `game:<type>` (e.g. `game:zone`, `game:wanted`, `game:crack`, `game:choice`). Add-ons emit their own, e.g. `heist:escape` (Ben). |

## SSX.city (Mars city)

| Call | Returns |
|---|---|
| `districts` / `missions` | Registered district defs (by pack id) and the 16 city mission ids. |
| `districtAt(x, z)` | `{ id, name, kind, x, z }` for the district you're in, `{ id: 'mars-highway', kind: 'highway', s }` on the Beltway, else null. Ids: `aj`, `mars-downtown`, `mars-rough`, `mars-gated`, `mars-highway`. |
| `spawnPoints(id?, kind?)` | World-space `[{ x, z, kind, district, ... }]`: pack spawns, patrol routes, plaza, lots, mansion doors/safes, `beltway_node`, `checkpoint`. |
| `npcBudget()` | `{ cap, used, free, reserved }`. Cap is 12 on phones, 40 on desktop. |
| `npcReserve(key, n)` | Reserve `n` NPC slots for your spawner (ambient walkers shrink to fit). `n = 0` releases. |
| `freeSpot(x, z, r)`, `roadAhead(m)` | Nearest open ground; a point on the Beltway `m` metres ahead of the player. |
| `lots(id?)` | Open lots kept free for add-ons (dealership, garages, car meets). |
| `hostiles(types, x, z, { faction, r, src, aggro })` | Spawn security/gang enemies (`thug`, `goon`, `enforcer`, `guard`, `sdrone`, `sbuggy`). Respects the NPC cap. |
| `alarm(level, at, why)`, `cameras()`, `caseCamera(id)` | Alarms (raise wanted, send private security), the camera grid, loop a camera. |
| `choice(prompt, options)` | Shows the bottom choice sheet; resolves with the picked option id. |
| `toast(text, ms)`, `radio(text, contact)` | HUD messages. |
| `zone`, `wanted`, `setWanted(n, why)`, `quest`, `fastTravel(id)` | Live state. |

## game (surface.game)

| Call | Notes |
|---|---|
| `registerMission(q)`, `storyToQuest(m)` | Module exports. Step types: goto, collect, defeat, return, take, clean, race, enter, **choice**, **crack**, **case**. |
| `advanceStep()`, `failStep(why)`, `spawnWave(type, dist, ang, aggro)` | Mission helpers for add-on step runners. `spawnWave` kills count toward the active defeat step. |
| `choose(optionId)` | Resolves a core `choice` step (options: `flag`, `wanted`, `credits`, `radio`, `skip`). Quests with `storymars: true` run their own sheet. |
| `crack(id, difficulty, opts)` | Uses `SSX.heist.safeCrack(...)` when Ben's heist module is loaded, else a timed hold (2.5 + 1.2×difficulty s, stay inside). Sets flag `cracked:<id>`. Returns a promise `{ ok, why? }`. |
| `crackable(id)`, `heistAt(kind, name)`, `crackJob` | Heist state for interiors. |
| `jobBoard()` | City jobs you can take right now (Ines's VIP board). |
| `gore(x, y, z, { n, gib, spray, mech })`, `humanCount()` | Red blood/gibs for people, sparks for machines. |
| `registerAgentType(type, T, build)` | Add-on enemy types (never replaces a core type). `T.human: true` gives red gore, cover and corpses; `T.blood: [r,g,b]` sets the splash colour for non-humans. |

## world (surface.world)

`districts()`, `districtAt`, `spawnPoints`, `npcBudget`, `npcReserve`, `freeSpot`, `roadAhead`, `lots`, `cameras`, `caseCamera`, `alarm`, `coverNear(x, z, fromX, fromZ, maxD)`, `setMaterialSlot(role, material)`, `registerDistrict(world, id, def)` (additive) and `registerHighway(world, def)` (module exports).

## v7.5.1 additions
- `SSX.heist`: Ben's heist API (safeCrack, addCamera, alarm, registerHeist, startHeist, applyTip, on/off). See heist.js. `game.crack(id, difficulty)` maps difficulty to a tier (≤1 easy, 2 medium, 3 hard, 4+ vault) and calls `SSX.heist.safeCrack`; a noisy failure raises an alarm.
- `SSX.city.player()` returns `{ x, z, y, driving, inside, world }`. `SSX.city.height(x, z)` returns the ground height.
- `SSX.city.lineOfSight(x1, z1, x2, z2, y = 1.6)` returns false when a wall, dome or building blocks the line (`world.lineOfSight`).
- `SSX.city.safeSpots(districtId)` lists the district's safe and vault spawn points.
- `SSX.city.securityResponse(x, z, level)` spawns a private guard and drone wave. It is wired automatically to `heist:alarm:response`.
- `SSX.minimap.addMarks(id, [{ x, z, color, r, clamp }])`, `clear(id?)` and `list()`. Informant `heist:tip` cameras and guards are drawn automatically and cleared on `heist:done`.
- `SSX.registerSurfaceTick(fn)` calls `fn(dt, ctx)` every surface frame and returns an unregister function.
- `SSX.radar` is an alias of `SSX.minimap`. `SSX.height(x, z)` returns the terrain height in world coordinates. `SSX.city.colony()` gives the colony origin, for callers that use colony-relative coordinates.
- `registerDistrict` defs now carry `centre` (= origin, colony-relative) and `r`, and they are read back by `SSX.districtsOf('Mars')`.
- `SSX.despawnVehicle()` scraps the stolen vehicle you are driving or standing next to (never your own rover). It is wired to Marsmania's `ssx:chop` event.
- `SSX.contraband`: Marsmania's contraband economy and barter (mars/contraband.js, mars/barter.json).


## Importing core modules (v7.5.2+)
Import first-party modules with **plain relative paths, never a `?v=` query**: `import * as world from '../world.js'`, or the alias `import { registerMission } from 'ssx/game'`.
`index.html` holds an import map that sends every module URL (and its `ssx/<path>` alias) to `<path>.js?v=<release>`, so each module loads exactly once.
A hand-written `?v=` makes the browser load a second, separate copy of that module (its own QUESTS, world state, and so on).
`tests/test-imports-unit.mjs` fails on any `?v=` import. After adding a new `.js` file, run `python3 tools/importmap.py` to add it to the map (release bumps run it too: `python3 tools/importmap.py 7.5.3`).

- `SSX.city.radio(text, contact, offerId?)` (v7.5.2): with an offer id the card shows ✅ Accept / Later for that quest.
- Buttons: bind with `window.__onTap(el, fn)` (or `window.__tapOf(el).fn = fn` to replace a handler like `onclick`). Plain `onclick` never fires on iPhone while a thumb is on the joystick.
