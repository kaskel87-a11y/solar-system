# Names changed for v7.5.97

Players see the new name. Old saves keep working. Where a stored id was itself a product name, the game rewrites it the next time that save loads (`ipcore.js`). Mission ids and crew flags were not product names, so those ids stay and only the words on screen changed.

## Renamed

| Old name players saw | New name | Stored id |
|---|---|---|
| Merc with a Mouth | Crimson Mercenary | `merc` (unchanged). The look changed too: one dark visor, a shoulder plate, no white eye slits and no swords on the back. |
| Your Starship / the starship | the Ashfall | There was no stored ship id. The code function `buildStarship` is still the mesh builder. |
| Roadster kit | Lowline kit | Was `roadster` / `kit:roadster`. Now `lowline` / `kit:lowline`. Old saves are rewritten on load. |
| Black Ops (bandana) | Pitch Black | `blackops` kept, so an owned bandana stays equipped. |
| Gold-Chain Kingpin (outfit) | Gold-Chain Boss | `kingpin` kept. |
| ENDING: Kingpin | ENDING: The Quiet | Story text only. |
| Halo (Ceres 94.7 DJ) | Lux | Mission ids `halo-*` and the crew flag `halo` stay. Dialogue, objectives, and the contact name say Lux. |
| Widowmaker gauss rifle / Widowmaker optic | Longbore gauss rifle / Longbore optic | `widowmaker` kept. |
| Skullsplitter warhammer | Skullsplitter maul | `skullsplitter` kept. |
| Hasselblad camera bodies (Moon fact) | film cameras | Fact text only. The Apollo crews line stays, as history. |
| Viper SMG | Rattler SMG | `smg` kept, including the engraved shop copy and the gunsmith job. |
| Pit Viper (race rival) | Pit Adder | Custom tracks saved with the old rival name are rewritten when the race save loads. |

"open-world" replaced "GTA" in the readme, the roadmap, and the notes that ship inside the game files. Nothing in the game was named GTA.

## Reviewed and kept

These came up in the pass and are not someone else's product name.

- Real places: Olympus Mons, Planum Australe, Ares Junction uses Ares as a Mars district, Mare-style Freeport Tranquility, Occator, Shackleton, Ceres.
- History and science named as history: Apollo crews, Venera-style capsule, MESSENGER ice, Europa Clipper, SETI. No logos.
- App name: Solar System Explorer. Manifest description does not name a real ship or car.
- Fonts: `system-ui` only. No bundled commercial fonts.
- Music: PIT 66.6, DUST 98.3, and the other stations are synthesized in the page. No lyrics, no samples. MY MUSIC plays files the player picks on their own device and does not upload them. See `RADIO-EXTRA.md`.
- Planet textures: Solar System Scope, CC BY 4.0. Credit stays in the corner.
- Dancer models: MakeHuman CC0, CMU motion capture (free to use), our own clothes. See `models/dancers/LICENSE.md`.
- Mars city models: CC0 (Grab3D, Poly Haven). See `assets/mars-city/LICENSES.md`.
- Vehicle kinds: Rover, Dune buggy, Ore hauler, Hover bike, Shuttle skimmer. No real car makes.
- Gun names that already were original: Gutterking, Riot Hog, Needle-Rat (the stored id is `needler`), Dustbiter, Thumper, Hellhound, Gilded Gutterking, Ash .38, Stutter.
- Outfits that are costumes, not a character: Raccoon suit, Dino suit, Banana suit, Grin Reaper (a Halloween pun on the folk figure), Alien-Hide Jacket (a green hide, not a film creature).
- People: Ines, Rook, Vesna, Dutch, Ozzie, Gus, Danny Alvarez, Marcus Thorne, and the rest of the crew. Invented names. Common first names were left as names.
