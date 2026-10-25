#!/bin/bash
# heist matrix: unit + e2e at iPhone 375x667 / 393x852 / 430x932 in WebKit and Chromium, plus desktop Chromium 1440x900.
# PW=dir-with-playwright BASE=http://127.0.0.1:8851/ OUT=/workspace/pw-ben/shots/ bash tests/run-heist.sh
here=$(cd "$(dirname "$0")" && pwd); cd "${PW:-/workspace/pw-ben}"; cp "$here/test-heist.js" .; mkdir -p /tmp/ben/logs
node "$here/test-heist-unit.mjs" > /tmp/ben/logs/unit.log 2>&1; echo "$? unit"
run() { f=/tmp/ben/logs/$(echo "$*" | tr -c 'a-zA-Z0-9\n' '_').log; env "$@" timeout 900 node test-heist.js > "$f" 2>&1; echo "$? $* $(tail -1 "$f")"; }
for BR in webkit chromium; do
  run BR=$BR DEV="iPhone SE (3rd gen)"
  run BR=$BR DEV="iPhone 14 Pro" VP=393x852
  run BR=$BR DEV="iPhone 14 Pro Max" VP=430x932
done
run BR=chromium DEV=desktop
echo DONE
