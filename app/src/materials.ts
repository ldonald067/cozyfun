export const CELL_STRIDE = 8;

export const MATERIAL = {
  Empty: 0,
  Wall: 1,
  Sand: 2,
  Water: 3,
  Smoke: 4,
  Soil: 5,
  Fire: 6,
  Wood: 7,
  Lava: 8,
  Stone: 9,
  Moss: 10,
  Seed: 11,
  Fungus: 12,
  Oil: 13,
  Ice: 14,
  Steam: 15,
  Stardust: 16,
  Meteor: 17,
  Moonwater: 18
} as const;

export type MaterialId = (typeof MATERIAL)[keyof typeof MATERIAL];

export type MaterialDef = {
  id: MaterialId;
  label: string;
  slug: string;
  color: string;
  palette: string[];
  glow?: string;
  group: "basic" | "life" | "heat" | "cosmic";
};

export const MATERIALS: MaterialDef[] = [
  {
    id: MATERIAL.Empty,
    label: "Eraser",
    slug: "eraser",
    color: "#d7dde8",
    palette: ["#111318"],
    group: "basic"
  },
  {
    id: MATERIAL.Wall,
    label: "Wall",
    slug: "wall",
    color: "#b4b8c4",
    palette: ["#686773", "#777783", "#878591", "#5b5b65"],
    group: "basic"
  },
  {
    id: MATERIAL.Sand,
    label: "Sand",
    slug: "sand",
    color: "#c7aa6a",
    palette: ["#d7bd7a", "#c9aa62", "#b9934f", "#e0ca8c", "#a98245"],
    group: "basic"
  },
  {
    id: MATERIAL.Water,
    label: "Water",
    slug: "water",
    color: "#477fcb",
    palette: ["#315f9e", "#3f78bd", "#5795d8", "#6da8df", "#2c527e"],
    group: "basic"
  },
  {
    id: MATERIAL.Smoke,
    label: "Smoke",
    slug: "smoke",
    color: "#c5ccd6",
    palette: ["#6d737b", "#828992", "#9aa0a8", "#b2b5bb"],
    group: "heat"
  },
  {
    id: MATERIAL.Soil,
    label: "Soil",
    slug: "soil",
    color: "#765238",
    palette: ["#5b3b2a", "#704d35", "#886346", "#4c3024"],
    group: "life"
  },
  {
    id: MATERIAL.Fire,
    label: "Fire",
    slug: "fire",
    color: "#ff7a2d",
    palette: ["#ffd36a", "#ff9b3d", "#ff6d24", "#d9361f", "#fff0a3"],
    glow: "#ff8b3d",
    group: "heat"
  },
  {
    id: MATERIAL.Wood,
    label: "Wood",
    slug: "wood",
    color: "#8d603c",
    palette: ["#6f452b", "#815537", "#9b6b43", "#b18154"],
    group: "life"
  },
  {
    id: MATERIAL.Lava,
    label: "Lava",
    slug: "lava",
    color: "#ff4d1f",
    palette: ["#ffcf58", "#ff812e", "#f0441f", "#9b1f1c", "#ffd98a"],
    glow: "#ff5b25",
    group: "heat"
  },
  {
    id: MATERIAL.Stone,
    label: "Stone",
    slug: "stone",
    color: "#b8bfca",
    palette: ["#555862", "#686b74", "#7d8089", "#4b4e57"],
    group: "basic"
  },
  {
    id: MATERIAL.Moss,
    label: "Moss",
    slug: "moss",
    color: "#58a868",
    palette: ["#376f45", "#4f965e", "#63b977", "#86c98d", "#2d5f3b"],
    group: "life"
  },
  {
    id: MATERIAL.Seed,
    label: "Seed",
    slug: "seed",
    color: "#e0bd68",
    palette: ["#c79448", "#dfb65e", "#f0cf82", "#8e6838"],
    group: "life"
  },
  {
    id: MATERIAL.Fungus,
    label: "Fungus",
    slug: "fungus",
    color: "#c58bd2",
    palette: ["#8f5aa5", "#b775c8", "#d4a0dc", "#e7c0e7", "#704484"],
    group: "life"
  },
  {
    id: MATERIAL.Oil,
    label: "Oil",
    slug: "oil",
    color: "#8ea080",
    palette: ["#151c17", "#20291f", "#313a2e", "#3f4937"],
    group: "basic"
  },
  {
    id: MATERIAL.Ice,
    label: "Ice",
    slug: "ice",
    color: "#a9e6f5",
    palette: ["#7fc8e1", "#a7e1f0", "#d1f5fb", "#76aeca"],
    group: "basic"
  },
  {
    id: MATERIAL.Steam,
    label: "Steam",
    slug: "steam",
    color: "#d9e9ef",
    palette: ["#aac6d1", "#cee2ea", "#eff8fb", "#9fb9c4"],
    glow: "#9dd8ff",
    group: "heat"
  },
  {
    id: MATERIAL.Stardust,
    label: "Stardust",
    slug: "stardust",
    color: "#c7a7ff",
    palette: ["#7d6df0", "#a68cff", "#d2bdff", "#ffe7a2", "#8edcff"],
    glow: "#b99cff",
    group: "cosmic"
  },
  {
    id: MATERIAL.Meteor,
    label: "Meteor",
    slug: "meteor",
    color: "#ff9b4d",
    palette: ["#f04428", "#ff7a30", "#ffc15f", "#6a4c45", "#2c2630"],
    glow: "#ff7a30",
    group: "cosmic"
  },
  {
    id: MATERIAL.Moonwater,
    label: "Moonwater",
    slug: "moonwater",
    color: "#92d9ff",
    palette: ["#5e8fe6", "#7fc8ff", "#a7e7ff", "#d6f7ff", "#bca8ff"],
    glow: "#8bdcff",
    group: "cosmic"
  }
];

export const MATERIAL_BY_ID = new Map(MATERIALS.map((material) => [material.id, material]));

export const GLOW_MATERIALS = new Set(
  MATERIALS.filter((material) => material.glow).map((material) => material.id)
);
