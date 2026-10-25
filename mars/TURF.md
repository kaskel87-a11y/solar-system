# 🚩 Red Tape Flats turf wars (`mars/turf.js`)

Gang turf wars in Red Tape Flats (`mars-rough`). It's a self-contained add-on with one hook line in `index.html`:

```html
<script type="module" src="./mars/turf.js?v=7.5"></script>
```

## Gameplay

- **Six blocks** split Red Tape Flats (Voronoi around block centres, all within 92 m of the district origin `[-280, -40]` AJ-relative). Each block has a 🚩 flag beacon in the owner's colour.

  | Block | Starts with | Tier | cr/min |
  |---|---|---|---|
  | Chop Row (Wrench's lot) | Saltblood | 2 | 10 |
  | Blue's Den (no-name dealer den) | Saltblood | 2 | 12 |
  | Marrow's Court (HQ, locked until you hold 2 blocks) | Saltblood | 3 | 16 |
  | Funeral Mile (Ashes to Orbit) | Vacuum Saints | 1 | 8 |
  | Hab Stacks | Dustjaw Boys | 1 | 7 |
  | Tag Tower (water tower) | Dustjaw Boys | 2 | 9 |

- **Gangs.**
  - **Saltblood** come from the design pack and barter data: red tape on both arms, Marrow's crew.
  - **Dustjaw Boys** and **Vacuum Saints** are invented rivals.
- **Takeover.** Walk to a block's flag and tap **⚔️ Take <block>** (or press **Y**, or use the panel button when you're inside the 34 m ring).
  - You then survive the defenders' waves inside the ring: 2 waves for tier 1, 3 waves for tier 2+. Wave size is 2 + tier, growing by 1 each wave, and the last enemy of the final wave is the gang's heavy.
  - Leaving the ring for 12 s, going down, or tapping **Retreat** fails the takeover.
  - A win gives you the block, plus 60 + 40×tier cr and 30 + 20×tier XP, and sets game flag `turf:first`.
- **Income.** Each owned block pays its cr/min. It accrues in real time, and offline time catches up to a 4 h cap. It's paid into your credits every 30 s through `game.reward`.
- **Counter-attacks.** When you hold blocks and you're on Mars within 700 m of the Flats, a random counter-attack comes every 4–8 min from the gang that lost the block.
  - A radio call starts a 90 s alert. Reach the ring, then hold off 2 waves to earn 40 + 20×tier cr.
  - Not showing up, tapping **Let it go**, going down or fleeing gives the block back.
  - A block under attack pays no income.

## UI

- **Turf panel.** Black with white text, 44 px+ buttons, bound with `window.__onTap`.
  - Open it from ☰ **🚩 Turf**, the **K** key, or the **🗺️ TURF MAP** beacon in the Flats (local `[-8, 16]`, by the fast-travel point).
  - Each row shows the block's owner colour chip, cr/min, status, and an Attack or Track button. Track lights up that block's beacon.
- **Wave HUD.** One line at the top centre, below the minimap on phones: mode, block, wave n/N, enemies left, a leash warning, and a 44 px **Retreat** button.
- **Action button** (`#turfAct`, left side) appears near a flag or the map beacon.

## Integration (all feature-detected)

1. **`SSX.raids.start`** (Steve's `modes/raids.js`) runs the waves when present: `{ id: 'turf-<block>', pos: [x, z] AJ, radius: 34, attackers: 'gang', waves: [{count}…], onWin, onLose, label }`.
   - The HUD follows `raid:wave`.
   - If the raid is refused (one at a time), turf runs its own waves.
2. **`SSX.gang.spawn` / `SSX.gang.spawnCrew`**: no branch has this yet. If it lands, turf calls it with:

   ```js
   { gang, faction, types, count, at: { x, z } /* world */, world: true, hostile: true, src: 'turf' }
   ```

   It expects back either an array of handles (alive while `!dead && alive !== false && hp > 0`) or a number of core agents spawned with `src: 'turf'`. CoS's `SSX.danger.spawnBackup` spawns *allies*, so turf doesn't use it for defenders.
3. **Core fallback** (what runs on main today): `SSX.city.hostiles(types, x, z, { faction, r: 5, src: 'turf', aggro: true })`, i.e. `game.hostiles`.
   - It respects the human cap (8 on phones, 24 on desktop). Spawns that don't fit are retried every second.
   - `SSX.city.npcReserve('turf', n)` is held during a fight.
   - Live defenders are counted with `game.debug.agents()` filtered on `src === 'turf'` within 90 m of the flag.
   - No world patching is needed, because core hostiles are real agents that take bullets, melee and vehicles.
4. **Contraband (PR #9).** If `SSX.contraband` exposes `registerPriceModifier` / `addPriceModifier` / `registerPriceHook` / `addPriceHook` / `onPrice` (fn) or a `priceModifiers` array, turf registers `ctx => priceMultiplier(ctx.district, ctx.pos)`.
   - PR #9 has none today, so this is the **one-line change** for `buyerPrice` in `mars/contraband.js`: multiply its return by
     `(window.SSX?.turf?.priceMultiplier?.(district, pos) ?? 1)`
     where `pos` is the AJ-relative sale position (or omit it to use the player).
   - The multiplier is 1.25 on your turf, +0.05 per extra block (max 1.5), and 1 elsewhere.

## API: `window.SSX.turf`

| Call | Returns |
|---|---|
| `blocks()` | `[{ id, name, owner, ownerName, income, tier, flag:[x,z], centre:[x,z], r, hq, locked, lostBy, status }]` (AJ-relative) |
| `owner(blockId)` | `'saltblood' \| 'dustjaws' \| 'saints' \| 'player' \| null` |
| `ownerAt(pos?)` | `{ block, owner, ownerName }` or null. `pos` is `{x,z}` or `[x,z]` AJ-relative; the default is the player. |
| `attack(blockId, { force }?)` | `{ ok, msg }`. You must be in the ring; when you're far it tracks the block instead. |
| `retreat()` | Abandon the current fight (counts as a loss). |
| `counter(blockId?)` | Start a counter-attack now. |
| `income()` | `{ perMin, pending, earned, blocks }` |
| `fight()` | `null` or `{ kind:'take'\|'defend', block, gang, wave, waves, alive, pending, phase:'alert'\|'gap'\|'fight'\|'raid', timeLeft, engine:'raids'\|'gang'\|'core' }` |
| `priceMultiplier(district?, pos?)` | Contraband sell multiplier. |
| `gangs` | `{ saltblood, dustjaws, saints }` → `{ name, col, blurb }` |
| `stats()` | `{ taken, defended, lost, earned }` |
| `on(event, fn)` / `on(fn)` | Returns an unsubscribe function. Events: `attack` `wave` `captured` `failed` `income` `counter` `defended` `lost` `change`. |
| `open()` / `close()` | Turf panel. |
| `debug` | `goto(id)`, `clearWave()`, `counter(id?)`, `arrive()`, `tickIncome(sec)`, `setOwner(id, owner)`, `reset()`, `state()`, `engine()` |

Every event is also sent as the window event `ssx:turf` and on the core bus as `SSX.emit('turf:<event>')`.

**Persistence:** localStorage `ssx.turf.v1` (owners, who you took each block from, purse, totals), plus the game flag `turf:first`.

**Test:** `tests/test-turf.js`, run with:

```
BASE=http://127.0.0.1:PORT/ DEV=desktop | DEV="iPhone 14" BR=webkit OUT=… node test-turf.js
```
