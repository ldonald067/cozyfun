export type AmbientAudioAssetId = "catPurr" | "rainFall" | "fireCrackle";

// levelTrim normalizes each recording's loudness to the rain reference so mood/room
// gains mean the same thing across beds (measured filtered RMS: rain 0.194,
// fire 0.020, purr 0.0075). The credited files themselves stay untouched.
export const AMBIENT_AUDIO_ASSETS: Record<
  AmbientAudioAssetId,
  { url: string; label: string; minLoopSeconds: number; levelTrim: number }
> = {
  catPurr: {
    url: "/audio/cat-purr.mp3",
    label: "cat purr",
    minLoopSeconds: 120,
    levelTrim: 26
  },
  rainFall: {
    url: "/audio/rain.mp3",
    label: "rain",
    minLoopSeconds: 150,
    levelTrim: 1
  },
  fireCrackle: {
    url: "/audio/fire-crackle.wav",
    label: "fire crackle",
    minLoopSeconds: 120,
    levelTrim: 9.7
  }
};

const audioBufferCache = new WeakMap<BaseAudioContext, Map<AmbientAudioAssetId, Promise<AudioBuffer | null>>>();

export function loadAmbientAudioBuffer(context: BaseAudioContext, id: AmbientAudioAssetId) {
  let contextCache = audioBufferCache.get(context);
  if (!contextCache) {
    contextCache = new Map();
    audioBufferCache.set(context, contextCache);
  }

  const cached = contextCache.get(id);
  if (cached) return cached;

  const asset = AMBIENT_AUDIO_ASSETS[id];
  const buffer: Promise<AudioBuffer | null> = fetch(asset.url)
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
