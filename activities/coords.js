// Pack coords (at_aj, at_local + district centre) are Ares Junction-relative: world = colony.x/z + value,
// the same frame game.js colonyAt(), mars/jobs.js here() and modes/raids.js ajToWorld() use. Player/car x,z are world.
// Pure helpers so the runner never compares AJ-relative points with raw world positions.
export const toAJ = (x, z, colony) => colony ? { x: x - colony.x, z: z - colony.z } : null;
export const toWorld = (at, colony) => colony && Array.isArray(at) ? { x: colony.x + at[0], z: colony.z + at[1] } : null;
