import { AMBIENT_AUDIO_ASSETS, ambientAudioUrl, decodeAmbientAudio, type AmbientAudioAssetId } from "./assets";
import { getAudioMoodDef } from "./moods";
import { DEFAULT_AUDIO_ROOM, getRoomAmbienceDef } from "./rooms";
import type { AudioLayerHandle, AudioMood, RunningAudio } from "./types";
import { disconnectAudioNodes, stopSources } from "./utils";
import type { SceneEnvironmentId } from "../sceneEnvironments";

export function startNativeAmbience(audio: RunningAudio, mood: AudioMood, room: SceneEnvironmentId = DEFAULT_AUDIO_ROOM): AudioLayerHandle {
  const moodDef = getAudioMoodDef(mood);
  const settings = moodDef.ambience;
  const roomSettings = getRoomAmbienceDef(room);
  // The mood's featured bed skips the room's gain bias: choosing Purr in the rain room
  // must play purr, not a whisper of purr under leftover rain. Background beds keep the bias.
  const bedGainScale = (bed: AudioMood, roomScale: number) => (moodDef.id === bed ? 1 : roomScale);
  const registry: AudioNodeRegistry = { sources: [], nodes: [] };
  const pendingLoads: Array<() => void> = [];

  // Every loop plays through one shared envelope so mood/room switches fade instead of popping.
  const layerGain = audio.context.createGain();
  const startAt = audio.context.currentTime;
  layerGain.gain.setValueAtTime(0.0001, startAt);
  layerGain.gain.setTargetAtTime(1, startAt, 0.24);
  layerGain.connect(audio.channels.ambience);
  registry.nodes.push(layerGain);
  registry.destination = layerGain;

  startRecordedLoop(audio, registry, pendingLoads, "catPurr", {
    gain: settings.purrGain * bedGainScale("purr", roomSettings.purrGainScale),
    filter: {
      frequency: settings.purrFilter * roomSettings.purrFilterScale,
      type: "lowpass",
      q: 0.34
    }
  });

  startRecordedLoop(audio, registry, pendingLoads, "rainFall", {
    gain: settings.rainGain * bedGainScale("rain", roomSettings.rainGainScale),
    filter: {
      frequency: settings.rainFilter * roomSettings.rainFilterScale,
      type: "lowpass",
      q: 0.38
    }
  });

  startRecordedLoop(audio, registry, pendingLoads, "fireCrackle", {
    gain: settings.fireGain * bedGainScale("fire", roomSettings.fireGainScale),
    filter: {
      frequency: 120,
      type: "highpass",
      q: 0.28
    }
  });

  return {
    stop() {
      for (const cancelLoad of pendingLoads) cancelLoad();
      const now = audio.context.currentTime;
      layerGain.gain.cancelScheduledValues(now);
      layerGain.gain.setTargetAtTime(0.0001, now, 0.09);
      const sources = [...registry.sources];
      const nodes = [...registry.nodes];
      setTimeout(() => {
        stopSources(sources);
        disconnectAudioNodes(...nodes);
      }, 420);
    }
  };
}

type AudioNodeRegistry = {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  destination?: AudioNode;
};

type RecordedLoopOptions = {
  gain: number;
  filter: {
    frequency: number;
    type: BiquadFilterType;
    q: number;
  };
};

type NativeAmbienceProbe = {
  starts?: Array<{
    id: AmbientAudioAssetId;
    url: string;
    duration: number;
    sampleRate: number;
    buffer: AudioBuffer | null;
    gain: number;
    loop: boolean;
    filterType: BiquadFilterType;
    filterFrequency: number;
    filterQ: number;
  }>;
};

function startRecordedLoop(
  audio: RunningAudio,
  registry: AudioNodeRegistry,
  pendingLoads: Array<() => void>,
  id: AmbientAudioAssetId,
  options: RecordedLoopOptions
) {
  if (options.gain <= 0) return;
  let cancelled = false;
  pendingLoads.push(() => {
    cancelled = true;
  });

  void loadAmbientLoop(audio.context, id).then((loop) => {
    if (cancelled || !loop) return;

    const source = audio.context.createBufferSource();
    source.buffer = loop;
    source.loop = true;

    const filter = audio.context.createBiquadFilter();
    filter.type = options.filter.type;
    filter.frequency.value = options.filter.frequency;
    filter.Q.value = options.filter.q;

    const gain = audio.context.createGain();
    gain.gain.value = options.gain * AMBIENT_AUDIO_ASSETS[id].levelTrim;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(registry.destination ?? audio.channels.ambience);
    source.start();
    recordNativeAmbienceStart(id, source, gain, filter);

    registry.sources.push(source);
    registry.nodes.push(source, filter, gain);
  });
}

