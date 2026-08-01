// Subpath deployment smoke: proves one build can be served from a path other than the
// domain root, which is what embedding the sandbox in a section of another site requires.
//
// This exists because the failure it guards is invisible. Assets fetched by URL string
// (room images, ambience beds, the wasm sim) are not rewritten by Vite, so a missed base
// prefix 404s — and for the wasm that does NOT throw, it silently drops the sandbox to the
// slower JS fallback engine. A subpath deploy with a stale absolute path looks completely
// fine and runs wrong. The rest of the gate only ever builds and serves at "/", so without
// this check nothing would catch that regression.
//
// Builds into its own output directory so `app/dist` (which the browser and visual QA
// stages consume) is left alone.
import { rm, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const BASE = "/pixelfun/";
const outDir = resolve(root, ".tmp/subpath-dist");

await rm(outDir, { recursive: true, force: true });
const build = spawnSync(
  "npm",
  ["--prefix", "app", "run", "build", "--", "--outDir", outDir, "--emptyOutDir"],
  { cwd: root, stdio: "inherit", env: { ...process.env, COZY_BASE: BASE } },
);
if (build.status !== 0) throw new Error("subpath build failed");

const failures = [];
const assetsDir = resolve(outDir, "assets");
const bundles = (await readdir(assetsDir)).filter((name) => name.endsWith(".js"));
if (bundles.length === 0) failures.push("no JS bundle emitted");

const html = await readFile(resolve(outDir, "index.html"), "utf8");
for (const ref of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])) {
  if (!ref.startsWith("/")) continue;
  if (!ref.startsWith(BASE)) failures.push(`index.html references ${ref}, which ignores the ${BASE} base`);
}

// Any absolute /audio, /rooms, or /sim literal left in the bundle is a 404 under a subpath.
// The wasm one is the dangerous case; the others merely break visibly.
const ABSOLUTE_ASSET = /"\/(?:audio|rooms|sim)\/[A-Za-z0-9._-]+"/g;
for (const name of bundles) {
  const code = await readFile(resolve(assetsDir, name), "utf8");
  for (const hit of code.match(ABSOLUTE_ASSET) ?? []) {
    failures.push(`${name} still hardcodes ${hit} — it would 404 under ${BASE}`);
  }
  if (!code.includes(BASE)) failures.push(`${name} never references ${BASE}; the base was not applied`);
  // Requiring the base "somewhere" is weak on its own — the audio and room URLs satisfy it
  // without the wasm being involved at all. So also require the wasm to appear in its
  // base-relative form. Note it can only be checked in that form: assetUrl() joins base and
  // path at runtime, so the finished URL never exists as a literal in the bundle to match.
  // Together with the absolute-path rejection above this pins the wasm to the helper; what
  // it cannot catch is a deliberate origin-relative construction, which the root-served
  // browser smoke would still miss too, and which nobody writes by accident.
  if (!code.includes("sim/cozy_sandbox_sim.wasm")) {
    failures.push(`${name} never references sim/cozy_sandbox_sim.wasm in base-relative form; the wasm would 404 under ${BASE} and the sandbox would drop to the JS engine without erroring`);
  }
  // Catches a double-applied base, e.g. assetUrl() run over an already-prefixed path.
  if (code.includes(`${BASE}${BASE.slice(1)}`)) failures.push(`${name} contains a doubled base prefix`);
}

// embed.html must stay base-agnostic: it launches its sibling index.html by relative path,
// so it works unchanged wherever the build is mounted.
const embed = await readFile(resolve(outDir, "embed.html"), "utf8");
if (!embed.includes('frame.src = "index.html"')) {
  failures.push("embed.html no longer launches index.html by relative path");
}
for (const hit of embed.match(/(?:src|href)="\/[^"]*"/g) ?? []) {
  failures.push(`embed.html uses an absolute path ${hit}; it must stay relative to work at any base`);
}

await rm(outDir, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`Subpath smoke failed for base ${BASE}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Subpath smoke passed: build at base ${BASE} carries no root-absolute asset paths, ` +
    `applies the base in ${bundles.length} bundle(s), and keeps embed.html relative.`,
);
