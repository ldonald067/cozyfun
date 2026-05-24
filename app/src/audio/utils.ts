import type { AudioContextConstructor } from "./types";

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const browserGlobal = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext ?? null;
}

export function stopSources(sources: AudioScheduledSourceNode[]) {
  for (const source of sources) {
    try {
      source.stop();
    } catch {
      // Source may already be stopped by the browser.
    }
  }
}

export function disconnectAudioNodes(...nodes: AudioNode[]) {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      // Disconnect can race with a browser-managed ended event.
    }
  }
}

export function disconnectAfterEnded(source: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  source.addEventListener("ended", () => disconnectAudioNodes(source, ...nodes), { once: true });
}
