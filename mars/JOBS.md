# Mars jobs (Marsmania v7.5): TAXI · PARAMEDIC · VIGILANTE

`mars/jobs.js`, loaded by one `<script type="module">` line in `index.html`. Nothing else in core is touched.

## Playing
| Job | Start | Loop | Scales with level |
|---|---|---|---|
| 🚕 Taxi | 🚕 TAXI STAND beacon by Ares Supply (AJ −24, 40), **or** the "🚕 Taxi duty" button whenever you're in any vehicle, or ☰ → 💼 Jobs | Drive to the yellow 🚕 FARE beam, stop beside them, drive them to the 🏁 DROP-OFF in another district. Pay = distance fare + tip (time left × smooth-driving %). Crashes cost 22% smooth and jumps cost 8%. If you're late the fare decays and there's no tip, and at 40 s over they bail. Leave the car for 8 s and they bail too. | Drops 110 m → 460 m away, tighter par time, +20%/level pay |
| 🚑 Paramedic | Any ✚ clinic beacon (Ares Mercy Clinic AJ 46, 30; Olympus Trauma Bay; Heights Med Spa; Flats Free Clinic) or ☰ → 💼 Jobs | Reach the 🩺 PATIENT (red beam) on the clock, get out and tap **🩺 Stabilise** (G) 3+ times, get in any vehicle within 25 m to load them, then drive to the nearest clinic (relative to the pickup) before they flatline. Uses danger.js downed NPCs when reported (see hooks). | Farther calls, shorter clocks, more stabilise taps (3 + L/2) |
| 🎯 Vigilante | 🎯 BOUNTY BOARD beacon behind Colony Security (AJ −2, −52) or ☰ → 💼 Jobs. Refused at ★★+ wanted. | Track the magenta beam. Within 30 m the mark runs. Shoot (auto-aim works), melee or ram them (>7 m/s). Bounty + quick-work bonus. Shots near the mark aren't a "discharging a weapon" crime. A clean job knocks one wanted star off, but stars you earn on the job (bystanders) cut the bounty by 40%. | HP 3 + L, faster runners, armed from L3 (they shoot back), shorter timers |

Every **5 completions = +1 level** (max 10). After a success the shift goes on with the next fare, call or bounty. **Stop** is in the HUD, or tap the same beacon again. Keys: **J** jobs panel, **G** job action. HUD (top centre, below the minimap on phones): job, level, timer, pay, objective, distance and compass direction.

## API: `window.SSX.jobs`
```js
SSX.jobs.start('taxi' | 'paramedic' | 'vigilante') // -> { ok, msg }
SSX.jobs.stop()                                     // -> { ok }
SSX.jobs.level('taxi')                              // -> 1..10
SSX.jobs.stats()   // -> { taxi:{done,fails,earned,best,level,next}, paramedic:{…}, vigilante:{…}, earned, active }
SSX.jobs.active()  // -> null | { type, level, stage, text, timeLeft, pay, smooth?, dist, target:{x,z} }  (AJ-relative)
const off = SSX.jobs.on('complete', e => …)         // or on(fn) for every event; returns unsubscribe
// events: start · stage · complete {pay, base, tip, xp, note} · fail {reason} · stop {reason} · levelup {level} · change
SSX.jobs.open() / close() / places() / stabilise()
SSX.jobs.reportDowned({ x, z, name?, world: true })  // feed a downed NPC into the next paramedic call
SSX.jobs.debug.goto() / complete() / setDone(type, n) / reset() / target() / hit(dmg)   // tests
```
It also dispatches `window` event `ssx:job` (same payload). Persistence: localStorage `ssx.jobs.v1`, plus game flags `jobs:<type>:L<n>` saved with the game.

## Hooks (all guarded and optional)
- **danger.js (cos/street-danger):** today it emits nothing public, so jobs.js spawns its own downed colonists. It listens for `window` events `ssx:npc-down`, `danger:npc-down` and `danger:down` with `detail { x, z, name? }` (world coords; `aj: true` for AJ-relative). It also listens for `SSX.danger.on('down' | 'npcDown' | 'fight', fn)` and polls `SSX.danger.downed()`. One line in danger.js `killNpc` would wire it: `window.dispatchEvent(new CustomEvent('ssx:npc-down', { detail: { x: n.x, z: n.z, name: n.name } }))`.
- **world.js:** it chain-wraps `hitWorld`, `targets`, `meleeTarget`, `meleeWorld`, `blast` and `shotFired`, in the same way as CoS's `patchWorld`. It always falls through to the previous function, so it stacks with danger.js. It reads `wanted` and `setWanted`.
- **Activity runner (steve/mars-activities, PR #4):** not on main, so jobs.js runs its own throttled tick. It exports `jobsTick(dt, ctx)` so a shared `activityTick` can call it later.
- `SSX.registerMission` isn't used. Its quests are fixed-coordinate step lists, and jobs are procedural and endless.
