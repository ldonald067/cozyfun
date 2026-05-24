export type AudioChannel = "master" | "ambience" | "music" | "effects";
export type AudioMood = "rain" | "window" | "stardust";
export type MusicProvider = "generated" | "external";
export type ReactionAudioCue = "steam" | "cool" | "growth" | "spark";
export type UiAudioCue = "toggle" | "clear" | "save" | "load" | "import" | "export";

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
    brushGain: number;
    vinylGain: number;
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
