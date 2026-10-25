// Multi-planet signature rides, as pure data: a driving spec plus a "look" = stock body from world.js + livery + accent keys.
// No new boxy meshes. Accents are a few rounded placeholders (planets/hooks.js ACCENTS), keyed so v8 can swap a glTF per kind.
// Kind ids match the story pack (solar-system-story/missions.json `vehicle:` ids).
export const EXT_VEHICLES = {
  acid_crawler: { name: 'Acid crawler', icon: '🛡', vmax: 14, boost: 22, acc: 7, bacc: 11, turn: 1.1, wy: 0.7, wr: 0.7, r: 3.1, tough: true,
    look: { base: 'hauler', scale: [1.1, 1.05, 1.1], livery: { color: 0xc89a3a, metalness: 0.85, roughness: 0.28 }, accents: ['beacon-amber', 'ram'] } },
  sun_skimmer: { name: 'Sun skimmer', icon: '🏎', vmax: 30, boost: 44, acc: 15, bacc: 22, turn: 1.6, wy: 0.42, wr: 0.42, r: 2.2,
    look: { base: 'buggy', scale: [1.12, 0.85, 1.12], livery: { color: 0xe6ecf4, metalness: 1, roughness: 0.08 }, accents: ['beacon-cyan'] } },
  methane_skiff: { name: 'Methane skiff', icon: '🛥', vmax: 24, boost: 36, acc: 11, bacc: 17, turn: 1.3, hover: 1.3, r: 2.8, lean: 0.3,
    look: { base: 'shuttle', scale: [0.8, 0.7, 0.8], livery: { color: 0x8a4a22, metalness: 0.45, roughness: 0.5 }, accents: ['skirt-green'] } },
  crevasse_sled: { name: 'Crevasse sled', icon: '🛷', vmax: 19, boost: 28, acc: 10, bacc: 15, turn: 1.4, wy: 0.62, wr: 0.62, r: 2.6, tough: true,
    look: { base: 'hauler', scale: [0.95, 0.95, 0.95], livery: { color: 0xe8eef4, metalness: 0.3, roughness: 0.35 }, accents: ['drill', 'beacon-cyan'] } },
  lava_runner: { name: 'Lava runner', icon: '🏍', vmax: 32, boost: 48, acc: 18, bacc: 26, turn: 2.1, hover: 0.9, r: 1.4, lean: 0.5,
    look: { base: 'hoverbike', scale: [1, 1, 1.05], livery: { color: 0x1c1a1a, metalness: 0.75, roughness: 0.3, emissive: 0x2a0800 }, accents: ['skirt-orange'] } }
};
