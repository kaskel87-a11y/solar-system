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
