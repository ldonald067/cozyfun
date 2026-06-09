import type { SceneEnvironmentId } from "../sceneEnvironments";

export type RoomAmbienceDef = {
  id: SceneEnvironmentId;
  rainGainScale: number;
  rainFilterScale: number;
  creekGainScale: number;
  creekFilterScale: number;
  fireGainScale: number;
};

export const DEFAULT_AUDIO_ROOM: SceneEnvironmentId = "rain-desk";

export const ROOM_AMBIENCE_DEFS: RoomAmbienceDef[] = [
  {
    id: "rain-desk",
    rainGainScale: 1.14,
    rainFilterScale: 0.98,
    creekGainScale: 0.82,
    creekFilterScale: 1,
    fireGainScale: 0.2
  },
  {
    id: "moonwater-garden",
    rainGainScale: 0.48,
    rainFilterScale: 1.35,
    creekGainScale: 1.18,
    creekFilterScale: 1.18,
    fireGainScale: 0.08
  },
  {
    id: "stardust-hearth",
    rainGainScale: 0.22,
    rainFilterScale: 1.42,
    creekGainScale: 0.18,
    creekFilterScale: 1.12,
    fireGainScale: 1.1
  },
  {
    id: "cozy-fireplace",
    rainGainScale: 0.12,
    rainFilterScale: 1.2,
    creekGainScale: 0.08,
    creekFilterScale: 0.9,
    fireGainScale: 1.4
  },
  {
    id: "forest-hut",
    rainGainScale: 0.76,
    rainFilterScale: 0.84,
    creekGainScale: 1.12,
    creekFilterScale: 0.94,
    fireGainScale: 0.2
  },
  {
    id: "snow-window",
    rainGainScale: 0.26,
    rainFilterScale: 1.7,
    creekGainScale: 0.14,
    creekFilterScale: 1.24,
    fireGainScale: 0.34
  }
];

export function getRoomAmbienceDef(room: SceneEnvironmentId) {
  return ROOM_AMBIENCE_DEFS.find((candidate) => candidate.id === room) ?? ROOM_AMBIENCE_DEFS[0];
}
