#!/bin/bash
# heist guards matrix (v7.5.4): unit + e2e (test-guards.js) at WebKit iPhone 375x667 / 393x852 / 430x932, Chromium 393x852, desktop 1440x900,
# plus the legacy heist e2e (guards passive) on WebKit 393x852 + desktop. One browser at a time.
# PW=dir-with-playwright BASE=http://127.0.0.1:8863/ SHOTS_DIR=/workspace/pw-ben-guards/shots bash tests/run-guards.sh
here=$(cd "$(dirname "$0")" && pwd); cd "${PW:-/workspace/pw-ben-guards}"; cp "$here/test-guards.js" "$here/test-heist.js" .; L=${LOGS:-$PWD/logs}; mkdir -p "$L"
for u in test-guards-unit test-heist-unit test-imports-unit; do node "$here/$u.mjs" > "$L/$u.log" 2>&1; echo "$? $u $(tail -1 "$L/$u.log")"; done
run() { t=$1; shift; f=$L/$t-$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log; env "$@" timeout 900 node $t.js > "$f" 2>&1; echo "$? $t $* $(tail -1 "$f")"; }
run test-guards BR=webkit DEV="iPhone SE (3rd gen)"
run test-guards BR=webkit DEV="iPhone 14 Pro" VP=393x852
run test-guards BR=webkit DEV="iPhone 14 Pro Max" VP=430x932
run test-guards BR=chromium DEV="iPhone 14 Pro" VP=393x852
run test-guards BR=chromium DEV=desktop
run test-heist BR=webkit DEV="iPhone 14 Pro" VP=393x852
run test-heist BR=chromium DEV=desktop
echo DONE
