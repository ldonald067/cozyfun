import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");

const mimeTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"]
]);

const checks = [];
const protocolErrors = [];

async function main() {
  await assertDistExists();

  const staticServer = await startStaticServer();
  const browser = await startBrowser();

  try {
    const cdp = await connectToFirstPage(browser.debugPort);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      protocolErrors.push(exceptionDetails?.text ?? "Runtime exception");
    });
    cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
      if (type === "error") protocolErrors.push(args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    });
    cdp.on("Log.entryAdded", ({ entry }) => {
      if (entry.level === "error") protocolErrors.push(entry.text);
    });

    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
      window.__smokeErrors = [];
      window.addEventListener("error", (event) => {
        window.__smokeErrors.push(event.message || "window error");
      });
      window.addEventListener("unhandledrejection", (event) => {
        window.__smokeErrors.push(String(event.reason || "unhandled rejection"));
      });
      const originalError = console.error;
      console.error = (...args) => {
        window.__smokeErrors.push(args.map(String).join(" "));
        originalError.apply(console, args);
      };
    `
    });

    const appUrl = `http://127.0.0.1:${staticServer.port}/`;
    await cdp.send("Page.navigate", { url: appUrl });
    await waitUntil(
      () => evaluate(cdp, `document.readyState === "complete" && Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`),
      "app shell to load"
    );
    await waitUntil(async () => (await statusText(cdp)).includes("online"), "engine to come online");

  await check("app loads the sandbox shell", async () => {
    const state = await evaluate(cdp, `(() => ({
      title: document.title,
      materials: document.querySelectorAll(".material-button").length,
      audioInfos: document.querySelectorAll(".audio-info").length,
      audioMoods: document.querySelectorAll(".audio-mood-control button").length,
      status: document.querySelector('[data-testid="status-message"]')?.textContent ?? ""
    }))()`);
    assert(state.title === "Cozy Pixel Sandbox", "unexpected page title");
    assert(state.materials >= 19, `expected material buttons, found ${state.materials}`);
    assert(state.audioInfos === 4, `expected four audio info icons, found ${state.audioInfos}`);
    assert(state.audioMoods === 3, `expected three audio mood buttons, found ${state.audioMoods}`);
    assert(state.status.includes("online"), `engine did not report online: ${state.status}`);
  });

  await check("painting changes the canvas", async () => {
    const before = await canvasSignature(cdp);
    await click(cdp, '[data-testid="sandbox-tray"]', { xRatio: 0.5, yRatio: 0.32 });
    await sleep(260);
    const after = await canvasSignature(cdp);
    assert(before !== after, "canvas signature did not change after painting");
  });

  await check("clear, save, and load update scene state", async () => {
    await click(cdp, '[data-testid="save-scene"]');
    await waitForStatus(cdp, "scene saved locally");
    await click(cdp, '[data-testid="clear-scene"]');
    await waitForStatus(cdp, "tray cleared");
    await click(cdp, '[data-testid="load-scene"]');
    await waitForStatus(cdp, "local scene loaded");
  });

  await check("export and invalid import produce clear feedback", async () => {
    try {
      await cdp.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: browser.downloadDir
      });
    } catch {
      // Some Chromium builds only expose download behavior on browser contexts.
    }
    await click(cdp, '[data-testid="export-scene"]');
    await waitForStatus(cdp, "scene exported");
    await evaluate(
      cdp,
      `(() => {
        const input = document.querySelector('[data-testid="scene-file-input"]');
        const file = new File(["not a cozy scene"], "bad-scene.json", { type: "application/json" });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`
    );
    await waitForStatus(cdp, "invalid scene file");
  });

  await check("audio controls start, mute, adjust, and stop", async () => {
    await click(cdp, '[data-testid="audio-toggle"]');
    await waitForStatus(cdp, "rain lo-fi on");
    await waitUntil(() => textIncludes(cdp, '[data-testid="audio-toggle"]', "Stop"), "audio start button to become stop");
    await click(cdp, '[data-testid="audio-mood-stardust"]');
    await waitForStatus(cdp, "stardust study on");
    await click(cdp, '[data-testid="audio-mute"]');
    await waitForStatus(cdp, "audio muted");
    await waitUntil(() => textIncludes(cdp, '[data-testid="audio-mute"]', "Muted"), "mute button to show muted");
    await setRange(cdp, '[data-testid="audio-volume-music"]', "0.12");
    const musicVolume = await evaluate(cdp, `document.querySelector('[data-testid="audio-volume-music"]')?.value`);
    assert(musicVolume === "0.12", `music volume did not update, got ${musicVolume}`);
    await click(cdp, '[data-testid="audio-mute"]');
    await waitForStatus(cdp, "audio unmuted");
    await click(cdp, '[data-testid="audio-toggle"]');
    await waitForStatus(cdp, "Stardust Study resting");
  });

  await check("page stayed free of browser errors", async () => {
    const pageErrors = await evaluate(cdp, `window.__smokeErrors ?? []`);
    assert(pageErrors.length === 0, `page errors: ${pageErrors.join("; ")}`);
    assert(protocolErrors.length === 0, `protocol errors: ${protocolErrors.join("; ")}`);
  });

    await cdp.close();
  } finally {
    await browser.close();
    await staticServer.close();
  }

  for (const name of checks) console.log(`✓ ${name}`);
  console.log("Browser smoke checks passed");
}

