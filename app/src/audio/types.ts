export type AudioChannel = "master" | "ambience" | "music" | "effects";
export type UiAudioCue = "toggle" | "clear" | "save" | "load" | "import" | "export";

export type AudioPrefs = {
  enabled: boolean;
  muted: boolean;
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
