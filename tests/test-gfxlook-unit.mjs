// v7.5.140 dust detail + film grade rules. node tests/test-gfxlook-unit.mjs
import * as THREE from '../vendor/three/build/three.module.min.js';
import { lookOf, wantsDetail, dustShader, DEFAULT } from '../gfxcore.js';
let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };

const low = lookOf('low'), med = lookOf('medium'), high = lookOf('high');
t('default stays medium', DEFAULT === 'medium');
t('low is flat', low.detail === false && low.post === false && low.sun === 1 && low.hemi === 1 && low.patches === 0 && low.grain === 0);
t('medium has dust and no pass', med.detail === true && med.post === false && med.grain === 0 && med.vignette === 0 && med.sun > 1 && med.sun < high.sun && med.patches >= 1 && med.patches <= high.patches);
t('high adds the film grade', high.detail === true && high.post === true && high.grain > 0 && high.vignette > 0 && high.hemi >= med.hemi);
t('unknown tier is medium', lookOf('ultra').tier === 'medium' && lookOf('').post === false);

t('ground counts', wantsDetail({ terrain: true, hasMap: true, radius: 30 }));
t('big plain wall counts', wantsDetail({ radius: 8 }));
t('small prop does not', !wantsDetail({ radius: 1.2 }));
t('mapped wall does not', !wantsDetail({ radius: 20, hasMap: true }));
t('glass does not', !wantsDetail({ radius: 20, transparent: true }));
t('skin does not', !wantsDetail({ radius: 20, skinned: true }));
t('glow does not', !wantsDetail({ radius: 20, emissive: 0.4 }));
t('opt-out does not', !wantsDetail({ terrain: true, radius: 40, skip: true }));
t('basic does not', !wantsDetail({ radius: 40, basic: true }));
t('null safe', wantsDetail(null) === false);

const lib = THREE.ShaderLib.standard;
const out = dustShader(lib.vertexShader, lib.fragmentShader);
t('shader patches', !!out && out.vertex.includes('vGfxW') && out.fragment.includes('float gfxDust') && out.fragment.includes('diffuseColor.rgb') && out.fragment.includes('roughnessFactor'));
t('includes kept', !!out && out.vertex.includes('#include <skinning_vertex>') && out.fragment.includes('#include <color_fragment>') && out.fragment.includes('#include <roughnessmap_fragment>'));
t('junk shader refused', dustShader('nope', 'nope') === null);

console.log(fail ? `FAIL ${fail}/${pass + fail}` : `OK ${pass}`);
process.exit(fail ? 1 : 0);
