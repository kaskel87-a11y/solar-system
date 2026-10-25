#!/bin/bash
# street danger suite: node unit tests, then Playwright at 375x667 / 393x852 / 430x932 on WebKit + Chromium (touch)
# and a desktop Chromium pass. BASE defaults to a local server of this checkout: python3 -m http.server 8793
cd "$(dirname "$0")"; export NODE_PATH=${NODE_PATH:-/workspace/pw/node_modules}; export BASE=${BASE:-http://localhost:8793/}
L=${LOGS:-/tmp/danger-logs}; mkdir -p "$L"; export OUT=${OUT:-$L/}
node test-danger-unit.mjs > "$L/unit.log" 2>&1; echo "$? unit"
run() { n=$1; shift; env "$@" timeout 900 node $n > "$L/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $n $*"; }
T=test-danger.js
run $T BR=webkit DEV=375x667 & run $T BR=chromium DEV=375x667 & wait
run $T BR=webkit DEV=393x852 & run $T BR=chromium DEV=393x852 & wait
run $T BR=webkit DEV=430x932 & run $T BR=chromium DEV=430x932 & wait
run $T BR=chromium DEV=desktop
echo DONE
