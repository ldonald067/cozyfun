import { MATERIAL, type MaterialId } from "../materials";
import { createNoiseBuffer } from "./buffers";
import type { ReactionAudioCue, RunningAudio, UiAudioCue } from "./types";
import { clamp01 } from "./utils";

export function playMaterialPaint(audio: RunningAudio, materialId: MaterialId, intensity: number) {
  const amount = clamp01(intensity);
  switch (materialId) {
    case MATERIAL.Sand:
    case MATERIAL.Soil:
      playNoiseBurst(audio, { duration: 0.045, gain: 0.022 + amount * 0.018, filter: 1600, type: "bandpass" });
      break;
    case MATERIAL.Water:
      playRipple(audio, 420, 0.035 + amount * 0.025);
      break;
    case MATERIAL.Moonwater:
      playRipple(audio, 620, 0.04 + amount * 0.025);
      playChime(audio, [880, 1320], 0.035);
      break;
    case MATERIAL.Fire:
    case MATERIAL.Lava:
      playNoiseBurst(audio, { duration: 0.06, gain: 0.025 + amount * 0.02, filter: 2400, type: "highpass" });
      break;
    case MATERIAL.Ice:
      playChime(audio, [980, 1470], 0.032);
      break;
    case MATERIAL.Stardust:
    case MATERIAL.Meteor:
      playChime(audio, [740, 1110, 1480], 0.04);
      break;
    case MATERIAL.Steam:
    case MATERIAL.Smoke:
      playNoiseBurst(audio, { duration: 0.08, gain: 0.018, filter: 900, type: "lowpass" });
      break;
    default:
      playTap(audio, 300, 0.018);
  }
}

export function playUiCue(audio: RunningAudio, cue: UiAudioCue) {
  if (cue === "clear") {
    playTap(audio, 190, 0.035);
    return;
  }
  if (cue === "save" || cue === "export") {
    playChime(audio, [520, 780], 0.032);
    return;
  }
  if (cue === "load" || cue === "import") {
    playChime(audio, [420, 630], 0.028);
    return;
  }
  playTap(audio, 440, 0.018);
}

export function playReactionCue(audio: RunningAudio, cue: ReactionAudioCue, intensity: number) {
  const amount = clamp01(intensity);
  if (cue === "steam") {
    playNoiseBurst(audio, { duration: 0.16, gain: 0.018 + amount * 0.014, filter: 760, type: "lowpass" });
    playRipple(audio, 520, 0.012 + amount * 0.012);
    return;
  }
  if (cue === "cool") {
    playChime(audio, [360, 240], 0.018 + amount * 0.012);
    playNoiseBurst(audio, { duration: 0.08, gain: 0.014 + amount * 0.01, filter: 1200, type: "bandpass" });
    return;
  }
  if (cue === "growth") {
    playChime(audio, [620, 840], 0.014 + amount * 0.012);
    return;
  }
  playChime(audio, [980, 1470, 1960], 0.016 + amount * 0.014);
}

function playNoiseBurst(audio: RunningAudio, options: { duration: number; gain: number; filter: number; type: BiquadFilterType }) {
  const { context, channels } = audio;
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

function playRipple(audio: RunningAudio, frequency: number, gainValue: number) {
  const { context, channels } = audio;
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

function playChime(audio: RunningAudio, frequencies: number[], gainValue: number) {
  const { context, channels } = audio;
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

function playTap(audio: RunningAudio, frequency: number, gainValue: number) {
  const { context, channels } = audio;
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
