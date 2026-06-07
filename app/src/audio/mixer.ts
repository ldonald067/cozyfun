import { AUDIO_CHANNELS } from "./preferences";
import type { AudioChannel, AudioPrefs, RunningAudio } from "./types";

export function createAudioMixer(context: AudioContext): RunningAudio {
  const master = context.createGain();
  const ambience = context.createGain();

  ambience.connect(master);
  master.connect(context.destination);

  return {
    context,
    channels: { master, ambience }
  };
}

export function applyMixerPreferences(audio: RunningAudio, prefs: AudioPrefs) {
  const now = audio.context.currentTime;
  for (const channel of AUDIO_CHANNELS) {
    setChannelVolume(channel, channelVolume(channel, prefs));
  }

  function setChannelVolume(targetChannel: AudioChannel, value: number) {
    const gain = audio.channels[targetChannel].gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(value, now, 0.055);
  }
}

function channelVolume(channel: AudioChannel, prefs: AudioPrefs) {
  if (channel === "master" && (prefs.muted || !prefs.enabled)) return 0;
  return prefs.volumes[channel];
}
