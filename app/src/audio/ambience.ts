import { createNoiseBuffer } from "./buffers";
import { getAudioMoodDef } from "./moods";
import type { AudioLayerHandle, AudioMood, RunningAudio } from "./types";
import { stopSources } from "./utils";

export function startRainAmbience(audio: RunningAudio, mood: AudioMood): AudioLayerHandle {
  const { context, channels } = audio;
  const settings = getAudioMoodDef(mood).ambience;
  const sources: AudioScheduledSourceNode[] = [];

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

  return {
    stop() {
      stopSources(sources);
      rain.disconnect();
      hush.disconnect();
      hum.disconnect();
    }
  };
}
