#!/bin/bash
# Walk-in habitat: Playwright on the iPhone matrix (WebKit + Chromium, touch with a
# second finger on the stick) and desktop Chromium.
# BASE=http://127.0.0.1:8793/ bash tests/run-habinterior.sh
cd "$(dirname "$0")"
export NODE_PATH=${NODE_PATH:-/tmp/pw/node_modules}
export BASE=${BASE:-http://127.0.0.1:8793/}
L=${LOGS:-/tmp/habinterior-logs}; mkdir -p "$L"; export OUT=${OUT:-$L/}
run() { n=$1; shift; env "$@" timeout 240 node $n > "$L/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $n $*"; }
T=test-habinterior.js
for D in 375x667 393x852 430x932; do for B in webkit chromium; do run $T BR=$B DEV=$D; done; done
run $T BR=chromium DEV=desktop
echo DONE
