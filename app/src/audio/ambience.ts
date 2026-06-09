import { AMBIENT_AUDIO_ASSETS, loadAmbientAudioBuffer, type AmbientAudioAssetId } from "./assets";
import { getAudioMoodDef } from "./moods";
import { DEFAULT_AUDIO_ROOM, getRoomAmbienceDef } from "./rooms";
import type { AudioLayerHandle, AudioMood, RunningAudio } from "./types";
import { disconnectAudioNodes, stopSources } from "./utils";
import type { SceneEnvironmentId } from "../sceneEnvironments";

export function startNativeAmbience(audio: RunningAudio, mood: AudioMood, room: SceneEnvironmentId = DEFAULT_AUDIO_ROOM): AudioLayerHandle {
  const settings = getAudioMoodDef(mood).ambience;
  const roomSettings = getRoomAmbienceDef(room);
  const registry: AudioNodeRegistry = { sources: [], nodes: [] };
  const pendingLoads: Array<() => void> = [];

  startRecordedLoop(audio, registry, pendingLoads, "rainThunder", {
    gain: settings.rainGain * roomSettings.rainGainScale,
    filter: {
      frequency: settings.rainFilter * roomSettings.rainFilterScale,
      type: "lowpass",
      q: 0.4
    }
  });

  startRecordedLoop(audio, registry, pendingLoads, "creekWater", {
    gain: settings.creekGain * roomSettings.creekGainScale,
    filter: {
      frequency: settings.creekFilter * roomSettings.creekFilterScale,
      type: "bandpass",
      q: 0.32
    }
  });

  startRecordedLoop(audio, registry, pendingLoads, "fireCrackle", {
    gain: settings.fireGain * roomSettings.fireGainScale,
    filter: {
      frequency: 120,
      type: "highpass",
      q: 0.28
    }
  });

  return {
    stop() {
      for (const cancelLoad of pendingLoads) cancelLoad();
      stopSources(registry.sources);
      disconnectAudioNodes(...registry.nodes);
    }
  };
}

type AudioNodeRegistry = {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
};

type RecordedLoopOptions = {
  gain: number;
  filter: {
    frequency: number;
    type: BiquadFilterType;
    q: number;
  };
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
    gain.connect(audio.channels.ambience);
    source.start();

    registry.sources.push(source);
    registry.nodes.push(source, filter, gain);
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
