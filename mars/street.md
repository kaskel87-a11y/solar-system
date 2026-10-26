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

## Hooks used (all optional)
SSX.contraband (buy/sell/registerOffer), SSX.city (crime/wanted/npcBudget/npcReserve/hostiles), SSX.bark, SSX.time.isNight (fallback: dangercore `marsHour()`, night is 21–05), SSX.turf.ownerAt (which crew paints over you), SSX.rep.add (crews/junkies), SSX.garage (grantVehicle/grantUpgrade).

## Performance
Phones: at most 5 street NPCs, minus Lou while the yard is loaded, under the 12-NPC phone cap. They're reserved through `npcReserve('street')`. Desktop allows up to 16. Humans are built lazily and pooled per slot, tags are 8 InstancedMeshes, and everything is disposed on unload.

## Credits
All textures are procedural canvas drawn in code (self-made, CC0). There are no external assets. The brands (Meridian Air, Hook & Crook Towing, Red Dust whiskey) are made up.
