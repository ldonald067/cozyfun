import type { MaterialId } from "../materials";
import { startRainAmbience } from "./ambience";
import { createAudioMixer, applyMixerPreferences } from "./mixer";
import { startRainLofiMusic } from "./music";
import { DEFAULT_AUDIO_PREFS, normalizeAudioPrefs } from "./preferences";
import type { AudioLayerHandle, AudioMood, AudioPrefs, MusicProvider, ReactionAudioCue, RunningAudio, UiAudioCue } from "./types";
import { clamp01, getAudioContextConstructor } from "./utils";

export function createAudioController() {
  return new CozyAudioController();
}

class CozyAudioController {
  private audio: RunningAudio | null = null;
  private prefs = DEFAULT_AUDIO_PREFS;
  private ambience: AudioLayerHandle | null = null;
  private music: AudioLayerHandle | null = null;

  async init(prefs: AudioPrefs) {
    this.prefs = normalizeAudioPrefs(prefs);
    if (!this.audio) {
      const AudioContextCtor = getAudioContextConstructor();
      if (!AudioContextCtor) return false;
      try {
        const context = new AudioContextCtor();
        this.audio = createAudioMixer(context);
        this.startAmbience();
        this.startMusicBed();
      } catch {
        this.dispose();
        return false;
      }
    }

    try {
      await this.audio.context.resume();
    } catch {
      this.dispose();
      return false;
    }
    this.applyPreferences(this.prefs);
    return true;
  }

  setEnabled(enabled: boolean) {
    this.prefs = { ...this.prefs, enabled };
    this.applyPreferences(this.prefs);
  }

  setMuted(muted: boolean) {
    this.prefs = { ...this.prefs, muted };
    this.applyPreferences(this.prefs);
  }

  setVolume(channel: keyof AudioPrefs["volumes"], value: number) {
    this.prefs = {
      ...this.prefs,
      volumes: {
        ...this.prefs.volumes,
        [channel]: clamp01(value)
      }
    };
    this.applyPreferences(this.prefs);
  }

  setMood(mood: AudioMood) {
    const nextPrefs = normalizeAudioPrefs({ ...this.prefs, mood });
    if (nextPrefs.mood === this.prefs.mood) return;
    this.prefs = nextPrefs;
    this.restartLongRunningLayers();
  }

  setMusicProvider(provider: MusicProvider) {
    const nextPrefs = normalizeAudioPrefs({ ...this.prefs, provider });
    if (nextPrefs.provider === this.prefs.provider) return;
    this.prefs = nextPrefs;
    this.restartLongRunningLayers();
  }

  applyPreferences(prefs: AudioPrefs) {
    this.prefs = normalizeAudioPrefs(prefs);
    if (!this.audio) return;
    applyMixerPreferences(this.audio, this.prefs);
  }

  // Keep the one-shot API stable while the prototype synth effects are paused.
  playMaterialPaint(_materialId: MaterialId, _intensity: number) {}

  playUiCue(_cue: UiAudioCue) {}

  playReactionCue(_cue: ReactionAudioCue, _intensity: number) {}

  startAmbience() {
    if (!this.audio || this.ambience) return;
    this.ambience = startRainAmbience(this.audio, this.prefs.mood);
  }

  startMusicBed() {
    if (!this.audio || this.music) return;
    if (this.prefs.provider !== "generated") return;
    this.music = startRainLofiMusic(this.audio, this.prefs.mood);
  }

  dispose() {
    this.ambience?.stop();
    this.music?.stop();
    this.ambience = null;
    this.music = null;
    if (this.audio) {
      void this.audio.context.close();
      this.audio = null;
    }
  }

  private restartLongRunningLayers() {
    if (!this.audio) return;
    this.ambience?.stop();
    this.music?.stop();
    this.ambience = null;
    this.music = null;
    this.startAmbience();
    this.startMusicBed();
    this.applyPreferences(this.prefs);
  }
}
