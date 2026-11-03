// The two reshape audit checks over seeds, on the working tree and on HEAD's engine (.tmp/film/base).
// node reshape-checks.mjs [seeds=16] [roleRegex]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { CHECKS, runCheck, jsEngine, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const seeds = Number(process.argv[2] ?? 16), re = new RegExp(process.argv[3] ?? "tulip into a cup|bluebell's bells");
const builds = Object.fromEntries(Object.entries({ tree: repo, head: resolve(repo, ".tmp/film/base") }).filter(([k]) => (process.env.BUILDS ?? "tree,head").split(",").includes(k)));
for (const check of CHECKS.filter((c) => re.test(c.role))) {
  for (const [label, root] of Object.entries(builds)) {
    const engine = jsEngine(compileApp(`rc-${label}`, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine);
    let pass = 0; const notes = [];
    for (let s = 0; s < seeds; s++) {
      const r = runCheck({ ...check, seed: check.seed + s * 1000 }, { engine, colorForCell });
      const v = auditVerdict(r);
      if (v.kind === "pass") pass++;
      else if (notes.length < 4) notes.push(`seed ${check.seed + s * 1000}: ${v.kind} ${v.why.join("; ")}`);
      if (s === 0) notes.unshift(`first: cells ${r.peakCells}, ticks ${r.visibleTicks}, contrast ${Math.round(r.contrast)}, from tick ${r.firstTick}`);
    }
    console.log(`${check.role.padEnd(42)} ${label.padEnd(5)} ${pass}/${seeds}  ${notes.join(" | ")}`);
  }
}
