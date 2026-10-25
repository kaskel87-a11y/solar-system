#!/bin/bash
# race + builder suite: node unit tests, then Playwright on WebKit/Chromium at 393x852, 430x932 and desktop
# BASE defaults to a local server of this checkout: python3 -m http.server 8777
cd "$(dirname "$0")"; export NODE_PATH=${NODE_PATH:-/workspace/pw/node_modules}; export BASE=${BASE:-http://localhost:8777/}
L=${LOGS:-/tmp/race-logs}; mkdir -p "$L"; export OUT=${OUT:-$L/}
node test-race-unit.mjs > "$L/unit.log" 2>&1; echo "$? unit"
run() { n=$1; shift; env "$@" timeout 900 node $n > "$L/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $n $*"; }
for T in test-race.js test-builder.js; do
  run $T BR=webkit DEV=393x852 & run $T BR=chromium DEV=393x852 & wait
  run $T BR=webkit DEV=430x932 & run $T BR=webkit DEV=desktop & wait
  run $T BR=chromium DEV=430x932 & run $T BR=chromium DEV=desktop & wait
done
echo DONE
