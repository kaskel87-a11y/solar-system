// v7.4 street danger: the bits of Steve's Mars city pack we read (copied, not edited). Source of truth:
// solar-system-story/mars-city/highway.json (Ares Beltway: polyline, district centres, checkpoints, 2 chase set-pieces,
// phone caps). All coordinates AJ-relative metres (x east, z south): world = colony.x/z + value.
// Re-sync by re-running the snippet in STREET-DANGER.md (section "Data") when highway.json changes. District radii are ours.
export const MARS_CITY = {
 "source": "solar-system-story/mars-city/highway.json (solar-system-story/mars-city highway v1)",
 "name": "Ares Beltway",
 "districts": [
  {
   "id": "downtown",
   "src": "mars-downtown",
   "x": 0,
   "z": -430,
   "r": 130
  },
  {
   "id": "rough",
   "src": "mars-rough",
   "x": -280,
   "z": -40,
   "r": 120
  },
  {
   "id": "gated",
   "src": "mars-gated",
   "x": 320,
   "z": 80,
   "r": 100
  }
 ],
 "beltway": [
  [
   0,
   -55
  ],
  [
   -30,
   -50
  ],
  [
   0,
   -220
  ],
  [
   0,
   -390
  ],
  [
   0,
   -430
  ],
  [
   60,
   -430
  ],
  [
   180,
   -200
  ],
  [
   280,
   40
  ],
  [
   320,
   80
  ],
  [
   120,
   160
  ],
  [
   80,
   40
  ],
  [
   0,
   60
  ],
  [
   -140,
   20
  ],
  [
   -240,
   -20
  ],
  [
   -280,
   -40
  ],
  [
   -200,
   -120
  ],
  [
   -80,
   -160
  ],
  [
   0,
   -55
  ]
 ],
 "waypoints": {
  "aj-south": [
   0,
   -55
  ],
  "aj-spur-club": [
   -30,
   -50
  ],
  "mid-ridge": [
   0,
   -220
  ],
  "dt-north": [
   0,
   -390
  ],
  "dt-plaza": [
   0,
   -430
  ],
  "dt-east": [
   60,
   -430
  ],
  "east-cut": [
   180,
   -200
  ],
  "gc-west": [
   280,
   40
  ],
  "gc-gate": [
   320,
   80
  ],
  "north-loop": [
   120,
   160
  ],
  "aj-east": [
   80,
   40
  ],
  "aj-north": [
   0,
   60
  ],
  "west-cut": [
   -140,
   20
  ],
  "rn-east": [
   -240,
   -20
  ],
  "rn-hub": [
   -280,
   -40
  ],
  "rn-south": [
   -200,
   -120
  ],
  "sw-cut": [
   -80,
   -160
  ],
  "aj-south-return": [
   0,
   -55
  ]
 },
 "checkpoints": [
  {
   "id": "cp-ridge",
   "at": [
    0,
    -220
   ],
   "faction": "ColSec",
   "wanted_scan": 2,
   "blurb": "ColSec speed trap. Pay or boost."
  },
  {
   "id": "cp-east",
   "at": [
    180,
    -200
   ],
   "faction": "ColSec",
   "wanted_scan": 1,
   "blurb": "Random inspection. Contraband flag fails the sweep."
  },
  {
   "id": "cp-helios",
   "at": [
    280,
    40
   ],
   "faction": "Helios private",
   "wanted_scan": 0,
   "blurb": "Private gate check. Guest list or gunfire."
  },
  {
   "id": "cp-flats",
   "at": [
    -240,
    -20
   ],
   "faction": "Saltblood",
   "wanted_scan": 0,
   "blurb": "Saltblood toll. Credits or a race."
  }
 ],
 "chases": [
  {
   "id": "beltway-chase-colsec",
   "title": "Blue Lights",
   "blurb": "Boost through two ColSec checkpoints without getting boxed in.",
   "start": "aj-south",
   "end": "dt-plaza",
   "via": [
    "mid-ridge",
    "dt-north"
   ],
   "wanted": 3,
   "limit_s": 90,
   "fail": [
    "busted",
    "timer"
   ]
  },
  {
   "id": "beltway-chase-saltblood",
   "title": "Red Tape Run",
   "blurb": "Marrow's boys want the crate back. Lose them between the Flats and the Heights.",
   "start": "rn-hub",
   "end": "gc-gate",
   "via": [
    "rn-east",
    "west-cut",
    "aj-north",
    "aj-east",
    "north-loop",
    "gc-west"
   ],
   "wanted": 2,
   "limit_s": 120,
   "pursuers": [
    "goon",
    "goon",
    "sbuggy"
   ],
   "fail": [
    "caught",
    "crate_destroyed",
    "timer"
   ]
  }
 ],
 "caps": {
  "phone_npc_max": 12,
  "desktop_npc_max": 20,
  "active_chase_pursuers_phone": 3
 }
};
// route for a chase set-piece: start, via..., end as AJ-relative [x, z]
export function chaseRoute(id) {
  const c = MARS_CITY.chases.find(c => c.id === id); if (!c) return null;
  return { def: c, pts: [c.start, ...(c.via || []), c.end].map(w => MARS_CITY.waypoints[w]) };
}
