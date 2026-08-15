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

if (failures.length) {
  console.error(`\nDeploy verification FAILED (${failures.length}):`);
  for (const line of failures) console.error(`  - ${line}`);
  console.error("\nA redeploy that did not happen, or a host serving wasm as the wrong type,");
  console.error("both look completely normal in a browser. That is what this gate is for.");
  process.exit(1);
}
console.log("\nDeploy verification passed: the deployment is the expected commit, on the wasm engine.");
