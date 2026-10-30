// Pure logic for Mars player skins (Pumpkin): the skin catalogue, saving, buying and equipping, real-tap test.
// No DOM, no three.js: tests/test-skins-unit.mjs runs it in plain node. mars/skins.js builds the parts from these specs.
//
// A skin = recolours for the player rig's regions + extra low-poly parts. Regions (models.js buildAstronaut):
//   torso, arms, legs, helmet, pack (O2 backpack), chest (chest panel), visor, boots. A region set to null is hidden.
// face: true hides the helmet bubble + visor and gives you a bare head (skin tone, eyes), so hats and masks sit on a head.
// Parts: [slot, shape, dims, pos, rot, mat]
//   slot  head (relative to the head centre) | torso (relative to the chest centre) | armL armR (shoulder joint, arm
//         hangs down -y 0.7) | legL legR (hip joint, leg hangs down -y 0.88). Limb parts swing with the limb.
//   shape box [w,h,d] | cyl [rTop,rBot,h,seg] | sph [r,wSeg,hSeg] | tor [R,tube,radSeg,tubSeg] | cone [r,h,seg]
//   pos [x,y,z], rot [x,y,z] radians or 0, mat = a palette key of the skin (or a shared key from MATS), sc optional [x,y,z]
// The rig faces -Z: the face / chest front is at -z, the backpack at +z.
export const SAVE_KEY = 'ssx.skins.v1';
export const TAP_PX = 10;
export const STOCK = 'stock';
export const SHOP = { id: 'threadbare', name: 'Threadbare', sub: 'Second-hand threads · no questions', aj: [-20, 6], near: 4.5 };

// shared material looks (one material each, reused by every skin that names them)
export const MATS = {
  black: { c: 0x101010, r: 0.6 }, white: { c: 0xf0eee8, r: 0.7 }, gold: { c: 0xe0b83a, r: 0.35, m: 0.6, e: 0x2a1e00 }, silver: { c: 0xd0d4da, r: 0.35, m: 0.55, e: 0x181a1c },
  eye: { c: 0x0a0a0a, r: 0.3 }, red: { c: 0xc81e1e, r: 0.7 }, ember: { c: 0xff6a1a, e: 0xff4a00 }, grime: { c: 0x4a3626, r: 1 }, tape: { c: 0x9a9a8e, r: 0.9 },
  glass: { c: 0x101418, r: 0.1, m: 0.4 }, cash: { c: 0x3a8a3a, r: 0.9 }
};

