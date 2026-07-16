import { startNativeAmbience } from "./ambience";
import { playMaterialPaintCue, playReactionCue } from "./cues";
import { createAudioMixer, applyMixerPreferences } from "./mixer";
import { DEFAULT_AUDIO_PREFS, normalizeAudioPrefs } from "./preferences";
import type { ReactionCue } from "./reactions";
import { DEFAULT_AUDIO_ROOM } from "./rooms";
import type { AudioChannel, AudioLayerHandle, AudioMood, AudioPrefs, AudioProvider, RunningAudio } from "./types";
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
  private lastPaintCueAt = 0;
  private lastReactionCueAt = Number.NEGATIVE_INFINITY;
  private lastReactionCueByKind: Record<ReactionCue, number> = {
    "impact-burst": Number.NEGATIVE_INFINITY,
    cleanse: Number.NEGATIVE_INFINITY,
    "cosmic-charge": Number.NEGATIVE_INFINITY,
    bloom: Number.NEGATIVE_INFINITY,
    "steam-flash": Number.NEGATIVE_INFINITY,
    vitrify: Number.NEGATIVE_INFINITY,
    starfire: Number.NEGATIVE_INFINITY,
    "ember-glow": Number.NEGATIVE_INFINITY,
    quench: Number.NEGATIVE_INFINITY,
    crumble: Number.NEGATIVE_INFINITY,
    frost: Number.NEGATIVE_INFINITY,
    dew: Number.NEGATIVE_INFINITY,
    shatter: Number.NEGATIVE_INFINITY
  };

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
    this.restartAmbienceLayer();
  }

  setRoom(room: SceneEnvironmentId) {
    if (room === this.room) return;
    this.room = room;
    this.restartAmbienceLayer();
  }

  setMoodAndRoom(mood: AudioMood, room: SceneEnvironmentId) {
    const nextPrefs = normalizeAudioPrefs({ ...this.prefs, mood });
    if (nextPrefs.mood === this.prefs.mood && room === this.room) return;
    this.prefs = nextPrefs;
    this.room = room;
    this.restartAmbienceLayer();
  }

  setAudioProvider(provider: AudioProvider) {
    const nextPrefs = normalizeAudioPrefs({ ...this.prefs, provider });
    if (nextPrefs.provider === this.prefs.provider) return;
    this.prefs = nextPrefs;
    this.applyPreferences(this.prefs);
  }

  playPaintCue(material: MaterialId) {
    if (!this.audio || !this.prefs.enabled || this.prefs.muted) return;
    const now = this.audio.context.currentTime;
    if (now - this.lastPaintCueAt < 0.095) return;
    this.lastPaintCueAt = now;
    playMaterialPaintCue(this.audio, material, now + 0.005);
  }

  canPlayReactionCues() {
    return Boolean(this.audio && this.prefs.enabled && !this.prefs.muted);
  }

  playReactionCues(cues: readonly ReactionCue[]) {
    if (!this.audio || !this.prefs.enabled || this.prefs.muted || cues.length === 0) return;
    const now = this.audio.context.currentTime;
    if (now - this.lastReactionCueAt < 0.28) return;
    const cue = this.pickReactionCue(cues, now);
    if (!cue) return;
    this.lastReactionCueAt = now;
    this.lastReactionCueByKind[cue] = now;
    playReactionCue(this.audio, cue, now + 0.006);
  }

  applyPreferences(prefs: AudioPrefs) {
    this.prefs = normalizeAudioPrefs(prefs);
    if (!this.audio) return;
    applyMixerPreferences(this.audio, this.prefs);
  }

  dispose() {
    this.ambience?.stop();
    this.ambience = null;
    if (this.audio) {
      void this.audio.context.close();
      this.audio = null;
    }
  }

  private startAmbience() {
    if (!this.audio || this.ambience) return;
    this.ambience = startNativeAmbience(this.audio, this.prefs.mood, this.room);
  }

  private restartAmbienceLayer() {
    if (!this.audio) return;
    this.ambience?.stop();
    this.ambience = null;
    this.startAmbience();
    this.applyPreferences(this.prefs);
  }

  private pickReactionCue(cues: readonly ReactionCue[], now: number) {
    for (const cue of REACTION_CUE_PRIORITY) {
      if (!cues.includes(cue)) continue;
      if (now - this.lastReactionCueByKind[cue] < REACTION_CUE_COOLDOWNS[cue]) continue;
      return cue;
    }
    return null;
  }
}

const REACTION_CUE_PRIORITY: ReactionCue[] = [
  "crumble",
  "shatter",
  "impact-burst",
  "vitrify",
  "starfire",
  "cleanse",
  "ember-glow",
  "quench",
  "cosmic-charge",
  "bloom",
  "frost",
  "dew",
  "steam-flash"
];

const REACTION_CUE_COOLDOWNS: Record<ReactionCue, number> = {
  "impact-burst": 0.9,
  cleanse: 1.2,
  "cosmic-charge": 1.15,
  bloom: 1.4,
  "steam-flash": 1.1,
  vitrify: 1.1,
  starfire: 1.0,
  "ember-glow": 1.25,
  quench: 1.05,
  crumble: 1.6,
  frost: 1.2,
  dew: 1.35,
  shatter: 1.2
};
