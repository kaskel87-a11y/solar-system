# Mars arsenal + Bore the gunsmith (`mars/arsenal.js`, `mars/gunsmith.js`)

One `<script type="module">` hook in `index.html` (after turf). Game fiction: every weapon, maker and contraband name is invented.

## How it plugs into the existing combat path
No second combat system. Guns are entries in `game.js` `WEAPONS` and fire through `game.fire()` (bolts, auto-aim,
`P.stats.shots`, the `zap` event → `world.shotFired()` crime, `world.hitWorld()` → security/people damage, gore, `crime()`,
wanted, pursuit, rep). The module wraps these API properties (each wrapper is guarded and falls through to the original):

| wrapped | why |
|---|---|
| `game.fire` / `game.update` | magazines, reload, bloom/recoil, rail charge, Rust Pit block. Held fire is taken out of `input.fire` and re-issued through the same path |
| `game.melee` | knife / bat swing through the core melee (fists anim, agents, `ctx.meleeTarget`) |
| `world.hitWorld` | people headshots (x2.5; security already had them), AP/hollow vs heavy armour, hit reaction, blood decals |
| `world.meleeWorld` | knife x3 / bat x2.2 damage and bat knockback; reactions are a zero-damage shove through this call |
| `world.shotFired` | suppressor skips the "discharging a weapon" crime |

Weapons: `pistol` (Kestrel M3, `WEAPONS.ar_pistol`), `smg` (= core `smg`), `shotgun` (= core `shotgun`, 8 pellets),
`rifle` (Longwatch AR-7, `ar_rifle`), `rail` (Halcyon coil lance, `ar_rail`: pierce, 1.2 s charge, 3-round mag, slugs only from
Bore or a 1.5% drop when ColSec goes down), `knife`, `bat`. The core blaster / rail rifle / launcher / machete / cleaver stay
core-managed and appear in the wheel too. smg + shotgun are now magazine-fed: `P.inv.rounds` / `P.inv.shells` are their
standard reserve, so Ozzie's and the colony shop keep working.

Ammo: calibers `light` (pistol, smg), `shell`, `heavy` (rifle), `rail`; types `std`, `hollow` (x1.35, x0.7 vs heavy), `ap`
(x1.1, ignores heavy armour), `slug`. Reserve keys `cal:type` (std light/shell = the game's inventory).

## Controls
- Desktop: hold **Q** = wheel (mouse picks, release selects), tap Q cycles, **B** reload, **Z** scope, **O** ammo type.
- Phone: long-press the 🔫 HUD chip (tap still cycles), or tap 🎯 on `#ssxDock`. Ammo pill: tap = reload, STD/HP/AP button, 🔭.
- Rust Pit (AJ [-292,-68] r12, `SSX.fight.status().at` if present), duels, `SSX.fight.debug.inCage`: guns blocked, fists only,
  unless `SSX.fight.allowWeapons()` returns true (or `status().weapons === true`).

## Bore's bench (Red Tape Flats, AJ [-246,-62], next to Blue)
Walk within 5.5 m → "🔧 Bore's bench". Pay with contraband (registered as `SSX.contraband` offers `bore:<id>`, traded via
`barter()`), cash at 1.6x markup, or a favour (one front at a time, cleared by any `SSX.jobs` 'complete'; refused if
`SSX.rep` Flats rep < -40). Mods: suppressor, extended mag (+50%), scope (camera zoom 2.2x / 3x on the lance).

## API (`window.SSX.arsenal`)
`weapons() equip(id) current() ammo(id?) give(id, ammo?, type?) mods(id?) addMod(id, mod) setAmmo(type) reload() scope(on?)
wheel(open?) inPit() on(event?, fn)` and `gunsmith.{open, close, at, catalog, trade(id, 'stash'|'cash'|'favor')}`.
Events (also `window` `ssx:arsenal` and bus `arsenal:<type>`): equip shot dry reload reloaded hit head decal give mod ammo
wheel pit trade quiet. Saved in `localStorage['ssx.arsenal.v1']`.

Test: `NODE_PATH=... OUT=<wt>/shots/arsenal/ BASE=http://127.0.0.1:<port>/ [BR=webkit DEV="iPhone 14"] node tests/test-arsenal.js`
