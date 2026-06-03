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
  [-1, -1, 4, 3, -1, 2, -1, -1, -1, 3, -1, 2, 1, -1, -1, -1],
  [-1, 1, -1, -1, 3, -1, 2, -1, 4, -1, -1, 3, -1, 2, -1, -1],
  [-1, -1, 2, 3, -1, -1, 4, -1, -1, 3, -1, -1, 2, 1, -1, -1],
  [-1, 3, -1, 4, -1, 3, -1, -1, 2, -1, 1, -1, -1, 2, -1, -1],
  [-1, -1, -1, 2, -1, 4, 3, -1, -1, 1, -1, 2, -1, -1, 3, -1]
];

const SEMITONE = Math.pow(2, 1 / 12);

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
    playLofiStep(audio, bus.input, settings, step, mood);
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

function playLofiStep(audio: RunningAudio, output: AudioNode, settings: MusicSettings, step: number, mood: AudioMood) {
  const swingDelay = step % 2 === 1 ? (settings.stepMs / 1000) * settings.swing : 0.012;
  const time = audio.context.currentTime + swingDelay;
  const barStep = step % 8;
  const bar = Math.floor(step / 8);
  const phrase = Math.floor(step / 16);
  const seed = moodSeed(mood);
  const chordIndex = Math.floor(step / 8) % settings.progression.length;
  const chord = settings.progression[chordIndex];
  const nextChord = settings.progression[(chordIndex + 1) % settings.progression.length];
  const chordAccent = 0.92 + stepRandom(step, seed + 1) * 0.16;

  if (barStep === 0) playSoftChord(audio, output, settings, chord, time, chordAccent, 3.15);
  if (barStep === 2 && settings.colorGain > 0 && stepRandom(bar, seed + 2) > 0.52) {
    playColorAnswer(audio, output, settings, chord, nextChord, step, time + 0.018, 0.72);
  }
  if (barStep === 3 && step % 16 === 3) playSoftChord(audio, output, settings, colorVoicing(chord, nextChord, step), time, 0.24, 0.82);
  if (barStep === 5) playSoftChord(audio, output, settings, colorVoicing(chord, nextChord, step), time, 0.44 + settings.colorGain * 0.08, 1.45);
  if (barStep === 6 && settings.colorGain > 0 && phrase % 3 === 1) {
    playColorAnswer(audio, output, settings, nextChord, chord, step, time + 0.035, 0.54);
  }
  if (barStep === 7 && step % 32 === 31) playSoftChord(audio, output, settings, nextChord, time, 0.22, 0.74);

  if (barStep % 2 === 0) playWalkingBass(audio, output, settings, chord, nextChord, barStep, time);
  if (barStep === 7 && settings.grooveGain > 0 && bar % 4 !== 0) playBassPickup(audio, output, settings, chord, nextChord, time);
  if (barStep === 0) playLowThump(audio, output, settings, time, 1);
  if (barStep === 2 && settings.grooveGain > 0 && (bar % 4 === 1 || stepRandom(bar, seed + 3) > 0.66)) {
    playLowThump(audio, output, settings, time + 0.018, 0.24 * settings.grooveGain, 70);
  }
  if (barStep === 6) playLowThump(audio, output, settings, time, 0.4);
  if (barStep === 7 && settings.grooveGain > 0 && bar % 8 === 3) {
    playLowThump(audio, output, settings, time + 0.025, 0.18 * settings.grooveGain, 62);
  }

  if (settings.brushGain > 0) {
    const hatAccent = step % 2 === 0 ? 0.42 : 0.82 + settings.grooveGain * 0.1;
    playBrushHat(audio, output, settings, time, hatAccent);
    if (settings.grooveGain > 0 && barStep === 1 && stepRandom(bar, seed + 4) > 0.42) playRimClick(audio, output, settings, time, 0.72);
    if (settings.grooveGain > 0 && barStep === 3 && stepRandom(step, seed + 5) > 0.72) playGhostSnare(audio, output, settings, time + 0.015, 0.48);
    if (barStep === 4) playBrushSnare(audio, output, settings, time, 1);
    if (settings.grooveGain > 0 && barStep === 5 && stepRandom(bar, seed + 6) > 0.58) playRimClick(audio, output, settings, time, 0.48);
    if (settings.grooveGain > 0 && barStep === 6 && stepRandom(step, seed + 7) > 0.74) playGhostSnare(audio, output, settings, time, 0.32);
    if (barStep === 7) playBrushSnare(audio, output, settings, time, 0.32);
    if (settings.fillGain > 0 && step % 32 === 30) playBrushFill(audio, output, settings, time, settings.grooveGain > 0.65 ? 6 : 4);
    if (settings.grooveGain > 0 && barStep === 7 && bar % 8 === 7) playOpenBrush(audio, output, settings, time + 0.035, 0.42);
  }

  playMelody(audio, output, settings, chord, nextChord, step, time, seed);
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

function playColorAnswer(
  audio: RunningAudio,
  output: AudioNode,
  settings: MusicSettings,
  chord: number[],
  nextChord: number[],
  step: number,
  time: number,
  gainScale: number
) {
  const notes = colorVoicing(chord, nextChord, step).slice(2, 5);
  if (notes.length === 0) return;
  const { context } = audio;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2100;
  filter.Q.value = 0.28;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(settings.colorGain * 0.007 * gainScale, time + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.64);
  filter.connect(gain);
  gain.connect(output);

  const oscillators = notes.map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index % 2 === 0 ? "triangle" : "sine";
    oscillator.frequency.value = liftToLeadRegister(frequency);
    oscillator.detune.setValueAtTime(index * 3 - 5, time);
    oscillator.detune.linearRampToValueAtTime(index * -2 + 4, time + 0.5);
    oscillator.connect(filter);
    oscillator.start(time + index * 0.021);
    oscillator.stop(time + 0.72);
    return oscillator;
  });
  const finalOscillator = oscillators[oscillators.length - 1];
  if (finalOscillator) disconnectAfterEnded(finalOscillator, filter, gain, ...oscillators.slice(0, -1));
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

