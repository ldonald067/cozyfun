// Does the Railway configuration in this repo match what Railway is actually running?
//
// This exists because the migration off `railway.json` changed something that looks like
// nothing and is not: **the authoring file no longer applies itself.** Railway's own docs
// are explicit — Config as Code "is still read from your service repository during deploy",
// while Infrastructure as Code "is evaluated by the Railway CLI ... and applies those
// changes only after confirmation".
//
// So the old habit is now a silent no-op. Editing `.railway/railway.ts`, committing, pushing
// and watching a green deploy used to mean the config changed. It now means the FILE
// changed; the service is untouched until somebody runs `railway config apply`. Nothing in
// the deploy output says so, and `npm run deploy:verify` cannot see it either — that gate
// asks whether the running build is the commit you expect, which it is.
//
// `railway config plan --detailed-exit-code` is the oracle: 0 when the file and the
// environment agree, 2 when changes are pending. Verified both ways on this repo.
//
//   npm run config:drift
//
// It needs the Railway CLI, a login, and a linked project, and it says so rather than
// passing quietly when any of those is missing — a config check that skips itself is worse
// than no check, for the same reason a build warning that is always on is worse than none.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const authoring = resolve(root, ".railway/railway.ts");

const die = (message, hint) => {
  console.error(`\nRailway config drift check FAILED: ${message}`);
  if (hint) console.error(`  → ${hint}`);
  process.exit(1);
};

if (!existsSync(authoring)) {
  die("no .railway/railway.ts in this repo",
      "if the deploy config moved, update this check with it");
}
if (existsSync(resolve(root, "railway.json")) || existsSync(resolve(root, "railway.toml"))) {
  die("a Config as Code file is back alongside the IaC file",
      "Railway refuses to let both manage one service, and Config as Code stops being read " +
      "entirely on 2026-12-01. Delete it and apply the IaC file instead.");
}

const which = spawnSync("which", ["railway"], { encoding: "utf8" });
if (which.status !== 0) die("the `railway` CLI is not on PATH", "brew install railway, then `railway login`");
const railway = which.stdout.trim();

// `_` has to be set explicitly, and the reason is a real trap rather than a nicety. The
// railway/iac SDK works out which CLI is driving it from `process.env._` — the SHELL's
// "last command" variable (node_modules/railway/dist/iac/index.js). Typed at a prompt that
// is `railway`, so the version probe succeeds and everything works by hand. Spawned from a
// script it is the node binary, the probe reads the wrong thing, and the SDK throws
// "requires Railway CLI 5.42.1 or newer" while a perfectly new CLI sits on PATH. Pointing
// `_` at the resolved binary makes the check behave the same way from a terminal, an npm
// script and CI — which is the entire point of having it.
const plan = spawnSync(railway, ["config", "plan", "--detailed-exit-code"],
  { cwd: root, encoding: "utf8", env: { ...process.env, _: railway } });

if (plan.status === 0) {
  console.log("Railway config drift check passed: .railway/railway.ts matches the live environment.");
  process.exit(0);
}
if (plan.status === 2) {
  console.error("\nRailway config drift check FAILED: the committed config is NOT what Railway is running.");
  console.error("\n" + (plan.stdout || "").trim().split("\n").map((l) => "  " + l).join("\n"));
  console.error("\n  The authoring file does not apply itself — that is the whole difference from");
  console.error("  railway.json, which Railway read on every deploy. Run `railway config plan` to");
  console.error("  read the diff line by line, then `railway config apply` to land it.");
  process.exit(1);
}
const why = ((plan.stderr || "") + (plan.stdout || "")).trim().split("\n").slice(0, 4).join("\n  ");
die(`railway config plan could not run (exit ${plan.status})`,
    `is the CLI logged in and this directory linked?\n  ${why}`);
