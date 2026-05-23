import type { MaterialId } from "../materials";
import { startRainAmbience } from "./ambience";
import { playMaterialPaint as playMaterialPaintCue, playUiCue as playUiCueSound } from "./effects";
import { createAudioMixer, applyMixerPreferences } from "./mixer";
import { startRainLofiMusic } from "./music";
import { DEFAULT_AUDIO_PREFS, normalizeAudioPrefs } from "./preferences";
import type { AudioLayerHandle, AudioPrefs, RunningAudio, UiAudioCue } from "./types";
import { clamp01, getAudioContextConstructor } from "./utils";

export function createAudioController() {
  return new CozyAudioController();
}

class CozyAudioController {
  private audio: RunningAudio | null = null;
  private prefs = DEFAULT_AUDIO_PREFS;
  private ambience: AudioLayerHandle | null = null;
  private music: AudioLayerHandle | null = null;
  private materialLastPlayedAt = new Map<number, number>();

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

  applyPreferences(prefs: AudioPrefs) {
    this.prefs = normalizeAudioPrefs(prefs);
    if (!this.audio) return;
    applyMixerPreferences(this.audio, this.prefs);
  }

  playMaterialPaint(materialId: MaterialId, intensity: number) {
    const audio = this.audibleAudio();
    if (!audio) return;
    const nowMs = performance.now();
    const last = this.materialLastPlayedAt.get(materialId) ?? 0;
    if (nowMs - last < 70) return;
    this.materialLastPlayedAt.set(materialId, nowMs);
    playMaterialPaintCue(audio, materialId, intensity);
  }

  playUiCue(cue: UiAudioCue) {
    const audio = this.audibleAudio();
    if (!audio) return;
    playUiCueSound(audio, cue);
  }

  startAmbience() {
    if (!this.audio || this.ambience) return;
    this.ambience = startRainAmbience(this.audio);
  }

  startMusicBed() {
    if (!this.audio || this.music) return;
    this.music = startRainLofiMusic(this.audio);
  }

  dispose() {
    this.ambience?.stop();
    this.music?.stop();
    this.ambience = null;
    this.music = null;
    this.materialLastPlayedAt.clear();
    if (this.audio) {
      void this.audio.context.close();
      this.audio = null;
    }
  }

  private audibleAudio() {
    if (!this.audio || !this.prefs.enabled || this.prefs.muted) return null;
    return this.audio;
  }
}
