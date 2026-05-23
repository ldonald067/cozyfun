import { createNoiseBuffer } from "./buffers";
import type { AudioLayerHandle, RunningAudio } from "./types";
import { stopSources } from "./utils";

export function startRainAmbience(audio: RunningAudio): AudioLayerHandle {
  const { context, channels } = audio;
  const sources: AudioScheduledSourceNode[] = [];

  const rain = context.createBufferSource();
  rain.buffer = createNoiseBuffer(context, 2.5);
  rain.loop = true;
  const rainFilter = context.createBiquadFilter();
  rainFilter.type = "bandpass";
  rainFilter.frequency.value = 1450;
  rainFilter.Q.value = 0.65;
  const rainGain = context.createGain();
  rainGain.gain.value = 0.085;
  rain.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(channels.ambience);

  const hush = context.createBufferSource();
  hush.buffer = createNoiseBuffer(context, 3);
  hush.loop = true;
  const hushFilter = context.createBiquadFilter();
  hushFilter.type = "lowpass";
  hushFilter.frequency.value = 260;
  const hushGain = context.createGain();
  hushGain.gain.value = 0.04;
  hush.connect(hushFilter);
  hushFilter.connect(hushGain);
  hushGain.connect(channels.ambience);

  const hum = context.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 72;
  const humGain = context.createGain();
  humGain.gain.value = 0.018;
  hum.connect(humGain);
  humGain.connect(channels.ambience);

  rain.start();
  hush.start();
  hum.start();
  sources.push(rain, hush, hum);

  return {
    stop() {
      stopSources(sources);
      rain.disconnect();
      hush.disconnect();
      hum.disconnect();
    }
  };
}
