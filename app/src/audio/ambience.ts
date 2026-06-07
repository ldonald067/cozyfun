import { loadAmbientAudioBuffer, type AmbientAudioAssetId } from "./assets";
import { createNoiseBuffer } from "./buffers";
import { getAudioMoodDef } from "./moods";
import { DEFAULT_AUDIO_ROOM, getRoomAmbienceDef } from "./rooms";
import type { AudioLayerHandle, AudioMood, RunningAudio } from "./types";
import { disconnectAfterEnded, disconnectAudioNodes, stopSources } from "./utils";
import type { SceneEnvironmentId } from "../sceneEnvironments";

export function startRainAmbience(audio: RunningAudio, mood: AudioMood, room: SceneEnvironmentId = DEFAULT_AUDIO_ROOM): AudioLayerHandle {
  const { context, channels } = audio;
  const settings = getAudioMoodDef(mood).ambience;
  const roomSettings = getRoomAmbienceDef(room);
  const registry: AudioNodeRegistry = { sources: [], nodes: [] };
  const timers: number[] = [];
  const pendingLoads: Array<() => void> = [];

  startRecordedLoop(audio, registry, pendingLoads, "rainThunder", {
    gain: settings.rainGain * roomSettings.rainGainScale,
    filter: settings.rainFilter * roomSettings.rainFilterScale,
    type: "bandpass",
    q: 0.62,
    fallbackDuration: 2.5,
    onFallback: scheduleThunder
  });

  startRecordedLoop(audio, registry, pendingLoads, "creekWater", {
    gain: settings.creekGain * roomSettings.creekGainScale,
    filter: settings.creekFilter * roomSettings.creekFilterScale,
    type: "bandpass",
    q: 0.28,
    fallbackDuration: 3.2,
    onFallback: scheduleCreekBurble
  });

  startRecordedLoop(audio, registry, pendingLoads, "fireCrackle", {
    gain: Math.max(settings.fireGain * roomSettings.fireGainScale, settings.fireCrackleGain * roomSettings.fireCrackleGainScale),
    filter: 760,
    type: "lowpass",
    q: 0.18,
    fallbackDuration: 2.1,
    onFallback: scheduleFireCrackle
  });

  addLoopingNoiseLayer(audio, registry, {
    gain: settings.hushGain * roomSettings.hushGainScale,
    filter: settings.hushFilter * roomSettings.hushFilterScale,
    type: "lowpass",
    q: 0.2,
    duration: 3
  });

  addLoopingNoiseLayer(audio, registry, {
    gain: roomSettings.airGain,
    filter: roomSettings.airFilter,
    type: roomSettings.airType,
    q: 0.42,
    duration: 3.4
  });

  addLoopingNoiseLayer(audio, registry, {
    gain: roomSettings.warmGain,
    filter: roomSettings.warmFilter,
    type: "lowpass",
    q: 0.24,
    duration: 4.1
  });

  const hum = context.createOscillator();
  hum.type = "sine";
  hum.frequency.value = Math.max(32, settings.humFrequency + roomSettings.humFrequencyOffset);
  const humGain = context.createGain();
  humGain.gain.value = settings.humGain * roomSettings.humGainScale;
  hum.connect(humGain);
  humGain.connect(channels.ambience);
  hum.start();
  registry.sources.push(hum);
  registry.nodes.push(hum, humGain);

  scheduleDrip();

  return {
    stop() {
      for (const cancelLoad of pendingLoads) cancelLoad();
      stopSources(registry.sources);
      for (const timer of timers) window.clearTimeout(timer);
      disconnectAudioNodes(...registry.nodes);
    }
  };

  function scheduleDrip() {
    const dripGain = settings.dripGain * roomSettings.dripGainScale;
    if (dripGain <= 0) return;
    const interval = settings.dripMs * roomSettings.dripMsScale;
    scheduleAccent(interval, () => {
      playWindowDrip(audio, dripGain);
      scheduleDrip();
    });
  }

  function scheduleCreekBurble() {
    const gain = settings.creekBurbleGain * roomSettings.creekBurbleGainScale;
    if (gain <= 0) return;
    const interval = settings.creekBurbleMs * roomSettings.creekBurbleMsScale;
    scheduleAccent(interval, () => {
      playCreekBurble(audio, gain);
      scheduleCreekBurble();
    });
  }

  function scheduleThunder() {
    const gain = settings.thunderGain * roomSettings.thunderGainScale;
    if (gain <= 0) return;
    const interval = settings.thunderMs * roomSettings.thunderMsScale;
    scheduleAccent(interval, () => {
      playLightThunder(audio, gain);
      scheduleThunder();
    });
  }

  function scheduleFireCrackle() {
    const gain = settings.fireCrackleGain * roomSettings.fireCrackleGainScale;
    if (gain <= 0) return;
    const interval = settings.fireCrackleMs * roomSettings.fireCrackleMsScale;
    scheduleAccent(interval, () => {
      playFireCrackle(audio, gain);
      scheduleFireCrackle();
    });
  }

  function scheduleAccent(intervalMs: number, play: () => void) {
    const jitter = Math.max(180, intervalMs * (0.62 + Math.random() * 0.76));
    timers.push(window.setTimeout(play, jitter));
  }
}

