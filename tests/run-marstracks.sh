#!/bin/bash
# Mars street circuits suite: node unit tests, then Playwright at 375x667, 393x852, 430x932 (WebKit + Chromium) and desktop
# Chromium 1440x900, one browser at a time. BASE defaults to a local server of this checkout: python3 -m http.server 8777
# Screenshots go to SHOTS_DIR (default: shots/ in this checkout).
cd "$(dirname "$0")"; export NODE_PATH=${NODE_PATH:-/workspace/pw/node_modules}; export BASE=${BASE:-http://localhost:8777/}
L=${LOGS:-/tmp/marstracks-logs}; mkdir -p "$L"; export OUT=${SHOTS_DIR:-$(cd .. && pwd)/shots}/; mkdir -p "$OUT"
node test-marstracks-unit.mjs > "$L/unit.log" 2>&1; echo "$? unit"
run() { n=$1; shift; env "$@" timeout 1500 node $n > "$L/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $n $*"; }
T=test-marstracks.js
for D in ${DEVS:-375x667 393x852 430x932}; do for B in ${BRS:-webkit chromium}; do run $T BR=$B DEV=$D; done; done
[ -z "$NODESK" ] && run $T BR=chromium DEV=desktop
echo DONE
