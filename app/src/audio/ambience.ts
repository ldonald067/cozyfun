import { createNoiseBuffer } from "./buffers";
import { getAudioMoodDef } from "./moods";
import type { AudioLayerHandle, AudioMood, RunningAudio } from "./types";
import { disconnectAfterEnded, disconnectAudioNodes, stopSources } from "./utils";

export function startRainAmbience(audio: RunningAudio, mood: AudioMood): AudioLayerHandle {
  const { context, channels } = audio;
  const settings = getAudioMoodDef(mood).ambience;
  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];

  const rain = context.createBufferSource();
  rain.buffer = createNoiseBuffer(context, 2.5);
  rain.loop = true;
  const rainFilter = context.createBiquadFilter();
  rainFilter.type = "bandpass";
  rainFilter.frequency.value = settings.rainFilter;
  rainFilter.Q.value = 0.65;
  const rainGain = context.createGain();
  rainGain.gain.value = settings.rainGain;
  rain.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(channels.ambience);

  const hush = context.createBufferSource();
  hush.buffer = createNoiseBuffer(context, 3);
  hush.loop = true;
  const hushFilter = context.createBiquadFilter();
  hushFilter.type = "lowpass";
  hushFilter.frequency.value = settings.hushFilter;
  const hushGain = context.createGain();
  hushGain.gain.value = settings.hushGain;
  hush.connect(hushFilter);
  hushFilter.connect(hushGain);
  hushGain.connect(channels.ambience);

  const hum = context.createOscillator();
  hum.type = "sine";
  hum.frequency.value = settings.humFrequency;
  const humGain = context.createGain();
  humGain.gain.value = settings.humGain;
  hum.connect(humGain);
  humGain.connect(channels.ambience);

  rain.start();
  hush.start();
  hum.start();
  sources.push(rain, hush, hum);
  scheduleDrip();

  return {
    stop() {
      stopSources(sources);
      for (const timer of timers) window.clearTimeout(timer);
      disconnectAudioNodes(rain, rainFilter, rainGain, hush, hushFilter, hushGain, hum, humGain);
    }
  };

  function scheduleDrip() {
    if (settings.dripGain <= 0) return;
    const jitter = settings.dripMs * (0.72 + Math.random() * 0.56);
    timers.push(
      window.setTimeout(() => {
        playWindowDrip(audio, settings.dripGain);
        scheduleDrip();
      }, jitter)
    );
  }
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
