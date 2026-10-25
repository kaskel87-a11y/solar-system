# Roadmap

This is an ordered backlog: future runs take the top unchecked item. Tick items `[x]` when they ship and note the release.

House rules for all of it:
- Adult, gritty, M-rated tone.
- No nudity. Nothing sexual is shown, animated or explicitly described. Adult club content (v7.4) stays costumed, fades to black and sits behind a one-time 18+ prompt.
- No real brands, logos or trademarks.
- Keep the phone HUD minimal: the middle 50% of the screen stays clear, and `tests/test-hud.js` must pass.
- Every feature gets a Playwright test on the iPhone matrix, plus live iPhone 14 WebKit screenshots.

## v7.2 (shipped Oct 25, 2026)
- [x] Air steering for the rover: yaw plus bank and pitch while airborne, responsive on touch.
- [x] Roadster-style cold-gas thrusters: hold Thrust to fly; a fuel bar that recharges on the ground; jets, dust and sound; the blaster works in flight.
- [x] Roadster body kit in the shop (generic, no badges).
- [x] Rover weapon upgrades: Turret Mk II/III, rail cannon, rocket pods, plasma torch, EMP. Switch with the weapon chip; saved in localStorage; works with hostiles off and while flying.
- [x] Installable PWA: manifest, icons, iOS meta tags, safe areas, offline service worker, and a one-time Add to Home Screen hint in ☰.
- [x] Share with friends: Web Share or copy-link from ☰, plus an Open Graph/Twitter share card. Progress is per device.
- [x] GTA-style third-person camera that eases back behind you on foot, in your rover, in stolen rides and in flight.

## v7.3 (shipped Oct 25, 2026)
- [x] **Enterable buildings:** every colony building has a door, a light interior and a job. Walk up for **🚪 Enter** (stores show **🛒 Shop**).
  - Ares Junction (Mars): Cantina (Dutch: drinks, rumors, jobs), Ares Supply, Meridian Depot (rover parts, paint and body), Ozzie's Iron (guns), The Velvet Airlock (club), Colony Security (Deputy Rusk).
  - Freeport (Moon): The Dry Sea (cantina), Freeport Supply, Freeport Arms (guns).
  - The indoor camera pulls in close and stays inside the room. Weapons are holstered indoors.
