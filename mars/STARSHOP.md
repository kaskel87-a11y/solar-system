# ⭐ Star Shop (v7.6, Marsmania)

Spend stars (the ⭐ in the HUD, `game.progress.xp`) on Blue's contraband instead of credits. Fiction only.

| Product | Stars | (Credits at Blue's) |
|---|---|---|
| 🎈 Low-G | 200 ⭐ | 20 cr |
| 🔵 Glow-dust | 250 ⭐ | 40 cr |
| ⚡ Red Static | 400 ⭐ | 75 cr |
| 🍯 Void Honey | 600 ⭐ | 160 cr |

**Where:** ☰ → ⭐ Star Shop (anywhere on Mars; Blue's runner drops it in your stash), and a `⭐ 250`-style button next to
Buy 1 / Buy 5 on Blue's sheet in The Blue Room (Red Tape Flats). Off Mars and in the Rust Pit it refuses with a plain message.

**Rank is safe:** `progress.xp` is never lowered. Spent stars are counted separately in `localStorage['ssx.stars.v1']`.
Stars to spend = lifetime stars - spent (never below 0). Rank still uses lifetime XP. If a save is wiped (XP back to 0),
the spent counter resets too. Note: the HUD ⭐ still shows lifetime stars; the shop shows the spendable balance.

**No double charges:** busy lock + 300 ms per-item dedupe (`{ ok:false, dup:true }`), and freshly drawn buttons ignore
taps for 250 ms. Carry limits come from `SSX.contraband` (20 units, per-item max): no room means no charge.

## API
- `SSX.stars`: `balance()`, `lifetime()`, `spent()`, `canSpend(n)`, `spend(n, reason)` -> `{ ok, n, balance } | { ok:false, msg, short? } | { ok:false, dup:true }`,
  `refund(n)`, `on(fn)` (events `spend`, `refund`, `buy`; also `window` `ssx:stars`).
- `SSX.starshop`: `prices()`, `buy(item)`, `open()`, `close()`, `status()`, `blocked()`, `debug.reset()`.

## Tests
- `node tests/test-starshop-unit.mjs`: prices, spend, rank unchanged, can't overspend, double tap charges once, migrate.
- `BASE=http://127.0.0.1:<port>/ BR=webkit DEV="iPhone 14" OUT=./shots/starshop/ node tests/test-starshop.js` (and `DEV=desktop BR=chromium`).
