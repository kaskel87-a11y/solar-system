#!/bin/bash
# Junkyard lab pack: unit tests + the full Playwright pass on the three iPhone sizes (WebKit + Chromium) and desktop Chromium.
# BASE=http://localhost:8817/ NODE_PATH=<dir with playwright>/node_modules OUT=/workspace/pw-ben-raccoon/shots/ tests/run-scientists.sh
cd "$(dirname "$0")/.."; OUT=${OUT:-/workspace/pw-ben-raccoon/shots/}; LOG=${LOG:-/tmp/ben-raccoon/logs}; mkdir -p "$OUT" "$LOG"
node tests/test-scientists-unit.mjs || exit 1
run() { env "$@" OUT="$OUT" timeout 900 node tests/test-scientists.js > "$LOG/sci-$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $*"; }
for D in 375x667 393x852 430x932; do run BR=webkit DEV=$D & done; wait
for D in 375x667 393x852 430x932; do run BR=chromium DEV=$D & done; run BR=chromium DEV=desktop & wait
echo DONE
