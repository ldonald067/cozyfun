export { createAudioController } from "./audio/controller";
export { AUDIO_MOODS, getAudioMoodDef } from "./audio/moods";
export { MUSIC_PROVIDERS, getMusicProviderDef } from "./audio/providers";
export { AUDIO_CHANNELS, DEFAULT_AUDIO_PREFS, VISIBLE_AUDIO_CHANNELS, loadAudioPrefs, saveAudioPrefs } from "./audio/preferences";
export type { AudioChannel, AudioMood, AudioPrefs, MusicProvider, ReactionAudioCue, UiAudioCue } from "./audio/types";
