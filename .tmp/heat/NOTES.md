# Heat batch prototype (2026-10-20), JS mirror only, awaiting the owner's pick

`prototype.patch` (engine.ts only; env-var knobs are scratch and must become constants):
1. Ice has a temperature, ICE_TEMP = 40. Ice freezes water only at <= 40 (was < 120). Water warmer
   than 40 passes (T - 40) / MELT_SHARE(8) a tick into each ice cell it touches (replaces the
   `> 120 && chance(2)` melt, so one roll fewer). Ice at >= ICE_MELT(180) melts to water at 60.
   Ice above ICE_COLD(110) re-chills 1 a tick.
2. Heat spreads through water: each Water cell takes trunc((n - own) / HEAT_SHARE(8)) from every
   Water neighbour, from `old`; antisymmetric, so conserved. No RNG. Right after the vent roll.
3. Water cools on a slow clock: its drain of 2 runs only when age % WATER_CHILL(16) == 0.
4. Ice freezes steam only under STEAM_FREEZE(120), in both the ice arm and the steam arm.

Dropped after measuring: lava radiant rays (ice-wall 85 vs 84 cells; even every-tick rays 82),
"soft ice" that stops freezing (no effect), MELT_COST (no effect once heat flows into ice).

8 seeds, ice left at t=200 (flame on): slab 78 -> 30, puddle 78 -> 32, warm puddle + dropped ice
72 -> 30; thaw frost at t=500 7.6 -> 2.9; thaw ice at t=400 70 (grows) -> 44 (shrinks from 52).
Boiling (boil.mjs): water left after 800 ticks unchanged in 3 pot sizes; hot cells at t=200 0-1 -> 9-19.
Ablation (ablate.mjs): no conduction 36 -> 74; base cooling 36 -> 53; no steam gate thaw 3 -> 9;
old melt rule puddle 37 -> 57; freeze line at 60 instead of 40 fails (70).

Found on the LIVE engine (lavacount.mjs): poured lava self-deletes while spreading, 49 -> 9 cells
in 80 ticks with no stone; oil 30 -> 3. Water is conserved. The move clobber: only water is
guarded. Not in this batch; it is why lava's heat cannot reach across a gap.

Not measured yet (needs the Rust port, audit:drift plays wasm): drift over all 161 checks,
water:budget, mist. Filmstrips: .tmp/film/heat-*.png, sheet .tmp/film/heat-batch.png.
