import { AMBIENT_AUDIO_ASSETS, loadAmbientAudioBuffer, type AmbientAudioAssetId } from "./assets";
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
    gain: number;
    loop: boolean;
    filterType: BiquadFilterType;
    filterFrequency: number;
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

  void loadAmbientAudioBuffer(audio.context, id).then((decodedBuffer) => {
    if (cancelled || !decodedBuffer) return;

    const source = audio.context.createBufferSource();
    source.buffer = createLongLoopBuffer(audio.context, decodedBuffer, AMBIENT_AUDIO_ASSETS[id].minLoopSeconds);
    source.loop = true;

    const filter = audio.context.createBiquadFilter();
    filter.type = options.filter.type;
    filter.frequency.value = options.filter.frequency;
    filter.Q.value = options.filter.q;

    const gain = audio.context.createGain();
    gain.gain.value = options.gain;

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
    url: AMBIENT_AUDIO_ASSETS[id].url,
    duration: source.buffer?.duration ?? 0,
    gain: gain.gain.value,
    loop: source.loop,
    filterType: filter.type,
    filterFrequency: filter.frequency.value
  });
}

function createLongLoopBuffer(context: BaseAudioContext, source: AudioBuffer, minDurationSeconds: number) {
  if (source.duration >= minDurationSeconds) return source;

  const targetLength = Math.max(source.length, Math.ceil(minDurationSeconds * source.sampleRate));
  const output = context.createBuffer(source.numberOfChannels, targetLength, source.sampleRate);
  const fadeLength = Math.min(
    Math.floor(source.sampleRate * 0.28),
    Math.floor(source.length / 4),
    Math.floor(targetLength / 24)
  );
  const stride = Math.max(1, source.length - fadeLength);

  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const data = output.getChannelData(channel);
    let writeAt = 0;

    while (writeAt < targetLength) {
      const remaining = targetLength - writeAt;
      const readable = Math.min(source.length, remaining);
      if (writeAt === 0 || fadeLength <= 0) {
        data.set(input.subarray(0, readable), writeAt);
      } else {
        const overlap = Math.min(fadeLength, readable);
        for (let i = 0; i < overlap; i++) {
          const amount = (i + 1) / (overlap + 1);
          data[writeAt + i] = data[writeAt + i] * (1 - amount) + input[i] * amount;
        }
        if (readable > overlap) {
          data.set(input.subarray(overlap, readable), writeAt + overlap);
        }
      }
      writeAt += stride;
    }

    smoothLoopBoundary(data, fadeLength);
  }

  return output;
}

function smoothLoopBoundary(data: Float32Array, fadeLength: number) {
  if (fadeLength <= 0 || data.length <= fadeLength) return;
  const endStart = data.length - fadeLength;
  for (let i = 0; i < fadeLength; i++) {
    const amount = (i + 1) / (fadeLength + 1);
    data[endStart + i] = data[endStart + i] * (1 - amount) + data[i] * amount;
  }
}
