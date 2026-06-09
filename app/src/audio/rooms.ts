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
    rainGainScale: 1.08,
    rainFilterScale: 0.92,
    creekGainScale: 0.78,
    creekFilterScale: 0.96,
    fireGainScale: 0.16
  },
  {
    id: "moonwater-garden",
    rainGainScale: 0.44,
    rainFilterScale: 1.24,
    creekGainScale: 1.08,
    creekFilterScale: 1.08,
    fireGainScale: 0.06
  },
  {
    id: "stardust-hearth",
    rainGainScale: 0.18,
    rainFilterScale: 1.26,
    creekGainScale: 0.14,
    creekFilterScale: 1.02,
    fireGainScale: 1
  },
  {
    id: "cozy-fireplace",
    rainGainScale: 0.08,
    rainFilterScale: 1.1,
    creekGainScale: 0.06,
    creekFilterScale: 0.84,
    fireGainScale: 1.22
  },
  {
    id: "forest-hut",
    rainGainScale: 0.7,
    rainFilterScale: 0.8,
    creekGainScale: 1.04,
    creekFilterScale: 0.9,
    fireGainScale: 0.16
  },
  {
    id: "snow-window",
    rainGainScale: 0.22,
    rainFilterScale: 1.55,
    creekGainScale: 0.12,
    creekFilterScale: 1.12,
    fireGainScale: 0.28
  }
];

export function getRoomAmbienceDef(room: SceneEnvironmentId) {
  return ROOM_AMBIENCE_DEFS.find((candidate) => candidate.id === room) ?? ROOM_AMBIENCE_DEFS[0];
}