const S = (id, name, price, blurb, o) => ({ id, name, price, blurb, ...o });
export const SKINS = [
  S('rusty', 'Rusty Spacesuit', 0, 'Your first suit, three owners ago. Patched, taped, still holds air. Mostly.', {
    icon: '🧑‍🚀', face: false,
    pal: { torso: 0x8a4b2a, arms: 0x7a4228, legs: 0x6e3d24, helmet: 0x9a5a34, pack: 0x4a3a30, chest: 0xc0a020, visor: { c: 0x3a2a10, r: 0.2, m: 0.3, e: 0x140a00 }, boots: 0x2e241e, patch: 0x5a2a18, pad: 0x3a3a34, tip: { c: 0xff2a2a, e: 0xc00000 } },
    parts: [
      ['torso', 'box', [0.2, 0.18, 0.03], [0.13, 0.12, -0.185], 0, 'patch'], ['torso', 'box', [0.14, 0.1, 0.03], [-0.15, -0.18, -0.185], [0, 0, 0.3], 'patch'],
      ['armL', 'cyl', [0.093, 0.093, 0.08, 8], [0, -0.3, 0], 0, 'tape'], ['armR', 'cyl', [0.093, 0.093, 0.06, 8], [0, -0.12, 0], 0, 'tape'],
      ['legL', 'box', [0.17, 0.15, 0.07], [0, -0.45, -0.11], 0, 'pad'], ['legR', 'box', [0.17, 0.15, 0.07], [0, -0.45, -0.11], 0, 'pad'],
      ['head', 'cyl', [0.01, 0.012, 0.36, 4], [0.15, 0.3, 0.06], [0, 0, -0.35], 'silver'], ['head', 'sph', [0.028, 6, 4], [0.21, 0.46, 0.06], 0, 'tip'],
      ['torso', 'box', [0.12, 0.06, 0.03], [0.05, 0.25, -0.19], [0, 0, -0.2], 'grime']
    ] }),
  S('punk', 'Ripped Punk', 300, 'Torn vest, green mohawk, spiked collar. ColSec hates you on sight.', {
    icon: '🤘', face: true,
    pal: { skin: 0xd9a47e, torso: 0x161616, arms: 0xd9a47e, legs: 0x2a2f45, pack: null, chest: 0x161616, boots: 0x111111, hawk: { c: 0x39ff14, e: 0x0f5a05, r: 0.8 }, ink: 0x1e4a7a, rip: 0xd9a47e, stud: { c: 0xc8ccd2, r: 0.3, m: 0.55 } },
    parts: [
      ...[-0.12, -0.06, 0, 0.06, 0.12].map((z, i) => ['head', 'cone', [0.035, 0.16 - Math.abs(i - 2) * 0.02, 5], [0, 0.19 - Math.abs(i - 2) * 0.01, z], [-z * 1.6, 0, 0], 'hawk']),
      ['head', 'tor', [0.1, 0.028, 5, 12], [0, -0.17, 0], [Math.PI / 2, 0, 0], 'black'],
      ...[0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + (i - 2) * 0.55; return ['head', 'cone', [0.018, 0.06, 4], [Math.cos(a) * 0.12, -0.17, Math.sin(a) * 0.12], [Math.PI / 2 * Math.sin(a), 0, -Math.PI / 2 * Math.cos(a)], 'stud']; }),
      ['torso', 'box', [0.08, 0.1, 0.02], [0.1, -0.08, -0.185], [0, 0, 0.5], 'rip'], ['torso', 'box', [0.06, 0.07, 0.02], [-0.14, 0.12, -0.185], [0, 0, -0.4], 'rip'],
      ['armL', 'cyl', [0.09, 0.09, 0.05, 8], [0, -0.2, 0], 0, 'ink'], ['armR', 'cyl', [0.09, 0.09, 0.05, 8], [0, -0.3, 0], 0, 'ink'], ['armR', 'cyl', [0.09, 0.09, 0.03, 8], [0, -0.38, 0], 0, 'ink'],
      ['torso', 'cone', [0.04, 0.09, 4], [-0.24, 0.33, 0], 0, 'stud'], ['torso', 'cone', [0.04, 0.09, 4], [0.24, 0.33, 0], 0, 'stud'],
      ['legL', 'box', [0.12, 0.1, 0.03], [0, -0.42, -0.11], 0, 'rip'], ['legR', 'box', [0.1, 0.06, 0.03], [0, -0.3, -0.11], 0, 'rip'],
      ['legL', 'cyl', [0.135, 0.135, 0.3, 8], [0, -0.74, 0], 0, 'black'], ['legR', 'cyl', [0.135, 0.135, 0.3, 8], [0, -0.74, 0], 0, 'black']
    ] }),
  S('overalls', 'Farm Overalls', 450, 'Denim bib, plaid shirt, straw hat. Smells like the Dustbowl Homestead.', {
    icon: '👨‍🌾', face: true,
    pal: { skin: 0xc8946a, torso: 0xa8342a, arms: 0xa8342a, legs: 0x3a5a8a, pack: null, chest: 0x3a5a8a, boots: 0x5a3a20, denim: 0x3a5a8a, straw: 0xd9b45a, band: 0x5a2a18, dirt: 0x5a4030, plaid: 0x2a1a1a },
    parts: [
      ['torso', 'box', [0.42, 0.38, 0.04], [0, -0.1, -0.19], 0, 'denim'], ['torso', 'box', [0.07, 0.42, 0.03], [-0.15, 0.12, -0.195], 0, 'denim'], ['torso', 'box', [0.07, 0.42, 0.03], [0.15, 0.12, -0.195], 0, 'denim'],
      ['torso', 'box', [0.07, 0.5, 0.03], [-0.15, 0.08, 0.19], 0, 'denim'], ['torso', 'box', [0.07, 0.5, 0.03], [0.15, 0.08, 0.19], 0, 'denim'],
      ['torso', 'sph', [0.026, 6, 4], [-0.15, 0.1, -0.215], 0, 'gold'], ['torso', 'sph', [0.026, 6, 4], [0.15, 0.1, -0.215], 0, 'gold'],
      ['armL', 'cyl', [0.088, 0.088, 0.02, 8], [0, -0.2, 0], 0, 'plaid'], ['armL', 'cyl', [0.088, 0.088, 0.02, 8], [0, -0.42, 0], 0, 'plaid'], ['armR', 'cyl', [0.088, 0.088, 0.02, 8], [0, -0.2, 0], 0, 'plaid'], ['armR', 'cyl', [0.088, 0.088, 0.02, 8], [0, -0.42, 0], 0, 'plaid'],
      ['head', 'cyl', [0.32, 0.32, 0.02, 14], [0, 0.11, 0], [0.08, 0, 0], 'straw'], ['head', 'cyl', [0.15, 0.17, 0.15, 10], [0, 0.19, 0], 0, 'straw'], ['head', 'cyl', [0.172, 0.172, 0.035, 10], [0, 0.135, 0], 0, 'band'],
      ['head', 'cyl', [0.005, 0.005, 0.14, 3], [0.05, -0.085, -0.2], [Math.PI / 2 - 0.3, 0.5, 0], 'straw'],
      ['legL', 'box', [0.16, 0.14, 0.03], [0, -0.6, -0.11], 0, 'dirt'], ['legR', 'box', [0.14, 0.2, 0.03], [0, -0.35, -0.115], 0, 'dirt']
    ] }),
  S('biker', 'Dust Devil Biker', 650, 'Half-shell lid, goggles, leather and a beard full of road grit.', {
    icon: '🏍️', face: true,
    pal: { skin: 0xb88060, torso: 0x1c1c1c, arms: 0x1c1c1c, legs: 0x2a3550, pack: null, chest: 0x1c1c1c, boots: 0x15110e, shell: { c: 0x0e0e0e, r: 0.25, m: 0.3 }, beard: 0x4a2e1a, strap: 0x5a3a22, lens: { c: 0xffa020, e: 0x7a3a00, r: 0.15 }, skull: 0xe8e2d0 },
    parts: [
      ['head', 'sph', [0.185, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2], [0, 0.02, 0.01], 0, 'shell'],
      ['head', 'tor', [0.178, 0.018, 4, 16], [0, 0.07, 0], [Math.PI / 2 + 0.15, 0, 0], 'strap'],
      ['head', 'cyl', [0.045, 0.045, 0.03, 10], [-0.06, 0.1, -0.165], [Math.PI / 2 - 0.4, 0, 0], 'lens'], ['head', 'cyl', [0.045, 0.045, 0.03, 10], [0.06, 0.1, -0.165], [Math.PI / 2 - 0.4, 0, 0], 'lens'],
      ['head', 'box', [0.2, 0.12, 0.09], [0, -0.11, -0.11], [0.25, 0, 0], 'beard'],
      ['torso', 'box', [0.24, 0.24, 0.02], [0, 0.04, 0.19], 0, 'skull'], ['torso', 'box', [0.06, 0.05, 0.02], [-0.05, 0.08, 0.2], 0, 'black'], ['torso', 'box', [0.06, 0.05, 0.02], [0.05, 0.08, 0.2], 0, 'black'],
      ...[-0.1, 0, 0.1].map(y => ['torso', 'sph', [0.018, 5, 3], [0.07, y, -0.185], 0, 'silver']),
      ['torso', 'box', [0.58, 0.06, 0.38], [0, -0.3, 0], 0, 'strap'], ['torso', 'box', [0.08, 0.06, 0.02], [0, -0.3, -0.195], 0, 'silver']
    ] }),
  S('hazmat', 'Hazmat Cook', 800, 'Yellow suit, gas mask, stained apron. What you cook in the Vat House stays in the Vat House.', {
    icon: '☣️', face: true,
    pal: { skin: 0xd0a080, torso: 0xe8c21a, arms: 0xe8c21a, legs: 0xe8c21a, pack: 0x6a6a62, chest: 0x111111, boots: 0x111111, hood: 0xe0b818, mask: { c: 0x1a1a1a, r: 0.5 }, filt: 0x5a5a58, lens: { c: 0x2a3a2a, r: 0.1, m: 0.5 }, apron: 0xd8d0b8, stain: 0x6a4a20, glove: 0x111111 },
    parts: [
      ['head', 'sph', [0.2, 12, 8], [0, 0.01, 0.015], 0, 'hood', [1, 1.05, 1]],
      ['head', 'box', [0.24, 0.2, 0.07], [0, -0.02, -0.17], 0, 'mask'],
      ['head', 'cyl', [0.05, 0.05, 0.09, 8], [-0.1, -0.07, -0.2], [Math.PI / 2, 0, 0.5], 'filt'], ['head', 'cyl', [0.05, 0.05, 0.09, 8], [0.1, -0.07, -0.2], [Math.PI / 2, 0, -0.5], 'filt'],
      ['head', 'cyl', [0.045, 0.045, 0.02, 10], [-0.055, 0.03, -0.21], [Math.PI / 2, 0, 0], 'lens'], ['head', 'cyl', [0.045, 0.045, 0.02, 10], [0.055, 0.03, -0.21], [Math.PI / 2, 0, 0], 'lens'],
      ['torso', 'box', [0.4, 0.62, 0.02], [0, -0.14, -0.19], 0, 'apron'], ['torso', 'box', [0.1, 0.08, 0.01], [0.08, -0.05, -0.202], [0, 0, 0.6], 'stain'], ['torso', 'box', [0.07, 0.12, 0.01], [-0.1, -0.3, -0.202], [0, 0, -0.3], 'stain'], ['torso', 'box', [0.05, 0.05, 0.01], [0.02, 0.1, -0.202], 0, 'stain'],
      ['armL', 'cyl', [0.1, 0.1, 0.14, 8], [0, -0.63, 0], 0, 'glove'], ['armR', 'cyl', [0.1, 0.1, 0.14, 8], [0, -0.63, 0], 0, 'glove'],
      ['legL', 'cyl', [0.13, 0.13, 0.28, 8], [0, -0.74, 0], 0, 'glove'], ['legR', 'cyl', [0.13, 0.13, 0.28, 8], [0, -0.74, 0], 0, 'glove']
    ] }),
  S('hustler', 'Neon Street Hustler', 1200, 'Purple tracksuit, glow stripes, backwards cap, shades at night.', {
    icon: '🕶️', face: true,
    pal: { skin: 0x8a5a3c, torso: 0x4a167a, arms: 0x4a167a, legs: 0x4a167a, pack: null, chest: { c: 0x39ffea, e: 0x0a8a80 }, boots: 0xf0f0f0, neon: { c: 0x39ffea, e: 0x14b0a4, r: 0.5 }, pink: { c: 0xff2ad4, e: 0x8a0a70 }, cap: 0x111111 },
    parts: [
      ['head', 'sph', [0.178, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2], [0, 0.02, 0], 0, 'cap'], ['head', 'box', [0.2, 0.02, 0.13], [0, 0.03, 0.2], [-0.15, 0, 0], 'cap'],
      ['head', 'box', [0.27, 0.055, 0.03], [0, 0.03, -0.165], 0, 'black'], ['head', 'box', [0.27, 0.012, 0.032], [0, 0.058, -0.166], 0, 'pink'],
      ['head', 'tor', [0.1, 0.012, 4, 14], [0, -0.19, -0.03], [Math.PI / 2 - 0.5, 0, 0], 'gold'],
      ['armL', 'box', [0.025, 0.62, 0.03], [-0.085, -0.33, 0], 0, 'neon'], ['armR', 'box', [0.025, 0.62, 0.03], [0.085, -0.33, 0], 0, 'neon'],
      ['legL', 'box', [0.025, 0.74, 0.03], [-0.12, -0.42, 0], 0, 'neon'], ['legR', 'box', [0.025, 0.74, 0.03], [0.12, -0.42, 0], 0, 'neon'],
      ['torso', 'box', [0.02, 0.6, 0.02], [0, 0, -0.185], 0, 'silver']
    ] }),
  S('cowboy', 'Mars Cowboy', 1500, 'Long dust-coloured duster, wide hat, bandana up. The Beltway is the new frontier.', {
    icon: '🤠', face: true,
    pal: { skin: 0xc08a62, torso: 0x5a3e26, arms: 0x5a3e26, legs: 0x34343e, pack: null, chest: 0x5a3e26, boots: 0x4a2a14, duster: 0x6a4a2c, hat: 0x3a2618, scarf: 0x8a1a1a, belt: 0x2a1a10 },
    parts: [
      ['torso', 'box', [0.62, 0.7, 0.4], [0, -0.02, 0], 0, 'duster'], ['torso', 'box', [0.06, 0.4, 0.02], [-0.09, 0.08, -0.205], [0, 0, 0.18], 'hat'], ['torso', 'box', [0.06, 0.4, 0.02], [0.09, 0.08, -0.205], [0, 0, -0.18], 'hat'],
      ['legL', 'box', [0.3, 0.62, 0.32], [-0.03, -0.3, 0.01], 0, 'duster'], ['legR', 'box', [0.3, 0.62, 0.32], [0.03, -0.3, 0.01], 0, 'duster'],
      ['armL', 'cyl', [0.1, 0.11, 0.6, 8], [0, -0.3, 0], 0, 'duster'], ['armR', 'cyl', [0.1, 0.11, 0.6, 8], [0, -0.3, 0], 0, 'duster'],
      ['head', 'cyl', [0.33, 0.33, 0.02, 14], [0, 0.12, 0], 0, 'hat', [1, 1, 0.85]], ['head', 'cyl', [0.13, 0.16, 0.17, 10], [0, 0.21, 0], 0, 'hat'], ['head', 'box', [0.03, 0.04, 0.2], [0, 0.29, 0], 0, 'hat'],
      ['head', 'box', [0.3, 0.12, 0.06], [0, -0.075, -0.14], [0.2, 0, 0], 'scarf'], ['head', 'cone', [0.1, 0.12, 3], [0, -0.17, -0.16], [Math.PI, 0, 0], 'scarf'],
      ['torso', 'box', [0.64, 0.06, 0.42], [0, -0.3, 0], 0, 'belt'], ['torso', 'box', [0.09, 0.07, 0.02], [0, -0.3, -0.215], 0, 'gold'],
      ['legL', 'tor', [0.035, 0.008, 4, 8], [0, -0.86, 0.14], [0, Math.PI / 2, 0], 'silver'], ['legR', 'tor', [0.035, 0.008, 4, 8], [0, -0.86, 0.14], [0, Math.PI / 2, 0], 'silver']
    ] }),
  S('alien', 'Alien-Hide Jacket', 2200, 'Green scaled hide off something that should not exist. Still glows a little.', {
    icon: '👽', face: true,
    pal: { skin: 0xd0a080, torso: 0x2e4a24, arms: 0x2e4a24, legs: 0x161616, pack: null, chest: { c: 0x7dff3a, e: 0x2a7a0a }, boots: 0x111111, scale: { c: 0x5a8a30, r: 0.5 }, glow: { c: 0x9dff5a, e: 0x3aa010 }, spike: { c: 0xb0e070, r: 0.4 }, hair: 0x0e0e0e, fur: 0x4a6a2a },
    parts: [
      ['head', 'sph', [0.176, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2], [0, 0.02, 0.01], 0, 'hair', [1, 0.7, 1.05]],
      ['head', 'tor', [0.13, 0.04, 5, 12], [0, -0.19, 0.01], [Math.PI / 2, 0, 0], 'fur'],
      ...[[-0.14, 0.15], [0.14, 0.1], [-0.08, -0.12], [0.12, -0.2], [0, 0.02], [-0.18, -0.25]].map(([x, y]) => ['torso', 'sph', [0.04, 6, 4], [x, y, -0.18], 0, 'scale']),
      ...[[-0.12, 0.1], [0.1, -0.05], [0, -0.22]].map(([x, y]) => ['torso', 'sph', [0.03, 6, 4], [x, y, 0.18], 0, 'glow']),
      ['torso', 'cone', [0.05, 0.14, 5], [-0.26, 0.34, 0.02], [0, 0, 0.3], 'spike'], ['torso', 'cone', [0.05, 0.14, 5], [0.26, 0.34, 0.02], [0, 0, -0.3], 'spike'], ['torso', 'cone', [0.04, 0.1, 5], [0, 0.2, 0.2], [-1.2, 0, 0], 'spike'],
      ['armL', 'cone', [0.03, 0.09, 4], [-0.09, -0.25, 0], [0, 0, 1.4], 'spike'], ['armR', 'cone', [0.03, 0.09, 4], [0.09, -0.25, 0], [0, 0, -1.4], 'spike'],
      ['armL', 'sph', [0.03, 6, 4], [0, -0.45, -0.08], 0, 'glow'], ['armR', 'sph', [0.03, 6, 4], [0, -0.45, -0.08], 0, 'glow']
    ] }),
  S('clown', 'Clown-Mask Heist Suit', 2800, 'Black suit, white clown mask, red nose, a duffel bag that is never empty. Smile for the cameras.', {
    icon: '🤡', face: true,
    pal: { skin: 0xd0a080, torso: 0x141414, arms: 0x141414, legs: 0x141414, pack: null, chest: 0xf0f0f0, boots: 0x0a0a0a, mask: { c: 0xf2eee2, r: 0.5 }, nose: { c: 0xe01010, e: 0x400000, r: 0.4 }, wig: 0xff5a1a, bag: 0x2a2a2a, tie: 0xb01010, glove: 0xf0f0f0 },
    parts: [
      ['head', 'sph', [0.178, 12, 9], [0, 0, -0.005], 0, 'mask', [1, 1.06, 0.98]],
      ['head', 'sph', [0.036, 8, 6], [0, -0.01, -0.18], 0, 'nose'],
      ['head', 'box', [0.045, 0.045, 0.02], [-0.06, 0.05, -0.165], [0, 0, Math.PI / 4], 'black'], ['head', 'box', [0.045, 0.045, 0.02], [0.06, 0.05, -0.165], [0, 0, Math.PI / 4], 'black'],
      ['head', 'box', [0.13, 0.025, 0.02], [0, -0.085, -0.16], 0, 'nose'], ['head', 'box', [0.03, 0.04, 0.02], [-0.07, -0.07, -0.155], [0, 0, 0.6], 'nose'], ['head', 'box', [0.03, 0.04, 0.02], [0.07, -0.07, -0.155], [0, 0, -0.6], 'nose'],
      ['head', 'sph', [0.085, 8, 6], [-0.17, 0.06, 0.03], 0, 'wig'], ['head', 'sph', [0.085, 8, 6], [0.17, 0.06, 0.03], 0, 'wig'],
      ['torso', 'box', [0.06, 0.34, 0.02], [0, 0.05, -0.19], 0, 'tie'],
      ['torso', 'cyl', [0.15, 0.15, 0.52, 10], [0, 0.02, 0.27], [0, 0, Math.PI / 2], 'bag'], ['torso', 'box', [0.05, 0.75, 0.02], [0, 0.05, -0.19], [0, 0, 0.55], 'bag'],
      ['torso', 'box', [0.12, 0.05, 0.07], [0.1, 0.16, 0.3], [0, 0.4, 0], 'cash'],
      ['armL', 'cyl', [0.095, 0.095, 0.12, 8], [0, -0.64, 0], 0, 'glove'], ['armR', 'cyl', [0.095, 0.095, 0.12, 8], [0, -0.64, 0], 0, 'glove']
    ] }),
  S('kingpin', 'Gold-Chain Kingpin', 3500, 'White suit, fat gold chain, gold shades, fedora and a cigar. Everybody in the Junction owes you.', {
    icon: '💰', face: true,
    pal: { skin: 0x6a4630, torso: 0xf2efe6, arms: 0xf2efe6, legs: 0xf2efe6, pack: null, chest: 0x111111, boots: { c: 0x1a1410, r: 0.2, m: 0.2 }, hat: 0xf2efe6, band: 0x111111, shade: { c: 0x1a1206, r: 0.1, m: 0.6 }, cigar: 0x5a3a1a },
    parts: [
      ['head', 'tor', [0.13, 0.03, 6, 16], [0, -0.22, -0.05], [Math.PI / 2 - 0.65, 0, 0], 'gold'], ['torso', 'tor', [0.16, 0.025, 6, 16], [0, 0.2, -0.08], [Math.PI / 2 - 0.9, 0, 0], 'gold'],
      ['torso', 'cyl', [0.075, 0.075, 0.025, 12], [0, 0.04, -0.2], [Math.PI / 2, 0, 0], 'gold'],
      ['head', 'box', [0.26, 0.05, 0.03], [0, 0.03, -0.165], 0, 'shade'], ['head', 'box', [0.28, 0.012, 0.035], [0, 0.058, -0.166], 0, 'gold'],
      ['head', 'cyl', [0.25, 0.25, 0.02, 14], [0, 0.12, 0], [-0.08, 0, 0], 'hat'], ['head', 'cyl', [0.14, 0.155, 0.15, 10], [0, 0.2, 0], 0, 'hat'], ['head', 'cyl', [0.157, 0.157, 0.035, 10], [0, 0.145, 0], 0, 'band'],
      ['head', 'cyl', [0.013, 0.013, 0.11, 6], [0.05, -0.09, -0.2], [Math.PI / 2 - 0.2, 0, -0.3], 'cigar'], ['head', 'sph', [0.016, 5, 4], [0.068, -0.08, -0.252], 0, 'ember'],
      ['armR', 'cyl', [0.092, 0.092, 0.05, 10], [0, -0.6, 0], 0, 'gold'], ['armL', 'tor', [0.025, 0.01, 4, 8], [0, -0.69, -0.06], 0, 'gold'],
      ['torso', 'box', [0.1, 0.4, 0.02], [-0.12, 0.08, -0.19], [0, 0, 0.22], 'hat'], ['torso', 'box', [0.1, 0.4, 0.02], [0.12, 0.08, -0.19], [0, 0, -0.22], 'hat']
    ] }),
  S('chrome', 'Full Chrome Legend', 5000, 'Head-to-toe mirror chrome, black visor, cyan glow. When you walk into a room, the room knows.', {
    icon: '🪩', face: false,
    pal: { torso: { c: 0xe8ecf0, r: 0.3, m: 0.55, e: 0x2c3238 }, arms: { c: 0xe8ecf0, r: 0.3, m: 0.55, e: 0x2c3238 }, legs: { c: 0xe8ecf0, r: 0.3, m: 0.55, e: 0x2c3238 }, helmet: { c: 0xf4f6f8, r: 0.3, m: 0.55, e: 0x2c3238 },
      pack: { c: 0xd0d4d8, r: 0.3, m: 0.55, e: 0x2c3238 }, chest: { c: 0x3cf0ff, e: 0x18a0b0 }, visor: { c: 0x050505, r: 0.05, m: 0.5 }, boots: { c: 0xd8dce0, r: 0.3, m: 0.55, e: 0x2c3238 },
      glow: { c: 0x3cf0ff, e: 0x2ad0e0 }, plate: { c: 0xffffff, r: 0.3, m: 0.55, e: 0x2c3238 } },
    parts: [
      ['armL', 'sph', [0.14, 10, 6], [-0.02, -0.02, 0], 0, 'plate', [1, 0.65, 1]], ['armR', 'sph', [0.14, 10, 6], [0.02, -0.02, 0], 0, 'plate', [1, 0.65, 1]],
      ['head', 'box', [0.26, 0.022, 0.02], [0, 0.0, -0.205], 0, 'glow'], ['head', 'box', [0.025, 0.12, 0.26], [0, 0.22, 0.02], 0, 'plate'],
      ['torso', 'box', [0.02, 0.5, 0.02], [-0.2, 0, -0.185], 0, 'glow'], ['torso', 'box', [0.02, 0.5, 0.02], [0.2, 0, -0.185], 0, 'glow'],
      ['legL', 'box', [0.025, 0.6, 0.025], [-0.12, -0.4, 0], 0, 'glow'], ['legR', 'box', [0.025, 0.6, 0.025], [0.12, -0.4, 0], 0, 'glow'],
      ['legL', 'box', [0.17, 0.14, 0.07], [0, -0.45, -0.11], 0, 'plate'], ['legR', 'box', [0.17, 0.14, 0.07], [0, -0.45, -0.11], 0, 'plate']
    ] })
];
export const BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
export const FREE = SKINS[0].id;
export const REGIONS = ['torso', 'arms', 'legs', 'helmet', 'pack', 'chest', 'visor', 'boots'];
export const SLOTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];