function playBassPickup(
  audio: RunningAudio,
  output: AudioNode,
  settings: MusicSettings,
  chord: number[],
  nextChord: number[],
  time: number
) {
  const current = bassRegister(chord[0]);
  const next = bassRegister(nextChord[0]);
  const approach = approachNote(current, next);
  playBassNote(audio, output, settings, approach, time + 0.02, 0.42 * settings.grooveGain, 0.28);
}

function playBassNote(
  audio: RunningAudio,
  output: AudioNode,
  settings: MusicSettings,
  frequency: number,
  time: number,
  gainScale = 1,
  duration = 0.5
) {
  const { context } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, time + Math.min(0.22, duration * 0.5));
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 520;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(settings.bassGain * gainScale, time + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.92);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  disconnectAfterEnded(oscillator, filter, gain);
  oscillator.start(time);
  oscillator.stop(time + duration);
}

function playMelody(
  audio: RunningAudio,
  output: AudioNode,
  settings: MusicSettings,
  chord: number[],
  nextChord: number[],
  step: number,
  time: number,
  seed: number
) {
  if (settings.melodyGain <= 0) return;
  const phraseIndex = (Math.floor(step / 16) + Math.floor(step / 64) + Math.floor(stepRandom(Math.floor(step / 16), seed + 8) * 3)) % MELODY_PHRASES.length;
  const phrase = MELODY_PHRASES[phraseIndex];
  const noteIndex = phrase[step % phrase.length];
  if (noteIndex < 0) return;
  if (settings.phraseGain > 0 && stepRandom(step, seed + 9) > 0.88 - settings.phraseGain * 0.18) return;
  const gainScale = 0.82 + stepRandom(step, seed + 10) * 0.26;
  const frequency = melodyFrequency(chord, noteIndex);
  playMelodyNote(audio, output, frequency, settings.melodyGain * gainScale, time, 0.5 + settings.phraseGain * 0.14);
  if (settings.phraseGain > 0 && step % 8 >= 5 && stepRandom(step, seed + 11) > 0.72) {
    const answerIndex = Math.max(1, noteIndex - (stepRandom(step, seed + 12) > 0.5 ? 1 : 2));
    playMelodyNote(audio, output, melodyFrequency(nextChord, answerIndex), settings.melodyGain * settings.phraseGain * 0.58, time + 0.18, 0.34);
  }
  if (settings.phraseGain > 0.65 && stepRandom(step, seed + 13) > 0.84) {
    playMelodyNote(audio, output, frequency / SEMITONE, settings.melodyGain * 0.28, time + 0.038, 0.24);
  }
}

