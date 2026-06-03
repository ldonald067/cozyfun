export type AudioChannel = "master" | "ambience" | "music";
export type AudioMood = "rain" | "window" | "stardust";
export type MusicProvider = "generated" | "external";

export type AudioPrefs = {
  enabled: boolean;
  muted: boolean;
  mood: AudioMood;
  provider: MusicProvider;
  volumes: Record<AudioChannel, number>;
};

export type AudioContextConstructor = typeof AudioContext;

export type RunningAudio = {
  context: AudioContext;
  channels: Record<AudioChannel, GainNode>;
};

export type AudioLayerHandle = {
  stop(): void;
};

export type AudioMoodDef = {
  id: AudioMood;
  label: string;
  title: string;
  status: string;
  ambience: {
    rainGain: number;
    rainFilter: number;
    hushGain: number;
    hushFilter: number;
    humFrequency: number;
    humGain: number;
    dripGain: number;
    dripMs: number;
  };
  music: {
    stepMs: number;
    chordGain: number;
    chordFilterStart: number;
    chordFilterEnd: number;
    thumpGain: number;
    bassGain: number;
    melodyGain: number;
    brushGain: number;
    vinylGain: number;
    textureGain: number;
    fillGain: number;
    swing: number;
    sparkle: boolean;
    progression: number[][];
  };
};

export type MusicProviderDef = {
  id: MusicProvider;
  label: string;
  title: string;
  status: string;
  available: boolean;
  badge?: string;
};