export const fin = v => typeof v === 'number' && Number.isFinite(v);
export const fmt = n => Math.round(+n || 0).toLocaleString('en-US');
// a material spec (palette value or MATS entry) -> { c, r, m, e, hidden }
export function matSpec(skin, key) {
  const v = skin?.pal && key in skin.pal ? skin.pal[key] : MATS[key];
  if (v === null) return { hidden: true };
  if (v === undefined) return null;
  const o = typeof v === 'number' ? { c: v } : v;
  return { c: o.c >>> 0, r: fin(o.r) ? o.r : 0.8, m: fin(o.m) ? o.m : 0, e: fin(o.e) ? o.e >>> 0 : 0 };
}
export const matKey = s => s.hidden ? 'hidden' : `${s.c.toString(16)}|${s.r}|${s.m}|${s.e.toString(16)}`;
export const geoKey = (shape, dims) => shape + ':' + dims.map(d => +(+d).toFixed(4)).join(',');

// ---------- save state ----------
export function fresh() { return { v: 1, owned: [FREE], eq: STOCK }; }
export function norm(raw) {
  const s = fresh(); if (!raw || typeof raw !== 'object') return s;
  const owned = Array.isArray(raw.owned) ? raw.owned.filter(id => BY_ID[id]) : [];
  s.owned = [...new Set([FREE, ...owned])].sort((a, b) => SKINS.indexOf(BY_ID[a]) - SKINS.indexOf(BY_ID[b]));
  s.eq = raw.eq === STOCK || s.owned.includes(raw.eq) ? raw.eq : STOCK;
  return s;
}
export function parse(str) { try { return norm(JSON.parse(str)); } catch (e) { return fresh(); } }
export const owns = (s, id) => id === STOCK || !!s?.owned?.includes(id);

