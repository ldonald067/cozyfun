// The one way a Node harness loads the app's TypeScript.
//
// Eight scripts used to carry their own copy of this: the same tsc flags, the same rm, the
// same package.json shim, each writing to its own `.tmp/` folder. The copies had not drifted
// yet, but nothing would have noticed if one did — and a harness compiled with different
// flags from the others measures a slightly different program.
//
// Every call wipes its folder and compiles fresh. That matters more than it looks: a number
// read out of a stale `.tmp/` compile once sent an adversarial reviewer's finding the wrong
// way (54 against a real 76), because the folder was only as fresh as the last gate that
// happened to write it.
//
// `root` lets a harness compile a DIFFERENT checkout — `audit:drift` uses it to build the
// base side of a comparison from a git worktree.
import { rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

/**
 * Compile `files` (paths under app/src) to CommonJS in `.tmp/<name>` and return a loader for
 * the output. Throws, naming the harness, if the compile fails.
 */
export function compileApp(name, files, { root = repoRoot, outDir = resolve(repoRoot, ".tmp", name) } = {}) {
  rmSync(outDir, { recursive: true, force: true });
  // Always this checkout's compiler: a worktree carries no node_modules of its own.
  const tsc = resolve(repoRoot, "app/node_modules/typescript/bin/tsc");
  const compiled = spawnSync(
    process.execPath,
    [tsc, "--target", "ES2022", "--module", "CommonJS", "--moduleResolution", "Node",
     "--lib", "ES2022,DOM", "--strict", "true", "--skipLibCheck", "true",
     "--esModuleInterop", "true", "--outDir", outDir,
     ...files.map((file) => `app/src/${file}`)],
    { cwd: root, stdio: "inherit" },
  );
  if (compiled.status !== 0) throw new Error(`${name}: TypeScript compile failed`);
  writeFileSync(resolve(outDir, "package.json"), JSON.stringify({ type: "commonjs" }));
  return {
    dir: outDir,
    /** Load a compiled module by its path under app/src, without the extension. */
    load: (module) => require(resolve(outDir, `${module}.js`)),
  };
}
