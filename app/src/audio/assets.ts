export type AmbientAudioAssetId = "catPurr" | "rainFall" | "fireCrackle";

// levelTrim normalizes each recording's loudness to the rain reference so mood/room
// gains mean the same thing across beds (measured filtered RMS: rain 0.194,
// fire 0.020, purr 0.0075). The credited files themselves stay untouched.
export const AMBIENT_AUDIO_ASSETS: Record<
  AmbientAudioAssetId,
  { url: string; label: string; minLoopSeconds: number; levelTrim: number }
> = {
  catPurr: {
    url: "audio/cat-purr.mp3",
    label: "cat purr",
    minLoopSeconds: 120,
    levelTrim: 26
  },
  rainFall: {
    url: "audio/rain.mp3",
    label: "rain",
    minLoopSeconds: 150,
    levelTrim: 1
  },
  fireCrackle: {
    url: "audio/fire-crackle.mp3",
    label: "fire crackle",
    minLoopSeconds: 120,
    levelTrim: 9.7
  }
};

// The table above stores paths relative to the site root so `scripts/audio-qa.mjs` can read
// it as plain data; the deploy base is applied here, the single place that resolves an
// ambience URL. Resolved inline rather than importing the shared `assetUrl` helper because
// that QA script transpiles this module on its own, where a sibling import would not
// resolve. Playback telemetry reports this same resolved URL, so a probe never disagrees
// with what was actually fetched.
export function ambientAudioUrl(id: AmbientAudioAssetId) {
  const base = import.meta.env?.BASE_URL ?? "/";
  return `${base}${AMBIENT_AUDIO_ASSETS[id].url}`;
}

const audioBufferCache = new WeakMap<BaseAudioContext, Map<AmbientAudioAssetId, Promise<AudioBuffer | null>>>();

export function loadAmbientAudioBuffer(context: BaseAudioContext, id: AmbientAudioAssetId) {
  let contextCache = audioBufferCache.get(context);
  if (!contextCache) {
    contextCache = new Map();
    audioBufferCache.set(context, contextCache);
  }

  const cached = contextCache.get(id);
  if (cached) return cached;

  const buffer: Promise<AudioBuffer | null> = fetch(ambientAudioUrl(id))
    .then((response) => {
      if (!response.ok) return null;
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => {
      if (!arrayBuffer) return null;
      return context.decodeAudioData(arrayBuffer);
    })
    .catch(() => null);

  void buffer.then((decoded) => {
    if (!decoded) contextCache?.delete(id);
  });

  contextCache.set(id, buffer);
  return buffer;
}
