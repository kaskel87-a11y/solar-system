# v8 models: player body API (`SSX.models.player()`)

`look/models-player.js`, loaded by `look/models.js` (no extra hook). One handle works on **both** player bodies: the rigged
v8 person (tiers low/med/high/ultra) and the blocky v7 rig (classic, `?models=0`, the far/over-budget fallback, a failed
load). Whatever you attach is re-parented automatically whenever the body swaps (v8 <-> blocky, new surface), so you attach once.

```js
const P = SSX.models.player();          // same object every call; fields update on swaps
const off = P.attach('handR', mesh);    // mesh follows the right hand; off() removes it (returns true once)
P.setTint({ torso: 0x8a1a1a, legs: '#2a5a8a', boots: { color: 0x222222, k: 0.6 } });
P.hideHelmet(true); P.hideHair(true);
SSX.on('models:player', h => { /* h === P; h.body is 'v8' or 'blocky' (null: no player) */ });
```

## Handle

| field / method | what |
|---|---|
| `root` | the game's player group (the blocky rig group): -Z forward, +Y up, feet at y 0. `null` until a player exists |
| `body` | `'v8'`, `'blocky'` or `null` |
| `inst` / `model` | the v8 instance (`{ root, bones, meshes, mixer }`) and its root, or `null` on the blocky rig |
| `slots` | the slot names below |
| `sizes` | measured sizes of the current body in metres (group units), see below |
| `attach(slot, obj)` | parents `obj` to the slot socket; returns `detach()`. Sets `userData.ssxKeep = true` on `obj` and all its children |
| `socket(slot)` | the current socket `Object3D` (read only; do not add children yourself, use `attach` so swaps re-parent them) |
| `attached()` / `detachAll()` | list / remove everything attached through this API |
| `setTint({ torso, arms, legs, boots, gloves })` | region tint. A value is a colour (hex, CSS string, `THREE.Color`) or `{ color, k }` (strength 0..1, default 0.85). `null` clears one region; calls merge |
| `resetTint()` | all regions back to the stock look |
| `hideHelmet(bool)` | v8: glass bubble (no draw, no shadow) + neck collar; blocky: helmet + visor |
| `hideHair(bool)` | v8: hair and beard (eyes, brows, lashes stay); blocky: no-op (no hair) |
| `state()` | `{ body, attached, tint, helmetHidden, hairHidden, root }` |

Tint, helmet and hair are re-applied after every swap. On the v8 body they are shader uniforms (`uReg`, per region, next to
the existing `uTint`), so no extra draws and no material swaps; on the blocky rig the tinted meshes get a cloned material,
restored by `resetTint()` (only if nobody else changed `material` since).

## Slots

Each socket sits at the slot's centre in the rest pose, oriented like the player group (-Z forward, +Y up, +X = the
player's right), **unit scale** (1 = 1 m in the group). On the v8 body it is a child of the bone, so it follows the
animation (walk, run, punch); on the blocky rig head/torso sockets sit on the group and limb sockets on the swinging limb meshes.

| slot | v8 bone | blocky parent | centre |
|---|---|---|---|
| `head` | Head | group | head centre (helmet bubble centre) |
| `face` | Head | group | front of the face (blocky: visor front) |
| `neck` | Neck | group | mid neck |
| `torso` | Spine2 | group | chest centre |
| `back` | Spine2 | group | outer face of the O2 pack (+Z) |
| `armL` / `armR` | LeftArm / RightArm | arm mesh | middle of the upper arm |
| `forearmL` / `forearmR` | LeftForeArm / RightForeArm | arm mesh | middle of the forearm |
| `handL` / `handR` | LeftHand / RightHand | arm mesh (tip) | palm centre |
| `legL` / `legR` | LeftUpLeg / RightUpLeg | leg mesh | middle of the thigh |
| `shinL` / `shinR` (extra) | LeftLeg / RightLeg | leg mesh | middle of the shin |
| `footL` / `footR` | LeftFoot / RightFoot | leg mesh (boot) | middle of the foot, near the sole |

L/R are the player's own left/right (left = -X in the group).

## Sizes (`P.sizes`)

`body, scale, height, headRadius, helmetRadius, neckRadius, shoulderWidth` (outer), `shoulderSpan` (joint to joint),
`hipWidth, hipSpan, torso {w, h, d}, packDepth, upperArm, forearm, armLength, armRadius, forearmRadius, handLength,
handRadius, thigh, shin, legLength, legRadius, shinRadius, footLength, footWidth`. v8 values are measured from the body
(bones + skinned vertices in the rest pose) times the player scale (1.08); blocky values are the rig's constants. Read them
again on `models:player`: the v8 body is slimmer than the blocky rig (e.g. head radius 0.117 vs 0.23, shoulders 0.56 vs 0.91).

## Fallback and visibility rules

- The blocky rig under a v8 body is hidden by **layer** (`layers.mask = 1 << 30`), not `.visible`, so a hidden limb never
  hides what hangs on it.
- `userData.ssxKeep = true` on an object makes the fallback skip it and its whole subtree. `attach()` sets it for you;
  set it yourself only for things you parent by hand.
- The v8 LOD switch only toggles the body meshes, never children of bones.

## Events

`SSX.emit('models:player', handle)` on every body swap (first player, v8 <-> blocky, new surface, player gone). It uses
index.html's `SSX.on` / `SSX.emit`; if neither exists (a test page), a tiny bus is added that never replaces an existing method.

## Tests

- `node tests/test-v8-player-unit.mjs` (wiring, slots, docs).
- `tests/test-v8-player-api.js` (Playwright, WebKit iPhone 14 393x852): a cube on every slot renders on the v8 body and the
  blocky rig (each cube drawn alone on its own layer, so a hidden parent shows 0 px), cubes sit on the right bones and
  limbs, the fallback re-run keeps them, the hand cube follows a punch, a forced swap moves them to the blocky sockets and
  back, tint / helmet / hair uniforms, reset, and `models:player` events.

## Phone performance (v8-perf)

- NPC bodies: phones switch to the 1-draw far LOD past 17 m and back inside 13 m (desktop 30 / 26 m); near NPCs past 8 m
  animate every 2nd frame on phones. A body that already has a model keeps its cap slot unless a newcomer is 4 m nearer.
- One skeleton (one bone texture) per body instead of one per skinned part.
- Pools are per body id (re-tinted on reuse), at most 4 per body on phones / 8 on desktop; anything evicted, and every
  pooled body when models switch off, is disposed (bone textures, mixer caches). Geometry, atlas and materials stay shared.
- look/v8.js: the 2 s scene scan drops objects / materials that left the scene (so the per-frame env / emissive loops don't
  grow), a material shared by terrain and a prop is no longer re-patched terrain <-> surface on every scan, and the club
  dancers keep their own castShadow = false.
- `tests/test-v8-perf.js`: WebKit iPhone 14 393x852, look=med + models=1, grime lite, flamethrower bursts, two cycles of
  walking outside the Velvet Airlock + time inside with the dancers. Asserts geometries / textures / programs plateau in
  cycle 2, few shader re-patches, cap respected, bounded pools, pool reuse + disposal on a forced despawn. `DUR=180 OUT=x.json`
  gives the 3-minute trace (samples every 10 s); `BR=chromium` adds the JS heap.
