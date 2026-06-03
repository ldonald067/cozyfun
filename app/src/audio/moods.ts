import type { AudioMood, AudioMoodDef } from "./types";

export const AUDIO_MOODS: AudioMoodDef[] = [
  {
    id: "rain",
    label: "Rain",
    title: "Rain Lo-Fi",
    status: "rain lo-fi on",
    ambience: {
      rainGain: 0.085,
      rainFilter: 1450,
      hushGain: 0.04,
      hushFilter: 260,
      humFrequency: 72,
      humGain: 0.018,
      dripGain: 0.012,
      dripMs: 5600
    },
    music: {
      stepMs: 720,
      chordGain: 0.032,
      chordFilterStart: 1150,
      chordFilterEnd: 620,
      thumpGain: 0.014,
      bassGain: 0.018,
      melodyGain: 0.006,
      brushGain: 0.009,
      vinylGain: 0.014,
      textureGain: 0.006,
      fillGain: 0.006,
      grooveGain: 0.85,
      colorGain: 0.82,
      phraseGain: 0.78,
      swing: 0.14,
      sparkle: false,
      progression: [
        [146.83, 220, 261.63, 329.63, 349.23],
        [196, 246.94, 329.63, 392, 440],
        [130.81, 196, 246.94, 293.66, 329.63],
        [110, 164.81, 196, 277.18, 466.16]
      ]
    }
  },
  {
    id: "window",
    label: "Window",
    title: "Window Study",
    status: "window study on",
    ambience: {
      rainGain: 0.12,
      rainFilter: 1180,
      hushGain: 0.055,
      hushFilter: 220,
      humFrequency: 68,
      humGain: 0.012,
      dripGain: 0.02,
      dripMs: 3600
    },
    music: {
      stepMs: 900,
      chordGain: 0.022,
      chordFilterStart: 920,
      chordFilterEnd: 480,
      thumpGain: 0.007,
      bassGain: 0.012,
      melodyGain: 0.0035,
      brushGain: 0.005,
      vinylGain: 0.011,
      textureGain: 0.0038,
      fillGain: 0.0035,
      grooveGain: 0.48,
      colorGain: 0.58,
      phraseGain: 0.42,
      swing: 0.1,
      sparkle: false,
      progression: [
        [130.81, 196, 246.94, 293.66, 329.63],
        [146.83, 220, 277.18, 329.63, 349.23],
        [116.54, 174.61, 220, 261.63, 293.66],
        [98, 146.83, 196, 246.94, 311.13]
      ]
    }
  },
  {
    id: "stardust",
    label: "Stardust",
    title: "Stardust Study",
    status: "stardust study on",
    ambience: {
      rainGain: 0.05,
      rainFilter: 1850,
      hushGain: 0.03,
      hushFilter: 340,
      humFrequency: 84,
      humGain: 0.014,
      dripGain: 0.008,
      dripMs: 7200
    },
    music: {
      stepMs: 780,
      chordGain: 0.026,
      chordFilterStart: 1450,
      chordFilterEnd: 760,
      thumpGain: 0.005,
      bassGain: 0.01,
      melodyGain: 0.007,
      brushGain: 0.004,
      vinylGain: 0.008,
      textureGain: 0.007,
      fillGain: 0.004,
      grooveGain: 0.46,
      colorGain: 0.9,
      phraseGain: 0.72,
      swing: 0.12,
      sparkle: true,
      progression: [
        [164.81, 246.94, 329.63, 392, 493.88],
        [146.83, 220, 293.66, 349.23, 440],
        [196, 293.66, 369.99, 493.88, 554.37],
        [123.47, 185, 246.94, 311.13, 493.88]
      ]
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
