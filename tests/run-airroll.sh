#!/bin/bash
# Barrel rolls / SSX.airRoll: unit, then Playwright one browser at a time: WebKit 375x667 / 393x852 / 430x932 (held joystick
# finger), Chromium 393x852, desktop Chromium. BASE=http://localhost:8830/ NODE_PATH=<dir>/node_modules OUT=/workspace/pw-ben-rolls/shots/ tests/run-airroll.sh
cd "$(dirname "$0")/.."; OUT=${OUT:-/workspace/pw-ben-rolls/shots/}; LOG=${LOG:-/workspace/pw-ben-rolls/logs}; mkdir -p "$OUT" "$LOG"
node tests/test-airroll-unit.mjs || exit 1
run() { env "$@" OUT="$OUT" timeout 600 node tests/test-airroll.js > "$LOG/airroll-$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $*"; }
for D in 375x667 393x852 430x932; do run BR=webkit DEV=$D; done
run BR=chromium DEV=393x852; run BR=chromium DEV=desktop
echo DONE
