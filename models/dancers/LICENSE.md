# Velvet Airlock dancer models — sources and licences

`dancer_danny.glb` (Danny Alvarez, the hero dancer: centre stage + private dance), `dancer_rhea.glb`, `dancer_kiara.glb`.
Total ≈ 2.1 MB (meshopt + WebP). Loaded only when the club interior is built (`clubdancers.js`).

| Part | Source | Licence |
|---|---|---|
| Body meshes, skin, eye, brow, lash, teeth, hair, boot textures | MakeHuman 1.x asset library (http://www.makehumancommunity.org) | **CC0 1.0** |
| Generator that assembled/rigged them (not shipped) | Ara 3D Gen, https://github.com/olatunde85/3d-gen | MIT (code only; outputs carry no licence obligations) |
| Idle / Cheer clips baked into the GLBs | Hand-keyed procedural clips from Ara 3D Gen (`src/core/anim/clips/basic.ts`, `emotes.ts`); no motion-capture data is included | MIT |
| Pole routine | The game's existing procedural `poleDance` rig, retargeted onto the skeleton at runtime | (this repo) |
| Garments (bikini, white string bikini, ribbed crop top, shorts, open cardigan, open crochet cover-up), rib-knit and crochet-net textures, blackwork tattoo designs (sleeves, chest, torso, thighs), centre ring (three.js torus, built in `clubdancers.js`) | Our own procedural work (added to the generator for this game) | CC0 1.0 (dedicated by the author of this repo) |

All characters are fictional adults with original, procedurally generated faces; no real person's likeness, no
scanned or ripped assets. Styling is non-explicit (costumes never come off). "Danny Alvarez" is a fictional name.
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