// buy: price check only; the caller spends the credits (game.spend) and then commits with addOwned
export function canBuy(s, id, credits) {
  const k = BY_ID[id]; if (!k) return { ok: false, why: 'unknown' };
  if (owns(s, id)) return { ok: false, why: 'owned' };
  if (!(fin(credits) && credits >= k.price)) return { ok: false, why: 'broke', need: k.price - (fin(credits) ? credits : 0) };
  return { ok: true, price: k.price };
}
export function addOwned(s, id) { return norm({ ...s, owned: [...s.owned, id] }); }
export function equip(s, id) { return owns(s, id) && (id === STOCK || BY_ID[id]) ? { ok: true, state: { ...s, eq: id } } : { ok: false, state: s, why: 'not owned' }; }

// the shop rows: every skin with its state for this save + wallet
export function rows(s, credits, mode = 'shop') {
  const list = SKINS.map(k => ({ id: k.id, name: k.name, icon: k.icon, price: k.price, blurb: k.blurb, owned: owns(s, k.id), worn: s.eq === k.id, afford: fin(credits) && credits >= k.price }));
  const stock = { id: STOCK, name: 'Colony Issue (stock suit)', icon: '⚪', price: 0, blurb: 'The plain white suit you landed in.', owned: true, worn: s.eq === STOCK, afford: true };
  return mode === 'wardrobe' ? [stock, ...list.filter(r => r.owned)] : list;
}

