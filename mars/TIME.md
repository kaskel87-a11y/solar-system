# Mars day/night cycle — `window.SSX.time`

Files: `mars/timecore.js` (pure rules, unit tested) and `mars/time.js` (runtime).
One hook in index.html, placed right after the Director line:

```html
<script type="module" src="./mars/time.js?v=7.5.2"></script> <!-- Mars day/night cycle (window.SSX.time) -->
```

## Clock
- One game day is 24 real minutes at scale 1, so 1 game hour = 1 real minute. That's the same as Director's 1×.
- The clock runs on real time. A background tab doesn't fast-forward, because each step is capped at 5 s.
- The clock is saved to `localStorage['ssx.time.v1']` as `{v, h, scale, frozen}`. It saves every 0.1 game hours, and on pagehide or when the tab is hidden.
- First load (nothing saved): the clock starts from `dangercore.marsHour()`, so it agrees with the street-danger director from the first frame.

## Phases: the same bands as `dangercore.timeBand()`
| phase | hours |
|---|---|
| dawn | 05:00–08:00 |
| day | 08:00–17:00 |
| dusk | 17:00–21:00 |
| **night** | **21:00–05:00** (`isNight()` ⇔ `timeBand(h) === 'night'`) |

The sun rises at about 06:12 and sets at about 19:24. The sky is fully dark by about 20:30. Night gameplay (crime and cops) ramps up from 18:30 to 21:00 and back down from 05:00 to 07:00.

## API
| call | does |
|---|---|
| `now()` / `hour()` | game hour as a float in [0, 24) |
| `isNight()` | true from 21:00 to 05:00 |
| `phase()` | `'dawn' \| 'day' \| 'dusk' \| 'night'` |
| `nightness()` | 0 by day to 1 at night, smooth through dusk and dawn |
| `on('change' \| 'night' \| 'day', fn)` | returns an unsubscribe function. `change` fires on every phase change. `night` and `day` fire when `isNight()` flips, so `day` fires at 05:00 |
| `set(h)` | hour as a number, or a preset or phase name: `'dawn'` 6.5, `'noon'` 12, `'dusk'` 19, `'night'` 23, `'midnight'` 0 |
| `setScale(x)` | 0–240 (1 = 24-minute day) |
| `freeze(bool)` | stops or starts the clock |
| `crimeMultiplier(h?)` | 1 by day, 1.9 at night, 2.1 from 00:00 to 03:00 |
| `copsMultiplier(h?)` | 1 by day, 0.5 at night |
| `secondsToNight()`, `format(h?)`, `state()`, `look()` | helpers |
| `addLookFilter(fn)` | `fn(look, ctx)` returns a modified look. Returns an unregister function. Director uses it for dust storms |
| `syncDanger(bool)` | turns pushing the clock into `dangercore.setClock()` on or off |

Events: `SSX.emit('time:phase', d)` and `window` `CustomEvent('time:phase', {detail: d})`, where `d = {phase, prev, hour, night, why}`. `SSX.emit('time:ready', state)` fires once.

Beltway / Marsmania "wait for dark" should call `SSX.time.set(SSX.time.NIGHT_START)`, which is 21. For a check, use `SSX.time.isNight()`.

## What night does (Mars surface only, never indoors)
- **Look:** the sun, directional and hemi light, sky colours, fog colour and background all follow the clock. Night has a deep violet sky, low cold light, purple shadow fill, and stars (420 points on phones, 1200 on desktop).
- **Neon (no bloom):** street signs get brighter colours plus an additive halo card. Only signs within 70 m on phones (110 m on desktop) get a halo, to limit overdraw. Club, cantina and gun-shop fronts throw a coloured spill on the ground, the club door gets a glow, and the colony lamp burns 60% hotter.
- **Street crime:** each tick, SSX.time feeds the danger director's own `setClock()`, so its time-band spawn weights (up to 1.9× at night) follow this clock. It stops pushing (yields) if something else sets the danger clock. `dangercore.js` is not edited. Chief of Staff can switch it to read `SSX.time.isNight()`.
- **Fewer cops:** `SSX.city.securityResponse` is wrapped. At night a wave of level L becomes `max(1, round(L·0.5 + 0.25))`, applied only once even if other add-ons also wrap it.
- **NPC cap:** this module spawns no NPCs. The phone `world.npcBudget()` cap stays at 12.
- **☰ menu:** "🌙 Mars HH:MM" lets you kill time until dark (21:00) or sleep until 08:00. It refuses while you're wanted.

## Merge notes
- Run `python3 tools/importmap.py`, which adds `mars/time.js` and `mars/timecore.js`.
- `sw.js` PRECACHE: add `` `mars/time.js${q}` `` and `` `mars/timecore.js${q}` ``.
- Stacks on #17 (steve/director-mode). Merge #17 first, or both together.
- Engine need: there's no public hook for ColSec patrol density (world.js `caps` is internal). A `world.setSecurityScale(k)` would let night thin the patrols as well as the response waves.

## Tests
- `node tests/test-time-unit.mjs`
- `SHOTS_DIR=$PWD/.shots/time BASE=http://127.0.0.1:PORT/ BR=webkit DEV="iPhone 14" node tests/test-time.js` (also BR=chromium, and DEV="iPhone SE")
