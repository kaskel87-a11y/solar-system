# Add-on game modes

`modes/hook.js` is the only thing shared code calls: `surface.js` runs `modeTick(dt, ctx)` once a frame, right after `raceTick`.
It ticks the generic raid engine first, then Rags to Riches. Both are new files, so nothing else in the core changed.

| File | What it is |
| --- | --- |
| `hook.js` | Single entry point (`modeTick`). It catches errors so a broken mode can't stall the frame. |
| `raids.js` | Generic defend-wave engine, installed as `window.SSX.raids`. |
| `rags.js` | Rags to Riches mode: UI, world props, economy and raids glue. |
| `ragscore.js` | Pure rules: income, net worth, tiers, wave plans. Unit-tested in node. |
| `rags-data.json` | Tiers, spawns, properties, upgrades, hustles and the activity list per tier. Positions are `[x, z]` from Ares Junction. |

## SSX.raids (generic raids)

```js
const r = SSX.raids.start({
  id: 'ben-base-1',            // optional, auto if omitted
  pos: [120, -60],             // [x, z] from Ares Junction, or { x, z } in world coords
  radius: 25,                  // defended area (m); attackers stop at the core, chase you inside 2x radius
  attackers: 'gang',           // 'gang' (Rustline crew) | 'colsec'
  waves: 3,                    // or [{ count: 3 }, { count: 5 }]
  integrity: 150,              // optional core HP; attackers at the core grind it down
  wanted: 2,                   // optional; false = never touch the wanted level
  onWin(info) {}, onLose(info) {}
}); // -> { ok: true, id } | { ok: false, why }

const off = SSX.raids.on('raid:wave', e => turrets.arm(e.wave));   // returns an unsubscribe function
```

Events:
- `raid:start` `{ id, attackers, waves, pos, radius, integrity }`
- `raid:wave` `{ id, wave, waves, count }`
- `raid:kill` `{ id, kills, how }`
- `raid:end` `{ id, result: 'win'|'lose', why: 'cleared'|'overrun'|'down'|'fled'|'left'|<stop reason>, kills, wave, waves, integrity }`

Extras: `off(ev, fn)`, `stop(id, why)`, `active()` (snapshot or null), `attackers()` (live handles `{x, z, alive, hp, kind, hurt(dmg)}` for turrets and walls), `cap()`, `fromAJ([x, z])`.

Rules:
- **One raid at a time.** A second `start` returns `{ ok: false }`.
- **Hittable without changing world.js.** Attackers are wrapped into `world.hitWorld`, `targets`, `meleeTarget`, `meleeWorld` and `blast` once per world, the same pattern street danger uses. Blasters, melee, grenades and auto-aim all work on them.
- **Wanted level.** A ColSec raid sets wanted to 2 or more at start. A gang raid sets wanted 1 at wave 2 (a gunfight draws ColSec). Pass `wanted: false` to opt out.
- **NPC cap.** Raiders fit inside the v7.5 NPC budget (`world.npcBudget()` / `npcReserve`, phone cap 12). Live raiders are limited to the smaller of two numbers: the cap minus the ColSec the current wanted level will field, and the budget cap minus the 4-walker floor (phone), ColSec on foot, `game.humanCount()` and other add-ons' reservations. The engine reserves its slots as `npcReserve('raids', n)` and releases them when the raid ends. Extra attackers wait in a queue; if nothing can spawn for 25 s the raid ends as a win (`scattered`).
- **How a raid is lost:**
  - the core's integrity reaches 0
  - you go down
  - you stay more than 3× the radius away for 12 s
  - you leave the planet
- **No-op guard.** If anything else already set `SSX.raids`, this engine never installs and stays idle. Callers always use `SSX.raids`.

## Rags to Riches

**Starting a run.** Open ☰ → **🧱 New Game: Rags to Riches**. While a run is active, the same item reads **Rags to Riches: progress**.
- Your normal credits are stashed. You start with 25 credits, no rover and a crash pad in Red Tape Flats.
- **Return to normal game** restores your credits. The run is kept in `ssx.r2r.v1` and can be continued later.

**Tiers.** You need both the net worth and the rep for a tier.

| Tier | Needs | Unlocks |
| --- | --- | --- |
| Flats Nobody | — | Crash pad spawn; Wrench and Marrow |
| Olympus Row Regular | 2500 net worth, 20 rep | Loft spawn; Nyx and Kline; the club |
| Helios Heights Royalty | 9000 net worth, 45 rep | Suite spawn; Porter and Lita; the Helios gate; the mansion |

- Below the top tier, Porter turns you away at the Helios gate.
- When you respawn, you land at your best unlocked spawn point.
- Rep comes from hustles, defended raids and money collected.

**Properties.**

| Property | District | Price | Income | Raided by |
| --- | --- | --- | --- | --- |
| Dust Bowl Noodle Cart | Red Tape Flats | 120 | 12/min | gang |
| Back Bay Chop Shop | Red Tape Flats, buy-in to Wrench's existing WRENCH'S block | 600 | 45/min | gang |
| Red Shift Lounge | Olympus Row, the city's existing RED SHIFT block by The Static (Nyx) | 2400 | 150/min | ColSec or gang |
| Helios Crest Mansion | Helios Heights (Porter), new dome clear of the heist mansions | 8500 | 340/min | gang or ColSec |

- **Income** builds up to a cap whether or not you're there, but you collect it in person at the door.
- **The chop shop's take** follows hot-parts street prices when `SSX.contraband` is present.
- **Upgrades:** 3 security levels (lower raid odds, smaller waves, tougher core) and 3 income levels (higher rate and cap).

**Raids.** Each owned property rolls for a raid once a minute.
- **Within 90 m:** a live `SSX.raids` defend wave starts at the door.
- **Further away:** you get a 45 s warning in the HUD stack. Reach the property to fight, or it is auto-resolved from its security level.
- **Losing** costs 60% of the stored cash, some rep, and 90 s of downtime.
- **Winning** pays a bonus and rep.

**UI.** No permanent HUD buttons are added.
- A context button (`#r2rCtxBtn`, 44 px or larger) appears in `#surfBtns` only at a property door.
- The raid status chip sits in `#stackR` and flows with toasts and radio.
- Panels are fullscreen and pointer-event based.

**Feature detection.** Every integration is optional and skipped if missing:
- `SSX.districtsOf` overrides the district centres.
- `SSX.contraband` feeds the chop shop's take.
- `SSX.garage.grantVehicle` is called when you buy the rover.
- `SSX.bark` voices contacts and raiders.
- `window.__activities` (activity runner) lists side jobs for your unlocked districts.

Built-in hustles are registered with `game.registerMission` and pay in full every time.

**Tests:**
- `node tests/test-r2r-unit.mjs`
- `BR=webkit|chromium DEV="iPhone 14"|"iPhone SE" node tests/test-r2r.js`
