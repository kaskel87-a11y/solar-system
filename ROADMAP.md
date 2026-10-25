# Roadmap

This is an ordered backlog: future runs take the top unchecked item. Tick items `[x]` when they ship and note the release.

House rules for all of it:
- Adult, gritty, M-rated tone.
- No nudity and no sexual content or interactions.
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

## v7.3 (next)
1. [ ] **M-rated tone pass.**
   - Profanity in dialogue and radio chatter.
   - Gorier combat: blood decals, dismemberment-lite on aliens, heavier hit reactions.
   - A cartel storyline with dark choices that have consequences (betray, spare, execute, take the cut).
   - No nudity or sexual content.
2. [ ] **Enterable buildings** (interiors with doors and a camera that works indoors):
   - Cantina.
   - Gun shop.
   - Depot.
   - **The Velvet Airlock:** a neon dance club with fully clothed dancers, a bar, a bouncer at the door, and a VIP back room that is the mission hub. No nudity, no sexual interactions.
3. [ ] **Gun shop:** new on-foot weapons (e.g. SMG, revolver, scoped rifle, grenade launcher), each with its own ammo type and price.
4. [ ] **Max health and ammo:**
   - Rare finds in the world permanently raise max health or max ammo.
   - Buyable max upgrades at the shops.
5. [ ] **Full security combat:**
   - Guards take cover, return fire and call backup.
   - They're killable.
   - The response escalates with wanted level: patrols, then armed squads, then drones/APCs.
6. [ ] **More missions:**
   - A chain of missions per contact.
   - **NPC interactions:** talk, bribe, hire muscle, buy rumors (which reveal finds and jobs), and random street events.

## Later (rough order)
- [ ] **Base and structure building:** place habitats, walls, turrets, landing pads and storage.
- [ ] **Race track** with a simple track builder (checkpoints, ramps, lap timer, ghost runs).
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
