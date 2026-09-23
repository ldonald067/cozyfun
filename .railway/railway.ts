// Railway Infrastructure as Code — replaces the deprecated railway.json.
//
// This is what railway.json declared, PLUS the GitHub source — and the source is here
// because leaving it out is destructive rather than neutral. `railway config plan` on a
// version of this file that omitted it proposed:
//
//     source.checkSuites (true -> null)
//     source.repo ("ldonald067/cozyfun" -> null)
//     source.type ("github" -> null)
//
// Omitting a whole top-level block nulls its fields rather than leaving them alone, so a
// "faithful 1:1 of railway.json" would have disconnected the repo and killed push-to-deploy
// outright. Note this is about the BLOCK, not every field: `build.buildEnvironment` is
// "V3" live, is not named below, and plans clean — undeclared keys inside a block that IS
// declared are preserved. Plan before applying and read every line; the rule is not
// uniform enough to reason about from memory.
//
// One field is a genuine gain over railway.json: `checkSuites` IS the Settings -> Source
// "Wait for CI" toggle, which holds a deploy in WAITING until GitHub Actions passes and
// marks it SKIPPED if CI fails. docs/HARNESS.md records that it was a dashboard setting
// railway.json could not carry, so nothing in the repo could say whether it was on. It can
// now, and this file is the answer.
//
// The custom domain, region and runtime stay undeclared deliberately: this plans clean
// without them, so they are not at risk, and restating them would only add ways to be
// wrong.
//
// `railway config migrate` does NOT produce this file. It emits the builder and the
// dockerfile path as COMMENTS and drops the restart policy outright, which would have
// silently handed the build to Railpack — the service's own builder field still says
// RAILPACK, because railway.json was overriding it at deploy time rather than changing it.
// That matters more here than it would in most repos: this image builds two toolchains in
// one stage (cargo compiles the sim to wasm32, then Vite bundles the app around it), which
// is exactly what the Dockerfile exists to do and exactly what a buildpack cannot infer.
import { defineRailway, github, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. The project also holds
// the `album-club` service and its volume, which live in a different repo and must not be
// touched from here.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "cozyfun";

export default defineRailway(() => {
  const cozyfun = service("cozyfun", {
    source: github("ldonald067/cozyfun", { branch: "main", checkSuites: true }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile"
    },
    deploy: {
      startCommand: "node scripts/serve-static.mjs",
      healthcheckPath: "/",
      // restartPolicyType is deliberately NOT declared, though railway.json carried
      // "ON_FAILURE". It is Railway's default, so the platform normalises it away: applying
      // it reports success and it reads back null, leaving `railway config plan` reporting
      // one pending change forever. A drift detector that always says "1 to change" cannot
      // show you real drift — the same reason the build-identity warning stopped keying on
      // bundle filenames. The behaviour is unchanged; only the phantom diff is gone.
      // maxRetries stays because 3 genuinely differs from the default of 10, and persists.
      restartPolicyMaxRetries: 3
    }
  });
  return project("discerning-acceptance", {
    resources: [cozyfun]
  });
});
