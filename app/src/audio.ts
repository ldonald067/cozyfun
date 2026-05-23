import { MATERIAL, type MaterialId } from "./materials";

export type AudioChannel = "master" | "ambience" | "music" | "effects";
export type UiAudioCue = "toggle" | "clear" | "save" | "load" | "import" | "export";

export type AudioPrefs = {
  enabled: boolean;
  muted: boolean;
  volumes: Record<AudioChannel, number>;
};

const AUDIO_PREFS_KEY = "cozy-pixel-sandbox:audio:v2";

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  enabled: false,
  muted: false,
  volumes: {
    master: 0.68,
    ambience: 0.62,
    music: 0.24,
    effects: 0.5
  }
};

type AudioContextConstructor = typeof AudioContext;

type RunningAudio = {
  context: AudioContext;
  channels: Record<AudioChannel, GainNode>;
};

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFS;
    return { ...normalizeAudioPrefs(JSON.parse(raw)), enabled: false };
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}

export function saveAudioPrefs(prefs: AudioPrefs) {
  try {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ ...prefs, enabled: false }));
  } catch {
    // Audio preferences are a comfort feature; storage failure should never break play.
  }
}

export function createAudioController() {
  return new CozyAudioController();
}

class CozyAudioController {
  private audio: RunningAudio | null = null;
  private prefs = DEFAULT_AUDIO_PREFS;
  private ambienceNodes: AudioNode[] = [];
  private ambienceSources: AudioScheduledSourceNode[] = [];
  private musicSources: AudioScheduledSourceNode[] = [];
  private musicTimers: number[] = [];
  private materialLastPlayedAt = new Map<number, number>();
  private ambienceStarted = false;
  private musicStarted = false;
  private musicStep = 0;

