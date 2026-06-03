export { createAudioController } from "./audio/controller";
export { AUDIO_MOODS, getAudioMoodDef } from "./audio/moods";
export { MUSIC_PROVIDERS, getMusicProviderDef } from "./audio/providers";
export { AUDIO_CHANNELS, DEFAULT_AUDIO_PREFS, loadAudioPrefs, saveAudioPrefs } from "./audio/preferences";
export type { AudioChannel, AudioMood, AudioPrefs, MusicProvider } from "./audio/types";
