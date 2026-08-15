// Which commit is this bundle?
//
// For months there was no way to answer that about the deployed app: the preview badge
// reports asset filenames, and only when a QA query parameter is present, so "is production
// running the code I think it is" could only ever be guessed at. `npm run deploy:verify`
// reads the value below off the running page and compares it to a commit.
//
// Vite replaces `__COZY_COMMIT__` at build time from the COZY_COMMIT environment variable.
// The Dockerfile feeds it Railway's RAILWAY_GIT_COMMIT_SHA; an ordinary local build has no
// commit to claim and says so rather than asserting a wrong one.
declare const __COZY_COMMIT__: string | undefined;

export const BUILD_COMMIT =
  typeof __COZY_COMMIT__ === "string" && __COZY_COMMIT__.length > 0 ? __COZY_COMMIT__ : "dev";