- [x] **Walk-in shopping:** guns hang on wall racks, gear, ammo and upgrades sit in glass cases, rover parts and paint hang on the depot walls. Each item has a price tag that flips to OWNED/EQUIPPED. Walk up for **🛒 Buy <item> · <price>**, or tap the item. The clerk at each counter has the full list as a fallback menu.
- [x] **Finding the shop:** big outlined **$** on the radar for every store; **🛒 Shop** wins over Pet near a store (7 m around the supply store); ☰ **🛒 Shop** marks the nearest store with a pulsing $.
- [x] **The Velvet Airlock:** neon club with fully clothed costumed dancers (stylized dance loops), a dance floor, bar, booths, Brick the bouncer (20 cr cover; turns you away while you're wanted), and a roped-off VIP room (60 cr) where Ines holds court. No nudity, no sexual content.
- [x] **Gun shop:** Viper SMG (rounds), scoped rail rifle (slugs), frag launcher (grenades), heavy cleaver, plus ammo for each.
- [x] **Max health and ammo:** rare biomod and bandolier finds, two hidden stashes, and buyable Trauma implants I-III (+15 max health each) and Bandolier rigs I-III (+25% ammo each).
- [x] **Security office:** pay Deputy Rusk to make your stars go away (80 x stars² cr; he won't touch 4★+).
- [x] **Story pack, first slice:** Dutch, Ozzie, Vesna and Kestrel missions that the engine can already run (incl. a new "walk into a building" step), with their dialogue and NPC barks. Prerequisites gate later jobs.
- [x] **Tone:** harder-edged dialogue and barks (profanity) from the story pack. No nudity or sexual content.
- [x] **Playtest fixes (v7.2 bug list):** chase-camera pull-in near walls/domes/ship; Land CTA goes to your pick or Mars; offer pill hides Accept/Later; readable Later; Frankie keeps up; credits never truncate; 44 px targets; black-cell/white-text buttons everywhere with ON/OFF toggles (contrast test); bigger desktop HUD; branding/version labels unified.
- [x] **Laptop controls:** ❔ Controls list (☰ or ?), Enter/Backspace accept/skip jobs, E enter/buy, crosshair click-to-buy indoors.
- [x] **⛶ Full screen** ☰ item (Fullscreen API + webkit fallback, hidden on iPhone) and last-input HUD switching for touchscreen laptops.
- [x] **Laptop boost:** Shift boosts every drivable vehicle, a mouse-holdable ⚡ Boost (Shift) button while driving, first-drive hint, no stuck keys after alt-tab.
- [x] **Modding API:** `SSX.registerColony`, `SSX.registerMission`, `SSX.registerInterior`, `SSX.registerMenuItem` (see README).

## v7.4 (shipped Oct 25, 2026)
- [x] **Multi-planet merge (PR #1, steve/multi-planet):** colonies on Venus, Mercury, Titan, Europa and Io, with contacts, jobs, radio, signature rides and walk-in storefronts, plus ☰ 🌍 Colonies fast travel. Core hooks: `registerVehicle(kind, spec, builder)` with `VEHICLE_BUILDERS`, the VEH_ICON fallback to `VEHICLES[kind].icon`, `spec.amphibious` for the Titan skiff, and a `registerBody` stub.
- [x] **Race track merge (PR #2, cos/race-track):** street races, track builder and best-lap ghosts. `raceTick` is hooked in surface.js, and all four files are precached.
- [x] **Barrel rolls:** Q/E in the air or double-tap A/D on a laptop, a double flick of the stick on touch, and the Starship in space. Clean landing = stunt bonus; roof landing = damage.
- [x] **Laptop ☰ fix:** a mouse click on ☰ didn't open it after landing because pointer lock was still held from flight. Landing now frees the mouse, and **M** opens the menu.
- [x] **Touch ghost-click fix** for ☰ entries that open panels.
- [x] **Velvet Airlock strip club (non-explicit):** pole routines in costumes that stay on, stage tipping (make it rain), costumed VIP private dances (letterboxed), and an adult upstairs host who fades to black and restores health. All behind an 18+ prompt.

- [x] **Legal duels:** ⚔️ Challenge on colonists. Fists, blades or a pistol quick-draw at 10 paces, an optional matched wager, a ring with a cheering crowd, and KO or yield (no deaths). Sanctioned, so no stars. Winner takes the pot plus XP; rematches; Grinder Vos the cantina pit champion (minimum 50 cr, house purse); refusals and chicken-outs. A small banner with a 🏳 Yield button.
- [x] **Labelled top-bar meters:** 🛡 SHIELD, ❤ HEALTH and a 🚀 THRUST fuel bar that shows only when you can thrust (orange under 25%). Icons only on phones.
- [x] **BUGS-v7.3 fixes:** mouse-lock chip and no re-lock from top-bar clicks (major 1), indoor camera vs interior walls (major 2, also m2), entry spawn and player fade (m1), 44 px targets (m4), landscape menu vs Pet/Jump (m5), autopilot label (m6), crates block the camera (m3), 'basic' warning (p1), talk offers (p2).
- Carried over to v7.5: ☰ in space view (p7), the VIP back room as the mission hub (p6, ships with mission chains), and the clipping polish items p3/p4/p5.

## v7.5 (shipped Oct 25, 2026): Mars city
- [x] **Three districts** next to Ares Junction, from Steve's pack (additive `registerDistrict`): Olympus Row (downtown, First Junction Trust bank, Red Shift cantina), Red Tape Flats (Saltblood turf, chop shop and dealer lots), Helios Heights (4 mansions to burgle: case the cameras, break in, crack the safe, beat private security, fence it).
- [x] **The Ares Beltway**: 18 waypoints with on/off ramps, traffic, faction checkpoints, billboards and 2 chase set-pieces.
- [x] **Bank and mansion interiors** with vault and safe spots. Safe-cracking uses Ben's `SSX.heist.safeCrack` when it lands, with a timed-hold fallback until then.
- [x] **16 chained city missions** (Vale, Marrow, Rhee, Lita, Kline, Nyx) with case, crack and choice steps. Ines's VIP room has a job board.
- [x] **Security combat**: thugs, goons, enforcers, guards, drones and buggies. Guards take cover and peek, backup arrives, heavies show up at 4-5★, headshots count. Red blood, pools, corpses and gibs for people, sparks for machines (M-rated, no gore on aliens beyond their own goo).
- [x] **☰ in space** and a 🏙 Districts fast-travel sheet. Phones keep the 12-NPC cap.
- [x] **Add-on API** (API.md): `SSX.city` (districtAt, spawnPoints, npcBudget/npcReserve, lots, hostiles, alarms, cameras, choice), the `SSX.on/emit` event bus, mission helpers (advanceStep/failStep/spawnWave), `registerAgentModel` and material slots for v8.
- [x] Merged in v7.5: Steve's 17 repeatable side activities incl. Static Hold'em (PR #4), Pumpkin's radio stations, district ambience and pedestrian barks (PR #5), Jeff's 11 story missions for Rook, Vesna, Kestrel, Ines and Rusk (PR #6).
- [x] **v7.5.1**: Ben's heist mechanics (PR #8): a one-thumb safe-cracking dial now drives every bank and mansion safe, with security cameras and view cones, alarms that raise your wanted level, informant tips and a heist escape event. Private security answers alarms, informant tips mark cameras and guards on the minimap, and there are new add-on helpers (player position, line of sight, safe spots, minimap marks, `registerSurfaceTick`).
- Still to come in v7.5.x point releases: Ben's raccoon scientist, Pumpkin's dealership and garages, Chief of Staff's street danger, Marsmania's contraband economy, Steve's ambient random events.
- Deferred: rook-05 (set on Ceres; Ceres stays out of scope for now).

## v8: realistic visuals
- [ ] Integrate the look-dev materials, lighting and post-processing, with quality tiers (low / med / high). Medium is the iPhone default at 60 fps.

## Future: Collin's ideas (Oct 25)
Not scheduled yet.
1. [ ] **Mars city districts** joined by a highway with traffic and on/off ramps:
   - **The rough side:** gangs, corner dealers and a cheap chop shop.
   - **Downtown:** towers, the bank (the heist target), clubs and cops.
   - **A rich gated community:** mansion burglary missions. Case the place, break in, crack safes and avoid private security.
2. [ ] **Raccoon-themed rover:** masked paint, a striped-tail antenna and a trash-can bumper. Sold at the dealership as the "raccoon mobile".
3. [ ] **Original mad-scientist duo**, written in the spirit of irreverent cartoon pairs but fully original. No names, likenesses, catchphrases or designs from any existing show.
   - A burned-out, drunk genius scientist with a junkyard lab and a portal gun.
   - His anxious teenage sidekick.
   - Each gets its own design and names.
   - They give weird interdimensional missions that portal you to bizarre mini-worlds.

## Later (rough order)
- [ ] Rocks/boulders as obstacles for the rover and player (playtest p1).
- [ ] **Base and structure building:** place habitats, walls, turrets, landing pads and storage.
- [ ] **Space bank heist** in stages: plan (scout and intel), crew (hire specialists), vault (drill/hack under pressure), getaway (pursuit to the ship).
- [ ] **Contraband business** in fictional "space drugs" (e.g. glow-dust):
  - buy low and sell high across colonies;
  - cartel rivals and busts;
  - profits fund upgrades.
- [ ] **Rover dealership and garage:** new rover models, plus customization (paint, wheels, lights, armor, weapons).
- [ ] **Rags-to-Riches mode:** a fresh save starting at $0, with side jobs such as cargo runs and taxi delivery.
- [ ] **Themed garages and car meets** to show off builds.
- [ ] **Director / free-roam mode:**
  - weather, including dust storms;
  - time-of-day control;
  - zero wanted level.
