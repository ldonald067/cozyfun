import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assert,
  assertAppReachable,
  captureScreenshot,
  clickSelector as click,
  connectToFirstPage,
  evaluate,
  setText,
  waitForStatus,
  waitUntil
} from "./browser-qa-helpers.mjs";
import { MATERIAL_SHOWCASE_QA_LABEL, materialShowcaseScript } from "./material-showcase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "chrome-qa");
const appPort = Number(process.env.CHROME_QA_APP_PORT ?? 4173);
const debugPort = Number(process.argv[2] ?? process.env.CHROME_QA_REMOTE_PORT ?? 9335);
const appUrl = `http://127.0.0.1:${appPort}/?chromeQa=${MATERIAL_SHOWCASE_QA_LABEL}&cache=${Date.now()}`;

async function main() {
  await assertAppReachable(appPort);
  await mkdir(outputDir, { recursive: true });
  const cdp = await connectToFirstPage(debugPort, "Chrome", 15_000);

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__chromeQaErrors = [];
        window.addEventListener("error", (event) => window.__chromeQaErrors.push(event.message || "window error"));
        window.addEventListener("unhandledrejection", (event) => window.__chromeQaErrors.push(String(event.reason || "unhandled rejection")));
        window.__cozyYouTubeMockMode = "ready";
        window.YT = {
          Player: function Player(element, options) {
            const iframe = document.createElement("iframe");
            iframe.src = options.videoId
              ? "https://www.youtube.com/embed/" + options.videoId
              : "https://www.youtube.com/embed/videoseries?list=" + options.playerVars.list;
            iframe.title = "Mock YouTube player";
            element.replaceChildren(iframe);
            setTimeout(() => {
              if (window.__cozyYouTubeMockMode === "blocked") options.events.onError({ data: 150 });
              else options.events.onReady({});
            }, 30);
            this.destroy = () => element.replaceChildren();
          }
        };
      `
    });

    await cdp.send("Page.navigate", { url: appUrl });
    await waitUntil(
      () => evaluate(cdp, `document.readyState === "complete" && Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`),
      "Chrome app shell"
    );
    await waitUntil(async () => (await statusText(cdp)).includes("online"), "engine online");

    const state = await evaluate(
      cdp,
      `(() => ({
        title: document.title,
        status: document.querySelector('[data-testid="status-message"]')?.textContent ?? "",
        styles: Array.from(document.styleSheets).map((sheet) => sheet.href).filter(Boolean),
        scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
        share: document.querySelector(".share-panel")?.textContent ?? "",
        rooms: Array.from(document.querySelectorAll('[data-testid^="scene-environment-"]')).map((button) => button.textContent.trim()),
        providers: Array.from(document.querySelectorAll(".music-source-control button")).map((button) => button.textContent.trim()),
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      }))()`
    );
    assert(state.title === "Cozy Pixel Sandbox", `Chrome loaded unexpected title: ${state.title}`);
    assert(state.status.includes("online"), `Chrome app did not report online: ${state.status}`);
    assert(state.styles.some((href) => href.includes("/assets/index-")), `Chrome did not load built CSS asset: ${state.styles.join(", ")}`);
    assert(state.scripts.some((src) => src.includes("/assets/index-")), `Chrome did not load built JS asset: ${state.scripts.join(", ")}`);
    assert(state.rooms.length === 6, `Chrome room controls mismatch: ${state.rooms.join(", ")}`);
    assert(state.providers.join("|") === "Generated|Desk Radio", `Chrome music providers mismatch: ${state.providers.join(", ")}`);
    assert(!state.hasOverflow, "Chrome desktop layout has horizontal overflow");

    const desktopPath = await capture(cdp, "chrome-current-desktop.png");
    await paintMaterialScene(cdp);
    const paintedPath = await capture(cdp, "chrome-painted-materials.png");
    await loadMaterialShowcase(cdp);
    const materialShowcasePath = await capture(cdp, `chrome-${MATERIAL_SHOWCASE_QA_LABEL}.png`);
    await exerciseDeskRadio(cdp);
    const deskRadioPath = await capture(cdp, "chrome-desk-radio-blocked.png");

    const errors = await evaluate(cdp, `window.__chromeQaErrors ?? []`);
    assert(errors.length === 0, `Chrome page errors: ${errors.join("; ")}`);

    console.log("Chrome QA passed");
    console.log(`- ${desktopPath}`);
    console.log(`- ${paintedPath}`);
    console.log(`- ${materialShowcasePath}`);
    console.log(`- ${deskRadioPath}`);
    console.log(`- ${state.styles.join(", ")}`);
    console.log(`- ${state.scripts.join(", ")}`);
  } finally {
    await cdp.close().catch(() => {});
  }
}

async function loadMaterialShowcase(cdp) {
  await evaluate(cdp, materialShowcaseScript());
  await waitForStatus(cdp, "browser save loaded");
  await evaluate(cdp, `new Promise((resolve) => setTimeout(resolve, 600))`);
}

async function exerciseDeskRadio(cdp) {
  await evaluate(cdp, `window.__cozyYouTubeMockMode = "blocked"`);
  await click(cdp, '[data-testid="music-provider-external"]');
  await waitForStatus(cdp, "desk radio needs a YouTube link");
  await setText(cdp, '[data-testid="desk-radio-input"]', "https://www.youtube.com/watch?v=jfKfPfyJRdk");
  await click(cdp, '[data-testid="desk-radio-tune"]');
  await waitForStatus(cdp, "YouTube blocked embed; generated music restored");
  const state = await evaluate(
    cdp,
    `(() => ({
      generatedActive: document.querySelector('[data-testid="music-provider-generated"]')?.classList.contains("active"),
      message: document.querySelector('[data-testid="desk-radio-message"]')?.textContent ?? "",
      storedSource: localStorage.getItem("cozy-pixel-sandbox:desk-radio:v1")
    }))()`
  );
  assert(state.generatedActive, "Blocked Desk Radio did not return to generated music");
  assert(state.message.includes("will not embed"), `Blocked Desk Radio message was unclear: ${state.message}`);
  assert(state.message.includes("Generated music is selected again"), `Blocked Desk Radio fallback was unclear: ${state.message}`);
  assert(state.storedSource === null, "Blocked Desk Radio source was persisted");
}

async function paintMaterialScene(cdp) {
  await evaluate(
    cdp,
    `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const tray = document.querySelector('[data-testid="sandbox-tray"]');
      const brush = document.querySelector('.brush-control input');
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      valueSetter.call(brush, '2');
      brush.dispatchEvent(new Event('input', { bubbles: true }));
      brush.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(80);
      const materialButton = (title) => Array.from(document.querySelectorAll(".material-button")).find((button) => button.textContent.trim() === title);
      const select = async (title) => {
        materialButton(title)?.click();
        await wait(40);
      };
      const point = (x, y) => {
        const rect = tray.getBoundingClientRect();
        return { clientX: rect.left + rect.width * x, clientY: rect.top + rect.height * y };
      };
      const paint = async (title, points) => {
        await select(title);
        const first = point(points[0][0], points[0][1]);
        tray.dispatchEvent(new PointerEvent("pointerdown", { ...first, bubbles: true, button: 0, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true }));
        for (const [x, y] of points) {
          const next = point(x, y);
          tray.dispatchEvent(new PointerEvent("pointermove", { ...next, bubbles: true, button: 0, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true }));
          await wait(16);
        }
        const last = point(points.at(-1)[0], points.at(-1)[1]);
        tray.dispatchEvent(new PointerEvent("pointerup", { ...last, bubbles: true, button: 0, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true }));
        await wait(80);
      };
      const line = (x1, y1, x2, y2, steps) => Array.from({ length: steps }, (_, i) => {
        const t = steps <= 1 ? 0 : i / (steps - 1);
        return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
      });

      await paint("Wall", line(0.22, 0.78, 0.78, 0.78, 22));
      await paint("Stone", line(0.25, 0.7, 0.38, 0.7, 9));
      await paint("Wood", line(0.44, 0.71, 0.57, 0.71, 9));
      await paint("Soil", line(0.48, 0.62, 0.56, 0.62, 7));
      await paint("Seed", [[0.52, 0.57], [0.54, 0.57]]);
      await paint("Water", [[0.5, 0.57], [0.51, 0.58]]);
      await paint("Soil", line(0.62, 0.7, 0.74, 0.7, 9));
      await paint("Seed", [[0.68, 0.62], [0.69, 0.61], [0.7, 0.62]]);
      await paint("Water", line(0.66, 0.6, 0.71, 0.6, 5));
      await paint("Moss", line(0.65, 0.66, 0.75, 0.66, 8));
      await paint("Sand", line(0.3, 0.38, 0.43, 0.38, 10));
      await paint("Water", line(0.48, 0.38, 0.58, 0.38, 8));
      await paint("Lava", [[0.18, 0.5], [0.19, 0.49], [0.2, 0.5]]);
      await paint("Fire", [[0.45, 0.63], [0.46, 0.62], [0.47, 0.63]]);
      await paint("Moonwater", line(0.72, 0.36, 0.8, 0.36, 7));
      await wait(2200);
      return true;
    })()`
  );
}

async function capture(cdp, fileName) {
  return captureScreenshot(cdp, outputDir, fileName);
}

await main();
