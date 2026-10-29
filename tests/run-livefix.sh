#!/usr/bin/env bash
# Live fix matrix, one browser at a time. BASE must point at a server for this worktree.
# NODE_PATH=... BASE=http://localhost:8971/ SHOTS_DIR=shots bash tests/run-livefix.sh
cd "$(dirname "$0")/.." || exit 1
: "${BASE:?set BASE}"; : "${SHOTS_DIR:=shots}"
fail=0
for run in "desktop chromium" "desktop webkit" "375x667 webkit" "375x667 chromium" "393x852 webkit" "393x852 chromium" "430x932 webkit" "430x932 chromium"; do
  set -- $run
  if DEV=$1 BR=$2 BASE="$BASE" SHOTS_DIR="$SHOTS_DIR" timeout 900 node tests/test-livefix.js > "/tmp/livefix-$1-$2.log" 2>&1; then r=PASS; else r=FAIL; fail=1; fi
  echo "$1 $2 $r $(grep -m1 '^FAIL' /tmp/livefix-$1-$2.log)"
done
exit $fail
