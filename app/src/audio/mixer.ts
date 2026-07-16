import { AUDIO_CHANNELS } from "./preferences";
import type { AudioChannel, AudioPrefs, RunningAudio } from "./types";

export function createAudioMixer(context: AudioContext): RunningAudio {
  const master = context.createGain();
  const ambience = context.createGain();
  // Short cues bypass the ambience slider so quiet beds never silence interaction feedback.
  // Cue voices are authored very quiet (0.001-0.006), so the bus lifts them to a readable level.
  const cueBus = context.createGain();
  cueBus.gain.value = 3;

  ambience.connect(master);
  cueBus.connect(master);
  master.connect(context.destination);

  return {
    context,
    channels: { master, ambience },
    cueBus
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
