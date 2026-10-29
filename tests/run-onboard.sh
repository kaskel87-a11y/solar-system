#!/bin/bash
# First Day on Mars tour + How to play codex: unit + imports, then Playwright one browser at a time: WebKit 375x667 /
# 393x852 / 430x932, Chromium 393x852, desktop Chromium 1440x900.
# BASE=http://127.0.0.1:8893/ NODE_PATH=<dir>/node_modules OUT=/workspace/pw-ben-onboard/shots/ tests/run-onboard.sh
cd "$(dirname "$0")/.."; OUT=${OUT:-${SHOTS_DIR:-/workspace/pw-ben-onboard/shots}/}; LOG=${LOG:-/workspace/pw-ben-onboard/logs}; mkdir -p "$OUT" "$LOG"
node tests/test-onboard-unit.mjs || exit 1
node tests/test-imports-unit.mjs || exit 1
run() { env "$@" OUT="$OUT" timeout 780 node tests/test-onboard.js > "$LOG/onboard-$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $*"; }
for D in 375x667 393x852 430x932; do run BR=webkit DEV=$D; done
run BR=chromium DEV=393x852; run BR=chromium DEV=desktop
echo DONE