function playMelodyNote(audio: RunningAudio, output: AudioNode, frequency: number, gainValue: number, time: number, duration = 0.52) {
  const { context } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  oscillator.detune.value = Math.sin(time * 1.7) * 4;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2450;
  filter.Q.value = 0.2;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.028);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  disconnectAfterEnded(oscillator, filter, gain);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.06);
}

function playBrushHat(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  playMusicNoise(audio, output, { time, duration: 0.042, gain: settings.brushGain * gainScale, filter: 5600, type: "highpass" });
}

function playBrushSnare(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  playMusicNoise(audio, output, { time, duration: 0.12, gain: settings.brushGain * gainScale, filter: 1850, type: "bandpass" });
}

function playGhostSnare(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  playMusicNoise(audio, output, {
    time,
    duration: 0.065,
    gain: settings.brushGain * settings.grooveGain * gainScale,
    filter: 1450,
    type: "bandpass"
  });
}

function playRimClick(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  playMusicNoise(audio, output, {
    time,
    duration: 0.028,
    gain: settings.brushGain * settings.grooveGain * gainScale * 0.72,
    filter: 3200,
    type: "bandpass"
  });
  playClickTone(audio, output, time, settings.brushGain * settings.grooveGain * gainScale * 0.18);
}

function playOpenBrush(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number) {
  playMusicNoise(audio, output, {
    time,
    duration: 0.11,
    gain: settings.brushGain * settings.grooveGain * gainScale,
    filter: 5200,
    type: "highpass"
  });
}

function playBrushFill(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, hits: number) {
  for (let i = 0; i < hits; i++) {
    playMusicNoise(audio, output, {
      time: time + i * 0.046,
      duration: 0.052,
      gain: settings.fillGain * (1 - i * 0.08),
      filter: 2100 + i * 210,
      type: i % 2 === 0 ? "bandpass" : "highpass"
    });
  }
}

function playLowThump(audio: RunningAudio, output: AudioNode, settings: MusicSettings, time: number, gainScale: number, startFrequency = 82) {
  if (settings.thumpGain <= 0) return;
  const { context } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(startFrequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(42, startFrequency * 0.58), time + 0.16);
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

function playClickTone(audio: RunningAudio, output: AudioNode, time: number, gainValue: number) {
  if (gainValue <= 0) return;
  const { context } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.value = 760;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
  oscillator.connect(gain);
  gain.connect(output);
  disconnectAfterEnded(oscillator, gain);
  oscillator.start(time);
  oscillator.stop(time + 0.055);
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

function colorVoicing(chord: number[], nextChord: number[], step: number) {
  if (chord.length < 3) return chord;
  const root = chord[0];
  const upper = chord.slice(1);
  const neighbor = nextChord[(step % Math.max(1, nextChord.length - 1)) + 1] ?? nextChord[0] * 2;
  const color = step % 16 >= 8 ? neighbor : (chord[2] ?? root) * SEMITONE;
  return [root, ...upper.slice(0, 3), liftToLeadRegister(color), ...(upper[3] ? [upper[3]] : [])];
}

function liftToLeadRegister(frequency: number) {
  let note = frequency;
  while (note < 360) note *= 2;
  while (note > 980) note /= 2;
  return note;
}

function moodSeed(mood: AudioMood) {
  let seed = 2166136261;
  for (let i = 0; i < mood.length; i++) {
    seed ^= mood.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function stepRandom(step: number, salt: number) {
  let value = Math.imul(step + 0x9e3779b9, 0x85ebca6b) ^ salt;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
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
