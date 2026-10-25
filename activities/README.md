# Mars side activities (steve/mars-activities)

Repeatable activity runner for `side-activities.json` (Olympus Row, Red Tape Flats, Helios Heights, Ares Beltway).

- **Entry:** context button near an activity start (`#actCtxBtn`) and ☰ **Mars side jobs** (`#rmActivities`).
- **Hook:** `surface.js` calls `activityTick(dt, ctx)` once per frame (same pattern as `raceTick`). No further core hooks.
- **API:** `registerMission` / `accept` for mission-backed loops; The Pit uses v7.4 `world.challenge` / `inDuel`.
- **Static Hold'em:** `poker.js` + `poker-eval.js` — phone-friendly Texas Hold'em modal (Fold / Check-Call / Raise). Buy-in from game credits. Optional dealer tip (cheat) may set wanted + spawn bouncers.
- **SSX.bark** (Pumpkin #5): used when present for dealer / bouncer / Pit crowd lines; no-op otherwise.
- **Contraband prices** (Marsmania): Blue Drop / Scrap Run read `SSX.contrabandPrice` / `SSX.contraband` / `SSX.price` when present; fixed rewards otherwise.
- **Districts:** nearest of AJ-relative centres until `registerDistrict` lands.
- **Degraded:** Beltway taxi (no smooth-drive meter), Beltway time trial (localStorage best only).
- **Not in scope:** ambient `random-events.json` spawner (CoS encounter director).
