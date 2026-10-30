# The Junkyard Lab: Silas & Tam (Mars, Ares Junction)

All game fiction. M-rated like the rest of the game: swearing, crime and violence are fine; no sexual content.
An original duo, written to sit in the "burned-out genius + anxious kid sidekick" tradition without borrowing
anybody's names, looks, catchphrases, colours or portal design.

## The duo

**Dr. Silas Muckridge** — burned-out rift physicist, junkyard landlord, functioning alcoholic (barely).
- Look: tall and gaunt, shaved head, a grey braided beard, amber-lensed welding goggles pushed up on his forehead,
  olive work coveralls with the sleeves tied round his waist over a scorched off-white undershirt, a steel flask
  permanently in his right hand.
- Gear: the **Rift Pistol**, a duct-taped nail gun with a cracked magenta glass bulb on the front.
- Voice: slow gravel drawl. Calls everyone "colleague". Treats physics like scripture and sobriety like a rumour.
- Lines: "Science is just swearing with numbers." · "The multiverse is infinite, and every single version of me is out of ice."
- History: ran the Meridian rift programme until the third incident. The programme was shut down; Silas was not.
  He bought the scrapyard east of Ares Junction with his severance and a lie, and has been opening doors to
  places he shouldn't ever since, mostly looking for a better bar.

**Tamsin "Tam" Okafor** — sixteen, his very anxious lab assistant, keeper of the incident reports.
- Look: short and stocky in a big purple puffer vest over a grey thermal, curly black hair, oversized orange
  ear defenders, white trainers, a clipboard she never puts down.
- Voice: fast, apologetic, narrates her own panic. Counts things to calm down (the lab has 212 rivets).
- Lines: "Okay. Okay okay okay. That's fine. That's a normal amount of teeth." · "I've started a spreadsheet of things that tried to eat me. It has tabs now."
- History: took the job for credits for her mum's habitat rent. Stays because somebody has to make sure he comes back.
  Braver than she sounds; she's the one who actually reads the permits.

## The lab