type AudioNodeRegistry = {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
};

type NoiseLayerOptions = {
  gain: number;
  filter: number;
  type: BiquadFilterType;
  q: number;
};

function startRecordedLoop(
  audio: RunningAudio,
  registry: AudioNodeRegistry,
  pendingLoads: Array<() => void>,
  id: AmbientAudioAssetId,
  options: NoiseLayerOptions & { fallbackDuration: number; onFallback?: () => void }
) {
  if (options.gain <= 0) return;
  let cancelled = false;
  pendingLoads.push(() => {
    cancelled = true;
  });

  void loadAmbientAudioBuffer(audio.context, id).then((buffer) => {
    if (cancelled) return;
    if (!buffer) {
      addLoopingNoiseLayer(audio, registry, { ...options, duration: options.fallbackDuration });
      options.onFallback?.();
      return;
    }

    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = audio.context.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.value = options.filter;
    filter.Q.value = options.q;
    const gain = audio.context.createGain();
    gain.gain.value = options.gain;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.channels.ambience);
    source.start();
    registry.sources.push(source);
    registry.nodes.push(source, filter, gain);
  });
}

function addLoopingNoiseLayer(
  audio: RunningAudio,
  registry: AudioNodeRegistry,
  options: NoiseLayerOptions & { duration: number }
) {
  if (options.gain <= 0) return;
  const source = audio.context.createBufferSource();
  source.buffer = createNoiseBuffer(audio.context, options.duration);
  source.loop = true;
  const filter = audio.context.createBiquadFilter();
  filter.type = options.type;
  filter.frequency.value = options.filter;
  filter.Q.value = options.q;
  const gain = audio.context.createGain();
  gain.gain.value = options.gain;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.channels.ambience);
  source.start();
  registry.sources.push(source);
  registry.nodes.push(source, filter, gain);
}

function playWindowDrip(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  [880, 660].forEach((frequency, index) => {
    playAccentTone(audio, now + index * 0.035, {
      frequency,
      endFrequency: frequency * 0.82,
      gain: gainValue / (index + 1.4),
      duration: 0.24,
      type: "sine"
    });
  });
}

function playCreekBurble(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  playAccentNoise(audio, now, {
    duration: 0.24,
    gain: gainValue * 0.74,
    filter: 620,
    type: "bandpass",
    q: 0.32
  });
  playAccentTone(audio, now + 0.03, {
    frequency: 420,
    endFrequency: 560,
    gain: gainValue * 0.62,
    duration: 0.16,
    type: "sine"
  });
  playAccentTone(audio, now + 0.11, {
    frequency: 690,
    endFrequency: 520,
    gain: gainValue * 0.42,
    duration: 0.14,
    type: "triangle"
  });
}

function playLightThunder(audio: RunningAudio, gainValue: number) {
  const { context, channels } = audio;
  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, 1.9);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(180, now);
  filter.frequency.exponentialRampToValueAtTime(64, now + 1.55);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(channels.ambience);
  disconnectAfterEnded(source, filter, gain);
  source.start(now);
  source.stop(now + 1.9);

  playAccentTone(audio, now + 0.04, {
    frequency: 48,
    endFrequency: 34,
    gain: gainValue * 0.38,
    duration: 1.55,
    type: "sine",
    attack: 0.18,
    release: 1.1
  });
}

function playFireCrackle(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  const hits = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < hits; i++) {
    playAccentNoise(audio, now + i * (0.028 + Math.random() * 0.018), {
      duration: 0.035 + Math.random() * 0.04,
      gain: gainValue * (1 - i * 0.12),
      filter: 1450 + Math.random() * 1600,
      type: Math.random() > 0.45 ? "bandpass" : "highpass",
      q: 0.58 + Math.random() * 0.32
    });
  }
}

function playAccentTone(
  audio: RunningAudio,
  time: number,
  options: {
    frequency: number;
    endFrequency: number;
    gain: number;
    duration: number;
    type: OscillatorType;
    attack?: number;
    release?: number;
  }
) {
  const { context, channels } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, time + options.duration);
  const gain = context.createGain();
  const attack = options.attack ?? 0.018;
  const release = options.release ?? 0;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(options.gain, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + options.duration + release);
  oscillator.connect(gain);
  gain.connect(channels.ambience);
  disconnectAfterEnded(oscillator, gain);
  oscillator.start(time);
  oscillator.stop(time + options.duration + release + 0.02);
}

function playAccentNoise(
  audio: RunningAudio,
  time: number,
  options: { duration: number; gain: number; filter: number; type: BiquadFilterType; q: number }
) {
  const { context, channels } = audio;
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, options.duration);
  const filter = context.createBiquadFilter();
  filter.type = options.type;
  filter.frequency.value = options.filter;
  filter.Q.value = options.q;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(options.gain, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + options.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(channels.ambience);
  disconnectAfterEnded(source, filter, gain);
  source.start(time);
  source.stop(time + options.duration + 0.01);
}
