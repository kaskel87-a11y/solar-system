# Mars rover dealership, garages and car meets (add-on)

Files: `garagecore.js` (pure logic: models, prices, upgrade math, rep, clock, save migration, dealer stock),
`rides.js` (car meshes + paint / body kit / wheels / underglow), `dealership.js` (lot, sheets, your ride, save),
`carmeet.js` (night meet, show off, drag races on race.js). Tests: `tests/test-garage-unit.mjs`, `tests/test-dealer.js`, `tests/run-dealer.sh`.

## Listing a vehicle at Red Line Motors

Any `SSX.registerVehicle(kind, spec, builder)` entry with a numeric **`price`** is listed automatically. Nothing else is needed:

```js
SSX.registerVehicle('raccoon_mobile', { name: 'Raccoon Mobile', vmax: 22, boost: 33, acc: 11, bacc: 16, turn: 1.6, r: 2.3, price: 3100, icon: '🦝' }, builder);
```

Fields read from the spec:

| field | meaning |
|---|---|
| `price` | sticker price in credits; **required** to be listed |
| `hidden` | `true` = never listed |
| `dealer` | `false` = not listed (unless `registerDealerVehicle` lists it); or an object `{ price, tier, rep, blurb, icon, name }` that overrides the fields below |
| `name`, `icon` | shown on the chip and the lot sign |
| `tier` | class 1-4 (stars, upgrade and kit prices). Default: from price (<1500: 1, <3500: 2, <6000: 3, else 4) |
| `rep` (or `minRep`) | rep needed before the dealer sells it (default 0) |
| `blurb` (or `desc`) | one-line sales pitch |

The kind `rover` is never listed. Driving numbers (`vmax, boost, acc, bacc, turn, airTurn, r, hover, lean, ...`) are the usual VEHICLES spec; garage upgrades scale them.

Explicit hook (lists a kind with no `price`, or overrides a listing): `SSX.registerDealerVehicle(kind, { price, tier?, rep?, blurb?, name?, icon?, hidden?, spec? }, builder?)`.
`spec`/`builder` register the vehicle too if it isn't registered yet. `SSX.dealerStock()` returns the current list.

## Moving it

`SSX.configureDealer({ world: 'Mars', anchor: 'colony', dealer: [x, z], garage: [x, z], meet: [x, z], strip: { from: [x, z], to: [x, z] }, yaw })`.
Offsets are colony-relative (Ares Junction) when `anchor` is `'colony'`. Defaults are in `garagecore.js` `DEALER_CONFIG`.

## Save

`ssx.progress.v1` → `progress.garage` (`{ v, rides[], active, rep, clock, meet, wins, races, nextId }`). Old saves have no
`garage` key; `migrateGarage()` builds a fresh one (stock rover only) and repairs partial or corrupt data.

## Free grants for other modules (`SSX.garage`)

For mission rewards, a mechanic's favour (e.g. a contraband barter) and so on. These cost no credits and need no rep. They save immediately and apply to the driven ride straight away.

```js
SSX.garage.grantUpgrade('current', 'engine');          // +1 level (max 3). rideId: a garage ride id or 'current'
SSX.garage.grantUpgrade('current', 'boost', 2);        // +2 levels
SSX.garage.grantPart('current', 'glow', 'magenta');    // unlock + fit (pass fit=false to just unlock)
SSX.garage.grant('current', 'wheels:gold');            // one call for either: 'slot:value' = part, 'slot' = upgrade
SSX.garage.grant('current', { slot: 'paint', value: 'gold' });
```

- Upgrade ids: `engine`, `handling`, `brakes`, `boost` (also in `SSX.garage.upgrades`).
- Part slots and values: `paint` (factory, candy, midnight, lime, pearl, matte, gold, chrome), `kit` (stock, street, widebody, rally), `wheels` (stock, chrome, gold, black, offroad) and `glow` (none, cyan, magenta, green, orange, purple). They are also in `SSX.garage.parts`.
- Each call returns `{ ok, msg, ride, ... }`. `ok:false` (with `maxed:true` for a maxed upgrade) means nothing changed, so you can refund or offer something else. `msg` is a ready-made toast line.
- On the stock rover, paint and kit are refused (those stay with Meridian Depot). Use an upgrade, wheels or glow instead.
- Read-only: `SSX.garage.rides`, `SSX.garage.active`, `SSX.garage.rep`.

### Free vehicles: `SSX.garage.grantVehicle(vehicleId, opts)`

```js
SSX.garage.grantVehicle('ares_brute', { noPlates: true });                  // Dutch's "fresh rover, no plates"
SSX.garage.grantVehicle('dust_runner', { noPlates: true, active: false, up: { engine: 1 }, glow: 'green' });
```

- `vehicleId` can be any `SSX.registerVehicle` id. Dealer-listed and hidden ids both work, and so does `'rover'`.
- `opts`:
  - `noPlates` is stored as `ride.noPlates = true` for street and wanted modules to read. The dealership does not punish it; it only names the ride "(no plates)".
  - `active` defaults to true. The new ride becomes the driven ride and is parked at the lock-ups.
  - `up` pre-fits upgrade levels.
  - `paint`, `kit`, `wheels` and `glow` pre-fit parts.
- It costs no credits and needs no rep. The ride is marked `gift: true` with `spent: 0`, so it sells for the base trade-in.
- Returns `{ ok, ride, msg }`. `ok:false` with `full:true` means the garage is full (max 6 rides). Garage-full and unknown-id cases change nothing.

### game.js shop rover gear through `grantUpgrade` (for barter.json `garage_upgrade`)

`SSX.garage.grantUpgrade(any, id)` also accepts the existing game.js SHOP rover ids. These are player-wide, so `rideId` is ignored:

| id | name | shop kind | note |
|---|---|---|---|
| `roverarmor` | Rover armor | upgrade | |
| `turret2` | Turret Mk II | roverup | |
| `turret3` | Turret Mk III | roverup | needs `turret2`, so it returns `ok:false, msg:"…Needs Mk II"` until then |
| `rail` | Rail cannon | roverwpn | |
| `rockets` | Rocket pods | roverwpn | |
| `torch` | Plasma torch | roverwpn | |
| `emp` | EMP pulse | roverwpn | |

- These are applied the same way the shop applies them, through `game.buy(id)`: `P.upgrades` / `P.unlocks`, turret look, equip, save and the `bought` event. The price is credited first, so the net cost is 0. Nothing changes on failure.
- Gear you already own returns `ok:false, owned:true`.
- Suit and personal items (`armor`, `vital*`, `rig*`, `heatsink`) are refused because they aren't garage gear.
- The live list is in `SSX.garage.shopUpgrades`.

All valid `grantUpgrade` ids: the per-ride ids `engine`, `handling`, `brakes` and `boost` (+1 level each, max 3), plus the shop ids `roverarmor`, `turret2`, `turret3`, `rail`, `rockets`, `torch` and `emp`.

barter.json shapes map 1:1:
- `{ type: 'garage_upgrade', upgradeId }` becomes `SSX.garage.grantUpgrade('current', upgradeId)`. `needsUpgrade` is enforced by the shop rule as well.
- `{ type: 'garage_vehicle', vehicleId, opts }` becomes `SSX.garage.grantVehicle(vehicleId, opts)`. `'rover'` and `'buggy'` are both valid ids.
