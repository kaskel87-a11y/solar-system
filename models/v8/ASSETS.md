# v8 realistic models: assets and licences

Everything here is loaded lazily by `look/models.js` (v8 tiers low/med/high/ultra, never on classic). Files are fetched the
first time a person is near the camera (people) or you come within 260 m of a district (kits). Total on med: **2.30 MB**
(people 1.19 MB + kits 1.11 MB); a phone that only walks Ares Junction loads just the people (1.19 MB).
Rebuild: `cd tools/v8models && ln -sfn /workspace/ss-assets/tools/node_modules node_modules && node build-chars.mjs && node build-kit.mjs`
(do not commit the `node_modules` symlink). Sources are Jeff's art kit in `/workspace/ss-assets` (see its `LICENSES.md`).

## People: `models/v8/chars/`

| file | bytes | what | source | licence |
|---|---:|---|---|---|
| player.glb | 362,964 | player (survivor body) LOD0 + LOD1, 1024 px WebP atlas | ss-assets `models/desktop/char_player_survivor.glb` | CC0-1.0 (MakeHuman assets) |
| soldier.glb | 245,008 | guards, ColSec, private security, heavies | `char_npc_soldier.glb` | CC0-1.0 (MakeHuman) |
| hacker.glb | 243,288 | contacts, Saltblood, some colonists | `char_npc_hacker.glb` | CC0-1.0 (MakeHuman) |
| worker.glb | 249,716 | colonists, shop staff | `char_npc_worker.glb` | CC0-1.0 (MakeHuman) |
| anims.glb | 91,472 | shared clips: Idle, Walk, Run, Pistol aim, Pistol fire, Punch, Hit reaction, Death, Drive car, Jump | CMU mocap via the character exports | CMU Graphics Lab Motion Capture Database, free for use in derived works (games); not resold as raw data. Courtesy credit: mocap.cs.cmu.edu (NSF EIA-0196217) |

- Bodies: Ara 3D Gen (https://github.com/olatunde85/3d-gen, MIT, tooling only, not shipped) exporting MakeHuman CC0 bodies,
  skin, hair and clothes. Faces are generator output, no likeness of a real person.
- Our changes (CC0): teeth / tongue / skin-detail overlays dropped (soldier: helmet + chin strap too); garments packed into
  one atlas; procedural pressure helmet (glass bubble), collar ring and O2 pack with tanks, rigid-skinned to Head / Neck /
  Spine2; meshopt simplification (LOD0 about 62%, LOD1 about 14%); quantized + meshopt-compressed.

## Building kits: `models/v8/kit/`

All from the mars-city kit (`/workspace/ss-assets/mars-city`, per-asset log in its `LICENSES.md` / `manifest.json`).
Rebuilt from the desktop GLB: WebP textures at the size below, simplified to the phone triangle budget, joined per material,
quantized, meshopt.

| file | bytes | tex | used in | author | source | licence |
|---|---:|---:|---|---|---|---|
| planter_box_01.glb | 65,932 | 256 | Olympus Row shopfronts | James Ray Cock (Poly Haven) | https://polyhaven.com/a/planter_box_01 | CC0-1.0 |
| mars_billboard_curved.glb | 6,968 | 256 | Olympus Row plaza | Solar System Explorer (procedural, gen_proc.mjs) | ss-assets/mars-city | CC0-1.0 |
| boarded_window.glb | 69,596 | 256 | Red Tape Flats tenements | Grab3D | https://grab3d.com/dl/boarded-window/boarded-window.glb | CC0-1.0 |
| rollershutter_window.glb | 91,720 | 512 | Red Tape Flats shopfronts | MP (Poly Haven) | https://polyhaven.com/a/rollershutter_window_01 | CC0-1.0 |
| fire_escape.glb | 278,272 | 512 | Red Tape Flats side walls | Juniix (Poly Haven) | https://polyhaven.com/a/modular_fire_escape | CC0-1.0 |
| burn_barrel.glb | 61,444 | 256 | Red Tape Flats corners | MP (Poly Haven) | https://polyhaven.com/a/barrel_stove | CC0-1.0 |
| mansion_villa.glb | 220,604 | 1024 | Helios Heights: Voss House, Quinn Villa | Grab3D | https://grab3d.com/dl/mediterranean-villa/mediterranean-villa.glb | CC0-1.0 |
| mansion_modern.glb | 207,312 | 1024 | Helios Heights: Helios, Kline Retreat | Grab3D | https://grab3d.com/dl/modern-house/modern-house.glb | CC0-1.0 |
| mansion_glass.glb | 112,052 | 1024 | Helios Heights: Sable Annex, Clubhouse | Grab3D | https://grab3d.com/dl/glass-house/glass-house.glb | CC0-1.0 |

Procedural (no files, CC0, our code in `look/models-kits.js`): the Olympus Row facade kit, the Red Tape Flats tenement
walls and stacked storeys, and the Helios gate stucco + neon trim.

Licence pages: Grab3D https://grab3d.com/license (CC0 1.0, checked 2026-10-25), Poly Haven https://polyhaven.com/license (CC0).
Engine: three.js r169 GLTFLoader + meshopt decoder (MIT), already vendored. No KTX2/basis transcoder is needed.
