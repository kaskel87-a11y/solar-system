# Red Tape Flats street life (`mars/street*.js`, `SSX.street`)

Grungy, M-rated street layer for the Flats (`mars-rough` district). It hooks in through one line in index.html (`import './mars/street.js'`) and runs on `SSX.registerSurfaceTick`. Every cross-module call is guarded: if SSX.contraband, SSX.garage, SSX.rep, SSX.turf, SSX.time, SSX.bark or SSX.city is missing, that call does nothing (or falls back), and nothing throws. It loads within 170 m of the district centre and unloads past 230 m.

| file | what |
|---|---|
| street.js | entry: state (localStorage `ssx.street.v1`), black/white UI (`#stAct` button at 50% left, key **Y**; `#stPanel`; `#stChip`), NPC budget, load/unload, `SSX.street` API |
| street-tags.js | graffiti walls, spray cans, instanced tag decals, street cred, cop-seen wanted, rival crews painting over you |
| street-crowds.js | night burn barrels (smoke/flames/glow), crowd barks and fist-fights, dealers (Needles, Sugar), junkies (Twitch, Lenny, Moth, Dez) |
| street-tow.js | Hook & Crook Towing yard (Lou): stolen-ride drop-off / strip, hot no-plate rides, the tow truck that impounds your rover |
| street-tex.js | procedural canvas textures (tag atlas, smoke, flame, rust, concrete, signs) |
| street-lines.js | barks (profanity, dark humour; no slurs) |

## Locations (district-local x,z; world = centre + local; Flats centre is (-280,-240))
- Tag walls: yardwall (46,19.2), rust container (-52.75,14), jersey wall S (12,-34.27), dumpster (34.88,-2), jersey wall SW (-30,-48.27), Meridian Air billboard (-4,51.6). Cans lying around at (-50,10), (14,-36.5), (37.6,-3.4) and (-2,49.5); they respawn after 6 min. Lou sells 3 for 25 cr.
- Burn barrels (night only): south lot (-2,-36), pad fence (-53,-1), north alley (2,40).
- Dealers: Needles (-14,-31), Sugar (36,31). Junkies wander around (-8,-40), (30,33), (-47,4), (6,45).
- Hook & Crook yard: (46,24), 12x9 m, with the counter at (42.2,23.5), drop-off ring at (46.5,25.5) and impound slot at (45.6,25.6).
- All props are new and freestanding. None sit on #10 storefront facades, #21 grime decals or #32 doors.

## Hook & Crook vs Wrench's chop shop
Wrench (existing chop) scraps a stolen ride for small cash and **clears your heat**. Lou buys it **whole for more cash** (or strips it for a part + cash), but **your heat stays**, and he pays less the hotter you are. Lou also sells hot, no-plate rides (via `SSX.garage.grantVehicle(kind,{noPlates:true})`), impounds your rover if you leave it parked in the Flats, and buys `hot_plates` through `SSX.contraband.registerOffer('hookcrook-plates')`.

## API (`window.SSX.street`)
`loaded, district, cred, title, cans, addCans(n), tagName, setTag(s), isNight(), setNight(true|false|null)`
`tags(), tag(id) (instant tag, used by tests), rivalPaint(id, gang?)`
`crowds(), npcs(), fight(barrelIdx)`
`tow.{impound, hook(), pay(), yard(), quote(), sell(), strip(), buyHot(kind), stock()}`
`stats(), state(), on(fn), reset()`, plus `debug.*`
Events: `SSX.emit('street:<type>')` and `window` `ssx:street` CustomEvent (`load`, `unload`, `can`, `cans`, `spray`, `tag`, `cred`, `covered`, `spotted`, `fight`, `round`, `mouthoff`, `buy`, `sell`, `bust`, `gift`, `shove`, `towed`, `impoundPaid`, `impoundJumped`, `fence`, `strip`, `hot`).

## Outdoor colliders (`mars/colliders.js`, `SSX.colliders`)
A tiny 2D collider set on an 8 m spatial grid. `world.collide()` (player outdoors, vehicles, walking NPCs, freeSpot) calls
`SSX.colliders.resolve(x, z, r)` through one guarded line, so everything that already respects buildings respects these.
The player slides along them; vehicles get the existing building response (blocked, small bounce, crash event).
- `add({ type: 'box', x, z, hx, hz, yaw?, group?, tag? })` or `add({ type: 'cyl', x, z, r, group?, tag? })` -> id
- `remove(id)`, `removeGroup(group)`, `list(group?)`, `query(x, z, r)`, `blocked(x, z, r)`, `resolve(x, z, r)` -> `{x, z}` | null, `stats()`, `clear()`
- Street life registers group `'street'` on load (tag props, burn barrels + crates, tow-yard fence runs, office, truck,
  hulks, tyre stack) and removes it on unload.
