export const CELL_STRIDE = 8;

export const CELL_FLAG = {
  Wet: 1 << 0,
  Rooted: 1 << 1,
  Cosmic: 1 << 2,
  Frozen: 1 << 3,
  Scorched: 1 << 4
} as const;

export const CELL_FLAG_MASK =
  CELL_FLAG.Wet | CELL_FLAG.Rooted | CELL_FLAG.Cosmic | CELL_FLAG.Frozen | CELL_FLAG.Scorched;

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
  Moonwater: 18,
  Flower: 19
} as const;

export type MaterialId = (typeof MATERIAL)[keyof typeof MATERIAL];

export type MaterialDef = {
  id: MaterialId;
  label: string;
  slug: string;
  description: string;
  identity: readonly [string, string];
  color: string;
  palette: string[];
  glow?: string;
  group: "basic" | "life" | "heat" | "cosmic";
  userSelectable?: boolean;
};

export const MATERIALS: MaterialDef[] = [
  {
    id: MATERIAL.Empty,
    label: "Eraser",
    slug: "eraser",
    description: "Clears cells without adding a material.",
    identity: ["Tool action", "Clears cells"],
    color: "#d7dde8",
    palette: ["#111318"],
    group: "basic"
  },
  {
    id: MATERIAL.Wall,
    label: "Wall",
    slug: "wall",
    description: "Built barrier that blocks flow, stains slowly, and resists casual growth.",
    identity: ["Sealed construction barrier", "Brick pattern stains slowly"],
    color: "#c2c8d4",
    palette: ["#6a7180", "#7d8492", "#969da9", "#b7bcc6", "#555d6b"],
    group: "basic"
  },
  {
    id: MATERIAL.Sand,
    label: "Sand",
    slug: "sand",
    description: "Loose grain that falls, clumps when wet, and dries back out.",
    identity: ["Falling loose powder", "Wet clumps dry loose again"],
    color: "#c7aa6a",
    palette: ["#d7bd7a", "#c9aa62", "#b9934f", "#e0ca8c", "#a98245"],
    group: "basic"
  },
  {
    id: MATERIAL.Water,
    label: "Water",
    slug: "water",
    description: "Flowing liquid that hydrates soil and life, cools heat, and clumps sand.",
    identity: ["Practical hydration and cooling", "Earthy and oily contact ripples"],
    color: "#477fcb",
    palette: ["#315f9e", "#3f78bd", "#5795d8", "#6da8df", "#2c527e"],
    group: "basic"
  },
  {
    id: MATERIAL.Smoke,
    label: "Smoke",
    slug: "smoke",
    description: "Dry vapor from fire that rises, fades, and leaves soot on hard surfaces.",
    identity: ["Dry rising vapor", "Soots hard surfaces"],
    color: "#d3d9e1",
    palette: ["#7d848c", "#969da6", "#b0b6be", "#c7ccd2"],
    group: "heat"
  },
  {
    id: MATERIAL.Soil,
    label: "Soil",
    slug: "soil",
    description: "Falling organic substrate that stores moisture and can green into moss.",
    identity: ["Moisture-storing substrate", "Greens into moss"],
    color: "#765238",
    palette: ["#5b3b2a", "#704d35", "#886346", "#4c3024"],
    group: "life"
  },
  {
    id: MATERIAL.Fire,
    label: "Fire",
    slug: "fire",
    description: "Short-lived heat that dries, scorches, burns fuel, and makes smoke or steam.",
    identity: ["Short-lived heat", "Dries before ignition"],
    color: "#ff7a2d",
    palette: ["#ffd36a", "#ff9b3d", "#ff6d24", "#d9361f", "#fff0a3"],
    glow: "#ff8b3d",
    group: "heat"
  },
  {
    id: MATERIAL.Wood,
    label: "Wood",
    slug: "wood",
    description: "Soft fuel and substrate that can char, dampen, host moss, or feed fungus.",
    identity: ["Soft fuel substrate", "Wet wood vents steam"],
    color: "#8d603c",
    palette: ["#6f452b", "#815537", "#9b6b43", "#b18154"],
    group: "life"
  },
  {
    id: MATERIAL.Lava,
    label: "Lava",
    slug: "lava",
    description: "Slow hot liquid that ignites fuel and cools into natural stone.",
    identity: ["Slow hot liquid", "Cools into scorched stone"],
    color: "#ff4d1f",
    palette: ["#ffcf58", "#ff812e", "#f0441f", "#9b1f1c", "#ffd98a"],
    glow: "#ff5b25",
    group: "heat"
  },
  {
    id: MATERIAL.Stone,
    label: "Stone",
    slug: "stone",
    description: "Natural hard material that blocks, weathers, frosts, and hosts damp moss.",
    identity: ["Natural weatherable hard block", "Condenses and hosts moss readily"],
    color: "#b8bfca",
    palette: ["#555862", "#686b74", "#7d8089", "#4b4e57"],
    group: "basic"
  },
  {
    id: MATERIAL.Moss,
    label: "Moss",
    slug: "moss",
    description: "Surface carpet that spreads over damp substrates instead of blooming.",
    identity: ["Damp surface carpet", "Leafy patches spread over substrate"],
    color: "#58a868",
    palette: ["#376f45", "#4f965e", "#63b977", "#86c98d", "#2d5f3b"],
    group: "life"
  },
  {
    id: MATERIAL.Seed,
    label: "Seed",
    slug: "seed",
    description: "Rooting life that needs water and soil to bloom into generated flowers.",
    identity: ["Rooting potential", "Blooms only when fed and grounded"],
    color: "#7fc66f",
    palette: ["#4f2b1d", "#6c3d23", "#8c5930", "#67aa54", "#8acb6c", "#d0a15f"],
    group: "life"
  },
  {
    id: MATERIAL.Fungus,
    label: "Fungus",
    slug: "fungus",
    description: "Decomposer that rots wet seeds, overtakes old moss, and feeds on wood or soil.",
    identity: ["Decay pressure", "Contact-colored caps and spores"],
    color: "#c58bd2",
    palette: ["#8f5aa5", "#b775c8", "#d4a0dc", "#e7c0e7", "#704484"],
    group: "life"
  },
  {
    id: MATERIAL.Flower,
    label: "Flower",
    slug: "flower",
    description: "Generated bloom outcome from healthy rooted seeds.",
    identity: ["Generated bloom outcome", "Petals react to wet and cosmic states"],
    color: "#f0c25f",
    palette: ["#75b95e", "#f3cf69", "#f38fbe", "#e8f3a8", "#b98dff", "#fff4c2"],
    glow: "#f7d574",
    group: "life",
    userSelectable: false
  },
  {
    id: MATERIAL.Oil,
    label: "Oil",
    slug: "oil",
    description: "Floating smothering liquid that blocks hydration and burns readily.",
    identity: ["Floating coating liquid", "Smothers water-fed growth"],
    color: "#8ea080",
    palette: ["#151c17", "#20291f", "#313a2e", "#3f4937"],
    group: "basic"
  },
  {
    id: MATERIAL.Ice,
    label: "Ice",
    slug: "ice",
    description: "Cold solid that freezes nearby liquid and pauses living material.",
    identity: ["Cold solid", "Freezes liquid and pauses life"],
    color: "#a9e6f5",
    palette: ["#7fc8e1", "#a7e1f0", "#d1f5fb", "#76aeca"],
    group: "basic"
  },
  {
    id: MATERIAL.Steam,
    label: "Steam",
    slug: "steam",
    description: "Wet vapor that rises, condenses on hard surfaces, and frosts near ice.",
    identity: ["Wet rising vapor", "Condenses or frosts"],
    color: "#d9e9ef",
    palette: ["#aac6d1", "#cee2ea", "#eff8fb", "#9fb9c4"],
    glow: "#9dd8ff",
    group: "heat"
  },
  {
    id: MATERIAL.Stardust,
    label: "Stardust",
    slug: "stardust",
    description: "Cosmic powder that charges water, feeds life, and twinkles through air.",
    identity: ["Cosmic drifting powder", "Charges water and life"],
    color: "#c7a7ff",
    palette: ["#7d6df0", "#a68cff", "#d2bdff", "#ffe7a2", "#8edcff"],
    glow: "#b99cff",
    group: "cosmic"
  },
  {
    id: MATERIAL.Meteor,
    label: "Meteor",
    slug: "meteor",
    description: "Hot falling cosmic rock that impacts into fire, stone, or stardust.",
    identity: ["Falling cosmic impact", "Crashes into fire, stone, or stardust"],
    color: "#ff9b4d",
    palette: ["#f04428", "#ff7a30", "#ffc15f", "#6a4c45", "#2c2630"],
    glow: "#ff7a30",
    group: "cosmic"
  },
  {
    id: MATERIAL.Moonwater,
    label: "Moonwater",
    slug: "moonwater",
    description: "Cosmic liquid that supercharges growth and cleans oil into stardust.",
    identity: ["Cosmic growth liquid", "Cleans oil into stardust"],
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
