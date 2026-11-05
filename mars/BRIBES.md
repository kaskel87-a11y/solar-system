# Mars dirty cops and bribes (`mars/bribes.js`, `window.SSX.bribes`)

Grease a ColSec officer when they're about to put hands on you. Buy your way out of a pull-over. Keep Deputy Rusk's precinct desk on retainer. This is M-rated fiction: crooked cops, snitching, and evidence that walks out of the locker. It's one `<script type="module">` hook and adds no new police system.

## What it builds on (no duplicates)
- **Stars, security units, busts and backup** stay in `world.js` (v7.4 security combat). Every outcome goes through `world.setWanted` or `world.crime`. Detection reads `world.securityList()`, `world.debug.people()` guards and `world.debug.bustT()`.
- **Street danger (CoS #3/#19)** stays not-police, and bribes.js doesn't touch danger.js. `ev-cop-shakedown` and `ev-colsec-checkpoint-surprise` in random-events.json are still stubs in ambient.js (it has no ColSec NPCs). The pull-over stop here is the playable version of that "ambient bribe stop", and it reuses its line ("License, registration, and your sense of optimism.").
- **Deputy Rusk (Jeff, storymars + barter.json)** is the crooked precinct contact, with no new NPC. His rows (`rusk-wipe-1`, `rusk-wipe-2`, `rusk-raid-tip`) are untouched. Three more services join the same "RUSK TAKES wall" in Red Tape Flats (-270, -24) through `SSX.contraband.registerOffer`, so they appear in his existing 🤝 trade list with the same NPC name. `rusk_protection` and `rusk-01-protection` unlock the "Name-drop Rusk" bribe.
- **Contraband `wanted` / `wanted_clear` barter** (Dorsey, Rusk) stays as it is. `contacts()` lists those offers next to the desk services.

## How to trigger it
- **On the spot:** get 1★ or more on Mars and let a ColSec officer, buggy, heavy or guard reach you (within about 13 m, or when world.js starts its bust timer). A bar appears at the top of the screen with the officer's name, their personality and a tell, plus:
  - **💸 Grease him · N cr**. Desktop hotkey **`;`** pays with the first option you can afford.
  - **💊 Pay in product**: street value of at least 1.25× the price, cheapest items first.
  - **🐀 Snitch on <gang>**: costs that gang 10 rep through `SSX.rep.add`. Each gang has an 8-minute cooldown.
  - **📝 Sell out a tip**: a heist or burglary tip you bought from contraband.
  - **🪪 Name-drop Rusk**: only once you're under his protection.
- **Pull-over:** when you're driving with 0★ in Olympus Row, the Beltway, Ares Junction or Helios Heights, roughly a 5–20% chance every 45 s (higher in a stolen ride, while carrying product, or with priors). There's a 6-minute cooldown, and no stops while a patrol sheet is active. The same bar adds **Comply** and **Floor it**, plus a 14 s timer; if it runs out, you comply.
  - **Comply:** a stolen ride gets 1★. If you're carrying product, there's a 60% chance it's seized plus 1★ (30% with a patrol sheet). Otherwise it's a 25 cr fine.
  - **Floor it:** 2★.
- **Rusk's desk:** the 🤝 ring at Rusk's wall in Red Tape Flats, or `SSX.bribes.offer('record' | 'tipoff' | 'evidence')`.
  - **Clean record:** wipes every ★ and your priors. Costs 150 + 140×stars + 40×priors cr, minus a dirty-rep discount; 30-minute cooldown.
  - **Patrol sheet** (150 cr): for 15 minutes, no stops, cops are 25% cheaper and refuse less, and you get 📻 warnings on turf counter-attacks and rep revenge raids. It also calls `SSX.raids.warn` and gives a `{type:'patrol'}` heist tip (the active heist, or the first heist without one).
  - **Lost evidence:** buys back what ColSec seized in the last 45 minutes for 40% of its street value. That covers undercover busts, barter busts, stash confiscation on a bust, product bagged after a refused bribe, and pull-over seizures.

## Price and refusal
- **Spot price:** `(70 + 110×stars) × repMult × (1 + 0.1×priors) × night 0.8 × greedy 1.5 × tip-off 0.75`, rounded to 5 cr.
  - `repMult = clamp(1 − colsec/250 − max(0, colsec_dirty)/400, 0.5, 1.6)`.
  - A stop costs 60, +60 when carrying product, +80 in a stolen ride.
- **Night:** `SSX.time.isNight()`, then `SSX.beltway.isNight`, then dangercore's Mars clock (20:00–05:00).
- **Personality** is rolled per cop:
  - straight arrow: 25% (40% in Olympus Row and Helios Heights), less with dirty rep
  - greedy: 25%
  - on the take: the rest
- **Refusal chance:** `base (straight 0.75 / greedy 0.2 / on take 0.06) + 0.07×stars (+0.15 at 4★+) − colsec/400 − dirty/300 − night 0.06 − tip-off 0.15 + 0.04×priors`, clamped to 2–95%.
  - Favors and tips get −0.05.
  - A name-drop has a 4% refusal chance, or 85% to a straight arrow.
- **Refused:** the cop escalates one of three ways: +1★, backup (at least 3★, or 2★ at a stop) or a bribery crime through `world.crime`. You also get +1 prior, `colsec` −4, and any product you offered is bagged as evidence.
- **Paid:** at 1–2★ the heat's off. At 3★ or more one cop can't call off the precinct, so it drops by 2★. You get `colsec_dirty` +3 (+1 for a name-drop) and `colsec` +1.

## API
- `price(opts)`: opts are `{ kind:'spot'|'stop'|'record'|'tipoff'|'evidence', stars, colsec, dirty, night, personality, priors, tipoff, contraband, stolen }`. Anything left out uses the live value.
- `offer(kind, opts)`, where kind is one of:
  - on the spot: `cash`, `product`, `favor` (`opts.gang`), `tip`, `namedrop`
  - at a stop: also `comply` and `run`
  - at the desk: `record`, `tipoff`, `evidence`
  - `opts.force` = true always accepts, `'refuse'` always refuses (for scripted scenes and tests).
  - Returns `{ ok, refused?, escalation?, cost, pay?, stars?, chance?, msg }`.
- `encounter`: the live bribe moment, or null.
- `contacts()`: Rusk with his desk and story services, plus Dorsey when barter has him.
- `record()`: `{ priors, seized, tipoffSec, stats }`.
- `isNight()`, `personalities`, `hotkey`.
- `on(event, fn)`. Events: `offer`, `paid`, `refused`, `stop`, `comply`, `run`, `record`, `tipoff`, `evidence`, `snitch`, `seized`, `warn`. They're also sent as window `ssx:bribe` and `SSX.emit('bribe:<type>')`.
- `debug`: `stop(o)`, `spot(o)`, `clear()`, `night(bool|null)`, `personality(p|null)`, `seize(item, qty)`, `priors(n)`, `tick()`, `state()`, `reset()`, `refuseChance(kind, o)`.
- State is saved in localStorage `ssx.bribes.v1`.

## Notes for other bots
- **CoS:** no danger.js changes. If ambient.js ever wants the cop shakedown / checkpoint events to run, it can call `SSX.bribes.debug.stop({ personality })` (or a future `stop()`) instead of spawning ColSec NPCs. The `ssx:bribe` `refused` event fires after the stars go up, if the director wants to react.
- **Jeff:** Rusk's story rows are untouched. To gate story beats, use `SSX.bribes.record().priors`, or listen for `ssx:bribe` `record` / `paid` events. `rusk-03-ia:betray` (setWanted 0) still works as before.
- **Rep (PR #20):** uses `colsec` and `colsec_dirty` (the barter channel), and snitching hits the gang ids. Everything is guarded, so on main without rep, prices use rep 0 and nothing breaks.
- **Hotkey:** `;` is only live while the bar shows. There's no menu item or dock button, so the HUD stays minimal.
- **Test:** `BASE=http://127.0.0.1:<port>/ BR=webkit DEV="iPhone 14" OUT=<worktree>/shots/bribes/ node tests/test-bribes.js` (or `DEV=desktop`), one browser at a time.
