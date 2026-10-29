#!/usr/bin/env bash
# Live fix matrix, one browser at a time. BASE must point at a server for this worktree.
# NODE_PATH=/workspace/pw/node_modules BASE=http://localhost:8971/ SHOTS_DIR=shots bash tests/run-livefix.sh
# RUNS="393x852/webkit desktop/chromium" limits the matrix.
cd "$(dirname "$0")/.." || exit 1
: "${BASE:?set BASE}"; : "${SHOTS_DIR:=shots}"
RUNS=${RUNS:-"desktop/chromium desktop/webkit 375x667/webkit 375x667/chromium 393x852/webkit 393x852/chromium 430x932/webkit 430x932/chromium"}
fail=0
for run in $RUNS; do
  D=${run%/*}; B=${run#*/}
  if DEV=$D BR=$B BASE="$BASE" SHOTS_DIR="$SHOTS_DIR" timeout 900 node tests/test-livefix.js > "/tmp/livefix-$D-$B.log" 2>&1; then r=PASS; else r=FAIL; fail=1; fi
  echo "$D $B $r $(grep -m1 '^FAIL' "/tmp/livefix-$D-$B.log")"
done
exit $fail
