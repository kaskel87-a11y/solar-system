#!/bin/bash
# Mars base matrix: unit + e2e at iPhone 375x667 / 393x852 / 430x932 in WebKit and Chromium, plus desktop Chromium 1440x900.
# Run from your own worktree/scratch only (never /workspace/solar-system):
# PW=dir-with-playwright BASE=http://127.0.0.1:8853/ SHOTS_DIR=/workspace/pw-ben-base/shots bash tests/run-base.sh
here=$(cd "$(dirname "$0")" && pwd); cd "${PW:-/workspace/pw-ben-base}" || exit 1; cp "$here/test-base.js" .
export SHOTS_DIR="${SHOTS_DIR:-$PWD/shots}"; mkdir -p "$SHOTS_DIR"; L="${LOGS:-/tmp/ben-base/logs}"; mkdir -p "$L"
node "$here/test-base-unit.mjs" > "$L/unit.log" 2>&1; echo "$? unit $(tail -1 "$L/unit.log")"
run() { f=$L/$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log; env "$@" timeout 900 node test-base.js > "$f" 2>&1; echo "$? $* $(tail -1 "$f")"; }
for BR in webkit chromium; do
  run BR=$BR DEV="iPhone SE (3rd gen)"
  run BR=$BR DEV="iPhone 14 Pro" VP=393x852
  run BR=$BR DEV="iPhone 14 Pro Max" VP=430x932
done
run BR=chromium DEV=desktop
echo DONE
