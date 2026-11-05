// Bar contact (pure; runtime in mars/barcontact.js): Juno Pike works the door of the Cantina in Ares Junction.
// After the same unlock as Sable's text (3 city missions) Juno passes on the Halvorsen Villa tip, by a context button
// that only shows when you're standing next to them. Works before or after the phone text; never unlocks twice.
export const CONTACT = {
  id: 'bar-contact-juno', name: 'Juno Pike', short: 'Juno', bar: 'Cantina', district: 'Ares Junction',
  at: [35, -10],   // colony-relative: the open lot just off the Cantina's front door (door at [31,-13.6]); probed clear
  yaw: 0.6,        // faces the street
  talkR: 2.6,      // context button range (m)
  bodyR: 70,       // body streams in inside this range
  holdR: 12,       // Sable's text waits while you're this close (Juno tells you in person)
};
export const LABEL = '💬 Ask Juno';
export const LINES = {
  tip: "◆ Sable says you're good for it. Halvorsen Villa, Helios Heights. Owner's off-world all week. Wall safe in a back vault, three cameras, two guards, power box out back. ➤ ☰ Heists when you're ready.",
  again: "◆ Sable already texted you? Then you know the place. Halvorsen Villa. Cut the power out back first, the guards walk the hall and the yard. ➤ ☰ Heists.",
};
// show the button? unlocked, on foot, outside, not mid-heist, close enough
export function offer(st, d, { driving = false, indoors = false, heist = false } = {}) {
  return !!st?.unlocked && !driving && !indoors && !heist && d <= CONTACT.talkR;
}
// which line: first time (nobody told you yet) or a reminder (Sable's text or Juno already did)
export const lineFor = st => (st?.tipped ? LINES.again : LINES.tip);
