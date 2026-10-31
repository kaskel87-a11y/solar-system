// v7.5.12 cop bounty (Collin): every ColSec officer you kill (on foot: 'officer' / 'heavy') pays a flat 500 cr and +100 ⭐
// (spendable Star Shop stars = lifetime xp - spent, so the stars go in as +100 xp). Paid once per kill (world.js secKill removes
// the unit first), NOT run through SSX.economy.payoutMult, and the wanted-heat gain on the kill is unchanged. Pure: unit-tested.
export const COP_BOUNTY = Object.freeze({ cr: 500, stars: 100 });
export const isCop = s => !!s && s.foot === true;
export const bountyFor = s => (isCop(s) ? { cr: COP_BOUNTY.cr, stars: COP_BOUNTY.stars } : null);
export const bountyText = b => (b ? `+${b.cr} cr · +${b.stars} ⭐` : '');