async function assertDistExists() {
  try {
    const result = await stat(path.join(distDir, "index.html"));
    assert(result.isFile(), "app/dist/index.html is not a file");
  } catch {
    throw new Error("Build the app before running browser smoke checks: npm run build");
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
      if (!filePath.startsWith(distDir)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream"
      });
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

async function startBrowser() {
  const executable = await findBrowserExecutable();
  const debugPort = await freePort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "cozy-browser-"));
  const downloadDir = await mkdtemp(path.join(os.tmpdir(), "cozy-downloads-"));
  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-networking",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-sync",
    "--headless=new",
    "--no-default-browser-check",
    "--no-first-run",
    "--no-sandbox",
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
  }, "browser debugger to start", 10_000);

  return {
    debugPort,
    downloadDir,
    close: async () => {
      child.kill();
      await Promise.allSettled([
        rm(userDataDir, { recursive: true, force: true }),
        rm(downloadDir, { recursive: true, force: true })
      ]);
    }
  };
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
  if (!found) {
    throw new Error("No Chrome or Edge executable found. Set BROWSER_BINARY to run browser smoke checks.");
  }
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
    this.handlers = new Map();
    socket.onmessage = async (event) => {
      const text = typeof event.data === "string" ? event.data : Buffer.from(await event.data.arrayBuffer()).toString("utf8");
      const message = JSON.parse(text);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) ?? []) handler(message.params ?? {});
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

  on(method, handler) {
    const handlers = this.handlers.get(method) ?? [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
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

async function click(cdp, selector, options = {}) {
  const box = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
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

async function setRange(cdp, selector, value) {
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

async function canvasSignature(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const canvas = document.querySelector(".base-canvas");
      const context = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !context || canvas.width === 0 || canvas.height === 0) return 0;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let signature = 0;
      for (let i = 0; i < data.length; i += 97) {
        signature = (signature + data[i] + data[i + 1] * 3 + data[i + 2] * 7 + data[i + 3] * 11) % 1000000007;
      }
      return signature;
    })()`
  );
}

async function statusText(cdp) {
  return evaluate(cdp, `document.querySelector('[data-testid="status-message"]')?.textContent ?? ""`);
}

async function waitForStatus(cdp, expected) {
  await waitUntil(async () => (await statusText(cdp)) === expected, `status "${expected}"`);
}

async function textIncludes(cdp, selector, expected) {
  return evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})?.textContent?.includes(${JSON.stringify(expected)}) ?? false`);
}

async function check(name, task) {
  await task();
  checks.push(name);
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
