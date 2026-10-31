// Builds the v8 building-kit GLBs (models/v8/kit/*.glb) from Jeff's CC0 mars-city art kit (/workspace/ss-assets/mars-city).
// No KTX2 transcoder in vendor/three, so each prop is rebuilt from the desktop GLB: textures re-encoded to WebP at the phone
// resolution, geometry simplified to the phone triangle budget, nodes flattened + joined per material (fewer draws),
// quantized and meshopt-compressed (vendor/three ships the meshopt decoder).
// Run: cd tools/v8models && ln -sfn /workspace/ss-assets/tools/node_modules node_modules && node build-kit.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, prune, dedup, simplify, textureCompress, quantize, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const KIT = '/workspace/ss-assets/mars-city', OUT = path.resolve('../../models/v8/kit');
const man = JSON.parse(fs.readFileSync(KIT + '/manifest.json', 'utf8')), byId = Object.fromEntries(man.assets.map(a => [a.id, a]));
// id: max texture px
const LIST = { planter_box_01: 256, mars_billboard_curved: 256, boarded_window: 256, rollershutter_window: 512, fire_escape: 512, burn_barrel: 256, mansion_villa: 1024, mansion_modern: 1024, mansion_glass: 1024 };
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (const [id, px] of Object.entries(LIST)) {
  const a = byId[id]; const doc = await io.read(path.join(KIT, a.files.desktop));
  const ratio = Math.min(1, a.tris.phone / a.tris.desktop);
  await doc.transform(
    flatten(), join(), weld(),
    ...(ratio < 0.98 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: false })] : []),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [px, px], quality: 82 }),
    dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  doc.getRoot().getAsset().extras = { license: a.license, author: a.author, source: a.source_url, via: 'ss-assets/mars-city ' + a.files.desktop };
  const f = path.join(OUT, id + '.glb'); await io.write(f, doc);
  const tris = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  rows.push([id, fs.statSync(f).size, tris, doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0)]);
}
for (const r of rows) console.log(r.join('\t'));
console.log('total', rows.reduce((s, r) => s + r[1], 0));
