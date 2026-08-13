// Which window is allowed to tend the terrarium.
//
// Two surfaces can be open on the same save at once — the embed on the site and a
// standalone tab, say. Both run live engines against one localStorage key, so exactly
// one of them may WRITE. The newest window takes the desk chair; the others sit back
// until the player presses play or paints.
//
// This module owns the channel and the arbitration rules; `App.tsx` owns what to do
// about the answer (pause, status text, suppressing saves). It is deliberately free of
// React so the rules can be read in one place.
//
// Two things here are less obvious than they look, and both were shipped wrong first:
//
//   - **Claims need a total order.** Demoting yourself on any incoming claim seems
//     right until two windows start together: each receives the other's claim, both
//     stand up, and NOBODY owns the terrarium or saves it. Claims therefore carry a
//     timestamp, and a claim older than your own is ignored — you are the newer window,
//     so you keep it. Identical timestamps fall back to comparing ids, which is
//     arbitrary but consistent on both sides, and that is all a tiebreak has to be.
//
//   - **Leaving has to be announced.** Without a release, closing the newest window
//     leaves the older one permanently demoted: paused, not saving, and displaying
//     "another window is tending this terrarium" when no such window exists.

export type OwnerMessage =
  | { type: "claim"; id: string; at: number }
  | { type: "release"; id: string };

export type OwnerChannel = {
  id: string;
  /** When this window last claimed, for `claimWins` comparisons. 0 before any claim. */
  claimedAt(): number;
  claim(): void;
  release(): void;
  close(): void;
};

const CHANNEL_NAME = "cozy-pixel-sandbox:owner";

/** True when `incoming` outranks the claim we made at `mineAt`. */
export function claimWins(incoming: { id: string; at: number }, mine: { id: string; at: number }): boolean {
  if (incoming.at !== mine.at) return incoming.at > mine.at;
  return incoming.id > mine.id;
}

function newId(): string {
  // randomUUID needs a secure context; the fallback keeps a plain-http preview honest.
  return globalThis.crypto?.randomUUID?.() ?? `w-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Open the ownership channel. `onMessage` fires for other windows only — a window
 * never hears itself.
 *
 * Prefers BroadcastChannel and falls back to a localStorage `storage` event, which
 * every browser that can run this app supports. Without the fallback, a browser
 * missing BroadcastChannel would silently return to two windows both writing the same
 * save — precisely the bug the ownership rules exist to prevent.
 */
export function openOwnerChannel(onMessage: (message: OwnerMessage) => void): OwnerChannel {
  const id = newId();
  let claimedAt = 0;

  const deliver = (data: unknown) => {
    const message = data as OwnerMessage | undefined;
    if (!message || (message.type !== "claim" && message.type !== "release")) return;
    if (message.id === id) return;
    onMessage(message);
  };

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => deliver(event.data);
    return {
      id,
      claimedAt: () => claimedAt,
      claim() {
        claimedAt = Date.now();
        channel.postMessage({ type: "claim", id, at: claimedAt } satisfies OwnerMessage);
      },
      release() {
        channel.postMessage({ type: "release", id } satisfies OwnerMessage);
      },
      close() {
        channel.close();
      }
    };
  }

  const post = (message: OwnerMessage) => {
    try {
      // The value must differ every time or same-value writes fire no storage event.
      localStorage.setItem(CHANNEL_NAME, JSON.stringify({ ...message, seq: Date.now() + Math.random() }));
    } catch {
      // Storage unavailable: arbitration degrades to "this window owns it", which is
      // the same place a browser with no cross-window signal at all would land.
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CHANNEL_NAME || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // Ignore anything that is not one of our messages.
    }
  };
  window.addEventListener("storage", onStorage);
  return {
    id,
    claimedAt: () => claimedAt,
    claim() {
      claimedAt = Date.now();
      post({ type: "claim", id, at: claimedAt });
    },
    release() {
      post({ type: "release", id });
    },
    close() {
      window.removeEventListener("storage", onStorage);
    }
  };
}
