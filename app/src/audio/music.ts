import { createDustBuffer, createNoiseBuffer } from "./buffers";
import type { AudioLayerHandle, RunningAudio } from "./types";
import { stopSources } from "./utils";

type LofiChord = number[];

const RAIN_LOFI_PROGRESSION: LofiChord[] = [
  [146.83, 220, 261.63, 329.63],
  [196, 246.94, 329.63, 440],
  [130.81, 196, 246.94, 293.66],
  [110, 196, 261.63, 329.63]
];

export function startRainLofiMusic(audio: RunningAudio): AudioLayerHandle {
  const { context, channels } = audio;
  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  let step = 0;

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
  sources.push(vinyl);

  const scheduleStep = () => {
    playLofiStep(audio, step);
    step++;
  };
  scheduleStep();
  timers.push(window.setInterval(scheduleStep, 720));

  return {
    stop() {
      stopSources(sources);
      for (const timer of timers) window.clearInterval(timer);
      vinyl.disconnect();
      vinylFilter.disconnect();
      vinylGain.disconnect();
    }
  };
}

function playLofiStep(audio: RunningAudio, step: number) {
  const now = audio.context.currentTime;
  if (step % 8 === 0) {
    playSoftChord(audio, RAIN_LOFI_PROGRESSION[(step / 8) % RAIN_LOFI_PROGRESSION.length], now);
    playLowThump(audio, now);
  }
  if (step % 2 === 1) playBrushHat(audio, now);
  if (step % 8 === 4) playBrushSnare(audio, now);
}

function playSoftChord(audio: RunningAudio, frequencies: number[], time: number) {
  const { context, channels } = audio;
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

function playBrushHat(audio: RunningAudio, time: number) {
  playMusicNoise(audio, { time, duration: 0.045, gain: 0.008, filter: 5200, type: "highpass" });
}

function playBrushSnare(audio: RunningAudio, time: number) {
  playMusicNoise(audio, { time, duration: 0.11, gain: 0.011, filter: 1900, type: "bandpass" });
}

function playLowThump(audio: RunningAudio, time: number) {
  const { context, channels } = audio;
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

function playMusicNoise(
  audio: RunningAudio,
  options: { time: number; duration: number; gain: number; filter: number; type: BiquadFilterType }
) {
  const { context, channels } = audio;
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
