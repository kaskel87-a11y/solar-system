// v7.5.33 The Velvet Airlock's Hold'em room (Collin: "Texas Hold'em at the Velvet Airlock"). The club grew to 4x its
// floor area (interiors.js: 44 x 32 m, the old 22 x 16 room is its north-east corner, unchanged) and the new west wing is
// the card room: one oval felt table, Mags the dealer, three seated regulars and an empty chair for you.
// No new poker engine: the walk-up spot ('🃏 Texas Hold'em', act 'poker') opens activities/poker.js (the same Hold'em
// modal as Nyx's static table) re-themed through openPokerTable({ theme }). Buy-in in in-game credits only (100 / 250 /
// 600), 4 hands, cash out any time; all poker buttons are black with white text and bound with panelTap (tap-safe on iOS).
// Draw calls: ~20 plain meshes + 4 people; nothing animated but the people.
import { openPokerTable, pokerIsOpen } from './activities/poker.js';

export const POKER_ROOM = { x: -22, z: 0 }; // table centre, club room-local metres (west wing)
export const VELVET_THEME = {
  title: 'Velvet Hold\u2019em', host: 'Mags', bouncer: 'Tiny', names: ['Lady Rust', 'Pike', 'Okafor', 'Vale'], nAi: 3, buyIns: [100, 250, 600],
  hint: 'Mags deals, Tiny watches your hands. In-game credits only.',
  offer: 'Seat\u2019s open, sugar. Blinds are 5 and 10. Ines\u2019s house, Ines\u2019s rules.', hint2: 'Tip Mags mid-hand for a peek (25 cr). Get caught and Tiny walks you out the back.',
};
// seats around the oval: angle 0 = south (your chair)
export const SEATS = [{ id: 'you', a: 0 }, { id: 'p0', a: 1.3 }, { id: 'p1', a: 2.4 }, { id: 'p2', a: -1.3 }];
export const DEALER_A = -2.4; // Mags stands at the north-west curve, opposite the third regular
export const seatPos = (a, x = POKER_ROOM.x, z = POKER_ROOM.z, rx = 2.55, rz = 1.85) => ({ x: x + Math.sin(a) * rx, z: z + Math.cos(a) * rz, yaw: a + Math.PI });

// interiors.js calls this while building the club. poses: { sit(h), idle(h, t, k) } from interiors.js (no import cycle).
export function addPokerRoom(api, { x = POKER_ROOM.x, z = POKER_ROOM.z } = {}, poses = {}) {
  const { box, mat, G } = api;
  const felt = mat(0x0e5a32, { roughness: 0.95 }), rail = mat(0x2a140a, { roughness: 0.5 }), brass = mat(0xc8a040, { metalness: 0.8, roughness: 0.3 });
  const rug = mat(0x2a0a1a, { roughness: 1 }), seatM = mat(0x5a0a2a, { roughness: 0.9 }), lampM = mat(0xffd890, { basic: true });
  box(x, 0.012, z, 9.5, 0.02, 7.5, rug);
  const oval = (m, y, rx, h, rz) => { const o = api.mk(G.cyl, m, x, y, z, rx, h, rz); api.g.add(o); return o; };
  oval(rail, 0.35, 0.45, 0.7, 0.45); // pedestal
  oval(rail, 0.74, 2.0, 0.1, 1.45); // padded rail
  oval(felt, 0.8, 1.8, 0.04, 1.28); // felt
  box(x, 0.83, z - 0.2, 1.2, 0.01, 0.16, mat(0xf7f3ea)); // the board (five cards, one strip)
  for (const [dx, dz, c] of [[-0.8, 0.5, 0xd0201a], [0.7, 0.55, 0x2050d0], [1.1, -0.3, 0x111111], [-1.1, -0.35, 0xf0f0f0]]) box(x + dx, 0.85, z + dz, 0.16, 0.06, 0.16, mat(c)); // chip stacks
  box(x, 3.6, z, 2.2, 0.06, 0.8, lampM); box(x, 5.05, z, 0.04, 2.9, 0.04, brass); // hanging lamp (small: keeps the sign in view)
  api.col(x, z, 2.05, 1.5);
  // chairs + the regulars (seat 'you' stays empty: that's the walk-up spot)
  const looks = [{ top: 0x8a2a2a, bottom: 0x1a1a22, hair: 0xb02030, hairStyle: 'long', skin: 0xe0b090, accent: 0xffd040 },
    { top: 0x2a2a3a, bottom: 0x1a1a22, hair: 0x101010, hairStyle: 'mohawk', skin: 0x8a5a3a, shades: true },
    { top: 0x3a5a3a, bottom: 0x22302a, hair: 0x6a3a1a, hairStyle: 'cap', skin: 0x6a4028 }];
  SEATS.forEach((s, i) => {
    const p = seatPos(s.a, x, z, 2.75, 2.05), c = seatPos(s.a, x, z, 3.05, 2.3);
    box(p.x, 0.24, p.z, 0.55, 0.48, 0.55, seatM); const back = box(c.x, 0.75, c.z, 0.55, 0.7, 0.12, seatM); back.rotation.y = p.yaw;
    api.col(p.x, p.z, 0.32, 0.32);
    if (i) api.person(looks[i - 1], p.x, p.z, p.yaw, (h, t) => { poses.sit?.(h); h.arms[0].rotation.x = 1.0 + Math.sin(t * 0.9 + i) * 0.08; h.arms[1].rotation.x = 1.0; h.head.rotation.y = Math.sin(t * 0.25 + i * 2) * 0.35; }, i);
  });
  // Mags, the dealer: standing at the north-west curve, dealing
  const dp = seatPos(DEALER_A, x, z, 2.55, 1.95);
  api.person({ top: 0xf0f0f0, bottom: 0x101010, hair: 0x2a1a10, hairStyle: 'bun', skin: 0xc68a64, accent: 0xff3cc8 }, dp.x, dp.z, dp.yaw, (h, t) => { poses.idle?.(h, t, 1); const k = (t * 0.8) % 1; h.arms[1].rotation.x = 1.1 + (k < 0.3 ? Math.sin(k / 0.3 * Math.PI) * 0.5 : 0); h.arms[0].rotation.x = 1.0; }, 9);
  api.col(dp.x, dp.z, 0.3, 0.3);
  api.sign('TEXAS HOLD\u2019EM', 0x7dff9a, x, 3.9, -7.9 + 0.06, 0, 5.2, { w: 1024, h: 160, font: 'bold 92px system-ui, sans-serif' });
  api.sign('MAGS DEALS \u00b7 NO PHONES AT THE TABLE', 0xffd040, x, 3.0, -7.9 + 0.06, 0, 4.6, { h: 80 });
  const sp = seatPos(0, x, z, 2.75, 2.05);
  api.spot({ id: 'poker', x: sp.x, z: sp.z + 0.6, r: 1.4, label: '\u{1F0CF} Texas Hold\u2019em \u00b7 buy-in 100+', act: 'poker', who: 'Mags' });
}

// index.html routes the 'poker' hotspot here
export function openVelvetPoker(opts = {}) { if (pokerIsOpen()) return { ok: false, why: 'open' }; return openPokerTable({ ...opts, theme: VELVET_THEME }); }
export { pokerIsOpen };
