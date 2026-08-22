// Is the deployment running the commit I think it is?
//
// This gate exists because for months nothing could answer that. The app carried no build
// identity at all — the preview badge reports asset filenames, and only when a QA query
// parameter is present — so "live looks different from local" could be suspected but never
// checked. A whole afternoon went into chasing a browser check that failed against
// production and passed locally, and the first thing that had to be established, by hand,
// was whether the deployed binary was even the same code.
//
//   npm run deploy:verify                       # against COZY_QA_URL, expects local HEAD
//   COZY_QA_URL=https://... npm run deploy:verify <sha>
//
// It asserts four things, each a distinct way a deploy can be wrong while looking fine:
//
//   1. The page boots and reports its commit. A bundle that fails to load reports nothing,
//      which is itself the answer.
//   2. That commit matches the expected one. This is the whole point: a redeploy that
//      silently did not happen leaves the old SHA sitting there.
//   3. The wasm is served as application/wasm. Several static hosts default unknown
//      extensions to application/octet-stream, and the app does NOT report that — it drops
//      to the slower JS engine and looks fine.
//   4. The running app says "wasm sim online" rather than "js fallback". Point 3 checks the
//      header; this checks the outcome, and they can disagree.
//   5. CI actually passed for the commit that is live. Railway builds from `main` on push,
//      on its own clock and with no knowledge of GitHub Actions, so a commit can be serving
//      happily while its CI run is still going — or has already failed. Every other check
//      here would say "green" about it. A GREEN DEPLOY IS NOT A GREEN BUILD unless somebody
//      asks, so this asks.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assert,
  connectToFirstPage,
  evaluate,
  startBrowser,
  waitUntil
} from "./browser-qa-helpers.mjs";

const root = resolve(import.meta.dirname, "..");
const target = (process.env.COZY_QA_URL ?? "https://pixelfun.littlealbumclub.net").replace(/\/$/, "");

function localHead() {
  const run = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  return run.status === 0 ? run.stdout.trim() : "";
}

const expected = (process.argv[2] ?? localHead()).trim();
assert(expected, "no commit to expect: pass one as an argument, or run inside a git checkout");

console.log(`Deploy verification: ${target}`);
console.log(`  expecting commit ${expected}`);

const failures = [];
const record = (ok, line) => {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};

// 3. The MIME type, checked before booting anything — it is a property of the host, and a
//    wrong one is invisible from inside the app.
const wasm = await fetch(`${target}/sim/cozy_sandbox_sim.wasm`);
const wasmType = wasm.headers.get("content-type") ?? "(none)";
record(
  wasm.ok && wasmType.startsWith("application/wasm"),
  `wasm served as ${wasmType} (${wasm.status})`
);

let servedCommit = "";
const browser = await startBrowser();
try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: `${target}/` });
  await waitUntil(
    () => evaluate(cdp, `Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`),
    "the app to boot",
    45_000
  );

  // 1 and 2. The stamp. `dev` means the build never received a commit — a local build
  // served from somewhere it should not be, or an ARG that stopped being passed through.
  const served = await evaluate(cdp, `document.querySelector(".app-shell")?.dataset.cozyCommit ?? ""`);
  servedCommit = served;
  record(Boolean(served), `page reports a build commit: ${served || "(none — bundle carries no stamp)"}`);
  if (served === "dev") {
    record(false, "deployment is stamped 'dev': the build got no COZY_COMMIT, so its identity is unknown");
  } else if (served) {
    record(
      served === expected,
      served === expected
        ? `serving ${served.slice(0, 12)}, which is the expected commit`
        : `serving ${served.slice(0, 12)}, expected ${expected.slice(0, 12)} — the deploy is behind`
    );
  }

  // 4. The engine actually in use, which is the thing a wrong MIME type silently costs.
  //    waitUntil resolves with nothing, so the text is captured here rather than returned
  //    from the predicate — reading it off the return value gives `undefined`, and
  //    `!/js fallback/.test(undefined)` is true, i.e. the check would pass on a fallback.
  let status = "";
  await waitUntil(
    async () => {
      status = await evaluate(cdp, `document.querySelector('[data-testid="status-message"]')?.textContent ?? ""`);
      return /wasm sim online|js fallback|terrarium/i.test(status);
    },
    "the status line to settle",
    30_000
  );
  record(Boolean(status) && !/js fallback/i.test(status), `status line reads "${status}"`);
} finally {
  await browser.close();
}

// 5. Did CI pass for the commit that is actually live? This is deliberately keyed on the
//    SERVED sha, not on local HEAD: the question is whether the thing users are running was
//    ever verified, and those two differ exactly when it matters most.
//
//    `in_progress` is not a pass. That is the real case — a deploy beats CI to the finish
//    line more often than it fails — and treating "not finished" as "fine" would make this
//    check worse than nothing.
if (servedCommit && servedCommit !== "dev") {
  const gh = spawnSync(
    "gh",
    ["api", `repos/{owner}/{repo}/commits/${servedCommit}/check-runs`,
     "--jq", ".check_runs[] | \"\\(.name)\\t\\(.status)\\t\\(.conclusion // \"pending\")\""],
    { cwd: root, encoding: "utf8" },
  );
  if (gh.status !== 0) {
    // Not a pass and not a silent skip. If nobody can answer the question, say so on the
    // same line the other four checks print on.
    record(false, `could not read CI for ${servedCommit.slice(0, 12)} — is the GitHub CLI installed and authenticated? (${(gh.stderr || "").trim().split("\n")[0] || "gh failed"})`);
  } else {
    const runs = gh.stdout.trim().split("\n").filter(Boolean).map((line) => {
      const [name, status, conclusion] = line.split("\t");
      return { name, status, conclusion };
    });
    if (!runs.length) {
      record(false, `no CI runs found for ${servedCommit.slice(0, 12)} — the live commit was never checked`);
    } else {
      const unfinished = runs.filter((r) => r.status !== "completed");
      const failed = runs.filter((r) => r.status === "completed" && r.conclusion !== "success" && r.conclusion !== "neutral" && r.conclusion !== "skipped");
      if (unfinished.length) {
        record(false, `CI has not finished for the live commit: ${unfinished.map((r) => `${r.name} is ${r.status}`).join(", ")}`);
      } else if (failed.length) {
        record(false, `CI FAILED for the live commit: ${failed.map((r) => `${r.name} → ${r.conclusion}`).join(", ")}`);
      } else {
        record(true, `CI passed for the live commit (${runs.length} check${runs.length === 1 ? "" : "s"})`);
      }
    }
  }
}

if (failures.length) {
  console.error(`\nDeploy verification FAILED (${failures.length}):`);
  for (const line of failures) console.error(`  - ${line}`);
  console.error("\nA redeploy that did not happen, a host serving wasm as the wrong type, or a");
  console.error("commit that shipped before CI finished with it — all three look completely");
  console.error("normal in a browser. That is what this gate is for.");
  process.exit(1);
}
console.log("\nDeploy verification passed: the deployment is the expected commit, on the wasm engine.");
