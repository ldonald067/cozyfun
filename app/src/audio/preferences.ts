import { DEFAULT_AUDIO_MOOD, isAudioMood } from "./moods";
import { DEFAULT_MUSIC_PROVIDER, isAvailableMusicProvider } from "./providers";
import type { AudioChannel, AudioPrefs } from "./types";
import { clamp01 } from "./utils";

const AUDIO_PREFS_KEY = "cozy-pixel-sandbox:audio:v2";

export const AUDIO_CHANNELS: AudioChannel[] = ["master", "ambience", "music", "effects"];

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  enabled: false,
  muted: false,
  mood: DEFAULT_AUDIO_MOOD,
  provider: DEFAULT_MUSIC_PROVIDER,
  volumes: {
    master: 0.68,
    ambience: 0.62,
    music: 0.24,
    effects: 0.5
  }
};

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFS;
    return { ...normalizeAudioPrefs(JSON.parse(raw)), enabled: false };
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}

export function saveAudioPrefs(prefs: AudioPrefs) {
  try {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ ...prefs, enabled: false }));
  } catch {
    // Audio preferences are a comfort feature; storage failure should never break play.
  }
}

export function normalizeAudioPrefs(value: unknown): AudioPrefs {
  if (!value || typeof value !== "object") return DEFAULT_AUDIO_PREFS;
  const candidate = value as Partial<AudioPrefs>;
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_AUDIO_PREFS.enabled,
    muted: typeof candidate.muted === "boolean" ? candidate.muted : DEFAULT_AUDIO_PREFS.muted,
    mood: isAudioMood(candidate.mood) ? candidate.mood : DEFAULT_AUDIO_PREFS.mood,
    provider: isAvailableMusicProvider(candidate.provider) ? candidate.provider : DEFAULT_AUDIO_PREFS.provider,
    volumes: {
      master: readVolume(candidate.volumes?.master, DEFAULT_AUDIO_PREFS.volumes.master),
      ambience: readVolume(candidate.volumes?.ambience, DEFAULT_AUDIO_PREFS.volumes.ambience),
      music: readVolume(candidate.volumes?.music, DEFAULT_AUDIO_PREFS.volumes.music),
      effects: readVolume(candidate.volumes?.effects, DEFAULT_AUDIO_PREFS.volumes.effects)
    }
  };
}

function readVolume(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? clamp01(value) : fallback;
}
