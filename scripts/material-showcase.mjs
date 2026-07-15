export const MATERIAL_SHOWCASE_QA_LABEL = "material-identity-showcase";
export const MATERIAL_SHOWCASE_TITLE = "Material Identity Showcase";

export function materialShowcaseScript() {
  return `(() => {
    const width = 220;
    const height = 140;
    const stride = 8;
    const material = { Wall: 1, Sand: 2, Water: 3, Soil: 5, Fire: 6, Wood: 7, Lava: 8, Stone: 9, Moss: 10, Seed: 11, Fungus: 12, Oil: 13, Ice: 14, Steam: 15, Stardust: 16, Meteor: 17, Moonwater: 18, Flower: 19, Glass: 20, Ember: 21 };
    const flag = { Wet: 1, Rooted: 2, Cosmic: 4, Frozen: 8, Scorched: 16 };
    const cells = new Uint8Array(width * height * stride);
    const writeU16 = (offset, value) => {
      cells[offset] = value & 255;
      cells[offset + 1] = (value >> 8) & 255;
    };
    const setCell = (x, y, kind, energy = 0, age = 0, flags = 0, variant = 0) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const offset = (y * width + x) * stride;
      cells[offset] = kind;
      cells[offset + 1] = variant & 7;
      writeU16(offset + 2, age);
      writeU16(offset + 4, energy);
      writeU16(offset + 6, flags);
    };
    const line = (x1, x2, y, kind, energy = 0, age = 0, flags = 0) => {
      for (let x = x1; x <= x2; x++) setCell(x, y, kind, energy, age, flags, x + y);
    };
    const rect = (x1, x2, y1, y2, kind, energy = 0, age = 0, flags = 0) => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) setCell(x, y, kind, energy, age, flags, x * 3 + y);
    };

    // Basin: oil should visibly sit over water instead of mixing like another liquid.
    line(22, 66, 104, material.Wall);
    line(22, 66, 87, material.Wall);
    for (let y = 88; y <= 103; y++) {
      setCell(22, y, material.Wall, 0, 0, y);
      setCell(66, y, material.Wall, 0, 0, y);
    }
    rect(28, 60, 96, 103, material.Water, 80, 24);
    rect(30, 58, 90, 95, material.Oil, 70, 28);
    line(34, 53, 89, material.Oil, 90, 44);

    // Sand states: loose pile, wet clump, dried edge, and scorched/frozen variants.
    for (let x = 72; x <= 106; x++) {
      const heightOffset = Math.max(0, Math.floor((x - 72) / 5) - Math.floor((x - 91) / 6));
      for (let y = 104 - heightOffset; y <= 108; y++) setCell(x, y, material.Sand, 0, 42, 0, x + y);
    }
    rect(84, 101, 96, 102, material.Sand, 92, 36, flag.Wet);
    line(86, 98, 95, material.Water, 70, 18);
    rect(104, 112, 99, 105, material.Sand, 0, 80, flag.Scorched);
    rect(74, 82, 94, 101, material.Sand, 70, 34, flag.Frozen);

    // Stone and wall thermal states: damp, frost, scorched, and cosmic-tinted cracks.
    line(116, 154, 107, material.Stone);
    rect(119, 127, 96, 106, material.Stone, 80, 52, flag.Wet);
    rect(130, 138, 94, 106, material.Stone, 72, 64, flag.Frozen | flag.Wet);
    rect(141, 151, 97, 106, material.Stone, 30, 90, flag.Scorched);
    rect(154, 166, 91, 106, material.Wall, 70, 44, flag.Wet);
    rect(168, 179, 92, 106, material.Wall, 28, 76, flag.Scorched);
    for (const [x, y] of [[121, 93], [123, 92], [133, 91], [157, 90], [170, 90]]) setCell(x, y, material.Ice, 90, 28);
    for (const [x, y] of [[145, 93], [146, 92], [147, 93]]) setCell(x, y, material.Fire, 230, 14);
    for (const [x, y] of [[161, 89], [162, 89]]) setCell(x, y, material.Stardust, 180, 20);

    // Wood and living states: wet wood, charred wood, moss carpet, fungus role colors, seeds, flowers.
    line(43, 82, 76, material.Wood, 30, 48);
    line(43, 57, 74, material.Wood, 96, 40, flag.Wet);
    line(60, 74, 73, material.Wood, 18, 84, flag.Scorched);
    rect(46, 63, 65, 72, material.Moss, 110, 88, flag.Wet);
    rect(64, 75, 63, 70, material.Fungus, 96, 96, flag.Wet);
    rect(76, 82, 58, 64, material.Fungus, 130, 116, flag.Wet | flag.Cosmic);
    line(77, 81, 57, material.Moonwater, 140, 22, flag.Cosmic);
    for (const [x, y] of [[75, 57], [78, 55], [81, 56]]) setCell(x, y, material.Stardust, 190, 18, 0, x);
    line(80, 84, 65, material.Oil, 70, 20);
    for (const [x, y] of [[73, 59], [74, 58]]) setCell(x, y, material.Fire, 220, 12);
    for (const [x, y] of [[51, 61], [53, 60], [70, 59], [72, 60]]) setCell(x, y, material.Seed, 120, 24, flag.Wet | flag.Rooted, x);
    for (const [x, y] of [[86, 58], [87, 57], [88, 58], [89, 57], [90, 58], [88, 55]]) setCell(x, y, material.Flower, 130, 48, flag.Rooted, x + y);
    setCell(91, 57, material.Oil, 70, 20);
    setCell(87, 54, material.Moonwater, 140, 22, flag.Cosmic);

    // Cosmic and heat/cold readable outcomes.
    rect(104, 118, 63, 69, material.Moonwater, 130, 24, flag.Cosmic);
    for (const [x, y] of [[99, 62], [101, 63], [120, 62], [122, 63]]) setCell(x, y, material.Stardust, 190, 18, 0, x);
    setCell(126, 59, material.Meteor, 255, 6, 0, 2);
    setCell(127, 60, material.Moonwater, 140, 22, flag.Cosmic, 4);
    setCell(132, 61, material.Water, 80, 12);
    setCell(134, 61, material.Steam, 220, 18);
    setCell(135, 62, material.Stone, 0, 80, flag.Scorched);
    setCell(136, 60, material.Meteor, 255, 6, 0, 3);
    rect(139, 151, 65, 72, material.Lava, 250, 18);
    line(140, 150, 63, material.Steam, 130, 18);
    setCell(152, 66, material.Water, 80, 16);
    setCell(153, 65, material.Steam, 220, 18);
    setCell(154, 66, material.Stone, 0, 80, flag.Scorched);
    rect(160, 174, 62, 71, material.Ice, 90, 24);

    // Heat family lineup: airy fire, crusted lava, glowing ember, and a streaking meteor side by side.
    line(26, 62, 32, material.Stone, 0, 40);
    rect(27, 33, 27, 31, material.Fire, 230, 6);
    rect(39, 49, 28, 31, material.Lava, 250, 20);
    line(54, 61, 31, material.Ember, 220, 20);
    setCell(67, 23, material.Meteor, 255, 4, 0, 2);

    // Ember arc: hot embers on a burning log end, cooled char, and a quenched wet char row.
    line(60, 66, 76, material.Ember, 220, 20);
    line(68, 74, 76, material.Ember, 0, 200);
    line(76, 80, 76, material.Ember, 0, 220, flag.Wet);
    setCell(59, 75, material.Fire, 220, 10);

    // Freeze-thaw weathering: frost-stressed wall with visible stress cracks beside ice and fire.
    rect(24, 32, 62, 71, material.Wall, 170, 80, flag.Frozen);
    for (const [x, y] of [[22, 63], [22, 66], [22, 69]]) setCell(x, y, material.Ice, 90, 28);
    for (const [x, y] of [[34, 68], [34, 69]]) setCell(x, y, material.Fire, 230, 10);

    // Constellation etching: stardust resting on stone/wall leaves cosmic glitter veins.
    rect(184, 196, 100, 106, material.Stone, 36, 90, flag.Cosmic);
    rect(198, 206, 98, 106, material.Wall, 36, 90, flag.Cosmic);
    for (const [x, y] of [[186, 98], [191, 97], [200, 96]]) setCell(x, y, material.Stardust, 190, 30, 0, x);

    // Vitrified glass: fresh warm pane beside the lava pool and a cooled pane over sand.
    rect(139, 151, 74, 75, material.Glass, 0, 12);
    rect(96, 110, 106, 108, material.Glass, 0, 220);
    line(96, 110, 109, material.Sand, 0, 60);

    // Water-type contrast: ordinary water picks up earth/oil/life contact, moonwater lights hard surfaces.
    line(118, 127, 90, material.Moonwater, 140, 22, flag.Cosmic);
    line(154, 166, 88, material.Moonwater, 140, 22, flag.Cosmic);
    line(92, 103, 91, material.Water, 80, 28);
    line(96, 104, 90, material.Oil, 70, 22);
    line(88, 93, 92, material.Soil, 120, 28, flag.Wet);

    let binary = "";
    for (let i = 0; i < cells.length; i += 0x8000) binary += String.fromCharCode(...cells.slice(i, i + 0x8000));
    localStorage.setItem("cozy-pixel-sandbox:scene:v1", JSON.stringify({
      format: "CXS2",
      width,
      height,
      tick: 0,
      engine: "wasm",
      cells: btoa(binary),
      savedAt: new Date().toISOString(),
      metadata: { app: "cozy-pixel-sandbox", title: "${MATERIAL_SHOWCASE_TITLE}", room: "snow-window", mood: "rain", musicProvider: "generated" }
    }));
    document.querySelector('[data-testid="load-scene"]').click();
    return true;
  })()`;
}
