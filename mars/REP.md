# Mars faction reputation (`mars/rep.js`, `window.SSX.rep`)

Every crew in Ares Junction keeps score on you, on a scale from -100 to +100 where 0 is neutral. The module is self-contained: one `<script type="module">` hook in index.html. It **listens** to the other Mars modules and doesn't patch them. M-rated fiction with invented crews and no real brands.

## See it in game
- Land on Mars. Open the panel with ☰ → **🩸 Rep**, the key **`** (backquote), or the phone dock button **🩸 Rep**. The dock button only appears when the shared `#ssxDock` exists (it's owned by mars/turf.js from v7.5.3); this module never creates a dock.
- The panel shows a two-sided tier bar for each gang (Marked on the left, Neutral in the middle, Family on the right), the last thing that moved it, what that crew's corners pay you, a 📞 backup button at Trusted or higher, and your barter-contact standings.
- Changing tier triggers a short toast, for example `🩸 Saltblood: Neutral → Marked. You're MARKED by Saltblood. They shoot on sight.`

## Ids (lowercase slugs; `get()` of an unknown id returns 0)
| id | who | aliases |
|---|---|---|
| `saltblood` | Saltblood (turf.js gang, Red Tape Flats) | `salt-blood` |
| `saints` | Vacuum Saints (turf.js gang) | `vacuum-saints`, `vacuum_saints`, `saint`, `Vacuum Saints` |
| `dustjaws` | Dustjaw Boys (turf.js gang) | `dustjaw`, `dustjaw-boys`, `dustjaw_boys` |
| `junkies` | dust-heads and muggers | `junkie`, `dust-heads` |
| `colsec` | Colony Security | `security`, `colony-security`, `colsec_downtown` |
| `ozzie`, `colsec_dirty`, `velvet`, `cantina`, `helios_staff`, `free_operators`, `quiet` | barter.json contact channels | `rusk` → `colsec_dirty`, `helios` → `helios_staff` |

The canonical ids follow turf.js `GANGS` and the `ssx:npc-down` `faction` slugs from CoS PR #19 (`junkies`, `saltblood`, `dustjaws`, `saints`).

## Tiers
| Tier | Range | Street price on their corners |
|---|---|---|
| Marked | -100 to -60 | ×0.70 |
| Hated | -59 to -30 | ×0.80 |
| Wary | -29 to -10 | ×0.90 |
| Neutral | -9 to 9 | ×1.00 |
| Known | 10 to 29 | ×1.05 |
| Trusted | 30 to 59 | ×1.12 |
| Family | 60 to 100 | ×1.20 |

## What moves rep (listeners, all guarded)
| Source | Event | Effect |
|---|---|---|
| turf.js | window `ssx:turf` `attack` / `captured` / `defended` / `lost` | that gang -5 / -12 (the other gangs +2) / -4 / +3 |
| street danger | window `ssx:npc-down` `{x, z, name, faction?}` within 35 m of you (escorts ignored) | gang -4, junkies -2, colsec -5. If `faction` is missing, the name is parsed instead. Capped at -20 per crew per minute |
| game.js kills | `SSX.on('game:poof')` (human agents) | guards: colsec -3 (Helios private security: helios_staff -1). Gang agents: -2 to whoever you're fighting (turf fight, then the last rep hit squad, then the owner of the turf you're on) |
| jobs.js | window `ssx:job` `complete` / `fail` | vigilante: colsec +3, and -8 to the gang if the mark is theirs (e.g. Saltblood Kel). Paramedic: +6 to the patient's gang (junkies +4); a failed run on one of theirs is -2 |
| beltway.js | window `ssx:beltway` | `shakedown`: the booth's faction -6 (ColSec -5). Armored payout: colsec -8. Hijack cargo: colsec -1. Fencing: saltblood +1 |
| contraband.js | `SSX.contraband.on()` | selling on a gang's corner: -2 (-3 if seen), or +1 "street tax" at Known or higher; junkies +1. Bust: colsec -3. Barter: +3 to each faction in the offer's `rep.factions` |
| story | `SSX.on('game:quest')` `done` | +8 to the matching channel (marrow/vesna/wrench → saltblood, ozzie, rusk, ines → velvet, dutch → cantina, porter/torque → helios_staff, nyx/dorsey/halloran → free_operators, rook → quiet) |

