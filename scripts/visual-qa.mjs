import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assert,
  assertDistExists,
  captureScreenshot,
  clickPoint as click,
  clickSelector,
  connectToFirstPage,
  dragPath as drag,
  evaluate,
  sleep,
  startBrowser,
  startStaticServer,
  statusText,
  waitUntil
} from "./browser-qa-helpers.mjs";
import { MATERIAL_SHOWCASE_QA_LABEL, materialShowcaseScript } from "./material-showcase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");
const outputDir = path.join(root, ".tmp", "visual-qa");

async function main() {
  await assertDistExists(distDir, "Build the app before running visual QA: npm run build");
  await mkdir(outputDir, { recursive: true });

  const staticServer = await startStaticServer(distDir);
  const browser = await startBrowser({ profilePrefix: "cozy-visual-", windowSize: "1280,900" });

  try {
    const cdp = await connectToFirstPage(browser.debugPort);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    const appUrl = `http://127.0.0.1:${staticServer.port}/?visualQa=${MATERIAL_SHOWCASE_QA_LABEL}`;
    await cdp.send("Page.navigate", { url: appUrl });
    await waitUntil(
      () => evaluate(cdp, `document.readyState === "complete" && Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`),
      "app shell"
    );
    await waitUntil(async () => (await statusText(cdp)).includes("online"), "engine online");

    await paintCurrentVisualScene(cdp);
    const materialCapture = await saveSandboxComposite(cdp, "current-materials.png");
    await loadMaterialShowcase(cdp);
    const materialShowcaseCapture = await saveSandboxComposite(cdp, `${MATERIAL_SHOWCASE_QA_LABEL}.png`);
    const desktopLayout = await layoutState(cdp);
    assert(desktopLayout.controlsBottom <= desktopLayout.viewportHeight + 1, `desktop controls overflow vertically: ${JSON.stringify(desktopLayout)}`);
    assert(desktopLayout.materialsBottom <= desktopLayout.viewportHeight + 1, `desktop materials overflow vertically: ${JSON.stringify(desktopLayout)}`);
    const roomCaptures = await saveRoomCaptures(cdp);

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 820,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(180);
    const mobileLayout = await layoutState(cdp);
    assert(mobileLayout.viewportWidth <= 390, `unexpected mobile viewport: ${JSON.stringify(mobileLayout)}`);
    assert(mobileLayout.controlsRight <= mobileLayout.viewportWidth + 1, `mobile controls overflow: ${JSON.stringify(mobileLayout)}`);

    await writeFile(path.join(outputDir, "current-layout.json"), JSON.stringify({ desktopLayout, mobileLayout }, null, 2));
    const screenshotCapture = await trySaveScreenshot(cdp, "current-mobile-layout.png");

    await cdp.close();

    console.log("Visual QA captures written:");
    console.log(`- ${materialCapture}`);
    console.log(`- ${materialShowcaseCapture}`);
    console.log(`- ${path.join(outputDir, "current-layout.json")}`);
    for (const capture of roomCaptures) console.log(`- ${capture}`);
    if (screenshotCapture) console.log(`- ${screenshotCapture}`);
  } finally {
    await browser.close();
    await staticServer.close();
  }
}

async function loadMaterialShowcase(cdp) {
  await evaluate(cdp, materialShowcaseScript());
  await waitUntil(async () => (await statusText(cdp)).includes("browser save loaded"), "material showcase");
  await sleep(600);
}

async function saveRoomCaptures(cdp) {
  const captures = [];
  for (const room of [
    { id: "rain-desk", fileName: "room-rain-desk.png" },
    { id: "moonwater-garden", fileName: "room-moonwater-garden.png" },
    { id: "stardust-hearth", fileName: "room-stardust-hearth.png" },
    { id: "cozy-fireplace", fileName: "room-cozy-fireplace.png" },
    { id: "forest-hut", fileName: "room-forest-hut.png" },
    { id: "snow-window", fileName: "room-snow-window.png" }
  ]) {
    await evaluate(cdp, `window.scrollTo(0, 0); true`);
    await clickSelector(cdp, `[data-testid="scene-environment-${room.id}"]`);
    await sleep(260);
    const capture = await saveScreenshot(cdp, room.fileName);
    captures.push(capture);
  }
  return captures;
}

