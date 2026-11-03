# Lava and oil deleting themselves (2026-10-21), measured on scratch JS variants only

Mechanism: `try_move` lets a mover overwrite a cell another mover filled this tick. Water and
moonwater are guarded; lava and oil are not, so they delete themselves while they flow.
`variant.mjs` builds find/replace copies of app/src/engine.ts (the repo file is never edited).

Live: a 408-cell lava pour in the water-budget basin is 51 at 10 s (12%); oil 583 -> 19 (3%).
Spring on 220x140 at 8000 ticks: lava 5.4% (+77 stone), oil 1.2%.
Guard alone: pours keep 100%, but a lava spring floods 27.9% and an oil spring 31.3% (still
rising): a thick lava pool never crusts (only lava with < 3 hot neighbours cools), oil has no sink.

Candidate (`candidate`, LAVA_DEEP=24, OIL_ODDS=50):
- lava never deletes lava, and lava with 3+ hot neighbours cools too, 1 roll in 24 (edges 1 in 8):
  a pour pools and sets to stone between 50 and 75 s; a spring floods 14% by 50 s, then builds a
  stone hill over itself (~7,500 stone, 24% of the board) and stops pouring by ~200 s.
- oil never deletes oil, and moving oil loses one cell in 50 (water's mist is 1 in 450): a pour
  keeps ~40% as a slick; a spring stays at 1.5%. 1 in 150 floods (26%), 1 in 450 floods (30%).
  Surface evaporation (1 in 1200) keeps pours at 93% but a spring floods 30%.
- Audit (scan.mjs, JS, 163 checks x 8 seeds): no check changes pass count. Metric drift not
  measured (audit:drift plays wasm: needs the port).
- Item 6: kept lava pools against an ice wall but barely melts it (a stone crust insulates).
Filmstrips: lava-pour, oil-pour, lava-spring, oil-spring, lava-ice (.png here), sheet lava-oil-sheet.png.

## 2026-10-21, porting: the oil fix has a cost the basin pour hid
Oil on a floor keeps shuffling sideways into any gap, so 1-in-50 per move thins every slick that
is not wall to wall. A 49-cell dab on an open floor: live keeps 10 dots for ever; approved 0 by
30 s. Oil on a pond (pondcount.mjs, 2-60 s): live 73 -> 29 for ever; approved 123 -> 0 by 30 s;
thin only with 2+ oil neighbours (crowd.mjs 2) ~125 -> 28-58 at 60 s. But crowd-only springs keep
rising: 2+ is 3.8/4.8/6.5% at 4k/8k/16k ticks, 3+ is 4.8/6.9/11.4%. Approved stays 1.5%.
Lava is ported clean: tests, parity (0 lost, 239 set from within), two audit checks that fail
16/16 with their rule sabotaged. Oil code (approved version) is in the tree, uncommitted, and its
cargo test fails by design until the owner picks. Filmstrip: oil-pond-sheet.png.
