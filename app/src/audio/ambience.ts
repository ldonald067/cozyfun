import { createNoiseBuffer } from "./buffers";
import { getAudioMoodDef } from "./moods";
import { DEFAULT_AUDIO_ROOM, getRoomAmbienceDef, type RoomAmbienceDef } from "./rooms";
import type { AudioLayerHandle, AudioMood, RunningAudio } from "./types";
import { disconnectAfterEnded, disconnectAudioNodes, stopSources } from "./utils";
import type { SceneEnvironmentId } from "../sceneEnvironments";

export function startRainAmbience(audio: RunningAudio, mood: AudioMood, room: SceneEnvironmentId = DEFAULT_AUDIO_ROOM): AudioLayerHandle {
  const { context, channels } = audio;
  const settings = getAudioMoodDef(mood).ambience;
  const roomSettings = getRoomAmbienceDef(room);
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const timers: number[] = [];

  const rain = context.createBufferSource();
  rain.buffer = createNoiseBuffer(context, 2.5);
  rain.loop = true;
  const rainFilter = context.createBiquadFilter();
  rainFilter.type = "bandpass";
  rainFilter.frequency.value = settings.rainFilter * roomSettings.rainFilterScale;
  rainFilter.Q.value = 0.65;
  const rainGain = context.createGain();
  rainGain.gain.value = settings.rainGain * roomSettings.rainGainScale;
  rain.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(channels.ambience);
  nodes.push(rain, rainFilter, rainGain);

  const hush = context.createBufferSource();
  hush.buffer = createNoiseBuffer(context, 3);
  hush.loop = true;
  const hushFilter = context.createBiquadFilter();
  hushFilter.type = "lowpass";
  hushFilter.frequency.value = settings.hushFilter * roomSettings.hushFilterScale;
  const hushGain = context.createGain();
  hushGain.gain.value = settings.hushGain * roomSettings.hushGainScale;
  hush.connect(hushFilter);
  hushFilter.connect(hushGain);
  hushGain.connect(channels.ambience);
  nodes.push(hush, hushFilter, hushGain);

  const hum = context.createOscillator();
  hum.type = "sine";
  hum.frequency.value = Math.max(32, settings.humFrequency + roomSettings.humFrequencyOffset);
  const humGain = context.createGain();
  humGain.gain.value = settings.humGain * roomSettings.humGainScale;
  hum.connect(humGain);
  humGain.connect(channels.ambience);
  nodes.push(hum, humGain);

  addNoiseLayer(audio, sources, nodes, {
    gain: roomSettings.airGain,
    filter: roomSettings.airFilter,
    type: roomSettings.airType,
    q: 0.42,
    duration: 3.4
  });
  addNoiseLayer(audio, sources, nodes, {
    gain: roomSettings.warmGain,
    filter: roomSettings.warmFilter,
    type: "lowpass",
    q: 0.24,
    duration: 4.1
  });

  rain.start();
  hush.start();
  hum.start();
  sources.push(rain, hush, hum);
  scheduleDrip();
  scheduleAccent(roomSettings.gardenTickGain, roomSettings.gardenTickMs, () => playGardenTick(audio, roomSettings.gardenTickGain));
  scheduleAccent(roomSettings.starChimeGain, roomSettings.starChimeMs, () => playStarChime(audio, roomSettings.starChimeGain));
  scheduleAccent(roomSettings.warmCrackleGain, roomSettings.warmCrackleMs, () => playWarmCrackle(audio, roomSettings.warmCrackleGain));
  scheduleAccent(roomSettings.branchRustleGain, roomSettings.branchRustleMs, () => playBranchRustle(audio, roomSettings.branchRustleGain));
  scheduleAccent(roomSettings.snowTickGain, roomSettings.snowTickMs, () => playSnowTick(audio, roomSettings.snowTickGain));

  return {
    stop() {
      stopSources(sources);
      for (const timer of timers) window.clearTimeout(timer);
      disconnectAudioNodes(...nodes);
    }
  };

  function scheduleDrip() {
    const dripGain = settings.dripGain * roomSettings.dripGainScale;
    if (dripGain <= 0) return;
    const jitter = settings.dripMs * roomSettings.dripMsScale * (0.72 + Math.random() * 0.56);
    timers.push(
      window.setTimeout(() => {
        playWindowDrip(audio, dripGain);
        scheduleDrip();
      }, jitter)
    );
  }

  function scheduleAccent(gain: number, intervalMs: number, play: () => void) {
    if (gain <= 0 || intervalMs <= 0) return;
    const jitter = intervalMs * (0.65 + Math.random() * 0.7);
    timers.push(
      window.setTimeout(() => {
        play();
        scheduleAccent(gain, intervalMs, play);
      }, jitter)
    );
  }
}

function addNoiseLayer(
  audio: RunningAudio,
  sources: AudioScheduledSourceNode[],
  nodes: AudioNode[],
  options: { gain: number; filter: number; type: BiquadFilterType; q: number; duration: number }
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
  sources.push(source);
  nodes.push(source, filter, gain);
}

function playWindowDrip(audio: RunningAudio, gainValue: number) {
  const { context, channels } = audio;
  const now = context.currentTime;
  [880, 660].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.035);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.82, now + 0.18 + index * 0.035);
    const gain = context.createGain();
    const start = now + index * 0.035;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue / (index + 1.4), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    oscillator.connect(gain);
    gain.connect(channels.ambience);
    disconnectAfterEnded(oscillator, gain);
    oscillator.start(start);
    oscillator.stop(start + 0.26);
  });
}

function playGardenTick(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  playAccentTone(audio, now, 920, 1260, gainValue, 0.18);
  playAccentTone(audio, now + 0.07, 1240, 980, gainValue * 0.54, 0.14);
}

function playStarChime(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  playAccentTone(audio, now, 1040, 1560, gainValue, 0.42);
  playAccentTone(audio, now + 0.09, 1320, 990, gainValue * 0.58, 0.36);
}

function playWarmCrackle(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  for (let i = 0; i < 3; i++) {
    playAccentNoise(audio, now + i * 0.035, {
      duration: 0.045,
      gain: gainValue * (1 - i * 0.16),
      filter: 1800 + i * 340,
      type: i % 2 === 0 ? "bandpass" : "highpass",
      q: 0.7
    });
  }
}

function playBranchRustle(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  playAccentNoise(audio, now, {
    duration: 0.36,
    gain: gainValue,
    filter: 920,
    type: "bandpass",
    q: 0.36
  });
}

function playSnowTick(audio: RunningAudio, gainValue: number) {
  const now = audio.context.currentTime;
  playAccentTone(audio, now, 720, 620, gainValue, 0.22);
  playAccentNoise(audio, now + 0.035, {
    duration: 0.11,
    gain: gainValue * 0.42,
    filter: 2600,
    type: "bandpass",
    q: 0.42
  });
}

function playAccentTone(audio: RunningAudio, time: number, frequency: number, endFrequency: number, gainValue: number, duration: number) {
  const { context, channels } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(gain);
  gain.connect(channels.ambience);
  disconnectAfterEnded(oscillator, gain);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.02);
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