  async init(prefs: AudioPrefs) {
    this.prefs = normalizeAudioPrefs(prefs);
    if (!this.audio) {
      const AudioContextCtor = getAudioContextConstructor();
      if (!AudioContextCtor) return false;
      try {
        const context = new AudioContextCtor();
        const master = context.createGain();
        const ambience = context.createGain();
        const music = context.createGain();
        const effects = context.createGain();
        ambience.connect(master);
        music.connect(master);
        effects.connect(master);
        master.connect(context.destination);
        this.audio = {
          context,
          channels: { master, ambience, music, effects }
        };
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

  applyPreferences(prefs: AudioPrefs) {
    this.prefs = normalizeAudioPrefs(prefs);
    if (!this.audio) return;
    const now = this.audio.context.currentTime;
    for (const channel of Object.keys(this.audio.channels) as AudioChannel[]) {
      const target = channel === "master" && (this.prefs.muted || !this.prefs.enabled) ? 0 : this.prefs.volumes[channel];
      this.audio.channels[channel].gain.cancelScheduledValues(now);
      this.audio.channels[channel].gain.setTargetAtTime(target, now, 0.055);
    }
  }

  playMaterialPaint(materialId: MaterialId, intensity: number) {
    if (!this.audio || !this.prefs.enabled || this.prefs.muted) return;
    const nowMs = performance.now();
    const last = this.materialLastPlayedAt.get(materialId) ?? 0;
    if (nowMs - last < 70) return;
    this.materialLastPlayedAt.set(materialId, nowMs);

    const amount = clamp01(intensity);
    switch (materialId) {
      case MATERIAL.Sand:
      case MATERIAL.Soil:
        this.playNoiseBurst({ duration: 0.045, gain: 0.022 + amount * 0.018, filter: 1600, type: "bandpass" });
        break;
      case MATERIAL.Water:
        this.playRipple(420, 0.035 + amount * 0.025);
        break;
      case MATERIAL.Moonwater:
        this.playRipple(620, 0.04 + amount * 0.025);
        this.playChime([880, 1320], 0.035);
        break;
      case MATERIAL.Fire:
      case MATERIAL.Lava:
        this.playNoiseBurst({ duration: 0.06, gain: 0.025 + amount * 0.02, filter: 2400, type: "highpass" });
        break;
      case MATERIAL.Ice:
        this.playChime([980, 1470], 0.032);
        break;
      case MATERIAL.Stardust:
      case MATERIAL.Meteor:
        this.playChime([740, 1110, 1480], 0.04);
        break;
      case MATERIAL.Steam:
      case MATERIAL.Smoke:
        this.playNoiseBurst({ duration: 0.08, gain: 0.018, filter: 900, type: "lowpass" });
        break;
      default:
        this.playTap(300, 0.018);
    }
  }

  playUiCue(cue: UiAudioCue) {
    if (!this.audio || !this.prefs.enabled || this.prefs.muted) return;
    if (cue === "clear") {
      this.playTap(190, 0.035);
      return;
    }
    if (cue === "save" || cue === "export") {
      this.playChime([520, 780], 0.032);
      return;
    }
    if (cue === "load" || cue === "import") {
      this.playChime([420, 630], 0.028);
      return;
    }
    this.playTap(440, 0.018);
  }

  startAmbience() {
    if (!this.audio || this.ambienceStarted) return;
    this.ambienceStarted = true;
    const { context, channels } = this.audio;

    const rain = context.createBufferSource();
    rain.buffer = createNoiseBuffer(context, 2.5);
    rain.loop = true;
    const rainFilter = context.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 1450;
    rainFilter.Q.value = 0.65;
    const rainGain = context.createGain();
    rainGain.gain.value = 0.085;
    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(channels.ambience);

    const hush = context.createBufferSource();
    hush.buffer = createNoiseBuffer(context, 3);
    hush.loop = true;
    const hushFilter = context.createBiquadFilter();
    hushFilter.type = "lowpass";
    hushFilter.frequency.value = 260;
    const hushGain = context.createGain();
    hushGain.gain.value = 0.04;
    hush.connect(hushFilter);
    hushFilter.connect(hushGain);
    hushGain.connect(channels.ambience);

    const hum = context.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 72;
    const humGain = context.createGain();
    humGain.gain.value = 0.018;
    hum.connect(humGain);
    humGain.connect(channels.ambience);

    rain.start();
    hush.start();
    hum.start();
    this.ambienceSources.push(rain, hush, hum);
    this.ambienceNodes.push(rainFilter, rainGain, hushFilter, hushGain, humGain);
  }

  startMusicBed() {
    if (!this.audio || this.musicStarted) return;
    this.musicStarted = true;
    const { context, channels } = this.audio;

    const vinyl = context.createBufferSource();
    vinyl.buffer = createDustBuffer(context, 2.75);
    vinyl.loop = true;
    const vinylFilter = context.createBiquadFilter();
    vinylFilter.type = "bandpass";
    vinylFilter.frequency.value = 1800;
    vinylFilter.Q.value = 0.35;
    const vinylGain = context.createGain();
    vinylGain.gain.value = 0.014;
    vinyl.connect(vinylFilter);
    vinylFilter.connect(vinylGain);
    vinylGain.connect(channels.music);
    vinyl.start();

    const scheduleStep = () => {
      this.playLofiStep();
      this.musicStep++;
    };
    scheduleStep();
    this.musicTimers.push(window.setInterval(scheduleStep, 720));
    this.musicSources.push(vinyl);
    this.ambienceNodes.push(vinylFilter, vinylGain);
  }

  dispose() {
    for (const source of [...this.ambienceSources, ...this.musicSources]) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.ambienceSources = [];
    this.musicSources = [];
    for (const timer of this.musicTimers) window.clearInterval(timer);
    this.musicTimers = [];
    this.ambienceNodes = [];
    this.ambienceStarted = false;
    this.musicStarted = false;
    this.musicStep = 0;
    if (this.audio) {
      void this.audio.context.close();
      this.audio = null;
    }
  }

  private playNoiseBurst(options: { duration: number; gain: number; filter: number; type: BiquadFilterType }) {
    if (!this.audio) return;
    const { context, channels } = this.audio;
    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context, options.duration);
    const filter = context.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.value = options.filter;
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.gain, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(channels.effects);
    source.start(now);
    source.stop(now + options.duration + 0.01);
  }

  private playRipple(frequency: number, gainValue: number) {
    if (!this.audio) return;
    const { context, channels } = this.audio;
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.68, context.currentTime + 0.16);
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(channels.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  private playChime(frequencies: number[], gainValue: number) {
    if (!this.audio) return;
    const { context, channels } = this.audio;
    const now = context.currentTime;
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const gain = context.createGain();
      const offset = index * 0.018;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(gainValue / frequencies.length, now + offset + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);
      oscillator.connect(gain);
      gain.connect(channels.effects);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.3);
    });
  }

