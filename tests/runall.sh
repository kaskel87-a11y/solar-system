#!/bin/bash
cd "${PW:-/workspace/pw}"; M=${M:-/tmp/m}; mkdir -p $M
run() { n=$1; shift; env "$@" timeout 900 node $n > $M/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log 2>&1; echo "$? $n $*"; }
run test-contrast.js BR=webkit DEV="iPhone 14" OUT=$M/ & run test-contrast.js BR=webkit DEV="iPhone SE (3rd gen) landscape" OUT=$M/ & run test-contrast.js BR=chromium DEV=desktop OUT=$M/ & wait
for D in "iPhone SE (3rd gen)" "iPhone 14 Pro Max" "iPhone 14 landscape"; do run test-v73p.js BR=webkit DEV="$D" OUT=$M/ & done; wait
run test-v73p.js BR=chromium DEV=desktop OUT=$M/ & run test-v73p.js BR=chromium DEV="iPhone 14" OUT=$M/ & wait
for D in "iPhone SE (3rd gen)" "iPhone 14" "iPhone 14 Pro Max"; do run test-v73.js BR=webkit DEV="$D" OUT=$M/ & done; wait
for D in "iPhone SE (3rd gen) landscape" "iPhone 14 landscape" "iPhone 14 Pro Max landscape"; do run test-v73.js BR=webkit DEV="$D" OUT=$M/ & done; wait
run test-v73.js BR=chromium DEV="iPhone 14" OUT=$M/ & wait
for D in "iPhone SE (3rd gen)" "iPhone 14" "iPhone 14 Pro Max"; do run test-v72.js BR=webkit DEV="$D" OUT=$M/ & done; wait
for D in "iPhone SE (3rd gen) landscape" "iPhone 14 landscape" "iPhone 14 Pro Max landscape"; do run test-v72.js BR=webkit DEV="$D" OUT=$M/ & done; wait
run test-v72.js BR=chromium DEV="iPhone 14" OUT=$M/ & run test-v72.js BR=chromium DEV="iPhone 14 landscape" OUT=$M/ & wait
for D in "iPhone SE (3rd gen)" "iPhone 14" "iPhone 14 Pro Max"; do run test-v71.js BR=webkit DEV="$D" OUT=$M/ & done; wait
for D in "iPhone SE (3rd gen) landscape" "iPhone 14 landscape" "iPhone 14 Pro Max landscape"; do run test-v71.js BR=webkit DEV="$D" OUT=$M/ & done; wait
run test-v71.js BR=chromium DEV="iPhone 14 landscape" OUT=$M/ &
for D in "iPhone SE (3rd gen)" "iPhone 14" "iPhone 14 Pro Max"; do run test-v7.js BR=webkit DEV="$D" OUT=$M/ & done
wait
run test-v7.js BR=chromium DEV="iPhone 14" OUT=$M/ &
run test-return.js & run test-drive.js & run test-landbtn.js OUT=$M/ & run test-v6.js OUT=$M/ &
wait
run test-v74.js BR=chromium DEV=desktop OUT=$M/ & run test-v74.js BR=webkit DEV="iPhone 14" OUT=$M/ & run test-v74.js BR=webkit DEV="iPhone SE (3rd gen) landscape" OUT=$M/ & wait
run test-duel.js BR=chromium DEV=desktop OUT=$M/ & run test-duel.js BR=webkit DEV="iPhone 14" OUT=$M/ & run test-duel.js BR=webkit DEV="iPhone SE (3rd gen) landscape" OUT=$M/ & wait
run test-planets.js BR=webkit DEV="iPhone 14" OUT=$M/ & run test-planet-missions.js BR=webkit DEV="iPhone 14" OUT=$M/ & run test-race.js BR=webkit DEV="iPhone 14" OUT=$M/ & run test-builder.js BR=chromium DEV=desktop OUT=$M/ & wait
run test-v75.js BR=chromium DEV=desktop OUT=$M/ & run test-v75.js BR=webkit DEV="iPhone 14" OUT=$M/ & run test-v75.js BR=webkit DEV="iPhone SE (3rd gen) landscape" OUT=$M/ & wait
run test-hud.js OUT=$M/; echo DONE
run test-boost.js BR=chromium DEV=desktop OUT=$M/