async function paintCurrentVisualScene(cdp) {
  await evaluate(cdp, `window.scrollTo(0, 0); true`);
  await sleep(120);
  const rects = await evaluate(
    cdp,
    `(() => {
      const rectOf = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
      };
      const materials = {};
      for (const title of [
        "Sand", "Soil", "Seed", "Moss", "Fungus", "Oil", "Wood", "Ice",
        "Water", "Moonwater", "Lava", "Fire", "Smoke", "Steam", "Stardust"
      ]) {
        const button = Array.from(document.querySelectorAll(".material-button")).find((candidate) => candidate.textContent.trim() === title);
        const rect = button?.getBoundingClientRect();
        materials[title] = rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
      }
      return { tray: rectOf('[data-testid="sandbox-tray"]'), clear: rectOf('[data-testid="clear-scene"]'), materials };
    })()`
  );
  assert(rects.tray && rects.clear, "missing tray or clear button for visual QA");

  const clickRect = (rect) => click(cdp, rect.left + rect.width / 2, rect.top + rect.height / 2);
  const select = async (title) => {
    const rect = rects.materials[title];
    assert(rect, `missing material button: ${title}`);
    await clickRect(rect);
  };
  const paint = async (title, xr, yr, steps = 12, dx = 0.01, wiggle = 5) => {
    await select(title);
    const tray = rects.tray;
    const y = tray.top + tray.height * yr;
    const startX = tray.left + tray.width * xr;
    const line = [];
    for (let i = 0; i < steps; i++) {
      line.push({ x: startX + tray.width * dx * i, y: y + Math.sin(i * 0.8) * wiggle });
    }
    await drag(cdp, line);
  };

  await clickRect(rects.clear);
  await paint("Sand", 0.05, 0.80, 30, 0.006, 3);
  await paint("Soil", 0.19, 0.78, 26, 0.006, 3);
  await paint("Seed", 0.22, 0.67, 12, 0.004, 3);
  await paint("Moss", 0.26, 0.62, 18, 0.005, 3);
  await paint("Fungus", 0.30, 0.55, 18, 0.005, 4);
  await paint("Moonwater", 0.42, 0.49, 26, 0.006, 4);
  await paint("Stardust", 0.48, 0.37, 12, 0.004, 4);
  await paint("Water", 0.56, 0.52, 24, 0.006, 4);
  await paint("Oil", 0.61, 0.45, 18, 0.005, 4);
  await paint("Lava", 0.68, 0.52, 18, 0.006, 4);
  await paint("Ice", 0.72, 0.32, 14, 0.005, 4);
  await paint("Wood", 0.82, 0.54, 14, 0.004, 2);
  await paint("Fire", 0.82, 0.39, 12, 0.005, 4);
  await paint("Smoke", 0.86, 0.24, 16, 0.005, 4);
  await paint("Steam", 0.63, 0.29, 14, 0.005, 4);
  await sleep(900);
}

async function saveSandboxComposite(cdp, fileName) {
  const dataUrl = await evaluate(
    cdp,
    `(() => {
      const base = document.querySelector(".base-canvas");
      const glow = document.querySelector(".glow-canvas");
      if (!base || !glow) return null;
      const scale = 4;
      const canvas = document.createElement("canvas");
      canvas.width = base.width * scale;
      canvas.height = base.height * scale;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.imageSmoothingEnabled = false;
      context.fillStyle = "#091018";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = 0.72;
      context.drawImage(glow, 0, 0, canvas.width, canvas.height);
      context.globalAlpha = 1;
      context.drawImage(base, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    })()`
  );
  assert(dataUrl, "failed to capture sandbox canvas");
  const outPath = path.join(outputDir, fileName);
  await writeFile(outPath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
  return outPath;
}

async function trySaveScreenshot(cdp, fileName) {
  try {
    return await saveScreenshot(cdp, fileName);
  } catch {
    return null;
  }
}

async function saveScreenshot(cdp, fileName) {
  return captureScreenshot(cdp, outputDir, fileName);
}

async function layoutState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const tray = document.querySelector(".tray")?.getBoundingClientRect();
      const controls = document.querySelector(".control-panel")?.getBoundingClientRect();
      const materials = document.querySelector(".tool-panel")?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        trayRight: tray?.right ?? 0,
        trayBottom: tray?.bottom ?? 0,
        controlsLeft: controls?.left ?? 0,
        controlsRight: controls?.right ?? 0,
        controlsTop: controls?.top ?? 0,
        controlsBottom: controls?.bottom ?? 0,
        materialsBottom: materials?.bottom ?? 0
      };
    })()`
  );
}

await main();
