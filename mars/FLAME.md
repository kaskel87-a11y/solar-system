# 🔥 Flamethrower (`mars/flame.js`, `window.SSX.flame`)

Fiction only. Steve. A short-range weapon with its own fuel tank, sold at the gun counters.

Files: `mars/flame.js` (runtime: shop hook, input, particles, burning, HUD, audio), `mars/flamecore.js` (pure rules),
`tests/test-flame-unit.mjs`, `tests/test-flame.js` (Playwright, iPhone 14 WebKit 393x852). Wiring: one script tag in `index.html`.

## Buying
- **Flamethrower, 3500 cr** and **Flamer fuel (+50), 180 cr** show on Ozzie's Iron counter (venue `guns`) and on any other
  counter that already sells weapons (not the bar or the depot). Guarded wrap of `game.shopList / shopItem / buy` for `fl:` ids,
  the same pattern as `marsshops.js` (`game.__flameShop`).
- A new flamer comes with a full 100-unit tank and is equipped. Owned: the row says Equipped / Owned. Tap to equip.
- Fuel: +50 a canister, tank holds 100. "Full" when topped up.

## Using it
- Equip with the 🔥 button above FIRE (touch) or the shop row. Picking any other gun (gear chip, wheel, shop) puts it away.
- Hold FIRE: a cone of flame, about 8 m long and about 22° wide each side. It burns about 9 fuel a second, so a tank lasts about 11 s.
  The fuel bar sits under the 🔥 button while equipped. An empty tank just clicks. The normal gun doesn't fire instead.
- On foot only. Indoors the house rules still apply (the game holsters you). In the Rust Pit it's fists only (`SSX.arsenal.inPit`).
- **Airborne is fine.** In a jump, or on Pumpkin's jetpack once it lands, the flame follows the camera's pitch so you can torch the
  ground below. `SSX.jetpack` is looked up guarded (`active()` / `flying`), and nothing blocks firing in the air.

## What burns
- **Colony folk and security**: cone ticks (5 Hz) and then 5 s of burning, all through `world.blast`. That gives the hit points,
  the panic/flee, the KO and the crime/wanted. Screams are synthesized from `synth.js` babble plus a gliding saw (no TTS) and respect the mix and mute.
  Bodies char black with ember flicker, then a little `game.gore` when the burn ends. Quest contacts are never set alight.
- **Vehicles** (parked or traffic): they burn for about 6 s, faster if you keep spraying, then blow up with the game's own
  explosion (`game.gore(..., { mech: true })` burst plus debris), `world.blast` splash (6 m) and a hurt if you're close. The wreck stays charred
  and traffic wrecks stop. Your rover, the car you're in, owned rides and Raccoon rides never burn.
- **Crops**: `SSX.farm` has **no crop-destroy API**, so the player's own farm plot (Dustbowl Homestead) is **never burned**, and
  the farm save (`ssx.farm.v1`) is not read or written. Instead there are three session-only "dust-wheat" patches
  on open ground near Ares Junction. They burn away and grow back after 2 min, and they're never saved.

## Wanted
Starting to fire, and every 3 s of held fire, calls `world.shotFired()` ("discharging a weapon", near the colony).
Hitting people or security adds `world.blast`'s own crimes.

## Performance (phones)
One pooled `THREE.Points` (custom shader, additive). It has a hard cap of 240 particles, or 140 on phones, uses fixed typed-array buffers and a ring index, and makes no per-frame allocations.
At most 8 burning things are tracked, in fixed slots. Materials are cloned once, only when something catches fire, so a whole crowd doesn't char.
The hit roster (`world.debug.people/security`) is read at 5 Hz, only while FIRE is held. The world keeps its own phone NPC cap of 12.

## HUD
The 🔥 button (46 px) and fuel bar sit above FIRE. They show only once you own it, on foot. Landscape puts them above FIRE's phone spot.
They're hidden in hide-HUD (`cinematic`, `hidehud`), indoors, while driving, and under open sheets.
Taps go through `window.__onTap` (pointer events). There's no new keyboard key (all letters are taken). On desktop, F / mouse fire works the same.

## API
`SSX.flame.state()`, `equip(on?)`, `on(fn)`. Events go out as `flame:*` on the SSX bus: buy, fuel, equip, fire, stop, ignite, charred, boom, crop.
`debug.give(fuel) / setFuel(n) / reset() / hold(s)`. The save is localStorage `ssx.flame.v1` `{ owned, fuel, eq }`. Ownership is also pushed to `progress.unlocks` (`fl:flamer`).
