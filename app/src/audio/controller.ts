import { startRainAmbience } from "./ambience";
import { playMaterialPaintCue } from "./cues";
import { createAudioMixer, applyMixerPreferences } from "./mixer";
import { startRainLofiMusic } from "./music";
import { DEFAULT_AUDIO_PREFS, normalizeAudioPrefs } from "./preferences";
import { DEFAULT_AUDIO_ROOM } from "./rooms";
import type { AudioChannel, AudioLayerHandle, AudioMood, AudioPrefs, MusicProvider, RunningAudio } from "./types";
import { clamp01, getAudioContextConstructor } from "./utils";
import type { MaterialId } from "../materials";
import type { SceneEnvironmentId } from "../sceneEnvironments";

export function createAudioController() {
  return new CozyAudioController();
}

class CozyAudioController {
  private audio: RunningAudio | null = null;
  private prefs = DEFAULT_AUDIO_PREFS;
  private room: SceneEnvironmentId = DEFAULT_AUDIO_ROOM;
  private ambience: AudioLayerHandle | null = null;
  private music: AudioLayerHandle | null = null;
  private lastPaintCueAt = 0;

  async init(prefs: AudioPrefs, room: SceneEnvironmentId = this.room) {
    this.prefs = normalizeAudioPrefs(prefs);
    this.room = room;
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

  setVolume(channel: AudioChannel, value: number) {
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

  setRoom(room: SceneEnvironmentId) {
    if (room === this.room) return;
    this.room = room;
    this.restartAmbienceLayer();
  }

  setMoodAndRoom(mood: AudioMood, room: SceneEnvironmentId) {
    const nextPrefs = normalizeAudioPrefs({ ...this.prefs, mood });
    const moodChanged = nextPrefs.mood !== this.prefs.mood;
    const roomChanged = room !== this.room;
    if (!moodChanged && !roomChanged) return;
    this.prefs = nextPrefs;
    this.room = room;
    if (moodChanged) this.restartLongRunningLayers();
    else this.restartAmbienceLayer();
  }

  setMusicProvider(provider: MusicProvider) {
    const nextPrefs = normalizeAudioPrefs({ ...this.prefs, provider });
    if (nextPrefs.provider === this.prefs.provider) return;
    this.prefs = nextPrefs;
    this.restartLongRunningLayers();
  }

  playPaintCue(material: MaterialId) {
    if (!this.audio || !this.prefs.enabled || this.prefs.muted) return;
    const now = this.audio.context.currentTime;
    if (now - this.lastPaintCueAt < 0.095) return;
    this.lastPaintCueAt = now;
    playMaterialPaintCue(this.audio, material, now + 0.005);
  }

  applyPreferences(prefs: AudioPrefs) {
    this.prefs = normalizeAudioPrefs(prefs);
    if (!this.audio) return;
    applyMixerPreferences(this.audio, this.prefs);
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

  private startAmbience() {
    if (!this.audio || this.ambience) return;
    this.ambience = startRainAmbience(this.audio, this.prefs.mood, this.room);
  }

  private startMusicBed() {
    if (!this.audio || this.music) return;
    if (this.prefs.provider !== "generated") return;
    this.music = startRainLofiMusic(this.audio, this.prefs.mood);
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

  private restartAmbienceLayer() {
    if (!this.audio) return;
    this.ambience?.stop();
    this.ambience = null;
    this.startAmbience();
    this.applyPreferences(this.prefs);
  }
}
