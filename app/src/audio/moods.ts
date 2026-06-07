import type { AudioMood, AudioMoodDef } from "./types";

export const AUDIO_MOODS: AudioMoodDef[] = [
  {
    id: "rain",
    label: "Rain",
    title: "Rain + Creek",
    status: "rain and creek on",
    ambience: {
      rainGain: 0.09,
      rainFilter: 1420,
      creekGain: 0.052,
      creekFilter: 720,
      creekBurbleGain: 0.007,
      creekBurbleMs: 3400,
      thunderGain: 0.004,
      thunderMs: 32000,
      fireGain: 0.004,
      fireCrackleGain: 0.002,
      fireCrackleMs: 5400,
      hushGain: 0.035,
      hushFilter: 260,
      humFrequency: 70,
      humGain: 0.01,
      dripGain: 0.014,
      dripMs: 5200
    }
  },
  {
    id: "window",
    label: "Thunder",
    title: "Light Thunder",
    status: "light thunder on",
    ambience: {
      rainGain: 0.105,
      rainFilter: 1160,
      creekGain: 0.024,
      creekFilter: 620,
      creekBurbleGain: 0.004,
      creekBurbleMs: 5200,
      thunderGain: 0.012,
      thunderMs: 18000,
      fireGain: 0.003,
      fireCrackleGain: 0.0016,
      fireCrackleMs: 6200,
      hushGain: 0.052,
      hushFilter: 220,
      humFrequency: 66,
      humGain: 0.009,
      dripGain: 0.018,
      dripMs: 3800
    }
  },
  {
    id: "stardust",
    label: "Fire",
    title: "Fireplace",
    status: "fireplace crackle on",
    ambience: {
      rainGain: 0.022,
      rainFilter: 1680,
      creekGain: 0.012,
      creekFilter: 760,
      creekBurbleGain: 0.0025,
      creekBurbleMs: 7600,
      thunderGain: 0.0025,
      thunderMs: 42000,
      fireGain: 0.04,
      fireCrackleGain: 0.012,
      fireCrackleMs: 1900,
      hushGain: 0.03,
      hushFilter: 300,
      humFrequency: 74,
      humGain: 0.012,
      dripGain: 0.004,
      dripMs: 7800
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
