import type { AudioMood, AudioMoodDef } from "./types";

export const AUDIO_MOODS: AudioMoodDef[] = [
  {
    id: "rain",
    label: "Rain",
    title: "Rain + Creek",
    status: "rain and creek on",
    ambience: {
      rainGain: 0.096,
      rainFilter: 3800,
      creekGain: 0.048,
      creekFilter: 760,
      fireGain: 0.0018
    }
  },
  {
    id: "window",
    label: "Thunder",
    title: "Light Thunder",
    status: "light thunder on",
    ambience: {
      rainGain: 0.118,
      rainFilter: 3300,
      creekGain: 0.014,
      creekFilter: 660,
      fireGain: 0.0014
    }
  },
  {
    id: "stardust",
    label: "Fire",
    title: "Fireplace",
    status: "fireplace crackle on",
    ambience: {
      rainGain: 0.008,
      rainFilter: 4200,
      creekGain: 0.004,
      creekFilter: 780,
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
