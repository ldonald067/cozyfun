export const MATERIAL_SHOWCASE_QA_LABEL = "material-identity-showcase";
export const MATERIAL_SHOWCASE_TITLE = "Material Identity Showcase";

export function materialShowcaseScript() {
  return `(() => {
    const width = 220;
    const height = 140;
    const stride = 8;
    const material = { Wall: 1, Sand: 2, Water: 3, Smoke: 4, Soil: 5, Fire: 6, Wood: 7, Lava: 8, Stone: 9, Moss: 10, Seed: 11, Fungus: 12, Oil: 13, Ice: 14, Steam: 15, Stardust: 16, Meteor: 17, Moonwater: 18, Flower: 19, Glass: 20, Ember: 21, Pollen: 22, Stem: 23, Rocket: 24, Wellspring: 25, Spark: 26 };
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

    // Stone and wall thermal states on a wall shelf (stone stands would fall now).
    line(116, 154, 107, material.Wall);
    rect(119, 127, 96, 106, material.Stone, 80, 52, flag.Wet);
    rect(130, 138, 94, 106, material.Stone, 72, 64, flag.Frozen | flag.Wet);
    rect(141, 151, 97, 106, material.Stone, 30, 90, flag.Scorched);
    rect(154, 166, 91, 106, material.Wall, 70, 44, flag.Wet);
    rect(168, 179, 92, 106, material.Wall, 28, 76, flag.Scorched);
    // A frost-stressed wall carrying near-crumble melt heat: it should read as cracked.
    rect(154, 166, 77, 89, material.Wall, 145, 60, flag.Frozen);
    for (const [x, y] of [[121, 93], [123, 92], [133, 91], [157, 90], [170, 90]]) setCell(x, y, material.Ice, 90, 28);
    for (const [x, y] of [[145, 93], [146, 92], [147, 93]]) setCell(x, y, material.Fire, 230, 14);
    for (const [x, y] of [[161, 89], [162, 89]]) setCell(x, y, material.Stardust, 180, 20);

    // Wood and living states: wet wood, charred wood, moss carpet, fungus role colors, seeds, flowers.
    line(43, 82, 76, material.Wood, 30, 48);
    line(43, 57, 74, material.Wood, 96, 40, flag.Wet);
    line(60, 74, 73, material.Wood, 18, 84, flag.Scorched);
    rect(46, 63, 65, 72, material.Moss, 160, 88, flag.Wet);
    rect(64, 75, 63, 70, material.Fungus, 96, 96, flag.Wet);
    rect(76, 82, 58, 64, material.Fungus, 130, 116, flag.Wet | flag.Cosmic);
    line(77, 81, 57, material.Moonwater, 140, 22, flag.Cosmic);
    for (const [x, y] of [[75, 57], [78, 55], [81, 56]]) setCell(x, y, material.Stardust, 190, 18, 0, x);
    line(80, 84, 65, material.Oil, 70, 20);
    for (const [x, y] of [[73, 59], [74, 58]]) setCell(x, y, material.Fire, 220, 12);
    for (const [x, y] of [[51, 61], [53, 60], [70, 59], [72, 60]]) setCell(x, y, material.Seed, 120, 24, flag.Wet | flag.Rooted, x);
    // A lilac bloom showing the head's state cues: one flank smothered by oil, the other
    // lit cosmic by moonwater. This used to be six loose rooted crowns at six variants,
    // which now reads as six separate half-open buds in six different hues.
    setCell(88, 57, material.Flower, 100, 48, flag.Rooted, 4);
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      setCell(88 + dx, 57 + dy, material.Flower, 95, 44, 0, 4);
    }
    setCell(90, 57, material.Oil, 70, 20);
    setCell(90, 58, material.Oil, 70, 20);
    setCell(87, 54, material.Moonwater, 140, 22, flag.Cosmic);
    setCell(88, 55, material.Flower, 95, 44, flag.Cosmic, 4);
    for (const [x, y] of [[85, 53], [89, 52], [92, 54]]) setCell(x, y, material.Pollen, 150, 24, 0, x);

    // Cosmic and heat/cold readable outcomes.
    rect(104, 118, 63, 69, material.Moonwater, 130, 24, flag.Cosmic);
    for (const [x, y] of [[99, 62], [101, 63], [120, 62], [122, 63]]) setCell(x, y, material.Stardust, 190, 18, 0, x);
    setCell(126, 59, material.Meteor, 255, 6, 0, 2);
    setCell(127, 60, material.Moonwater, 140, 22, flag.Cosmic, 4);
    setCell(132, 61, material.Water, 80, 12);
    setCell(134, 61, material.Steam, 220, 18);
    setCell(135, 62, material.Stone, 0, 80, flag.Scorched);
    setCell(135, 63, material.Wall, 0, 20);
    setCell(136, 60, material.Meteor, 255, 6, 0, 3);
    rect(139, 151, 65, 72, material.Lava, 250, 18);
    line(140, 150, 63, material.Steam, 130, 18);
    setCell(152, 66, material.Water, 80, 16);
    setCell(153, 65, material.Steam, 220, 18);
    setCell(154, 66, material.Stone, 0, 80, flag.Scorched);
    setCell(154, 67, material.Wall, 0, 20);
    rect(160, 174, 62, 71, material.Ice, 90, 24);

    // Heat family lineup: airy fire, crusted lava, glowing ember, and a streaking meteor side by side.
    line(26, 62, 32, material.Wall, 0, 40);
    rect(27, 33, 27, 31, material.Fire, 230, 6);
    rect(39, 49, 28, 31, material.Lava, 250, 20);
    line(54, 61, 31, material.Ember, 220, 20);
    setCell(67, 23, material.Meteor, 255, 4, 0, 2);

    // Ember arc: hot embers on a burning log end, cooled char, and a quenched wet char row.
    line(60, 66, 76, material.Ember, 220, 20);
    line(68, 74, 76, material.Ember, 0, 200);
    line(76, 80, 76, material.Ember, 0, 220, flag.Wet);
    setCell(59, 75, material.Fire, 220, 10);

    // Smoke: dry vapor rising off open flame (generated-only), above the heat lineup.
    for (const [x, y] of [[28, 24], [30, 23], [31, 25], [29, 22]]) setCell(x, y, material.Smoke, 80, 40, 0, x);

    // Freeze-thaw weathering: frost-stressed wall with visible stress cracks beside ice and fire.
    rect(24, 32, 62, 71, material.Wall, 170, 80, flag.Frozen);
    for (const [x, y] of [[22, 63], [22, 66], [22, 69]]) setCell(x, y, material.Ice, 90, 28);
    for (const [x, y] of [[34, 68], [34, 69]]) setCell(x, y, material.Fire, 230, 10);

    // Grown plants: the bloom arc side by side, in the exact cell layout the sim
    // produces — a head is a crown (rooted, the disc) with petals opened around it, on a
    // leafy stalk. Three stages and three of the five garden hues, because hue is chosen
    // by variant and a single specimen cannot show that a head is one flat colour.
    // The bed is Wall, not Stone and not bare soil: soil is a powder, so an unsupported
    // planter falls the moment the capture's sim starts and takes the whole plant with it.
    line(196, 216, 75, material.Wall);
    // Crown and petal energies sit below CROWN_RESERVE and above the shed floor on
    // purpose, so the exhibit cannot open extra petals or drop them while the page runs.
    const plant = (bx, by, variant, stalk, leaves) => {
      setCell(bx, by, material.Soil, 120, 40, flag.Wet);
      for (let i = 1; i <= stalk; i++) setCell(bx, by - i, material.Stem, 20, 50, i === 1 ? flag.Rooted : 0, variant);
      for (const [lx, ly] of leaves) setCell(bx + lx, by - ly, material.Stem, 12, 40, 0, variant);
    };
    // Open cornflower head: crown at the middle, seven petals around it, stem below.
    plant(199, 74, 0, 5, [[-1, 2], [1, 4]]);
    setCell(199, 68, material.Flower, 100, 200, flag.Rooted, 0);
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      setCell(199 + dx, 68 + dy, material.Flower, 95, 180, 0, 0);
    }
    // Unopened buttercup bud: a lone crown, no petals yet.
    plant(206, 74, 3, 4, [[-1, 2]]);
    setCell(206, 69, material.Flower, 100, 20, flag.Rooted, 3);
    // Spent tulip head part way through shedding: petals gone from one flank, and the
    // low energy on what is left is what drives the wilt tint.
    plant(213, 74, 1, 5, [[1, 2], [-1, 4]]);
    setCell(213, 68, material.Flower, 45, 1300, flag.Rooted, 1);
    // The surviving petals stay attached to the crown. A petal left stranded on its own
    // has no Flower neighbours, so it correctly renders as a bud — true to the rule, but
    // it reads as a stray blob in a lineup meant to show a thinning head.
    for (const [dx, dy] of [[0, -1], [1, -1], [1, 0]]) {
      setCell(213 + dx, 68 + dy, material.Flower, 45, 1320, 0, 1);
    }

    // Geology: a larger stone mass with mineral veins and an old patinated wall.
    rect(24, 44, 44, 56, material.Stone, 0, 60);
    line(24, 44, 57, material.Wall);
    rect(208, 217, 96, 106, material.Wall, 0, 20000);

    // Constellation etching: stardust resting on stone/wall leaves cosmic glitter veins.
    rect(184, 196, 100, 106, material.Stone, 36, 90, flag.Cosmic);
    line(184, 196, 107, material.Wall);
    rect(198, 206, 98, 106, material.Wall, 36, 90, flag.Cosmic);
    for (const [x, y] of [[186, 98], [191, 97], [200, 96]]) setCell(x, y, material.Stardust, 190, 30, 0, x);

    // Vitrified glass: a fresh warm pane beside the lava pool, and a cooled pane deep
    // enough to show true interior (see-through) against open night, not just its rims.
    rect(139, 151, 74, 75, material.Glass, 0, 12);
    rect(96, 110, 100, 108, material.Glass, 0, 220);
    line(96, 110, 109, material.Sand, 0, 60);
    line(96, 110, 110, material.Wall);
    // Dewed pane: a fogged, wet terrarium wall so the condensation film and droplet
    // runs are reviewable over the new transparent base.
    rect(84, 90, 100, 108, material.Glass, 40, 90, flag.Wet);
    setCell(85, 99, material.Steam, 200, 20);
    line(84, 90, 109, material.Wall);

    // Vitrify flash, clear of the lava pool so the bloom is attributable to the glass
    // itself: an age-0 pane still white-hot from fusing, beside the same pane cooled.
    // (The lava-side exhibit sits inside lava's own halo and cannot evidence this.)
    rect(178, 184, 64, 70, material.Glass, 0, 0);
    rect(187, 191, 64, 70, material.Glass, 0, 220);
    line(178, 191, 71, material.Wall);

    // Attunement legibility at the smallest placement: a single attuned block beside a
    // single dormant one. Moonwater is the closest attuned hue to the dormant pewter,
    // so this pair is the honest worst case for telling lit from unlit at one cell.
    setCell(180, 76, material.Wellspring, material.Moonwater, 40, 0, 3);
    setCell(184, 76, material.Wellspring, 0, 40, 0, 3);
    setCell(180, 77, material.Wall); setCell(184, 77, material.Wall);

    // Water-type contrast: ordinary water picks up earth/oil/life contact, moonwater lights hard surfaces.
    line(118, 127, 90, material.Moonwater, 140, 22, flag.Cosmic);
    line(154, 166, 88, material.Moonwater, 140, 22, flag.Cosmic);
    line(92, 103, 91, material.Water, 80, 28);
    line(96, 104, 90, material.Oil, 70, 22);
    line(88, 93, 92, material.Soil, 120, 28, flag.Wet);

    // Wellspring pair: a water-attuned block pouring into a walled basin, and a dormant block beside it.
    rect(160, 168, 118, 118, material.Wall);
    setCell(160, 117, material.Wall); setCell(168, 117, material.Wall);
    setCell(160, 116, material.Wall); setCell(168, 116, material.Wall);
    for (const [x, y] of [[163, 112], [164, 112], [165, 112]]) setCell(x, y, material.Wellspring, material.Water, 40, 0, x);
    setCell(172, 117, material.Wellspring, 0, 40, 0, 1);

    // Firework arc: an inert rocket powder charge on stone and a lit grain climbing mid-flight.
    line(126, 134, 108, material.Wall);
    for (const [x, y] of [[128, 107], [129, 107], [130, 107], [131, 107], [129, 106], [130, 106]]) setCell(x, y, material.Rocket, 0, 30, 0, x);
    setCell(122, 96, material.Rocket, 235, 6, 0, 2);

    // Firework burst: a spark shell in festive hues (gold, rose, mint, sky, magenta) that
    // reads apart from cool Stardust. Ages past the white-hot birth so the hues show.
    for (const [x, y] of [
      [130, 86], [127, 88], [133, 88], [125, 90], [135, 90], [128, 91],
      [132, 91], [130, 89], [124, 92], [136, 92], [126, 94], [134, 94],
    ]) setCell(x, y, material.Spark, 190, 8, 0, x);

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
