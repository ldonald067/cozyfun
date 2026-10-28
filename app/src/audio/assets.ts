export type AmbientAudioAssetId = "catPurr" | "rainFall" | "fireCrackle";

// levelTrim normalizes each recording's loudness to the rain reference so mood/room
// gains mean the same thing across beds (measured filtered RMS: rain 0.194,
// fire 0.020, purr 0.0075). The credited files themselves stay untouched.
//
// storeRate is the sample rate a bed is decoded to and held at. Decoding to the context's
// rate (48 kHz) held ~240 MB of PCM for three beds. Purr (24 kHz) and fire (32 kHz) keep
// the rate they were recorded at, so nothing is lost. Rain is resampled to 22.05 kHz: its
// lowpass never opens past 6.5 kHz in any mood or room, and what the filtered rain still
// carries above 11 kHz measured 41 dB under the rest of it (.tmp/audio-audit/rate.mjs).
export const AMBIENT_AUDIO_ASSETS: Record<
  AmbientAudioAssetId,
  { url: string; label: string; storeRate: number; levelTrim: number }
> = {
  catPurr: {
    url: "audio/cat-purr.mp3",
    label: "cat purr",
    storeRate: 24000,
    levelTrim: 26
  },
  rainFall: {
    url: "audio/rain.mp3",
    label: "rain",
    storeRate: 22050,
    levelTrim: 1
  },
  fireCrackle: {
    url: "audio/fire-crackle.mp3",
    label: "fire crackle",
    storeRate: 32000,
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

/**
 * Fetch and decode one bed at its storeRate. An AudioBuffer is not tied to the context that
 * decoded it, so a throwaway OfflineAudioContext does the resampling and the live context
 * plays the result. Browsers without one fall back to decoding on the live context.
 */
export async function decodeAmbientAudio(id: AmbientAudioAssetId, fallback: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(ambientAudioUrl(id));
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    let decoder: BaseAudioContext = fallback;
    try {
      decoder = new OfflineAudioContext(1, 1, AMBIENT_AUDIO_ASSETS[id].storeRate);
    } catch {
      // Keep the live context.
    }
    return await decoder.decodeAudioData(bytes);
  } catch {
    return null;
  }
}
