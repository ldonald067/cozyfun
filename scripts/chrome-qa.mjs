import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_SEVEN_QA_LABEL, phaseSevenShowcaseScript } from "./phase-seven-showcase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "chrome-qa");
const appPort = Number(process.env.CHROME_QA_APP_PORT ?? 4173);
const debugPort = Number(process.argv[2] ?? process.env.CHROME_QA_REMOTE_PORT ?? 9335);
const appUrl = `http://127.0.0.1:${appPort}/?chromeQa=${PHASE_SEVEN_QA_LABEL}&cache=${Date.now()}`;

async function main() {
  await assertAppReachable(appPort);
  await mkdir(outputDir, { recursive: true });
  const cdp = await connectToFirstPage(debugPort);

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
    await loadPhaseSevenShowcase(cdp);
    const phaseSevenPath = await capture(cdp, `chrome-${PHASE_SEVEN_QA_LABEL}.png`);
    await exerciseDeskRadio(cdp);
    const deskRadioPath = await capture(cdp, "chrome-desk-radio-blocked.png");

    const errors = await evaluate(cdp, `window.__chromeQaErrors ?? []`);
    assert(errors.length === 0, `Chrome page errors: ${errors.join("; ")}`);

    console.log("Chrome QA passed");
    console.log(`- ${desktopPath}`);
    console.log(`- ${paintedPath}`);
    console.log(`- ${phaseSevenPath}`);
    console.log(`- ${deskRadioPath}`);
    console.log(`- ${state.styles.join(", ")}`);
    console.log(`- ${state.scripts.join(", ")}`);
  } finally {
    await cdp.close().catch(() => {});
  }
}

async function loadPhaseSevenShowcase(cdp) {
  await evaluate(cdp, phaseSevenShowcaseScript());
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
  assert(state.message.includes("Generated music is still playing"), `Blocked Desk Radio fallback was unclear: ${state.message}`);
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

async function connectToFirstPage(port) {
  await waitUntil(async () => {
    try {
      await browserTargets(port);
      return true;
    } catch {
      return false;
    }
  }, "Chrome remote debugging");
  const targets = await browserTargets(port);
  const target = targets.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
  assert(target, "no debuggable Chrome page target found");
  return Cdp.connect(target.webSocketDebuggerUrl);
}

async function browserTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Chrome debugger list returned ${response.status}`);
  return response.json();
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.onmessage = async (event) => {
      const text = typeof event.data === "string" ? event.data : Buffer.from(await event.data.arrayBuffer()).toString("utf8");
      const message = JSON.parse(text);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
    socket.onclose = () => {
      for (const pending of this.pending.values()) pending.reject(new Error("CDP socket closed"));
      this.pending.clear();
    };
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("failed to open CDP socket"));
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async close() {
    this.socket.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluation failed");
  return result.result.value;
}

async function capture(cdp, fileName) {
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, Buffer.from(screenshot.data, "base64"));
  return filePath;
}

async function click(cdp, selector, options = {}) {
  const box = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      element.scrollIntoView({ block: "center", inline: "center" });
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    })()`
  );
  assert(box, `missing element for click: ${selector}`);
  const x = box.left + box.width * (options.xRatio ?? 0.5);
  const y = box.top + box.height * (options.yRatio ?? 0.5);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await sleep(80);
}

async function setText(cdp, selector, value) {
  await evaluate(
    cdp,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return input.value;
    })()`
  );
  await sleep(40);
}

async function statusText(cdp) {
  return evaluate(cdp, `document.querySelector('[data-testid="status-message"]')?.textContent ?? ""`);
}

async function waitForStatus(cdp, expected) {
  await waitUntil(async () => (await statusText(cdp)) === expected, `status "${expected}"`);
}

async function assertAppReachable(port) {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  if (!response.ok) throw new Error(`Preview server on 127.0.0.1:${port} returned ${response.status}. Run scripts/preview-built.cmd first.`);
}

async function waitUntil(task, label, timeout = 15000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      if (await task()) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
