import type { SceneEnvironmentId } from "../sceneEnvironments";

export type RoomAmbienceDef = {
  id: SceneEnvironmentId;
  rainGainScale: number;
  rainFilterScale: number;
  hushGainScale: number;
  hushFilterScale: number;
  humGainScale: number;
  humFrequencyOffset: number;
  dripGainScale: number;
  dripMsScale: number;
  airGain: number;
  airFilter: number;
  airType: BiquadFilterType;
  warmGain: number;
  warmFilter: number;
  gardenTickGain: number;
  gardenTickMs: number;
  starChimeGain: number;
  starChimeMs: number;
  warmCrackleGain: number;
  warmCrackleMs: number;
  branchRustleGain: number;
  branchRustleMs: number;
  snowTickGain: number;
  snowTickMs: number;
};

export const DEFAULT_AUDIO_ROOM: SceneEnvironmentId = "rain-desk";

export const ROOM_AMBIENCE_DEFS: RoomAmbienceDef[] = [
  {
    id: "rain-desk",
    rainGainScale: 1.12,
    rainFilterScale: 0.98,
    hushGainScale: 1,
    hushFilterScale: 1,
    humGainScale: 1,
    humFrequencyOffset: 0,
    dripGainScale: 1.15,
    dripMsScale: 0.9,
    airGain: 0.004,
    airFilter: 1800,
    airType: "bandpass",
    warmGain: 0.004,
    warmFilter: 340,
    gardenTickGain: 0,
    gardenTickMs: 0,
    starChimeGain: 0,
    starChimeMs: 0,
    warmCrackleGain: 0,
    warmCrackleMs: 0,
    branchRustleGain: 0,
    branchRustleMs: 0,
    snowTickGain: 0,
    snowTickMs: 0
  },
  {
    id: "moonwater-garden",
    rainGainScale: 0.42,
    rainFilterScale: 1.35,
    hushGainScale: 0.82,
    hushFilterScale: 1.25,
    humGainScale: 0.44,
    humFrequencyOffset: 7,
    dripGainScale: 0.36,
    dripMsScale: 1.85,
    airGain: 0.018,
    airFilter: 2100,
    airType: "highpass",
    warmGain: 0,
    warmFilter: 320,
    gardenTickGain: 0.0055,
    gardenTickMs: 5200,
    starChimeGain: 0.0022,
    starChimeMs: 8800,
    warmCrackleGain: 0,
    warmCrackleMs: 0,
    branchRustleGain: 0.0025,
    branchRustleMs: 7400,
    snowTickGain: 0,
    snowTickMs: 0
  },
  {
    id: "stardust-hearth",
    rainGainScale: 0.24,
    rainFilterScale: 1.42,
    hushGainScale: 0.72,
    hushFilterScale: 1.18,
    humGainScale: 0.66,
    humFrequencyOffset: 10,
    dripGainScale: 0.24,
    dripMsScale: 2.2,
    airGain: 0.01,
    airFilter: 2400,
    airType: "bandpass",
    warmGain: 0.016,
    warmFilter: 420,
    gardenTickGain: 0,
    gardenTickMs: 0,
    starChimeGain: 0.0048,
    starChimeMs: 6100,
    warmCrackleGain: 0.0035,
    warmCrackleMs: 4500,
    branchRustleGain: 0,
    branchRustleMs: 0,
    snowTickGain: 0,
    snowTickMs: 0
  },
  {
    id: "cozy-fireplace",
    rainGainScale: 0.18,
    rainFilterScale: 1.2,
    hushGainScale: 0.78,
    hushFilterScale: 0.9,
    humGainScale: 0.95,
    humFrequencyOffset: -5,
    dripGainScale: 0.16,
    dripMsScale: 2.4,
    airGain: 0.003,
    airFilter: 1200,
    airType: "bandpass",
    warmGain: 0.026,
    warmFilter: 360,
    gardenTickGain: 0,
    gardenTickMs: 0,
    starChimeGain: 0,
    starChimeMs: 0,
    warmCrackleGain: 0.008,
    warmCrackleMs: 2600,
    branchRustleGain: 0,
    branchRustleMs: 0,
    snowTickGain: 0,
    snowTickMs: 0
  },
  {
    id: "forest-hut",
    rainGainScale: 0.72,
    rainFilterScale: 0.84,
    hushGainScale: 1.05,
    hushFilterScale: 1.05,
    humGainScale: 0.34,
    humFrequencyOffset: -3,
    dripGainScale: 0.72,
    dripMsScale: 1.25,
    airGain: 0.016,
    airFilter: 1250,
    airType: "bandpass",
    warmGain: 0.006,
    warmFilter: 300,
    gardenTickGain: 0.0018,
    gardenTickMs: 7600,
    starChimeGain: 0,
    starChimeMs: 0,
    warmCrackleGain: 0,
    warmCrackleMs: 0,
    branchRustleGain: 0.007,
    branchRustleMs: 4700,
    snowTickGain: 0,
    snowTickMs: 0
  },
  {
    id: "snow-window",
    rainGainScale: 0.24,
    rainFilterScale: 1.7,
    hushGainScale: 1.22,
    hushFilterScale: 0.72,
    humGainScale: 0.52,
    humFrequencyOffset: -8,
    dripGainScale: 0.42,
    dripMsScale: 1.65,
    airGain: 0.014,
    airFilter: 2400,
    airType: "bandpass",
    warmGain: 0.003,
    warmFilter: 260,
    gardenTickGain: 0,
    gardenTickMs: 0,
    starChimeGain: 0,
    starChimeMs: 0,
    warmCrackleGain: 0,
    warmCrackleMs: 0,
    branchRustleGain: 0,
    branchRustleMs: 0,
    snowTickGain: 0.004,
    snowTickMs: 4800
  }
];

export function getRoomAmbienceDef(room: SceneEnvironmentId) {
  return ROOM_AMBIENCE_DEFS.find((candidate) => candidate.id === room) ?? ROOM_AMBIENCE_DEFS[0];
}