function recordNativeAmbienceStart(id: AmbientAudioAssetId, source: AudioBufferSourceNode, gain: GainNode, filter: BiquadFilterNode) {
  const probe = (globalThis as { __cozyNativeAmbienceProbe?: NativeAmbienceProbe }).__cozyNativeAmbienceProbe;
  if (!probe) return;
  if (!probe.starts) probe.starts = [];
  probe.starts.push({
    id,
    url: ambientAudioUrl(id),
    duration: source.buffer?.duration ?? 0,
    sampleRate: source.buffer?.sampleRate ?? 0,
    buffer: source.buffer,
    gain: gain.gain.value,
    loop: source.loop,
    filterType: filter.type,
    filterFrequency: filter.frequency.value,
    filterQ: filter.Q.value
  });
}

// Built once per bed and shared by every layer, so a mood or room switch replays the same
// loop instead of decoding and rebuilding it. An AudioBuffer is not tied to a context, so
// the cache outlives one. A failed load is dropped so the next start retries it.
const loopCache = new Map<AmbientAudioAssetId, Promise<AudioBuffer | null>>();

function loadAmbientLoop(context: BaseAudioContext, id: AmbientAudioAssetId) {
  const cached = loopCache.get(id);
  if (cached) return cached;
  const loop = decodeAmbientAudio(id, context).then((decoded) => (decoded ? buildSeamlessLoop(context, decoded) : null));
  loopCache.set(id, loop);
  void loop.then((built) => {
    if (!built) loopCache.delete(id);
  });
  return loop;
}

// Below this a sample is digital silence: decoder priming, or the recording's own lead-in.
// The purr opened on 71 ms of it and the fire on 17 ms, a dropout at every wrap.
const SILENCE = 1e-4;
// Kept clear of each end past the silence: the purr fades in over its first quarter second
// and the fire fades out over its last, and either would dip at every wrap.
const LOOP_EDGE_SECONDS = 0.25;
// Equal-power, because the beds are noise-like and uncorrelated across the seam, where a
// linear fade dips ~3 dB at its middle.
const LOOP_CROSSFADE_SECONDS = 0.5;

/**
 * A recording turned into a buffer that loops without a seam. The kept span's last `fade`
 * samples are crossfaded with the `fade` samples just before the loop's first sample, so
 * the tail arrives exactly where playback wraps to:
 *
 *   kept:    [head | body .................................... | tail]
 *   output:         [body .................................... | tail x head]
 *
 * The extension this replaces was written for clips shorter than a loop should be. Every
 * bed now runs about two minutes or more, and it faded the tail into the START of the
 * recording and then wrapped back to that same start: a jump at every wrap, the first four
 * seconds of the purr heard twice running, and a second full-length copy in memory.
 */
function buildSeamlessLoop(context: BaseAudioContext, source: AudioBuffer) {
  const rate = source.sampleRate;
  const edge = Math.floor(rate * LOOP_EDGE_SECONDS);
  const [first, last] = soundingSpan(source);
  const start = first + edge;
  const end = last - edge;
  const fade = Math.min(Math.floor(rate * LOOP_CROSSFADE_SECONDS), Math.floor((end - start) / 4));
  if (fade < 1) return source;

  const length = end - start - fade;
  const output = context.createBuffer(source.numberOfChannels, length, rate);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const data = output.getChannelData(channel);
    data.set(input.subarray(start + fade, end));
    const tailAt = length - fade;
    for (let i = 0; i < fade; i++) {
      const angle = ((i + 0.5) / fade) * (Math.PI / 2);
      data[tailAt + i] = input[end - fade + i] * Math.cos(angle) + input[start + i] * Math.sin(angle);
    }
  }
  return output;
}

/** First sounding sample and one past the last, across every channel. */
function soundingSpan(buffer: AudioBuffer): [number, number] {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const sounding = (i: number) => channels.some((data) => Math.abs(data[i]) >= SILENCE);
  let first = 0;
  while (first < buffer.length && !sounding(first)) first++;
  let last = buffer.length;
  while (last > first && !sounding(last - 1)) last--;
  return [first, last];
}
