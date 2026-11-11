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
- [x] **v7.5.1**: Marsmania's contraband economy and barter (PR #9), Jeff's guarded barter hooks, and fixes from the v7.4 playtest (duel camera, rocks and crates blocking the camera, the Security pay-off spot, the world name in the top bar, 44 px race buttons, gentler builder pinch).
- [x] **v7.5.2**: Chief of Staff's street danger (PR #3), Marsmania's taxi / paramedic / vigilante jobs (PR #12), Ben's Raccoon Mobile and Silas & Tam portal missions (PR #11), and a single import map that owns the module version (no more duplicate module copies).
- Deferred: rook-05 (set on Ceres; Ceres stays out of scope for now). The Mars First Junction Trust job (rook chain in storymars2) is a surface heist, not the space-bank item below.

### Shipped in v7.5.x after Oct 25 (reconciled Nov 5, 2026)
These were still listed as "to come" or left unchecked. The code and `git log` show them on main:
- [x] **Street danger** (Chief of Staff, PR #3): muggings, ambient fights, street chases. In by v7.5.2 (Oct 25). Ambient vignettes ride along in `ambient.js`.
- [x] **Contraband economy** (Marsmania, PR #9): buy/sell, heat, busts. In by v7.5.1. Later: Hydro Den black market (v7.5.25), grow racks (v7.5.30), Sister Nettle buys (v7.5.32), outlaw grow op at Red Static Gulch (v7.5.54), farm one-tap loop (v7.5.63).
- [x] **Raccoon scientist duo** (Ben, PR #11 and PR #37): Silas & Tam, portal missions sci-01..10, Raccoon Mobile. Oct 25, 2026.
- [x] **Rover dealership and garages** (Pumpkin, PR #7, Oct 25): Red Line Motors, lock-ups, paint / wheels / kits / armor / weapons. Later: bigger lot (v7.5.45), partner buy-in and fencing stolen rides (v7.5.52), showroom dome (v7.5.64).
- [x] **Night car meets** (same PR #7): show off a build, quarter-mile drags, circuit races. See the themed-garage line below for what is still open.
- [x] **Rags-to-Riches mode** (Steve, PR #13, Oct 25): ☰ → New Game: Rags to Riches. Broke start, properties, raids. `modes/rags.js`.
- [x] **Director / free-roam** (Steve, PR #17, Oct 25): ☰ → Director. Dust storm, time of day, freeze / time scale, and no cops (wanted stays 0). `modes/director.js`.
- [x] **Mars dust storms** as weather, not only the Director toggle (Steve, PR #50, v7.5.5).
- [x] **Owned-business beams** (v7.5.51), **Red Line showroom dome** (v7.5.64), **Velvet Airlock expansion + Ines arc** (v7.5.57), **Planum Australe ice cap** snowboarding and snow bowling (v7.5.55), **farm + outlaw grow op and the sandworm** (v7.5.54), **Slick's stall / Yeti suit** (v7.5.68–v7.5.70), **Slick's open-west shop lobby** (v7.5.73), **red sky beam over Red Static Gulch** (v7.5.71).

## v8: realistic visuals
- [ ] Integrate the look-dev materials, lighting and post-processing, with quality tiers (low / med / high). Medium is the iPhone default at 60 fps.

## Future: Collin's ideas (Oct 25)
These three shipped with the Mars city work. Left here so the next run does not rebuild them.
1. [x] **Mars city districts** joined by a highway with traffic and on/off ramps. **v7.5 (Oct 25, 2026):** Olympus Row, Red Tape Flats, Helios Heights, and the Ares Beltway. Same work as the v7.5 section above.
2. [x] **Raccoon-themed rover.** **Oct 25, 2026 (PR #11, in v7.5.5):** the Raccoon Mobile, sold through the dealership.
3. [x] **Original mad-scientist duo.** **Oct 25, 2026 (PR #11 and PR #37):** Silas and Tam, junkyard lab, portal missions sci-01..10. No borrowed names or designs.

## Later (rough order)
- [x] Rocks/boulders as obstacles for the rover and player (playtest p1). **v7.5.41 (Nov 1, 2026):** big boulders out in the wastes stop you on foot and stop your rides (glancing hits slide round, head-on at speed is a crash); jet or fly over the top and they don't count; auto-unstick won't hop you through a rock; colony districts and the Beltway are swept clear of boulders. `tests/test-boulders.js`.
- [x] **Base and structure building:** place habitats, walls, turrets, landing pads and storage. **v7.5.4 (Oct 25, 2026):** buy a lot, walls, gates, garage, stash, turrets (`base.js`). **v7.5.72 (Nov 5, 2026):** habitat (walk to the door, tap 🛌 Rest; full heal on a 3-minute cooldown) and landing pad (stand on it, tap 🛬 Call rover; the ride sets down and refuels). Find it: ☰ → 🏠 Mars base, or the FOR SALE post on Junction Ridge / the Flats scrap lot / Helios Ridge. Still later, not this item: a walk-in hab interior, and calling the starship itself down onto the pad (death still dumps you at the hospital or the lockup).
- [x] **Space bank heist** in stages: plan (scout and intel), crew (hire specialists), vault (drill/hack under pressure), getaway (pursuit to the ship). **v7.5.82:** the whole orbital job. ☰ → 🏦 Space bank, or walk up to Nix Calder at the Ares spaceport (waypoint from that panel, 🏦 JOB on the spot). Scout three buoys, hire a drill / hacker / wheel (a hand you already hired covers their role free; crime-break sit-downs bump the cut), dock, pulse the drill, crack the dial with `SSX.heist.safeCrack`, then burn for Mars while cutters chase. Alarms queue wanted stars and land through `SSX.heist.alarm`. The Mars First Junction Trust job stays the surface heist. `spacebank.js`.
- [x] **Contraband business** in fictional "space drugs" (e.g. glow-dust). **v7.5.1 (Oct 25, 2026)** plus the Hydro Den, grow racks, Nettle, and the gulch grow op (through v7.5.63). Buy low, sell high, heat and busts, profits into upgrades.
- [x] **Rover dealership and garage:** new rover models, plus customization (paint, wheels, lights, armor, weapons). **Oct 25, 2026 (PR #7)**, lot growth v7.5.45, partner buy-in v7.5.52, showroom dome v7.5.64.
- [x] **Rags-to-Riches mode:** a fresh save starting broke, with side jobs. **Oct 25, 2026 (PR #13).** ☰ → 🧱 New Game: Rags to Riches. Starts at 25 cr, not a literal $0, with a crash pad in Red Tape Flats.
- [x] **Car meets** to show off builds. **Oct 25, 2026 (PR #7):** night lot south of Ares Junction, 📸 Show off, drag races, circuit races.
- [x] **Themed garages:** the lock-ups had one look. **v7.5.91:** restyle the Red Line lock-up as Scrap (240 cr), Neon (480 cr) or High-roller (1,400 cr). Each look changes the bay you stand in: light color, wall and floor, props and the sign, plus a pulse, a flicker, or a gold shimmer. Bought per garage and saved in `localStorage` key `ssx.garagetheme.v1`. Find it: walk up and tap **🔧 Garage**, then **🎨 Look**. Or ☰ → **🚗 Rides & meets** → **🎨 Restyle lock-up**. If you are not there, an on-screen arrow points at the bay. `tests/test-garagetheme.js`.
- [x] **Director / free-roam mode.** **Oct 25, 2026 (PR #17).** ☰ → 🎬 Director.
  - weather, including dust storms;
  - time-of-day control;
  - zero wanted level (🚫 No cops).
