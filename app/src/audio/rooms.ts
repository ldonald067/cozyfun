import type { SceneEnvironmentId } from "../sceneEnvironments";

export type RoomAmbienceDef = {
  id: SceneEnvironmentId;
  purrGainScale: number;
  purrFilterScale: number;
  rainGainScale: number;
  rainFilterScale: number;
  fireGainScale: number;
};

export const DEFAULT_AUDIO_ROOM: SceneEnvironmentId = "rain-desk";

export const ROOM_AMBIENCE_DEFS: RoomAmbienceDef[] = [
  {
    id: "rain-desk",
    purrGainScale: 0.28,
    purrFilterScale: 0.92,
    rainGainScale: 1.08,
    rainFilterScale: 0.92,
    fireGainScale: 0.16
  },
  {
    id: "moonwater-garden",
    purrGainScale: 0.08,
    purrFilterScale: 1.05,
    rainGainScale: 0.44,
    rainFilterScale: 1.24,
    fireGainScale: 0.06
  },
  {
    id: "stardust-hearth",
    purrGainScale: 0.72,
    purrFilterScale: 0.95,
    rainGainScale: 0.18,
    rainFilterScale: 1.26,
    fireGainScale: 1
  },
  {
    id: "cozy-fireplace",
    purrGainScale: 0.68,
    purrFilterScale: 0.9,
    rainGainScale: 0.08,
    rainFilterScale: 1.1,
    fireGainScale: 1.22
  },
  {
    id: "forest-hut",
    purrGainScale: 0.24,
    purrFilterScale: 1,
    rainGainScale: 0.7,
    rainFilterScale: 0.8,
    fireGainScale: 0.16
  },
  {
    id: "snow-window",
    purrGainScale: 0.5,
    purrFilterScale: 0.86,
    rainGainScale: 0.22,
    rainFilterScale: 1.55,
    fireGainScale: 0.28
  }
];

export function getRoomAmbienceDef(room: SceneEnvironmentId) {
  return ROOM_AMBIENCE_DEFS.find((candidate) => candidate.id === room) ?? ROOM_AMBIENCE_DEFS[0];
}
