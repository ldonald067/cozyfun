import type { SandboxEngine } from "./engine";
import { MATERIAL, type MaterialId } from "./materials";

export type DevSceneSeedId = "rain-desk" | "moonwater-garden" | "stardust-fireplace";

export type DevSceneSeed = {
  id: DevSceneSeedId;
  label: string;
  title: string;
  status: string;
  mood: "rain" | "window" | "stardust";
  commands: PaintCommand[];
};

type PaintCommand = {
  material: MaterialId;
  x: number;
  y: number;
  radius: number;
  repeat?: number;
  dx?: number;
  dy?: number;
};

export const DEV_SCENE_SEEDS: DevSceneSeed[] = [
  {
    id: "rain-desk",
    label: "Rain",
    title: "Rain Desk",
    status: "rain desk preset loaded",
    mood: "rain",
    commands: [
      { material: MATERIAL.Stone, x: 110, y: 138, radius: 1, repeat: 220, dx: 1 },
      { material: MATERIAL.Sand, x: 30, y: 29, radius: 1, repeat: 52, dx: 1 },
      { material: MATERIAL.Moonwater, x: 130, y: 36, radius: 1, repeat: 42, dx: 1 },
      { material: MATERIAL.Soil, x: 58, y: 103, radius: 9 },
      { material: MATERIAL.Moss, x: 63, y: 94, radius: 4 },
      { material: MATERIAL.Wood, x: 172, y: 92, radius: 5 },
      { material: MATERIAL.Fire, x: 172, y: 82, radius: 3 },
      { material: MATERIAL.Stardust, x: 136, y: 26, radius: 3 }
    ]
  },
  {
    id: "moonwater-garden",
    label: "Moon",
    title: "Moonwater Garden",
    status: "moonwater garden preset loaded",
    mood: "window",
    commands: [
      { material: MATERIAL.Stone, x: 110, y: 138, radius: 1, repeat: 220, dx: 1 },
      { material: MATERIAL.Soil, x: 70, y: 108, radius: 14 },
      { material: MATERIAL.Soil, x: 116, y: 112, radius: 12 },
      { material: MATERIAL.Moonwater, x: 102, y: 72, radius: 7 },
      { material: MATERIAL.Water, x: 128, y: 78, radius: 5 },
      { material: MATERIAL.Seed, x: 58, y: 85, radius: 3 },
      { material: MATERIAL.Seed, x: 90, y: 80, radius: 3 },
      { material: MATERIAL.Moss, x: 82, y: 94, radius: 5 },
      { material: MATERIAL.Fungus, x: 132, y: 96, radius: 4 },
      { material: MATERIAL.Stardust, x: 157, y: 44, radius: 2 }
    ]
  },
  {
    id: "stardust-fireplace",
    label: "Fire",
    title: "Stardust Fireplace",
    status: "stardust fireplace preset loaded",
    mood: "stardust",
    commands: [
      { material: MATERIAL.Stone, x: 110, y: 138, radius: 1, repeat: 220, dx: 1 },
      { material: MATERIAL.Wall, x: 166, y: 106, radius: 8 },
      { material: MATERIAL.Stone, x: 166, y: 118, radius: 10 },
      { material: MATERIAL.Wood, x: 166, y: 94, radius: 6 },
      { material: MATERIAL.Fire, x: 166, y: 82, radius: 5 },
      { material: MATERIAL.Smoke, x: 166, y: 62, radius: 5 },
      { material: MATERIAL.Stardust, x: 94, y: 26, radius: 4 },
      { material: MATERIAL.Stardust, x: 120, y: 45, radius: 3 },
      { material: MATERIAL.Meteor, x: 82, y: 18, radius: 2 },
      { material: MATERIAL.Moonwater, x: 52, y: 102, radius: 6 },
      { material: MATERIAL.Ice, x: 46, y: 82, radius: 4 }
    ]
  }
];

export function getDevSceneSeed(id: DevSceneSeedId) {
  return DEV_SCENE_SEEDS.find((preset) => preset.id === id) ?? DEV_SCENE_SEEDS[0];
}

export function applyDevSceneSeed(engine: SandboxEngine, id: DevSceneSeedId) {
  const preset = getDevSceneSeed(id);
  engine.clear();
  for (const command of preset.commands) {
    const repeat = command.repeat ?? 1;
    for (let i = 0; i < repeat; i++) {
      engine.paint(
        command.x + (command.dx ?? 0) * (i - Math.floor(repeat / 2)),
        command.y + (command.dy ?? 0) * i,
        command.radius,
        command.material
      );
    }
  }
  return preset;
}
