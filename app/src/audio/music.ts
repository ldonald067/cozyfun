import { createDustBuffer, createNoiseBuffer } from "./buffers";
import { getAudioMoodDef } from "./moods";
import type { AudioLayerHandle, AudioMood, AudioMoodDef, RunningAudio } from "./types";
import { disconnectAfterEnded, disconnectAudioNodes, stopSources } from "./utils";

type MusicSettings = AudioMoodDef["music"];

type MusicBus = {
  input: GainNode;
  nodes: AudioNode[];
};

const MELODY_PHRASES = [
  [-1, 2, -1, 3, 4, -1, 3, -1, -1, 2, 1, -1, 2, -1, -1, -1],
  [-1, -1, 3, -1, 4, 3, -1, 2, -1, -1, 1, -1, 2, 3, -1, -1],
  [-1, 2, -1, -1, 3, -1, 4, -1, 3, -1, 2, -1, -1, 1, -1, -1],
  [-1, -1, 4, 3, -1, 2, -1, -1, -1, 3, -1, 2, 1, -1, -1, -1]
];

export function startRainLofiMusic(audio: RunningAudio, mood: AudioMood): AudioLayerHandle {
  const { context, channels } = audio;
  const settings = getAudioMoodDef(mood).music;
  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const bus = createMusicBus(context, channels.music);
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
  vinylGain.connect(bus.input);
  vinyl.start();
  sources.push(vinyl);

  const scheduleStep = () => {
    playLofiStep(audio, bus.input, settings, step);
    step++;
  };
  scheduleStep();
  timers.push(window.setInterval(scheduleStep, settings.stepMs));

  return {
    stop() {
      stopSources(sources);
      for (const timer of timers) window.clearInterval(timer);
      disconnectAudioNodes(vinyl, vinylFilter, vinylGain, bus.input, ...bus.nodes);
    }
  };
}

function createMusicBus(context: AudioContext, output: AudioNode): MusicBus {
  const input = context.createGain();
  input.gain.value = 0.9;

  const tone = context.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3400;
  tone.Q.value = 0.25;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -30;
  compressor.knee.value = 18;
  compressor.ratio.value = 2.4;
  compressor.attack.value = 0.018;
  compressor.release.value = 0.32;

  const delay = context.createDelay(1);
  delay.delayTime.value = 0.28;
  const feedback = context.createGain();
  feedback.gain.value = 0.16;
  const delayWet = context.createGain();
  delayWet.gain.value = 0.11;

  input.connect(tone);
  tone.connect(compressor);
  compressor.connect(output);
  tone.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(output);

  return { input, nodes: [tone, compressor, delay, feedback, delayWet] };
}

function playLofiStep(audio: RunningAudio, output: AudioNode, settings: MusicSettings, step: number) {
  const swingDelay = step % 2 === 1 ? (settings.stepMs / 1000) * settings.swing : 0.012;
  const time = audio.context.currentTime + swingDelay;
  const barStep = step % 8;
  const chordIndex = Math.floor(step / 8) % settings.progression.length;
  const chord = settings.progression[chordIndex];
  const nextChord = settings.progression[(chordIndex + 1) % settings.progression.length];

  if (barStep === 0) playSoftChord(audio, output, settings, chord, time, 1, 3.15);
  if (barStep === 3 && step % 16 === 3) playSoftChord(audio, output, settings, chord, time, 0.24, 0.82);
  if (barStep === 5) playSoftChord(audio, output, settings, chord, time, 0.46, 1.45);
  if (barStep === 7 && step % 32 === 31) playSoftChord(audio, output, settings, nextChord, time, 0.22, 0.74);

  if (barStep % 2 === 0) playWalkingBass(audio, output, settings, chord, nextChord, barStep, time);
  if (barStep === 0) playLowThump(audio, output, settings, time, 1);
  if (barStep === 6) playLowThump(audio, output, settings, time, 0.4);

  if (settings.brushGain > 0) {
    playBrushHat(audio, output, settings, time, step % 2 === 0 ? 0.45 : 0.85);
    if (barStep === 4) playBrushSnare(audio, output, settings, time, 1);
    if (barStep === 7) playBrushSnare(audio, output, settings, time, 0.32);
    if (settings.fillGain > 0 && step % 32 === 30) playBrushFill(audio, output, settings, time);
  }

  playMelody(audio, output, settings, chord, step, time);
  if (settings.sparkle && step % 12 === 7) playSparkle(audio, output, time);
}

function playSoftChord(
  audio: RunningAudio,
  output: AudioNode,
  settings: MusicSettings,
  frequencies: number[],
  time: number,
  gainScale: number,
  duration: number
) {
  if (frequencies.length === 0) return;
  const { context } = audio;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(settings.chordFilterStart, time);
  filter.frequency.exponentialRampToValueAtTime(settings.chordFilterEnd, time + Math.min(1.6, duration * 0.7));
  const chordGain = context.createGain();
  chordGain.gain.setValueAtTime(0.0001, time);
  chordGain.gain.exponentialRampToValueAtTime(settings.chordGain * gainScale, time + 0.045);
  chordGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  filter.connect(chordGain);
  chordGain.connect(output);

  const oscillators = frequencies.map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index % 2 === 0 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index * 2 - 4;
    oscillator.connect(filter);
    oscillator.start(time + index * 0.015);
    oscillator.stop(time + duration + 0.08);
    return oscillator;
  });
  const finalOscillator = oscillators[oscillators.length - 1];
  if (finalOscillator) disconnectAfterEnded(finalOscillator, filter, chordGain, ...oscillators.slice(0, -1));
  playChordTexture(audio, output, settings, frequencies, time, duration, gainScale);
}

