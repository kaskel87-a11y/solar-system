#!/bin/bash
# Junkyard lab pack part 2 (sci-06..10): unit tests, then Playwright one browser at a time (--workers=1 style):
# WebKit 375x667 / 393x852 / 430x932 with a held joystick finger, Chromium 393x852, desktop Chromium.
# BASE=http://localhost:8818/ NODE_PATH=<dir with playwright>/node_modules OUT=/workspace/pw-ben-sci2/shots/ tests/run-scientists2.sh
cd "$(dirname "$0")/.."; OUT=${OUT:-/workspace/pw-ben-sci2/shots/}; LOG=${LOG:-/workspace/pw-ben-sci2/logs}; mkdir -p "$OUT" "$LOG"
node tests/test-scientists2-unit.mjs || exit 1
run() { env "$@" OUT="$OUT" timeout 900 node tests/test-scientists2.js > "$LOG/sci2-$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log" 2>&1; echo "$? $*"; }
for D in 375x667 393x852 430x932; do run BR=webkit DEV=$D; done
run BR=chromium DEV=393x852; run BR=chromium DEV=desktop
echo DONE
