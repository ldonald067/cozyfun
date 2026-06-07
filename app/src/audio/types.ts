export type AudioChannel = "master" | "ambience";
export type AudioMood = "rain" | "window" | "stardust";
export type AudioProvider = "native" | "external";

export type AudioPrefs = {
  enabled: boolean;
  muted: boolean;
  mood: AudioMood;
  provider: AudioProvider;
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
    creekGain: number;
    creekFilter: number;
    creekBurbleGain: number;
    creekBurbleMs: number;
    thunderGain: number;
    thunderMs: number;
    fireGain: number;
    fireCrackleGain: number;
    fireCrackleMs: number;
    hushGain: number;
    hushFilter: number;
    humFrequency: number;
    humGain: number;
    dripGain: number;
    dripMs: number;
  };
};

export type AudioProviderDef = {
  id: AudioProvider;
  label: string;
  title: string;
  status: string;
  available: boolean;
  badge?: string;
};
