import type { AudioMood, AudioMoodDef } from "./types";

export const AUDIO_MOODS: AudioMoodDef[] = [
  {
    id: "rain",
    label: "Rain",
    title: "Rain + Creek",
    status: "rain and creek on",
    ambience: {
      rainGain: 0.105,
      rainFilter: 4200,
      creekGain: 0.054,
      creekFilter: 820,
      fireGain: 0.0025
    }
  },
  {
    id: "window",
    label: "Thunder",
    title: "Light Thunder",
    status: "light thunder on",
    ambience: {
      rainGain: 0.13,
      rainFilter: 3600,
      creekGain: 0.018,
      creekFilter: 700,
      fireGain: 0.0018
    }
  },
  {
    id: "stardust",
    label: "Fire",
    title: "Fireplace",
    status: "fireplace crackle on",
    ambience: {
      rainGain: 0.012,
      rainFilter: 4800,
      creekGain: 0.006,
      creekFilter: 860,
      fireGain: 0.06
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
