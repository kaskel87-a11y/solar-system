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

## v7.5 (next)
1. [ ] **Full security combat:** guards take cover, return fire and call backup; they're killable; heavies at 4-5★. Lose stars by hiding or bribing.
2. [ ] **Gorier combat:** blood decals, dismemberment-lite on aliens, heavier hit reactions.
3. [ ] **More missions:** the rest of the Mars story chains (Rook, Vesna, Kestrel, Ines, Rusk), with thug/goon/enforcer waves, hold, choice, pay, tail and nonlethal steps; the cartel storyline's dark choices (betray, spare, execute, take the cut).
4. [ ] **NPC interactions:** dialogue, bribes, hire muscle, buy rumors that mark finds and jobs, random street events.
5. [ ] **Legal duels:** a ⚔️ Challenge option on colony NPCs. Pick fists/melee, blades or a pistol quick-draw at 10 paces, plus an optional wager the NPC matches. A ring forms and a crowd gathers and cheers. The fight goes to KO or yield, not death. Sanctioned: no stars, security watches but doesn't step in, and stray hits on bystanders aren't crimes. The winner takes the pot plus rep/XP, with rematches. Named fighters (a cantina pit champion) pay more, and some NPCs refuse or chicken out. Attacks outside a duel still draw stars. HUD: one small duel banner and pointer-based buttons. Live duel screenshot.

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
