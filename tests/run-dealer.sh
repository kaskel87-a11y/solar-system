#!/bin/bash
# dealership / garage / car meet suite: node unit tests, then Playwright at 375x667, 393x852, 430x932 (WebKit + Chromium)
# and desktop Chromium 1440x900. BASE defaults to a local server of this checkout: python3 -m http.server 8777
cd "$(dirname "$0")"; export NODE_PATH=${NODE_PATH:-/workspace/pw/node_modules}; export BASE=${BASE:-http://localhost:8777/}
L=${LOGS:-/tmp/dealer-logs}; mkdir -p "$L"; export OUT=${OUT:-$L/}
node test-garage-unit.mjs > "$L/unit.log" 2>&1; echo "$? unit"
node test-garage-respray-unit.mjs > "$L/unit-respray.log" 2>&1; echo "$? unit respray"
run() { n=$1; shift; env "$@" timeout 1500 node $n > "$L/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $n $*"; }
T=test-dealer.js
# one browser at a time (shared low-memory box)
for D in 375x667 393x852 430x932; do for B in webkit chromium; do run $T BR=$B DEV=$D; done; done
run $T BR=chromium DEV=desktop
echo DONE
