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
  Flower: 19,
  Glass: 20,
  Ember: 21,
  Pollen: 22,
  Stem: 23,
  Rocket: 24,
  Wellspring: 25,
  Spark: 26
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
    group: "heat",
    userSelectable: false
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
    color: "#ffb03a",
    palette: ["#fff3b0", "#ffd76a", "#ffb03a", "#ff8a2d", "#ffe995"],
    glow: "#ffc063",
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
    color: "#c9331a",
    palette: ["#8f1f12", "#b32c15", "#d84418", "#6e1810", "#3a1210"],
    glow: "#ff4a1c",
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
    palette: ["#4f2b1d", "#7bbf63", "#8c5930", "#67aa54", "#9ed67e", "#c8e09a"],
    group: "life"
  },
  {
    id: MATERIAL.Fungus,
    label: "Fungus",
    slug: "fungus",
    description: "Decomposer that rots wet seeds, overtakes old moss, and feeds on wood or soil.",
    identity: ["Decay pressure", "Contact-colored caps and spores"],
    color: "#d283bd",
    palette: ["#a8508f", "#cc6fb0", "#e39aca", "#f0c2dd", "#83407a"],
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
    id: MATERIAL.Stem,
    label: "Stem",
    slug: "stem",
    description: "Generated plant stalk grown from a rooted seed, blooming at its tip.",
    identity: ["Climbing plant stalk", "Blooms a flower at its tip"],
    color: "#7cc258",
    palette: ["#69b54a", "#84cc5f", "#a4dd7a", "#4c8f38"],
    group: "life",
    userSelectable: false
  },
  {
    id: MATERIAL.Pollen,
    label: "Pollen",
    slug: "pollen",
    description: "Generated golden motes drifting from mature flowers that can seed damp soil.",
    identity: ["Drifting golden motes", "Settles and seeds damp soil"],
    color: "#ffdf8e",
    palette: ["#ffe9a8", "#ffd97e", "#fff4cd", "#e8c26a"],
    glow: "#ffe6a0",
    group: "life",
    userSelectable: false
  },
  {
    id: MATERIAL.Ember,
    label: "Ember",
    slug: "ember",
    description: "Generated glowing remains of burning wood that cool into relightable char.",
    identity: ["Glowing wood remains", "Cools into relightable char"],
    color: "#c96a35",
    palette: ["#2e1d14", "#4a2f1c", "#6b3a1e", "#241811"],
    glow: "#ff7a30",
    group: "heat",
    userSelectable: false
  },
  {
    id: MATERIAL.Glass,
    label: "Glass",
    slug: "glass",
    description: "Generated pane fused where strong heat vitrifies dry sand.",
    identity: ["Heat-fused sand pane", "Translucent glints over warm seams"],
    color: "#7fcfba",
    palette: ["#79c9b8", "#95e0d0", "#bff2e6", "#5faa9e"],
    group: "basic",
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
    color: "#d3dade",
    palette: ["#b3bcc3", "#d2d9de", "#edf0f2", "#a2abb2"],
    glow: "#c7d4dc",
    group: "heat",
    userSelectable: false
  },
  {
    id: MATERIAL.Stardust,
    label: "Stardust",
    slug: "stardust",
    description: "Cosmic powder that charges water, feeds life, and twinkles through air.",
    identity: ["Cosmic drifting powder", "Charges water and life"],
    color: "#9d7ef5",
    palette: ["#5c48d8", "#8a66f2", "#b48cff", "#ffd98a", "#6a54e0"],
    glow: "#ffd27e",
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
    id: MATERIAL.Wellspring,
    label: "Wellspring",
    slug: "wellspring",
    description: "Carved block that drinks the first material to touch it and pours it back out forever.",
    identity: ["Identity-drinking carved block", "Endlessly pours its remembered material"],
    color: "#41598c",
    palette: ["#2a3a5e", "#354a74", "#1f2c49", "#7e97c4"],
    group: "cosmic"
  },
  {
    id: MATERIAL.Rocket,
    label: "Rocket",
    slug: "rocket",
    description: "Festival powder that lies quiet until flame lights it, then leaps skyward and bursts.",
    identity: ["Inert firework powder", "Flame sends it up into a spark burst"],
    color: "#c23a4a",
    palette: ["#9c2838", "#c23a4a", "#7a1e2c", "#e8dcd2"],
    group: "cosmic"
  },
  {
    id: MATERIAL.Spark,
    label: "Spark",
    slug: "spark",
    description: "Generated firework spark that flies out from a rocket burst, twinkles, and fades.",
    identity: ["Flying firework spark", "Twinkles out in falling color"],
    color: "#ec96d0",
    palette: ["#ff79b8", "#b98cff", "#6fe0d8", "#ff9ad2"],
    glow: "#ffb4dc",
    group: "cosmic",
    userSelectable: false
  },
  {
    id: MATERIAL.Moonwater,
    label: "Moonwater",
    slug: "moonwater",
    description: "Cosmic liquid that supercharges growth and cleans oil into stardust.",
    identity: ["Cosmic growth liquid", "Cleans oil into stardust"],
    color: "#aab4f2",
    palette: ["#7284e0", "#96a8f2", "#c2c8ff", "#e9e5ff", "#c9aefc"],
    glow: "#8fb4ff",
    group: "cosmic"
  }
];

export const MATERIAL_BY_ID = new Map(MATERIALS.map((material) => [material.id, material]));

export const GLOW_MATERIALS = new Set(
  MATERIALS.filter((material) => material.glow).map((material) => material.id)
);
