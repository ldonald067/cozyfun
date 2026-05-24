import { createDustBuffer, createNoiseBuffer } from "./buffers";
import { getAudioMoodDef } from "./moods";
import type { AudioLayerHandle, AudioMood, AudioMoodDef, RunningAudio } from "./types";
import { stopSources } from "./utils";

export function startRainLofiMusic(audio: RunningAudio, mood: AudioMood): AudioLayerHandle {
  const { context, channels } = audio;
  const settings = getAudioMoodDef(mood).music;
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
  vinylGain.gain.value = settings.vinylGain;
  vinyl.connect(vinylFilter);
  vinylFilter.connect(vinylGain);
  vinylGain.connect(channels.music);
  vinyl.start();
  sources.push(vinyl);

  const scheduleStep = () => {
    playLofiStep(audio, settings, step);
    step++;
  };
  scheduleStep();
  timers.push(window.setInterval(scheduleStep, settings.stepMs));

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

function playLofiStep(audio: RunningAudio, settings: AudioMoodDef["music"], step: number) {
  const now = audio.context.currentTime;
  if (step % 8 === 0) {
    playSoftChord(audio, settings, settings.progression[(step / 8) % settings.progression.length], now);
    playLowThump(audio, settings, now);
  }
  if (settings.brushGain > 0 && step % 2 === 1) playBrushHat(audio, settings, now);
  if (settings.brushGain > 0 && step % 8 === 4) playBrushSnare(audio, settings, now);
  if (settings.sparkle && step % 6 === 3) playSparkle(audio, now);
}

function playSoftChord(audio: RunningAudio, settings: AudioMoodDef["music"], frequencies: number[], time: number) {
  const { context, channels } = audio;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(settings.chordFilterStart, time);
  filter.frequency.exponentialRampToValueAtTime(settings.chordFilterEnd, time + 1.6);
  const chordGain = context.createGain();
  chordGain.gain.setValueAtTime(0.0001, time);
  chordGain.gain.exponentialRampToValueAtTime(settings.chordGain, time + 0.045);
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

function playBrushHat(audio: RunningAudio, settings: AudioMoodDef["music"], time: number) {
  playMusicNoise(audio, { time, duration: 0.045, gain: settings.brushGain * 0.8, filter: 5200, type: "highpass" });
}

function playBrushSnare(audio: RunningAudio, settings: AudioMoodDef["music"], time: number) {
  playMusicNoise(audio, { time, duration: 0.11, gain: settings.brushGain, filter: 1900, type: "bandpass" });
}

function playLowThump(audio: RunningAudio, settings: AudioMoodDef["music"], time: number) {
  if (settings.thumpGain <= 0) return;
  const { context, channels } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(82, time);
  oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.16);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(settings.thumpGain, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(gain);
  gain.connect(channels.music);
  oscillator.start(time);
  oscillator.stop(time + 0.24);
}

function playSparkle(audio: RunningAudio, time: number) {
  const { context, channels } = audio;
  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    const offset = index * 0.04;
    gain.gain.setValueAtTime(0.0001, time + offset);
    gain.gain.exponentialRampToValueAtTime(0.008, time + offset + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.36);
    oscillator.connect(gain);
    gain.connect(channels.music);
    oscillator.start(time + offset);
    oscillator.stop(time + offset + 0.38);
  });
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
