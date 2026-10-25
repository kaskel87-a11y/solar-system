# Mars side activities (steve/mars-activities)

Repeatable activity runner for `side-activities.json` (Olympus Row, Red Tape Flats, Helios Heights, Ares Beltway).

- **Entry:** context button near an activity start (`#actCtxBtn`) and ☰ **Mars side jobs** (`#rmActivities`).
- **Hook:** `surface.js` calls `activityTick(dt, ctx)` once per frame (same pattern as `raceTick`).
- **API:** registers one-shot mission instances via `registerMission` / `accept`; The Pit uses v7.4 `world.challenge` / `inDuel`. Wanted via `setWanted` / `crime` / `securityList`.
- **Districts:** nearest of AJ-relative centres `[0,-430]`, `[-280,-40]`, `[320,80]` (Beltway fallback `[0,-200]`) until `registerDistrict` lands.
- **Deferred:** `act-static-poker` (needs poker resolver).
- **Degraded:** Beltway taxi (no smooth-drive meter), Beltway time trial (localStorage best only — no online leaderboard).
- **Not in scope:** ambient `random-events.json` spawner (Chief of Staff encounter director).
