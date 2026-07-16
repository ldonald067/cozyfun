import type { AudioMood, AudioMoodDef } from "./types";

export const AUDIO_MOODS: AudioMoodDef[] = [
  {
    id: "rain",
    label: "Rain",
    title: "Rain",
    status: "rain on",
    ambience: {
      purrGain: 0.01,
      purrFilter: 520,
      rainGain: 0.096,
      rainFilter: 3800,
      fireGain: 0.0018
    }
  },
  {
    id: "purr",
    label: "Purr",
    title: "Cat Purr",
    status: "cat purr on",
    ambience: {
      purrGain: 0.052,
      purrFilter: 480,
      rainGain: 0.018,
      rainFilter: 3300,
      fireGain: 0.0014
    }
  },
  {
    id: "fire",
    label: "Fire",
    title: "Fireplace",
    status: "fireplace crackle on",
    ambience: {
      purrGain: 0.006,
      purrFilter: 540,
      rainGain: 0.006,
      rainFilter: 4200,
      fireGain: 0.052
    }
  }
];

export const DEFAULT_AUDIO_MOOD: AudioMood = "rain";

export function getAudioMoodDef(mood: AudioMood) {
  return AUDIO_MOODS.find((candidate) => candidate.id === mood) ?? AUDIO_MOODS[0];
}

export function isAudioMood(value: unknown): value is AudioMood {
  return typeof value === "string" && AUDIO_MOODS.some((candidate) => candidate.id === value);
}

// Saves and prefs written before the mood rename carry these ids.
const LEGACY_AUDIO_MOOD_IDS: Record<string, AudioMood> = {
  window: "purr",
  stardust: "fire"
};

export function resolveAudioMood(value: unknown): AudioMood | null {
  if (typeof value !== "string") return null;
  const mapped = LEGACY_AUDIO_MOOD_IDS[value] ?? value;
  return isAudioMood(mapped) ? mapped : null;
}
