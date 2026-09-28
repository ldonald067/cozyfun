// Did a change move the interaction audit, or did the dice?
//
// `npm run interaction:audit` measures every check on ONE seed, and one seed cannot tell an
// effect from noise. That mattered the first time anyone looked: adding sinking appeared to
// cut a spark hissing over water from contrast 423 to 201, a lava quench from 893 ticks on
// screen to 199, and to push a fairy ring from tick 353 to 1113. Over ten seeds the spark's
// median contrast was 394 both ways, the quench 407 against 500, the ring 1001 against 744 —
// the single-seed table had mostly been reporting dice. Every earlier before/after table in
// this repo, including "96 of 115 checks moved" for the move-clobber fix, was taken that way.
//
// This replays every audit scene over N seeds on two builds — the working tree and a git
// ref — and reports a metric as MOVED only when the two sides' middle halves (p25..p75)
// do not overlap: a move the seed spread cannot explain. It is a measurement, not a gate,
// and always exits 0 unless it cannot run.
//
//   npm run audit:drift                      working tree against HEAD
//   npm run audit:drift -- --base origin/main
//   npm run audit:drift -- --seeds 12 --only stone.erodes,wellspring.pours
//   npm run audit:drift -- --per-seed --only moss.dries    does each seed PASS the audit?
//
// Every seed also gets the audit's own verdict (`auditVerdict`, shared with
// interaction:audit), so a change in how many seeds would pass is always listed as a move.
// `--per-seed` prints that verdict for every selected check on both builds, failing seeds by
// name — the question re-staging a scene keeps asking ("does it pass on 7-8 seeds of 8?"),
// which a spread comparison cannot answer: a middle half can hold still while one seed drops
// under a floor.
//
// The base side is built from a worktree under .tmp/drift and its results are cached by
// commit, seed count and the scene file's contents, so comparing twice against the same ref
// costs one side. Both sides play the CURRENT scene list: the question is what the engine
// change did to the same scenes, and a check added in this change simply shows as never
// reached on the base.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { CHECKS, auditVerdict, colorForCell, loadRenderer, loadWasmEngine, runCheck } from "./interaction-scenes.mjs";

