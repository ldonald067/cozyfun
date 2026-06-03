import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_SEVEN_QA_LABEL, phaseSevenShowcaseScript } from "./phase-seven-showcase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");
const outputDir = path.join(root, ".tmp", "visual-qa");

const mimeTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"]
]);

async function main() {
  await assertDistExists();
  await mkdir(outputDir, { recursive: true });

  const staticServer = await startStaticServer();
  const browser = await startBrowser();

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

    const appUrl = `http://127.0.0.1:${staticServer.port}/?visualQa=${PHASE_SEVEN_QA_LABEL}`;
    await cdp.send("Page.navigate", { url: appUrl });
    await waitUntil(
      () => evaluate(cdp, `document.readyState === "complete" && Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`),
      "app shell"
    );
    await waitUntil(async () => (await statusText(cdp)).includes("online"), "engine online");

    await paintCurrentVisualScene(cdp);
    const materialCapture = await saveSandboxComposite(cdp, "current-materials.png");
    await loadPhaseSevenShowcase(cdp);
    const phaseSevenCapture = await saveSandboxComposite(cdp, `${PHASE_SEVEN_QA_LABEL}.png`);
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
    console.log(`- ${phaseSevenCapture}`);
    console.log(`- ${path.join(outputDir, "current-layout.json")}`);
    for (const capture of roomCaptures) console.log(`- ${capture}`);
    if (screenshotCapture) console.log(`- ${screenshotCapture}`);
  } finally {
    await browser.close();
    await staticServer.close();
  }
}

async function loadPhaseSevenShowcase(cdp) {
  await evaluate(cdp, phaseSevenShowcaseScript());
  await waitUntil(async () => (await statusText(cdp)).includes("browser save loaded"), "phase 7 showcase");
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
    await clickTestId(cdp, `scene-environment-${room.id}`);
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
  const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const outPath = path.join(outputDir, fileName);
  await writeFile(outPath, Buffer.from(result.data, "base64"));
  return outPath;
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

async function assertDistExists() {
  try {
    const result = await stat(path.join(distDir, "index.html"));
    assert(result.isFile(), "app/dist/index.html is not a file");
  } catch {
    throw new Error("Build the app before running visual QA: npm run build");
  }
}

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }
      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.resolve(distDir, `.${pathname}`);
      if (!isInsideDist(filePath)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, { "Content-Type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  const port = await listen(server);
  return {
    port,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function isInsideDist(filePath) {
  const relative = path.relative(distDir, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function startBrowser() {
  const executable = await findBrowserExecutable();
  const debugPort = await freePort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "cozy-visual-"));
  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-background-networking",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-sync",
    "--headless=new",
    "--no-default-browser-check",
    "--no-first-run",
    "--no-sandbox",
    "--window-size=1280,900",
    "about:blank"
  ];
  const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  await waitUntil(async () => {
    if (child.exitCode !== null) throw new Error(`Browser exited early:\n${stderr}`);
    return Boolean(await browserTargets(debugPort).catch(() => null));
  }, "browser debugger", 10_000);

  return {
    debugPort,
    close: async () => {
      child.kill();
      await waitForExit(child);
      await removeBrowserProfile(userDataDir);
    }
  };
}

async function waitForExit(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1_500);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function removeBrowserProfile(userDataDir) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await rm(userDataDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`Could not remove temporary browser profile: ${error.message}`);
        return;
      }
      await sleep(150 * attempt);
    }
  }
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_BINARY,
    process.env.CHROME,
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chrome or Edge executable found. Set BROWSER_BINARY to run visual QA.");
  return found;
}

async function connectToFirstPage(debugPort) {
  const targets = await browserTargets(debugPort);
  const target = targets.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
  assert(target, "no debuggable browser page target found");
  return Cdp.connect(target.webSocketDebuggerUrl);
}

async function browserTargets(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  if (!response.ok) throw new Error(`debugger list returned ${response.status}`);
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
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

async function click(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await sleep(45);
}

async function clickTestId(cdp, testId) {
  const rect = await evaluate(
    cdp,
    `(() => {
      const rect = document.querySelector('[data-testid="${testId}"]')?.getBoundingClientRect();
      return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
    })()`
  );
  assert(rect, `missing test id for visual QA: ${testId}`);
  await click(cdp, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

async function drag(cdp, path) {
  const first = path[0];
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: first.x, y: first.y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: first.x, y: first.y, button: "left", clickCount: 1 });
  for (const point of path.slice(1)) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "left", buttons: 1 });
    await sleep(12);
  }
  const last = path[path.length - 1];
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: last.x, y: last.y, button: "left", clickCount: 1 });
  await sleep(55);
}

async function statusText(cdp) {
  return evaluate(cdp, `document.querySelector('[data-testid="status-message"]')?.textContent ?? ""`);
}

async function waitUntil(task, label, timeout = 5_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      if (await task()) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

async function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "server did not bind to a TCP port");
      resolve(address.port);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