`JUNKYARD LAB` (inside: **Muckridge Applied Catastrophics**), Ares Junction-relative **[46, -34]**, 8×5 m, door on the south face.
Junk yard: a rolled-over buggy at [40, -45] and scrap heaps at [51, -28] / [55, -13].
The portal opens at **[55, -22]** only while a job needs it: a magenta ring with an amber rim and a dark violet
centre (deliberately not a green swirl). Walk in on foot (it won't take vehicles); the dimension's south door has
a magenta "⟲ HOME (MARS)" ring and drops you back next to the portal.

Placement checks (tests/test-scientists-unit.mjs): > 12 m from every segment of Steve's Ares Beltway, > 15 m from
AJ Trust [-4,-40], Meridian tower [-4,-52], Gus's lot [-60,-4] and the district centres, no overlap with any Ares Junction
block, inside the flat zone (< 62 m), clear of Rook [36,-26] and Vesna [8,24].

## Dimensions (one room each, ≤ ~25 draw calls, repeats instanced)

| id | name | objective | hazard |
|---|---|---|---|
| automat | The Automat | 3 exact-change tokens | vending machines charging across the floor |
| gravbog | The Upside-Down Bog | 3 bog orchids | mud geysers slamming down from the "ground" above |
| waitroom | The Waiting Room | tickets 1-2-3 in order, then Permit 77-B | queue marshals |
| pantry | The Giant's Pantry | Silas's flask (you're 2 cm tall) | rolling peas the size of cars |
| lounge | The Last Bar | 3 pages of *Unified Hangover Theory* | stumbling alternate Silases |

## Missions (registerMission, chained with `requires`)

1. **sci-01 Exact Change** (Silas): dig the rift cell out of the scrap heap → portal to the Automat → back to the lab. 150 xp / 220 cr.
2. **sci-02 Gravity Is a Suggestion** (Silas): portal to the Upside-Down Bog → kill what followed you out (peaceful mode: scan) → lab. 170 / 260.
3. **sci-03 Take a Number** (Tam): portal to the Waiting Room for the pistol's permit → lab. 160 / 240.
4. **sci-04 Where's My Flask** (Silas): check the cantina (it's not there) → portal to the Giant's Pantry → lab. 190 / 300.
5. **sci-05 Last Call at the End of Everything** (Silas): portal to the Last Bar for the notes → 2★ ColSec getaway (fires `ssx:getaway`) → lab. 300 / 600 + badge *Interdimensional Delinquent*.

## Part 2: sci-06..10 (darker, weirder; the Raccoon Mobile earns its keep)

New files only (no core hooks): `scientists2.js` (cast, barks, missions, pure) · `sci2core.js` (stalkers, collapse
timer, Raccoon legs, rift drive, pure) · `dimensions/{orchard,hum,pawn,rehearsal,gut}.js` + `dimensions/index2.js`.
`scihooks.js` registers them next to part 1 (`DIMENSIONS2` is kept separate so part 1's checks are unchanged).
Unit: `tests/test-scientists2-unit.mjs` · e2e: `tests/test-scientists2.js` / `tests/run-scientists2.sh`.

New mechanics:
- **`rdrive` step**: drive the Raccoon Mobile (bought, or stolen) to the marker. On foot, or in any other car, it
  doesn't count; a hint tells you where the Depot sells it (900 cr). Silas or Tam bark once per leg.
- **Rift drive**: portal steps marked `raccoon: 'only'` (sci-09, sci-10) refuse you on foot (Tam warns) and take you
  through in the Raccoon Mobile. After sci-09 the Raccoon Mobile can drive into *any* portal.
- **Stalkers**: a dimension resident that walks toward you (clamped inside the room) instead of sweeping a lane.
- **Collapse timer**: the Gut has `limit: 60`; the step text counts down, and at 0 you're spat back onto Mars with the
  step kept. The Raccoon Mobile is still parked in the portal mouth, so getting in punches straight back through.
- **Barks**: every line goes through `SSX.bark(npc, category)` with per-speaker categories registered once via
  `SSX.registerBarks` (`sci_silas_idle`, `sci_tam_idle`, `sci_tam_warn`, `sci_tam_drive`, `sci_silas_drive`,
  `sci_<host>_dim`), positioned over the speaker; a caption toast is the fallback if SSX isn't loaded.

| id | name | host (original) | objective | hazards |
|---|---|---|---|---|
| orchard | The Tooth Orchard | Mother Ossery | 4 molars | pruner lanes, root geyser |
| hum | The Hum | The Lineman | answer lines 1-2-3 in order | linemen lanes, stalker *Dial Tone* |
| pawn | Lien & Sons Organ Pawn | Mr. Lien | ticket → jar → receipt, in order | repo men, stalker *Mr. Lien* |
| rehearsal | The Rehearsal | The Understudy (a waxen Silas) | 3 script pages | stagehand lane, stalker *Understudy* |
| gut | The Gut | The Hungry Quiet | 4 anchors in 60 s | clenching lumps, stalker *Hungry Quiet* |

1. **sci-06 Root Canal** (Silas): Raccoon to the lab yard → portal to the Tooth Orchard → Raccoon to the Dust Cemetery within 150 s → lab. 320 xp / 650 cr.
2. **sci-07 Dead Air** (Tam): portal to the Hum (answer lines 1-2-3) → kill what came down the line (peaceful mode: scan) → lab. 340 / 700.
3. **sci-08 Collateral** (Silas): portal to Lien & Sons Organ Pawn for Silas's pawned liver (ticket, jar, receipt) → 2★ getaway → Raccoon to the Back Lot → lab. 380 / 800.
4. **sci-09 The Understudy** (Tam): pull the rift carburettor out of the wreck pile → Raccoon to the lab yard → rift-drive into the Rehearsal (Raccoon only) → lab. 420 / 900.
5. **sci-10 Closing Time** (Silas, finale): Raccoon to the far scrap heap → rift-drive into the Gut (60 s collapse) → kill what followed → 3★ getaway → lab. 650 / 1500 + badge *Closed the Door Behind Me*; the Raccoon Mobile gets rift-tuned (+3 top speed, +4 boost).

Originality guard (unit test): no lookalike names, catchphrases or brand names; M-rated tone (dread, swearing,
violence) with no sexual content.
