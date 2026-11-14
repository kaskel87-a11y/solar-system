// v7.5.96 mounted guns for every car you can drive. Pure rules.
// One purchase puts twin guns on the rover, a bought car, or a stolen ride.
// Rockets are the second tier. Shooting people still uses the game's wanted-star rules.
export const GUNS = 'rideguns';
export const ROCKETS = 'riderockets';
export const GUN_PRICE = 900;
export const ROCKET_PRICE = 1400;

export const GUN = { id: 'ride-gun', name: 'Mounted guns', short: 'Guns', icon: '🔫', cd: 0.14, dmg: 1.6, speed: 130, color: 0xffe14a, size: 1.5, heat: 7, twin: true, life: 1.05 };
export const ROCKET = { id: 'ride-rocket', name: 'Mounted rockets', short: 'Rockets', icon: '🚀', cd: 0.55, dmg: 2, speed: 62, color: 0xff7a20, size: 2.0, heat: 16, twin: true, life: 2.0, splash: 5, splashDmg: 6, rocket: true };

export const has = (ups, id) => Array.isArray(ups) && ups.includes(id);
export function mode(ups) { return has(ups, ROCKETS) && has(ups, GUNS) ? 'rocket' : has(ups, GUNS) ? 'gun' : null; }
export function weapon(ups) { const m = mode(ups); return m === 'rocket' ? { ...ROCKET } : m === 'gun' ? { ...GUN } : null; }
// the kit does not care what the car is called
export const covers = kind => typeof kind === 'string' && kind.length > 0;
export const HOW = 'Buy mounted guns at the Meridian Depot. While you drive, tap FIRE. Shooting people brings stars. Rockets are the next case on that wall.';
