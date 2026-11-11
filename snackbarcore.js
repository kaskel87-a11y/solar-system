// Velvet Airlock snack bar. Pure rules: the menu, the price check, and where it sits.
// The counter is on the empty floor west of Ines's office and north of the Dome Room
// (velvetwing.js: office x>=18 z<=1, Mina's loop stays at z>=7.4). Not an Empire front.
export const AT = { x: 13.05, z: 4.3 };
export const BUFF_SEC = 60;
export const BUFF_MIT = 0.75; // hits hurt 25% less while the burger is working

export const MENU = Object.freeze([
  { id: 'wings', name: 'Wings', price: 25, heal: 25, buff: 0, blurb: '+25 health' },
  { id: 'sliders', name: 'Sliders', price: 30, heal: 30, buff: 0, blurb: '+30 health' },
  { id: 'nachos', name: 'Nachos', price: 20, heal: 20, buff: 0, blurb: '+20 health' },
  { id: 'burger', name: 'Red Dust burger', price: 45, heal: 40, buff: BUFF_SEC, blurb: '+40 health. Hits hurt 25% less for 60 seconds.' }
]);

export const byId = id => MENU.find(it => it.id === id) || null;

// Can this plate be bought right now? Does not spend or heal.
export function quote(item, hp, hpMax, credits) {
  if (!item) return { ok: false, why: 'Not on the menu.' };
  const price = item.price | 0, have = credits | 0, cur = +hp || 0, max = +hpMax || 0;
  if (have < price) return { ok: false, why: `Short ${price - have} credits.` };
  if (cur >= max && !item.buff) return { ok: false, why: "You're already full." };
  return { ok: true, price, heal: item.heal | 0, buff: item.buff | 0 };
}
