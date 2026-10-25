cd /workspace/pw; mkdir -p /tmp/f
run() { n=$1; shift; env "$@" timeout 900 node $n > /tmp/f/$(echo "$n-$*" | tr -c 'a-zA-Z0-9\n' '_').log 2>&1; echo "$? $n $*"; }
for D in "iPhone SE (3rd gen)" "iPhone 14 Pro Max" "iPhone 14 landscape"; do run test-cam.js BR=webkit DEV="$D" OUT=/tmp/f/ & done; wait
run test-cam.js BR=chromium DEV="iPhone 14" OUT=/tmp/f/ & run test-v72.js BR=webkit DEV="iPhone 14" OUT=/tmp/f/ & run test-v72.js BR=chromium DEV="iPhone 14" OUT=/tmp/f/ & wait
run test-v71.js BR=webkit DEV="iPhone 14" OUT=/tmp/f/ & run test-v71.js BR=webkit DEV="iPhone SE (3rd gen) landscape" OUT=/tmp/f/ & run test-v7.js BR=webkit DEV="iPhone 14" OUT=/tmp/f/ & wait
run test-v7.js BR=chromium DEV="iPhone 14" OUT=/tmp/f/ & run test-return.js & run test-drive.js & wait
run test-landbtn.js OUT=/tmp/f/ & run test-v6.js OUT=/tmp/f/ & wait
echo DONE