**Seed.** On the first load, Saltblood starts at `round(flagCount × 100/3)`, clamped to ±100. `flagCount` is the number of player flags matching dangercore's `/^vesna-|saltblood/`. The module uses `DC.flagsToRep` / `DC.SALTBLOOD_FLAG` when dangercore exports them (PR #19) and mirrors the formula otherwise, so talk-down odds don't jump. Other channels get +8 for each matching story quest already done. rep.js writes **no** game flags, because a `rep:saltblood:*` flag would feed back into that count.

## Effects
- **Prices:** `priceMultiplier(idOrDistrict?, pos?)` returns the tier factor of the crew that owns the corner. It uses `SSX.turf.ownerAt` when turf is loaded; otherwise the Flats count as Saltblood turf. contraband.js has no price-hook registry on main, so rep.js probes for one the same way turf.js does (`registerPriceModifier` / `addPriceModifier` / `priceHook` / `registerPriceHook` / `priceModifiers[]`). Until one exists, contraband needs one guarded line (see the notes below).
- **Barter unlocks:** contraband's `repOf(f)` calls `SSX.rep.get(f)` and compares it to `offer.rep.factions[].min`. Every barter.json channel is tracked, so `min: 0` offers stay open at Neutral and higher-tier offers open as you earn rep.
- **Hostile on sight:** on Hated or Marked turf, every 20 s there's a 20% (Hated) or 50% (Marked) chance of a 2–3 man hit squad from `game.hostiles(types, x, z, { faction, src: 'rep' })` 16 m away (2 men on phones). The cooldown is 3 minutes (Hated) or 90 s (Marked). It's skipped indoors and during turf fights.
- **Revenge raids:** every 4–8 minutes, a gang at Hated or below may run `SSX.turf.counter(blockId)` on a block you took from it. turf rides Steve's `SSX.raids` engine itself when that's loaded. With no turf but `SSX.raids` present, it falls back to `SSX.raids.start({ id: 'rep-<gang>', attackers: 'gang', … })` on your position.
- **Backup:** at Trusted or higher, `backup(id)` or the panel button calls `SSX.danger.spawnBackup({ faction, count: 2|3, durationSec: 90|150 })` with a 5-minute cooldown. A crew at Trusted or higher may also jump in on its own (50%, or 85% at Family) when another gang attacks or counter-attacks your turf, or when a raid starts. If a different crew's escort is already out, the call is refused instead of extending theirs. On main only `saltblood` is in `BACKUP.factions`, so dustjaws and saints fail softly with "don't run escorts yet". PR #19 adds both.

## API
`get(id)`, `tier(id)` → `{ id, name, min, max, rep, faction }`, `add(id, delta, why)`, `all()`, `on(event, fn)` (`change`, `tier`, `hostile`, `raid`, `backup`, or `on(fn)` for all), `priceMultiplier`, `gangAt(pos?)`, `backup(id?)`, `open()`/`close()`, `canon(id)`, `ids`, `factions`, `tiers`, `aliases`. Also `debug.set(id, v)`, `reset()`, `seed()`, `hostile(id?)`, `raid(id?)`, `tick(sec)`, `state()`, `log()`. Events also go out as window `ssx:rep` and `SSX.emit('rep:<event>')`. State lives in localStorage `ssx.rep.v1`.

## Notes for other modules
- **contraband (one line, when convenient):** in `buyerPrice`, multiply by `window.SSX?.rep?.priceMultiplier?.(d, pos) ?? 1`, guarded like PR #18's `turfMult`. Or add a `registerPriceModifier(fn)` and rep.js plus turf.js will register themselves.
- **danger / CoS:** `talkChance` reads `SSX.rep.get('saltblood')` itself. Hostile squads are `game.hostiles` agents with `faction: 'Saltblood' | 'Vacuum Saints' | 'Dustjaw Boys'`. An optional `faction` on `game:poof` would make kill attribution exact.
- **Story chains:** gate on `SSX.rep.get(id) >= n` or `SSX.rep.tier(id).id === 'trusted'`.
- Test: `BASE=http://127.0.0.1:<port>/ BR=webkit DEV="iPhone 14" OUT=<worktree>/shots/rep/ node tests/test-rep.js` (or `DEV=desktop`), one browser at a time.
