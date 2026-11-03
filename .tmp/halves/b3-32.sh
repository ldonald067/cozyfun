#!/bin/zsh
cd "$(dirname $0)/../.."
run() { for l in "$@"; do node .tmp/halves/try-map.mjs .tmp/halves/c-b3.mjs 32 "$l"; done; }
run "meteor stardust followed" "stardust etches wall" "stardust charges fungus" "fungus digests soil" "rinse wall, no pour" > .tmp/halves/r3-32a.txt 2>&1 &
sleep 12
run "water rinses wall" "stalk climbs through water" "stalk, no water" "stone pillar holds" > .tmp/halves/r3-32b.txt 2>&1 &
sleep 12
run "rocket bursts on ceiling" "ceiling burst, no ceiling" "lava lights a fuse" "ember lights a fuse" "ember fuse, no wood" > .tmp/halves/r3-32c.txt 2>&1 &
wait
cat .tmp/halves/r3-32a.txt .tmp/halves/r3-32b.txt .tmp/halves/r3-32c.txt
