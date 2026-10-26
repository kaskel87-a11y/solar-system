# Red Tape Flats interiors (v7.5, Snuffles)

Four walk-in dives in **Red Tape Flats** (`mars-rough`, the rough district ~280 m west / 200 m south of Ares Junction).
They are built on the existing interior framework: each one is a `registerInterior(kind, …)` room in `interiors.js` style,
with a storefront block added to the district's `blocks` the same way the PR #10 shops are. Doors face south. They show
on the radar as small coloured dots (`SSX.minimap` id `flats`).

| Kind | Sign | Local (x, z) | Who | What you do |
| --- | --- | --- | --- | --- |
| `flats_flop` | RESTWELL BUNKS (amber) | -44, 28 | Rooney | Rent a bunk (15 cr, or 30 with a lockbox) and sleep. Sleeping saves and heals ~35% HP. With 60+ cr on you there is a ~20-40% overnight robbery chance (15-35% of your cash, capped at 600, plus some dirty cash). A lockbox cuts that risk to 30%, and SSX.grime raises it. |
| `flats_clinic` | BAY SIX DENTAL (green) | -32, -20 | Doc Varga | A full patch-up (`game.restore()`) or half a heal. Price = 40 + missing HP, plus a surcharge of 35/star + 10/star² when wanted. It never adds wanted. Sell a pint of blood: +25 cr for -25% HP, with a 3 min cooldown. |
| `flats_pawn` | GOLD STAR PAWN (gold) | -36, -34 | Benny | Fences hot goods (heist and safe loot plus `SSX.flats.addHot`) and Marsmania stash goods: plates, cells, chips, tags, salvage, whiskey, paste. Offers are 36-44% of value (worse when wanted). You get two haggles, and a failed second haggle shuts him down on that item. Payout is clean credits, or dirty cash at +20%. He does not take drugs or Quiet crates. |
| `flats_laund` | RINSE & REPEAT (cyan) | 28, 40 | Knuckles, Auntie Ro | Knuckles lets you into the back room if you carry dirty cash, or for a 10 cr bribe. Ro washes dirty cash into credits for an 18% cut, +4% per wanted star. Kick dryer six for loose change. |

**Pawn hostility:** if you switch weapons inside, Benny warns you and levels the sawed-off. Switching again within 3.5 s, or firing at all, makes him hostile. He then fires through the cage in two-barrel bursts (16-26 damage each). Three shots facing him kill him: you get 120-260 dirty cash from the register and at least 2★ wanted, and the shop is dead for 10 minutes. If you leave while he is hostile, you are barred for 5 minutes, and coming back early starts the threat again.

**Performance:** the set dressing is built when you enter and disposed when you leave (`kit.dispose()`: meshes, textures and materials it owns). The core only keeps the room shell, colliders and hotspots. Phones therefore pay only for the room they stand in.

## Public API: `window.SSX.flats`

```js
SSX.flats.places()            // [{ kind, sign, title, who, district, local:[x,z], door:{x,z,name}|null }]
SSX.flats.inside              // current flats kind or null;  SSX.flats.loaded -> kinds with dressing built
SSX.flats.dirty               // dirty cash ledger (persisted, localStorage 'ssx.flats.v1')
SSX.flats.addDirty(n, src)    // hook for other mods (heists, drug runs) to pay out dirty money
SSX.flats.launder(n?)         // -> { ok, dirty, clean, cut }   SSX.flats.launderCut() -> 0.18..0.45
SSX.flats.hot()               // hot goods ledger;  SSX.flats.addHot({ name, value, src }) -> key
SSX.flats.fenceable()         // hot + stash goods Benny buys;  SSX.flats.fence(key, { price?, dirty? })
SSX.flats.clinicPrice()       // { full, half, surcharge, wanted, missing };  patch(full), sellBlood()
SSX.flats.rent(lock), sleep() // flophouse (sleep({ rng }) for tests)
SSX.flats.pawn                // { mode 0 calm|1 aiming|2 firing, hostile, dead, hp, barredUntil };  provoke()
SSX.flats.act(spotId)         // run a hotspot ('fx:…') as if E was pressed;  close() closes the panel
SSX.flats.stats, reset()
```

Events go to `SSX.emit('flats:…')` and to `window` CustomEvents: `flats:enter`, `flats:rent`, `flats:sleep`,
`flats:patch`, `flats:hot`, `flats:fence`, `flats:pawn`, `flats:launder` and `flats:dirty`.

Hot goods are added automatically on `heist:done` (on success, 1-2 items) and on `game:crack` when it is done (1 item, from a cracked safe).

**Dirty cash:** the core has no dirty-money concept yet. This module keeps its own ledger. If one lands later, swap `ST.dirty` for it and keep `addDirty` as the bridge.

## Files

- `mars/flats-interiors.js`: placement, `registerInterior` ×4, dress/undress on enter/exit, UI panel, interactions, pawn AI, ledgers and API.
- `mars/flats-interiors-rooms.js`: room shells, colliders, hotspots and the per-visit dressing kit, with NPC poses.
- `mars/flats-interiors-tex.js`: seeded canvas textures (stained walls and floors, mattresses, gauze, blood pools, graffiti, notes, cash, TV static).
- `mars/flats-interiors-lines.js`: dialogue and barks, registered as `flats_<cat>` via `SSX.registerBarks` when present.

## Credits and licences

All geometry and textures are procedural (Three.js primitives and `<canvas>` drawing written for this module). There are no external assets, fonts beyond the system UI font, images or sounds. The art, code and text are released as **CC0 1.0** and dedicated to the public domain. All names and brands (Restwell Bunks, Bay Six Dental, Gold Star Pawn & Loan, Rinse & Repeat, Meridian, Quiet) are made up. The content is mature: drug use is implied (nodding off, works on a spoon), there is blood and organ-trade humour, and gun violence. There is no nudity or sexual content.
