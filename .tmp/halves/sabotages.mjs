// Each sabotage is a list of [find, replace] edits on app/src/engine.ts. Keep RNG rolls in
// place where possible, so only the rule's effect changes and not the dice.
export const SABOTAGES = {
  // ember.glows: an ember never lights fuel (the roll still happens).
  "ember-never-lights": [["            writeIgnitedCell(next, nidx, other, old[nidx + 1], 210, readU16(old, nidx + 6));\n          }\n        }\n        if (kind === MATERIAL.Smoke", "          }\n        }\n        if (kind === MATERIAL.Smoke"]],
  // ember.quenched: running water never washes cold char away (the roll still happens).
  "char-never-washes": [["            next.fill(0, nidx, nidx + CELL_STRIDE);\n            continue;\n          }\n          if (kind !== MATERIAL.Moonwater && hydratable(other)", "            continue;\n          }\n          if (kind !== MATERIAL.Moonwater && hydratable(other)"]],
};
Object.assign(SABOTAGES, {
  // sand.clumps "and slows when wet": wet sand moves every tick.
  "wet-sand-not-slow": [["      if (this.ticks % 2 === 0) this.powder(idx, x, y, cell, old, next);\n    } else {", "      this.powder(idx, x, y, cell, old, next);\n    } else {"]],
  // sand.settles "and oil": no grain sinks through oil.
  "never-sink-oil": [["    if (!freeLiquid(liquid) || (old[target]", "    if (!freeLiquid(liquid) || liquid === MATERIAL.Oil || (old[target]"]],
  // water.boils / ice.freezes "hot water melts ice": it never does (roll kept).
  "hot-water-never-melts": [["readU16(old, idx + 4) > 120 && this.chance(2)) {\n            writeCellBytes(next, nidx, MATERIAL.Water, old[nidx + 1], 40);", "readU16(old, idx + 4) > 120 && this.chance(2)) {"]],
  // ice.freezes "hot water resists": ice freezes hot water too.
  "ice-freezes-hot": [["if (other === MATERIAL.Water && readU16(old, nidx + 4) < 120 && this.chance(5)) {", "if (other === MATERIAL.Water && this.chance(5)) {"]],
  // moss.spreads "bursting to two patches": never more than one.
  "moss-no-burst": [["let spreadsLeft = oldEnergy > 150 ? 2 : 1;", "let spreadsLeft = 1;"]],
  // moss.colonizes "a soaked wall only when moonwater has charged it": never.
  "moss-never-wall": [["} else if (other === MATERIAL.Wall && dampSubstrate && oldEnergy > 150", "} else if (false && other === MATERIAL.Wall && dampSubstrate && oldEnergy > 150"]],
  // moss.colonizes "plain moss never takes a wall": it does.
  "plain-moss-takes-wall": [["oldEnergy > 150 && readU16(old, idx + 6) & CELL_FLAG.Cosmic) {", "oldEnergy > 150) {"]],
  // lava.flows "ignites fuel": never (roll kept).
  "lava-never-ignites": [["          if (flammable(other) && this.chance(3)) {\n            writeIgnitedCell(next, nidx, other, old[nidx + 1], 240, readU16(old, nidx + 6));", "          if (flammable(other) && this.chance(3)) {"]],
  // lava.flows "flows slowly": lava never moves.
  "lava-never-flows": [["        if (kind === MATERIAL.Lava) this.liquid(idx, x, y, cell, old, next, 2);", ""]],
  // stem.burns "and freezes like living growth": ice never freezes a stem (roll kept).
  "stem-never-freezes": [["      } else if (freezable(other) && this.chance(4)) {", "      } else if (freezable(other) && this.chance(4) && other !== MATERIAL.Stem) {"]],
});
Object.assign(SABOTAGES, {
  // lava.scorches "and thaws": lava leaves frozen cells frozen (ice beside lava still melts in
  // the ice arm, which is ice.melts).
  "lava-never-thaws": [["          if (heatSoftens(next, nidx, old, 72)) {", "          if (old[nidx] !== MATERIAL.Ice && readU16(old, nidx + 6) & CELL_FLAG.Frozen && (freezable(old[nidx]) || scorchable(old[nidx]))) continue;\n          if (heatSoftens(next, nidx, old, 72)) {"]],
  // fire.dries "and the embers it leaves dry wet fuel the same way": they light it straight through.
  "ember-never-dries": [["if (scorchable(other) && otherFlags & CELL_FLAG.Wet && !(otherFlags & CELL_FLAG.Frozen)) {", "if (false && scorchable(other) && otherFlags & CELL_FLAG.Wet && !(otherFlags & CELL_FLAG.Frozen)) {"]],
});
Object.assign(SABOTAGES, {
  // wellspring.blocks "between pours": a grain falls straight through an attuned spring.
  "attuned-spring-passable": [["    if (!this.inBounds(x, y)) return false;\n    if (freeLiquid(next[this.index(x, y)])) return this.sink(", "    if (!this.inBounds(x, y)) return false;\n    { const t = this.index(x, y); if (next[t] === MATERIAL.Wellspring && readU16(next, t + 4) !== 0 && next[idx] === cell[0]) { const a = next.slice(idx, idx + CELL_STRIDE); const b = next.slice(t, t + CELL_STRIDE); next.set(a, t); next.set(b, idx); return true; } }\n    if (freeLiquid(next[this.index(x, y)])) return this.sink("]],
});
Object.assign(SABOTAGES, {
  // sand.clumps "slows when wet", the other way (review, 2026-10-13): wet sand never moves.
  "wet-sand-never-moves": [["      if (this.ticks % 2 === 0) this.powder(idx, x, y, cell, old, next);\n    } else {", "      if (false) this.powder(idx, x, y, cell, old, next);\n    } else {"]],
});
// Batch 3 (2026-10-14): the halves the handoff listed as read but not yet sabotaged.
Object.assign(SABOTAGES, {
  // flower.pollen "more often when cosmic": a cosmic head puffs at the plain rate (roll kept).
  "pollen-not-cosmic-faster": [["energy > POLLEN_RESERVE && age > 24 && this.chance(cosmic ? 90 : 200)", "energy > POLLEN_RESERVE && age > 24 && this.chance(200)"]],
  // pollen.seeds "carrying the cosmic spark": the seed is always plain.
  "pollen-seed-plain": [["writeCellBytes(next, idx, MATERIAL.Seed, cell[1], 40, 0, readU16(cell, 6) & CELL_FLAG.Cosmic);", "writeCellBytes(next, idx, MATERIAL.Seed, cell[1], 40, 0, 0);"]],
  // seed.germinates "through standing water": nothing grows into water.
  "no-growth-through-water": [["  return kind === MATERIAL.Empty || kind === MATERIAL.Water || kind === MATERIAL.Moonwater;", "  return kind === MATERIAL.Empty;"]],
  // seed.germinates "taller with cosmic feeding": a cosmic sprout gets no extra segment.
  "cosmic-not-taller": [["200 + (cell[1] & 3) * 55 + (cosmic ? 55 : 0), 0,", "200 + (cell[1] & 3) * 55, 0,"]],
  // meteor.trail "can light rocket fuses it passes": trail sparks (marked odd) never light powder.
  "trail-never-lights": [
    ["writeCellBytes(next, vacated, MATERIAL.Spark, SPARK_DOWN, 90);", "writeCellBytes(next, vacated, MATERIAL.Spark, SPARK_DOWN, 91);"],
    ["if (old[nidx] === MATERIAL.Rocket && readU16(old, nidx + 4) === 0 && next[nidx] === MATERIAL.Rocket) {", "if (old[nidx] === MATERIAL.Rocket && readU16(old, nidx + 4) === 0 && next[nidx] === MATERIAL.Rocket && !(readU16(cell, 4) & 1)) {"],
  ],
  // rocket.lights "lava": lava never lights a fuse (roll kept).
  "lava-never-lights-rocket": [["          if (flammable(other) && this.chance(3)) {\n            writeIgnitedCell(next, nidx, other, old[nidx + 1], 240, readU16(old, nidx + 6));", "          if (flammable(other) && this.chance(3)) {\n            if (other !== MATERIAL.Rocket) writeIgnitedCell(next, nidx, other, old[nidx + 1], 240, readU16(old, nidx + 6));"]],
  // rocket.lights "hot ember": an ember never lights a fuse (roll kept).
  "ember-never-lights-rocket": [["            writeIgnitedCell(next, nidx, other, old[nidx + 1], 210, readU16(old, nidx + 6));\n          }\n        }\n        if (kind === MATERIAL.Smoke", "            if (other !== MATERIAL.Rocket) writeIgnitedCell(next, nidx, other, old[nidx + 1], 210, readU16(old, nidx + 6));\n          }\n        }\n        if (kind === MATERIAL.Smoke"]],
  // rocket.lights "meteor": a meteor's impact never lights a fuse.
  "meteor-never-lights-rocket": [["        writeIgnitedCell(next, nidx, old[nidx], old[nidx + 1], 230, readU16(old, nidx + 6));", "        if (old[nidx] !== MATERIAL.Rocket) writeIgnitedCell(next, nidx, old[nidx], old[nidx + 1], 230, readU16(old, nidx + 6));"]],
  // rocket.bursts "against a ceiling": a blocked rocket fizzles to smoke instead.
  "ceiling-fizzles": [["    if (!moved) {\n      this.burstRocket(idx, x, y, cell, old, next);\n      return;\n    }", "    if (!moved) {\n      writeCellBytes(next, idx, MATERIAL.Smoke, cell[1], 70);\n      return;\n    }"]],
  // rocket.bursts "chain-lighting neighboring powder": neither the shell nor its sparks light powder.
  "burst-never-chains": [
    ["} else if (dist === 1 && flammable(other) && this.chance(3)) {\n          writeIgnitedCell(next, nidx, other, old[nidx + 1], 200, readU16(old, nidx + 6));", "} else if (dist === 1 && flammable(other) && this.chance(3)) {\n          if (other !== MATERIAL.Rocket) writeIgnitedCell(next, nidx, other, old[nidx + 1], 200, readU16(old, nidx + 6));"],
    ["if (old[nidx] === MATERIAL.Rocket && readU16(old, nidx + 4) === 0 && next[nidx] === MATERIAL.Rocket) {", "if (false) {"],
  ],
  // rocket.fuses "a gap of air stops it", the other way: a lit grain lights powder across a one-cell gap.
  "fuse-jumps-gap": [["    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit", "    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-2, 0], [2, 0]]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit"]],
  // stardust.energizes "fungus" / fungus.cosmic "near stardust": stardust never charges fungus (roll kept).
  "stardust-skips-fungus": [["(other === MATERIAL.Soil || other === MATERIAL.Fungus) && this.chance(14)) {", "(other === MATERIAL.Soil || other === MATERIAL.Fungus) && this.chance(14) && other !== MATERIAL.Fungus) {"]],
  // stardust.etches "wall": stardust etches stone only (roll kept).
  "stardust-skips-wall": [["(other === MATERIAL.Stone || other === MATERIAL.Wall) && this.chance(12)) {", "(other === MATERIAL.Stone || other === MATERIAL.Wall) && this.chance(12) && other !== MATERIAL.Wall) {"]],
  // meteor.impacts "stardust": the meteor always lands as stone (roll kept).
  "meteor-never-stardust": [["    if (this.chance(2)) writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 180);", "    if (this.chance(2)) writeCellBytes(next, idx, MATERIAL.Stone, cell[1]);"]],
  // fungus.cosmic "moonwater": moonwater wets fungus but never charges it.
  "moonwater-skips-fungus": [["          if (other === MATERIAL.Moss || other === MATERIAL.Fungus || other === MATERIAL.Flower) {\n            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + Math.floor(vigor / 2)));\n            writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic", "          if (other === MATERIAL.Moss || other === MATERIAL.Fungus || other === MATERIAL.Flower) {\n            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + Math.floor(vigor / 2)));\n            writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater && other !== MATERIAL.Fungus ? CELL_FLAG.Cosmic"]],
  // fungus.digests "soil": fungus never takes soil (rolls kept; the fairy ring still sows on it).
  "fungus-skips-soil": [["          writeCellBytes(next, nidx, MATERIAL.Fungus, old[nidx + 1], 80);\n        }\n        return;", "          if (other !== MATERIAL.Soil) writeCellBytes(next, nidx, MATERIAL.Fungus, old[nidx + 1], 80);\n        }\n        return;"]],
  // water.rinses "wall": running water never clears soot from a wall (roll kept).
  "wall-never-rinses": [["            if (readU16(next, nidx + 6) & CELL_FLAG.Scorched && waterCanFlow && this.chance(5)) {\n              writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Scorched);\n            }\n          }\n        }\n        if (kind === MATERIAL.Ember) {", "            if (readU16(next, nidx + 6) & CELL_FLAG.Scorched && waterCanFlow && this.chance(5)) {\n            }\n          }\n        }\n        if (kind === MATERIAL.Ember) {"]],
  // oil.smothers "strips wet state": oil drains hydration but leaves the wet flag.
  "oil-keeps-wet": [["            writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Wet);\n            continue;\n          }\n          if (other === MATERIAL.Seed) {", "            continue;\n          }\n          if (other === MATERIAL.Seed) {"]],
  // wall.hearth "frozen neighbours thaw only against a brick in actual contact", the other way:
  // every warm brick thaws (roll kept).
  "hearth-thaws-by-conduction": [["if (otherFlags & CELL_FLAG.Frozen && touchingFlame && this.chance(6)) {", "if (otherFlags & CELL_FLAG.Frozen && this.chance(6)) {"]],
  // wellspring.stilled "until the cold is removed": once stilled, a spring never pours again.
  "spring-stays-stilled": [["      if (taught && next[idx] === MATERIAL.Wellspring) writeU16(next, idx + 2, 0);\n    } else if (wellspringSource(remembered)) {", "      if (taught && next[idx] === MATERIAL.Wellspring) writeU16(next, idx + 2, 0);\n      ((this as any)._stilled ??= new Set()).add(idx);\n    } else if (wellspringSource(remembered) && !(this as any)._stilled?.has(idx)) {"]],
  // wellspring.pours "pushing up through its own pool": it pours only into a bare face.
  "spring-bare-face-only": [["          if (old[nidx] !== source) break;\n", "          break;\n"]],
  // smoke.rises "and fades": smoke never ages out.
  "smoke-never-fades": [["        (kind === MATERIAL.Smoke && age > 180) ||", "        (false && kind === MATERIAL.Smoke && age > 180) ||"]],
  // stone.slumps "pillars hold": stone slips diagonally like sand, so a pillar spreads.
  "stone-slips": [["  private stone(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {\n    this.fall(idx, x, y + 1, cell, old, next);", "  private stone(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {\n    this.powder(idx, x, y, cell, old, next);"]],
  // soil.breathes "from any open face": it vents straight up only.
  "soil-vents-up-only": [["        const vent = this.openFace(ncell % this.w, Math.floor(ncell / this.w), 0, old, next);", "        const up = nidx - this.w * CELL_STRIDE;\n        const vent = up >= 0 && old[up] === MATERIAL.Empty && next[up] === MATERIAL.Empty ? up : -1;"]],
});
Object.assign(SABOTAGES, {
  // pollen.seeds itself: pollen never takes root (roll kept).
  "pollen-never-seeds": [["if (old[below] === MATERIAL.Soil && belowWet && this.chance(8)) {", "if (old[below] === MATERIAL.Soil && belowWet && this.chance(8) && false) {"]],
});
// Review (2026-10-14): impact or burst stardust lives one tick, so any visibility a follower
// shows past that comes from other grains.
const dieYoung = "    this.ageAndDecay(next); for (let i = 0; i < next.length; i += CELL_STRIDE) if (old[i] === MATERIAL.Stardust && old[i + 1] === 250) next.fill(0, i, i + CELL_STRIDE);";
Object.assign(SABOTAGES, {
  "meteor-dust-dies": [["writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 180);", "writeCellBytes(next, idx, MATERIAL.Stardust, 250, 180);"], ["    this.ageAndDecay(next);", dieYoung]],
  "burst-dust-dies": [["writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 200);", "writeCellBytes(next, idx, MATERIAL.Stardust, 250, 200);"], ["    this.ageAndDecay(next);", dieYoung]],
});
// Batch 4 (2026-10-14): rocket.fuses "a gap of air stops it", wider: a lit grain lights powder
// up to four cells away along its row, so the check can use a gap the line's own sparks do not cross.
Object.assign(SABOTAGES, {
  "fuse-jumps-4": [["    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit", "    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-2, 0], [2, 0], [-3, 0], [3, 0], [-4, 0], [4, 0]]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit"]],
});
// Diagnostic (2026-10-14): a climbing grain's trail sparks (marked by variant bit 8) never light powder.
Object.assign(SABOTAGES, {
  "rocket-trail-never-lights": [
    ["if (this.chance(3)) writeCellBytes(next, idx, MATERIAL.Spark, SPARK_DOWN, 110);", "if (this.chance(3)) writeCellBytes(next, idx, MATERIAL.Spark, SPARK_DOWN | 8, 110);"],
    ["if (old[nidx] === MATERIAL.Rocket && readU16(old, nidx + 4) === 0 && next[nidx] === MATERIAL.Rocket) {", "if (old[nidx] === MATERIAL.Rocket && readU16(old, nidx + 4) === 0 && next[nidx] === MATERIAL.Rocket && !(cell[1] & 8)) {"],
  ],
});
// rocket.fuses "a wide gap of air stops it", the other way: a lit grain lights powder up to six
// cells away along its row.
Object.assign(SABOTAGES, {
  "fuse-jumps-6": [["    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit", "    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-2, 0], [2, 0], [-3, 0], [3, 0], [-4, 0], [4, 0], [-5, 0], [5, 0], [-6, 0], [6, 0]]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit"]],
});
Object.assign(SABOTAGES, {
  "fuse-jumps-8": [["    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit", "    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], ...[2, 3, 4, 5, 6, 7, 8].flatMap((d) => [[-d, 0], [d, 0]])]) {\n      if (!this.inBounds(x + dx, y + dy)) continue;\n      const n = this.index(x + dx, y + dy);\n      const unlit"]],
});
// Batch 5 (2026-10-15): the new rules, each taken back out of the JS mirror.
Object.assign(SABOTAGES, {
  // meteor.trail fanned: trail sparks fly straight down again (the direction roll removed).
  "trail-straight-down": [["writeCellBytes(next, vacated, MATERIAL.Spark, SPARK_DOWN - 1 + (this.rand() % 3), 90);", "writeCellBytes(next, vacated, MATERIAL.Spark, SPARK_DOWN, 90);"]],
  // oil.ignites "or a spark": sparks never light oil.
  "spark-never-lights-oil": [["HOT_MATERIALS.includes(old[nidx] as (typeof HOT_MATERIALS)[number]) || old[nidx] === MATERIAL.Spark)) {", "HOT_MATERIALS.includes(old[nidx] as (typeof HOT_MATERIALS)[number]))) {"]],
  // oil.sheen: stardust never sheens oil (roll kept).
  "stardust-never-sheens": [["if (kind === MATERIAL.Stardust && other === MATERIAL.Oil && this.chance(12)) {\n          writeU16(next, nidx + 4, Math.max(36, readU16(next, nidx + 4)));\n          writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Cosmic);", "if (kind === MATERIAL.Stardust && other === MATERIAL.Oil && this.chance(12)) {"]],
  // oil.sheen "burns like a firework": a sheened slick burns plain and throws nothing (roll kept).
  "sheen-burns-plain": [["        writeU16(next, idx + 6, CELL_FLAG.Cosmic);\n        const dir = SHEEN_SPARK_DIRS[this.rand() % 3];", "        const dir = SHEEN_SPARK_DIRS[this.rand() % 3]; if (dir < 99) return;"]],
});
// requires batch (2026-10-17): the rules the eleven absent checks guard.
Object.assign(SABOTAGES, {
  // ice.stresses: dry masonry frosts like damp (no roll in this arm).
  "ice-frosts-dry": [["if ((readU16(old, nidx + 6) & CELL_FLAG.Wet) || readU16(old, nidx + 4) > 40) {", "if (true) {"]],
  // oil.smothers / water.oilblocked: oil never blocks hydration.
  "oil-never-blocks": [["if (kind !== MATERIAL.Moonwater && hydratable(other) && this.neighborHasKind(old, nidx, MATERIAL.Oil)) {", "if (false && kind !== MATERIAL.Moonwater && hydratable(other) && this.neighborHasKind(old, nidx, MATERIAL.Oil)) {"]],
  // seed.dormant / ice.pauses: a frozen seed carries on as if thawed.
  "frozen-seed-grows": [["    if (readU16(next, idx + 6) & CELL_FLAG.Frozen) return;\n    const neighborKinds", "    const neighborKinds"]],
  // seed.germinates shadow: no spacing (roll kept).
  "no-spacing": [["!this.plantNearby(x, y, old, next) && ", ""]],
  // wellspring.stilled: ice never stills a spring.
  "spring-never-stilled": [["    } else if (chilled) {", "    } else if (false && chilled) {"]],
});
Object.assign(SABOTAGES, {
  // oil.smothers, oil's own half: oil never dries what it touches.
  "oil-never-dries": [["      if (hydratable(old[nidx])) {\n        writeU16(next, nidx + 4, Math.max(0, readU16(next, nidx + 4) - 28));", "      if (false && hydratable(old[nidx])) {\n        writeU16(next, nidx + 4, Math.max(0, readU16(next, nidx + 4) - 28));"]],
});
SABOTAGES["oil-never-smothers"] = [...SABOTAGES["oil-never-dries"], ...SABOTAGES["oil-never-blocks"]];
Object.assign(SABOTAGES, {
  // 2026-10-17 batch B. rocket.lights star shells: a star spark burns out 1 in 6 like a plain one.
  "star-sparks-plain-burnout": [["if (readU16(cell, 6) & CELL_FLAG.Cosmic || this.chance(6)) writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 120);", "if (this.chance(6)) writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 120);"]],
  // rocket.lights: a meteor lights powder as any flame does.
  "meteor-lights-plain": [["writeCellBytes(next, nidx, MATERIAL.Rocket, old[nidx + 1], 220, 0, CELL_FLAG.Cosmic);", "writeCellBytes(next, nidx, MATERIAL.Rocket, old[nidx + 1], 220, 0, 0);"]],
  // moss.spreads: no spore across a gap (the roll kept).
  "moss-no-spore": [["        if (!soft || next[target] !== other) continue;\n        writeCellBytes(next, target, MATERIAL.Moss", "        if (!soft || next[target] !== other || true) continue;\n        writeCellBytes(next, target, MATERIAL.Moss"]],
});