- **For grime (#21) and other mods:** `SSX.colliders?.add?.({ type: 'box', x, z, hx, hz, group: 'grime' })` when your props
  build, `SSX.colliders?.removeGroup?.('grime')` when they dispose. Indoors is unaffected (rooms have their own collide).

## Street violence (`street-combat.js`, `street-blood.js`)
Dealers, junkies and barrel crowds are hittable through the same world wrapper pattern danger.js uses (hitWorld, targets,
meleeTarget, meleeWorld, blast). hp: crowd/junkie 3, dealer 4. A hit bleeds (instanced ground spatter + `game.gore`),
knocks back and makes the victim run; the first hit on a civilian is `crime(1)`, a kill is another `crime(1)` (heat via the
existing wanted system). Deaths crumple and tip over (tween), the body stays 60 s, the slot is empty for 5 min. Bodies drop
cash (dealers also 1-3 product into `SSX.contraband`, cash if that module is missing); walk over it to take it. Witnesses
within ~22 m flee and scream. Blood: capped ring buffers (phone 18 spatter / 8 pools, desktop 40 / 16), per-instance fade
attribute, fully visible 18 s then fading out by 60 s.

## Rockheads (`street-tweakers.js`, `street-rant.js`)
Red Static addicts who spot you on foot, storm over ranting gibberish (louder as they close in), accuse you and call you
out. Panel: Fight / Back off / Pay 10 cr. Fight is fists through the normal melee path; he swings erratically and sometimes
pulls a broken bottle. Win: he crumples and bleeds, drops a little cash or a rock, +8 street cred, no heat for a fair fight.
Shoot or blow him up: heat as usual. Lose (your health would drop under ~22): you hit the dirt and he takes 10-25% of your
credits (max 60). Back off: taunt, maybe a shove, maybe a chase. One at a time (phones: pool of 1, counted in the street
NPC budget). Checks every 8 s: 4% by day, 12% at night, times `SSX.grime.level` (0..1 -> x0.6..x1.5) when present, 60-90 s
cooldown; never while `window.__danger.state.mug` is active (that is the knife mugging; this is not a robbery).
Junkies wandering at night also yell at nobody. Lines go through `SSX.bark` (literal text) or a black/white speech bubble.

## Night (`street-night.js`)
When `SSX.time.isNight()` (or `setNight(true)`) and outdoors in the Flats: sky shader uniforms, background, fog colour,
sun and hemisphere intensity ease toward a dirty sodium night (0.5/s), and the 10 district lamps get glow sprites plus
ground pools (desktop adds two point lights on the nearest lamps). Base values are captured and restored exactly by day
and on unload; values changed by someone else are re-based, not fought.

## API additions
`challenge({ near?, reset? })` force a rockhead, `rockhead()` its state, `drops()`, `blood()`, `night()`, `colliders()`,
`hurt(key, dmg, how)`, `debug.ageBlood(s)`, `debug.yell(text, lvl)`, `debug.parts()` (blood/combat/rockheads/night counters).
Events (`ssx:street` / `SSX.emit('street:*')`): `hurt`, `kill`, `drop`, `loot`, `yell`, `rockhead`, `brawl`, `brawlWon`,
`brawlLost`, `rockheadPaid`, `rockheadKilled`.

## Polish pass (PR stacked on #39 → #44)
**Knockdown (`street-knockdown.js`).** Losing a street fight drops your astronaut in a ragdoll-lite crumple: 0.7 s fall
backwards with a bounce wiggle, 1.8 s lying in the dirt, 0.9 s getting up, then 6 s dazed: canvas blur (1.2 px phone /
2.2 px desktop, eased out), a decaying camera wobble, and movement scaled from 45% back to 100%. Movement is pinned while
down. Costs cash (10-25%, max 60) **and -3 street cred**. Falls back to the old overlay when driving or inside. API:
`SSX.street.knockdown(text, o)`, `knockedDown()` → `'fall'|'down'|'rise'|'dazed'|'done'|null`; parts add `knockdown`.

**Vehicles slide along walls (`colliders.js`).** `resolve(x, z, r, mover)` now returns `{x, z, nx, nz}` (contact normal).
When the mover is a vehicle (radius matches `spec.r*0.75`) hitting at a glancing angle, its velocity is projected onto
the wall tangent (×0.93), speed is held under the core crash threshold so the core bounce/crash/hurt don't fire, and a
surface tick (`registerSurfaceTick`) right after the vehicle update restores the slid position and tangent speed and eases
yaw along the wall. Head-on hits (>60% into the normal) still bounce as before. The only world.js change is the existing
guarded hook line, which now passes the mover. Counters: `colliders.stats().slide`.

**Rockheads ≠ danger.js junkie.** Rockheads are gaunt, hoodless (mohawk/bald/long hair), stained tank top or torn red
flannel, with glowing **Red Static** eyes (#ff2414, flickering) and burned glowing fingertips, plus a constant jitter and
a violent spasm every 1-3 s. The danger junkie keeps its brown suit, hood, blue visor and knife; the rant lines share no
text with `dangercore.BARKS` (checked in tests). They never coexist: no rockhead spawns (even forced) while a mugging,
an unfinished danger fight or a danger director event is active, and a rockhead already out runs off if a mugging starts.
danger.js has no public pause hook, so the reverse direction (pausing danger during a rockhead) is not possible from here.

## Hooks used (all optional)
SSX.contraband (buy/sell/registerOffer), SSX.city (crime/wanted/npcBudget/npcReserve/hostiles), SSX.bark, SSX.time.isNight (fallback: dangercore `marsHour()`, night is 21–05), SSX.turf.ownerAt (which crew paints over you), SSX.rep.add (crews/junkies), SSX.garage (grantVehicle/grantUpgrade).

## Performance
Phones: at most 5 street NPCs, minus Lou while the yard is loaded, under the 12-NPC phone cap. They're reserved through `npcReserve('street')`. Desktop allows up to 16. Humans are built lazily and pooled per slot, tags are 8 InstancedMeshes, and everything is disposed on unload.

## Credits
All textures are procedural canvas drawn in code (self-made, CC0). There are no external assets. The brands (Meridian Air, Hook & Crook Towing, Red Dust whiskey) are made up.
