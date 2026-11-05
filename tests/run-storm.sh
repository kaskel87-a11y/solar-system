#!/bin/bash
# Mars dust storms / SSX.storm: unit + imports, then Playwright one browser at a time: WebKit 375x667 / 393x852 / 430x932,
# Chromium 393x852 (also checks ?storm=1), desktop Chromium.
# BASE=http://127.0.0.1:8883/ NODE_PATH=<dir>/node_modules OUT=/workspace/pw-ben-storms/shots/ tests/run-storm.sh
cd "$(dirname "$0")/.."; OUT=${OUT:-/workspace/pw-ben-storms/shots/}; LOG=${LOG:-/workspace/pw-ben-storms/logs}; mkdir -p "$OUT" "$LOG"
node tests/test-storm-unit.mjs || exit 1
node tests/test-imports-unit.mjs || exit 1
run() { env "$@" OUT="$OUT" timeout 780 node tests/test-storm.js > "$LOG/storm-$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $*"; }
for D in 375x667 393x852 430x932; do run BR=webkit DEV=$D; done
run BR=chromium DEV=393x852; run BR=chromium DEV=desktop
echo DONE
