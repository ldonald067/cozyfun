import type { AudioMood } from "./audio";

export type SceneEnvironmentId = "rain-desk" | "moonwater-garden" | "stardust-hearth";

export type SceneEnvironment = {
  id: SceneEnvironmentId;
  label: string;
  title: string;
  status: string;
  mood: AudioMood;
  className: string;
  image: string;
  imagePosition: string;
  imageOpacity: number;
  imageFilter: string;
};

const SCENE_ENVIRONMENT_KEY = "cozy-pixel-sandbox:room:v1";
export const DEFAULT_SCENE_ENVIRONMENT: SceneEnvironmentId = "rain-desk";

export const SCENE_ENVIRONMENTS: SceneEnvironment[] = [
  {
    id: "rain-desk",
    label: "Rain",
    title: "Rain Desk",
    status: "rain desk backdrop on",
    mood: "rain",
    className: "scene-rain-desk",
    image: "/rooms/rain-desk.jpg",
    imagePosition: "center center",
    imageOpacity: 0.66,
    imageFilter: "saturate(0.82) contrast(0.94) brightness(0.66)"
  },
  {
    id: "moonwater-garden",
    label: "Moon",
    title: "Moonlit Garden",
    status: "moonlit garden backdrop on",
    mood: "window",
    className: "scene-moonwater-garden",
    image: "/rooms/moonwater-garden.jpg",
    imagePosition: "center 38%",
    imageOpacity: 0.7,
    imageFilter: "saturate(0.86) contrast(0.98) brightness(0.82)"
  },
  {
    id: "stardust-hearth",
    label: "Hearth",
    title: "Stardust Hearth",
    status: "stardust hearth backdrop on",
    mood: "stardust",
    className: "scene-stardust-hearth",
    image: "/rooms/stardust-hearth.jpg",
    imagePosition: "center 45%",
    imageOpacity: 0.64,
    imageFilter: "saturate(0.76) contrast(0.9) brightness(0.68)"
  }
];

export function getSceneEnvironment(id: SceneEnvironmentId) {
  return SCENE_ENVIRONMENTS.find((scene) => scene.id === id) ?? SCENE_ENVIRONMENTS[0];
}

export function loadSceneEnvironmentId(): SceneEnvironmentId {
  try {
    const stored = localStorage.getItem(SCENE_ENVIRONMENT_KEY);
    return isSceneEnvironmentId(stored) ? stored : DEFAULT_SCENE_ENVIRONMENT;
  } catch {
    return DEFAULT_SCENE_ENVIRONMENT;
  }
}

export function saveSceneEnvironmentId(id: SceneEnvironmentId) {
  try {
    localStorage.setItem(SCENE_ENVIRONMENT_KEY, id);
  } catch {
    // Room preference is cosmetic; storage failure should never block play.
  }
}

function isSceneEnvironmentId(value: unknown): value is SceneEnvironmentId {
  return typeof value === "string" && SCENE_ENVIRONMENTS.some((scene) => scene.id === value);
}
