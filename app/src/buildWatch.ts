// Telling a long-open tab that it is out of date.
//
// This is not a caching bug and no server header can fix it. Measured against the live
// deployment: a tab opened at 02:22:45 was still running commit 40f3929 four minutes after
// 5da8d98 went live, while a `fetch("/")` made FROM THAT SAME TAB returned the new bundle
// immediately. The origin serves `max-age=0, must-revalidate` and answers a stale ETag with
// a 200 — it withholds nothing. `must-revalidate` simply has no effect on a tab that never
// makes a request, and this is a game you leave open.
//
// So the running page has to ask. It already knows which build it is; it just never looked.
//
// Deliberately NOT automatic: a cozy sandbox must never throw away the scene someone is
// watching, so this only ever raises a notice and the player chooses when to take it.

/** The hashed bundle this page is actually running, or null when it cannot tell. */
export function runningBundle(scripts: Iterable<{ src: string }>): string | null {
  for (const script of scripts) {
    const match = /\/assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(script.src ?? "");
    if (match) return match[1];
  }
  // A dev server serves unbundled modules, so there is nothing to compare and the watch
  // stays off rather than guessing. Same for any build whose shape stops matching.
  return null;
}

/** The hashed bundle the origin is serving right now, read out of a fresh index.html. */
export function servedBundle(html: string): string | null {
  return /\/?assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html)?.[1] ?? null;
}

/**
 * Both names must be known before this can mean anything. A missing value is "cannot tell",
 * never "stale" — a false alarm here nags a player to reload a build they are already on.
 */
export function isNewerBuildLive(running: string | null, served: string | null): boolean {
  if (!running || !served) return false;
  return running !== served;
}

export const BUILD_CHECK_MIN_INTERVAL_MS = 5 * 60_000;

export type BuildWatchOptions = {
  fetchHtml: () => Promise<string>;
  now: () => number;
  minIntervalMs?: number;
};

/**
 * Returns a `check()` to call when the tab becomes visible. Throttled, because focus fires
 * far more often than anyone deploys, and silent on failure: being offline is not news.
 */
export function createBuildWatch(running: string | null, options: BuildWatchOptions) {
  const minInterval = options.minIntervalMs ?? BUILD_CHECK_MIN_INTERVAL_MS;
  let lastCheck = Number.NEGATIVE_INFINITY;
  let settled = false;
  return async function check(): Promise<boolean> {
    // Once it has said so, stop asking. The answer cannot change back, and a page that keeps
    // polling after the player has decided to stay put is just noise.
    if (settled || !running) return settled;
    const at = options.now();
    if (at - lastCheck < minInterval) return false;
    lastCheck = at;
    try {
      const served = servedBundle(await options.fetchHtml());
      settled = isNewerBuildLive(running, served);
      return settled;
    } catch {
      return false;
    }
  };
}
