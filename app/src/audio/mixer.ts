import { AUDIO_CHANNELS } from "./preferences";
import type { AudioChannel, AudioPrefs, RunningAudio } from "./types";

const MAKEUP_GAIN = 4.45;
const CUE_BUS_GAIN = 11;

export function createAudioMixer(context: AudioContext): RunningAudio {
  const master = context.createGain();
  const ambience = context.createGain();
  // Short cues bypass the ambience slider so quiet beds never silence interaction feedback.
  // Cue voices are authored very quiet (0.001-0.02), so the bus lifts them to a readable level.
  const cueBus = context.createGain();
  cueBus.gain.value = CUE_BUS_GAIN;
  // The beds are authored quiet too, and the whole mix sat at -41 dBFS RMS at the default
  // sliders, about 20 dB under Desk Radio. Makeup brings it up after the master slider, and
  // the limiter keeps a fire bed's pops and a burst of cues off the ceiling at full sliders.
  const makeup = context.createGain();
  makeup.gain.value = MAKEUP_GAIN;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;

  // The limiter misses the sharpest of the fire bed's pops: at full sliders they reached
  // +1.4 dBFS over a whole loop. The ceiling rounds them off; below -3 dBFS it is exact.
  const halve = context.createGain();
  halve.gain.value = 0.5;
  const ceiling = context.createWaveShaper();
  ceiling.curve = ceilingCurve();

  ambience.connect(master);
  cueBus.connect(master);
  master.connect(makeup);
  makeup.connect(limiter);
  limiter.connect(halve);
  halve.connect(ceiling);
  ceiling.connect(context.destination);

  return {
    context,
    channels: { master, ambience },
    cueBus
  };
}

const CEILING_KNEE = 0.708; // -3 dBFS
const CEILING = 0.944; // -0.5 dBFS

// Unity up to the knee, then a tanh bend toward the ceiling that nothing passes. A wave
// shaper's curve spans an input of -1 to 1, so its input is halved and the curve is drawn
// over twice full scale: a pop up to +6 dBFS is rounded off rather than clamped flat.
function ceilingCurve() {
  const curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) {
    const level = (i / (curve.length - 1)) * 4 - 2;
    const size = Math.abs(level);
    const shaped = size <= CEILING_KNEE ? size : CEILING_KNEE + (CEILING - CEILING_KNEE) * Math.tanh((size - CEILING_KNEE) / (CEILING - CEILING_KNEE));
    curve[i] = Math.sign(level) * shaped;
  }
  return curve;
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
