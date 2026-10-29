# Velvet Airlock dancer models — sources and licences

`dancer_danny.glb` (Danny Alvarez, the hero dancer: centre stage + private dance), `dancer_rhea.glb`, `dancer_kiara.glb`.
Phone build (2026-10, after the iPhone review): each GLB is 2 skinned primitives (opaque body+garments, alpha-masked
hair/lashes/cover-up/cardigan) with embedded **512×512** WebP maps; small garment/tattoo/eye textures share one 512 atlas
`dancer_aux.webp`. Desktop ("high" tier) only swaps in `dancer_*_{skin,hair}_hd.webp` (2048×2048 for Danny, 1024 for Rhea/Kiara) and
`dancer_*_nrm_hd.webp` (1024 skin normal + roughness detail, derived from the CC0 skin map); phones never fetch them.
Teeth and tongue meshes are dropped (never visible) and shoes are simplified to 30 % of their triangles.
Total ≈ 3.1 MB including the desktop set (phones download ≈ 1.5 MB). Loaded only when the club interior is built (`clubdancers.js`)
and released (geometry, textures, skeletons, mixers) when you leave it.

| Part | Source | Licence |
|---|---|---|
| Body meshes, skin, eye, brow, lash, teeth, hair, boot textures | MakeHuman 1.x asset library (http://www.makehumancommunity.org) | **CC0 1.0** |
| Generator that assembled/rigged them (not shipped) | Ara 3D Gen, https://github.com/olatunde85/3d-gen | MIT (code only; outputs carry no licence obligations) |
| Idle / Cheer clips baked into the GLBs | Hand-keyed procedural clips from Ara 3D Gen (`src/core/anim/clips/basic.ts`, `emotes.ts`) | MIT |
| "Modern dance (CMU 05_12)" clip baked into the GLBs (desktop tier) | CMU Graphics Lab Motion Capture Database, subject 5 trial 12, http://mocap.cs.cmu.edu (cgspeed BVH conversion); retargeted/trimmed by Ara 3D Gen's `build-mocap`. "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." CMU places no restrictions on use; the BVH converter adds none. No Mixamo data. | free to use, redistribution allowed |
| "Salsa sway (CMU 61_05)" clip baked into the GLBs (private show + desktop tier) | CMU Graphics Lab Motion Capture Database, subject 61 (salsa) trial 5, http://mocap.cs.cmu.edu (cgspeed BVH conversion), cut in place and looped by Ara 3D Gen's `build-mocap`. Same CMU acknowledgement as above. No Mixamo data. | free to use, redistribution allowed |
| Pole routine and natural arm poses | The game's existing procedural `poleDance` rig plus pole-grip / hand-on-hip arm targets solved on the skeleton at runtime (`clubdancers.js`) | (this repo) |
| Private-show VIP booth (velvet walls, chair, neon, sign; canvas textures drawn at runtime in `privateshow.js`) | Our own procedural work | CC0 1.0 (dedicated by the author of this repo) |
| Garments (bikini, white string bikini + strappy side strings, ribbed crop top, shorts, open cardigan, open crochet cover-up), rib-knit, crochet-net and lined aqua fine-crochet textures (v7.5.4: knit chevrons, stitch rows, lined eyelets), blackwork tattoo designs (v7.5.4 Danny: scale-pattern neck wrap, lace-collar chest plate with faceted gem and petals, sternum-to-stomach blade with diamond chain, hip blade strokes, plus geometric left sleeve, organic right sleeve, dense thighs; mauve nails), centre ring and lip-piercing hoop (tori built at asset-build time in `tools/dancers.mjs`) | Our own procedural work (added to the generator for this game) | CC0 1.0 (dedicated by the author of this repo) |

All characters are fictional adults with original, procedurally generated faces; no real person's likeness, no
scanned or ripped assets. Reference photos were used for generic style cues only and are not stored anywhere; the
tattoo compositions are original designs at a similar density and placement (no moon motif, nothing copied from any real tattoo). Styling is non-explicit (costumes never come off). "Danny Alvarez" is a fictional name.
Rebuild: `/workspace/ss-assets/src/3d-gen/scripts/ss-dancers.ts` then `/workspace/ss-assets/tools/dancers.mjs`.

## Ara 3D Gen MIT notice (covers the baked Idle/Cheer keyframes)

```
MIT License

Copyright (c) 2026 Josh Ola and Ara 3D Gen contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---------------------------------------------------------------------------
The MIT license above covers the source code in this repository. The character
data it downloads and builds (MakeHuman base mesh, targets, skins, proxies) is
CC0 1.0 (public domain); see scripts/ASSETS_LICENSE.txt. Characters you export
are yours to use, commercially or otherwise, without attribution.
```