// 2026-10-20, the heat batch.
Object.assign(SABOTAGES, {
  // ice.freezes "warm water melts it": warm water gives ice no heat.
  "warm-water-gives-no-heat": [["const given = Math.trunc((readU16(old, idx + 4) - ICE_TEMP) / MELT_SHARE);", "const given = 0;"]],
  // ice.freezes "never freezes warm water": the old line, anything under 120 freezes.
  "ice-freezes-under-120": [["readU16(old, nidx + 4) <= ICE_TEMP && this.chance(5)", "readU16(old, nidx + 4) < 120 && this.chance(5)"]],
  // ... and all water freezes.
  "ice-freezes-all-water": [["readU16(old, nidx + 4) <= ICE_TEMP && this.chance(5)", "this.chance(5)"]],
  // ice that has taken enough warmth never melts from it.
  "ice-never-melts-from-warmth": [["    if (warmth >= ICE_MELT) {", "    if (false) {"]],
  // no heat spreads through water.
  "no-heat-share": [["      if (flow) writeU16(next, c * CELL_STRIDE + 4,", "      if (false) writeU16(next, c * CELL_STRIDE + 4,"]],
  // water cools every tick again.
  "water-cools-every-tick": [["|| (kind === MATERIAL.Water && this.ticks % WATER_CHILL !== 0)", ""]],
  // ice.condenses "never hot steam": the gate is gone in both arms.
  "hot-steam-freezes": [["iceNearby && readU16(old, idx + 4) < STEAM_FREEZE && this.chance(5)", "iceNearby && this.chance(5)"],
    ["other === MATERIAL.Steam && readU16(old, nidx + 4) < STEAM_FREEZE && this.chance(4)", "other === MATERIAL.Steam && this.chance(4)"]],
  // lava.scorches "thaws": lava leaves frozen cells alone.
  "lava-never-thaws": [["          if (heatSoftens(next, nidx, old, 72)) {", "          if (!(readU16(old, nidx + 6) & CELL_FLAG.Frozen) && heatSoftens(next, nidx, old, 72)) {"]],
});
Object.assign(SABOTAGES, {
  // ice.condenses "takes the steam's heat": frost from steam warms nothing.
  "steam-gives-no-heat": [["        if (next[nidx] === MATERIAL.Steam) writeU16(next, idx + 4,", "        if (false) writeU16(next, idx + 4,"]],
});
Object.assign(SABOTAGES, {
  // HEAT_SHARE at 16 instead of 8: half the spread.
  "heat-share-16": [["const HEAT_SHARE = 8;", "const HEAT_SHARE = 16;"]],
});
Object.assign(SABOTAGES, {
  // lava.flows "pools": lava deletes lava again (the guard gone, oil's kept).
  "lava-deletes-lava": [["    if (movingCell[0] === MATERIAL.Lava && next[target] === MATERIAL.Lava) return false;\n", ""]],
  // lava.cools "from within": deep lava never cools (the roll kept).
  "deep-lava-never-cools": [["        if (this.chance(hotNeighbors < 3 ? 8 : LAVA_DEEP_COOLS)) {", "        if (this.chance(hotNeighbors < 3 ? 8 : LAVA_DEEP_COOLS) && hotNeighbors < 3) {"]],
});
Object.assign(SABOTAGES, {
  // flower.wilts "in its flower's colour" (2026-10-28): a shed petal is not marked (roll kept).
  "petal-unmarked": [["writeCellBytes(next, idx, MATERIAL.Pollen, cell[1], 150, 0, (flags & CELL_FLAG.Cosmic) | POLLEN_PETAL);", "writeCellBytes(next, idx, MATERIAL.Pollen, cell[1], 150, 0, flags & CELL_FLAG.Cosmic);"]],
  // ...and the other side: every puff is marked a petal too.
  "puff-marked": [["writeCellBytes(next, face, MATERIAL.Pollen, cell[1], 150, 0, cosmic ? CELL_FLAG.Cosmic : 0);", "writeCellBytes(next, face, MATERIAL.Pollen, cell[1], 150, 0, (cosmic ? CELL_FLAG.Cosmic : 0) | POLLEN_PETAL);"]],
});
Object.assign(SABOTAGES, {
  // ember.quenched "a burning log doused hisses" (2026-10-28): back to the old odds, 1 in 6.
  "hiss-old-odds": [["if (readU16(old, idx + 4) > 40 && this.chance(2)) {", "if (readU16(old, idx + 4) > 40 && this.chance(6)) {"]],
  // ...and never (roll kept).
  "hiss-never": [["if (readU16(old, idx + 4) > 40 && this.chance(2)) {", "if (readU16(old, idx + 4) > 40 && this.chance(2) && false) {"]],
  // ember.glows "glowing cracks": the crack clock halved, so a crack glows about half as long.
  "crack-clock-16": [["const EMBER_CRACK_CLOCK = 32;", "const EMBER_CRACK_CLOCK = 16;"]],
  // ...and a crack never holds (ember drains as it did before cracks).
  "crack-never-holds": [["          this.ticks % EMBER_CRACK_CLOCK !== 0 &&", "          false &&"]],
});
Object.assign(SABOTAGES, {
  // lava.scorches "thaws" (2026-10-28): lava never thaws a frozen neighbour (ice still melts).
  "lava-never-thaws": [["          if (heatSoftens(next, nidx, old, 72)) {\n            if (readU16(old, nidx + 6) & CELL_FLAG.Wet) {", "          if (!(readU16(old, nidx + 6) & CELL_FLAG.Frozen) && heatSoftens(next, nidx, old, 72)) {\n            if (readU16(old, nidx + 6) & CELL_FLAG.Wet) {"]],
});
Object.assign(SABOTAGES, {
  // 2026-10-29 fuller garden. stem.climbs "tall stalk": the old 4-to-7 cell budget.
  "stalk-short": [["STEM_BUDGET + (cell[1] & 3) * 55 + (cosmic ? 55 : 0), 0,", "200 + (cell[1] & 3) * 55 + (cosmic ? 55 : 0), 0,"]],
  // stem.climbs "a leaf on most rows": the old leaf on every other segment.
  "leaf-every-other": [["    const lx = y % 2 === 0 ? x - 1 : x + 1;", "    if (y % 2 !== 0) return;\n    const lx = Math.floor(y / 2) % 2 === 0 ? x - 1 : x + 1;"]],
  // flower.opens "stays in bloom for minutes": petals let go at the old age.
  "bloom-brief": [["const PETAL_SHED_AGE = 3600;", "const PETAL_SHED_AGE = 1200;"]],
  // seed.germinates "grows taller fed cosmic", on the taller budget.
  "cosmic-not-taller-2": [["STEM_BUDGET + (cell[1] & 3) * 55 + (cosmic ? 55 : 0), 0,", "STEM_BUDGET + (cell[1] & 3) * 55, 0,"]],
});
Object.assign(SABOTAGES, {
  // 2026-10-29 big heads. flower.opens "second wave": a bud never waits its turn (roll kept).
  "no-turns": [["&& !this.headInReach(x, y, cell[1], old, next) && this.chance(cosmic ? 2 : 3)", "&& this.chance(cosmic ? 2 : 3)"]],
  // a bud waiting its turn drains as any bloom does.
  "bud-drains": [["(age % BLOOM_CLOCK !== 0 || this.isWaitingBud(idx, next))", "(age % BLOOM_CLOCK !== 0)"]],
  // a head's arc does not restart when it opens.
  "arc-not-reset": [["        if (!this.petalBeside(x, y, old)) writeU16(next, idx + 2, 0);\n", ""]],
  // a bud puffs pollen while it waits (roll kept).
  "bud-puffs": [["(!(flags & CELL_FLAG.Rooted) || this.petalBeside(x, y, old)) && this.chance(cosmic ? 90 : 200)", "this.chance(cosmic ? 90 : 200)"]],
});
