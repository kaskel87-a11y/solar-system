# The Rust Pit: Mars fight club (`mars/fightclub.js`)

An underground cage in **Red Tape Flats** (local AJ `[-292,-68]`). Bare-knuckle and blade bouts, a ladder of 8 fictional fighters plus a champ, wagers on your own fights and bets on NPC undercards. It **extends the v7.4 duel system in `world.js`**. There is no second combat system.

## How to trigger it
- Walk to the 🥊 beam/octagon in Red Tape Flats. The action button reads **🥊 Rust Pit**.
- Press the **`]`** key (BracketRight), use the dock button **🥊 Pit** (`#ssxDock`, guarded), or the menu item **🥊 Rust Pit**.
- In the panel: pick Bare/Blade, a stake, then tap **Fight** on an eligible rung (up to 2 ranks above you; only #2 can fight the champ). Bet the undercard while the card is open.

## Rules
- **Odds** come from Elo-style ratings: `p = 1/(1+10^((Rb-Ra)/400))`, `odds = 0.92/p` (8% house edge). Your stake is taken up front and paid at `stake*odds` on a win. The purse is paid through the duel pot.
- **Ladder:** the winner takes the loser's slot, and losing drops you one rank. Fighter stats scale with rating (`tough = 0.7+1.5k`, `dmg = 0.8+k`, where `k=(R-1000)/1000`).
- **Champ:** beat #1 to take the belt. A **title defence** is called every 20 min, against #2 by default, with a 10 min window. If you miss it, you are stripped and #2 is crowned.
- **Undercard:** an NPC-vs-NPC card every 90 s, live for 12 s. You can bet 10 to 1000 cr per card and pick one side. About 20% of cards are quietly fixed for the underdog. With `SSX.rep` ≥ 20 with the fixer's gang you get a whisper. With an active `SSX.bribes` tip-off, winnings pay ×1.25.
- **Never draws security.** Ring bouts are duels, so `crime()` ignores colonist hits while `inDuel`. Bouts require wanted 0 to start, and the test asserts wanted stays 0 throughout. If you are wanted, the pit refuses you and points you to Rusk when `SSX.bribes` exists.

## Gang fixes (guarded integrations)
- With `SSX.rep` present there is a 30% chance a gang (saltblood / saints / dustjaws) offers a **dive**: `challenge(id, {fix:'take'|'refuse'})`.
  - Take it and lose: the gang pays you, adds 2 Glow-dust via `SSX.contraband.add`, and gives rep +4.
  - Take it and win anyway: rep −8 ("crossed").
  - Beating a gang's fighter cleanly costs −1 rep with that gang.
- Every call to `SSX.rep`, `SSX.contraband` and `SSX.bribes` is optional and try/caught.

## API: `window.SSX.fight`
| call | returns |
|---|---|
| `ladder()` | `[{id,name,rank,rating,w,l,gang,champ,you}]` |
| `status()` | `{you, bout, last, card, offer, defence, bets, stats, inCage, near}` |
| `odds(a,b)` | `{a,b,pA}` decimal odds |
| `challenge(id,{style:'bare'|'blade', stake, fix, noFix, forceFix})` | `{ok,msg,odds,offer?}` |
| `bet(id, stake)` | `{ok,msg,odds}` on the open undercard |
| `card()` | current undercard |
| `on(fn)` | unsubscribe fn. Also `window` event `ssx:fight` and `SSX.emit('fight:'+type)` |
| `open()` / `close()` | panel |
| `debug` | `goto, card(a,b,o), runCard, resolveCard(id), fix(id), defence, expire, setRank(n), reset, state, inCage` |

Event types: `start, result, payout, champ, defence, stripped, card, cardLive, cardResult, bet, fix, change`.

## Notes for other bots
- **`world.js` change (small, backwards-compatible):** `challenge(type, wager, who, opts)` gained `opts.as = {name, tough, dmg, purse, label}`, which borrows the nearest colonist as a named fighter and restores it afterwards, and `opts.tag`, which is echoed in `duel`/`lastDuel`. `lastDuel` also carries `hits`/`taken`. Existing callers are unaffected.
- Persistence is in `localStorage['ssx.fight.v1']`.
- UI is black/white with targets of at least 44 px. Ids are `#fcPanel #fcHud`, dock `dockFight`, menu `rmFight`. The HUD is hidden while `body.duel` (the stock duel banner) shows.
- Test: `tests/test-fightclub.js` (port 8887, `--workers=1` style, one browser). Headless desktop chromium renders at about 2 fps and `dt` is capped at 0.1, so bouts run about 5× slower there.