function playChordTexture(
  audio: RunningAudio,
  output: AudioNode,
  settings: MusicSettings,
  frequencies: number[],
  time: number,
  duration: number,
  gainScale: number
) {
  if (settings.textureGain <= 0) return;
  const { context } = audio;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1260;
  filter.Q.value = 0.65;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time + 0.025);
  gain.gain.exponentialRampToValueAtTime(settings.textureGain * gainScale, time + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(duration + 0.16, 3.4));
  filter.connect(gain);
  gain.connect(output);

  const shimmer = frequencies.slice(0, 3).map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * 2;
    oscillator.detune.value = index * 3 - 3;
    oscillator.connect(filter);
    oscillator.start(time + 0.02 + index * 0.018);
    oscillator.stop(time + duration + 0.2);
    return oscillator;
  });
  const finalOscillator = shimmer[shimmer.length - 1];
  if (finalOscillator) disconnectAfterEnded(finalOscillator, filter, gain, ...shimmer.slice(0, -1));
}

function playWalkingBass(
  audio: RunningAudio,
  output: AudioNode,
  settings: MusicSettings,
  chord: number[],
  nextChord: number[],
  barStep: number,
  time: number
) {
  if (settings.bassGain <= 0) return;
  const root = bassRegister(chord[0]);
  const nextRoot = bassRegister(nextChord[0]);
  const frequency =
    barStep === 2
      ? bassRegister(chord[1] ?? root * 1.5)
      : barStep === 4
        ? bassRegister(chord[2] ?? root * 1.25)
        : barStep === 6
          ? approachNote(root, nextRoot)
          : root;
  playBassNote(audio, output, settings, frequency, time);
}

function playBassNote(audio: RunningAudio, output: AudioNode, settings: MusicSettings, frequency: number, time: number) {
  const { context } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, time + 0.22);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 520;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(settings.bassGain, time + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.46);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  disconnectAfterEnded(oscillator, filter, gain);
  oscillator.start(time);
  oscillator.stop(time + 0.5);
}

function playMelody(audio: RunningAudio, output: AudioNode, settings: MusicSettings, chord: number[], step: number, time: number) {
  if (settings.melodyGain <= 0) return;
  const phrase = MELODY_PHRASES[Math.floor(step / 16) % MELODY_PHRASES.length];
  const noteIndex = phrase[step % phrase.length];
  if (noteIndex < 0) return;
  playMelodyNote(audio, output, melodyFrequency(chord, noteIndex), settings.melodyGain, time);
}

function playMelodyNote(audio: RunningAudio, output: AudioNode, frequency: number, gainValue: number, time: number) {
  const { context } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  oscillator.detune.value = Math.sin(time * 1.7) * 4;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.028);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.52);
  oscillator.connect(gain);
  gain.connect(output);
  disconnectAfterEnded(oscillator, gain);
  oscillator.start(time);
  oscillator.stop(time + 0.58);
}

function playBrushHat(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  playMusicNoise(audio, output, { time, duration: 0.042, gain: settings.brushGain * gainScale, filter: 5600, type: "highpass" });
}

function playBrushSnare(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  playMusicNoise(audio, output, { time, duration: 0.12, gain: settings.brushGain * gainScale, filter: 1850, type: "bandpass" });
}

function playBrushFill(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number) {
  for (let i = 0; i < 4; i++) {
    playMusicNoise(audio, output, {
      time: time + i * 0.055,
      duration: 0.06,
      gain: settings.fillGain * (1 - i * 0.12),
      filter: 2100 + i * 240,
      type: i % 2 === 0 ? "bandpass" : "highpass"
    });
  }
}

function playLowThump(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  if (settings.thumpGain <= 0) return;
  const { context } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(82, time);
  oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.16);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(settings.thumpGain * gainScale, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(gain);
  gain.connect(output);
  disconnectAfterEnded(oscillator, gain);
  oscillator.start(time);
  oscillator.stop(time + 0.24);
}

function playSparkle(audio: RunningAudio, output: AudioNode, time: number) {
  const { context } = audio;
  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    const offset = index * 0.04;
    gain.gain.setValueAtTime(0.0001, time + offset);
    gain.gain.exponentialRampToValueAtTime(0.006, time + offset + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.36);
    oscillator.connect(gain);
    gain.connect(output);
    disconnectAfterEnded(oscillator, gain);
    oscillator.start(time + offset);
    oscillator.stop(time + offset + 0.38);
  });
}

function playMusicNoise(
  audio: RunningAudio,
  output: AudioNode,
  options: { time: number; duration: number; gain: number; filter: number; type: BiquadFilterType }
) {
  const { context } = audio;
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
  gain.connect(output);
  disconnectAfterEnded(source, filter, gain);
  source.start(options.time);
  source.stop(options.time + options.duration + 0.01);
}

function bassRegister(frequency: number) {
  let note = frequency;
  while (note > 120) note /= 2;
  while (note < 52) note *= 2;
  return note;
}

function approachNote(current: number, next: number) {
  const semitone = Math.pow(2, 1 / 12);
  return bassRegister(next > current ? next / semitone : next * semitone);
}

function melodyFrequency(chord: number[], noteIndex: number) {
  let frequency = chord[Math.min(noteIndex, chord.length - 1)] ?? chord[0] * 2;
  while (frequency < 240) frequency *= 2;
  while (frequency > 760) frequency /= 2;
  return frequency;
}
