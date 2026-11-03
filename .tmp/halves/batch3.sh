#!/bin/zsh
# Batch 3: each new sabotage against its own clause's checks, 8 seeds, launched 12 s apart.
cd "$(dirname $0)/../.."
runs=(
  "pollen-not-cosmic-faster flower.pollen"
  "pollen-seed-plain pollen.seeds"
  "no-growth-through-water seed.germinates"
  "cosmic-not-taller seed.germinates"
  "trail-never-lights meteor.trail"
  "lava-never-lights-rocket rocket.lights"
  "ember-never-lights-rocket rocket.lights"
  "meteor-never-lights-rocket rocket.lights"
  "ceiling-fizzles rocket.bursts"
  "burst-never-chains rocket.bursts"
  "fuse-jumps-gap rocket.fuses"
  "stardust-skips-fungus stardust.energizes,fungus.cosmic"
  "stardust-skips-wall stardust.etches"
  "meteor-never-stardust meteor.impacts"
  "moonwater-skips-fungus fungus.cosmic"
  "fungus-skips-soil fungus.digests"
  "wall-never-rinses water.rinses"
  "oil-keeps-wet oil.smothers"
  "hearth-thaws-by-conduction wall.hearth"
  "spring-stays-stilled wellspring.stilled"
  "spring-bare-face-only wellspring.pours"
  "smoke-never-fades smoke.rises"
  "stone-slips stone.slumps"
  "soil-vents-up-only soil.breathes"
)
for r in "${runs[@]}"; do
  set -- ${=r}
  node .tmp/halves/sab.mjs $1 8 $2 > .tmp/halves/log3-$1.txt 2>&1 &
  sleep 12
done
wait
echo ALL DONE
for r in "${runs[@]}"; do set -- ${=r}; tail -1 .tmp/halves/log3-$1.txt; done