const root = resolve(import.meta.dirname, "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const baseRef = arg("base", "HEAD");
const seeds = Number(arg("seeds", "8"));
const perSeed = process.argv.includes("--per-seed");
const only = arg("only", "").split(",").filter(Boolean);
const checks = only.length ? CHECKS.filter((c) => only.includes(c.covers)) : CHECKS;
const unknown = only.filter((id) => !CHECKS.some((c) => c.covers === id));
if (unknown.length) throw new Error(`audit:drift: unknown check id(s): ${unknown.join(", ")}`);
// Several interactions carry more than one check under the same id (stem.climbs, oil.floats,
// fire.ignites, ...), so a check is keyed by id AND role. Keying by id alone let the second
// check of a pair silently overwrite the first in both the results and the comparison.
const keyOf = (check) => `${check.covers} | ${check.role}`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", ...opts });
  if (r.status !== 0) throw new Error(`audit:drift: ${cmd} ${args.join(" ")} failed\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// ---------------------------------------------------------------------------- measure
function measure(engine, renderer, label) {
  const out = {};
  checks.forEach((check, n) => {
    if (process.stdout.isTTY) process.stdout.write(`\r  ${label}: ${n + 1}/${checks.length} ${check.covers.padEnd(28)}`);
    const runs = [];
    // k = 0 is the audit's own seed, so the audit's single reading is always in the sample.
    for (let k = 0; k < seeds; k++) runs.push(runCheck({ ...check, seed: check.seed + k * 1000 }, { engine, colorForCell: renderer }));
    out[keyOf(check)] = runs.map((r, k) => {
      const verdict = auditVerdict({ ...check, ...r });
      return {
        seed: check.seed + k * 1000,
        // An `absent` check succeeds by never firing, so "reached" means what the check means.
        // A vacuous run is not reached: it measured the painted scene, not the interaction.
        reached: !r.vacuous && (r.absent ? r.firstTick < 0 : r.firstTick >= 0),
        firstTick: r.firstTick, cells: r.spreadCells ?? 0, shown: r.visibleTicks ?? 0, contrast: Math.round(r.contrast ?? 0),
        verdict: verdict.kind, why: verdict.why,
      };
    });
  });
  if (process.stdout.isTTY) process.stdout.write("\r" + " ".repeat(60) + "\r");
  return out;
}

// ---------------------------------------------------------------------------- the base
const baseSha = run("git", ["rev-parse", baseRef]);
const scenesHash = createHash("sha1").update(readFileSync(resolve(root, "scripts/interaction-scenes.mjs"))).digest("hex").slice(0, 10);
const driftDir = resolve(root, ".tmp/drift");
const cacheFile = resolve(driftDir, `v3-${baseSha.slice(0, 12)}-${seeds}seeds-${scenesHash}${only.length ? "-" + only.join("+") : ""}.json`);
mkdirSync(driftDir, { recursive: true });

let base;
if (existsSync(cacheFile)) {
  base = JSON.parse(readFileSync(cacheFile, "utf8"));
  console.log(`base ${baseRef} (${baseSha.slice(0, 7)}): cached`);
} else {
  // One reused worktree, re-pointed at whatever the base is, so cargo's incremental cache
  // (a shared target dir) makes a second base cheap.
  const tree = resolve(driftDir, "base");
  if (!existsSync(tree)) run("git", ["worktree", "add", "--detach", tree, baseSha]);
  else run("git", ["checkout", "--detach", "--force", baseSha], { cwd: tree });
  console.log(`base ${baseRef} (${baseSha.slice(0, 7)}): building wasm in .tmp/drift/base`);
  run("cargo", ["build", "--manifest-path", "sim/Cargo.toml", "--target", "wasm32-unknown-unknown", "--release"],
    { cwd: tree, env: { ...process.env, CARGO_TARGET_DIR: resolve(driftDir, "target") } });
  mkdirSync(resolve(tree, "app/public/sim"), { recursive: true });
  copyFileSync(resolve(driftDir, "target/wasm32-unknown-unknown/release/cozy_sandbox_sim.wasm"), resolve(tree, "app/public/sim/cozy_sandbox_sim.wasm"));
  const renderer = loadRenderer("drift-base-renderer", tree).colorForCell;
  base = measure(await loadWasmEngine(tree), renderer, `base ${baseSha.slice(0, 7)}`);
  writeFileSync(cacheFile, JSON.stringify(base));
}

// ---------------------------------------------------------------------------- the head
// Rebuild this tree's wasm first. `cargo build` alone leaves app/public/sim stale, and a
// drift report against a stale binary would compare the base with an older self.
console.log("working tree: building wasm");
run("npm", ["run", "build:sim", "--silent"]);
const head = measure(await loadWasmEngine(), colorForCell, "working tree");

// ---------------------------------------------------------------------------- compare
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
};
const band = (xs) => ({ lo: quantile(xs, 0.25), mid: quantile(xs, 0.5), hi: quantile(xs, 0.75) });
// A metric moved when the two middles do not overlap. Only runs that REACHED the outcome
// carry a meaningful tick, size or contrast; reaching itself is compared by count.
const METRICS = [["firstTick", "first tick"], ["cells", "cells"], ["shown", "shown"], ["contrast", "contrast"]];

const moved = [];
for (const check of checks) {
  const b = base[keyOf(check)], h = head[keyOf(check)];
  if (!b) { moved.push({ check, notes: ["no base measurement"] }); continue; }
  const notes = [];
  const bPass = b.filter((r) => r.verdict === "pass").length, hPass = h.filter((r) => r.verdict === "pass").length;
  if (bPass !== hPass) notes.push(`passes the audit on ${bPass}/${seeds} seeds -> ${hPass}/${seeds}`);
  const bReach = b.filter((r) => r.reached).length, hReach = h.filter((r) => r.reached).length;
  if (bReach !== hReach) notes.push(`reached on ${bReach}/${seeds} seeds -> ${hReach}/${seeds}`);
  const bOk = b.filter((r) => r.reached && !check.absent), hOk = h.filter((r) => r.reached && !check.absent);
  if (bOk.length >= 2 && hOk.length >= 2) {
    for (const [key, label] of METRICS) {
      const x = band(bOk.map((r) => r[key])), y = band(hOk.map((r) => r[key]));
      if (y.lo > x.hi || y.hi < x.lo) notes.push(`${label} ${x.mid} -> ${y.mid} (spread ${x.lo}-${x.hi} -> ${y.lo}-${y.hi})`);
    }
  }
  if (notes.length) moved.push({ check, notes });
}

if (perSeed) {
  // Every selected check, moved or not: the point is the verdict on each seed.
  const describe = (runs) => {
    const pass = runs.filter((r) => r.verdict === "pass").length;
    const failed = runs.map((r, k) => ({ ...r, k })).filter((r) => r.verdict !== "pass");
    return `${String(pass).padStart(2)}/${seeds} pass` +
      (failed.length ? "   fails: " + failed.map((r) => `#${r.k} (seed ${r.seed}) ${r.verdict}: ${r.why.join(", ")}`).join("; ") : "");
  };
  console.log(`\nAudit verdict per seed: working tree against ${baseRef} (${baseSha.slice(0, 7)}), ${checks.length} checks x ${seeds} seeds.`);
  console.log(`The verdict is interaction:audit's own (auditVerdict); the audit itself plays seed #0.\n`);
  let regressions = 0;
  for (const check of checks) {
    const b = base[keyOf(check)], h = head[keyOf(check)];
    const bPass = b ? b.filter((r) => r.verdict === "pass").length : NaN;
    const hPass = h.filter((r) => r.verdict === "pass").length;
    if (hPass < bPass) regressions++;
    console.log(`  ${check.covers.padEnd(22)} ${check.role}${hPass < bPass ? "   <- fewer seeds pass" : ""}`);
    console.log(`      base  ${b ? describe(b) : "no base measurement"}`);
    console.log(`      now   ${describe(h)}`);
  }
  console.log(`\n${regressions} of ${checks.length} checks pass on fewer seeds than the base.`);
  process.exit(0);
}

console.log(`\nAudit drift: working tree against ${baseRef} (${baseSha.slice(0, 7)}), ${checks.length} checks x ${seeds} seeds.`);
console.log(`A metric is listed only when the two builds' middle halves do not overlap.\n`);
if (!moved.length) console.log("  Nothing moved further than the seed spread.");
for (const { check, notes } of moved) {
  console.log(`  ${check.covers.padEnd(22)} ${check.role}`);
  for (const note of notes) console.log(`      ${note}`);
}
console.log(`\n${moved.length} of ${checks.length} checks moved beyond their seed spread.`);
