#!/bin/bash
# steve/multi-planet full matrix against the worktree served on :8781. Logs in /tmp/sm, shots in /tmp/steve-shots.
cd "${PW:-/workspace/pw/steve}"; export BASE=http://localhost:8781/ OUT=/tmp/steve-shots/
run() { n=$1; shift; env "$@" timeout 900 node $n > /tmp/sm/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log 2>&1; echo "$? $n $*"; }
P="iPhone SE (3rd gen)|iPhone 14|iPhone 14 Pro Max"; IFS='|'
for D in $P; do run test-planets.js BR=webkit DEV="$D" & done; wait
for D in $P; do run test-planets.js BR=webkit DEV="$D landscape" & done; wait
run test-planets.js BR=chromium DEV="iPhone 14" & run test-planet-missions.js BR=webkit DEV="iPhone 14" & run test-planet-missions.js BR=chromium DEV="iPhone SE (3rd gen)" & wait
run test-hud.js & wait
for D in $P; do run test-v72.js BR=webkit DEV="$D" & done; wait
for D in $P; do run test-v71.js BR=webkit DEV="$D" & done; wait
for D in $P; do run test-v7.js BR=webkit DEV="$D" & done; wait
run test-v72.js BR=chromium DEV="iPhone 14" & run test-v71.js BR=chromium DEV="iPhone 14 landscape" & run test-v7.js BR=chromium DEV="iPhone 14" & wait
run test-return.js & run test-drive.js & run test-landbtn.js & run test-v6.js & wait; echo DONE