  private playTap(frequency: number, gainValue: number) {
    if (!this.audio) return;
    const { context, channels } = this.audio;
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    oscillator.connect(gain);
    gain.connect(channels.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  private playLofiStep() {
    if (!this.audio) return;
    const step = this.musicStep;
    const now = this.audio.context.currentTime;
    if (step % 8 === 0) {
      const chords = [
        [146.83, 220, 261.63, 329.63],
        [196, 246.94, 329.63, 440],
        [130.81, 196, 246.94, 293.66],
        [110, 196, 261.63, 329.63]
      ];
      this.playSoftChord(chords[(step / 8) % chords.length], now);
      this.playLowThump(now);
    }
    if (step % 2 === 1) this.playBrushHat(now);
    if (step % 8 === 4) this.playBrushSnare(now);
  }

  private playSoftChord(frequencies: number[], time: number) {
    if (!this.audio) return;
    const { context, channels } = this.audio;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1150, time);
    filter.frequency.exponentialRampToValueAtTime(620, time + 1.6);
    const chordGain = context.createGain();
    chordGain.gain.setValueAtTime(0.0001, time);
    chordGain.gain.exponentialRampToValueAtTime(0.032, time + 0.045);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, time + 2.85);
    filter.connect(chordGain);
    chordGain.connect(channels.music);

    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index % 2 === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 2 - 3;
      oscillator.connect(filter);
      oscillator.start(time + index * 0.018);
      oscillator.stop(time + 2.95);
    });
  }

  private playBrushHat(time: number) {
    this.playMusicNoise({ time, duration: 0.045, gain: 0.008, filter: 5200, type: "highpass" });
  }

  private playBrushSnare(time: number) {
    this.playMusicNoise({ time, duration: 0.11, gain: 0.011, filter: 1900, type: "bandpass" });
  }

  private playLowThump(time: number) {
    if (!this.audio) return;
    const { context, channels } = this.audio;
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(82, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.16);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.018, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    oscillator.connect(gain);
    gain.connect(channels.music);
    oscillator.start(time);
    oscillator.stop(time + 0.24);
  }

  private playMusicNoise(options: { time: number; duration: number; gain: number; filter: number; type: BiquadFilterType }) {
    if (!this.audio) return;
    const { context, channels } = this.audio;
    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context, options.duration);
    const filter = context.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.value = options.filter;
    filter.Q.value = 0.5;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, options.time);
    gain.gain.exponentialRampToValueAtTime(options.gain, options.time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.time + options.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(channels.music);
    source.start(options.time);
    source.stop(options.time + options.duration + 0.01);
  }
}

function normalizeAudioPrefs(value: unknown): AudioPrefs {
  if (!value || typeof value !== "object") return DEFAULT_AUDIO_PREFS;
  const candidate = value as Partial<AudioPrefs>;
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_AUDIO_PREFS.enabled,
    muted: typeof candidate.muted === "boolean" ? candidate.muted : DEFAULT_AUDIO_PREFS.muted,
    volumes: {
      master: readVolume(candidate.volumes?.master, DEFAULT_AUDIO_PREFS.volumes.master),
      ambience: readVolume(candidate.volumes?.ambience, DEFAULT_AUDIO_PREFS.volumes.ambience),
      music: readVolume(candidate.volumes?.music, DEFAULT_AUDIO_PREFS.volumes.music),
      effects: readVolume(candidate.volumes?.effects, DEFAULT_AUDIO_PREFS.volumes.effects)
    }
  };
}

function createDustBuffer(context: AudioContext, duration: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const dust = Math.random() > 0.992 ? Math.random() * 2 - 1 : 0;
    data[i] = dust + (Math.random() * 2 - 1) * 0.08;
  }
  return buffer;
}

function readVolume(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? clamp01(value) : fallback;
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const browserGlobal = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext ?? null;
}

function createNoiseBuffer(context: AudioContext, duration: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