// real tap: the same pointer, and it never moved TAP_PX or more during the gesture
export function isRealTap(down, up, maxMove = 0) {
  if (!down || !up || down.id !== up.id) return false;
  return Math.max(+maxMove || 0, Math.hypot(up.x - down.x, up.y - down.y)) < TAP_PX;
}
// what the skin does to the rig: count of parts per slot, hidden regions
export function summary(id) {
  const k = BY_ID[id]; if (!k) return null; const per = {};
  for (const p of k.parts) per[p[0]] = (per[p[0]] || 0) + 1;
  const hidden = REGIONS.filter(r => k.pal[r] === null).concat(k.face ? ['helmet', 'visor'] : []);
  return { id, parts: k.parts.length, per, hidden: [...new Set(hidden)], face: !!k.face };
}

// ---------- Steve's player body API (PR #48, SSX.models.player()) ----------
// blocky rig reference (look/models-player.js SIZES_BLOCKY / BLOCKY sockets): our parts are modelled on it
export const BLOCKY_SIZES = { headRadius: 0.23, helmetRadius: 0.23, torso: { w: 0.56, h: 0.66, d: 0.36 }, armRadius: 0.085, upperArm: 0.35, forearmRadius: 0.08, forearm: 0.35,
  handRadius: 0.077, handLength: 0.1, legRadius: 0.12, thigh: 0.44, shinRadius: 0.11, shin: 0.44, footWidth: 0.2, footLength: 0.32 };
