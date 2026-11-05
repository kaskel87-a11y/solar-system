# Raccoon Rover (add-on)

Files: `mars/raccooncore.js` (pure: spec, lines, loot/pickpocket rolls, heat, rate limiter, save), `mars/raccoonrover.js`
(mesh, junkyard, dumpsters, co-pilot, dock button, wiring). Tests: `tests/test-raccoon-unit.mjs`, `tests/test-raccoon.js`.
Hooks: one `<script type="module">` line in index.html, the import map (`tools/importmap.py`) and one sw.js precache line.

- **Where:** Red Tape Flats junkyard, district-local `[-30, 38]` (AJ-relative `[-310, -2]`), added to the `mars-rough`
  district's parked vehicles. A `🦝 1200 CR` sign floats over it until you own it. 8 dumpsters (3 in the junkyard).
- **Buy:** walk up, tap `🦝 BUY 1200` on the dock (or press **5**). **Steal:** just get in (E / Drive): heat goes to at least
  wanted + 1 (`world.setWanted`). Both grant the ride to the garage with `SSX.garage.grantVehicle('raccoon_rover', { active: false, noPlates: stolen })`.
  Not listed at Red Line Motors (`dealer: false`).
- **Rocket, the co-pilot** rides shotgun and snarks through `SSX.bark` (categories `raccoon_*`, added at runtime with
  `SSX.registerBarks`, so barks.js is untouched). His caption is pinned above the car. Triggers: `game:crash`, `game:stunt`,
  `game:down` (busted), `game:wanted`, idling 25 s, loot, pickpocket, buy/steal, `SSX.gravity.on` mode changes and
  `SSX.airRoll.on('land' | 'crash')` when those exist. Own rate limit (6 s global, 14 s per category).
- **Loot:** crawl (≤ 6 m/s) within 4.5 m of a parked car or a dumpster: credits (or a junk item into
  `progress.raccoonStash`), toast, 10 s gap, dumpsters refill after 3 min, each car once. 12 % chance a witness adds +1 heat.
- **Pickpocket:** key **5** or the `🦝 PICK` dock button (in the rover at ≤ 3 m/s, or on foot within 9 m of it): Rocket runs
  to the nearest colonist / contact / guard within 14 m. Success pays (guards pay more, succeed less); failure is +1 heat
  and he legs it back. 20 s cooldown.
- **Paused** while `SSX.gravity.floating`, indoors, during races / drag races and during jobs. No NPCs are spawned.
- API: `SSX.raccoon.state`, `buy()`, `pickpocket()`, `on(fn)`. Save: `localStorage['ssx.raccoonRover.v1']`.
