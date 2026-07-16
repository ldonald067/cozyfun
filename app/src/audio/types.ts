export type AudioChannel = "master" | "ambience";
export type AudioMood = "rain" | "purr" | "fire";
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
  cueBus: GainNode;
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
    purrGain: number;
    purrFilter: number;
    rainGain: number;
    rainFilter: number;
    fireGain: number;
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
