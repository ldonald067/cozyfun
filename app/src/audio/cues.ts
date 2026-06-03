import { createNoiseBuffer } from "./buffers";
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
      playNoise(audio, time, { duration: 0.035, frequency: 2600, gain: 0.004, type: "highpass" });
      return;
    case MATERIAL.Sand:
    case MATERIAL.Soil:
      playNoise(audio, time, { duration: 0.055, frequency: 980, gain: 0.009, type: "bandpass", q: 0.9 });
      return;
    case MATERIAL.Wall:
    case MATERIAL.Stone:
      playTone(audio, time, { duration: 0.045, frequency: material === MATERIAL.Stone ? 190 : 150, gain: 0.006, type: "triangle" });
      playNoise(audio, time, { duration: 0.03, frequency: 720, gain: 0.003, type: "bandpass" });
      return;
    case MATERIAL.Water:
    case MATERIAL.Moonwater:
      playDroplet(audio, time, material === MATERIAL.Moonwater);
      return;
    case MATERIAL.Oil:
      playNoise(audio, time, { duration: 0.08, frequency: 420, gain: 0.006, type: "lowpass" });
      return;
    case MATERIAL.Ice:
      playTone(audio, time, { duration: 0.08, frequency: 760, endFrequency: 1040, gain: 0.0045, type: "sine" });
      return;
    case MATERIAL.Seed:
    case MATERIAL.Moss:
    case MATERIAL.Fungus:
    case MATERIAL.Wood:
      playTone(audio, time, { duration: 0.06, frequency: material === MATERIAL.Wood ? 180 : 310, gain: 0.0048, type: "triangle" });
      playNoise(audio, time, { duration: 0.04, frequency: 1350, gain: 0.0025, type: "bandpass" });
      return;
    case MATERIAL.Fire:
    case MATERIAL.Lava:
    case MATERIAL.Meteor:
      playNoise(audio, time, { duration: 0.06, frequency: material === MATERIAL.Fire ? 2200 : 1450, gain: 0.007, type: "bandpass", q: 0.7 });
      playTone(audio, time, { duration: 0.04, frequency: material === MATERIAL.Meteor ? 92 : 120, gain: 0.0045, type: "sine" });
      return;
    case MATERIAL.Smoke:
    case MATERIAL.Steam:
      playNoise(audio, time, { duration: 0.09, frequency: material === MATERIAL.Steam ? 1700 : 820, gain: 0.004, type: "bandpass", q: 0.35 });
      return;
    case MATERIAL.Stardust:
      playTone(audio, time, { duration: 0.09, frequency: 1040, endFrequency: 1560, gain: 0.004, type: "sine" });
      playTone(audio, time + 0.025, { duration: 0.08, frequency: 1390, gain: 0.0026, type: "sine" });
      return;
  }
}

function playDroplet(audio: RunningAudio, time: number, cosmic: boolean) {
  playTone(audio, time, { duration: 0.12, frequency: cosmic ? 660 : 520, endFrequency: cosmic ? 920 : 380, gain: cosmic ? 0.005 : 0.006, type: "sine" });
  playTone(audio, time + 0.035, { duration: 0.08, frequency: cosmic ? 990 : 740, endFrequency: cosmic ? 1320 : 610, gain: cosmic ? 0.003 : 0.0026, type: "sine" });
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