export const BLOCKY_SOCK = { arm: [0, -0.2, 0], forearm: [0, -0.5, 0], hand: [0, -0.7, 0], leg: [0, -0.24, 0], shin: [0, -0.6, 0], foot: [0, -0.86, -0.04] };
export const FACE_R = 0.17; // our bare head's radius (face skins' hats / masks are modelled around it)
export const SOCKETS = ['head', 'torso', 'armL', 'armR', 'forearmL', 'forearmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'];
// a limb part goes on the upper arm / forearm / hand (thigh / shin / foot) by its height on the blocky limb (y down from the joint)
const LIMB_CUT = { arm: [[-0.35, 'arm'], [-0.62, 'forearm'], [-Infinity, 'hand']], leg: [[-0.44, 'leg'], [-0.76, 'shin'], [-Infinity, 'foot']] };
export function sockOf(slot, y) { const m = /^(arm|leg)([LR])$/.exec(slot); if (!m) return slot; const v = fin(y) ? y : 0; for (const [t, n] of LIMB_CUT[m[1]]) if (v > t) return n + m[2]; return slot; }
const SZ = { arm: ['armRadius', 'upperArm'], forearm: ['forearmRadius', 'forearm'], hand: ['handRadius', 'handLength'], leg: ['legRadius', 'thigh'], shin: ['shinRadius', 'shin'], foot: ['footWidth', 'footLength'] };
const ratio = (a, b) => { const v = +a / b; return fin(v) && v > 0 ? Math.min(2, Math.max(0.3, v)) : 1; };
// scale + offset of one anchor on a socket of a body with sizes sz: blocky sizes -> scale 1, offset = -blocky socket position
// (so the parts land exactly where they sit on main); other bodies scale by their sizes over the blocky ones
export function sockFit(sock, sz, face) {
  const R = BLOCKY_SIZES, z = sz || R, m = /^(arm|forearm|hand|leg|shin|foot)[LR]$/.exec(sock); let s;
  if (sock === 'head') { const k = face ? (z.headRadius === R.headRadius ? 1 : ratio(z.headRadius, FACE_R)) : ratio(z.helmetRadius, R.helmetRadius); s = [k, k, k]; }
  else if (sock === 'torso') s = [ratio(z.torso?.w, R.torso.w), ratio(z.torso?.h, R.torso.h), ratio(z.torso?.d, R.torso.d)];
  else if (m) { const [rk, lk] = SZ[m[1]], a = ratio(z[rk], R[rk]), l = ratio(z[lk], R[lk]); s = m[1] === 'foot' ? [a, (a + l) / 2, l] : m[1] === 'hand' ? [a, (a + l) / 2, a] : [a, l, a]; }
  else s = [1, 1, 1];
  const b = m ? BLOCKY_SOCK[m[1]] : [0, 0, 0];
  return { s, o: [-b[0] * s[0] || 0, -b[1] * s[1] || 0, -b[2] * s[2] || 0] };
}
// hats, masks, wigs and bare-head (face) skins hide the v8 body's hair
export const hidesHair = k => !!k && (!!k.face || (k.parts || []).some(p => p[0] === 'head'));
