import type { SceneEnvironmentId } from "../sceneEnvironments";

export type RoomAmbienceDef = {
  id: SceneEnvironmentId;
  rainGainScale: number;
  rainFilterScale: number;
  creekGainScale: number;
  creekFilterScale: number;
  creekBurbleGainScale: number;
  creekBurbleMsScale: number;
  thunderGainScale: number;
  thunderMsScale: number;
  fireGainScale: number;
  fireCrackleGainScale: number;
  fireCrackleMsScale: number;
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
};

export const DEFAULT_AUDIO_ROOM: SceneEnvironmentId = "rain-desk";

export const ROOM_AMBIENCE_DEFS: RoomAmbienceDef[] = [
  {
    id: "rain-desk",
    rainGainScale: 1.14,
    rainFilterScale: 0.98,
    creekGainScale: 0.82,
    creekFilterScale: 1,
    creekBurbleGainScale: 0.9,
    creekBurbleMsScale: 1.05,
    thunderGainScale: 0.7,
    thunderMsScale: 1.1,
    fireGainScale: 0.24,
    fireCrackleGainScale: 0.2,
    fireCrackleMsScale: 1.2,
    hushGainScale: 1,
    hushFilterScale: 1,
    humGainScale: 0.82,
    humFrequencyOffset: 0,
    dripGainScale: 1.1,
    dripMsScale: 0.9,
    airGain: 0.004,
    airFilter: 1800,
    airType: "bandpass",
    warmGain: 0.003,
    warmFilter: 340
  },
  {
    id: "moonwater-garden",
    rainGainScale: 0.48,
    rainFilterScale: 1.35,
    creekGainScale: 1.18,
    creekFilterScale: 1.18,
    creekBurbleGainScale: 1.25,
    creekBurbleMsScale: 0.88,
    thunderGainScale: 0.3,
    thunderMsScale: 1.6,
    fireGainScale: 0.08,
    fireCrackleGainScale: 0.08,
    fireCrackleMsScale: 1.4,
    hushGainScale: 0.82,
    hushFilterScale: 1.25,
    humGainScale: 0.36,
    humFrequencyOffset: 7,
    dripGainScale: 0.36,
    dripMsScale: 1.85,
    airGain: 0.016,
    airFilter: 2100,
    airType: "highpass",
    warmGain: 0,
    warmFilter: 320
  },
  {
    id: "stardust-hearth",
    rainGainScale: 0.22,
    rainFilterScale: 1.42,
    creekGainScale: 0.18,
    creekFilterScale: 1.12,
    creekBurbleGainScale: 0.2,
    creekBurbleMsScale: 1.35,
    thunderGainScale: 0.25,
    thunderMsScale: 1.45,
    fireGainScale: 1.08,
    fireCrackleGainScale: 1.1,
    fireCrackleMsScale: 0.88,
    hushGainScale: 0.72,
    hushFilterScale: 1.18,
    humGainScale: 0.56,
    humFrequencyOffset: 10,
    dripGainScale: 0.18,
    dripMsScale: 2.2,
    airGain: 0.008,
    airFilter: 2400,
    airType: "bandpass",
    warmGain: 0.018,
    warmFilter: 420
  },
  {
    id: "cozy-fireplace",
    rainGainScale: 0.12,
    rainFilterScale: 1.2,
    creekGainScale: 0.08,
    creekFilterScale: 0.9,
    creekBurbleGainScale: 0.1,
    creekBurbleMsScale: 1.5,
    thunderGainScale: 0.2,
    thunderMsScale: 1.6,
    fireGainScale: 1.28,
    fireCrackleGainScale: 1.4,
    fireCrackleMsScale: 0.72,
    hushGainScale: 0.78,
    hushFilterScale: 0.9,
    humGainScale: 0.72,
    humFrequencyOffset: -5,
    dripGainScale: 0.12,
    dripMsScale: 2.4,
    airGain: 0.003,
    airFilter: 1200,
    airType: "bandpass",
    warmGain: 0.03,
    warmFilter: 360
  },
  {
    id: "forest-hut",
    rainGainScale: 0.76,
    rainFilterScale: 0.84,
    creekGainScale: 1.12,
    creekFilterScale: 0.94,
    creekBurbleGainScale: 1.18,
    creekBurbleMsScale: 0.92,
    thunderGainScale: 0.44,
    thunderMsScale: 1.35,
    fireGainScale: 0.22,
    fireCrackleGainScale: 0.18,
    fireCrackleMsScale: 1.25,
    hushGainScale: 1.05,
    hushFilterScale: 1.05,
    humGainScale: 0.26,
    humFrequencyOffset: -3,
    dripGainScale: 0.68,
    dripMsScale: 1.25,
    airGain: 0.016,
    airFilter: 1250,
    airType: "bandpass",
    warmGain: 0.004,
    warmFilter: 300
  },
  {
    id: "snow-window",
    rainGainScale: 0.26,
    rainFilterScale: 1.7,
    creekGainScale: 0.14,
    creekFilterScale: 1.24,
    creekBurbleGainScale: 0.18,
    creekBurbleMsScale: 1.55,
    thunderGainScale: 0.62,
    thunderMsScale: 1.2,
    fireGainScale: 0.36,
    fireCrackleGainScale: 0.32,
    fireCrackleMsScale: 1.08,
    hushGainScale: 1.22,
    hushFilterScale: 0.72,
    humGainScale: 0.42,
    humFrequencyOffset: -8,
    dripGainScale: 0.36,
    dripMsScale: 1.65,
    airGain: 0.014,
    airFilter: 2400,
    airType: "bandpass",
    warmGain: 0.005,
    warmFilter: 260
  }
];

export function getRoomAmbienceDef(room: SceneEnvironmentId) {
  return ROOM_AMBIENCE_DEFS.find((candidate) => candidate.id === room) ?? ROOM_AMBIENCE_DEFS[0];
}
