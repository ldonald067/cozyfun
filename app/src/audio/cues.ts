import { createNoiseBuffer } from "./buffers";
import type { ReactionCue } from "./reactions";
import type { RunningAudio } from "./types";
import { disconnectAfterEnded } from "./utils";
import { MATERIAL, type MaterialId } from "../materials";

type NoiseCue = {
  duration: number;
  frequency: number;
  gain: number;
  type: BiquadFilterType;
  q?: number;
};

type ToneCue = {
  duration: number;
  frequency: number;
  gain: number;
  type?: OscillatorType;
  endFrequency?: number;
};

export function playMaterialPaintCue(audio: RunningAudio, material: MaterialId, time: number) {
  switch (material) {
    case MATERIAL.Empty:
      playNoise(audio, time, { duration: 0.028, frequency: 2300, gain: 0.0026, type: "highpass", q: 0.35 });
      return;
    case MATERIAL.Sand:
    case MATERIAL.Soil:
      playNoise(audio, time, { duration: 0.045, frequency: 880, gain: 0.0064, type: "bandpass", q: 0.65 });
      return;
    case MATERIAL.Wall:
    case MATERIAL.Stone:
      playTone(audio, time, { duration: 0.04, frequency: material === MATERIAL.Stone ? 190 : 150, gain: 0.0048, type: "triangle" });
      playNoise(audio, time, { duration: 0.024, frequency: 680, gain: 0.0018, type: "bandpass", q: 0.35 });
      return;
    case MATERIAL.Water:
    case MATERIAL.Moonwater:
      playDroplet(audio, time, material === MATERIAL.Moonwater);
      return;
    case MATERIAL.Oil:
      playNoise(audio, time, { duration: 0.062, frequency: 360, gain: 0.0046, type: "lowpass", q: 0.3 });
      return;
    case MATERIAL.Ice:
      playTone(audio, time, { duration: 0.07, frequency: 760, endFrequency: 1040, gain: 0.0036, type: "sine" });
      return;
    case MATERIAL.Seed:
    case MATERIAL.Moss:
    case MATERIAL.Fungus:
    case MATERIAL.Wood:
      playTone(audio, time, { duration: 0.052, frequency: material === MATERIAL.Wood ? 180 : 310, gain: 0.0038, type: "triangle" });
      playNoise(audio, time, { duration: 0.028, frequency: 1180, gain: 0.0015, type: "bandpass", q: 0.35 });
      return;
    case MATERIAL.Fire:
    case MATERIAL.Lava:
    case MATERIAL.Meteor:
      playNoise(audio, time, { duration: 0.044, frequency: material === MATERIAL.Fire ? 1700 : 1250, gain: 0.0042, type: "bandpass", q: 0.42 });
      playTone(audio, time, { duration: 0.036, frequency: material === MATERIAL.Meteor ? 92 : 120, gain: 0.0035, type: "sine" });
      return;
    case MATERIAL.Smoke:
    case MATERIAL.Steam:
      playNoise(audio, time, { duration: 0.068, frequency: material === MATERIAL.Steam ? 1450 : 700, gain: 0.0027, type: "bandpass", q: 0.24 });
      return;
    case MATERIAL.Stardust:
      playTone(audio, time, { duration: 0.078, frequency: 1040, endFrequency: 1560, gain: 0.0032, type: "sine" });
      playTone(audio, time + 0.025, { duration: 0.066, frequency: 1390, gain: 0.002, type: "sine" });
      return;
  }
}

export function playReactionCue(audio: RunningAudio, cue: ReactionCue, time: number) {
  switch (cue) {
    case "steam-flash":
      playNoise(audio, time, { duration: 0.12, frequency: 1500, gain: 0.0032, type: "bandpass", q: 0.22 });
      playNoise(audio, time + 0.025, { duration: 0.078, frequency: 820, gain: 0.0013, type: "bandpass", q: 0.18 });
      return;
    case "bloom":
      playTone(audio, time, { duration: 0.12, frequency: 520, endFrequency: 650, gain: 0.0029, type: "sine" });
      playTone(audio, time + 0.05, { duration: 0.13, frequency: 780, endFrequency: 980, gain: 0.0021, type: "triangle" });
      return;
    case "cosmic-charge":
      playTone(audio, time, { duration: 0.1, frequency: 820, endFrequency: 1230, gain: 0.0026, type: "sine" });
      playTone(audio, time + 0.038, { duration: 0.12, frequency: 1320, endFrequency: 1760, gain: 0.0016, type: "sine" });
      playNoise(audio, time + 0.02, { duration: 0.072, frequency: 2200, gain: 0.0009, type: "bandpass", q: 0.35 });
      return;
    case "cleanse":
      playNoise(audio, time, { duration: 0.1, frequency: 500, gain: 0.0026, type: "lowpass", q: 0.25 });
      playTone(audio, time + 0.032, { duration: 0.1, frequency: 960, endFrequency: 1440, gain: 0.0022, type: "sine" });
      return;
    case "impact-burst":
      playTone(audio, time, { duration: 0.068, frequency: 82, gain: 0.0034, type: "sine" });
      playNoise(audio, time + 0.008, { duration: 0.084, frequency: 1040, gain: 0.0026, type: "bandpass", q: 0.42 });
      playTone(audio, time + 0.032, { duration: 0.07, frequency: 1380, endFrequency: 980, gain: 0.0018, type: "triangle" });
      return;
  }
}

function playDroplet(audio: RunningAudio, time: number, cosmic: boolean) {
  playTone(audio, time, { duration: 0.1, frequency: cosmic ? 660 : 520, endFrequency: cosmic ? 920 : 380, gain: cosmic ? 0.004 : 0.0046, type: "sine" });
  playTone(audio, time + 0.032, { duration: 0.064, frequency: cosmic ? 990 : 740, endFrequency: cosmic ? 1320 : 610, gain: cosmic ? 0.0022 : 0.0019, type: "sine" });
}

function playTone(audio: RunningAudio, time: number, options: ToneCue) {
  const { context, channels } = audio;
  const oscillator = context.createOscillator();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, time);
  if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, time + options.duration);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(options.gain, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + options.duration);

  oscillator.connect(gain);
  gain.connect(channels.ambience);
  disconnectAfterEnded(oscillator, gain);
  oscillator.start(time);
  oscillator.stop(time + options.duration + 0.02);
}

function playNoise(audio: RunningAudio, time: number, options: NoiseCue) {
  const { context, channels } = audio;
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, options.duration);

  const filter = context.createBiquadFilter();
  filter.type = options.type;
  filter.frequency.value = options.frequency;
  filter.Q.value = options.q ?? 0.5;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(options.gain, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + options.duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(channels.ambience);
  disconnectAfterEnded(source, filter, gain);
  source.start(time);
  source.stop(time + options.duration + 0.01);
}
